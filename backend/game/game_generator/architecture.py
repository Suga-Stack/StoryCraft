import random
import re

from .openai_client import invoke, prompt
from .prompts import (
    chapter_directory_system_prompt,
    long_architecture_system_prompt,
    short_architecture_system_prompt,
    story_seed_system_prompt,
)


def _parse_creative_directions(text: str) -> list[str]:
    """解析创意方向列表，返回每个创意的完整文本"""
    directions = []
    # 匹配 【创意方向X】... 下一个【创意方向】或结尾
    pattern = re.compile(r"(【创意方向\d+】.*?)(?=【创意方向\d+】|$)", re.DOTALL)
    matches = pattern.findall(text)

    for content in matches:
        directions.append(content.strip())

    if not directions:
        directions.append(text)

    return directions


def _extract_section(text: str, header_keyword: str) -> str:
    """提取指定标题下的文本块"""
    # 匹配 (##)? X、[header_keyword] ... 下一个 (##)? X、
    # 兼容 ## 一、创意信息 和 一、创意信息

    header_pattern = r"(?:^|\n)\s*(?:##\s*)?[一二三四五六七八九十]、\s*" + re.escape(header_keyword)
    next_header_pattern = r"(?:^|\n)\s*(?:##\s*)?[一二三四五六七八九十]、"

    pattern = re.compile(header_pattern + r"(.*?)(?=" + next_header_pattern + r"|$)", re.DOTALL)
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def _parse_title_description(text: str) -> tuple[str, str]:
    """从架构中提取最终标题和简介"""
    content = _extract_section(text, "创意信息")
    if not content:
        # 如果提取失败，尝试全文匹配
        content = text

    title_match = re.search(r"\**创意标题\**[:：]\s*(.+)", content)
    desc_match = re.search(r"\**创意简介\**[:：]\s*(.+)", content, re.DOTALL)

    title = title_match.group(1).strip() if title_match else "未命名作品"
    description = desc_match.group(1).strip() if desc_match else "暂无简介"

    # 去除标题可能存在的引号或书名号
    title = re.sub(r"['\"《》]", "", title).strip()

    return title, description


def _parse_attributes(text: str) -> dict[str, int]:
    """解析属性系统"""
    attrs = {}
    # 提取属性系统区块
    attr_text = _extract_section(text, "完整属性系统")
    if not attr_text:
        # 尝试全文搜索
        attr_text = text

    # 匹配 属性名称：xxx ... 初始值：xx，兼容 **属性名称** 以及列表符号 - 或 #
    block_pattern = re.compile(
        r"(?:^|\n)\s*(?:[-*#]\s*)?\**属性名称\**[:：]\s*([^\n]+)(.*?)(?=(?:^|\n)\s*(?:[-*#]\s*)?\**属性名称\**[:：]|$)",
        re.DOTALL,
    )
    blocks = block_pattern.findall(attr_text)

    for name, block in blocks:
        name = re.sub(r"[\*\[\]]", "", name).strip()
        # 兼容 **初始值** 以及列表符号
        val_match = re.search(r"(?:[-*#]\s*)?\**初始值\**[:：]\s*(\d+)", block)
        if val_match:
            try:
                attrs[name] = int(val_match.group(1))
            except ValueError:
                pass
    return attrs


def _parse_outlines(text: str) -> list[dict]:
    """解析章节大纲"""
    outlines = []
    # 匹配 第X章 - [标题]，兼容 **第X章**
    # 对下一章节或大标题( (##)? [一二三四五六]、)预查
    # 兼容 ## 第X章 和 第X章

    chapter_start = r"(?:^|\n)\s*(?:##\s*)?(?:[\*]*\s*)?第(\d+)章\s*-\s*(.+?)\n"
    lookahead = r"(?=(?:^|\n)\s*(?:##\s*)?(?:[\*]*\s*)?第\d+章|(?:^|\n)\s*(?:##\s*)?[一二三四五六七八九十]、|$)"

    chapter_pattern = re.compile(chapter_start + r"(.*?)" + lookahead, re.DOTALL)
    matches = chapter_pattern.findall(text)

    for idx_str, title, content in matches:
        idx = int(idx_str)
        title = re.sub(r"[\*\[\]]", "", title).strip()

        outline = "暂无大纲"

        # 优先匹配长篇格式的 "章节大纲"，兼容 **章节大纲**
        long_match = re.search(r"\**章节大纲\**[:：]\s*(.+)", content, re.DOTALL)
        if long_match:
            outline = long_match.group(1).strip()
            # 长篇格式通常章节大纲在最后，为了安全，截断到下一个大标题或列表项
            cutoff = re.search(r"\n\s*(?:##|[一二三四五六]、)", outline)
            if cutoff:
                outline = outline[: cutoff.start()].strip()
        else:
            # 匹配短篇格式的 "核心剧情"，兼容 **核心剧情** 以及列表项 - 核心剧情
            short_match = re.search(r"(?:-\s*)?\**核心剧情\**[:：]\s*(.+)", content, re.DOTALL)
            if short_match:
                outline = short_match.group(1).strip()
                # 查找下一个以 "- " 开头的行，或者大标题
                cutoff = re.search(r"\n\s*(?:-\s*|##|[一二三四五六]、)", outline)
                if cutoff:
                    outline = outline[: cutoff.start()].strip()

        outlines.append({"chapterIndex": idx, "title": title, "outline": outline})
    return outlines


