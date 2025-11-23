from django.db import models
from gameworks.models import Gamework

class Story(models.Model):
    """
    完整故事模型，关联到一个游戏作品(Gamework)。
    一个Story包含多个章节(StoryChapter)，代表一个完整的冒险故事。
    """
    gamework = models.OneToOneField(Gamework, on_delete=models.CASCADE, related_name='story', help_text="关联的游戏作品")
    total_chapters = models.PositiveIntegerField(default=3, help_text="计划总章节数")
    initial_attributes = models.JSONField(default=dict, help_text="故事初始主角属性值")
    initial_statuses = models.JSONField(default=dict,blank=True,null=True, help_text="主角初始状态")

    core_seed = models.TextField(default="", help_text="用于生成故事的核心剧情种子")
    attribute_system = models.TextField(default="", help_text="完整属性系统")
    characters = models.TextField(default="", help_text="主要角色设定")
    architecture = models.TextField(default="", help_text="叙事架构")
    chapter_directory = models.TextField(default="", help_text="章节目录")
    global_summary = models.TextField(default="", help_text="全局摘要")
    outlines = models.JSONField(default=list, blank=True, help_text="所有章节的大纲")
    endings_summary = models.JSONField(default=list,blank=True,null=True, help_text="结局梗概")

    # 创作者模式相关
    ai_callable = models.BooleanField(default=False, help_text="是否允许创作者调用AI生成")

    # 生成状态
    initial_generation_complete = models.BooleanField(default=False, help_text="初始信息（标题、简介、封面、大纲）是否生成完成")
    is_complete = models.BooleanField(default=False, help_text="故事是否已完成生成")
    is_generating = models.BooleanField(default=False, help_text="是否正在生成中")
    current_generating_chapter = models.PositiveIntegerField(default=0, help_text="当前正在生成的章节索引")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Story for {self.gamework.title}"
    
    @property
    def generated_chapters_count(self):
        """已生成的章节数量"""
        return self.chapters.count()
    
    def update_generation_status(self):
        """更新生成状态"""
        self.initial_generation_complete = bool(
            self.core_seed and 
            self.outlines and 
            self.gamework.image_url
        )
        self.save()    
        
class StoryChapter(models.Model):
    """
    故事章节模型，存储由AI生成的单个章节内容。
    每个章节由多个场景组成。
    """
    class ChapterStatus(models.TextChoices):
        GENERATING = 'generating'
        GENERATED = 'generated'
        SAVED = 'saved'

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='chapters', help_text="关联的故事")
    chapter_index = models.PositiveIntegerField(help_text="章节序号 (从1开始)")
    title = models.CharField(max_length=255, help_text="章节标题")

    raw_content = models.TextField(default="", help_text="章节原始文本")
    parsed_content = models.JSONField(default=dict, help_text="格式化后的章节内容")

    status = models.CharField(
        max_length=20,
        choices=ChapterStatus.choices,
        default=ChapterStatus.GENERATING,
        help_text="章节状态"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('story', 'chapter_index')
        ordering = ['story', 'chapter_index']

    def __str__(self):
        return f"{self.story.gamework.title} - Chapter {self.chapter_index}"

class StoryEnding(models.Model):
    """
    故事结局模型，存储生成的完整结局内容。
    """
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='story_endings', help_text="关联的故事")
    title = models.CharField(max_length=255, help_text="结局标题")
    condition = models.JSONField(default=dict, help_text="触发条件")
    summary = models.TextField(default="", help_text="结局梗概")
    
    raw_content = models.TextField(default="", help_text="结局原始文本")
    parsed_content = models.JSONField(default=dict, help_text="格式化后的结局内容")
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.story.gamework.title} - Ending: {self.title}"

class StoryScene(models.Model):
    """故事场景模型，记录场景及其对白、选项。"""
    # chapter 允许为空，以便场景可以关联到 ending
    chapter = models.ForeignKey(StoryChapter, on_delete=models.CASCADE, related_name='scenes', null=True, blank=True, help_text="关联的章节")
    ending = models.ForeignKey(StoryEnding, on_delete=models.CASCADE, related_name='scenes', null=True, blank=True, help_text="关联的结局")
    
    scene_index = models.PositiveIntegerField(help_text="场景序号 (从1开始)")
    background_image_url = models.CharField(max_length=512, help_text="背景图片URL")
    dialogues = models.JSONField(default=list, help_text="场景对白与选项")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['chapter', 'ending', 'scene_index']

    def __str__(self):
        if self.chapter:
            return f"{self.chapter.story.gamework.title} - Chapter {self.chapter.chapter_index} - Scene {self.scene_index}"
        elif self.ending:
            return f"{self.ending.story.gamework.title} - Ending {self.ending.title} - Scene {self.scene_index}"
        return f"Orphan Scene {self.id}"
