from rest_framework import viewsets, generics, permissions, filters
from .models import Gamework
from .serializers import GameworkSerializer
from interactions.permissions import IsOwnerOrReadOnly
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.db.models import Q

class GameworkViewSet(viewsets.ModelViewSet):
    queryset = Gamework.objects.all()
    serializer_class = GameworkSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class GameworkSearchView(generics.ListAPIView):
    """
    作品搜索接口
    根据关键词、作者名或标签搜索作品。
    示例：/api/gameworks/search/?q=冒险&author=Alice&tag=3
    """
    serializer_class = GameworkSerializer
    permission_classes = [permissions.AllowAny]

    @swagger_auto_schema(
        operation_summary="搜索作品",
        operation_description=(
            "根据关键词、作者名或标签搜索作品。\n\n"
            "示例：`/api/gameworks/search/?q=冒险&author=Alice&tag=3`"
        ),
        manual_parameters=[
            openapi.Parameter(
                'q',
                openapi.IN_QUERY,
                description="关键词（标题或简介匹配）",
                type=openapi.TYPE_STRING
            ),
            openapi.Parameter(
                'author',
                openapi.IN_QUERY,
                description="作者用户名",
                type=openapi.TYPE_STRING
            ),
            openapi.Parameter(
                'tag',
                openapi.IN_QUERY,
                description="标签 ID 或标签名",
                type=openapi.TYPE_STRING
            ),
        ],
        responses={
            200: openapi.Response(
                description="搜索成功",
                examples={
                    "application/json": {
                        "code": 200,
                        "message": "搜索成功",
                        "data": [
                            {"id": 1, "title": "冒险之旅", "author": "Alice", "tags": ["冒险", "RPG"]}
                        ],
                    }
                },
            )
        }
    )
    def get(self, request, *args, **kwargs):
        """处理 GET 请求"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "code": 200,
            "message": "搜索成功",
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def get_queryset(self):
        """根据查询参数筛选作品"""
        queryset = Gamework.objects.all()
        q = self.request.query_params.get("q")
        author = self.request.query_params.get("author")
        tag = self.request.query_params.get("tag")

        if q:
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q))

        if author:
            queryset = queryset.filter(author__user_name__icontains=author)

        if tag:
            queryset = queryset.filter(Q(tags__id__iexact=tag) | Q(tags__name__icontains=tag))

        return queryset.distinct()