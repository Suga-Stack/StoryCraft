import random
import logging
import threading
import time
from django.db import transaction
from typing import List, Dict, Any, Optional
from django.db import close_old_connections
from django.conf import settings
from django.db.models import Count, Q
from stories.models import Story, StoryChapter, StoryScene, StoryEnding
from gameworks.models import Gamework, Music
from .utils import parse_raw_chapter, update_story_directory
from .game_generator.architecture import generate_core_seeds, generate_architecture
from .game_generator.chapter import generate_chapter_content, generate_ending_content, calculate_attributes, parse_ending_condition
from .game_generator.images import generate_cover_image, generate_scene_images
from .game_generator.report import generate_report_content
from .models import GameReport
logger = logging.getLogger('django')

def _select_background_music(tags: List[str]) -> List[Music]:
    """根据标签匹配最合适的背景音乐列表（例如取前3首）"""
    # 查找有重叠标签的音乐，按重叠数量降序
    matches = Music.objects.filter(tags__name__in=tags).annotate(
        match_count=Count('tags', filter=Q(tags__name__in=tags))
    ).order_by('-match_count')
    
    # 取前4首
    selected_music = list(matches[:4])
    
    # 如果不足3首，随机补充
    if len(selected_music) < 3:
        needed = 3 - len(selected_music)
        existing_ids = [m.id for m in selected_music]
        random_music = list(Music.objects.exclude(id__in=existing_ids).order_by('?')[:needed])
        selected_music.extend(random_music)
        
    return selected_music

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
    story = Story.objects.select_related('gamework').get(gamework_id=gamework_id)
    if not story.initial_generation_complete:
        raise ValueError("故事初始信息未完成，无法生成章节。")

    chapters = story.chapters.prefetch_related('scenes').order_by('chapter_index')
    prev_raw = chapters.filter(chapter_index=chapter_index - 1).first().raw_content if chapter_index > 1 else None

    # 1. 生成章节内容
    raw_chapter_content, updated_global_summary, _ = generate_chapter_content(
        chapter_index=chapter_index,
        total_chapters=story.total_chapters, 
        chapter_directory=story.chapter_directory,
        core_seed=story.core_seed,
        attribute_system=story.attribute_system,
        architecture=story.architecture,
        previous_chapter_content=prev_raw,
        global_summary=story.global_summary,
        user_prompt=user_prompt
    )
    
    # 2. 处理图片和解析
    ref_images = [story.gamework.image_url] if story.gamework.image_url else None
    scene_ranges, scene_urls = generate_scene_images(raw_chapter_content, ref_images=ref_images)
    chapter_dict = parse_raw_chapter(raw_chapter_content, scene_ranges)
    
    chapter_title = chapter_dict["title"]
    if story.outlines:
        for outline in story.outlines:
            if outline.get("chapterIndex") == chapter_index:
                chapter_title = outline.get("title", chapter_title)
                break
    chapter_dict["title"] = chapter_title

    # 3. 数据库原子更新
    with transaction.atomic():
        Story.objects.filter(pk=story.pk).update(global_summary=updated_global_summary)
        story.refresh_from_db()

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

        for scene in chapter_dict["scenes"]:
            idx = scene["id"] - 1
            img_url = scene_urls[idx] if idx < len(scene_urls) else f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}placeholders/scene.jpg"
            StoryScene.objects.create(
                chapter=chapter_obj,
                scene_index=scene["id"],
                background_image_url=img_url,
                dialogues=scene["dialogues"]
            )

        # 如果是最后一章，初始化结局占位符（如果尚未初始化）
        if chapter_index == story.total_chapters:
            _initialize_endings(story)

    # 4. 仅在非创作者模式下自动生成所有结局
    if chapter_index == story.total_chapters and not story.ai_callable:      
        _generate_endings_async(story.id)

    # 检查是否全部完成
    current_chapter_count = StoryChapter.objects.filter(story=story).count()
    if current_chapter_count >= story.total_chapters:
        Story.objects.filter(pk=story.pk).update(is_complete=True)

