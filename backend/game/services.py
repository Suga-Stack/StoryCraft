import random
import logging
import threading
import time
from django.db import transaction
from typing import List, Dict, Any, Optional
from django.db import close_old_connections
from django.conf import settings
from stories.models import Story, StoryChapter, StoryScene, StoryEnding
from gameworks.models import Gamework
from .utils import parse_raw_chapter
from .game_generator.architecture import generate_core_seed, generate_architecture
from .game_generator.chapter import generate_chapter_content, generate_ending_content
from .game_generator.images import generate_cover_image, generate_scene_images
logger = logging.getLogger('django')

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
            "dialogues": scene.dialogues if scene.dialogues else []
        })
    return payload


def _generate_chapter(gamework_id: int, chapter_index: int, user_prompt: str = ""):
    story = Story.objects.get(gamework_id=gamework_id)
    if not story.initial_generation_complete:
        raise ValueError("故事初始信息未完成，无法生成章节。")

    chapters = story.chapters.prefetch_related('scenes').order_by('chapter_index')
    prev_raw = chapters.filter(chapter_index=chapter_index - 1).first().raw_content if chapter_index > 1 else None

    # 1. 生成章节内容（如果是最后一章，返回的是前半部分 + 结局摘要）
    raw_chapter_content, updated_global_summary, endings_summary = generate_chapter_content(
        chapter_index=chapter_index,
        total_chapters=story.total_chapters, 
        chapter_directory=story.chapter_directory,
        core_seed=story.core_seed,
        attribute_system=story.attribute_system,
        characters=story.characters,
        architecture=story.architecture,
        previous_chapter_content=prev_raw,
        global_summary=story.global_summary,
        user_prompt=user_prompt
    )
    
    update_fields = {
        "global_summary": updated_global_summary
    }
    if endings_summary:
        update_fields["endings_summary"] = endings_summary
        # 更新最后一章的大纲，追加结局摘要
        current_outlines = story.outlines
        if current_outlines and isinstance(current_outlines, list):
            for item in current_outlines:
                if item.get("chapterIndex") == chapter_index:
                    original_outline = item.get("outline", "")
                    endings_text = "\n\n【结局分支预览】\n"
                    for ending in endings_summary:
                        endings_text += f"- {ending.get('title')} (条件: {ending.get('condition')}):\n{ending.get('summary')}\n"
                    item["outline"] = original_outline + endings_text
                    break
            update_fields["outlines"] = current_outlines
    
    Story.objects.filter(pk=story.pk).update(**update_fields)
    story.refresh_from_db()

    # 2. 处理章节（或最后一章的前半部分）的图片和解析
    scene_ranges, scene_urls = generate_scene_images(raw_chapter_content)
    chapter_dict = parse_raw_chapter(raw_chapter_content, scene_ranges)
    chapter_title = chapter_dict["title"]

    chapter_obj, created = StoryChapter.objects.update_or_create(
        story=story,
        chapter_index=chapter_index,
        defaults={
            "title": chapter_title,
            "raw_content": raw_chapter_content,
            "parsed_content": chapter_dict,
            "status": StoryChapter.ChapterStatus.GENERATED
        }
    )
    if not created:
        chapter_obj.scenes.all().delete()

    # 场景与图片绑定到 StoryScene
    for scene in chapter_dict["scenes"]:
        idx = scene["id"] - 1
        img_url = scene_urls[idx] if idx < len(scene_urls) else f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}placeholders/scene.jpg"
        StoryScene.objects.create(
            chapter=chapter_obj,
            scene_index=scene["id"],
            background_image_url=img_url,
            dialogues=scene["dialogues"]
        )

    # 3. 如果是最后一章，且有结局摘要，开始异步生成完整结局
    if endings_summary:      
        _generate_endings_async(story.id, endings_summary, chapter_index)

    # 检查是否全部完成
    current_chapter_count = StoryChapter.objects.filter(story=story).count()
    if current_chapter_count >= story.total_chapters:
        Story.objects.filter(pk=story.pk).update(is_complete=True)

