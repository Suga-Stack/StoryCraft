import logging
from rest_framework import views, status, permissions
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import GameCreateSerializer, GameworkCreateResponseSerializer, GameChapterRequestSerializer, GameChapterResponseSerializer, SettlementRequestSerializer, SettlementResponseSerializer
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from . import services
from django.shortcuts import get_object_or_404
from gameworks.models import Gamework
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger('django')

class GameCreateView(views.APIView):
    """创建新游戏作品"""

    permission_classes = [IsAuthenticated]
    # 启用JWT认证
    authentication_classes = [JWTAuthentication]

    @swagger_auto_schema(
        operation_summary="创建新游戏",
        operation_description="根据用户选择的标签、构思和篇幅，调用AI生成并创建一个新的游戏作品。",
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
            # 调用service层来处理创建逻辑
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
    """获取或生成游戏章节内容"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        operation_summary="获取游戏章节内容",
        operation_description="根据作品ID和章节索引获取章节内容。如果内容尚未生成，后端将调用AI实时生成。",
        request_body=GameChapterRequestSerializer,
        responses={
            status.HTTP_200_OK: GameChapterResponseSerializer,
            status.HTTP_400_BAD_REQUEST: openapi.Response(description="请求参数错误"),
            status.HTTP_500_INTERNAL_SERVER_ERROR: openapi.Response(description="服务器内部错误")
        }
    )
    def post(self, request, *args, **kwargs):
        serializer = GameChapterRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        gamework = validated_data['gameworkId']
        chapter_index = validated_data['chapterIndex']

        try:
            chapter_content = services.get_or_generate_chapter(gamework, chapter_index)
            return Response(chapter_content, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("获取或生成章节时发生错误: %s", e)
            return Response({"error": "服务器出错，请稍后重试。"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SettlementReportView(views.APIView):
    """
    结算报告候选生成
    路径：POST /api/settlement/report/:workId
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

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
