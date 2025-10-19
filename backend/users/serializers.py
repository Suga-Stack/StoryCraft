from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('user_id', 'user_name', 'phone_number', 'profile_picture', 'user_credits', 'gender', 'liked_tags')
        read_only_fields = ('user_id', 'user_credits')

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=6)

    class Meta:
        model = User
        fields = ('user_name', 'password', 'phone_number', 'profile_picture', 'gender')

    def create(self, validated_data):
        # 加密并创建
        password = validated_data.pop('password')
        validated_data['password_hash'] = make_password(password)
        return User.objects.create(**validated_data)
