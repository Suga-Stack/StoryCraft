import re
from .openai_client import invoke, prompt
from .prompts import(
    chapter_system_prompt,
    ending_system_prompt,
    update_summary_prompt
)

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
    attribute_system: str, 
    architecture: str,
    previous_chapter_content: str = "",
    global_summary: str = "",
    user_prompt: str = ""
):
    """生成章节文本 + 更新摘要"""
    
    # 1. 准备输入信息
    current_chap_info = _extract_chapter_block(chapter_directory, chapter_index)
    
    if chapter_index < total_chapters:
        next_chap_info = _extract_chapter_block(chapter_directory, chapter_index + 1)
    else:
        next_chap_info = "无（这是最后一章，结局触发点）"

    prev_end = ""
    if previous_chapter_content:
        # 取上一章最后一段或最后500字
        prev_end = previous_chapter_content[-500:]

    # 2. 构建 User Prompt
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

    # 3. 调用 AI
    chapter_content = invoke(prompt(chapter_system_prompt, input_text))
    
    # 4. 更新摘要
    # 摘要更新不需要太复杂的prompt，直接传内容即可
    summary_input = f"新章节内容：\n{chapter_content}\n\n前文摘要：\n{global_summary}"
    updated_summary = invoke(update_summary_prompt(global_summary,chapter_content))
    
    # 新流程中，结局摘要在架构阶段已生成，章节生成阶段不再生成结局摘要
    return chapter_content, updated_summary, []

def generate_ending_content(
    ending_title: str,
    ending_condition: str,
    ending_summary: str,
    chapter_index: int, 
    attribute_system: str,
    architecture: str,
    previous_chapter_content: str, 
    last_chapter_content: str,     
    global_summary: str = "",
    user_prompt: str = ""
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
{user_prompt}
"""
    
    ending_content = invoke(prompt(ending_system_prompt, input_text))
    return ending_content

def calculate_attributes(parsed_chapters: list, initial_attributes: dict) -> dict:
    """
    遍历所有章节，计算每个属性在游戏结束时的可能取值范围 (min, max)。
    """
    ranges = {k: [v, v] for k, v in initial_attributes.items()}
    
    for chapter in parsed_chapters:
        for scene in chapter.get("scenes", []):
            for dialogue in scene.get("dialogues", []):
                choices = dialogue.get("playerChoices")
                if not choices:
                    continue
                
                impacts = {} 
                for choice in choices:
                    deltas = choice.get("attributesDelta", {})
                    for attr, val in deltas.items():
                        if attr not in impacts:
                            impacts[attr] = []
                        impacts[attr].append(val)
                
                all_attrs = set(ranges.keys()) | set(impacts.keys())
                for attr in all_attrs:
                    if attr not in ranges:
                        ranges[attr] = [0, 0]
                    
                    current_deltas = []
                    for choice in choices:
                        d = choice.get("attributesDelta", {})
                        current_deltas.append(d.get(attr, 0))
                    
                    if current_deltas:
                        ranges[attr][0] += min(current_deltas)
                        ranges[attr][1] += max(current_deltas)
                    
    return ranges

def parse_ending_condition(text: str, attr_ranges: dict) -> dict:
    """
    将自然语言条件解析为数值条件
    """
    conditions = {}
    parts = re.split(r'[，, ]+', text)
    
    for part in parts:
        m = re.search(r'(.+)(较高|中等|较低)', part)
        if not m:
            continue
        attr = m.group(1).strip()
        level = m.group(2)
        
        if attr not in attr_ranges:
            continue
            
        min_v, max_v = attr_ranges[attr]
        span = max_v - min_v
        if span == 0:
            span = 1
        
        if level == "较高":
            threshold = int(min_v + span * 0.60)
            conditions[attr] = f">={threshold}"
        elif level == "较低":
            threshold = int(min_v + span * 0.40)
            conditions[attr] = f"<={threshold}"
        elif level == "中等":
            low = int(min_v + span * 0.33)
            conditions[attr] = f">={low}"
            
    return conditions