def _parse_endings(text: str) -> list[dict]:
    """解析结局设计"""
    endings = []
    # 提取结局设计区块
    ending_text = _extract_section(text, "多结局设计")
    if not ending_text:
        ending_text = text

    # 兼容 **结局1**
    ending_pattern = re.compile(r"\**结局(\d+)\**[:：]\s*(.+?)\n(.*?)(?=\**结局\d+\**[:：]|$)", re.DOTALL)
    matches = ending_pattern.findall(ending_text)

    for idx_str, title, content in matches:
        title = re.sub(r"[\*\[\]]", "", title).strip()

        # 兼容 **触发条件**
        cond_match = re.search(r"\**触发条件\**[:：]\s*(.+)", content)
        # 兼容 **核心剧情**
        summary_match = re.search(r"\**核心剧情\**[:：]\s*(.+)", content, re.DOTALL)

        condition = cond_match.group(1).strip() if cond_match else "无"
        summary = summary_match.group(1).strip() if summary_match else ""

        endings.append({"endingIndex": int(idx_str), "title": title, "condition": condition, "summary": summary})
    return endings


def generate_core_seeds(tags: list[str], idea: str) -> list[str]:
    """生成创意种子列表"""
    user_prompt = f"剧情标签：{'，'.join(tags)}\n故事初步构思：{idea if idea else '无'}"
    response = invoke(prompt(story_seed_system_prompt, user_prompt))
    return _parse_creative_directions(response)


def generate_architecture(core_seed: str, total_chapters: int) -> dict:
    """根据选定的创意生成完整架构"""

    ending_count = random.randint(3, 4)

    user_prompt = f"""
1. 创意方向：
{core_seed}

2. 期望章节数：{total_chapters}章

3. 期望结局数：{ending_count}个
"""

    if total_chapters <= 6:
        # 短篇
        arch_response = invoke(prompt(short_architecture_system_prompt, user_prompt))

        # 提取章节目录部分
        # 短篇架构中，目录在 "## 五、每章节目录与核心大纲" 下
        chapter_directory_text = _extract_section(arch_response, "每章节目录与核心大纲")

        # 如果提取为空（可能AI格式有误），则保留全文，依赖后续解析的鲁棒性
        if not chapter_directory_text.strip():
            chapter_directory_text = arch_response

        outlines = _parse_outlines(chapter_directory_text)
    else:
        # 长篇
        arch_response = invoke(prompt(long_architecture_system_prompt, user_prompt))

        # 生成目录 (使用完整架构作为输入)
        dir_user_prompt = f"""
1. 基础创意：
{core_seed}

2. 完整架构：
{arch_response}

3. 明确参数：总章节数{total_chapters}章、期望结局数{ending_count}个。
"""
        chapter_directory_text = invoke(prompt(chapter_directory_system_prompt, dir_user_prompt))
        outlines = _parse_outlines(chapter_directory_text)

    # 提取信息
    title, description = _parse_title_description(arch_response)
    initial_attributes = _parse_attributes(arch_response)
    endings = _parse_endings(arch_response)

    return {
        "title": title,
        "description": description,
        "initial_attributes": initial_attributes,
        "outlines": outlines,
        "endings_summary": endings,
        "architecture_text": arch_response,
        "chapter_directory_text": chapter_directory_text,
    }
