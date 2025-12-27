from django.urls import path

from .views import (
    CommentReportViewSet,
    CreditLogViewSet,
    GameworkReportViewSet,
    MyGameworkListView,
    ReadGameworkListView,
    RecentMyGameworksView,
    RecentReadGameworksView,
    RechargeViewSet,
    RewardViewSet,
    SaveDetailView,
    SaveListView,
    UserPreferenceView,
    UserSignInView,
    UserViewSet,
)

urlpatterns = [
    path("preferences/", UserPreferenceView.as_view(), name="user-preferences"),
    path("admin/", UserViewSet.as_view({"get": "list"}), name="user-administration"),
    path(
        "admin/<int:id>/",
        UserViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="user-administration-detail",
    ),
    path("read/", ReadGameworkListView.as_view(), name="read_gameworks"),
    path("read/recent/", RecentReadGameworksView.as_view(), name="recent_read_gameworks"),
    path("myworks/", MyGameworkListView.as_view(), name="my_gameworks"),
    path("myworks/recent/", RecentMyGameworksView.as_view(), name="recent_my_gameworks"),
    path("signin/", UserSignInView.as_view(), name="user-signin"),
    path("recharge/", RechargeViewSet.as_view({"post": "create"}), name="user-recharge"),
    path("reward/", RewardViewSet.as_view({"post": "create"}), name="user-reward"),
    path("creditlog/", CreditLogViewSet.as_view({"get": "list"}), name="user-creditlog"),
    path("report/gamework/", GameworkReportViewSet.as_view({"get": "list", "post": "create"}), name="gamework-report"),
    path(
        "reports/gameworks/<int:pk>/",
        GameworkReportViewSet.as_view({"get": "retrieve", "delete": "destroy", "patch": "resolve"}),
        name="gamework-report-detail",
    ),
    path("reports/comments/", CommentReportViewSet.as_view({"get": "list", "post": "create"}), name="comment-report"),
    path(
        "reports/comments/<int:pk>/",
        CommentReportViewSet.as_view({"get": "retrieve", "delete": "destroy", "patch": "resolve"}),
        name="comment-report-detail",
    ),
    # 存档接口
    path("<int:userId>/saves/<int:workId>/<str:slot>/", SaveDetailView.as_view(), name="user-save-detail"),
    path("<int:userId>/saves/<int:workId>/", SaveListView.as_view(), name="user-save-list"),
]
