from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    """用户模型后台管理"""
    list_display = ('user_id', 'user_name', 'phone_number', 'gender', 'user_credits', 'created_at', 'updated_at')
    search_fields = ('user_name', 'phone_number')
    list_filter = ('gender', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ("Basic Info", {
            "fields": ('user_name', 'phone_number', 'gender', 'profile_picture')
        }),
        ("Account", {
            "fields": ('password_hash', 'user_credits', 'liked_tags')
        }),
        ("Timestamps", {
            "fields": ('created_at', 'updated_at')
        }),
    )
