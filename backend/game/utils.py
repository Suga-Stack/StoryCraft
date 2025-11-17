"""
章节文本解析工具
"""
import re
import spacy
nlp = spacy.load("zh_core_web_sm")


def _extract_chapter_title(raw: str) -> tuple[int, str]:
    """提取章节序号与标题"""
    m = re.search(r"^第(\d+)章\s*-\s*(.+)", raw.strip().splitlines()[0])
    if not m:
        return 0, "未命名章节"
    return int(m.group(1)), m.group(2).strip()

def _parse_attr_deltas(effect_text: str) -> dict:
    """解析“属性影响：属性名±值”到 {attr: delta}"""
    deltas: dict[str, int] = {}
    # 允许以空格/顿号/逗号分隔的多组“属性名±值”
    for name, delta in re.findall(r"([^\s，、,:：\+\-\[\]]+)\s*([+-]\d+)", effect_text):
        try:
            deltas[name.strip()] = int(delta)
        except Exception:
            continue
    return deltas

_choice_line_re = re.compile(
    r"^\s*→\s*(?:[AB]|[0-9]+)\.\s*(.+?)\s*\[?属性影响：([^\]]+)\]?\s*$"
)

def _normalize_block(text: str) -> str:
    """规范化文本块:
    - 去除首尾空白
    - 折叠多余空行为单个换行
    - 将剩余换行替换为空格
    - 压缩多余空白为单个空格
    """
    if not text:
        return ""
    t = text.replace("\r", "")
    t = re.sub(r"\n{2,}", "\n", t)          # 多空行折叠
    t = t.strip()
    t = " ".join(t.splitlines())            # 行内合并
    t = re.sub(r"[ \t]+", " ", t)           # 多空格折叠
    return t.strip()

def _split_sentences(text: str) -> list[str]:
    """分句前先做规范化，避免句子里残留换行符"""
    norm = _normalize_block(text)
    if not norm:
        return []
    doc = nlp(norm)
    return [sent.text.strip() for sent in doc.sents if sent.text.strip()]

def _chunk_narrations(text: str, min_len: int = 25, max_len: int = 60) -> list[str]:
    """把文本按句子聚合为若干 narration，长度尽量在 25-60 字之间，不拆句"""
    sents = _split_sentences(text)
    if not sents:
        return []
    chunks = []
    buf = ""
    for s in sents:
        # 若单句已经很长，直接作为一个块
        if len(s) >= max_len and not buf:
            chunks.append(s)
            continue
        if not buf:
            buf = s
        else:
            # 尝试合并
            if len(buf) + len(s) <= max_len:
                buf = f"{buf}{s}"
            else:
                # 若当前 buf 太短但再加就超长，则先提交 buf
                chunks.append(buf)
                buf = s
    if buf:
        chunks.append(buf)

    # 二次调整：若某块过短（< min_len），尝试与前块合并（仍不拆句，只拼接）
    adjusted = []
    for chunk in chunks:
        if adjusted and len(chunk) < min_len and len(adjusted[-1]) + len(chunk) <= max_len:
            adjusted[-1] = adjusted[-1] + chunk
        else:
            adjusted.append(chunk)
    # 统一规范化每个 narration
    return [_normalize_block(c) for c in adjusted if _normalize_block(c)]

def _collect_reaction_line(lines: list[str], start_idx: int) -> tuple[str, int]:
    """
    仅提取选项后的下一行原始即时反应文本（可能为空），不做长度处理。
    返回 (raw_line, new_index)
    """
    i = start_idx
    if i >= len(lines):
        return ("", i)
    candidate = lines[i]
    # 空行直接跳过
    if not candidate.strip():
        return ("", i + 1)
    # 若下一行仍是选项行，视为无反应
    if _choice_line_re.match(candidate):
        return ("", i)
    return (candidate.strip(), i + 1)

def _chunk_reaction(text: str, min_len: int = 25, max_len: int = 60) -> list[str]:
    """
    将即时反应文本按句切分并聚合为 25-60 字的块。
    不拆句；若最后一块 <25 且有前一块则与前一块合并；若只有一块且 <25 则保留（无法扩充）。
    """
    if not text:
        return []
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks = []
    buf = ""
    for s in sentences:
        if len(s) >= max_len and not buf:
            # 单句超长直接作为一个块
            chunks.append(s)
            continue
        if not buf:
            buf = s
        else:
            if len(buf) + len(s) <= max_len:
                buf += s
            else:
                # 输出当前缓冲
                chunks.append(buf)
                buf = s
    if buf:
        chunks.append(buf)

    # 合并不足 min_len 的末块
    if len(chunks) >= 2 and len(chunks[-1]) < min_len:
        # 尝试与前块合并（不再校验 max_len，若超过也接受）
        chunks[-2] += chunks[-1]
        chunks.pop()
    # 新增：规范化 reaction 块
    return [_normalize_block(c) for c in chunks if _normalize_block(c)]

