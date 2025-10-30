from django.db import models
from gameworks.models import Gamework

class Story(models.Model):
    """
    完整故事模型，关联到一个游戏作品(Gamework)。
    一个Story包含多个章节(StoryChapter)，代表一个完整的冒险故事。
    """
    gamework = models.OneToOneField(Gamework, on_delete=models.CASCADE, related_name='story', help_text="关联的游戏作品")
    total_chapters = models.PositiveIntegerField(default=3, help_text="计划总章节数")
    is_complete = models.BooleanField(default=False, help_text="故事是否已完成生成")
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
    每个章节的内容以结构化的JSON格式存储。
    """
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='chapters', help_text="关联的故事")
    chapter_index = models.PositiveIntegerField(help_text="章节序号 (从1开始)")

    # 存储整个章节的结构化数据，包括序号，标题，所有场景、选项和分支
    content = models.JSONField(help_text="章节内容的JSON结构")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'chapter_index') # 每个故事的章节序号唯一
        ordering = ['story', 'chapter_index']

    def __str__(self):
        return f"{self.story.gamework.title} - Chapter {self.chapter_index}"
