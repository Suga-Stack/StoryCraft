from django.contrib import admin
from .models import User, CreditLog, SignInLog

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """用户模型后台管理"""
    list_display = ('id', 'username', 'email', 'gender', 'user_credits', 'created_at', 'updated_at') # 'user_id'
    search_fields = ('username', 'email')
    list_filter = ('gender', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ("Basic Info", {
            "fields": ('username', 'email', 'gender', 'profile_picture')
        }),
        ("Account", {
            "fields": ('password', 'user_credits', 'liked_tags', 'is_staff')
        }),
        ("Timestamps", {
            "fields": ('created_at', 'updated_at')
        }),
    )

@admin.register(CreditLog)
class CreditLogAdmin(admin.ModelAdmin):

    # 列表显示字段
    list_display = (
        "id",
        "user",
        "change_amount",
        "before_balance",
        "after_balance",
        "type",
        "remark",
        "created_at",
    )

    # 可搜索字段（常用于查用户）
    search_fields = ("user__username", "type")

    # 右侧过滤器
    list_filter = ("type","created_at")

    # 排序
    ordering = ("-created_at",)

    # 禁止在 admin 中修改流水数据（可选）
    readonly_fields = (
        "user",
        "change_amount",
        "before_balance",
        "after_balance",
        "type",
        "created_at",
    )

    # 一页显示多少条
    list_per_page = 20

    # 让 created_at 成为可点击链接
    list_display_links = ("id", "user")


@admin.register(SignInLog)
class SignInLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'date')
    search_fields = ('user__username',)
    list_filter = ('date',)
    ordering = ('-date',)