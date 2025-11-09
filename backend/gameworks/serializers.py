from rest_framework import serializers
from .models import Gamework
from tags.models import Tag
from django.db.models import Avg

class GameworkSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Tag.objects.all())

    # 统计字段
    favorite_count = serializers.SerializerMethodField()
    average_score = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()
    generated_chapters = serializers.SerializerMethodField()
    total_chapters = serializers.SerializerMethodField()
    modifiable = serializers.SerializerMethodField()
    ai_callable = serializers.SerializerMethodField()
    initial_attributes = serializers.SerializerMethodField()
    initial_statuses = serializers.SerializerMethodField()
    outlines = serializers.SerializerMethodField()

    class Meta:
        model = Gamework
        fields = (
            'id', 'author', 'title', 'description', 'tags', 'image_url',
            'is_published', 'created_at', 'updated_at', 'published_at',
            'favorite_count', 'average_score', 'rating_count', 'read_count', 'is_favorited',
            'is_complete', 'generated_chapters', 'total_chapters', 'modifiable', 'ai_callable',
            'initial_attributes', 'initial_statuses', 'outlines'
        )

    def get_favorite_count(self, obj):
        if hasattr(obj, "favorite_count"):
            return obj.favorite_count
        return obj.favorited_by.count()

    def get_average_score(self, obj):
        if hasattr(obj, "average_score"):
            return round(obj.average_score or 0, 1)
        avg = obj.ratings.aggregate(avg=Avg('score'))['avg']
        return round(avg or 0, 1)

    def get_rating_count(self, obj):
        if hasattr(obj, "rating_count"):
            return obj.rating_count
        return obj.ratings.count()

    def get_read_count(self, obj):
        if hasattr(obj, "read_count"):
            return obj.read_count
        # 按 user 去重统计
        return obj.read_records.values('user').distinct().count()

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False

        # 如果在 queryset 中预取过 user 的收藏，直接用缓存
        if hasattr(obj, 'user_favorites'):
            return len(obj.user_favorites) > 0

        return obj.favorited_by.filter(user=user).exists()

    def get_is_complete(self, obj):
        return getattr(obj.story, 'is_complete', False)

    def get_generated_chapters(self, obj):
        return obj.story.chapters.count() if hasattr(obj, 'story') else 0

    def get_total_chapters(self, obj):
        return getattr(obj.story, 'total_chapters', 0)

    def get_modifiable(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False
        return obj.author == user

    def get_ai_callable(self, obj):
        return getattr(obj.story, 'ai_callable', False)

    def get_initial_attributes(self, obj):
        return getattr(obj.story, 'initial_attributes', {})

    def get_initial_statuses(self, obj):
        return getattr(obj.story, 'initial_statuses', {})

    def get_outlines(self, obj):
        return getattr(obj.story, 'outlines', [])