def _iter_choice_groups(text: str) -> list[dict]:
    """扫描文本，定位选项组；允许被空行隔开的连续选项继续归为同一组。"""
    groups = []
    lines = text.splitlines(keepends=True)
    offsets = []
    acc = 0
    for ln in lines:
        offsets.append(acc)
        acc += len(ln)

    i = 0
    n = len(lines)
    while i < n:
        # 寻找组起点（必须是选项行）
        if not _choice_line_re.match(lines[i]):
            i += 1
            continue

        group_start = offsets[i]
        choices = []

        while i < n:
            # 跳过组内空行
            while i < n and lines[i].strip() == "":
                i += 1
            if i >= n or not _choice_line_re.match(lines[i]):
                break

            m = _choice_line_re.match(lines[i])
            choice_text, effect = m.groups()
            i += 1  # 跳过选项行

            reaction_raw, i = _collect_reaction_line(lines, i)
            subsequent = _chunk_reaction(reaction_raw) if reaction_raw else []

            choices.append({
                "text": choice_text.strip(),
                "attributesDelta": _parse_attr_deltas(effect),
                "statusesDelta": {},
                "subsequentDialogues": subsequent,
                "choiceId": len(choices) + 1
            })
            # 继续循环，允许空行后再出现新的选项行并加入同一组

        group_end = offsets[i] if i < n else len(text)
        groups.append({"start": group_start, "end": group_end, "choices": choices})

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
        p = start_seek + m.start()
        if p <= approx_end:
            last_punct_pos = p
        else:
            break
    if last_punct_pos != -1 and last_punct_pos > prev_end:
        return last_punct_pos + 1

    for m in re.finditer(rf"[{re.escape(punct)}]", snippet):
        p = start_seek + m.start()
        if p > approx_end:
            return p + 1

    return approx_end

def _split_by_ranges_safely(body: str, ranges: list[int]) -> list[str]:
    """基于百分比切分，但确保不拆段、不拆选项块及其反应文本"""
    if not ranges:
        return [body.strip()] if body.strip() else []
    groups = _iter_choice_groups(body)
    total = len(body)
    segments = []
    prev_end = 0
    for pct in ranges:
        approx = int(total * (pct / 100.0))
        approx = min(max(approx, prev_end), total)
        cut = _find_safe_cut(body, approx, groups, prev_end)
        cut = min(max(cut, prev_end), total)
        segments.append(body[prev_end:cut].strip())
        prev_end = cut
    if prev_end < total:
        segments[-1] = (segments[-1] + "\n" + body[prev_end:]).strip()
    # 过滤空段
    return [s for s in segments if s]

def _strip_headers(raw: str) -> str:
    """移除开头的章节标题行与“### 剧情内容”行，仅保留正文"""
    s = raw.lstrip()
    s = re.sub(r"^第\d+章\s*-\s*.*\n", "", s, count=1)
    s = re.sub(r"^\s*#+\s*剧情内容\s*\n", "", s, count=1, flags=re.MULTILINE)
    return s.strip()

def parse_raw_chapter(raw_content: str, ranges: list[int]) -> dict:
    """
    生成 parsed_content
    """
    chapter_index, chapter_title = _extract_chapter_title(raw_content)
    body = _strip_headers(raw_content)
    segments = _split_by_ranges_safely(body, ranges)
    scenes = []

    for i, seg in enumerate(segments, start=1):
        seg_dialogues = []
        pos = 0
        groups = _iter_choice_groups(seg)
        for g in groups:
            prefix = seg[pos:g["start"]].strip()
            narrs = _chunk_narrations(prefix)
            for n in narrs[:-1]:
                if n:  # 跳过空
                    seg_dialogues.append({"narration": n, "playerChoices": None})
            if narrs:
                last_n = narrs[-1]
                seg_dialogues.append({
                    "narration": last_n if last_n else "",
                    "playerChoices": [
                        {
                            **choice,
                            "subsequentDialogues": [d for d in choice["subsequentDialogues"] if d]
                        } for choice in g["choices"]
                    ]
                })
            else:
                seg_dialogues.append({
                    "narration": "",
                    "playerChoices": [
                        {
                            **choice,
                            "subsequentDialogues": [d for d in choice["subsequentDialogues"] if d]
                        } for choice in g["choices"]
                    ]
                })
            pos = g["end"]

        tail = seg[pos:].strip()
        if tail:
            for n in _chunk_narrations(tail):
                if n:
                    seg_dialogues.append({"narration": n, "playerChoices": None})

        scenes.append({"id": i, "dialogues": seg_dialogues})

    return {"chapterIndex": chapter_index, "title": chapter_title, "scenes": scenes}

