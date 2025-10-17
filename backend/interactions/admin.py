from django.contrib import admin
from .models import Favorite, Comment, Rating


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'gamework', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__user_name', 'gamework__title')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('user', 'gamework', 'created_at', 'content')
    list_filter = ('created_at',)
    search_fields = ('user__user_name', 'gamework__title', 'content')


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('user', 'gamework', 'score', 'created_at')
    list_filter = ('score',)
    search_fields = ('user__user_name', 'gamework__title')