def _process_and_save_ending(story_id: int, ending_index: int, ending_data: dict):
    """独立线程处理单个结局的图片生成与保存"""
    close_old_connections()
    try:
        story = Story.objects.get(pk=story_id)
        # 生成图片
        scene_ranges, scene_urls = generate_scene_images(ending_data["raw_content"])
        # 解析内容
        parsed_ending = parse_raw_chapter(ending_data["raw_content"], scene_ranges)
        
        # 创建 StoryEnding
        ending_obj = StoryEnding.objects.create(
            story=story,
            ending_index=ending_index,
            title=ending_data["title"],
            condition=ending_data["condition"],
            raw_content=ending_data["raw_content"],
            parsed_content=parsed_ending
        )
        
        # 创建 StoryScene 关联到 Ending
        for scene in parsed_ending["scenes"]:
            idx = scene["id"] - 1
            img_url = scene_urls[idx] if idx < len(scene_urls) else f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}placeholders/scene.jpg"
            StoryScene.objects.create(
                ending=ending_obj, # 关联到 ending
                scene_index=scene["id"],
                background_image_url=img_url,
                dialogues=scene["dialogues"]
            )
        logger.info(f"故事 {story_id} 结局 {ending_index} 保存完成")
    except Exception as e:
        logger.error(f"保存结局 {ending_index} 失败: {e}", exc_info=True)

def _generate_endings_async(story_id: int, endings_summary: list, chapter_index: int):
    """后台生成所有结局详情"""
    def worker():
        close_old_connections()
        try:
            story = Story.objects.get(pk=story_id)
            logger.info(f"开始生成故事 {story_id} 的 {len(endings_summary)} 个结局")
            
            # 收集所有章节的 parsed_content 用于计算属性范围
            all_chapters = list(story.chapters.order_by('chapter_index'))
            parsed_chapters = [ch.parsed_content for ch in all_chapters]

            # 获取最后一章（前半部分）内容
            try:
                last_chapter = story.chapters.get(chapter_index=chapter_index)
                last_chapter_content = last_chapter.raw_content
            except StoryChapter.DoesNotExist:
                last_chapter_content = ""
                logger.warning(f"生成结局时未找到第 {chapter_index} 章内容")

            # 获取倒数第二章内容
            previous_chapter_content = ""
            if chapter_index > 1:
                try:
                    prev_chapter = story.chapters.get(chapter_index=chapter_index - 1)
                    previous_chapter_content = prev_chapter.raw_content
                except StoryChapter.DoesNotExist:
                    pass
            
            # 生成结局内容 (Generator)
            endings_generator = generate_ending_content(
                endings_summary=endings_summary,
                chapter_index=chapter_index,
                attribute_system=story.attribute_system,
                characters=story.characters,
                architecture=story.architecture,
                previous_chapter_content=previous_chapter_content,
                last_chapter_content=last_chapter_content,
                parsed_chapters=parsed_chapters,
                initial_attributes=story.initial_attributes,
                global_summary=story.global_summary
            )
            
            # 逐个获取生成的结局文本，并立即启动后台线程处理图片和保存
            for i, ending_data in enumerate(endings_generator, 1):
                t = threading.Thread(target=_process_and_save_ending, args=(story_id, i, ending_data))
                t.start()
            
            logger.info(f"故事 {story_id} 所有结局文本生成任务已分发")
            
        except Exception as e:
            logger.error(f"生成结局失败: {e}", exc_info=True)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def get_story_endings(gamework: Gamework) -> dict:
    """获取故事结局状态及内容"""
    story = gamework.story
    
    if not story.endings_summary:
        return {"status": "pending"}

    expected_count = len(story.endings_summary)
    current_endings = story.story_endings.all().order_by('ending_index')
    
    # 如果生成的结局数量少于预期，说明还在生成中
    if current_endings.count() < expected_count:
        return {"status": "generating"}
    
    # 组装返回数据
    endings_data = []
    for ending in current_endings:
        scenes_data = []
        for scene in ending.scenes.order_by("scene_index"):
             bg_image = scene.background_image_url
             if bg_image and not bg_image.startswith(('http://', 'https://')):
                 bg_image = f"{settings.SITE_DOMAIN}{bg_image}"
             
             scenes_data.append({
                 "id": scene.scene_index,
                 "backgroundImage": bg_image,
                 "dialogues": scene.dialogues if scene.dialogues else []
             })
        
        endings_data.append({
            "endingIndex": ending.ending_index,
            "title": ending.title,
            "condition": ending.condition,
            "scenes": scenes_data
        })
        
    return {
        "status": "ready",
        "endings": endings_data
    }

