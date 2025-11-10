import os
import json
import random
import logging
import mimetypes
import uuid
import requests
import threading
from copy import deepcopy
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from volcenginesdkarkruntime import Ark
from volcenginesdkarkruntime.types.images.images import SequentialImageGenerationOptions
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from stories.models import Story, StoryChapter, StoryScene
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

class ChapterOutline(BaseModel):
    chapterIndex: int
    outline: str

class GameworkDetails(BaseModel):
    title: str = Field(description="生成的作品标题")
    description: str = Field(description="生成的作品简介")
    initialAttributes: Dict[str, int] = Field(description="初始属性值")
    initialStatuses: Dict[str, Union[str, bool, int]] = Field(description="当前状态集合，键为状态名，值为状态值")
    chapterOutlines: List[ChapterOutline] = Field(description="所有章节的大纲")

client = Ark(
    api_key="16797a69-5b15-4795-aaac-aaced367197d",
    api_key=settings.AI_API_KEY,
    base_url="https://ark.cn-beijing.volces.com/api/v3",
)

def _get_system_prompt(gamework: Gamework) -> str:
    """根据游戏标签和总章节数返回SystemPrompt"""
    tags = ', '.join([tag.name for tag in gamework.tags.all()]) if hasattr(gamework, 'tags') else ""
    total_chapters = gamework.story.total_chapters
    outlines = gamework.story.outlines

    outline_text = ""
    if outlines:
        outline_text += "\n# 故事大纲\n"
        for item in outlines:
            outline_text += f"- 第{item['chapterIndex']}章: {item['outline']}\n"

    return f"""
# 任务
你是一位顶级的文字冒险游戏设计师。共需要为用户生成{total_chapters}章的剧情。
在剧情结构上，定义主角每一个地点切换为一个"场景(Scene)"，每章至多包含3个场景(Scene)，每个场景包含若干对白和选项，每个场景至多包含一项playerChoices。
你需要首先对出现的场景画面(backgroundImage)进行简单描述。

# 游戏作品信息
- 标题: {gamework.title}
- 简介: {gamework.description}
- 标签: {tags}
- 主角初始属性：{gamework.story.initial_attributes}
- 主角初始状态：{gamework.story.initial_statuses}
{outline_text}
# 生成要求
- 保证剧情有始有终，结构合理，逻辑通顺，情节跌宕起伏，引人入胜，可以参考热门网文创作手法。
- 确保每一个Scene的剧情长度尽量长，每一章在3000字左右。
- 加入场景描写，增强沉浸感。
- 简介仅仅是游戏剧情的一个小的缩影，可以适当深入挖掘和展开。请谨遵剧情大纲。
- 每个选项可以导向不同的结果，但这些结果无关剧情主线走向，仅会在几句话的上下文范围内影响剧情，不同选项最终都要收敛到主线剧情。
- 玩家的选项可能会影响自身属性值(Attributes)，也可能会改变自身状态或获得新状态(Statuses)。

# 数据格式要求
请不要添加注释，直接生成有效的JSON对象。
"""

