from django.db import models
from django.conf import settings
from gameworks.models import Gamework

class Favorite(models.Model):
    """用户收藏作品"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorites', verbose_name='User')
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name='favorited_by', verbose_name='Gamework')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')

    class Meta:
        unique_together = ('user', 'gamework')
        verbose_name = 'Favorite'
        verbose_name_plural = 'Favorites'

    def __str__(self):
        return f"{self.user} 收藏了 {self.gamework}"


class Comment(models.Model):
    """用户对作品的评论"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments', verbose_name='User')
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name='comments', verbose_name='Gamework')
    content = models.TextField(verbose_name='Content')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated at')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Comment'
        verbose_name_plural = 'Comments'

    def __str__(self):
        return f"{self.user} 评论了 {self.gamework}"


class Rating(models.Model):
    """用户对作品的评分"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ratings', verbose_name='User')
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name='ratings', verbose_name='Gamework')
    score = models.PositiveSmallIntegerField(verbose_name='Score')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created at')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated at')

    class Meta:
        unique_together = ('user', 'gamework')
        verbose_name = 'Rating'
        verbose_name_plural = 'Ratings'

    def __str__(self):
        return f"{self.user} 给 {self.gamework} 打了 {self.score} 分"

    def clean(self):
        """限制评分范围在1~5"""
        from django.core.exceptions import ValidationError
        if not (1 <= self.score <= 5):
            raise ValidationError("评分必须在1到5之间！")
