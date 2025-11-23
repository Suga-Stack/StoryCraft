from django.contrib import admin
from .models import Favorite, Comment, Rating, FavoriteFolder

@admin.register(FavoriteFolder)
class FavoriteFolderAdmin(admin.ModelAdmin):
    """收藏夹管理"""
    list_display = ('id', 'user', 'name', 'favorites_count', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    
    def get_queryset(self, request):
        """优化查询，预取 favorites 统计"""
        qs = super().get_queryset(request)
        return qs.prefetch_related('favorites')

    @admin.display(description="收藏数")
    def favorites_count(self, obj):
        """统计收藏夹内收藏数量"""
        return obj.favorites.count()

@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'gamework', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'gamework__title')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'gamework', 'created_at', 'content')
    list_filter = ('created_at',)
    search_fields = ('user__username', 'gamework__title', 'content')


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('user', 'gamework', 'score', 'created_at')
    list_filter = ('score',)
    search_fields = ('user__username', 'gamework__title')
