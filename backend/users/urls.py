from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserRegisterView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),  # /api/users/
    path('users/register/', UserRegisterView.as_view(), name='user-register'),  # /api/users/register/
]
