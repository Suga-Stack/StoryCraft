from django.contrib.auth.models import AbstractUser
from django.db import models
from tags.models import Tag

# 用户模型
class User(AbstractUser):
  user_id = models.AutoField(primary_key=True)  # 用户id，自动递增的主键
  user_name = models.CharField(max_length=255, unique=True)  # 用户名，唯一
  phone_number = models.CharField(max_length=20, unique=True)  # 电话号码，唯一
  password_hash = models.CharField(max_length=255)  # 密码哈希值
  profile_picture = models.URLField(max_length=255, blank=True, null=True)  # 头像URL
  user_credits = models.IntegerField(blank=True, null=True)  # 用户积分
  created_at = models.DateTimeField(auto_now_add=True)  # 创建时间，自动设置
  updated_at = models.DateTimeField(auto_now=True)  # 更新时间，自动更新
  gender = models.CharField(
        max_length=10,
        choices=[('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')],
        blank=True,
        null=True
  )  # 性别字段，选择 Male、Female 或 Other
  liked_tags = models.ManyToManyField(Tag, blank=True)  # 用户喜欢的标签，可以为空

  def __str__(self):
    return self.user_name
