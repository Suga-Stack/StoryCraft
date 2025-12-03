from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from tags.models import Tag
from .models import CreditLog, GameworkReport, CommentReport

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'profile_picture', 'user_credits', 'gender', 'liked_tags', 'is_staff')
        read_only_fields = ('user_credits', 'is_staff')


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField(write_only=True)
    email_code = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'confirm_password', 'email', 'email_code']

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        email = attrs.get('email')
        email_code = attrs.get('email_code')

        if password != confirm_password:
            raise serializers.ValidationError({'message': '两次输入的密码不一致'})

        # 校验用户名是否已存在
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'message': '用户名已存在'})

        # 校验邮箱验证码（Redis 或缓存读取）
        cache_key = f'verify_code_{email}'
        real_code = cache.get(cache_key)
        if not real_code or real_code != email_code:
            raise serializers.ValidationError({'message': '邮箱验证码错误或已过期'})

        # 校验密码强度
        validate_password(password)

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        validated_data.pop('email_code')
        email = validated_data.pop('email')
        password = validated_data.pop('password')

        user = User.objects.create(
            username=validated_data['username'],
            email=email, 
            password=make_password(password),
            is_staff=False
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if not username or not password:
            raise serializers.ValidationError({'message': '请填写用户名和密码'})

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError({'message': '用户不存在'})

        from django.contrib.auth.hashers import check_password
        if not check_password(password, user.password):
            raise serializers.ValidationError({'message': '密码错误'})

        if not user.is_active:
            raise serializers.ValidationError({'message': '账号已被禁用'})

        attrs['user'] = user
        return attrs


    def get_tokens_for_user(self, user):
        """生成 JWT token"""
        refresh = RefreshToken.for_user(user)
        user_serializer = UserSerializer(user) 
        user_data = user_serializer.data 
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": user_data
        }


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate(self, attrs):
        self.token = attrs['refresh']
        return attrs

    def save(self, **kwargs):
        try:
            token = RefreshToken(self.token)
            token.blacklist()  # 加入黑名单
        except TokenError:
            raise ValidationError({'message': '无效的token'})

class UserPreferenceSerializer(serializers.ModelSerializer):
    liked_tags = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True)

    class Meta:
        model = User
        fields = ['gender', 'liked_tags']

    def update(self, instance, validated_data):
        """覆盖原有偏好"""
        tag_names = validated_data.pop('liked_tags', None)
        gender = validated_data.get('gender', None)

        if tag_names is not None:
            tags_qs = Tag.objects.filter(name__in=tag_names)
            instance.liked_tags.set(tags_qs)
        if gender is not None:
            instance.gender = gender

        instance.save()
        return instance
    
class CreditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditLog
        fields = ['change_amount', 'before_balance', 'after_balance', 'type', 'remark', 'created_at']

class GameworkReportSerializer(serializers.ModelSerializer):
    reporter = serializers.ReadOnlyField(source='reporter.username')
    gamework_title = serializers.ReadOnlyField(source='gamework.title')

    class Meta:
        model = GameworkReport
        fields = ['id', 'reporter', 'gamework', 'gamework_title', 'tag', 'remark', 'created_at', 'is_resolved']
        read_only_fields = ['reporter', 'created_at', 'is_resolved', 'gamework_title']

class CommentReportSerializer(serializers.ModelSerializer):
    reporter = serializers.ReadOnlyField(source='reporter.username')
    comment_content = serializers.ReadOnlyField(source='comment.content')

    class Meta:
        model = CommentReport
        fields = ['id', 'reporter', 'comment', 'comment_content', 'tag', 'remark', 'created_at', 'is_resolved']
        read_only_fields = ['reporter', 'created_at', 'is_resolved', 'comment_content']