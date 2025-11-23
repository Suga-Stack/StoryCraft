from rest_framework import viewsets, status, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Favorite, Comment, Rating, FavoriteFolder, CommentLike
from .serializers import FavoriteSerializer, CommentSerializer, RatingSerializer, FavoriteFolderSerializer
from drf_yasg.utils import swagger_auto_schema, no_body
from drf_yasg import openapi
from django.db.models import Avg, Count, Prefetch

class FavoriteFolderViewSet(viewsets.ModelViewSet):
    """
    收藏夹管理接口
    - GET: 获取收藏夹列表
    - POST: 创建收藏夹
    - PATCH: 修改收藏夹名称
    - DELETE: 删除收藏夹
    """
    http_method_names = ['get', 'post', 'patch', 'delete']
    serializer_class = FavoriteFolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return FavoriteFolder.objects.none()
        
        if not self.request.user.is_authenticated:
            return FavoriteFolder.objects.none()
        
        return FavoriteFolder.objects.filter(user=self.request.user)

    @swagger_auto_schema(
        operation_summary="创建收藏夹",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'name': openapi.Schema(type=openapi.TYPE_STRING, description='收藏夹名称，可为空，系统自动命名')
            }
        ),
        responses={201: openapi.Response(description="收藏夹创建成功")}
    )
    def create(self, request, *args, **kwargs):
        """创建收藏夹"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        folder = serializer.save()
        return Response({
            "code": 201,
            "message": "收藏夹创建成功",
            "data": self.get_serializer(folder).data
        }, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_summary="删除收藏夹",
        responses={204: openapi.Response(description="收藏夹删除成功，作品转为未分组")}
    )
    def destroy(self, request, *args, **kwargs):
        """删除收藏夹，作品自动转为未分组"""
        instance = self.get_object()
        Favorite.objects.filter(folder=instance).update(folder=None)
        self.perform_destroy(instance)
        return Response({"code": 204, "message": "收藏夹删除成功"}, status=status.HTTP_204_NO_CONTENT)


class FavoriteViewSet(viewsets.ModelViewSet):
    """
    用户收藏作品接口
    - GET: 获取当前用户收藏列表
    - POST: 收藏作品（传入 id 与可选收藏夹）
    - PATCH: 移动收藏到其他收藏夹
    - DELETE: 取消收藏
    """
    http_method_names = ['get', 'post', 'patch', 'delete']
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['gamework__title']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Favorite.objects.none()
        return Favorite.objects.filter(user=self.request.user).select_related('gamework', 'folder')

    @swagger_auto_schema(
        operation_summary="获取收藏列表（支持按作品标题和收藏夹筛选）",
        manual_parameters=[
            openapi.Parameter(
                'search', openapi.IN_QUERY,
                description="按作品标题模糊搜索收藏",
                type=openapi.TYPE_STRING,
                example="森林"
            ),
            openapi.Parameter(
                'folder', openapi.IN_QUERY,
                description="筛选所属收藏夹ID（send empty value或为 null 显示未分组，不传显示全部）",
                type=openapi.TYPE_STRING,
                example="3",
                required=False,  # 表示该字段可选
                allowEmptyValue=True  # Swagger 显示时允许传空字符串
            )
        ]
    )
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # 收藏夹筛选
        folder_param = request.query_params.get('folder')
        if folder_param == 'null' or folder_param == '':
            queryset = queryset.filter(folder__isnull=True)
        elif folder_param:
            queryset = queryset.filter(folder_id=folder_param)

        # 按标题搜索（DRF SearchFilter 自动处理）
        queryset = self.filter_queryset(queryset)

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        data = {
            "code": 200,
            "message": "获取收藏列表成功",
            "data": serializer.data
        }
        return self.get_paginated_response(data) if page else Response(data)

    @swagger_auto_schema(
        operation_summary="收藏作品",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['id'],
            properties={
                'gamework_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID'),
                'folder': openapi.Schema(type=openapi.TYPE_INTEGER, description='收藏夹ID，可选')
            }
        ),
        responses={201: openapi.Response(description="收藏成功")}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        favorite = serializer.save()
        return Response({
            "code": 201,
            "message": "收藏成功",
            "data": self.get_serializer(favorite).data
        }, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_summary="移动收藏到其他收藏夹",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'folder': openapi.Schema(type=openapi.TYPE_INTEGER, description='目标收藏夹ID，可为空（移出收藏夹）')
            }
        ),
        responses={200: openapi.Response(description="移动成功")}
    )
    def partial_update(self, request, *args, **kwargs):
        """移动收藏到其他收藏夹或移出收藏夹"""
        instance = self.get_object()
        folder_id = request.data.get('folder')

        if folder_id is not None:
            try:
                if folder_id == "" or folder_id == "null":
                    folder = None
                else:
                    folder = FavoriteFolder.objects.get(id=folder_id, user=request.user)
            except FavoriteFolder.DoesNotExist:
                return Response({"code": 400, "message": "收藏夹不存在"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            folder = None

        instance.folder = folder
        instance.save()
        return Response({
            "code": 200,
            "message": "移动收藏成功",
            "data": self.get_serializer(instance).data
        }, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="取消收藏",
        responses={204: openapi.Response(description="取消收藏成功")}
    )
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"code": 204, "message": "取消收藏成功"}, status=status.HTTP_204_NO_CONTENT)

    @swagger_auto_schema(
        operation_summary="批量移动收藏到指定收藏夹",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['favorite_ids'],
            properties={
                'favorite_ids': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Items(type=openapi.TYPE_INTEGER),
                    description='要移动的收藏记录ID列表'
                ),
                'folder': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='目标收藏夹ID，可为空（移出收藏夹）'
                )
            }
        ),
        responses={
            200: openapi.Response(
                description="批量移动成功",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "code": openapi.Schema(type=openapi.TYPE_INTEGER),
                        "message": openapi.Schema(type=openapi.TYPE_STRING),
                        "data": openapi.Schema(
                            type=openapi.TYPE_ARRAY,
                            items=openapi.Items(type=openapi.TYPE_OBJECT)
                        )
                    }
                )
            ),
            400: openapi.Response(description="参数错误")
        }
    )
    @action(detail=False, methods=['post'])
    def move_to_folder(self, request):
        favorite_ids = request.data.get('favorite_ids', [])
        folder_id = request.data.get('folder')

        if not isinstance(favorite_ids, list) or not all(isinstance(i, int) for i in favorite_ids):
            return Response({"code": 400, "message": "favorite_ids 必须是整数列表"}, status=400)

        folder = None
        if folder_id not in (None, "", "null"):
            try:
                folder = FavoriteFolder.objects.get(id=folder_id, user=request.user)
            except FavoriteFolder.DoesNotExist:
                return Response({"code": 400, "message": "收藏夹不存在"}, status=400)

        favorites = Favorite.objects.filter(user=request.user, id__in=favorite_ids)
        favorites.update(folder=folder)

        serializer = self.get_serializer(favorites, many=True)
        return Response({
            "code": 200,
            "message": "批量移动收藏成功",
            "data": serializer.data
        })


class CommentViewSet(viewsets.ModelViewSet):
    """
    用户评论作品接口
    - GET: 获取评论列表（可筛选 gamework）
    - POST: 评论作品或回复
    - DELETE: 删除评论
    """
    http_method_names = ['get', 'post', 'delete']
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        gamework_id = self.request.query_params.get('gamework')
        queryset = (Comment.objects
            .select_related('user', 'gamework')
            .annotate(like_count=Count('likes', distinct=True))
        )
            
        if user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'likes',
                    queryset=CommentLike.objects.filter(user=user),
                    to_attr='user_likes'
                )
            )    
        
        if gamework_id:
            queryset = queryset.filter(gamework_id=gamework_id, parent__isnull=True)  # 顶级评论分页
        else:
            queryset = queryset.filter(parent__isnull=True)
        return queryset.order_by('-created_at')

    @swagger_auto_schema(
        operation_summary="获取评论列表（分页顶级评论+嵌套回复）",
        manual_parameters=[
            openapi.Parameter(
                'gamework', openapi.IN_QUERY,
                description="按作品ID筛选评论",
                type=openapi.TYPE_INTEGER,
                example=5,
                required=False
            )
        ]
    )
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)

        data = {
            "code": 200,
            "message": "获取评论列表成功",
            "data": serializer.data
        }
        return self.get_paginated_response(data) if page else Response(data)

    @swagger_auto_schema(
        operation_summary="发表评论或回复",
        request_body=CommentSerializer,
        responses={200: CommentSerializer}
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            "code": 201,
            "message": "评论发布成功",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_summary="点赞评论",
        request_body=no_body,
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "code": openapi.Schema(type=openapi.TYPE_INTEGER),
                    "message": openapi.Schema(type=openapi.TYPE_STRING),
                    "data": openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            "liked": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                            "like_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    ),
                },
            )
        }
    )
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        like, created = CommentLike.objects.get_or_create(user=user, comment=comment)

        return Response({
            "code": 200,
            "message": "点赞成功" if created else "已经点赞过",
            "data": {
                "liked": True,
                "like_count": comment.likes.count()
            }
        })

    @swagger_auto_schema(
        operation_summary="取消点赞评论",
        request_body=no_body,
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    "code": openapi.Schema(type=openapi.TYPE_INTEGER),
                    "message": openapi.Schema(type=openapi.TYPE_STRING),
                    "data": openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            "liked": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                            "like_count": openapi.Schema(type=openapi.TYPE_INTEGER),
                        },
                    ),
                },
            )
        }
    )
    @action(detail=True, methods=['post'])
    def unlike(self, request, pk=None):
        comment = self.get_object()
        user = request.user

        CommentLike.objects.filter(user=user, comment=comment).delete()

        return Response({
            "code": 200,
            "message": "取消点赞成功",
            "data": {
                "liked": False,
                "like_count": comment.likes.count()
            }
        })



class RatingViewSet(viewsets.ModelViewSet):
    """
    用户评分作品接口
    - GET: 获取评分列表
    - POST: 为作品评分
    """
    http_method_names = ['get', 'post', 'delete']
    serializer_class = RatingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Rating.objects.all().select_related('gamework', 'user')
        gid = self.request.query_params.get('gamework')
        if gid:
            qs = qs.filter(gamework__id=gid)
        return qs

    @swagger_auto_schema(
        operation_summary="为作品评分",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['id', 'score'],
            properties={
                'id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID'),
                'score': openapi.Schema(type=openapi.TYPE_INTEGER, description='评分（2~10）')
            }
        )
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.save()
        average_score = Rating.objects.filter(gamework=rating.gamework).aggregate(Avg('score'))['score__avg']
        return Response({
            "code": 201,
            "message": "评分成功",
            "average_score": average_score,
            "data": self.get_serializer(rating).data
        }, status=status.HTTP_201_CREATED)