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
logger = logging.getLogger('django')

text_client = openai.OpenAI(
    api_key=settings.AI_API_KEY_FOR_TEXT, 
    base_url=settings.AI_BASE_URL_FOR_TEXT,
)

image_client = Ark(
    api_key=settings.AI_API_KEY_FOR_IMAGE,
    base_url=settings.AI_BASE_URL_FOR_IMAGE,
)

def invoke(prompt: str) -> str:
    """调用文字API
    """
    response = text_client.chat.completions.create(
    model=settings.AI_MODEL_FOR_TEXT,  
    messages=[
        {
            "role": "user",
            "content": prompt        
        }
    ]
    )
    return response.choices[0].message.content

def generate_single_image(prompt: str, size: str ="1920x1080") -> str:
    """调用AI生成图片，返回可访问的URL
    """
    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/cover.jpg"

    try:
        response = image_client.images.generate(
            model=settings.AI_MODEL_FOR_IMAGE,
            prompt=prompt,
            response_format="url",
            size=size,
            watermark=True
        )

        if not response.data:
            logger.error("AI生成封面图片时返回空数据")
            return placeholder_url
        
        source_url = response.data[0].url
        file_resp = requests.get(source_url, timeout=30)
        file_resp.raise_for_status()

        guessed_ext = mimetypes.guess_extension(file_resp.headers.get("Content-Type", ""), strict=False) or ".jpg"
        filename = f"gamework_covers/{uuid.uuid4().hex}{guessed_ext}"
        default_storage.save(filename, ContentFile(file_resp.content))

        logger.info(f"AI封面生成成功: {filename}")
        return f"{base_url}{settings.MEDIA_URL}{filename}"
    
    except Exception as e:
        logger.error("AI生成封面图片出错: %s", e)
        return placeholder_url     


def generate_multi_images(prompt: str, images_count: int, size: str ="1920x1080") -> list[str]:
    """调用AI生成多张图片，返回URL列表
    """
    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/scene.jpg"
    results: list[str] = []

    try:
        response = image_client.images.generate(
            model=settings.AI_MODEL_FOR_IMAGE,
            prompt=prompt,
            size=size,
            sequential_image_generation="auto",
            sequential_image_generation_options=SequentialImageGenerationOptions(max_images=images_count),
            response_format="url",
            watermark=True,
        )
        data = response.data or []
    except Exception as e:
        logger.error("AI生成背景图片组出错: %s", e)
        return [placeholder_url] * images_count

    for idx in range(images_count):
        try:
            if idx >= len(data) or not data[idx].url:
                raise ValueError("缺失图片URL")
            source_url = data[idx].url
            file_resp = requests.get(source_url, timeout=30)
            file_resp.raise_for_status()

            guessed_ext = mimetypes.guess_extension(file_resp.headers.get("Content-Type", ""), strict=False) or ".jpg"
            filename = f"gamework_scenes/{uuid.uuid4().hex}{guessed_ext}"
            default_storage.save(filename, ContentFile(file_resp.content))
            results.append(f"{base_url}{settings.MEDIA_URL}{filename}")
        except Exception as e:  
            logger.error("第 %s 张背景图生成或保存失败: %s", idx + 1, e)

    # 补足占位图
    while len(results) < images_count:
        results.append(placeholder_url)

    return results