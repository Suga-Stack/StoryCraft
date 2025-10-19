from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, UserRegisterSerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """
    用户管理接口：
    支持查看用户列表、详情、更新、删除。
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user_id'

    def get_queryset(self):
        """
        普通用户仅能查看自己，管理员可查看所有
        """
        user = self.request.user
        if user.is_staff:
            return User.objects.all()
        return User.objects.filter(user_id=user.user_id)

    def update(self, request, *args, **kwargs):
        """
        禁止用户修改他人资料
        """
        instance = self.get_object()
        if instance != request.user and not request.user.is_staff:
            return Response({"detail": "You do not have permission to edit this user."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class UserRegisterView(generics.CreateAPIView):
    """
    用户注册接口
    """
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        """
        注册成功后返回部分用户信息（不返回密码）
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # 使用 UserSerializer 返回干净数据
        user_data = UserSerializer(user).data
        headers = self.get_success_headers(serializer.data)
        return Response(user_data, status=status.HTTP_201_CREATED, headers=headers)