from rest_framework import viewsets, permissions
from .models import Gamework
from .serializers import GameworkSerializer
from interactions.permissions import IsOwnerOrReadOnly

class GameworkViewSet(viewsets.ModelViewSet):
    queryset = Gamework.objects.all()
    serializer_class = GameworkSerializer
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
