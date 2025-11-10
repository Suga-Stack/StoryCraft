from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserPreferenceView, UserViewSet, ReadGameworkListView, RecentReadGameworksView, MyGameworkListView, RecentMyGameworksView
from .views import SaveDetailView, SaveListView

urlpatterns = [
    path('preferences/', UserPreferenceView.as_view(), name='user-preferences'),
    path('admin/',UserViewSet.as_view({'get': 'list'}), name="user-administration"),
    path('admin/<int:id>/', UserViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name="user-administration-detail"),
    path('read/', ReadGameworkListView.as_view(), name='read_gameworks'),
    path('read/recent/', RecentReadGameworksView.as_view(), name='recent_read_gameworks'),
    path('myworks/', MyGameworkListView.as_view(), name='my_gameworks'),
    path('myworks/recent/', RecentMyGameworksView.as_view(), name='recent_my_gameworks'),
    # 存档接口
    path('<int:userId>/saves/<int:workId>/<str:slot>/', SaveDetailView.as_view(), name='user-save-detail'),
    path('<int:userId>/saves/<int:workId>/', SaveListView.as_view(), name='user-save-list'),
]
