import re

import spacy

"""
章节文本解析工具
"""

nlp = spacy.load("zh_core_web_sm")


def _parse_attr_deltas(effect_text: str) -> dict:
    """解析“属性影响：属性名±值”到 {attr: delta}"""
    deltas: dict[str, int] = {}
    # 允许以空格/顿号/逗号分隔的多组“属性名±值”
    for name, delta in re.findall(r"([^\s，、,:：\+\-\[\]]+)\s*([+-]\d+)", effect_text):
        try:
            deltas[name] = int(delta)
        except ValueError:
            pass
    return deltas


# 1. 箭头可能是 →, ->, =>
# 2. 序号可能是 A., 1.
# 3. 属性标记可能是 [属性影响：...], [影响属性：...], [属性：...]
# 4. 括号可能是 [] 或 【】
_choice_line_re = re.compile(
    r"^\s*\*{0,2}\s*(?:→|->|=>)\s*(?:[ABCD]|[0-9]+)(?:\.|、)?\s*\[?(.+?)\]?\s*(?:\[|【)?(?:属性影响|影响属性|属性)[:：]\s*([^\]】]+)(?:\]|】)?\s*\*{0,2}\s*$"
)


def _normalize_block(text: str) -> str:
    """规范化文本块"""
    if not text:
        return ""
    t = text.replace("\r", "")
    t = re.sub(r"\n{2,}", "\n", t)  # 多空行折叠
    t = t.strip()
    t = " ".join(t.splitlines())  # 行内合并
    t = re.sub(r"[ \t]+", " ", t)  # 多空格折叠
    return t.strip()


def _split_sentences(text: str) -> list[str]:
    """分句前先做规范化，避免句子里残留换行符，并修复因引号导致的错误切分"""
    norm = _normalize_block(text)
    if not norm:
        return []
    doc = nlp(norm)

    merged_sents = []
    buffer = ""

    for sent in doc.sents:
        s_text = sent.text.strip()
        if not s_text:
            continue

        if buffer:
            buffer += s_text
        else:
            buffer = s_text

        # 检查是否可以结束当前句子
        # 1. 引号必须成对
        quote_count = buffer.count('"') + buffer.count("“") + buffer.count("”")
        balanced = quote_count % 2 == 0

        # 2. 如果以冒号结尾，且长度不过长，则尝试与下一句合并（通常是引语）
        ends_colon = buffer.endswith("：") or buffer.endswith(":")

        # 优先长度准则：如果太长了，即使不平衡或有冒号也强制切分（防止无限合并）
        if len(buffer) > 80:
            merged_sents.append(buffer)
            buffer = ""
        elif balanced and not ends_colon:
            merged_sents.append(buffer)
            buffer = ""

    if buffer:
        merged_sents.append(buffer)

    return [s for s in merged_sents if s]


def _chunk_narrations(text: str, min_len: int = 25, max_len: int = 60) -> list[str]:
    """把文本按句子聚合为若干 narration，长度尽量在 25-60 字之间，不拆句"""
    sents = _split_sentences(text)
    if not sents:
        return []
    chunks = []
    buf = ""
    for s in sents:
        if len(buf) + len(s) > max_len and len(buf) >= min_len:
            chunks.append(buf)
            buf = s
        else:
            buf += s
    if buf:
        chunks.append(buf)

    # 二次调整：若某块过短（< min_len），尝试与前块合并（仍不拆句，只拼接）
    adjusted = []
    for chunk in chunks:
        if adjusted and len(chunk) < min_len:
            adjusted[-1] += chunk
        else:
            adjusted.append(chunk)

    return [_normalize_block(c) for c in adjusted if _normalize_block(c)]


def _chunk_reaction(text: str, min_len: int = 25, max_len: int = 60) -> list[str]:
    """将即时反应文本按句切分并聚合为 25-60 字的块。"""
    if not text:
        return []
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks = []
    buf = ""
    for s in sentences:
        if len(buf) + len(s) > max_len and len(buf) >= min_len:
            chunks.append(buf)
            buf = s
        else:
            buf += s
    if buf:
        chunks.append(buf)

    # 合并不足 min_len 的末块
    if len(chunks) >= 2 and len(chunks[-1]) < min_len:
        chunks[-2] += chunks[-1]
        chunks.pop()

    return [_normalize_block(c) for c in chunks if _normalize_block(c)]


