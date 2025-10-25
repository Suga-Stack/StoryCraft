from .views import GameworkSearchView, GameworkViewSet, RecommendView
from django.urls import path

urlpatterns = [
    path('search/', GameworkSearchView.as_view(), name='gamework-search'),
    path("recommend/", RecommendView.as_view(), name="gamework-recommend"),
]