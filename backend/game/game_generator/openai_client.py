import openai
import logging
import requests
import mimetypes
import uuid
from volcenginesdkarkruntime import Ark
from volcenginesdkarkruntime.types.images.images import SequentialImageGenerationOptions
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import time
logger = logging.getLogger('django')

text_client = openai.OpenAI(
    api_key=settings.AI_API_KEY_FOR_TEXT, 
    base_url=settings.AI_BASE_URL_FOR_TEXT,
)

image_client = Ark(
    api_key=settings.AI_API_KEY_FOR_IMAGE,
    base_url=settings.AI_BASE_URL_FOR_IMAGE,
)

def prompt(system_prompt:str, user_prompt:str):
    if system_prompt:
        return [
        {
            "role": "system",
            "content": system_prompt     
        },
        {
            "role": "user",
            "content": user_prompt
        }
    ]
    else:
        return [
        {
            "role": "user",
            "content": user_prompt
        }
    ]
    
def invoke(messages) -> str:
    """调用文字API
    """
    max_retries = 3
    for attempt in range(max_retries + 1):
        try:
            response = text_client.chat.completions.create(
                model=settings.AI_MODEL_FOR_TEXT,
                messages=messages
            )
            logger.info("Invoke Result:\n%s", response.choices[0].message.content)
            return response.choices[0].message.content
        except Exception as e:
            logger.error("AI文字生成失败 (尝试 %d/%d):\n %s", attempt + 1, max_retries + 1, e)
            if attempt >= max_retries:
                logger.error("AI文字生成在重试后仍然失败。")
                return ""
            time.sleep(1)
    return "" 

def _save_image_from_url(source_url: str, folder: str = "gamework_scenes") -> str:
    """下载并保存图片，返回完整URL"""
    base_url = settings.SITE_DOMAIN
    try:
        file_resp = requests.get(source_url, timeout=30)
        file_resp.raise_for_status()

        guessed_ext = mimetypes.guess_extension(file_resp.headers.get("Content-Type", ""), strict=False) or ".jpg"
        filename = f"{folder}/{uuid.uuid4().hex}{guessed_ext}"
        default_storage.save(filename, ContentFile(file_resp.content))
        return f"{base_url}{settings.MEDIA_URL}{filename}"
    except Exception as e:
        logger.error(f"保存图片失败: {e}")
        return ""


def generate_single_image(prompt: str, size: str ="2560x1440") -> str:
    """调用AI生成图片，返回可访问的URL
    """
    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/cover.jpg"
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            response = image_client.images.generate(
                model=settings.AI_MODEL_FOR_IMAGE,
                prompt=prompt,
                size=size
            )

            if not response.data:
                logger.error("AI生成封面图片时返回空数据")
                raise ValueError("Empty response data")
            
            source_url = response.data[0].url
            saved_url = _save_image_from_url(source_url, folder="gamework_covers")
            
            if saved_url:
                logger.info(f"AI封面生成成功: {saved_url}")
                return saved_url
            else:
                raise Exception("保存图片失败")
        
        except Exception as e:
            logger.error("AI生成封面图片出错 (尝试 %d/%d):\n %s", attempt + 1, max_retries + 1, e)
            if attempt >= max_retries:
                logger.error("AI封面生成在重试后仍然失败。")
                return placeholder_url
            time.sleep(1)
    
    return placeholder_url


def _construct_multi_image_prompt(prompts: list[str], has_ref: bool = False) -> str:
    """构建多图生成的组合提示词"""
    combined_prompt = ""

    if has_ref:
        combined_prompt += "根据参考图的画面风格和中心人物：\n"

    count = len(prompts)
    combined_prompt += f"一共生成{count}张图。"
    for i, p in enumerate(prompts):
        combined_prompt += f"第{i+1}张图：{p} "
    return combined_prompt


def _generate_multi_images_by_ref(prompts: list[str], ref_images: list[str], size: str ="2560x1440") -> list[str]:
    """内部函数：根据参考图生成剩余图片"""
    if not prompts:
        return []
        
    combined_prompt = _construct_multi_image_prompt(prompts,True)
    
    if not ref_images:
        logger.warning("没有参考图，无法进行参考生成")
        return []

    if len(ref_images) == 1:
        ref_image_url = ref_images[0]
    else:
        ref_image_url = ref_images[-3:]

    max_retries = 1
    for attempt in range(max_retries + 1):
        try:
            response = image_client.images.generate(
                model=settings.AI_MODEL_FOR_IMAGE,
                prompt=combined_prompt,
                image=ref_image_url, 
                size=size,
                sequential_image_generation="auto",
                sequential_image_generation_options=SequentialImageGenerationOptions(max_images=15)
            )
            
            data = response.data or []
            results = []
            for item in data:
                if item.url:
                    saved_url = _save_image_from_url(item.url)
                    if saved_url:
                        results.append(saved_url)
            
            if results:
                return results
                
        except Exception as e:
            logger.error(f"参考图生成失败 (尝试 {attempt + 1}/{max_retries + 1}): {e}")
            if attempt >= max_retries:
                return []
            time.sleep(1)
            
    return []

def generate_multi_images(prompts: list[str], size: str ="2560x1440") -> list[str]:
    """调用AI生成多张图片，返回URL列表"""
    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/scene.jpg"
    
    target_count = len(prompts)
    if target_count == 0:
        return []

    combined_prompt = _construct_multi_image_prompt(prompts)
    results: list[str] = []
    
    max_retries = 1
    
    # 尝试直接生成所有图片
    for attempt in range(max_retries + 1):
        try:
            response = image_client.images.generate(
                model=settings.AI_MODEL_FOR_IMAGE,
                prompt=combined_prompt,
                size=size,
                sequential_image_generation="auto",
                sequential_image_generation_options=SequentialImageGenerationOptions(max_images=15)
            )
            data = response.data or []
            
            # 保存生成的图片
            for item in data:
                if item.url:
                    saved_url = _save_image_from_url(item.url)
                    if saved_url:
                        results.append(saved_url)
            
            # 如果生成了至少一张图，跳出重试循环
            if results:
                break
                
        except Exception as e:
            logger.error(f"AI生成背景图片组出错 (尝试 {attempt + 1}/{max_retries + 1}): {e}")
            if attempt >= max_retries and not results:
                # 如果重试后仍未生成任何图片，返回全占位符
                return [placeholder_url] * target_count
            time.sleep(1)

    # 检查数量是否足够，不足则使用参考图生成补全
    if len(results) < target_count and results:
        missing_count = target_count - len(results)
        logger.info(f"首轮生成图片不足，缺少 {missing_count} 张，尝试参考图生成补全")
        
        # 获取剩余未生成图片的描述
        remaining_prompts = prompts[len(results):]
        
        # 调用参考图生成
        supplementary_images = _generate_multi_images_by_ref(remaining_prompts, results, size)
        results.extend(supplementary_images)

    # 最终补足占位图
    while len(results) < target_count:
        results.append(placeholder_url)

    return results[:target_count]
