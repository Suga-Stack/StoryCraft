from rest_framework import serializers
from .models import Favorite, Comment, Rating
from gameworks.models import Gamework

class FavoriteSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework = serializers.PrimaryKeyRelatedField(queryset=Gamework.objects.all())

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'gamework', 'created_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from gameworks.models import Gamework
        self.fields['gamework'].queryset = Gamework.objects.all()

class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework = serializers.PrimaryKeyRelatedField(queryset=Gamework.objects.all())

    class Meta:
        model = Comment
        fields = ('id', 'user', 'gamework', 'content', 'created_at', 'updated_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from gameworks.models import Gamework
        self.fields['gamework'].queryset = Gamework.objects.all()

    def create(self, validated_data):
        # user 由 view 中注入
        return super().create(validated_data)

class RatingSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    gamework = serializers.PrimaryKeyRelatedField(queryset=Gamework.objects.all())
    score = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Rating
        fields = ('id', 'user', 'gamework', 'score', 'created_at', 'updated_at')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from gameworks.models import Gamework
        self.fields['gamework'].queryset = Gamework.objects.all()

    def validate(self, attrs):
        # 阻止用户重复评分
        user = self.context['request'].user
        gamework = attrs['gamework']

        if Rating.objects.filter(user=user, gamework=gamework).exists():
            raise serializers.ValidationError("您已经对该作品提交过评分！")
        return attrs
