import re
from .openai_client import invoke, generate_single_image,generate_multi_images,prompt
from .prompts import cover_image_system_prompt,scene_image_system_prompt


def generate_cover_image(core_seed: str, size: str ="1920x1080") :
    """调用AI生成封面，返回可访问的URL
    """
    user_prompt = invoke(prompt(cover_image_system_prompt, f"核心设定：\n{core_seed}"))
    image_url = generate_single_image(user_prompt, size)
    return image_url

def _extract_scenes_prompt(raw_scenes_prompt: str):
    # 使用正则分割每个画面块，分隔符为 "## 画面X："
    parts = re.split(r'## 画面\d+[:：]', raw_scenes_prompt)
    
    ranges = []
    prompts = []
    
    for part in parts:
        if not part.strip():
            continue
            
        # 提取范围
        range_match = re.search(r'### 范围：\s*\[?(\d+)\]?', part)
        if range_match:
            ranges.append(int(range_match.group(1)))
            
            # 移除范围行，保留剩下的作为prompt
            clean_part = re.sub(r'### 范围：.*', '', part).strip()
            prompts.append(clean_part)
    
    return ranges, prompts


def generate_scene_images(chapter_content: str, ref_images:list, size: str = "1920x1080"):
    """使用AI生成一组连贯的背景图片,返回场景分布范围列表和图片URL列表"""

    raw_scenes_prompt = invoke(prompt(scene_image_system_prompt,chapter_content))
    ranges, prompts = _extract_scenes_prompt(raw_scenes_prompt)

    images_count = len(ranges)
    if images_count == 0:
        return [],[]
    
    image_urls = generate_multi_images(prompts, ref_images,size)

    return ranges, image_urls
