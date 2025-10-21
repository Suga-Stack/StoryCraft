from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from .models import Favorite, Comment, Rating
from .serializers import FavoriteSerializer, CommentSerializer, RatingSerializer
from .permissions import IsOwnerOrReadOnly
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404

class FavoriteViewSet(viewsets.ModelViewSet):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        # 返回当前用户的收藏列表或所有（管理）
        user = self.request.user
        return Favorite.objects.filter(user=user)

    def perform_create(self, serializer):
        # 防止重复收藏（模型已有 unique_together）
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        # 支持按 PK 删除；也可实现按 gamework_id 取消收藏
        return super().destroy(request, *args, **kwargs)

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