def _initialize_endings(story: Story):
    """初始化结局占位符"""
    if not story.endings_summary:
        return

    try:
        all_chapters = list(story.chapters.order_by('chapter_index'))
        parsed_chapters = [ch.parsed_content for ch in all_chapters]
        attr_ranges = calculate_attributes(parsed_chapters, story.initial_attributes)

        for ending_info in story.endings_summary:
            idx = ending_info.get("endingIndex")
            cond_text = ending_info.get("condition", "")
            parsed_condition = parse_ending_condition(cond_text, attr_ranges)
            
            StoryEnding.objects.update_or_create(
                story=story,
                ending_index=idx,
                defaults={
                    "title": ending_info.get("title", ""),
                    "summary": ending_info.get("summary", ""),
                    "condition": parsed_condition,
                    "status": StoryEnding.EndingStatus.NOT_GENERATED,
                    "raw_content": "", 
                    "parsed_content": {}
                }
            )
    except Exception as e:
        logger.error(f"初始化结局失败: {e}", exc_info=True)

def _generate_ending_task(story_id: int, ending_index: int, user_prompt: str = ""):
    """生成并保存单个结局的任务函数"""
    close_old_connections()
    try:
        story = Story.objects.select_related('gamework').get(pk=story_id)
        ending = StoryEnding.objects.get(story=story, ending_index=ending_index)
        
        logger.info(f"开始生成故事 {story_id} 结局 {ending_index}")

        # 获取上下文
        chapter_index = story.total_chapters
        
        # 最后一章（前半部分）
        try:
            last_chapter = story.chapters.get(chapter_index=chapter_index)
            last_chapter_content = last_chapter.raw_content
        except StoryChapter.DoesNotExist:
            last_chapter_content = ""
            logger.warning(f"生成结局时未找到第 {chapter_index} 章内容")

        # 倒数第二章
        previous_chapter_content = ""
        if chapter_index > 1:
            try:
                prev_chapter = story.chapters.get(chapter_index=chapter_index - 1)
                previous_chapter_content = prev_chapter.raw_content
            except StoryChapter.DoesNotExist:
                pass

        # 生成文本
        raw_content = generate_ending_content(
            ending_title=ending.title,
            ending_condition=str(ending.condition), 
            ending_summary=ending.summary,
            chapter_index=chapter_index,
            attribute_system=story.attribute_system,
            architecture=story.architecture,
            previous_chapter_content=previous_chapter_content,
            last_chapter_content=last_chapter_content,
            global_summary=story.global_summary,
            user_prompt=user_prompt
        )

        # 生成图片
        ref_images = [story.gamework.image_url] if story.gamework.image_url else None
        scene_ranges, scene_urls = generate_scene_images(raw_content, ref_images=ref_images)
        # 解析
        parsed_ending = parse_raw_chapter(raw_content, scene_ranges)

        # 原子保存：确保 raw_content 和 scenes 同时可见
        with transaction.atomic():
            ending.raw_content = raw_content
            ending.parsed_content = parsed_ending
            ending.status = StoryEnding.EndingStatus.GENERATED # 标记为已生成
            ending.save()

            ending.scenes.all().delete()
            for scene in parsed_ending["scenes"]:
                idx = scene["id"] - 1
                img_url = scene_urls[idx] if idx < len(scene_urls) else f"{settings.SITE_DOMAIN}{settings.MEDIA_URL}placeholders/scene.jpg"
                StoryScene.objects.create(
                    ending=ending,
                    scene_index=scene["id"],
                    background_image_url=img_url,
                    dialogues=scene["dialogues"]
                )
        
        logger.info(f"故事 {story_id} 结局 {ending_index} 保存完成")

        # 生成报告
        _generate_and_save_report(story, ending)

    except Exception as e:
        logger.error(f"生成结局 {ending_index} 失败: {e}", exc_info=True)

def _generate_endings_async(story_id: int):
    """后台批量生成所有结局详情"""
    def worker():
        close_old_connections()
        try:
            story = Story.objects.get(pk=story_id)
            endings = StoryEnding.objects.filter(story=story)
            logger.info(f"开始批量生成故事 {story_id} 的 {endings.count()} 个结局")
            
            for ending in endings:
                # 先标记为生成中
                ending.status = StoryEnding.EndingStatus.GENERATING
                ending.save()
                t = threading.Thread(target=_generate_ending_task, args=(story_id, ending.ending_index))
                t.start()
            
        except Exception as e:
            logger.error(f"批量生成结局任务分发失败: {e}", exc_info=True)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

