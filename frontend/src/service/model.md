```python 
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from volcenginesdkarkruntime import Ark
from stories.models import Story, StoryChapter

class Choice(BaseModel):
    """选项及属性值变化"""
    text: str
    attributesDelta: Optional[Dict[str, int]] = Field(default_factory=dict)
    statusesDelta: Optional[Dict[str, Any]] = Field(default_factory=dict)
    subsequentDialogue: List[str]

class DialogueItem(BaseModel):
    """旁白，或旁白加选项"""
    narration: str
    playerChoices: Optional[List[Choice]] = None

class Scene(BaseModel):
    """场景，游戏中的一个画面单元"""
    id: int
    backgroundImage: str
    dialogues: List[DialogueItem]  
    isChapterEnding: Optional[bool] = False
    isGameEnding: Optional[bool] = False

class ChapterContent(BaseModel):
    """章节内容，即一组场景的集合"""
    chapterIndex: int
    title: str
    scenes: List[Scene]

```