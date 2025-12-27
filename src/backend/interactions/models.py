from django.conf import settings
from django.db import models

from gameworks.models import Gamework


class FavoriteFolder(models.Model):
    """收藏夹"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_folders")
    name = models.CharField(max_length=100, verbose_name="收藏夹名称", blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "name")  # 同一用户收藏夹名不能重复
        verbose_name = "Favorite Folder"
        verbose_name_plural = "Favorite Folders"

    def save(self, *args, **kwargs):
        # 若未命名，则自动命名为“默认收藏夹1/2/3...”
        if not self.name:
            existing = FavoriteFolder.objects.filter(user=self.user, name__startswith="默认收藏夹").count()
            self.name = f"默认收藏夹{existing + 1}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Favorite(models.Model):
    """用户收藏作品"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites", verbose_name="User"
    )
    gamework = models.ForeignKey(
        Gamework, on_delete=models.CASCADE, related_name="favorited_by", verbose_name="Gamework"
    )
    folder = models.ForeignKey(
        FavoriteFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name="favorites"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created at")

    class Meta:
        unique_together = ("user", "gamework")  # 不能重复收藏
        verbose_name = "Favorite"
        verbose_name_plural = "Favorites"

    def __str__(self):
        return f"{self.user.username} favorited {self.gamework.title}"


class Comment(models.Model):
    """用户对作品的评论"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments", verbose_name="User"
    )
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="comments", verbose_name="Gamework")
    content = models.TextField(verbose_name="Content")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created at")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Comment"
        verbose_name_plural = "Comments"

    def __str__(self):
        return f"{self.user.username}: {self.content[:20]}"


class CommentLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_likes")
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "comment")


class Rating(models.Model):
    """用户对作品的评分"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings", verbose_name="User"
    )
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="ratings", verbose_name="Gamework")
    score = models.PositiveSmallIntegerField(verbose_name="Score")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created at")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated at")

    class Meta:
        unique_together = ("user", "gamework")
        verbose_name = "Rating"
        verbose_name_plural = "Ratings"

    def __str__(self):
        return f"{self.user} 给 {self.gamework} 打了 {self.score} 分"

    def clean(self):
        """限制评分范围在2~10"""
        from django.core.exceptions import ValidationError

        if not (2 <= self.score <= 10):
            raise ValidationError("评分必须在1到5颗星之间！")


class ReadRecord(models.Model):
    """用户阅读作品记录"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="read_records")
    gamework = models.ForeignKey(Gamework, on_delete=models.CASCADE, related_name="read_records")
    read_at = models.DateTimeField(auto_now_add=True)  # 阅读时间
    has_paid = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)  # 记录是否对用户可见

    class Meta:
        unique_together = ("user", "gamework")  # 同一用户对同一作品只记录一次
        ordering = ["-read_at"]

    def __str__(self):
        return f"{self.user.username} read {self.gamework.title}"
