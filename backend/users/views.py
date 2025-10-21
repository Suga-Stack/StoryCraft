from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.core.mail import send_mail
from django.core.cache import cache
from django.utils.crypto import get_random_string
from .serializers import RegisterSerializer, LoginSerializer, LogoutSerializer, UserPreferenceSerializer

User = get_user_model()

'''
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
'''

class SendEmailCodeView(APIView):
    """发送邮箱验证码"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        operation_description="发送邮箱验证码",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'email': openapi.Schema(type=openapi.TYPE_STRING, description='邮箱地址'),
            },
            required=['email']
        ),
        responses={200: "验证码已发送"}
    )

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'code': 400, 'message': '邮箱不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        code = get_random_string(length=6, allowed_chars='0123456789')
        cache.set(f'verify_code_{email}', code, timeout=300)  # 验证码有效期5分钟

        try:
            send_mail(
                subject="您的注册验证码",
                message=f"您的验证码是 {code}，5分钟内有效。",
                from_email="storycraft@163.com",
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            return Response({'code': 500, 'message': f'邮件发送失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'code': 200, 'message': '验证码已发送'}, status=status.HTTP_200_OK)
        

class RegisterView(APIView):
    """注册接口"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        request_body=RegisterSerializer,
        responses={200: "注册成功"}
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'code': 200, 'message': '注册成功'}, status=status.HTTP_201_CREATED)
        return Response({'code': 400, 'message': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """登录接口"""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @swagger_auto_schema(
        request_body=LoginSerializer,
        responses={200: "登录成功"}
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = serializer.get_tokens_for_user(user)
            return Response({'code': 200, 'message': '登录成功', 'tokens': tokens}, status=status.HTTP_200_OK)
        return Response({'code': 400, 'message': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """登出接口"""
    @swagger_auto_schema(
        request_body=LogoutSerializer,
        responses={200: "登出成功"}
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'code': 200, 'message': '登出成功'}, status=status.HTTP_200_OK)
        return Response({'code': 400, 'message': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


'''
class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = UserSerializer(request.user).data
        return Response({'code': 200, 'data': {'user': data}})
'''

class UserPreferenceView(generics.RetrieveUpdateAPIView):
    serializer_class = UserPreferenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        # 只允许操作自己的数据
        return self.request.user