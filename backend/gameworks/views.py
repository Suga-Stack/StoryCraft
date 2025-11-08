from rest_framework import viewsets, generics, permissions, filters, status
from .models import Gamework
from .serializers import GameworkSerializer
from interactions.permissions import IsOwnerOrReadOnly
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.db.models import Count, Q, Avg, F


class GameworkViewSet(viewsets.ModelViewSet):
    queryset = Gamework.objects.all()
    serializer_class = GameworkSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_queryset(self):
        # 只有作者和管理员可以看到未发布作品
        queryset = Gamework.objects.all()
        user = self.request.user

        # 只显示已发布的作品或该用户为作品作者或管理员
        if not user.is_staff:
            # 过滤条件：显示已发布作品或者是该作品的作者
            queryset = queryset.filter(is_published=True) | queryset.filter(author=user)

        return queryset

class PublishGameworkViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="发布作品",
        operation_description=(
            "作品发布前对作者和管理员以外不可见。\n\n"
        ),
        responses={
            200: openapi.Response("作品已成功发布", GameworkSerializer(many=True)),
            404: "作品未找到",
            403: "您没有权限发布该作品"
        }
    )

    def publish(self, request, pk=None):
        # 获取作品对象
        try:
            gamework = Gamework.objects.get(pk=pk)
        except Gamework.DoesNotExist:
            return Response({'message': '作品未找到'}, status=status.HTTP_404_NOT_FOUND)

        # 确保用户是作品的作者或管理员
        if gamework.author != request.user and not request.user.is_staff:
            return Response({'message': '您没有权限发布该作品'}, status=status.HTTP_403_FORBIDDEN)

        # 设置作品为已发布
        gamework.is_published = True
        gamework.save()

        return Response({'message': '作品已成功发布', 'gamework': GameworkSerializer(gamework).data}, status=status.HTTP_200_OK)


class GameworkSearchView(generics.ListAPIView):
    """
    作品搜索接口
    根据关键词、作者名或标签搜索作品。
    示例：/api/gameworks/search/?q=冒险&author=Alice&tag=3
    """
    serializer_class = GameworkSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        queryset = Gamework.objects.filter(is_published=True)
        q = self.request.query_params.get("q")
        author = self.request.query_params.get("author")
        tag = self.request.query_params.get("tag")

        if q:
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q))

        if author:
            queryset = queryset.filter(author__username__icontains=author)

        if tag:
            queryset = queryset.filter(Q(tags__id__iexact=tag) | Q(tags__name__icontains=tag))

        return queryset.distinct()

class RecommendView(generics.ListAPIView):
    """基于用户喜欢标签的作品推荐接口"""
    serializer_class = GameworkSerializer
    permission_classes = [permissions.IsAuthenticated]
    # pagination_class = None  # 禁用分页，返回完整结果

    @swagger_auto_schema(
        operation_summary="推荐作品",
        operation_description=(
            "根据当前用户喜欢的标签推荐作品。\n\n"
            "推荐依据：用户的 liked_tags 与作品的 tags 标签匹配数量。\n"
            "不推荐用户自己创作的作品。"
        ),
        responses={
            200: openapi.Response("推荐结果", GameworkSerializer(many=True)),
            404: "用户未设置喜欢的标签"
        }
    )
    def get(self, request, *args, **kwargs):
        user = request.user
        liked_tags = user.liked_tags.all()

        # 若用户未设置喜欢的标签
        if not liked_tags.exists():
            return Response({
                "code": 404,
                "message": "用户未设置喜欢的标签",
                "data": []
            }, status=status.HTTP_404_NOT_FOUND)

        # 按标签重叠度计算推荐得分
        queryset = (
            Gamework.objects.filter(tags__in=liked_tags, is_published=True)
            .exclude(author=user)  # 不推荐自己创作的作品
            .annotate(
                match_count=Count("tags", filter=Q(tags__in=liked_tags), distinct=True),
                average_score=Avg('ratings__score')  # 计算作品的平均评分
            )
            .order_by("-match_count", "-average_score", "-id")  # 首先按标签重叠排序，再按评分排序
            .distinct()
        )

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "code": 200,
            "message": "推荐成功",
            "data": serializer.data
        }, status=status.HTTP_200_OK)
    
class GameworkFavoriteLeaderboardViewSet(viewsets.ViewSet):
    """
    获取基于收藏量的作品排行榜
    - GET: 返回按收藏量排序的作品
    """
    @swagger_auto_schema(
        operation_summary="作品排行榜（收藏量）",
        operation_description=(
            "返回收藏最多的10部作品，降序排列"
        )
    )
    def list(self, request):
        # 查询作品并按收藏量排序（降序）
        queryset = (Gamework.objects.filter(is_published=True)
            .annotate(favorite_count=Count('favorites')).order_by('-favorite_count')[:10])
        
        # 序列化数据
        serializer = GameworkSerializer(queryset, many=True)
        return Response({
            "message": "作品排行榜",
            "data": serializer.data
        })
    
class GameworkRatingLeaderboardViewSet(viewsets.ViewSet):
    """
    获取基于评分的作品排行榜
    - GET: 返回按平均评分排序的作品排行榜
    """
    @swagger_auto_schema(
        operation_summary="作品排行榜（评分）",
        operation_description=(
            "返回平均分最高的10部作品，降序排列"
        )
    )
    def list(self, request):
        # 查询作品并按评分的平均值排序（降序）
        queryset = Gamework.objects(Gamework.objects.filter(is_published=True)
            .annotate(average_score=Avg(F('ratings__score'))).order_by('-average_score')[:10])
        
        # 序列化数据
        serializer = GameworkSerializer(queryset, many=True)
        return Response({
            "message": "作品评分排行榜",
            "data": serializer.data
        })