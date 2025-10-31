import os
import json
import random
import logging
import mimetypes
import uuid
import requests
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from volcenginesdkarkruntime import Ark
from volcenginesdkarkruntime.types.images.images import SequentialImageGenerationOptions
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from stories.models import Story, StoryChapter
from gameworks.models import Gamework

logger = logging.getLogger('django')

class Choice(BaseModel):
    """选项及属性值变化"""
    text: str
    attributesDelta: Optional[Dict[str, int]]
    statusesDelta: Optional[Dict[str,Union[str, bool, int]]]
    subsequentDialogues: List[str]

class DialogueItem(BaseModel):
    """旁白，或旁白加选项"""
    narration: str
    playerChoices: Optional[List[Choice]]

class Scene(BaseModel):
    """场景，游戏中的一个画面单元"""
    backgroundImage: str
    dialogues: List[DialogueItem]  

class ChapterContent(BaseModel):
    """章节内容，即一组场景的集合"""
    title: str
    scenes: List[Scene]

class GameworkDetails(BaseModel):
    title: str = Field(description="生成的作品标题")
    description: str = Field(description="生成的作品简介")
    initialAttributes: Dict[str, int] = Field(description="初始属性值")
    initialStatuses: Dict[str, Union[str, bool, int]] = Field(description="当前状态集合，键为状态名，值为状态值")

client = Ark(
    api_key="3f00ab95-6096-4639-a8b0-09c711a63d9c",
    base_url="https://ark.cn-beijing.volces.com/api/v3",
)

def _get_system_prompt(gamework: Gamework) -> str:
    """根据游戏标签和总章节数返回SystemPrompt"""
    tags = ', '.join([tag.name for tag in gamework.tags.all()]) if hasattr(gamework, 'tags') else ""
    total_chapters = gamework.story.total_chapters
    return f"""
# 任务
你是一位顶级的文字冒险游戏设计师。共需要为用户生成{total_chapters}章的剧情。
在剧情结构上，定义主角每一个地点切换为一个"场景(Scene)"，每章可以包含一个或多个场景(Scene)，每个场景包含若干对白和选项。
你需要首先对出现的场景画面(backendgroundImage)进行简单描述。

# 游戏作品信息
- 标题: {gamework.title}
- 简介: {gamework.description}
- 标签: {tags}
- 主角初始属性：{gamework.story.initial_attributes}
- 主角初始状态：{gamework.story.initial_statuses}

# 生成要求
- 创建有深度、引人入胜的剧情。确保每一个Scene的剧情长度尽量长，每一章在3000字左右。
- 加入场景描写，增强沉浸感。
- 简介仅仅是游戏剧情的一个小的缩影，可以适当深入挖掘和展开。请提前规划好剧情大纲。
- 每个选项可以导向不同的结果，但这些结果无关剧情主线走向，仅会在几句话的上下文范围内影响剧情，不同选项最终都要收敛到主线剧情。
- 玩家的选项可能会影响自身属性值(Attributes)，也可能会改变自身状态或获得新状态(Statuses)。

# 数据格式要求
请不要添加注释，直接生成有效的JSON对象。
"""

def _generate_chapter_with_ai(messages) :
    """使用豆包API生成一个章节"""
    try:
        completion = client.beta.chat.completions.parse(
            model="doubao-seed-1-6-250615",  
            messages=messages,
            response_format=ChapterContent,
            extra_body={
                "thinking": {
                "type": "disabled" # 不使用深度思考能力
                }
            }
        )
        chapter = completion.choices[0].message.parsed
        return chapter
        
    except Exception as e:
        logger.error("AI生成剧情出错：%s", e)

