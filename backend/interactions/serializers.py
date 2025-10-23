from rest_framework import serializers
from .models import Favorite, Comment, Rating
from gameworks.models import Gamework

class FavoriteSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework = serializers.PrimaryKeyRelatedField(
        queryset=Gamework.objects.all(), write_only=True
    )
    gamework_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'gamework', 'gamework_detail', 'created_at')

    def get_gamework_detail(self, obj):
        """返回被收藏作品的简要信息"""
        return {
            "id": obj.gamework.id,
            "title": obj.gamework.title,
            "author": obj.gamework.author.username if obj.gamework.author else None,
            "cover": obj.gamework.cover.url if hasattr(obj.gamework, 'cover') and obj.gamework.cover else None,
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
    gamework = serializers.PrimaryKeyRelatedField(queryset=Gamework.objects.all())

    class Meta:
        model = Comment
        fields = ('id', 'user', 'gamework', 'content', 'created_at', 'updated_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from gameworks.models import Gamework
        self.fields['gamework'].queryset = Gamework.objects.all()

    def create(self, validated_data):
        # user 由 view 中注入
        return super().create(validated_data)

class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework = serializers.PrimaryKeyRelatedField(queryset=Gamework.objects.all())
    score = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Rating
        fields = ('id', 'user', 'gamework', 'score', 'created_at', 'updated_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from gameworks.models import Gamework
        self.fields['gamework'].queryset = Gamework.objects.all()

    def validate(self, attrs):
        # 阻止用户重复评分
        user = self.context['request'].user
        gamework = attrs['gamework']

        if Rating.objects.filter(user=user, gamework=gamework).exists():
            raise serializers.ValidationError("您已经对该作品提交过评分！")
        return attrs
