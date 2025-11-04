from django.db import models
from django.conf import settings
from gameworks.models import Gamework

class GameSave(models.Model):
    """游戏存档模型"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_saves")
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="game_saves")
    slot = models.PositiveIntegerField(default=1, help_text="存档槽位(从1开始)")

    title = models.CharField(max_length=100, help_text="存档名称, 如 '自动存档 2024-05-21'")
    timestamp = models.BigIntegerField(help_text="存档的时间戳")
    state = models.JSONField(help_text="游戏的JSON快照")
    cover_url = models.CharField(max_length=500, help_text="存档时场景的背景URL")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s save slot {self.slot} for '{self.gamework.title}' ({self.title or '未命名'})"

    class Meta:
        unique_together = ('user', 'gamework', 'slot')
        ordering = ['-updated_at']

class GameReport(models.Model):
    """游戏总结报告模型"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_reports")
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="game_reports")
    
    content = models.JSONField(help_text="游戏总结报告的内容 (JSON格式)")
    
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for {self.user.username} on '{self.gamework.title}'"

    class Meta:
        ordering = ['-generated_at']
