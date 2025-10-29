from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from .models import Favorite, Comment, Rating
from .serializers import FavoriteSerializer, CommentSerializer, RatingSerializer
from .permissions import IsOwnerOrReadOnly
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from gameworks.models import Gamework

class FavoriteViewSet(viewsets.ModelViewSet):
    """
    用户收藏作品接口
    - GET: 获取当前用户收藏列表
    - POST: 收藏作品
    - DELETE: 取消收藏（支持通过作品ID取消）
    """
    http_method_names = ['get', 'post', 'delete']
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """只返回当前登录用户的收藏"""
        return Favorite.objects.filter(user=self.request.user).select_related('gamework')

    def list(self, request, *args, **kwargs):
        """GET /favorites/ 获取当前用户收藏列表"""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)  # 启用分页

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                "code": 200,
                "message": "获取收藏列表成功",
                "data": serializer.data
            })

        # 如果未启用分页
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "code": 200,
            "message": "获取收藏列表成功",
            "data": serializer.data
        })


    @swagger_auto_schema(
        operation_summary="收藏作品",
        operation_description="用户收藏一个作品（仅传入gamework_id）",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['gamework_id'],
            properties={
                'gamework_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID')
            }
        ),
        responses={
            201: openapi.Response('收藏成功', FavoriteSerializer),
            400: '该作品已收藏'
        }
    )
    def create(self, request, *args, **kwargs):
        gamework_id = request.data.get("gamework_id")
        if not gamework_id:
            return Response({"code": 400, "message": "缺少参数 gamework_id"}, status=status.HTTP_400_BAD_REQUEST)

        # 检查是否已收藏
        if Favorite.objects.filter(user=request.user, gamework_id=gamework_id).exists():
            return Response({"code": 400, "message": "该作品已收藏"}, status=status.HTTP_400_BAD_REQUEST)

        # 创建收藏记录
        favorite = Favorite.objects.create(user=request.user, gamework_id=gamework_id)
        serializer = self.get_serializer(favorite)

        return Response({
            "code": 201,
            "message": "收藏成功",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_summary="取消收藏",
        operation_description="按收藏ID取消收藏，如 DELETE /favorites/<id>/",
        responses={
            204: openapi.Response('取消收藏成功'),
            404: openapi.Response('收藏不存在'),
        }
    )
    def destroy(self, request, *args, **kwargs):
        """DELETE /favorites/<id>/ 按收藏ID取消收藏"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"code": 204, "message": "取消收藏成功"}, status=status.HTTP_204_NO_CONTENT)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_queryset(self):
        qs = Comment.objects.all()
        gamework_id = self.request.query_params.get('gamework')
        if gamework_id:
            qs = qs.filter(gamework__gamework_id=gamework_id)
        return qs


class RatingViewSet(viewsets.ModelViewSet):
    queryset = Rating.objects.all()
    serializer_class = RatingSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def perform_create(self, serializer):
        # 如果用户已评分则更新而不是创建（保持 unique_together）
        user = self.request.user
        gamework = serializer.validated_data['gamework']
        obj, created = Rating.objects.update_or_create(user=user, gamework=gamework, defaults={'score': serializer.validated_data['score']})
        self._created = created
        self._obj = obj

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # 返回当前作品的平均评分（示例）
        obj = self._obj
        headers = self.get_success_headers(serializer.data)
        return Response(RatingSerializer(obj).data, status=status.HTTP_200_OK, headers=headers)

    def get_queryset(self):
        qs = Rating.objects.all()
        gamework_id = self.request.query_params.get('gamework')
        if gamework_id:
            qs = qs.filter(gamework__gamework_id=gamework_id)
        return qs