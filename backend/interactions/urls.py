from rest_framework.routers import DefaultRouter
from .views import FavoriteViewSet, CommentViewSet, RatingViewSet, FavoriteFolderViewSet

router = DefaultRouter()
router.register(r'favorites', FavoriteViewSet, basename='favorite')
router.register(r'favorite-folders', FavoriteFolderViewSet, basename='favorite-folder')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'ratings', RatingViewSet, basename='rating')

urlpatterns = router.urls
