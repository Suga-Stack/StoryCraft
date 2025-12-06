from rest_framework import viewsets, generics, permissions, filters, status
from .models import Gamework
from .serializers import GameworkDetailSerializer, GameworkSimpleSerializer
from interactions.permissions import IsOwnerOrReadOnly
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.db.models import Count, Q, Avg, F, Prefetch, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from interactions.models import Favorite, Comment
from django.utils import timezone
from datetime import timedelta

class GameworkViewSet(viewsets.ModelViewSet):
    """
    游戏作品视图集：
    - 已发布作品对所有人可见
    - 未发布作品仅作者和管理员可见
    - 自动统计收藏数、评分数、阅读数、平均评分
    - 返回字段包括是否被当前用户收藏
    """
    serializer_class = GameworkDetailSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # 检查初始生成是否完成
        if not getattr(instance.story, 'initial_generation_complete', False):
            return Response({"status": "generating"}, status=status.HTTP_200_OK)

        serializer = self.get_serializer(instance)
        return Response({"status": "ready", "data": serializer.data})

    def get_queryset(self):
        user = self.request.user
        base_filter = Q()

        if user.is_authenticated and not user.is_staff:
            base_filter |= Q(author=user)
        elif user.is_staff:
            base_filter = Q()  # 管理员查看全部

        queryset = (
            Gamework.objects.filter(base_filter)
            .annotate(
                favorite_count=Count('favorited_by', distinct=True),
                average_score=Avg('ratings__score', distinct=True),
                rating_count=Count('ratings', distinct=True),
                read_count=Count('read_records__user', distinct=True),
            )
            .select_related('author', 'story')
            .prefetch_related('tags')
        )

        # 优化 is_favorited 判断
        if user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'favorited_by',
                    queryset=Favorite.objects.filter(user=user),
                    to_attr='user_favorites'
                )
            )

        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        
        # 权限检查
        if not user.is_staff and instance.author != user:
            return Response(
                {"detail": "只有管理员或作者可以删除作品"},
                status=403
            )
        
        # 调用默认删除逻辑
        return super().destroy(request, *args, **kwargs)


class PublishGameworkViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="发布作品",
        operation_description=(
            "作品发布前对作者和管理员以外不可见。\n\n"
        ),
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "price": openapi.Schema(type=openapi.TYPE_INTEGER, description="作品价格（积分）")
            }
        ),
        responses={
            200: openapi.Response("作品已成功发布", GameworkSimpleSerializer(many=True)),
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
        
        price = request.data.get("price")
        if price is not None:
            try:
                price = int(price)
            except ValueError:
                return Response({'message': 'price 必须是整数'}, status=status.HTTP_400_BAD_REQUEST)
            
            if price < 0 or price > 50:
                return Response(
                    {'message': 'price 必须在 0 ~ 50 之间'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            gamework.price = price

        # 设置作品为已发布
        gamework.is_published = True
        gamework.published_at = timezone.now()
        gamework.save()

        return Response({'message': '作品已成功发布', 'gamework': GameworkSimpleSerializer(gamework).data}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="取消发布作品",
        operation_description="将作品标记为未发布。未发布的作品只对作者本人和管理员可见。",
        responses={
            200: openapi.Response("作品已成功取消发布", GameworkSimpleSerializer),
            404: "作品未找到",
            403: "您没有权限取消发布该作品"
        }
    )
    def unpublish(self, request, pk=None):
        # 获取作品对象
        try:
            gamework = Gamework.objects.get(pk=pk)
        except Gamework.DoesNotExist:
            return Response({'message': '作品未找到'}, status=status.HTTP_404_NOT_FOUND)

        # 权限检查（作者或管理员）
        if gamework.author != request.user and not request.user.is_staff:
            return Response({'message': '您没有权限取消发布该作品'}, status=status.HTTP_403_FORBIDDEN)

        # 设置为未发布
        gamework.is_published = False
        gamework.save()

        return Response(
            {'message': '作品已成功取消发布', 'gamework': GameworkSimpleSerializer(gamework).data},
            status=status.HTTP_200_OK
        )


class GameworkSearchView(generics.ListAPIView):
    """
    作品搜索接口
    根据关键词、作者名或标签搜索作品。
    示例：/api/gameworks/search/?q=冒险&author=Alice&tag=3
    """
    serializer_class = GameworkSimpleSerializer
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
    serializer_class = GameworkSimpleSerializer
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
            200: openapi.Response("推荐结果", GameworkSimpleSerializer(many=True)),
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
        serializer = GameworkSimpleSerializer(queryset, many=True)
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
        queryset = Gamework.objects.filter(is_published=True).annotate(average_score=Avg(F('ratings__score'))).order_by('-average_score')[:10]
        
        # 序列化数据
        serializer = GameworkSimpleSerializer(queryset, many=True)
        return Response({
            "message": "作品评分排行榜",
            "data": serializer.data
        })
    
class GameworkHotLeaderboardViewSet(viewsets.ViewSet):
    """
    获取基于热度的作品排行榜
    - GET: 返回按热度排序的作品排行榜（回复数*2 + 收藏数*1）
    - 支持时间维度：总榜、月榜、周榜
    """

    @swagger_auto_schema(
        operation_summary="作品热度排行榜",
        operation_description=(
            "返回热度最高的10部作品，热度计算公式：\n"
            "热度 = 回复数 × 2 + 收藏数 × 1\n"
            "可通过 ?range=total|month|week 指定时间范围，默认 total（总榜）"
        ),
        manual_parameters=[
            openapi.Parameter(
                name='range',
                in_=openapi.IN_QUERY,
                type=openapi.TYPE_STRING,
                description='排行榜时间范围，可选 total, month, week',
                required=False
            )
        ]
    )
    def list(self, request):
        time_range = request.query_params.get('range', 'total')
        now = timezone.now()

        # 根据 range 计算时间边界
        start_time = None
        if time_range == 'month':
            start_time = now - timedelta(days=30)
        elif time_range == 'week':
            start_time = now - timedelta(days=7)
        elif time_range != 'total':
            return Response({
                "message": "无效的 range 参数，可选值: total, month, week"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 评论子查询
        comments_qs = Comment.objects.filter(gamework=OuterRef('pk'))
        if start_time:
            comments_qs = comments_qs.filter(created_at__gte=start_time)
        comments_subquery = comments_qs.values('gamework').annotate(c=Count('id')).values('c')

        # 收藏子查询
        favorites_qs = Favorite.objects.filter(gamework=OuterRef('pk'))
        if start_time:
            favorites_qs = favorites_qs.filter(created_at__gte=start_time)
        favorites_subquery = favorites_qs.values('gamework').annotate(f=Count('id')).values('f')

        # 主查询
        queryset = (
            Gamework.objects.filter(is_published=True)
            .annotate(
                reply_count=Coalesce(Subquery(comments_subquery, output_field=IntegerField()), 0),
                favorite_count=Coalesce(Subquery(favorites_subquery, output_field=IntegerField()), 0)
            )
            .annotate(
                hot_score=F('reply_count') * 2 + F('favorite_count') * 1
            )
            .order_by('-hot_score')[:10]
        )

        # 序列化
        serializer = GameworkSimpleSerializer(queryset, many=True, context={'request': request})

        return Response({
            "message": f"作品热度排行榜（{time_range}）",
            "data": serializer.data
        }, status=status.HTTP_200_OK)