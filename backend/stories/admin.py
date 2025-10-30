from django.contrib import admin
from .models import Story, StoryChapter


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ("gamework", "total_chapters", "is_complete", "created_at")
    list_filter = ("is_complete", "created_at")
    search_fields = ("gamework__title",)


@admin.register(StoryChapter)
class StoryChapterAdmin(admin.ModelAdmin):
    list_display = ("story", "chapter_index", "created_at")
    search_fields = ("story__gamework__title",)
    list_filter = ("story",)
