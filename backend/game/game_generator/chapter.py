import re
import json
from typing import Iterator
from .openai_client import invoke
from .prompts import(
    build_chapter_prompt,
    build_last_chapter_with_endings_prompt,
    update_summary_prompt,
    build_ending_content_prompt
)

def _parse_last_chapter_with_endings_output(text: str):
    """
    从合并输出的文本中解析出最后一章前半部分和各个结局概述
    """
    
    # 提取最后一章前半部分
    chapter_match = re.search(
        r"#### 剧情内容\s+(.+?)\s+## 结局概述", 
        text, 
        re.DOTALL
    )
    
    last_chapter_content = ""
    if chapter_match:
        last_chapter_content = chapter_match.group(1).strip()
    
    # 提取各个结局
    endings = []
    ending_pattern = r"### 结局\d+\s*\*{0,2}\s*标题\s*\*{0,2}[:：](.+?)\s*\*{0,2}\s*属性要求\s*\*{0,2}[:：](.+?)\s*\*{0,2}\s*剧情概述\s*\*{0,2}[：:](.+?)(?=### 结局|\Z)"
    ending_matches = re.findall(ending_pattern, text, re.DOTALL)
    
    for match in ending_matches:
        title, condition, summary = match
        endings.append({
            "title": title.strip(),
            "condition": condition.strip(),
            "summary": summary.strip()
        })
    
    return last_chapter_content, endings


def generate_chapter_content(
    chapter_index: int, 
    total_chapters: int,
    chapter_directory: str,
    core_seed: str,
    attribute_system: str,
    characters: str,
    architecture: str,
    previous_chapter_content: str = "",
    global_summary: str = "",
    user_prompt: str = ""
):
    """生成章节文本 + 更新摘要"""
    
    if chapter_index == total_chapters:

        combined_content = invoke(build_last_chapter_with_endings_prompt(
            chapter_index=chapter_index,
            chapter_directory=chapter_directory,
            attribute_system=attribute_system,
            characters=characters,
            architecture=architecture,
            previous_chapter_content=previous_chapter_content,
            global_summary=global_summary
        ))

        last_chapter_content, endings_summary = _parse_last_chapter_with_endings_output(combined_content)

        updated_summary = invoke(update_summary_prompt(
            global_summary=global_summary,
            new_chapter=last_chapter_content
        ))
        
        return last_chapter_content, updated_summary, endings_summary

    else:
        # 常规章节生成
        base_prompt = build_chapter_prompt(
            chapter_index=chapter_index,
            chapter_directory=chapter_directory,
            core_seed=core_seed,
            attribute_system=attribute_system,
            characters=characters,
            architecture=architecture,
            previous_chapter_content=previous_chapter_content,
            global_summary=global_summary
        )
        if user_prompt:
            base_prompt += f"\n# 创作者附加指令\n{user_prompt}\n(请合理融合但保持主线一致)"
        chapter_content = invoke(base_prompt)
        updated_summary = invoke(update_summary_prompt(
            global_summary=global_summary,
            new_chapter=chapter_content
        ))
        return chapter_content, updated_summary, []

def _calculate_attributes(parsed_chapters: list, initial_attributes: dict) -> dict:
    """
    遍历所有章节，计算每个属性在游戏结束时的可能取值范围 (min, max)。
    """
    # 初始化范围为初始属性值
    ranges = {k: [v, v] for k, v in initial_attributes.items()}
    
    for chapter in parsed_chapters:
        for scene in chapter.get("scenes", []):
            for dialogue in scene.get("dialogues", []):
                choices = dialogue.get("playerChoices")
                if not choices:
                    continue
                
                # 收集该选择点所有选项对各属性的影响
                impacts = {} 
                for choice in choices:
                    deltas = choice.get("attributesDelta", {})
                    for attr, val in deltas.items():
                        if attr not in impacts:
                            impacts[attr] = []
                        impacts[attr].append(val)
                
                # 更新范围
                # 只要属性在 ranges 中（即初始属性），或者在 impacts 中出现过
                all_attrs = set(ranges.keys()) | set(impacts.keys())
                for attr in all_attrs:
                    if attr not in ranges:
                        ranges[attr] = [0, 0] # 默认初始为0
                    
                    # 获取当前选择点该属性的所有可能变化值
                    # 如果某个选项没有该属性的变化，视为 0
                    current_deltas = []
                    for choice in choices:
                        d = choice.get("attributesDelta", {})
                        current_deltas.append(d.get(attr, 0))
                    
                    if current_deltas:
                        ranges[attr][0] += min(current_deltas)
                        ranges[attr][1] += max(current_deltas)
                    
    return ranges

def _parse_ending_condition(text: str, attr_ranges: dict) -> dict:
    """
    将自然语言条件（如"勇气较高，智慧中等"）解析为数值条件（如 {"勇气": ">=30", "智慧": ">=20,<=40"}）。
    """
    conditions = {}
    # 按逗号或空格分割
    parts = re.split(r'[，, ]+', text)
    
    for part in parts:
        # 匹配 属性 + 等级
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
            span = 1 # 避免除零
        
        if level == "较高":
            # 前 40%
            threshold = int(min_v + span * 0.60)
            conditions[attr] = f">={threshold}"
        elif level == "较低":
            # 后 40%
            threshold = int(min_v + span * 0.40)
            conditions[attr] = f"<={threshold}"
        elif level == "中等":
            # 前 66%
            low = int(min_v + span * 0.33)
            conditions[attr] = f">={low}"
            
    return conditions

def generate_ending_content(
    endings_summary: list,
    chapter_index: int, 
    attribute_system: str,
    characters: str,
    architecture: str,
    previous_chapter_content: str, 
    last_chapter_content: str,     
    parsed_chapters: list,
    initial_attributes: dict,
    global_summary: str = "",
) -> Iterator[dict]:
    """
    使用 yield 逐个返回生成的结局数据。
    - title（结局标题）
    - condition (解析后条件)
    - raw_content（原始完整结局文本）
    """
    # 计算属性范围
    attr_ranges = _calculate_attributes(parsed_chapters, initial_attributes)
    
    for ending_info in endings_summary:
        # 解析条件
        parsed_condition = _parse_ending_condition(ending_info["condition"], attr_ranges)
        
        # 生成内容
        ending_content = invoke(build_ending_content_prompt(
            ending_title=ending_info["title"],
            ending_condition=ending_info["condition"], 
            ending_summary=ending_info["summary"],
            chapter_index=chapter_index,
            architecture=architecture,
            attribute_system=attribute_system,
            characters=characters,
            global_summary=global_summary,
            previous_chapter_content=previous_chapter_content, 
            last_chapter_content=last_chapter_content     
        ))
        
        yield {
            "title": ending_info["title"],
            "condition": parsed_condition, # 存解析后的数值条件
            "raw_content": ending_content
        }
