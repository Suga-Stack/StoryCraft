from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.core.mail import send_mail
from django.core.cache import cache
from django.utils.crypto import get_random_string
from django.shortcuts import get_object_or_404
from game.models import GameSave
from gameworks.models import Gamework
from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, LogoutSerializer, UserPreferenceSerializer
from gameworks.serializers import GameworkSimpleSerializer
from interactions.models import ReadRecord
from django.utils import timezone
from datetime import date, timedelta
from .utils import get_signin_reward
from .models import UserSignIn

User = get_user_model()

class IsAdminOrSelf(permissions.BasePermission):
    """
    只允许管理员或自己操作自己的资料
    """
    def has_object_permission(self, request, view, obj):
        # 只有管理员或者自己才能访问自己的资料
        return request.user == obj or request.user.is_staff


class UserViewSet(viewsets.ModelViewSet):
    """
    用户管理接口：
    支持查看用户列表、更新、删除。
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrSelf]
    lookup_field = 'id'

    def get_queryset(self):
        """
        普通用户仅能查看自己，管理员可查看所有
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return User.objects.all()
        return User.objects.filter(id=user.id)
    
    def list(self, request, *args, **kwargs):
        """
        查看用户列表
        普通用户只能看到自己，管理员可以看到所有用户
        """
        queryset = self.get_queryset()
        if not request.user.is_staff and queryset.count() > 1:
            return Response({'detail': '您没有权限查看其他用户的数据。'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        """
        查看用户详情
        普通用户只能查看自己的详情，管理员可以查看任何用户
        """
        instance = self.get_object()
        if instance != request.user and not request.user.is_staff:
            return Response({"detail": "您没有查看该用户资料的权限。"}, status=status.HTTP_403_FORBIDDEN)
        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """
        禁止用户修改他人资料
        """
        instance = self.get_object()
        if instance != request.user and not request.user.is_staff:
            return Response({"detail": "您没有修改该用户资料的权限。"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """
        禁止用户部分修改他人资料
        """
        instance = self.get_object()
        if instance != request.user and not request.user.is_staff:
            return Response({"detail": "您没有修改该用户资料的权限。"}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        删除用户
        普通用户只能删除自己，管理员可以删除任何用户
        """
        instance = self.get_object()
        if instance != request.user and not request.user.is_staff:
            return Response({"detail": "您没有删除该用户的权限。"}, status=status.HTTP_403_FORBIDDEN)        
        return super().destroy(request, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        """
        禁用 POST 请求，禁止通过 UserViewSet 创建用户
        """
        return Response({"detail": "用户注册只能通过注册接口进行！"}, status=status.HTTP_403_FORBIDDEN)

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
    
class ReadGameworkListView(APIView):
    """
    获取、记录或删除当前用户读过的作品
    GET: 返回当前用户所有读过的作品
    POST: 用户阅读作品时调用，记录阅读行为
    DELETE: 隐藏某条或全部阅读记录
    """
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="获取当前用户读过的作品",
        responses={
            200: openapi.Response(
                description="用户读过的作品列表",
                schema=GameworkSimpleSerializer
            )
        }
    )
    def get(self, request):
        user = request.user
        read_records = ReadRecord.objects.filter(user=user,is_visible=True).select_related('gamework').order_by('-read_at')
        gameworks = [r.gamework for r in read_records]
        serializer = GameworkSimpleSerializer(gameworks, many=True)
        return Response({'code': 200, 'data': serializer.data}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="记录用户阅读作品",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'gamework_id': openapi.Schema(type=openapi.TYPE_INTEGER, description='作品ID'),
            },
            required=['gamework_id']
        ),
        responses={
            200: openapi.Response(description='记录成功'),
            400: openapi.Response(description='参数错误或作品不存在')
        }
    )
    def post(self, request):
        user = request.user
        gamework_id = request.data.get('gamework_id')

        if not gamework_id:
            return Response({'code': 400, 'message': 'gamework_id 不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            gamework = Gamework.objects.get(pk=gamework_id)
        except Gamework.DoesNotExist:
            return Response({'code': 400, 'message': '作品不存在'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取或创建阅读记录
        obj, created = ReadRecord.objects.get_or_create(
            user=user,
            gamework=gamework,
            defaults={'is_visible': True}
        )

        if not created and not obj.is_visible:
            obj.is_visible = True

        # 若未付费 & 价格>0，则扣费
        if not obj.has_paid and gamework.price > 0:
            # 用户积分不足
            if (user.user_credits or 0) < gamework.price:
                return Response({'code': 400, 'message': '积分不足，无法阅读该作品'}, status=status.HTTP_400_BAD_REQUEST)

            # 扣积分
            user.user_credits -= gamework.price
            user.save()

            obj.has_paid = True

        # 更新阅读时间
        obj.read_at = timezone.now()
        obj.save()

        return Response({'code': 200, 'message': '阅读记录已创建或更新'}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="隐藏当前用户读过的作品记录",
        manual_parameters=[
            openapi.Parameter(
                'gamework_ids_param', openapi.IN_QUERY, description="要删除的作品ID列表，不传则删除所有", type=openapi.TYPE_INTEGER
            )
        ],
        responses={200: openapi.Response(description="删除成功")}
    )
    def delete(self, request):
        user = request.user
        gamework_ids_param = request.query_params.get('gamework_ids')
        
        if gamework_ids_param:
            # 支持传入多个作品ID，用逗号分隔
            try:
                gamework_ids = [int(x) for x in gamework_ids_param.split(',') if x.strip()]
            except ValueError:
                return Response({'code': 400, 'message': 'gamework_ids 参数格式错误'}, status=status.HTTP_400_BAD_REQUEST)

            # 只隐藏阅读记录，不删除
            updated = ReadRecord.objects.filter(
                user=user,
                gamework_id__in=gamework_ids,
                is_visible=True
            ).update(is_visible=False)

            return Response({'code': 200, 'message': f'隐藏 {updated} 条记录'}, status=status.HTTP_200_OK)

        # 不传参数 → 隐藏所有阅读记录
        updated = ReadRecord.objects.filter(user=user, is_visible=True).update(is_visible=False)
        return Response({'code': 200, 'message': f'隐藏 {updated} 条记录'}, status=status.HTTP_200_OK)
    
class RecentReadGameworksView(APIView):
    """
    获取当前用户最近读过的两部作品
    路径：GET /api/users/read/recent/
    """
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="获取最近两部读过的作品",
        responses={
            200: openapi.Response(
                description='返回最近两部用户读过的作品',
                schema=GameworkSimpleSerializer
            )
        }
    )
    def get(self, request):
        user = request.user
        read_records = (
            ReadRecord.objects
            .filter(user=user,is_visible=True)
            .select_related('gamework')
            .order_by('-read_at')[:2]  # 取最近两条记录
        )
        gameworks = [r.gamework for r in read_records]
        serializer = GameworkSimpleSerializer(gameworks, many=True)
        return Response({'code': 200, 'data': serializer.data}, status=status.HTTP_200_OK)

class MyGameworkListView(APIView):
    """
    返回当前登录用户创作的作品列表
    GET /api/users/myworks/
    """
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="获取当前用户创作的作品列表",
        responses={
            200: openapi.Response(
                description='当前用户创作的作品列表',
                schema=GameworkSimpleSerializer
            )
        }
    )
    def get(self, request):
        user = request.user
        works = Gamework.objects.filter(author=user).order_by('-created_at')
        serializer = GameworkSimpleSerializer(works, many=True)
        return Response({'code': 200, 'data': serializer.data}, status=status.HTTP_200_OK)
    
class RecentMyGameworksView(APIView):
    """
    返回当前用户最近创作的两部作品
    GET /api/users/my-works/recent/
    """
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="获取当前用户最近创作的两部作品",
        responses={
            200: openapi.Response(
                description='最近两部创作的作品',
                schema=GameworkSimpleSerializer
            )
        }
    )
    def get(self, request):
        user = request.user
        works = Gamework.objects.filter(author=user).order_by('-created_at')[:2]
        serializer = GameworkSimpleSerializer(works, many=True)
        return Response({'code': 200, 'data': serializer.data}, status=200)
    
class UserSignInView(APIView):
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_summary="用户签到",
        operation_description=(
            "用户每日签到接口。\n\n"
            "功能：\n"
            "- 判断今日是否已经签到\n"
            "- 自动计算连续签到天数（断签重置为1）\n"
            "- 根据连续天数发放积分（1~7天循环）\n"
            "- 更新用户积分 user_credits\n"
        ),

        responses={
            status.HTTP_200_OK: openapi.Response(
                description="签到成功 / 今日已签到",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "message": openapi.Schema(type=openapi.TYPE_STRING, description="签到结果提示"),
                        "continuous_days": openapi.Schema(type=openapi.TYPE_INTEGER, description="连续签到天数"),
                        "reward": openapi.Schema(type=openapi.TYPE_INTEGER, description="本次获取积分"),
                        "credits": openapi.Schema(type=openapi.TYPE_INTEGER, description="当前用户积分"),
                    }
                )
            ),
            status.HTTP_401_UNAUTHORIZED: openapi.Response(
                description="未登录或 token 无效",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        "detail": openapi.Schema(type=openapi.TYPE_STRING, description="错误信息")
                    }
                )
            ),
        },
    )
    def post(self, request):
        user = request.user

        # 获取或创建签到记录
        signin_record, created = UserSignIn.objects.get_or_create(user=user)

        today = date.today()
        yesterday = today - timedelta(days=1)

        last_date = signin_record.last_signin_date

        # 已经签到
        if last_date == today:
            return Response({
                "message": "今日已签到",
                "continuous_days": signin_record.continuous_days,
                "reward": 0,
                "credits": user.user_credits
            })

        # 连续签到判断
        if last_date == yesterday:
            signin_record.continuous_days += 1
        else:
            signin_record.continuous_days = 1  # 断签重置为第1天

        # 计算奖励
        reward = get_signin_reward(signin_record.continuous_days)

        # 写入签到记录
        signin_record.last_signin_date = today
        signin_record.save()

        # 增加用户积分
        user.user_credits = (user.user_credits or 0) + reward
        user.save()

        return Response({
            "message": "签到成功",
            "continuous_days": signin_record.continuous_days,
            "reward": reward,
            "credits": user.user_credits
        })

class RechargeViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="积分充值",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'credits': openapi.Schema(type=openapi.TYPE_INTEGER, description="充值积分数量")
            },
            required=['credits']
        ),
        responses={200: "充值成功"}
    )
    def create(self, request):
        credits = request.data.get("credits")
        try:
            credits = int(credits)
        except:
            return Response({"code": 400, "message": "credits 必须为整数"}, status=400)

        if credits <= 0:
            return Response({"code": 400, "message": "充值积分必须大于 0"}, status=400)

        user = request.user
        user.user_credits += credits
        user.save()

        return Response({
            "code": 200,
            "message": "充值成功",
            "new_credits": user.user_credits
        }, status=200)

class SaveDetailView(APIView):
    """
    存档详情：PUT 保存/更新；GET 读取；DELETE 删除
    路径：
      - PUT    /api/users/:userId/saves/:workId/:slot
      - GET    /api/users/:userId/saves/:workId/:slot
      - DELETE /api/users/:userId/saves/:workId/:slot
    """
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_permission(self, request, userId: int):
        if (request.user.id != userId) and (not request.user.is_staff):
            return Response({'detail': '无权限操作该用户的存档'}, status=status.HTTP_403_FORBIDDEN)

    def _get_target(self, userId: int, workId: int):
        User = get_user_model()
        target_user = get_object_or_404(User, pk=userId)
        gamework = get_object_or_404(Gamework, pk=workId)
        return target_user, gamework

    @swagger_auto_schema(
        operation_summary="保存或更新存档",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'data': openapi.Schema(type=openapi.TYPE_OBJECT, description='需持久化的完整存档对象'),
            },
            required=['data']
        ),
        responses={200: openapi.Response(description="{\"ok\": true}")}
    )
    def put(self, request, userId: int, workId: int, slot: str):
        perm = self._ensure_permission(request, userId)
        if perm: return perm

        payload = request.data or {}
        data = payload.get('data')
        if not isinstance(data, dict):
            return Response({'detail': 'data 字段必须为对象'}, status=status.HTTP_400_BAD_REQUEST)

        target_user, gamework = self._get_target(userId, workId)

        # 兼容从 data.work.coverUrl 中抽取缩略图
        thumbnail = None
        work_info = data.get('work')
        if isinstance(work_info, dict):
            thumbnail = work_info.get('coverUrl')

        obj, _ = GameSave.objects.update_or_create(
            user=target_user,
            gamework=gamework,
            name=slot,
            defaults={
                'game_state': data,
                'thumbnail': thumbnail
            }
        )
        return Response({"ok": True}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="读取存档",
        responses={
            200: openapi.Response(description='{"data": {...}}'),
            404: openapi.Response(description='未找到')
        }
    )
    def get(self, request, userId: int, workId: int, slot: str):
        perm = self._ensure_permission(request, userId)
        if perm: return perm

        target_user, gamework = self._get_target(userId, workId)
        try:
            save = GameSave.objects.get(user=target_user, gamework=gamework, name=slot)
        except GameSave.DoesNotExist:
            return Response({'detail': '存档不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": save.game_state}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="删除存档",
        responses={200: openapi.Response(description='{"ok": true}')}
    )
    def delete(self, request, userId: int, workId: int, slot: str):
        perm = self._ensure_permission(request, userId)
        if perm: return perm

        target_user, gamework = self._get_target(userId, workId)
        GameSave.objects.filter(user=target_user, gamework=gamework, name=slot).delete()
        return Response({"ok": True}, status=status.HTTP_200_OK)


class SaveListView(APIView):
    """
    列出某作品所有槽位摘要
    路径：GET /api/users/:userId/saves/:workId
    """
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="列出作品下全部存档摘要",
        responses={200: openapi.Response(description='{"saves": [...]}')}
    )
    def get(self, request, userId: int, workId: int):
        if (request.user.id != userId) and (not request.user.is_staff):
            return Response({'detail': '无权限操作该用户的存档'}, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        target_user = get_object_or_404(User, pk=userId)
        gamework = get_object_or_404(Gamework, pk=workId)

        saves = GameSave.objects.filter(user=target_user, gamework=gamework).order_by('-updated_at')
        items = []
        for s in saves:
            state = s.game_state or {}
            ts = state.get('timestamp')
            if not ts:
                # 使用后端更新时间作为兜底，转毫秒时间戳
                ts = int(s.updated_at.timestamp() * 1000)
            items.append({
                "slot": s.name,
                "timestamp": ts,
                "chapterIndex": state.get("chapterIndex"),
                "sceneId": state.get("sceneId"),
                "dialogueIndex": state.get("dialogueIndex"),
            })
        return Response({"saves": items}, status=status.HTTP_200_OK)