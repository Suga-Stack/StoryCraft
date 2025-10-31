from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserPreferenceView, UserViewSet
from .views import SaveDetailView, SaveListView

urlpatterns = [
    path('preferences/', UserPreferenceView.as_view(), name='user-preferences'),
    path('admin/',UserViewSet.as_view({'get': 'list'}), name="user-administration"),
    path('admin/<int:id>/', UserViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name="user-administration-detail"),
    # 存档接口
    path('<int:userId>/saves/<int:workId>/<str:slot>/', SaveDetailView.as_view(), name='user-save-detail'),
    path('<int:userId>/saves/<int:workId>/', SaveListView.as_view(), name='user-save-list'),
]