def _generate_backgroundimages_with_ai(img_descriptions: List[str]) -> List[str]:
    """使用豆包API生成一组连贯的背景图片,返回URL(media/gamework_scenes/xxx.jpg)列表"""

    images_count = len(img_descriptions)
    if images_count == 0:
        return []

    placeholder_url = f"{settings.MEDIA_URL}placeholders/scene.jpg"
    results: List[str] = []

    prompt = f"""
生成一组共{images_count}张连贯插画，核心分别为{'； '.join(img_descriptions)}
要求：按顺序生成，根据场景描述适度发挥，符合主题风格，统一风格，高精度，真实。2730x1535
"""
    try:
        response = client.images.generate(
            model="doubao-seedream-4-0-250828",
            prompt=prompt,
            size="2730x1535",
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
            results.append(f"{settings.MEDIA_URL}{filename}")
        except Exception as e:  
            logger.error("第 %s 张背景图生成或保存失败: %s", idx + 1, e)

    # 补足占位图
    while len(results) < images_count:
        results.append(placeholder_url)

    return results

def _generate_gamework_details_with_ai(tags: List[str], idea: str) -> GameworkDetails:
    """使用AI生成游戏作品的文本详情"""
    prompt = f"""
# 任务
你是一位顶级的文字冒险游戏策划师。请根据用户提供的核心信息，为一款新的文字冒险游戏生成基础设定（中文）。

# 用户输入
- 核心标签: {', '.join(tags)}
- 核心构思: {idea if idea else '无特定构思，请根据标签自由发挥'}

# 生成要求
请生成以下内容：
1.  一个吸引人的游戏标题 (title)。
2.  一段引人入胜的游戏剧情简介 (description)，大约100-150字。
3.  一套初始玩家属性 (initialAttributes)，包含3-4个核心数值属性，并设定初始值。
4.  一套初始玩家状态等级 (initialStatuses)，定义主角的初始成长状态，如"修为": "炼气期一层"。

# 数据格式要求
请严格按照指定的JSON格式输出，不要添加任何额外解释。
"""
    
    try:
        completion = client.beta.chat.completions.parse(
            model="doubao-seed-1-6-250615",
            messages=[
                {"role": "system", "content": "你是一位专业的文字冒险游戏策划师，请按照用户要求的格式生成内容。"},
                {"role": "user", "content": prompt}
            ],
            response_format=GameworkDetails
        )
        logger.info("AI生成的作品描述：\n%s", completion.choices[0].message.parsed.model_dump_json(indent=2, ensure_ascii=False))
        return completion.choices[0].message.parsed
    except Exception as e:
        logger.error("AI生成作品详情出错：%s", e)

        # 返回一个备用的模拟数据
        return GameworkDetails(
            title="AI生成失败的模拟作品",
            description="这是一个在AI生成失败时返回的模拟作品简介。",
            initialAttributes={"灵石": 100, "声望": 0},
            initialStatuses={"修为": "炼气期三层","线人网络": True,"美食家称号": "新晋美食家"}
        )

def _generate_cover_image_with_ai(tags: List[str], idea: str) -> str:
    """使用AI生成封面图片,返回URL(media/gamework_covers/xxx.jpg)"""

    placeholder_url = f"{settings.MEDIA_URL}placeholders/cover.jpg"

    prompt = f"""
生成一部小说的封面
小说主题：{', '.join(tags)}
构思：{idea if idea else '无特定构思，请根据标签自由发挥'}
要求：高精度，真实，符合主题的风格，可根据构思适度发挥想象力，封面中不要出现文字，2730x1535
"""
    try:
        response = client.images.generate(
            model="doubao-seedream-4-0-250828",
            prompt=prompt,
            response_format="url",
            size="2730x1535",
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
        return f"{settings.MEDIA_URL}{filename}"
    
    except Exception as e:
        logger.error("AI生成封面图片出错: %s", e)
        return placeholder_url 

def _generate_chapter(gamework: Gamework, chapter_index: int):
    """生成指定章节的内容"""
    story, created = Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': 3}
    )

    chapters = story.chapters.all()
    messages = [{"role": "system", "content": _get_system_prompt(gamework)}]
    for chapter in chapters:
        messages.extend([
            {"role": "user", "content": f"现在请你生成第{chapter.chapter_index}章的内容"},
            {"role": "assistant", "content": json.dumps(chapter.content,ensure_ascii=False)}
        ])
    messages.append({"role": "user", "content": f"现在请你生成第{chapter_index}章的内容"})

    # logger.info("当前历史对话：\n%s", json.dumps(messages, indent=2, ensure_ascii=False))

    chapter_content = _generate_chapter_with_ai(messages)
    images_descriptions = [scene.backgroundImage for scene in getattr(chapter_content, "scenes", [])]
    generated_images_urls = _generate_backgroundimages_with_ai(images_descriptions)

    chapter_content_with_image = chapter_content.model_dump()
    placeholder_url = f"{settings.MEDIA_URL}placeholders/scene.jpg"
    for idx, scene in enumerate(chapter_content_with_image.get("scenes", [])):
        scene["backgroundImageUrl"] = generated_images_urls[idx] if idx < len(generated_images_urls) else placeholder_url

    logger.info("AI生成的章节内容（含图片URL）：\n%s", json.dumps(chapter_content_with_image, indent=2, ensure_ascii=False))

    chapter, created = StoryChapter.objects.update_or_create(
        story=story,
        chapter_index=chapter_index,
        defaults={
            'content': chapter_content_with_image
        }
    )

    # 检查是否所有章节都已生成，如是则标记Story为完成
    if story.generated_chapters_count == story.total_chapters:
        story.is_complete = True
        story.save()
        
    return chapter

def _resolve_total_chapters(length: str) -> int:
    """根据篇幅映射章节数量"""
    ranges = {
        "short": (3, 5),
        "medium": (6, 10),
        "long": (11, 15),
    }
    min_chapters, max_chapters = ranges.get((length or "").lower().strip(), (6, 10))
    return random.randint(min_chapters, max_chapters)

def create_gamework(user, tags: List[str], idea: str, length: str) -> dict:
    """
    创建新游戏作品的完整流程。
    1. 调用AI生成文本详情。
    2. 调用AI生成封面图片。
    3. 创建并保存Gamework实例。
    4. 创建关联的Story实例。
    5. 关联标签Tags。
    6. 返回生成的数据。
    """

    details = _generate_gamework_details_with_ai(tags, idea)

    cover_url = _generate_cover_image_with_ai(tags, idea)

    gamework = Gamework.objects.create(
        author=user,
        title=details.title,
        description=details.description,
        image_url=cover_url
    )

    total_chapters = _resolve_total_chapters(length)
    Story.objects.create(
        gamework=gamework,
        total_chapters=total_chapters,
        initial_attributes=details.initialAttributes,
        initial_statuses=details.initialStatuses
    )

    # 关联标签
    from tags.models import Tag

    tag_objects = []
    for tag_name in tags:
        tag, _ = Tag.objects.get_or_create(name=tag_name)
        tag_objects.append(tag)
    gamework.tags.set(tag_objects)

    # 返回生成的数据给前端
    return {
        "gameworkId": gamework.gamework_id,
        "title": details.title,
        "coverUrl": cover_url,
        "description": details.description,
        "initialAttributes": details.initialAttributes,
        "initialStatuses": details.initialStatuses
    }

def get_or_generate_chapter(gamework: Gamework, chapter_index: int) -> dict:
    """
    获取或生成指定章节的内容。
    如果章节已存在，直接从数据库返回;否则，调用AI生成。
    """
    story, created = Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': _resolve_total_chapters("")}
    )

    total_chapters = story.total_chapters

    try:
        chapter = StoryChapter.objects.get(story=story, chapter_index=chapter_index)
        return chapter.content
    except StoryChapter.DoesNotExist:
        pass

    if chapter_index > total_chapters:
        raise ValueError(f"请求的章节索引 {chapter_index} 超出总章节数 {total_chapters}。")
    
    if chapter_index > 1:
        try:
            _ = StoryChapter.objects.get(story=story, chapter_index=chapter_index - 1)
        except StoryChapter.DoesNotExist:
            raise ValueError(f"上一章章节索引 {chapter_index - 1} 尚未生成，无法生成当前章节。")

    generated_chapter = _generate_chapter(gamework, chapter_index)
    return generated_chapter.content

