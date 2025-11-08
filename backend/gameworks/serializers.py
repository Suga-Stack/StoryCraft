from rest_framework import serializers
from .models import Gamework
from tags.serializers import TagSerializer
from tags.models import Tag

class GameworkSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)  # 显示 author 的 __str__
    tags = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True, required=False)
    favorite_count = serializers.IntegerField(read_only=True)  # 收藏数量字段
    average_score = serializers.FloatField(read_only=True)  # 平均评分

    class Meta:
        model = Gamework
        fields = ('id', 'author', 'title', 'description', 'tags', 'image_url', 'is_published', 'created_at', 'updated_at', 'published_at', 'favorite_count', 'average_score')

    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        game = Gamework.objects.create(**validated_data)
        if tags:
            game.tags.set(tags)
        return game

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if tags is not None:
            instance.tags.set(tags)
        return instance