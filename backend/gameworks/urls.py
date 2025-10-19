from rest_framework.routers import DefaultRouter
from .views import GameworkViewSet

router = DefaultRouter()
router.register(r'', GameworkViewSet, basename='gamework')
urlpatterns = router.urls
