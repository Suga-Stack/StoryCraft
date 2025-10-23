from rest_framework import serializers
from .models import Gamework
from tags.serializers import TagSerializer
from tags.models import Tag

class GameworkSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)  # 显示 author 的 __str__
    tags = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), many=True, required=False)

    class Meta:
        model = Gamework
        fields = ('gamework_id', 'author', 'title', 'description', 'tags', 'image_url', 'created_at', 'updated_at')

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
