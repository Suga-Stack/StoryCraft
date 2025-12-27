from django.urls import path

from .views import (
    GameworkFavoriteLeaderboardViewSet,
    GameworkHotLeaderboardViewSet,
    GameworkRatingLeaderboardViewSet,
    GameworkSearchView,
    GameworkViewSet,
    PublishGameworkViewSet,
    RecommendView,
)

urlpatterns = [
    path(
        "gameworks/<int:pk>/", GameworkViewSet.as_view({"get": "retrieve", "delete": "destroy"}), name="gamework-detail"
    ),
    path("publish/<int:pk>/", PublishGameworkViewSet.as_view({"post": "publish"}), name="publish-gamework"),
    path("unpublish/<int:pk>/", PublishGameworkViewSet.as_view({"post": "unpublish"}), name="unpublish-gamework"),
    path("search/", GameworkSearchView.as_view(), name="gamework-search"),
    path("recommend/", RecommendView.as_view(), name="gamework-recommend"),
    path(
        "favorite-leaderboard/",
        GameworkFavoriteLeaderboardViewSet.as_view({"get": "list"}),
        name="gamework-leaderboard",
    ),
    path(
        "rating-leaderboard/",
        GameworkRatingLeaderboardViewSet.as_view({"get": "list"}),
        name="gamework-rating-leaderboard",
    ),
    path("hot-leaderboard/", GameworkHotLeaderboardViewSet.as_view({"get": "list"}), name="gamework-hot-leaderboard"),
]
