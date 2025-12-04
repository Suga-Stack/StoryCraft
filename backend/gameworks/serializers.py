from rest_framework import serializers
from .models import Gamework
from tags.models import Tag
from users.models import CreditLog
from django.db.models import Avg, Sum
from interactions.models import Comment
from interactions.serializers import CommentSerializer

class GameworkDetailSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, read_only=False, queryset=Tag.objects.all())
    image_url = serializers.SerializerMethodField()
    background_music_urls = serializers.SerializerMethodField()

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
    chapters_status = serializers.SerializerMethodField()
    user_reward_amount = serializers.SerializerMethodField()

    # 作品评论
    comments_by_time = serializers.SerializerMethodField()
    comments_by_hot = serializers.SerializerMethodField()

    # 评分详情
    rating_details = serializers.SerializerMethodField()

    class Meta:
        model = Gamework
        fields = (
            'id', 'author', 'title', 'description', 'tags', 'image_url', 'background_music_urls',
            'is_published', 'created_at', 'updated_at', 'published_at',
            'favorite_count', 'average_score', 'rating_count', 'read_count', 'is_favorited', 'price',
            'user_reward_amount', 'is_complete', 'generated_chapters', 'total_chapters', 'modifiable', 'ai_callable',
            'initial_attributes', 'initial_statuses', 'outlines', 'chapters_status',
            'comments_by_time', 'comments_by_hot', 'rating_details'
        )

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image_url:
            if request:
                return request.build_absolute_uri(obj.image_url)
            # Fallback for contexts without request (e.g., management commands)
            if not obj.image_url.startswith(('http://', 'https://')):
                from django.conf import settings
                return f"{settings.SITE_DOMAIN}{obj.image_url}"
        return obj.image_url

    def get_background_music_urls(self, obj):
        """返回关联的所有背景音乐的绝对URL列表"""
        return [music.url for music in obj.background_musics.all()]

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
    
    def get_user_reward_amount(self, obj):
        request = self.context.get('request')
        user = getattr(request, "user", None)

        if not (user and user.is_authenticated):
            return 0

        total = CreditLog.objects.filter(
            user=user,
            gamework=obj,
            type="reward_out"
        ).aggregate(total=Sum("change_amount"))["total"] or 0

        # reward_out 是负数 → 转正
        return abs(total)

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
        # 获取章节大纲
        outlines = getattr(obj.story, 'outlines', []) or []
        if not isinstance(outlines, list):
            outlines = []
        
        # 获取结局大纲并追加
        endings_summary = getattr(obj.story, 'endings_summary', []) or []
        if endings_summary and isinstance(endings_summary, list):
            for i, ending in enumerate(endings_summary):
                outlines.append({
                    "endingIndex": i + 1,
                    "title": ending.get("title", f"结局{i+1}"),
                    "outline": ending.get("summary", "")
                })
                                     
        return outlines

    def get_chapters_status(self, obj):
        story = getattr(obj, 'story', None)
        if not story:
            return []
        
        statuses = {ch.chapter_index: ch.status for ch in story.chapters.all()}
        
        result = []
        for i in range(1, story.total_chapters + 1):
            status = statuses.get(i)
            
            if not status:
                # 检查全局锁，看是否正好是当前正在生成的章节
                if story.is_generating and story.current_generating_chapter == i:
                    status = 'generating'
                else:
                    status = 'not_generated'
            
            result.append({'chapterIndex': i, 'status': status})
            
        return result
    
    def get_comments_by_time(self, obj):
        """返回该作品的所有顶级评论 + 嵌套回复"""
        qs = Comment.objects.filter(
            gamework=obj,
            parent__isnull=True
        ).select_related("user").prefetch_related("replies__user")
        return CommentSerializer(qs, many=True, context=self.context).data
    
    def get_comments_by_hot(self, obj):
        qs = Comment.objects.filter(
            gamework=obj,
            parent__isnull=True
        ).select_related("user").prefetch_related("replies__user", "likes")

        # 手动计算热度：回复数 + 点赞数
        comment_list = list(qs)

        for c in comment_list:
            c.reply_count = c.replies.count()
            c.like_count = c.likes.count()
            c.hot_score = c.reply_count + c.like_count

        # 按热度倒序排列
        comment_list.sort(key=lambda c: c.hot_score, reverse=True)

        return CommentSerializer(comment_list, many=True, context=self.context).data

    def get_rating_details(self, obj):
        ratings = obj.ratings.select_related("user").order_by("-created_at")

        result = []
        for r in ratings:
            result.append({
                "username": r.user.username,
                "profile_picture": getattr(r.user, "profile_picture", None),
                "score": r.score,
                "created_at": r.created_at,
            })

        return result

    
class GameworkSimpleSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    favorite_count = serializers.SerializerMethodField()
    average_score = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = Gamework
        fields = [
            'id', 'author', 'title', 'description', 'tags', 'image_url',
            'is_published', 'published_at',
            'favorite_count', 'average_score', 'read_count', 'is_favorited', 'price'
        ]
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image_url:
            if request:
                return request.build_absolute_uri(obj.image_url)
            if not obj.image_url.startswith(('http://', 'https://')):
                from django.conf import settings
                return f"{settings.SITE_DOMAIN}{obj.image_url}"
        return obj.image_url

    def get_favorite_count(self, obj):
        if hasattr(obj, "favorite_count"):
            return obj.favorite_count
        return obj.favorited_by.count()

    def get_average_score(self, obj):
        if hasattr(obj, "average_score"):
            return round(obj.average_score or 0, 1)
        avg = obj.ratings.aggregate(avg=Avg('score'))['avg']
        return round(avg or 0, 1)

    def get_read_count(self, obj):
        if hasattr(obj, "read_count"):
            return obj.read_count
        return obj.read_records.values('user').distinct().count()

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False

        if hasattr(obj, 'user_favorites'):
            return len(obj.user_favorites) > 0

        return obj.favorited_by.filter(user=user).exists()
