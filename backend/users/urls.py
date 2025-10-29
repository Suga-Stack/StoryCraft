from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserPreferenceView
from .views import SaveDetailView, SaveListView

urlpatterns = [
    path('preferences/', UserPreferenceView.as_view(), name='user-preferences'),
    # 存档接口
    path('<int:userId>/saves/<int:workId>/<str:slot>/', SaveDetailView.as_view(), name='user-save-detail'),
    path('<int:userId>/saves/<int:workId>/', SaveListView.as_view(), name='user-save-list'),
]
