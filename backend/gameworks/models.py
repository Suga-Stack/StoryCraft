from django.db import models
from users.models import User # 导入 User 模型
from tags.models import Tag  # 导入 Tag 模型

class Gamework(models.Model):
    gamework_id = models.AutoField(primary_key=True)  # 作品id，自动递增的主键
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gameworks')  # 外键作者用户
    title = models.CharField(max_length=255)  # 作品标题
    description = models.TextField(blank=True, null=True)  # 作品简介
    tags = models.ManyToManyField(Tag, blank=True)  # 标签
    image_url = models.URLField(max_length=255, blank=True, null=True)  # 作品图片URL
    created_at = models.DateTimeField(auto_now_add=True)  # 创建时间

    def __str__(self):
        return self.title