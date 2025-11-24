from .openai_client import invoke
from .prompts import(
    build_chapter_prompt,
    update_summary_prompt
)

def generate_chapter_content(
    chapter_index: int, 
    chapter_directory: str,
    core_seed: str,
    attribute_system: str,
    characters: str,
    architecture: str,
    previous_chapter_content: str = None,
    global_summary: str = "",
    user_prompt: str = ""
):
    """生成章节文本 + 更新摘要"""
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
    return chapter_content, updated_summary