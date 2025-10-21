from django.db import models
from django.conf import settings
from gameworks.models import Gamework

class GameSave(models.Model):
    """游戏存档模型"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_saves")
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="game_saves")
    
    name = models.CharField(max_length=100, help_text="存档名称, 如 '自动存档 2024-05-21'")
    
    # 游戏状态快照 (核心), 存储了玩家在游戏中的所有动态数据
    game_state = models.JSONField(help_text="游戏状态的JSON快照")
    
    thumbnail = models.URLField(max_length=500, blank=True, null=True, help_text="存档时场景的截图URL")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s save for '{self.gamework.title}' - {self.name}"

    class Meta:
        # 同一用户对同一作品的存档名必须唯一
        unique_together = ('user', 'gamework', 'name')
        ordering = ['-updated_at']

class GameReport(models.Model):
    """游戏总结报告模型"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_reports")
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="game_reports")
    
    # 关联的最终存档, SET_NULL表示如果存档被删除, 报告依然保留
    final_save = models.OneToOneField(GameSave, on_delete=models.SET_NULL, null=True, blank=True)
    
    # 报告内容, e.g., {"ending_title": "孤独的守望者", "exploration_rate": "60%"}
    content = models.JSONField(help_text="游戏总结报告的内容 (JSON格式)")
    
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report for {self.user.username} on '{self.gamework.title}'"

    class Meta:
        ordering = ['-generated_at']
