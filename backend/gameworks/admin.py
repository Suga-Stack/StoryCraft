from django.contrib import admin
from .models import Gamework, Music

@admin.register(Music)
class MusicAdmin(admin.ModelAdmin):
    """Music 后台管理"""
    list_display = ('url',)
    search_fields = ('url',)
    filter_horizontal = ('tags',)

@admin.register(Gamework)
class GameworkAdmin(admin.ModelAdmin):
    """Gamework 后台管理"""
    list_display = ('id', 'title', 'author', 'created_at', 'updated_at', 'is_published')
    list_display_links = ('id', 'title')
    search_fields = ('title', 'description', 'author__username')
    list_filter = ('created_at', 'updated_at', 'tags')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('tags', 'background_musics')
    fieldsets = (
        ('Basic Info', {'fields': ('title', 'author', 'description', 'tags', 'image_url', 'background_musics', 'is_published')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
