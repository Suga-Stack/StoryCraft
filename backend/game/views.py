import logging
import time
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction, OperationalError
from .serializers import (
    GameCreateSerializer, GameworkCreateResponseSerializer, 
    GameChapterStatusResponseSerializer, SettlementRequestSerializer, 
    SettlementResponseSerializer, GameSavePayloadSerializer
)
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from . import services
from rest_framework.generics import get_object_or_404
from gameworks.models import Gamework
from .models import GameSave

logger = logging.getLogger('django')

class GameCreateView(views.APIView):
    """创建新游戏作品"""

    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="创建新游戏并启动章节生成",
        operation_description="根据用户选择的标签、构思和篇幅，调用AI生成并创建一个新的游戏作品，同时在后台异步生成所有章节。",
        request_body=GameCreateSerializer,  
        responses={
            status.HTTP_201_CREATED: GameworkCreateResponseSerializer, 
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
                length=validated_data['length']
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error("创建游戏时发生错误: %s", e)
            return Response({"error": "创建游戏失败，请稍后重试。"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GameChapterView(views.APIView):
    """轮询查询游戏章节生成状态"""
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