def _generate_and_save_report(story: Story, ending_obj: StoryEnding):
    """生成并保存结局对应的个性报告"""
    try:
        logger.info(f"开始生成结局 {ending_obj.id} 的个性报告")
        report_data = generate_report_content(
            global_summary=story.global_summary,
            ending_summary=ending_obj.summary,
            ending_title=ending_obj.title
        )
        
        GameReport.objects.update_or_create(
            story_ending=ending_obj,
            defaults={
                "title": report_data["title"],
                "content": report_data["content"],
                "traits": report_data["traits"]
            }
        )
        logger.info(f"结局 {ending_obj.id} 个性报告生成完成")
    except Exception as e:
        logger.error(f"生成个性报告失败: {e}", exc_info=True)

def get_ending_report(gamework_id: int, ending_index: int, player_attributes: dict) -> dict:
    """获取结局报告并计算分数"""
    story = Story.objects.get(gamework_id=gamework_id)
    try:
        ending = StoryEnding.objects.get(story=story, ending_index=ending_index)
    except StoryEnding.DoesNotExist:
        return {"status": "pending"}
    try:
        report = GameReport.objects.get(story_ending=ending)
    except GameReport.DoesNotExist:
            return {"status": "generating"}

    all_chapters = list(story.chapters.order_by('chapter_index'))
    parsed_chapters = [ch.parsed_content for ch in all_chapters]
    
    attr_ranges = calculate_attributes(parsed_chapters, story.initial_attributes)
    
    scores = {}
    for attr, value in player_attributes.items():
        if attr in attr_ranges:
            max_val = attr_ranges[attr][1]
            if max_val <= 0: 
                max_val = 100 
            
            score = int((value / max_val) * 100)
            scores[attr] = min(100, max(0, score))
        else:
            scores[attr] = 0

    return {
        "status": "ready",
        "details":{
            "title": report.title,
            "content": report.content,
            "traits": report.traits,
            "scores": scores
        }
    }


def get_story_endings(gamework: Gamework) -> dict:
    """获取故事结局列表（不含场景）"""
    story = gamework.story
    
    # 如果没有 endings_summary，说明还没生成到最后
    if not story.endings_summary:
        return {"status": "pending"}

    # 获取已存在的 StoryEnding 对象
    current_endings = story.story_endings.all().order_by('ending_index')
    
    # 组装返回数据 (只返回摘要信息)
    endings_data = []
    for ending in current_endings:
        endings_data.append({
            "endingIndex": ending.ending_index,
            "title": ending.title,
            "condition": ending.condition,
            "outline": ending.summary,
            "status": ending.status # 返回状态
        })
        
    return {
        "status": "ready",
        "endings": endings_data
    }

