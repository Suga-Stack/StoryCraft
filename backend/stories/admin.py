from django.contrib import admin
from .models import Story, StoryChapter, StoryScene, StoryEnding


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


@admin.register(StoryEnding)
class StoryEndingAdmin(admin.ModelAdmin):
    list_display = ("story", "ending_index", "title", "created_at")
    search_fields = ("story__gamework__title", "title")
    list_filter = ("story",)


@admin.register(StoryScene)
class StorySceneAdmin(admin.ModelAdmin):
    list_display = ("id", "get_source", "scene_index", "created_at")
    list_filter = ("created_at",)
    search_fields = ("chapter__story__gamework__title", "ending__story__gamework__title")
    ordering = ("chapter", "ending", "scene_index")

    @admin.display(description="所属章节/结局")
    def get_source(self, obj):
        if obj.chapter:
            return f"章节: {obj.chapter}"
        elif obj.ending:
            return f"结局: {obj.ending}"
        return "-"

