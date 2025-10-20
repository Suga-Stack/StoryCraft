from django.contrib import admin
from django.urls import path, re_path, include
from rest_framework.routers import DefaultRouter
from rest_framework import permissions
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_yasg.views import get_schema_view
from drf_yasg import openapi


router = DefaultRouter()

schema_view = get_schema_view(
    openapi.Info(
        title="Project API 文档",
        default_version='v1',
        description="这是项目的接口文档，自动从 DRF 视图生成",
        # terms_of_service="https://www.example.com/terms/",
        # contact=openapi.Contact(email="your_email@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # path('api/', include('users.urls')),
    path('api/auth/', include('users.register_urls')),  # 注册、登录、登出接口统一入口
    path('api/gameworks/', include('gameworks.urls')),  # 作品模块
    path('api/tags/', include('tags.urls')),  # 标签模块
    path('api/interactions/', include('interactions.urls')),  # 收藏/评论/评分模块

    # JWT token
    # POST /api/auth/token/  获取 token
    # POST /api/auth/token/refresh/  刷新 token
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
]