def _iter_choice_groups(text: str) -> list[dict]:
    """扫描文本，定位选项组；支持交错的选项与反应文本"""
    groups = []
    lines = text.splitlines(keepends=True)
    n = len(lines)
    i = 0

    while i < n:
        line = lines[i]
        if _choice_line_re.match(line):
            start_idx = i
            choices = []

            # 收集连续的选项组
            while i < n:
                curr = lines[i]
                m = _choice_line_re.match(curr)

                if m:
                    # 发现选项行
                    choice_data = {
                        "text": m.group(1).strip(),
                        "effects": _parse_attr_deltas(m.group(2)),
                        "line_idx": i,
                        "reaction_text": "",
                    }
                    i += 1

                    # 收集该选项对应的反应文本
                    # 规则：直到下一个选项行，或遇到空行（视为块结束）
                    reaction_lines = []
                    while i < n:
                        next_line = lines[i]
                        if _choice_line_re.match(next_line):
                            break  # 下一个选项开始了

                        if not next_line.strip():
                            # 遇到空行，停止收集反应，并消耗掉该空行
                            i += 1
                            break

                        reaction_lines.append(next_line)
                        i += 1

                    choice_data["reaction_text"] = "".join(reaction_lines).strip()
                    choices.append(choice_data)

                elif not curr.strip():
                    # 选项间的空行，跳过
                    i += 1
                else:
                    # 遇到非选项、非空行、且不在反应收集循环中 -> 组结束
                    break

            # 计算字符偏移量
            char_start = sum(len(line) for line in lines[:start_idx])
            char_end = sum(len(line) for line in lines[:i])

            groups.append({"start": char_start, "end": char_end, "choices": choices})
        else:
            i += 1
    return groups


def _find_safe_cut(text: str, approx_end: int, groups: list[dict], prev_end: int) -> int:
    """在 approx_end 附近寻找安全切分点（避开选项组及其反应文本），优先段落/句末。"""
    # 1. 落在某个选项组内部，切到组选项末尾
    for g in groups:
        if g["start"] < approx_end < g["end"]:
            return g["end"]

    # 2. 段落或句末回退
    window = 200
    start_seek = max(prev_end, approx_end - window)
    end_seek = min(len(text), approx_end + window)
    snippet = text[start_seek:end_seek]

    rel = snippet.rfind("\n\n", 0, approx_end - start_seek + 1)
    if rel != -1:
        return start_seek + rel + 2

    punct = "。！？；!?"
    last_punct_pos = -1
    for m in re.finditer(rf"[{re.escape(punct)}]", snippet):
        if m.start() + start_seek <= approx_end:
            last_punct_pos = m.end() + start_seek

    if last_punct_pos != -1 and last_punct_pos > prev_end:
        return last_punct_pos

    return approx_end


def _split_by_ranges_safely(body: str, ranges: list[int]) -> list[str]:
    """基于百分比切分，但确保不拆段、不拆选项块及其反应文本"""
    if not ranges:
        return [body]
    groups = _iter_choice_groups(body)
    total = len(body)
    segments = []
    prev_end = 0
    for pct in ranges:
        approx_end = int(total * (pct / 100.0))

        # 如果目标点已经是结尾（或超过），直接切到末尾，不再寻找安全点
        # 避免 _find_safe_cut 回退导致末尾残留一小段生成第4个scene
        if approx_end >= total:
            cut = total
        else:
            cut = _find_safe_cut(body, approx_end, groups, prev_end)

        # 确保切分点不倒退
        if cut < prev_end:
            cut = prev_end

        segments.append(body[prev_end:cut])
        prev_end = cut
        if prev_end >= total:
            break

    if prev_end < total:
        segments.append(body[prev_end:])

    return [s for s in segments if s.strip()]


def _strip_headers(raw: str) -> str:
    """移除开头的空行，仅保留正文"""
    lines = raw.strip().splitlines()
    if not lines:
        return ""
    while lines and not lines[0].strip():
        lines.pop(0)
    return "\n".join(lines)


