import re
from .openai_client import invoke, generate_single_image,generate_multi_images
from .prompts import build_cover_image_prompt_prompt,build_scene_image_prompt_prompt


def generate_cover_image(core_seed: str, size: str ="1920x1080") :
    """调用AI生成封面，返回可访问的URL
    """
    prompt = invoke(build_cover_image_prompt_prompt(core_seed))
    image_url = generate_single_image(prompt, size)
    return image_url

def _extract_scenes_prompt(raw_scenes_prompt: str):
    # 提取所有范围值
    ranges = re.findall(r'### 范围：\s*\[?(\d+)\]?', raw_scenes_prompt)
    ranges = [int(range_str) for range_str in ranges]

    # 删除所有范围行
    pattern = r'### 范围：\s*\[?\d+\]?\s*\n'
    cleaned_content = re.sub(pattern, '', raw_scenes_prompt)
    
    return ranges, cleaned_content


def generate_scene_images(chapter_content: str, size: str = "1920x1080"):
    """使用AI生成一组连贯的背景图片,返回场景分布范围列表和图片URL列表"""

    raw_scenes_prompt = invoke(build_scene_image_prompt_prompt(chapter_content))
    ranges, cleaned_prompt = _extract_scenes_prompt(raw_scenes_prompt)

    images_count = len(ranges)
    if images_count == 0:
        return [],[]
    
    image_urls = generate_multi_images(cleaned_prompt,images_count,size)

    return ranges,image_urls
    