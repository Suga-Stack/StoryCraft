from django.contrib.auth.models import AbstractUser
from django.db import models
from tags.models import Tag
from gameworks.models import Gamework
from django.conf import settings

# 用户模型
class User(AbstractUser):
      # user_id = models.AutoField(primary_key=True)  # 用户id，自动递增的主键
      username = models.CharField(max_length=255, unique=True)  # 用户名，唯一
      email = models.EmailField(unique=True)  # 邮箱唯一
      password = models.CharField(max_length=255)  # 密码哈希值
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
      is_staff = models.BooleanField(default=False)  # 默认用户为非管理员

      def get_read_gameworks(self):
            """返回该用户读过的所有作品"""
            return Gamework.objects.filter(read_records__user=self).distinct()

      def __str__(self):
            return self.username

class UserSignIn(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='signin_info')
    last_signin_date = models.DateField(null=True, blank=True)
    continuous_days = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - 连续 {self.continuous_days} 天"
    
class SignInLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="signin_logs")
    date = models.DateField()
    
    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']
    
class CreditLog(models.Model):
    """用户积分流水记录"""

    TYPE_CHOICES = [
        ('recharge', '积分充值'),
        ('reward', '签到奖励 / 系统奖励'),
        ('read_pay', '阅读扣费'),
        ('manual', '管理员调整'),
        ('reward_out', '打赏支出'),
        ('reward_in', '获得打赏'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="credit_logs"
    )

    change_amount = models.IntegerField()  # 正数=增加，负数=减少
    before_balance = models.IntegerField()
    after_balance = models.IntegerField()

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    remark = models.CharField(max_length=255, blank=True, null=True)
    gamework = models.ForeignKey(
        "gameworks.Gamework",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="credit_logs"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_type_display()}] {self.user.username}: {self.change_amount}"