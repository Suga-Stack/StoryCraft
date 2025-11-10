from django.db import models
from gameworks.models import Gamework

class Story(models.Model):
    """
    完整故事模型，关联到一个游戏作品(Gamework)。
    一个Story包含多个章节(StoryChapter)，代表一个完整的冒险故事。
    """
    gamework = models.OneToOneField(Gamework, on_delete=models.CASCADE, related_name='story', help_text="关联的游戏作品")
    total_chapters = models.PositiveIntegerField(default=3, help_text="计划总章节数")
    initial_attributes = models.JSONField(help_text="故事初始主角属性值")
    initial_statuses = models.JSONField(help_text="主角初始状态")
    
    # 创作者模式相关
    ai_callable = models.BooleanField(default=False, help_text="是否允许创作者调用AI生成")
    outlines = models.JSONField(default=list, blank=True, help_text="所有章节的大纲")

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
    
    @property
    def completion_percentage(self):
        """故事生成完成度百分比"""
        if self.total_chapters > 0:
            return (self.generated_chapters_count / self.total_chapters) * 100
        return 0

class StoryChapter(models.Model):
    """
    故事章节模型，存储由AI生成的单个章节内容。
    每个章节由多个场景组成。
    """
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='chapters', help_text="关联的故事")
    chapter_index = models.PositiveIntegerField(help_text="章节序号 (从1开始)")
    title = models.CharField(max_length=255, help_text="章节标题")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('story', 'chapter_index')
        ordering = ['story', 'chapter_index']

    def __str__(self):
        return f"{self.story.gamework.title} - Chapter {self.chapter_index}"

class StoryScene(models.Model):
    """故事场景模型，记录场景及其对白、选项。"""
    chapter = models.ForeignKey(StoryChapter, on_delete=models.CASCADE, related_name='scenes', help_text="关联的章节")
    scene_index = models.PositiveIntegerField(help_text="场景序号 (从1开始)")
    background_image = models.TextField(help_text="场景背景描述")
    background_image_url = models.CharField(max_length=512, help_text="背景图片URL")
    dialogues = models.JSONField(default=list, help_text="场景对白与选项")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('chapter', 'scene_index')
        ordering = ['chapter', 'scene_index']

    def __str__(self):
        return f"{self.chapter.story.gamework.title} - Chapter {self.chapter.chapter_index} - Scene {self.scene_index}"
