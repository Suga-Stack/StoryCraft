import logging
import os
import time
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, OperationalError
from .serializers import (
    GameCreateSerializer, GameworkCreateResponseSerializer, 
    GameChapterStatusResponseSerializer, SettlementRequestSerializer, 
    SettlementResponseSerializer, GameSavePayloadSerializer,
    ChapterGenerateSerializer, GameChapterResponseSerializer,
    GameChapterManualUpdateSerializer
)
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from . import services
from rest_framework.generics import get_object_or_404
from gameworks.models import Gamework
from .models import GameSave
from stories.models import Story, StoryChapter, StoryScene
from copy import deepcopy
from rest_framework.parsers import MultiPartParser, FormParser
import uuid
from django.core.files.storage import default_storage
from django.conf import settings

logger = logging.getLogger('django')

class UserImageUploadView(views.APIView):
    """用户上传自定义图片"""
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_summary="上传自定义图片",
        operation_description="用户上传图片文件，服务器存储后返回图片的URL。",
        manual_parameters=[
            openapi.Parameter(
                'file',
                openapi.IN_FORM,
                description="要上传的图片文件",
                type=openapi.TYPE_FILE,
                required=True
            )
        ],
        responses={
            status.HTTP_201_CREATED: openapi.Response(
                description="上传成功",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'imageUrl': openapi.Schema(type=openapi.TYPE_STRING, description="图片的访问URL")
                    }
                )
            ),
            status.HTTP_400_BAD_REQUEST: openapi.Response(description="请求无效或未提供文件"),
        }
    )
    def post(self, request, *args, **kwargs):
        file_obj = request.data.get('file')
        if not file_obj:
            return Response({'error': '未提供文件'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 生成唯一文件名
            file_ext = os.path.splitext(file_obj.name)[1]
            file_name = f"user_upload/{uuid.uuid4().hex}{file_ext}"
            
            # 保存文件
            path = default_storage.save(file_name, file_obj)
            
            # 构建完整的URL
            image_url = request.build_absolute_uri(settings.MEDIA_URL + path)

            return Response({'imageUrl': image_url}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"上传图片时发生错误: {e}", exc_info=True)
            return Response({'error': '图片上传失败，请稍后重试。'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GameCreateView(views.APIView):
    """创建新游戏作品"""

    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="创建新游戏并启动章节生成",
        operation_description="根据用户选择的标签、构思和篇幅，调用AI生成并创建一个新的游戏作品，同时在后台异步生成所有章节。",
        request_body=GameCreateSerializer,  
        responses={
            status.HTTP_201_CREATED: openapi.Response(description='{"gameworkId": 123}'), 
            status.HTTP_400_BAD_REQUEST: openapi.Response(description="请求参数错误"),
            status.HTTP_401_UNAUTHORIZED: openapi.Response(description="未认证，请先登录"),
            status.HTTP_500_INTERNAL_SERVER_ERROR: openapi.Response(description="服务器内部错误")
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = GameCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        
        try:
            result = services.create_gamework(
                user=request.user,
                tags=validated_data['tags'],
                idea=validated_data.get('idea', ''),
                length=validated_data['length'],
                modifiable=validated_data.get('modifiable', False)
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("创建游戏时发生错误: %s", e)
            return Response({"error": "创建游戏失败，请稍后重试。"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GameChapterView(views.APIView):
    """轮询查询游戏章节生成状态或手动保存章节"""
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="查询章节生成状态或获取内容",
        operation_description="轮询接口，返回章节生成状态(pending/generating/ready)或已生成的章节内容。",
        manual_parameters=[
            openapi.Parameter('gameworkId', openapi.IN_PATH, description="作品ID", type=openapi.TYPE_INTEGER, required=True),
            openapi.Parameter('chapterIndex', openapi.IN_PATH, description="章节索引(从1开始)", type=openapi.TYPE_INTEGER, required=True),
        ],
        responses={
            status.HTTP_200_OK: GameChapterStatusResponseSerializer,
            status.HTTP_400_BAD_REQUEST: openapi.Response(description="请求参数错误"),
            status.HTTP_401_UNAUTHORIZED: openapi.Response(description="未认证，请先登录"),
            status.HTTP_404_NOT_FOUND: openapi.Response(description="作品不存在"),
            status.HTTP_500_INTERNAL_SERVER_ERROR: openapi.Response(description="服务器内部错误")
        }
    )
    def get(self, request, gameworkId: int, chapterIndex: int, *args, **kwargs):
        try:
            try:
                gamework = get_object_or_404(Gamework, pk=gameworkId)
            except Exception as e:
                return Response({"error":"指定的作品不存在"}, status=status.HTTP_404_NOT_FOUND)
            print("tring to get chapter status for gameworkId:", gameworkId, "chapterIndex:", chapterIndex)
            result = services.get_chapter_status(gamework, chapterIndex)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                "查询章节状态时发生错误 - gamework_id: %s, chapter_index: %s, error: %s",
                gameworkId, chapterIndex, e, exc_info=True
            )
            return Response(
                {"error": "服务器出错，请稍后重试。"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @swagger_auto_schema(
        operation_summary="手动保存修改后的章节内容",
        request_body=GameChapterManualUpdateSerializer,
        responses={
            status.HTTP_200_OK: openapi.Response(description='{"ok": true}'),
            status.HTTP_403_FORBIDDEN: openapi.Response(description='无权修改'),
            status.HTTP_400_BAD_REQUEST: openapi.Response(description='chapterIndex参数不匹配'),
        }
    )
    def put(self, request, gameworkId: int, chapterIndex: int, *args, **kwargs):
        gamework = get_object_or_404(Gamework, pk=gameworkId)
        if gamework.author != request.user:
            return Response({"error": "您没有权限修改此作品。"}, status=status.HTTP_403_FORBIDDEN)

        serializer = GameChapterManualUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        chapter_data = serializer.validated_data
        story = get_object_or_404(Story, gamework=gamework)

        # 校验 chapterIndex 是否匹配
        if chapter_data.get('chapterIndex') != chapterIndex:
            return Response({"error": "URL中的章节索引与请求体中的不匹配。"}, status=status.HTTP_400_BAD_REQUEST)

        chapter_obj, _ = StoryChapter.objects.update_or_create(
            story=story,
            chapter_index=chapterIndex,
            defaults={
                "title": chapter_data.get("title"),
                "status": StoryChapter.ChapterStatus.SAVED  # 标记为已保存
            }
        )
        chapter_obj.scenes.all().delete()

        for scene_data in chapter_data.get("scenes", []):
            StoryScene.objects.create(
                chapter=chapter_obj,
                scene_index=scene_data.get("id"), 
                background_image=scene_data.get("backgroundImage", ""), 
                background_image_url=scene_data.get("backgroundImage", ""), # 实际 URL
                dialogues=scene_data.get("dialogues")
            )
        
        return Response({"ok": True}, status=status.HTTP_200_OK)


class ChapterGenerateView(views.APIView):
    """为创作者启动指定章节的生成"""
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="启动章节生成(创作者模式)",
        request_body=ChapterGenerateSerializer,
        responses={
            status.HTTP_200_OK: openapi.Response(description='{"ok": true}'),
            status.HTTP_403_FORBIDDEN: openapi.Response(description='无权操作或非创作者模式'),
        }
    )
    def post(self, request, gameworkId: int, chapterIndex: int, *args, **kwargs):
        gamework = get_object_or_404(Gamework, pk=gameworkId)
        if gamework.author != request.user:
            return Response({"error": "您没有权限操作此作品。"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChapterGenerateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = serializer.validated_data
        try:
            services.start_single_chapter_generation(
                gamework=gamework,
                chapter_index=chapterIndex,
                outlines=validated_data.get("chapterOutlines", []),
                user_prompt=validated_data.get("userPrompt", "")
            )
            return Response({"ok": True}, status=status.HTTP_200_OK)
        except PermissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"启动章节生成失败: {e}", exc_info=True)
            return Response({"error": "启动生成失败"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GameSaveDetailView(views.APIView):
    """存档详情：PUT 保存/更新； GET 读取； DELETE 删除"""
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="保存或更新存档",
        request_body=GameSavePayloadSerializer,
        responses={
            status.HTTP_200_OK: openapi.Response(description='保存成功'),
            status.HTTP_404_NOT_FOUND: openapi.Response(description='作品不存在'),
            status.HTTP_400_BAD_REQUEST: openapi.Response(description='存档参数错误'),
        }
    )
    def put(self, request, gameworkId: int, slot: int, *args, **kwargs):
        try:
            gamework = get_object_or_404(Gamework, pk=gameworkId)
        except Exception as e:
            return Response({"error":"指定的作品不存在"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = GameSavePayloadSerializer(data=request.data or {})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        payload = serializer.validated_data
        state = payload.get("state")
        cover_url = services.resolve_scene_cover_url(
            gamework,
            state.get("chapterIndex"),
            state.get("sceneId")
        ) or ""

        # 添加重试机制处理 SQLite 数据库锁定问题
        max_retries = 3
        retry_delay = 0.5  # 500ms
        
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    GameSave.objects.update_or_create(
                        user=request.user,
                        gamework=gamework,
                        slot=slot,
                        defaults={
                            "title": payload.get("title", "默认标题"),
                            "timestamp": payload.get("timestamp", 1),
                            "state": state,
                            "cover_url": cover_url
                        }
                    )
                return Response({"ok": True}, status=status.HTTP_200_OK)
            except OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    # 如果是数据库锁定错误且还有重试机会，等待后重试
                    time.sleep(retry_delay * (attempt + 1))  # 递增延迟
                    continue
                else:
                    # 如果不是锁定错误或已达到最大重试次数，抛出异常
                    logger.error(f"存档失败 (重试 {attempt + 1}/{max_retries}): {str(e)}")
                    raise
        
        # 如果所有重试都失败，返回错误
        return Response(
            {"error": "存档失败，数据库繁忙，请稍后重试"}, 
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    @swagger_auto_schema(
        operation_summary="读取存档",
        responses={
            status.HTTP_200_OK: openapi.Response(description='返回完整存档对象'),
            status.HTTP_404_NOT_FOUND: openapi.Response(description='存档不存在')
        }
    )
    def get(self, request, gameworkId: int, slot: int, *args, **kwargs):
        try:
            gamework = get_object_or_404(Gamework, pk=gameworkId)
            save = get_object_or_404(GameSave, user=request.user, gamework=gamework, slot=slot)
        except Exception:
            return Response({"error": "存档不存在"}, status=status.HTTP_404_NOT_FOUND)
        
        payload = {
            "title": save.title,
            "timestamp": save.timestamp,
            "state": save.state,
            "cover_url": save.cover_url  # 添加缩略图 URL
        }
        return Response(payload, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="删除存档",
        responses={
            status.HTTP_200_OK: openapi.Response(description='成功删除'),
            status.HTTP_404_NOT_FOUND: openapi.Response(description='存档不存在')
        }
    )
    def delete(self, request, gameworkId: int, slot: int, *args, **kwargs):
        try:
            gamework = get_object_or_404(Gamework, pk=gameworkId)
        except Exception:
            return Response({"error": "存档不存在"}, status=status.HTTP_404_NOT_FOUND)
        
        deleted, _ = GameSave.objects.filter(user=request.user, gamework=gamework, slot=slot).delete()

        if not deleted:
            return Response({"error": "存档不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True}, status=status.HTTP_200_OK)

class GameSaveListView(views.APIView):
    """列出作品下全部存档摘要"""
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="列出存档摘要",
        responses={status.HTTP_200_OK: openapi.Response(description='{"saves": [...]}')}
    )
    def get(self, request, gameworkId: int, *args, **kwargs):
        try:
            gamework = get_object_or_404(Gamework, pk=gameworkId)
        except Exception:
            return Response({"error": "存档不存在"}, status=status.HTTP_404_NOT_FOUND)
        
        saves = GameSave.objects.filter(user=request.user, gamework=gamework).order_by('slot')
        items = []
        for save in saves:
            state = save.state 
            items.append({
                "slot": save.slot,
                "title": save.title,
                "timestamp": save.timestamp,
                "chapterIndex": state.get("chapterIndex"),
                "sceneId": state.get("sceneId"),
                "dialogueIndex": state.get("dialogueIndex"),
                "coverUrl": save.cover_url
            })

        return Response({"saves": items}, status=status.HTTP_200_OK)

class SettlementReportView(views.APIView):
    """
    结算报告候选生成
    路径：POST /api/settlement/report/:workId
    """
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="生成结算报告候选 variants",
        operation_description="后端返回满足业务的所有候选报告，前端根据 attributes/statuses 自行匹配。",
        request_body=SettlementRequestSerializer,
        responses={status.HTTP_200_OK: SettlementResponseSerializer}
    )
    def post(self, request, workId: int, *args, **kwargs):
        # 校验作品存在
        _ = get_object_or_404(Gamework, pk=workId)

        attrs = request.data.get("attributes", {}) or {}
        stats = request.data.get("statuses", {}) or {}

        if not isinstance(attrs, dict) or not isinstance(stats, dict):
            return Response({"detail": "attributes/statuses 必须为对象"}, status=status.HTTP_400_BAD_REQUEST)

        result = services.build_settlement_variants(attrs, stats)
        return Response(result, status=status.HTTP_200_OK)
