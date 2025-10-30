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

class GameCreateSerializer(serializers.Serializer):
    """创建游戏请求序列化器"""
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        min_length=3,
        max_length=6,
        help_text="用户选择的标签数组（3-6个）"
    )
    idea = serializers.CharField(allow_blank=True, required=False, help_text="用户输入的构思文本")
    length = serializers.ChoiceField(
        choices=["short", "medium", "long"],
        help_text="篇幅类型：'short' (3-5章) / 'medium' (6-10章) / 'long' (10章以上)"
    )

    def validate_tags(self, value):
        if not (3 <= len(value) <= 6):
            raise serializers.ValidationError("标签数量必须在3到6个之间。")
        return value

class GameworkCreateResponseSerializer(serializers.Serializer):
    """描述创建游戏成功后的响应结构，用于API文档"""
    gameworkId = serializers.IntegerField(
        help_text="游戏作品的唯一ID"
    )
    title = serializers.CharField(
        help_text="AI生成的作品标题"
    )
    coverUrl = serializers.URLField(
        help_text="AI生成的封面图片URL"
    )
    description = serializers.CharField(
        help_text="AI生成的作品简介"
    )
    initialAttributes = serializers.DictField(
        child=serializers.IntegerField(), 
        help_text="初始属性值，例如: {'力量': 10, '敏捷': 8}"
    )
    statuses = serializers.DictField(
        child=serializers.DictField(child=serializers.IntegerField()), 
        help_text="全部状态标签及其属性阈值，例如: {'初出茅庐': {'人气': 120, '灵石': 1200}}"
    )

class GameChapterRequestSerializer(serializers.Serializer):
    """获取游戏章节内容的请求序列化器"""
    gameworkId = serializers.PrimaryKeyRelatedField(
        queryset=Gamework.objects.all(),
        error_messages={"does_not_exist": "指定的作品不存在"},
        help_text="gameworkId，须是已创建作品"
    )
    chapterIndex = serializers.IntegerField(
        min_value=1,
        help_text="章节编号，从 1 开始"
    )

class GameChapterChoiceSerializer(serializers.Serializer):
    text = serializers.CharField()
    attributesDelta = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        default=dict
    )
    subsequentDialogues = serializers.ListField(
        child=serializers.CharField()
    )

class GameChapterDialogueSerializer(serializers.Serializer):
    narration = serializers.CharField()
    playerChoices = GameChapterChoiceSerializer(
        many=True,
        required=False,
        allow_null=True
    )

class GameChapterSceneSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    backgroundImage = serializers.CharField()
    dialogues = GameChapterDialogueSerializer(many=True)
    isChapterEnding = serializers.BooleanField(required=False)

class GameChapterResponseSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField()
    title = serializers.CharField()
    scenes = GameChapterSceneSerializer(many=True)
    isGameEnding = serializers.BooleanField(required=False)
