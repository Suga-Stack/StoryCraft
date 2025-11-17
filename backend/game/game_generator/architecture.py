from .openai_client import invoke
from .prompts import (
    build_core_seed_prompt,
    build_attribute_prompt,
    build_character_dynamics_prompt,
    build_game_architecture_prompt, 
    build_chapter_directory_prompt
)
import re

def _parse_core_seed(core_seed: str) -> tuple[str, str]:
    """从 core_seed 文本中提取标题与简介"""
    title_match = re.search(r"\[标题\][:：]\s*(.+)", core_seed)
    desc_match = re.search(r"\[简介\][:：]\s*(.+)", core_seed)
    title = title_match.group(1).strip() if title_match else ""
    description = desc_match.group(1).strip() if desc_match else ""
    return title, description

def _parse_chapter_directory(chapter_directory: str) -> list[dict]:
    """
    从章节目录文本中提取每章的标题与章节大纲
    """
    outlines: list[dict] = []
    chapter_pattern = re.compile(r"###\s*第(\d+)章\s*-\s*(.+)")
    matches = list(chapter_pattern.finditer(chapter_directory))
    
    for i, m in enumerate(matches):
        chap_index = int(m.group(1))
        chap_title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(chapter_directory)
        block = chapter_directory[start:end]
        
        outline_match = re.search(r"\*\*章节大纲\*\*：(.+)", block)
        outline = outline_match.group(1).strip() if outline_match else ""
        
        outlines.append({
            "chapterIndex": chap_index,
            "title": chap_title,
            "outline": outline
        })
    
    return outlines

def _parse_initial_attributes(attribute_system: str) -> dict[str, int]:
    """从标准 Markdown 表格中提取初始属性值
    """
    attrs: dict[str, int] = {}
    row_pattern = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([0-9]+)\s*\|", re.MULTILINE)
    for name, val in row_pattern.findall(attribute_system):
        name = name.strip()
        if name == "属性":  # 表头跳过
            continue
        try:
            attrs[name] = int(val)
        except ValueError:
            continue
    return attrs


def generate_core_seed(tags: list[str], idea: str, total_chapters: int) -> dict:
    """根据用户输入生成核心种子,并解析出标题、简介
    """
    core_seed = invoke(build_core_seed_prompt(tags, idea, total_chapters))
    title, description = _parse_core_seed(core_seed)

    return {
        "title": title,
        "description": description,
        "core_seed": core_seed
    }

def generate_architecture(core_seed: str, total_chapters: int) -> dict:
    """根据剧情种子生成属性系统、剧情架构等
    """
    # 1. 调用各阶段生成
    attribute_system = invoke(build_attribute_prompt(core_seed))
    characters = invoke(build_character_dynamics_prompt(core_seed, attribute_system))
    architecture = invoke(build_game_architecture_prompt(core_seed, attribute_system, characters, total_chapters))
    chapter_directory = invoke(build_chapter_directory_prompt(core_seed, attribute_system, characters, architecture, total_chapters))

    # 2. 解析章节大纲列表
    outlines = _parse_chapter_directory(chapter_directory)

    # 3. 解析初始属性
    initial_attributes = _parse_initial_attributes(attribute_system)

    # 4. 返回核心结构
    return {
        "outlines": outlines,
        "initial_attributes": initial_attributes,
        "raw": {
            "attribute_system": attribute_system,
            "characters": characters,
            "architecture": architecture,
            "chapter_directory": chapter_directory
        }
    }