def _resolve_total_chapters(length: str) -> int:
    """根据篇幅映射章节数量"""
    ranges = {
        "short": (3, 5),
        "medium": (6, 10),
        "long": (11, 15),
    }
    min_chapters, max_chapters = ranges.get((length or "").lower().strip(), (6, 10))
    return random.randint(min_chapters, max_chapters)

def _generate_all_chapters_async(gamework_id: int):
    """后台线程中连续生成所有章节"""
    def worker():
        try:
            Story.objects.filter(gamework_id=gamework_id).update(is_generating=True)

            # 获取总章节数
            total_chapters = Story.objects.filter(gamework_id=gamework_id).values_list('total_chapters', flat=True).first()
            if not total_chapters:
                logger.error(f"作品 {gamework_id} 未找到总章节数")
                return

            for chapter_index in range(1, total_chapters + 1):
                Story.objects.filter(gamework_id=gamework_id).update(current_generating_chapter=chapter_index)
                
                logger.info(f"开始生成作品ID {gamework_id} 第 {chapter_index} 章")
                _generate_chapter(gamework_id, chapter_index) 
                logger.info(f"完成生成作品ID {gamework_id} 第 {chapter_index} 章")

            # 完成
            Story.objects.filter(gamework_id=gamework_id).update(
                is_generating=False,
                is_complete=True,
                current_generating_chapter=0
            )
            logger.info(f"作品 {gamework_id} 所有章节生成完成")
        except Exception as e:
            logger.error(f"生成作品 {gamework_id} 章节时发生错误: {e}")
            try:
                Story.objects.filter(gamework_id=gamework_id).update(is_generating=False)
            except:
                pass

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def _start_gamework_details_generation(gamework_id: int, tags: list[str], idea: str, total_chapters: int):
    """后台生成作品详情"""
    
    def wait_for_core_seed():
        """等待core_seed在数据库中就绪"""
        max_retries = 300  
        retry_interval = 1  
        
        for i in range(max_retries):
            close_old_connections()
            try:
                story = Story.objects.get(gamework_id=gamework_id)
                if story.core_seed and story.core_seed.strip():
                    return story.core_seed
            except Story.DoesNotExist:
                pass
            
            if i < max_retries - 1:
                time.sleep(retry_interval)
        
        raise TimeoutError("等待core_seed超时")
    
    def core_seed_worker():
        close_old_connections()
        core_seed_details = generate_core_seed(tags, idea, total_chapters)
        _update_gamework_after_generation(gamework_id, core_seed_details=core_seed_details)
    
    def architecture_details_worker():
        core_seed = wait_for_core_seed()
        close_old_connections()
        architecture_details = generate_architecture(core_seed, total_chapters)
        _update_gamework_after_generation(gamework_id, architecture_details=architecture_details)
    
    def cover_worker():
        core_seed = wait_for_core_seed()
        close_old_connections()
        cover_url = generate_cover_image(core_seed)
        _update_gamework_after_generation(gamework_id, cover_url=cover_url)
    
    threads = [
        threading.Thread(target=core_seed_worker),
        threading.Thread(target=architecture_details_worker),
        threading.Thread(target=cover_worker)
    ]
    
    for thread in threads:
        thread.start()
    
def _update_gamework_after_generation(
    gamework_id: int,
    core_seed_details: Optional[Dict] = None,
    architecture_details: Optional[Dict] = None, 
    cover_url: Optional[str] = None
):
    """在后台任务完成后，更新Gamework和Story实例。"""
    try:
        with transaction.atomic():
            gamework = Gamework.objects.select_for_update().select_related('story').get(pk=gamework_id)
            story = gamework.story
            
            if core_seed_details:
                gamework.title = core_seed_details["title"]
                gamework.description = core_seed_details["description"]
                story.core_seed = core_seed_details["core_seed"]
                
            if architecture_details:
                story.initial_attributes = architecture_details["initial_attributes"]
                story.outlines = architecture_details["outlines"]
                story.attribute_system = architecture_details["raw"]["attribute_system"]
                story.characters = architecture_details["raw"]["characters"]
                story.architecture = architecture_details["raw"]["architecture"]
                story.chapter_directory = architecture_details["raw"]["chapter_directory"]
            
            if cover_url:
                gamework.image_url = cover_url

            gamework.save()
            story.save()
            story.update_generation_status()

            # 如果是读者模式，在初始信息生成后，开始生成所有章节
            if story.initial_generation_complete and not story.ai_callable:
                transaction.on_commit(lambda: _generate_all_chapters_async(gamework.id))
    except Exception as e:
        logger.error(f"作品详情更新失败：\n{e}")

