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
    modifiable = serializers.BooleanField(required=False, default=False, help_text="是否为创作者模式")

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
    coverUrl = serializers.CharField(
        help_text="AI生成的封面图片URL"
    )
    description = serializers.CharField(
        help_text="AI生成的作品简介"
    )
    initialAttributes = serializers.DictField(
        child=serializers.IntegerField(), 
        help_text="初始属性值，例如: {'力量': 10, '敏捷': 8}"
    )
    initialStatuses = serializers.DictField(
        child=serializers.CharField(), 
        help_text="初始状态，例如: {'修为': '炼气期三层', '线人网络': True}"
    )
    total_chapters = serializers.IntegerField(
        help_text="总章节数"
    )
    chapterOutlines = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="各章节大纲"
    )

class GameChapterChoiceSerializer(serializers.Serializer):
    choiceId = serializers.IntegerField()
    text = serializers.CharField()
    attributesDelta = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        default=dict
    )
    statusesDelta = serializers.DictField(
        child=serializers.JSONField(),
        required=False,
        allow_null=True,
        default=dict
    )
    subsequentDialogues = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True
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

class GameChapterResponseSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField()
    title = serializers.CharField()
    scenes = GameChapterSceneSerializer(many=True)

class GameChapterManualUpdateSerializer(serializers.Serializer):
    """用于手动更新章节内容的序列化器"""
    chapterIndex = serializers.IntegerField()
    title = serializers.CharField()
    scenes = GameChapterSceneSerializer(many=True)
    
class GameEndingManualUpdateSerializer(serializers.Serializer):
    endingIndex = serializers.IntegerField(help_text="结局Index")
    title = serializers.CharField(max_length=255, help_text="结局标题")
    scenes = GameChapterSceneSerializer(many=True)

class ChapterOutlineSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField()
    title = serializers.CharField(required=False, allow_blank=True)
    outline = serializers.CharField()

class ChapterGenerateSerializer(serializers.Serializer):
    chapterOutlines = ChapterOutlineSerializer(many=True)
    userPrompt = serializers.CharField(required=False, allow_blank=True)

class SettlementReportContentSerializer(serializers.Serializer):
    title = serializers.CharField()
    content = serializers.CharField()
    traits = serializers.ListField(child=serializers.CharField(), required=False)
    scores = serializers.DictField(child=serializers.IntegerField(), required=False)

class SettlementVariantSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    summary = serializers.CharField()
    minAttributes = serializers.DictField(child=serializers.IntegerField(), required=False)
    requiredStatuses = serializers.ListField(child=serializers.CharField(), required=False)
    report = SettlementReportContentSerializer()

class SettlementRequestSerializer(serializers.Serializer):
    attributes = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        default=dict,
        help_text="属性字典，键为属性名，值为数值"
    )
    statuses = serializers.DictField(
        child=serializers.JSONField(),
        required=False,
        default=dict,
        help_text="状态字典，键为状态名，值可以是字符串/布尔/数值"
    )

class SettlementResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    reports = SettlementVariantSerializer(many=True)
    debug = serializers.DictField(required=False)

class GameChapterProgressSerializer(serializers.Serializer):
    currentChapter = serializers.IntegerField()
    totalChapters = serializers.IntegerField()

class GameChapterStatusResponseSerializer(serializers.Serializer):
    """章节状态查询响应"""
    status = serializers.ChoiceField(
        choices=['pending', 'generating', 'ready', 'error'],
        help_text="章节状态: pending(未开始)/generating(生成中)/ready(已完成)/error(错误)"
    )
    message = serializers.CharField(required=False, help_text="状态说明")
    progress = GameChapterProgressSerializer(required=False, help_text="生成进度(仅在generating时返回)")
    chapter = GameChapterResponseSerializer(required=False, help_text="章节内容(仅在ready时返回)")

class GameSaveStateSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField(required=True, allow_null=True)
    sceneId = serializers.IntegerField(required=True, allow_null=True)
    dialogueIndex = serializers.IntegerField(required=False, allow_null=True)
    attributes = serializers.DictField(child=serializers.IntegerField(), required=False, default=dict)
    statuses = serializers.DictField(child=serializers.JSONField(), required=False, default=dict)
    choiceHistory = serializers.ListField(child=serializers.DictField(), required=False, default=list)

class GameSavePayloadSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    timestamp = serializers.IntegerField(required=False, allow_null=True)
    state = GameSaveStateSerializer()