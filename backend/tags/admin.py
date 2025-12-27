from django.contrib import admin

from .models import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """标签后台管理"""

    list_display = ("name",)
    search_fields = ("name",)