def create_gamework(user, tags: List[str], idea: str, length: str, modifiable: bool = False) -> dict:
    """
    启动新游戏作品的创建流程，并立即返回gameworkId。
    """
    total_chapters = _resolve_total_chapters(length)

    # 1. 创建占位实例
    gamework = Gamework.objects.create(author=user)
    Story.objects.create(
        gamework=gamework,
        total_chapters=total_chapters,
        ai_callable=modifiable,
    )

    # 2. 关联标签
    from tags.models import Tag
    tag_objects = [Tag.objects.get_or_create(name=tag_name)[0] for tag_name in tags]
    gamework.tags.set(tag_objects)

    # 3. 启动后台生成任务
    _start_gamework_details_generation(gamework.id, tags, idea, total_chapters)

    # 4. 立即返回
    return {"gameworkId": gamework.id}

def start_single_chapter_generation(gamework: Gamework, chapter_index: int, outlines: List[Dict], user_prompt: str):
    """为创作者模式启动单章节的异步生成"""
    story = gamework.story
    if not story.ai_callable:
        raise PermissionError("此作品不允许调用AI生成。")

    # 检查是否已有章节正在生成
    if story.is_generating:
        raise PermissionError("已有章节正在生成中，请稍候。")

    # 检查前一章是否已保存
    if chapter_index > 1:
        try:
            prev_chapter = StoryChapter.objects.get(story=story, chapter_index=chapter_index - 1)
            if prev_chapter.status != StoryChapter.ChapterStatus.SAVED:
                raise PermissionError(f"请先保存第 {chapter_index - 1} 章的内容。")
        except StoryChapter.DoesNotExist:
            raise PermissionError(f"请先生成并保存第 {chapter_index - 1} 章。")

    # 检查当前章节是否已保存，已保存则不允许重新生成
    current_chapter = story.chapters.filter(chapter_index=chapter_index).first()
    if current_chapter and current_chapter.status == StoryChapter.ChapterStatus.SAVED:
        raise PermissionError(f"第 {chapter_index} 章已保存，无法使用AI重新生成。")

    # 更新大纲
    story.outlines = outlines
    story.save()

    # 删除可能存在的旧章节实例，准备重新生成
    StoryChapter.objects.filter(story=story, chapter_index=chapter_index).delete()

    # 设置全局生成状态锁，并更新完成状态
    story.is_generating = True
    story.current_generating_chapter = chapter_index
    story.is_complete = False  
    story.save()

    gamework_id = gamework.id
    def worker():
        try:
            gamework_instance = Gamework.objects.select_related('story').get(pk=gamework_id)
            logger.info(f"创作者模式生成 第 {chapter_index} 章")
            _generate_chapter(gamework_instance.id, chapter_index, user_prompt)
            logger.info(f"创作者模式完成 第 {chapter_index} 章")
        except Exception as e:
            logger.error(f"创作者模式生成出错: {e}", exc_info=True)
            StoryChapter.objects.filter(story__gamework_id=gamework_id, chapter_index=chapter_index).delete()
        finally:
            story_instance = Story.objects.get(gamework_id=gamework_id)
            story_instance.is_generating = False
            story_instance.current_generating_chapter = 0
            story_instance.save()

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def get_chapter_status(gamework: Gamework, chapter_index: int) -> dict:
    """查询章节生成状态或返回已生成内容。"""

    story = gamework.story

    if chapter_index < 1 or chapter_index > story.total_chapters:
        return {"status": "error", "message": f"章节索引 {chapter_index} 超出范围"}

    # 1. 检查章节是否已物理存在于数据库
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

    # 2. 如果章节不存在，再检查全局生成锁
    if story.is_generating and story.current_generating_chapter == chapter_index:
        return {
            "status": "generating",
            "progress": {
                "currentChapter": story.current_generating_chapter,
                "totalChapters": story.total_chapters
            }
        }
    
    # 3. 如果已完成所有章节的生成流程，但仍找不到，说明出错了
    if story.is_complete:
        return {"status": "error", "message": "章节应已生成但未找到"}
    
    # 4. 否则，就是尚未开始生成
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
    """
    return {
        "success": True
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