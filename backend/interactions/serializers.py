from rest_framework import serializers
from .models import Favorite, Comment, Rating, FavoriteFolder
from gameworks.models import Gamework
from django.contrib.auth import get_user_model

User = get_user_model()

class FavoriteFolderSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False, allow_blank=True)
    favorites_count = serializers.IntegerField(source='favorites.count', read_only=True)

    class Meta:
        model = FavoriteFolder
        fields = ('id', 'name', 'favorites_count', 'created_at')

    def create(self, validated_data):
        user = self.context['request'].user
        return FavoriteFolder.objects.create(user=user, **validated_data)


class FavoriteSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework_id = serializers.PrimaryKeyRelatedField(
        source='gamework',  # 输入字段“id”映射到模型的 gamework 外键
        queryset=Gamework.objects.filter(is_published=True),
        write_only=True
    )
    folder = serializers.PrimaryKeyRelatedField(
        queryset=FavoriteFolder.objects.all(), allow_null=True, required=False
    )
    gamework_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'gamework_id', 'gamework_detail', 'folder', 'created_at')

    def validate_folder(self, folder):
        """确保收藏夹属于当前用户"""
        user = self.context['request'].user
        if folder and folder.user != user:
            raise serializers.ValidationError("不能将作品添加到他人的收藏夹")
        return folder

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
        folder = validated_data.get('folder')
        favorite, created = Favorite.objects.get_or_create(
            user=user, gamework=gamework,
            defaults={'folder': folder}
        )
        if not created:
            raise serializers.ValidationError("该作品已收藏")
        return favorite


class RecursiveField(serializers.Serializer):
    """支持多层递归嵌套的通用字段"""
    def to_representation(self, value):
        serializer = self.parent.parent.__class__(value, context=self.context)
        return serializer.data
    

class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    replies = RecursiveField(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'user', 'content', 'gamework', 'created_at', 'replies', 'parent')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


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