from rest_framework import serializers


class GameCreateSerializer(serializers.Serializer):
    """创建游戏请求序列化器"""

    tags = serializers.ListField(
        child=serializers.CharField(max_length=50), min_length=3, max_length=6, help_text="用户选择的标签数组（3-6个）"
    )
    idea = serializers.CharField(allow_blank=True, required=False, help_text="用户输入的构思文本")
    length = serializers.ChoiceField(
        choices=["short", "medium", "long"],
        help_text="篇幅类型：'short' (3-5章) / 'medium' (6-10章) / 'long' (10章以上)",
    )
    modifiable = serializers.BooleanField(required=False, default=False, help_text="是否为创作者模式")

    def validate_tags(self, value):
        if not (3 <= len(value) <= 6):
            raise serializers.ValidationError("标签数量必须在3到6个之间。")
        return value


class GameChapterChoiceSerializer(serializers.Serializer):
    choiceId = serializers.IntegerField()
    text = serializers.CharField()
    attributesDelta = serializers.DictField(
        child=serializers.IntegerField(), required=False, allow_null=True, default=dict
    )
    statusesDelta = serializers.DictField(child=serializers.JSONField(), required=False, allow_null=True, default=dict)
    subsequentDialogues = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)


class GameChapterDialogueSerializer(serializers.Serializer):
    narration = serializers.CharField()
    playerChoices = GameChapterChoiceSerializer(many=True, required=False, allow_null=True)


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


class EndingGenerateSerializer(serializers.Serializer):
    """结局生成请求序列化器"""

    title = serializers.CharField(help_text="标题")
    outline = serializers.CharField(help_text="修改后的结局大纲")
    userPrompt = serializers.CharField(required=False, allow_blank=True, help_text="用户提示词")


class GameChapterProgressSerializer(serializers.Serializer):
    currentChapter = serializers.IntegerField()
    totalChapters = serializers.IntegerField()


class GameChapterStatusResponseSerializer(serializers.Serializer):
    """章节状态查询响应"""

    status = serializers.ChoiceField(
        choices=["pending", "generating", "ready", "error"],
        help_text="章节状态: pending(未开始)/generating(生成中)/ready(已完成)/error(错误)",
    )
    message = serializers.CharField(required=False, help_text="状态说明")
    progress = GameChapterProgressSerializer(required=False, help_text="生成进度(仅在generating时返回)")
    chapter = GameChapterResponseSerializer(required=False, help_text="章节内容(仅在ready时返回)")


class GameSaveStateSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField(required=False, allow_null=True)
    endingIndex = serializers.IntegerField(required=False, allow_null=True)
    sceneId = serializers.IntegerField(required=True, allow_null=True)
    dialogueIndex = serializers.IntegerField(required=False, allow_null=True)
    attributes = serializers.DictField(child=serializers.IntegerField(), required=False, default=dict)
    statuses = serializers.DictField(child=serializers.JSONField(), required=False, default=dict)
    choiceHistory = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class GameSavePayloadSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True)
    timestamp = serializers.IntegerField(required=False, allow_null=True)
    state = GameSaveStateSerializer()
