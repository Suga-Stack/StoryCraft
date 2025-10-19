from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),  # 用户模块（含注册）
    path('api/gameworks/', include('gameworks.urls')),  # 作品模块
    path('api/tags/', include('tags.urls')),  # 标签模块
    path('api/interactions/', include('interactions.urls')),  # 收藏/评论/评分模块

    # JWT token
    # POST /api/auth/token/  获取 token
    # POST /api/auth/token/refresh/  刷新 token
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
