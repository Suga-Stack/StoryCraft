import re

from .openai_client import invoke, prompt
from .prompts import chapter_system_prompt, ending_system_prompt, update_summary_system_prompt


def _extract_chapter_block(text: str, index: int) -> str:
    """从目录文本中提取特定章节的块"""
    # 匹配 ## 第X章 或 第X章 开头，直到下一个 第X章 或 结尾
    pattern = re.compile(r"(?:##\s*)?第" + str(index) + r"章\s*-\s*(.+?)\n(.*?)(?=(?:##\s*)?第\d+章|$)", re.DOTALL)
    match = pattern.search(text)
    if match:
        return f"第{index}章 - {match.group(1)}\n{match.group(2)}".strip()
    return "未找到该章节设定"


def generate_chapter_content(
    chapter_index: int,
    total_chapters: int,
    chapter_directory: str,
    core_seed: str,
    architecture: str,
    previous_chapter_content: str = "",
    global_summary: str = "",
    user_prompt: str = "",
):
    """生成章节文本 + 更新摘要"""

    # 准备输入信息
    current_chap_info = _extract_chapter_block(chapter_directory, chapter_index)

    if chapter_index < total_chapters:
        next_chap_info = _extract_chapter_block(chapter_directory, chapter_index + 1)
    else:
        next_chap_info = "无（这是最后一章，结局触发点）"

    prev_end = ""
    if previous_chapter_content:
        # 取上一章最后一段或最后500字
        prev_end = previous_chapter_content[-500:]

    # 构建 User Prompt
    input_text = f"""
1. 基础创意设定：
{core_seed}

2. 全局叙事架构：
{architecture}

3. 本章章节目录：
{current_chap_info}

4. 下一章章节目录：
{next_chap_info}

5. 前文全局内容摘要：
{global_summary if global_summary else "无（这是第一章）"}

6. 上一章结尾段：
{prev_end if prev_end else "无（这是第一章）"}

7. 补充说明：
{user_prompt}
"""

    # 调用 AI
    chapter_content = invoke(prompt(chapter_system_prompt, input_text))
    update_summary_user_prompt = f"""
前文全局摘要：
{global_summary if global_summary else "无（这是第一章）"}

新章节文本：
{chapter_content}
"""
    # 更新摘要
    updated_summary = invoke(prompt(update_summary_system_prompt, update_summary_user_prompt))

    return chapter_content, updated_summary


def generate_ending_content(
    ending_condition: str,
    ending_summary: str,
    architecture: str,
    last_chapter_content: str,
    global_summary: str = "",
    user_prompt: str = "",
) -> str:
    """生成单个结局的完整内容"""

    # 最后一章结尾段
    last_end = last_chapter_content[-800:] if last_chapter_content else ""

    input_text = f"""
1. 完整框架设定：
{architecture}

2. 最后一章剧情结尾段：
{last_end}

3. 前文全文摘要总结：
{global_summary}

4. 特定结局分支触发条件：
{ending_condition}

5. 特定结局剧情梗概：
{ending_summary}

6. 补充说明：
{user_prompt if user_prompt else "无"}
"""

    ending_content = invoke(prompt(ending_system_prompt, input_text))
    return ending_content


def calculate_attributes(parsed_chapters: list, initial_attributes: dict) -> dict:
    """
    遍历所有章节，计算每个属性在游戏结束时的可能取值范围 (min, max)。
    """
    ranges = {k: [v, v] for k, v in (initial_attributes or {}).items()}

    for chapter in parsed_chapters:
        for scene in chapter.get("scenes", []):
            for dialogue in scene.get("dialogues", []):
                choices = dialogue.get("playerChoices")
                if not choices:
                    continue

                # 识别当前选择点影响的所有属性
                affected_attrs = set()
                for choice in choices:
                    deltas = choice.get("attributesDelta", {})
                    if deltas:
                        affected_attrs.update(deltas.keys())

                # 仅更新受影响的属性
                for attr in affected_attrs:
                    if attr not in ranges:
                        ranges[attr] = [0, 0]

                    current_deltas = []
                    for choice in choices:
                        d = choice.get("attributesDelta", {})
                        # 获取该选项对属性的影响，无影响则为0
                        current_deltas.append(d.get(attr, 0))

                    if current_deltas:
                        # 最小值加上当前可能的最小增量，最大值加上最大增量
                        ranges[attr][0] += min(current_deltas)
                        ranges[attr][1] += max(current_deltas)

    return ranges


def parse_ending_condition(text: str, attr_ranges: dict) -> dict:
    """
    将自然语言条件解析为数值条件
    支持格式："勇气较高，智慧较低"
    """
    conditions = {}
    # 排除常见标点，捕获属性名和程度词
    pattern = re.compile(r"([^\s,，:：]+)\s*(较高|中等|较低)")

    for match in pattern.finditer(text):
        attr_raw = match.group(1).strip()
        level = match.group(2)

        # 清理属性名称（移除可能的markdown符号如 **勇气**）
        clean_text = re.sub(r"[\*\[\]]", "", attr_raw).strip()

        # 在清理后的文本中寻找最长匹配的属性名
        best_attr = None
        max_len = 0

        for attr in attr_ranges:
            if attr in clean_text:
                if len(attr) > max_len:
                    best_attr = attr
                    max_len = len(attr)

        if not best_attr:
            continue

        min_v, max_v = attr_ranges[best_attr]
        span = max_v - min_v

        # 处理单一值或无变化的情况
        if span <= 0:
            span = 1

        if level == "较高":
            # 前 50% 区间以上
            threshold = int(min_v + span * 0.50)
            conditions[best_attr] = f">={threshold}"
        elif level == "较低":
            # 后 40% 区间以下
            threshold = int(min_v + span * 0.40)
            conditions[best_attr] = f"<={threshold}"
        elif level == "中等":
            # >= 30%
            low = int(min_v + span * 0.30)
            conditions[best_attr] = f">={low}"

    return conditions
