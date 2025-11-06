from rest_framework import serializers
from .models import Favorite, Comment, Rating
from gameworks.models import Gamework
from django.contrib.auth import get_user_model

User = get_user_model()

class FavoriteSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    id = serializers.PrimaryKeyRelatedField(
        source='gamework',  # 输入字段“id”映射到模型的 gamework 外键
        queryset=Gamework.objects.filter(is_published=True),
        write_only=True
    )
    gamework_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'gamework_detail', 'created_at')

    def get_gamework_detail(self, obj):
        g = obj.gamework
        return {
            "id": g.id,
            "title": g.title,
            "author": g.author.username if g.author else None,
            "cover": g.cover.url if getattr(g, 'cover', None) else None,
        }

    def create(self, validated_data):
        user = self.context['request'].user
        gamework = validated_data['gamework']
        favorite, created = Favorite.objects.get_or_create(user=user, gamework=gamework)
        if not created:
            raise serializers.ValidationError("该作品已收藏")
        return favorite

class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    id = serializers.PrimaryKeyRelatedField(
        source='gamework',
        queryset=Gamework.objects.filter(is_published=True),
        write_only=True
    )
    gamework_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'user', 'content', 'gamework_detail', 'created_at', 'updated_at')

    def get_gamework_detail(self, obj):
        g = obj.gamework
        return {
            "id": g.id,
            "title": g.title,
            "author": g.author.username if g.author else None,
            "cover": g.cover.url if getattr(g, 'cover', None) else None,
        }

    def create(self, validated_data):
        user = self.context['request'].user
        gamework = validated_data['gamework']
        content = validated_data['content']
        comment = Comment.objects.create(user=user, gamework=gamework, content=content)
        return comment

class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    id = serializers.PrimaryKeyRelatedField(
        source='gamework',
        queryset=Gamework.objects.filter(is_published=True),
        write_only=True
    )
    score = serializers.IntegerField(min_value=2, max_value=10)
    gamework_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Rating
        fields = ('id', 'user', 'score', 'gamework_detail', 'created_at', 'updated_at')

    def get_gamework_detail(self, obj):
        g = obj.gamework
        return {
            "id": g.id,
            "title": g.title,
            "author": g.author.username if g.author else None,
            "cover": g.cover.url if getattr(g, 'cover', None) else None,
        }

    def create(self, validated_data):
        user = self.context['request'].user
        gamework = validated_data['gamework']
        score = validated_data['score']
        rating, created = Rating.objects.update_or_create(
            user=user, gamework=gamework,
            defaults={'score': score}
        )
        return rating