def _generate_chapter_with_ai(messages) :
    """使用豆包API生成一个章节"""
    try:
        completion = client.beta.chat.completions.parse(
            model=settings.AI_MODEL_FOR_TEXT,
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
    """使用豆包API生成一组连贯的背景图片,返回绝对URL列表"""

    images_count = len(img_descriptions)
    if images_count == 0:
        return []

    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/scene.jpg"
    results: List[str] = []

    prompt = f"""
生成一组共{images_count}张连贯插画，核心分别为{'； '.join(img_descriptions)}
要求：按顺序生成，根据场景描述适度发挥，符合主题风格，统一风格，高精度，真实。2730x1535
"""
    try:
        response = client.images.generate(
            model=settings.AI_MODEL_FOR_IMAGE,
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
            results.append(f"{base_url}{settings.MEDIA_URL}{filename}")
        except Exception as e:  
            logger.error("第 %s 张背景图生成或保存失败: %s", idx + 1, e)

    # 补足占位图
    while len(results) < images_count:
        results.append(placeholder_url)

    return results

def _generate_gamework_details_with_ai(tags: List[str], idea: str, total_chapters: int) -> GameworkDetails:
    """使用AI生成游戏作品的文本详情及大纲"""
    prompt = f"""
# 任务
你是一位顶级的文字冒险游戏策划师。请根据用户提供的核心信息，为一款新的文字冒险游戏生成基础设定（中文）。

# 用户输入
- 核心标签: {', '.join(tags)}
- 核心构思: {idea if idea else '无特定构思，请根据标签自由发挥'}
- 总章节数: {total_chapters}

# 生成要求
请生成以下内容：
1.  一个吸引人的游戏标题 (title)。
2.  一段引人入胜的游戏剧情简介 (description)，大约100-150字。
3.  一套初始玩家属性 (initialAttributes)，包含3-4个核心数值属性，并设定初始值。
4.  一套初始玩家状态等级 (initialStatuses)，定义主角的初始成长状态，如"修为": "炼气期一层"。
5.  一个包含 {total_chapters} 章的章节大纲 (chapterOutlines)，每章大纲应简洁明了，概括核心剧情。
6.  确保剧情有始有终，结构合理完善，情节跌宕起伏，引人入胜，可以参考热门网文创作手法。

# 数据格式要求
请严格按照指定的JSON格式输出，不要添加任何额外解释。
"""
    
    try:
        completion = client.beta.chat.completions.parse(
            model=settings.AI_MODEL_FOR_TEXT,
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
            initialStatuses={"修为": "炼气期三层","线人网络": True,"美食家称号": "新晋美食家"},
            chapterOutlines=[{"chapterIndex": i, "outline": f"AI生成第 {i} 章大纲失败"} for i in range(1, total_chapters + 1)]
        )

def _generate_cover_image_with_ai(tags: List[str], idea: str) -> str:
    """使用AI生成封面图片,返回绝对URL"""

    base_url = settings.SITE_DOMAIN
    placeholder_url = f"{base_url}{settings.MEDIA_URL}placeholders/cover.jpg"

    prompt = f"""
生成一部小说的封面
小说主题：{', '.join(tags)}
构思：{idea if idea else '无特定构思，请根据标签自由发挥'}
要求：高精度，真实，符合主题的风格，可根据构思适度发挥想象力，封面中不要出现文字，2730x1535
"""
    try:
        response = client.images.generate(
            model=settings.AI_MODEL_FOR_IMAGE,
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
        return f"{base_url}{settings.MEDIA_URL}{filename}"
    
    except Exception as e:
        logger.error("AI生成封面图片出错: %s", e)
        return placeholder_url 

def _strip_choice_ids(dialogues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sanitized = []
    for item in dialogues or []:
        dialogue_copy = {"narration": item.get("narration")}
        choices = item.get("playerChoices")
        if choices:
            sanitized_choices = []
            for choice in choices:
                choice_copy = {k: v for k, v in choice.items() if k != "choiceId"}
                sanitized_choices.append(choice_copy)
            dialogue_copy["playerChoices"] = sanitized_choices
        else:
            dialogue_copy["playerChoices"] = None
        sanitized.append(dialogue_copy)
    return sanitized

def _serialize_chapter_for_ai(chapter: StoryChapter) -> Dict[str, Any]:
    return {
        "title": chapter.title,
        "scenes": [
            {
                "backgroundImage": scene.background_image,
                "dialogues": _strip_choice_ids(scene.dialogues),
            }
            for scene in chapter.scenes.order_by("scene_index")
        ]
    }

def _build_chapter_response(chapter: StoryChapter) -> Dict[str, Any]:
    payload = {
        "chapterIndex": chapter.chapter_index,
        "title": chapter.title,
        "scenes": []
    }
    for scene in chapter.scenes.order_by("scene_index"):
        # 确保返回的backgroundImage是完整的URL
        bg_image = scene.background_image_url
        if bg_image and not bg_image.startswith(('http://', 'https://')):
             bg_image = f"{settings.SITE_DOMAIN}{bg_image}"

        payload["scenes"].append({
            "id": scene.scene_index,
            "backgroundImage": bg_image,
            "dialogues": deepcopy(scene.dialogues) if scene.dialogues else []
        })
    return payload

def _generate_chapter(gamework: Gamework, chapter_index: int, user_prompt: str = ""):

    story = gamework.story
    chapters = story.chapters.prefetch_related('scenes').order_by('chapter_index')
    messages = [{"role": "system", "content": _get_system_prompt(gamework)}]
    
    # 仅添加当前生成章节之前的历史章节作为上下文
    for chapter in chapters:
        if chapter.chapter_index < chapter_index:
            messages.extend([
                {"role": "user", "content": f"现在请你生成第{chapter.chapter_index}章的内容"},
                {"role": "assistant", "content": json.dumps(_serialize_chapter_for_ai(chapter), ensure_ascii=False)}
            ])
    
    messages.append({"role": "user", "content": f"现在请你生成第{chapter_index}章的内容，请注意谨遵剧情大纲。本章特别要求：{user_prompt}"})

    chapter_content = _generate_chapter_with_ai(messages)
    if not chapter_content:
        raise ValueError("AI生成章节失败")

    chapter_dict = chapter_content.model_dump()
    images_descriptions = [scene.get("backgroundImage", "") for scene in chapter_dict.get("scenes", [])]
    generated_images_urls = _generate_backgroundimages_with_ai(images_descriptions)

    chapter_title = chapter_dict.get("title") or f"第{chapter_index}章"
    chapter_obj, _ = StoryChapter.objects.update_or_create(
        story=story,
        chapter_index=chapter_index,
        defaults={"title": chapter_title}
    )
    chapter_obj.scenes.all().delete()

    placeholder_url = f"{settings.MEDIA_URL}placeholders/scene.jpg"
    for idx, scene_data in enumerate(chapter_dict.get("scenes", [])):
        dialogues_with_ids = []
        for dialogue in scene_data.get("dialogues", []):
            dialogue_copy = deepcopy(dialogue)
            choices = dialogue_copy.get("playerChoices") or []
            for choice_idx, choice in enumerate(choices, start=1):
                choice["choiceId"] = choice_idx
            dialogues_with_ids.append(dialogue_copy)

        StoryScene.objects.create(
            chapter=chapter_obj,
            scene_index=idx + 1,
            background_image=scene_data.get("backgroundImage", ""),
            background_image_url=generated_images_urls[idx] if idx < len(generated_images_urls) else placeholder_url,
            dialogues=dialogues_with_ids
        )

    chapter_obj.refresh_from_db()
    response_payload = _build_chapter_response(chapter_obj)
    logger.info("AI生成的章节内容（含ID）：\n%s", json.dumps(response_payload, indent=2, ensure_ascii=False))

    if story.generated_chapters_count == story.total_chapters:
        story.is_complete = True
        story.save()

    return response_payload

def _resolve_total_chapters(length: str) -> int:
    """根据篇幅映射章节数量"""
    ranges = {
        "short": (3, 5),
        "medium": (6, 10),
        "long": (11, 15),
    }
    min_chapters, max_chapters = ranges.get((length or "").lower().strip(), (6, 10))
    return random.randint(min_chapters, max_chapters)

def _generate_all_chapters_async(gamework: Gamework):
    """后台线程中连续生成所有章节"""
    def worker():
        try:
            story = Story.objects.get(gamework=gamework)
            story.is_generating = True
            story.save()

            for chapter_index in range(1, story.total_chapters + 1):
                story.current_generating_chapter = chapter_index
                story.save()
                
                logger.info(f"开始生成作品ID {gamework.id} 第 {chapter_index} 章")
                _generate_chapter(gamework, chapter_index)
                logger.info(f"完成生成作品ID {gamework.id} 第 {chapter_index} 章")

            story.is_generating = False
            story.is_complete = True
            story.current_generating_chapter = 0
            story.save()
            logger.info(f"作品 {gamework.id} 所有章节生成完成")
        except Exception as e:
            logger.error(f"生成作品 {gamework.id} 章节时发生错误: {e}")
            try:
                story = Story.objects.get(gamework=gamework)
                story.is_generating = False
                story.save()
            except:
                pass

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def _update_gamework_after_generation(gamework_id: int, details: Optional[GameworkDetails] = None, cover_url: Optional[str] = None):
    """在后台任务完成后，更新Gamework和Story实例。"""
    try:
        gamework = Gamework.objects.select_related('story').get(pk=gamework_id)
        story = gamework.story
        
        if details:
            gamework.title = details.title
            gamework.description = details.description
            story.initial_attributes = details.initialAttributes
            story.initial_statuses = details.initialStatuses
            
            outlines_data = details.model_dump().get("chapterOutlines", [])
            corrected_outlines = []
            for i in range(story.total_chapters):
                if i < len(outlines_data) and outlines_data[i].get('outline'):
                    outline_text = outlines_data[i]['outline']
                else:
                    outline_text = f"第 {i + 1} 章大纲待补充"
                corrected_outlines.append({"chapterIndex": i + 1, "outline": outline_text})
            story.outlines = corrected_outlines

        if cover_url:
            gamework.image_url = cover_url

        # 检查是否所有部分都已完成
        if (details and gamework.image_url and not gamework.image_url.endswith('placeholders/cover.jpg')) or \
           (cover_url and gamework.title and gamework.title != "作品生成中..."):
            story.initial_generation_complete = True

        gamework.save()
        story.save()

        # 如果是读者模式，在初始信息生成后，开始生成所有章节
        if story.initial_generation_complete and not story.ai_callable:
            _generate_all_chapters_async(gamework)

    except Gamework.DoesNotExist:
        logger.error(f"更新作品详情时未找到 Gamework ID: {gamework_id}")
    except Exception as e:
        logger.error(f"更新作品详情时发生错误 (Gamework ID: {gamework_id}): {e}", exc_info=True)

def create_gamework(user, tags: List[str], idea: str, length: str, modifiable: bool = False) -> dict:
    """
    启动新游戏作品的创建流程，并立即返回gameworkId。
    """
    total_chapters = _resolve_total_chapters(length)

    # 1. 创建占位实例
    gamework = Gamework.objects.create(
        author=user,
        title="作品生成中...",
        description="AI正在努力创作中，请稍候...",
        image_url=f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}placeholders/cover.jpg"
    )
    Story.objects.create(
        gamework=gamework,
        total_chapters=total_chapters,
        initial_attributes={},
        initial_statuses={},
        ai_callable=modifiable,
        outlines=[]
    )

    # 2. 关联标签
    from tags.models import Tag
    tag_objects = [Tag.objects.get_or_create(name=tag_name)[0] for tag_name in tags]
    gamework.tags.set(tag_objects)

    # 3. 并行启动后台生成任务
    def details_worker():
        details = _generate_gamework_details_with_ai(tags, idea, total_chapters)
        _update_gamework_after_generation(gamework.id, details=details)

    def cover_worker():
        cover_url = _generate_cover_image_with_ai(tags, idea)
        _update_gamework_after_generation(gamework.id, cover_url=cover_url)

    threading.Thread(target=details_worker, daemon=True).start()
    threading.Thread(target=cover_worker, daemon=True).start()

    # 4. 立即返回
    return {"gameworkId": gamework.id}

def start_single_chapter_generation(gamework: Gamework, chapter_index: int, outlines: List[Dict], user_prompt: str):
    """为创作者模式启动单章节的异步生成"""
    story = gamework.story
    if not story.ai_callable:
        raise PermissionError("此作品不允许调用AI生成。")

    # 更新大纲
    story.outlines = outlines
    story.save()

    # 重置章节状态，准备重新生成
    StoryChapter.objects.filter(story=story, chapter_index=chapter_index).delete()
    story.is_generating = True
    story.is_complete = False
    story.current_generating_chapter = chapter_index
    story.save()

    def worker():
        try:
            logger.info(f"创作者模式：开始生成作品ID {gamework.id} 第 {chapter_index} 章")
            _generate_chapter(gamework, chapter_index, user_prompt)
            logger.info(f"创作者模式：完成生成作品ID {gamework.id} 第 {chapter_index} 章")
            
            story.refresh_from_db()
            story.is_generating = False
            story.current_generating_chapter = 0
            if story.generated_chapters_count == story.total_chapters:
                story.is_complete = True
            story.save()

        except Exception as e:
            logger.error(f"生成作品ID {gamework.id} 章节时发生错误: {e}")
            try:
                story.refresh_from_db()
                story.is_generating = False
                story.save()
            except:
                pass

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def get_chapter_status(gamework: Gamework, chapter_index: int) -> dict:
    """
    查询章节生成状态或返回已生成内容。
    返回格式:
    - {"status": "generating", "progress": {...}} - 正在生成中
    - {"status": "ready", "chapter": {...}} - 已生成完毕
    - {"status": "pending"} - 尚未开始生成
    """

    story, _ = Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': _resolve_total_chapters("")}
    )

    if chapter_index < 1 or chapter_index > story.total_chapters:
        return {"status": "error", "message": f"章节索引 {chapter_index} 超出范围"}

    # 检查章节是否已生成
    try:
        chapter = StoryChapter.objects.prefetch_related('scenes').get(
            story=story, 
            chapter_index=chapter_index
        )
        return {
            "status": "ready",
            "chapter": _build_chapter_response(chapter)
        }
    except StoryChapter.DoesNotExist:
        pass

    # 章节未生成，检查生成状态
    if story.is_generating:
        return {
            "status": "generating",
            "progress": {
                "currentChapter": story.current_generating_chapter,
                "totalChapters": story.total_chapters
            }
        }
    
    if story.is_complete:
        return {"status": "error", "message": "章节应已生成但未找到"}
    
    return {"status": "pending", "message": "章节尚未开始生成"}

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

def resolve_scene_cover_url(gamework: Gamework, chapter_index: int, scene_index: int) -> Optional[str]:
    """根据章节与场景索引解析背景图URL"""
    url = StoryScene.objects.filter(
        chapter__story__gamework=gamework,
        chapter__chapter_index=chapter_index,
        scene_index=scene_index
    ).values_list('background_image_url', flat=True).first()

    if url and not url.startswith(('http://', 'https://')):
        return f"{settings.SITE_DOMAIN}{url}"
    return url