def get_single_story_ending(gamework: Gamework, ending_index: int) -> dict:
    """获取单个结局的详细内容（包含场景）"""
    story = gamework.story
    try:
        ending = StoryEnding.objects.prefetch_related('scenes').get(story=story, ending_index=ending_index)
    except StoryEnding.DoesNotExist:
        return {"status": "error", "message": "结局不存在"}
    
    if ending.status == StoryEnding.EndingStatus.NOT_GENERATED:
         return {"status": "not_generated", "message": "结局尚未生成"}
    
    if ending.status == StoryEnding.EndingStatus.GENERATING:
        return {"status": "generating", "message": "结局内容生成中"}

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
    
    return {
        "status": "ready",
        "ending": {
            "endingIndex": ending.ending_index,
            "title": ending.title,
            "condition": ending.condition,
            "outline": ending.summary,
            "status": ending.status,
            "scenes": scenes_data
        }
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
    
    def worker():
        close_old_connections()
        try:
            # 生成创意种子
            seeds = generate_core_seeds(tags, idea)
            selected_seed = random.choice(seeds)
            
            results = {}
            
            def task_arch():
                try:
                    results['arch'] = generate_architecture(selected_seed, total_chapters)
                except Exception as e:
                    logger.error(f"架构生成失败: {e}", exc_info=True)

            def task_cover():
                try:
                    # 根据创意生成封面
                    results['cover'] = generate_cover_image(selected_seed)
                except Exception as e:
                    logger.error(f"封面生成失败: {e}", exc_info=True)

            # 并行执行架构生成和封面生成
            t1 = threading.Thread(target=task_arch)
            t2 = threading.Thread(target=task_cover)
            
            t1.start()
            t2.start()
            
            t1.join()
            t2.join()
            
            arch_data = results.get('arch')
            cover_url = results.get('cover')
            
            if not arch_data:
                raise Exception("架构生成失败，无法继续")

            _update_gamework_after_generation(
                gamework_id,
                core_seed_details={
                    "title": arch_data["title"], 
                    "description": arch_data["description"], 
                    "core_seed": selected_seed
                },
                architecture_details=arch_data,
                cover_url=cover_url
            )
        except Exception as e:
            logger.error(f"作品详情生成失败: {e}", exc_info=True)

    thread = threading.Thread(target=worker, daemon=True)
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
                story.endings_summary = architecture_details["endings_summary"]
                story.attribute_system = architecture_details["attribute_system_text"]
                story.architecture = architecture_details["architecture_text"]
                story.chapter_directory = architecture_details["chapter_directory_text"]
            
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

    # 3. 匹配并设置背景音乐
    music_list = _select_background_music(tags)
    if music_list:
        gamework.background_musics.set(music_list)

    # 4. 启动后台生成任务
    _start_gamework_details_generation(gamework.id, tags, idea, total_chapters)

    # 5. 立即返回
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
    update_story_directory(story, outlines)

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


def resolve_scene_cover_url(gamework: Gamework, chapter_index: Optional[int], scene_index: int, ending_index: Optional[int] = None) -> Optional[str]:
    """根据章节与场景索引解析背景图URL"""
    url = None
    
    if ending_index is not None:
        url = StoryScene.objects.filter(
            ending__story__gamework=gamework,
            ending__ending_index=ending_index,
            scene_index=scene_index
        ).values_list('background_image_url', flat=True).first()
    elif chapter_index is not None:
        url = StoryScene.objects.filter(
            chapter__story__gamework=gamework,
            chapter__chapter_index=chapter_index,
            scene_index=scene_index
        ).values_list('background_image_url', flat=True).first()

    if url and not url.startswith(('http://', 'https://')):
        return f"{settings.SITE_DOMAIN}{url}"
    return url

def start_single_ending_generation(gamework: Gamework, ending_index: int, title: str, outline: str, user_prompt: str):
    """为创作者模式启动单结局的异步生成"""
    story = gamework.story
    if not story.ai_callable:
        raise PermissionError("此作品不允许调用AI生成。")

    if story.is_generating:
        raise PermissionError("已有内容正在生成中，请稍候。")
    
    endings = story.endings_summary or []
    if ending_index < 1 or ending_index > len(endings):
        raise ValueError(f"结局索引 {ending_index} 无效")

    try:
        ending_obj = StoryEnding.objects.get(story=story, ending_index=ending_index)
        
        if ending_obj.status == StoryEnding.EndingStatus.SAVED:
            raise PermissionError("该结局已保存，无法重新生成。")

        ending_obj.title = title
        ending_obj.summary = outline
        ending_obj.raw_content = "" 
        ending_obj.parsed_content = {}
        ending_obj.status = StoryEnding.EndingStatus.GENERATING # 标记为生成中
        ending_obj.save()
        ending_obj.scenes.all().delete()
        
        # 删除旧的报告，确保生成期间状态一致
        GameReport.objects.filter(story_ending=ending_obj).delete()
        
    except StoryEnding.DoesNotExist:
        raise ValueError("结局不存在")

    # 同步更新 story.endings_summary
    if story.endings_summary and len(story.endings_summary) >= ending_index:
        story.endings_summary[ending_index-1]["title"] = title
        story.endings_summary[ending_index-1]["summary"] = outline
        story.save()

    story.is_generating = True
    story.save()

    gamework_id = gamework.id
    def worker():
        try:
            logger.info(f"创作者模式生成 结局 {ending_index}")
            _generate_ending_task(gamework_id, ending_index, user_prompt)
            logger.info(f"创作者模式完成 结局 {ending_index}")
        except Exception as e:
            logger.error(f"创作者模式生成结局出错: {e}", exc_info=True)
        finally:
            story_instance = Story.objects.get(gamework_id=gamework_id)
            story_instance.is_generating = False
            story_instance.save()

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()