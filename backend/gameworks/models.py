from django.db import models
from django.conf import settings 
from users.models import User # 导入 User 模型
from tags.models import Tag  # 导入 Tag 模型

class Gamework(models.Model):
    """游戏作品模型"""
    gamework_id = models.AutoField(primary_key=True, verbose_name="Gamework ID")  # 游戏作品 ID
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gameworks', verbose_name="Author")  # 作者
    title = models.CharField(max_length=255, verbose_name="Title")  # 标题
    description = models.TextField(blank=True, null=True, verbose_name="Description")   # 简介
    tags = models.ManyToManyField(Tag, blank=True, related_name='gameworks', verbose_name="Tags")  # 标签
    image_url = models.URLField(max_length=255, blank=True, null=True, verbose_name="Image URL")  # 封面图片
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created at")  # 创建时间
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated at")  # 更新时间 

    favorites = models.ManyToManyField(settings.AUTH_USER_MODEL, through='interactions.Favorite', related_name='favorite_games')

    class Meta:
        verbose_name = "Gamework"
        verbose_name_plural = "Gameworks"
        ordering = ['-created_at']  # 按创建时间倒序排列

    def __str__(self):
        return self.title
