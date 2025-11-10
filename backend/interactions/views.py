from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from .models import Favorite, Comment, Rating
from .serializers import FavoriteSerializer, CommentSerializer, RatingSerializer
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.db.models import Avg

class FavoriteViewSet(viewsets.ModelViewSet):
    """
    用户收藏作品接口
    - GET: 获取当前用户收藏列表
    - POST: 收藏作品（传入 id）
    - DELETE: 取消收藏
    """
    http_method_names = ['get', 'post', 'delete']
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Favorite.objects.none()
        return Favorite.objects.filter(user=self.request.user).select_related('gamework')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
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
            properties={'id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID')}
        ),
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"code": 204, "message": "取消收藏成功"}, status=status.HTTP_204_NO_CONTENT)


class CommentViewSet(viewsets.ModelViewSet):
    """
    用户评论作品接口
    - GET: 获取评论列表（可筛选 gamework）
    - POST: 评论作品
    """
    http_method_names = ['get', 'post', 'delete']
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Comment.objects.all().select_related('gamework', 'user')
        gid = self.request.query_params.get('gamework')
        if gid:
            qs = qs.filter(gamework__id=gid)
        return qs

    @swagger_auto_schema(
        operation_summary="评论作品",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['id', 'content'],
            properties={
                'id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID'),
                'content': openapi.Schema(type=openapi.TYPE_STRING, description='评论内容')
            }
        )
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        return Response({
            "code": 201,
            "message": "评论成功",
            "data": self.get_serializer(comment).data
        }, status=status.HTTP_201_CREATED)


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