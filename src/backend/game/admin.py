from django.contrib import admin

from .models import GameReport, GameSave


@admin.register(GameSave)
class GameSaveAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GameSave._meta.fields]
    search_fields = ("name",)
    list_per_page = 25


@admin.register(GameReport)
class GameReportAdmin(admin.ModelAdmin):
    list_display = [field.name for field in GameReport._meta.fields]
    list_per_page = 25
