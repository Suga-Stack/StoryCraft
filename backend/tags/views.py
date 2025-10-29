from rest_framework import viewsets
from .models import Tag
from .serializers import TagSerializer

class TagViewSet(viewsets.ModelViewSet):
    """标签的CRUD接口"""
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
