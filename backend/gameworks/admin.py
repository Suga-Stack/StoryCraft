from django.contrib import admin
from .models import Gamework

@admin.register(Gamework)
class GameworkAdmin(admin.ModelAdmin):
    """Gamework 后台管理"""
    list_display = ('id', 'title', 'author', 'created_at', 'updated_at')
    list_display_links = ('id', 'title')
    search_fields = ('title', 'description', 'author__username')
    list_filter = ('created_at', 'updated_at', 'tags')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('tags',)
    fieldsets = (
        ('Basic Info', {'fields': ('title', 'author', 'description', 'tags', 'image_url')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
