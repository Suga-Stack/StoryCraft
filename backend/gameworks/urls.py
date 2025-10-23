from rest_framework.routers import DefaultRouter
from .views import GameworkSearchView, GameworkViewSet
from django.urls import path

router = DefaultRouter()
router.register(r'gameworks', GameworkViewSet, basename='gamework')

urlpatterns = [
    path('search/', GameworkSearchView.as_view(), name='gamework-search'),
]
urlpatterns += router.urls