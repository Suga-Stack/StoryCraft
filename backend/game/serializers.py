from rest_framework import serializers
from .models import GameSave, GameReport
from gameworks.models import Gamework

class GameStateSerializer(serializers.Serializer):
    """游戏状态序列化器"""
    gameworkId = serializers.IntegerField()
    userId = serializers.IntegerField()
    currentChapterIndex = serializers.IntegerField()
    currentSceneId = serializers.CharField(allow_blank=True)
    history = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    character = serializers.DictField(required=False, default=dict)
    inventory = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    relationships = serializers.DictField(required=False, default=dict)
    flags = serializers.DictField(required=False, default=dict)
    branch_exploration = serializers.DictField(required=False, default=dict)

class GameSaveSerializer(serializers.ModelSerializer):
    """游戏存档序列化器"""
    game_state = GameStateSerializer()

    class Meta:
        model = GameSave
        fields = ['id', 'gamework', 'name', 'game_state', 'thumbnail', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        
        instance, created = GameSave.objects.update_or_create(
            user=user,
            gamework=validated_data['gamework'],
            name=validated_data['name'],
            defaults=validated_data
        )
        return instance

class GameSaveListSerializer(serializers.ModelSerializer):
    """简化的存档列表序列化器"""
    class Meta:
        model = GameSave
        fields = ['id', 'name', 'updated_at']

class GameStartSerializer(serializers.Serializer):
    """游戏开始请求序列化器"""
    gameworkId = serializers.PrimaryKeyRelatedField(
        queryset=Gamework.objects.all(),
        error_messages={"does_not_exist": "指定的作品不存在"}
    )
    saveId = serializers.IntegerField(required=False, allow_null=True)

class GameChoiceSerializer(serializers.Serializer):
    """玩家选择请求序列化器"""
    gameState = GameStateSerializer()
    choiceId = serializers.CharField(max_length=100)