def get_or_generate_report(gamework: Gamework) -> dict:
    """
    获取或生成游戏总结报告。
    如果报告已存在，直接从数据库返回;否则，调用AI生成。
    """
    from .models import GameReport

    try:
        report = GameReport.objects.get(gamework=gamework)
        return report.content
    except GameReport.DoesNotExist:
        pass

    return report.content

def build_settlement_variants(attributes: Dict[str, int], statuses: Dict[str, Any]) -> dict:
    """
    构造结算报告候选 variants，并返回 debug 检查信息。
    前端将根据自身策略选择最终展示的 variant。
    """
    variants = [
        {
            "id": "v_royalist_mastermind",
            "title": "深宫谋士",
            "summary": "善于谋略与人际运作",
            "minAttributes": {"心计": 40},
            "requiredStatuses": ["线人网络"],
            "report": {
                "title": "深宫谋士",
                "content": "你行事缜密，擅长通过蛛丝马迹改变局势...",
                "traits": ["善于谋划", "察言观色"],
                "scores": {"智谋": 92}
            }
        },
        {
            "id": "v_merchant_entrepreneur",
            "title": "商海奇才",
            "summary": "擅长经商与资源运作",
            "minAttributes": {"灵石": 100, "商业头脑": 15},
            "requiredStatuses": [],
            "report": {
                "title": "商海奇才",
                "content": "你在利益面前如鱼得水...",
                "traits": ["经商天赋"],
                "scores": {"财富": 88}
            }
        },
        {
            "id": "v_default",
            "title": "平凡之路",
            "summary": "通用回退报告",
            "report": {"title": "平凡之路", "content": "你的结局平静而踏实..."}
        }
    ]

    checked = []
    for v in variants:
        reasons = []
        ok = True

        # 校验 minAttributes
        min_attr = v.get("minAttributes") or {}
        for k, req in min_attr.items():
            val = attributes.get(k, None)
            if val is None or val < req:
                ok = False
                reasons.append(f"{k}({val}) < {req}")

        # 校验 requiredStatuses
        req_stats = v.get("requiredStatuses") or []
        for s in req_stats:
            val = statuses.get(s, None)
            if not val:
                ok = False
                reasons.append(f"缺少状态 {s}")

        checked.append({"id": v["id"], "matched": ok, "reason": "; ".join(reasons) if reasons else ""})

    return {
        "success": True,
        "reports": variants,
        "debug": {"checked": checked}
    }