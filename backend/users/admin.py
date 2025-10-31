from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """用户模型后台管理"""
    list_display = ('username', 'email', 'gender', 'user_credits', 'created_at', 'updated_at') # 'user_id'
    search_fields = ('username', 'email')
    list_filter = ('gender', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ("Basic Info", {
            "fields": ('username', 'email', 'gender', 'profile_picture')
        }),
        ("Account", {
            "fields": ('password_hash', 'user_credits', 'liked_tags', 'is_staff')
        }),
        ("Timestamps", {
            "fields": ('created_at', 'updated_at')
        }),
    )