def parse_raw_chapter(raw_content: str, ranges: list[int]) -> dict:
    """解析章节内容，根据 ranges 切分场景。返回章节结构化数据。"""
    body = _strip_headers(raw_content)
    segments = _split_by_ranges_safely(body, ranges)

    scenes = []
    for i, seg_text in enumerate(segments):
        dialogues = []
        groups = _iter_choice_groups(seg_text)

        current_pos = 0
        for g in groups:
            # 旁白
            pre_text = seg_text[current_pos : g["start"]]
            if pre_text.strip():
                for chunk in _chunk_narrations(pre_text):
                    dialogues.append({"narration": chunk})

            # 选项
            player_choices = []
            for c in g["choices"]:
                choice_obj = {
                    "choiceId": len(player_choices) + 1,  # 临时ID
                    "text": c["text"],
                    "attributesDelta": c["effects"],
                }
                # 处理选项后的即时反应
                if c.get("reaction_text"):
                    reaction_chunks = _chunk_reaction(c["reaction_text"])
                    if reaction_chunks:
                        choice_obj["subsequentDialogues"] = reaction_chunks

                player_choices.append(choice_obj)

            if not dialogues:
                # 极端情况：段落开头就是选项
                dialogues.append({"narration": "...", "playerChoices": player_choices})
            else:
                # 将选项附加到最后一条 narration
                last_diag = dialogues[-1]
                if "playerChoices" not in last_diag:
                    last_diag["playerChoices"] = player_choices
                else:
                    # 如果上一条已经有选项了，则新建
                    dialogues.append({"narration": "...", "playerChoices": player_choices})

            current_pos = g["end"]

        # 处理剩余文本
        post_text = seg_text[current_pos:]
        if post_text.strip():
            for chunk in _chunk_narrations(post_text):
                dialogues.append({"narration": chunk})

        scenes.append({"id": i + 1, "dialogues": dialogues})

    return {"title": "", "scenes": scenes}


def update_story_directory(story, new_outlines: list[dict]):
    """更新 story.chapter_directory 中的大纲内容"""
    directory = story.chapter_directory
    if not directory:
        return

    for item in new_outlines:
        idx = item.get("chapterIndex")
        new_outline = item.get("outline")
        new_title = item.get("title")

        if idx is None or new_outline is None:
            continue

        # 更新标题 (如果有)
        if new_title:
            # 匹配行： "### 第1章 - 旧标题" 或 "第1章"
            pattern_title_line = re.compile(r"^((?:#+\s*)?第\s*" + str(idx) + r"\s*章).*$", re.MULTILINE)
            m_title = pattern_title_line.search(directory)
            if m_title:
                # 保留前缀，替换后面部分
                new_header = f"{m_title.group(1)} - {new_title}"
                directory = directory[: m_title.start()] + new_header + directory[m_title.end() :]

        # 更新大纲
        pattern_chapter_start = re.compile(r"^(?:#+\s*)?第\s*" + str(idx) + r"\s*章.*$", re.MULTILINE)
        m_start = pattern_chapter_start.search(directory)
        if not m_start:
            continue

        start_idx = m_start.end()

        # 寻找下一章开始位置
        pattern_next_chapter = re.compile(r"^(?:#+\s*)?第\s*\d+\s*章", re.MULTILINE)
        m_next = pattern_next_chapter.search(directory, pos=start_idx)
        end_idx = m_next.start() if m_next else len(directory)

        chapter_body = directory[start_idx:end_idx]

        # 兼容 "章节大纲" 和 "核心剧情"
        # 并且只替换内容部分，保留后续的列表项（如 "- 选择点设计"）
        pattern_outline = re.compile(
            r"((?:-|•|\*|\[|【)?\s*(?:章节大纲|核心剧情)\s*(?:\*\*|\]|】)?\s*[:：]\s*)(.*?)(?=(\n\s*(?:-|•|\*|##|[一二三四五六]、))|$)",
            re.DOTALL,
        )

        if pattern_outline.search(chapter_body):
            safe_outline = new_outline.replace("\\", "\\\\")
            new_body = pattern_outline.sub(r"\1" + safe_outline, chapter_body, count=1)
            directory = directory[:start_idx] + new_body + directory[end_idx:]
        else:
            # 如果没找到大纲字段，追加
            new_body = chapter_body.rstrip() + f"\n\n**章节大纲**：{new_outline}\n\n"
            directory = directory[:start_idx] + new_body + directory[end_idx:]

    story.chapter_directory = directory
    story.save()
