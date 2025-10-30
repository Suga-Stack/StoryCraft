from .views import GameworkSearchView, GameworkViewSet, RecommendView, GameworkFavoriteLeaderboardViewSet, GameworkRatingLeaderboardViewSet
from django.urls import path

urlpatterns = [
    path('search/', GameworkSearchView.as_view(), name='gamework-search'),
    path("recommend/", RecommendView.as_view(), name="gamework-recommend"),
    path('favorite-leaderboard/', GameworkFavoriteLeaderboardViewSet.as_view({'get': 'list'}), name='gamework-leaderboard'),
    path('rating-leaderboard/', GameworkRatingLeaderboardViewSet.as_view({'get': 'list'}), name='gamework-rating-leaderboard'),
]