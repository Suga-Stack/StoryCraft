import os
import json
import random
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from volcenginesdkarkruntime import Ark
from stories.models import Story, StoryChapter
from gameworks.models import Gamework
from tags.models import Tag

class Choice(BaseModel):
    """选项及属性值变化"""
    text: str
    attributesDelta: Optional[Dict[str, int]] = Field(default_factory=dict)
    subsequentDialogues: List[str]

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

class ChapterContent(BaseModel):
    """章节内容，即一组场景的集合"""
    chapterIndex: int
    title: str
    scenes: List[Scene]
    isGameEnding: Optional[bool] = False

class GameworkDetails(BaseModel):
    title: str = Field(description="生成的作品标题")
    description: str = Field(description="生成的作品简介")
    initialAttributes: Dict[str, int] = Field(description="初始属性值")
    statuses: Dict[str, Dict[str, int]] = Field(description="全部状态标签及其属性阈值")

client = Ark(
    api_key="3f00ab95-6096-4639-a8b0-09c711a63d9c",
    base_url="https://ark.cn-beijing.volces.com/api/v3",
)

def _get_system_prompt(gamework: Gamework) -> str:
    """根据游戏标签和总章节数返回SystemPrompt"""
    tags = ', '.join([tag.name for tag in gamework.tags.all()]) if hasattr(gamework, 'tags') else ""
    total_chapters = gamework.story.total_chapters
    return f"""
# 任务
你是一位顶级的文字冒险游戏设计师。共需要为用户生成{total_chapters}章的剧情。
在剧情结构上，定义主角每一个地点切换为一个"场景(Scene)"，每章可以包含一个或多个场景(Scene)，每个场景包含若干对白和选项。每一章剧情长度在3000字左右。
你需要对出现的场景画面(backendgroundImage)进行简单描述。

# 游戏作品信息
- 标题: {gamework.title}
- 简介: {gamework.description}
- 标签: {tags}

# 生成要求
- 创建有深度的剧情，符合作品主题
- 每个选项应导向不同的结果，但这些结果无关剧情主线走向，仅会在几句话的上下文范围内影响剧情，不同选项最终都要收敛到主线剧情
- 加入场景描写，增强沉浸感
- 请提前规划好剧情大纲，设置4到5个主角初始属性或状态，玩家的每个选项可能会影响或改变这些状态

# 数据格式要求
请严格按照用户要求的模板格式生成章节内容

注：
如果是章节最后一个场景，应添加"isChapterEnding: true"来表示章节结束。
如果是最终章节（第{total_chapters}章），结束章节应该添加"isGameEnding": true来表示游戏结束。
请不要添加注释，直接生成有效的JSON对象。
"""

def _generate_chapter_with_ai(messages) :
    """使用豆包API生成一个章节"""
    try:
        completion = client.beta.chat.completions.parse(
            model="doubao-seed-1-6-250615",  
            messages=messages,
            response_format=ChapterContent,
            extra_body={
                "thinking": {
                "type": "disabled" # 不使用深度思考能力
                }
            }
        )
        chapter = completion.choices[0].message.parsed
        return chapter
        
    except Exception as e:
        print(f"AI生成错误: {e}")

def _generate_chapter(gamework: Gamework, chapter_index: int):
    """生成指定章节的内容"""
    
    story, created = Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': 3}
    )

    chapters = story.chapters.all()
    messages = [{"role": "system", "content": _get_system_prompt(gamework)}]

    for chapter in chapters:
        messages.extend([
            {"role": "user", "content": f"现在请你生成第{chapter.chapter_index}章的内容"},
            {"role": "assistant", "content": json.dumps(chapter.content,ensure_ascii=False)}
        ])

    messages.append({"role": "user", "content": f"现在请你生成第{chapter_index}章的内容"})

    chapter_content = _generate_chapter_with_ai(messages)
    chapter, created = StoryChapter.objects.update_or_create(
        story=story,
        chapter_index=chapter_index,
        defaults={
            'content': chapter_content.model_dump()
        }
    )

    # 检查是否所有章节都已生成，如是则标记Story为完成
    if story.generated_chapters_count == story.total_chapters:
        story.is_complete = True
        story.save()
        
    return chapter

def _generate_gamework_details_with_ai(tags: List[str], idea: str, length: str) -> GameworkDetails:
    """使用AI生成游戏作品的文本详情"""

    length = length.lower().strip()  

    prompt = f"""
# 任务
你是一位顶级的游戏策划师。请根据用户提供的核心信息，为一款新的文字冒险游戏生成基础设定。

# 用户输入
- 核心标签: {', '.join(tags)}
- 核心构思: {idea if idea else '无特定构思，请根据标签自由发挥'}
- 篇幅要求: {length if length in {"short","medium","long"} else "medium"}

# 生成要求
请生成以下内容：
1.  一个吸引人的游戏标题 (title)。
2.  一段引人入胜的游戏简介 (description)，大约100-150字。
3.  一套初始玩家属性 (initialAttributes)，包含2-4个核心数值属性，并设定初始值。
4.  一套玩家状态等级 (statuses)，定义几个关键的成长状态以及达到该状态所需的属性阈值。

# 数据格式要求
请严格按照指定的JSON格式输出，不要添加任何额外解释。

# 示例
{
  "title":"xxxx",
  "description":"作品简介",
  "initialAttributes":{
    "人气":100,
    "灵石":1000,
  },
  "statuses":{
    "初出茅庐":{
      "人气":120,
      "灵石":1200
    },
    "小有名气":{
      "人气":200
    }
  }
}
"""
    
    try:
        completion = client.beta.chat.completions.parse(
            model="doubao-seed-1-6-250615",
            messages=[
                {"role": "system", "content": "你是一位专业的文字冒险游戏策划师，请按照用户要求的格式生成内容。"},
                {"role": "user", "content": prompt}
            ],
            response_format=GameworkDetails
        )
        return completion.choices[0].message.parsed
    except Exception as e:
        print(f"AI生成作品详情错误: {e}")

        # 返回一个备用的模拟数据
        return GameworkDetails(
            title="AI生成失败的模拟作品",
            description="这是一个在AI生成失败时返回的模拟作品简介。",
            initialAttributes={"灵石": 100, "声望": 0},
            statuses={"初出茅庐": {"声望": 10}, "小有名气": {"声望": 100}}
        )

def _generate_cover_image_with_ai(tags: List[str], idea: str) -> str:
    """使用AI生成封面图片URL"""

    prompt = f"一部关于“{', '.join(tags)}”的文字冒险游戏的游戏封面, 主题：{idea if idea else '无特定主题，请根据标签自由发挥'}；二次元动漫风格, 色彩鲜艳"
    try:
        response = client.images.generate(
            model="doubao-seedream-4-0-250828",
            prompt=prompt,
            response_format="url",
            size="2k",
            watermark=True
        )
        if response.data:
            print(response.data[0].url)
            return response.data[0].url
        return "" 
    except Exception as e:
        print(f"AI生成封面图片错误: {e}")
        return "https://ark-project.tos-cn-beijing.volces.com/doc_image/seedream4_imageToimage.png" 

def _resolve_total_chapters(length: Optional[str]) -> int:
    """根据篇幅映射章节数量"""
    ranges = {
        "short": (3, 5),
        "medium": (6, 10),
        "long": (11, 15),
    }
    min_chapters, max_chapters = ranges.get((length or "").lower().strip(), (6, 10))
    return random.randint(min_chapters, max_chapters)

def create_gamework(user, tags: List[str], idea: str, length: str) -> dict:
    """
    创建新游戏作品的完整流程。
    1. 调用AI生成文本详情。
    2. 调用AI生成封面图片。
    3. 创建并保存Gamework实例。
    4. 返回生成的数据。
    """

    details = _generate_gamework_details_with_ai(tags, idea, length)

    cover_url = _generate_cover_image_with_ai(tags, idea)

    gamework = Gamework.objects.create(
        author=user,
        title=details.title,
        description=details.description,
        image_url=cover_url,
    )

    total_chapters = _resolve_total_chapters(length)
    Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': total_chapters}
    )

    # 关联标签
    tag_objects = []
    for tag_name in tags:
        tag, _ = Tag.objects.get_or_create(name=tag_name)
        tag_objects.append(tag)
    gamework.tags.set(tag_objects)

    # 返回生成的数据给前端
    return {
        "gameworkId": gamework.gamework_id,
        "title": details.title,
        "coverUrl": cover_url,
        "description": details.description,
        "initialAttributes": details.initialAttributes,
        "statuses": details.statuses
    }

def get_or_generate_chapter(gamework: Gamework, chapter_index: int) -> dict:
    """
    获取或生成指定章节的内容。
    如果章节已存在，直接从数据库返回;否则，调用AI生成。
    """
    story, created = Story.objects.get_or_create(
        gamework=gamework,
        defaults={'total_chapters': _resolve_total_chapters(None)}
    )

    total_chapters = story.total_chapters

    try:
        chapter = StoryChapter.objects.get(story=story, chapter_index=chapter_index)
        return chapter.content
    except StoryChapter.DoesNotExist:
        pass

    if chapter_index > total_chapters:
        raise ValueError(f"请求的章节索引 {chapter_index} 超出总章节数 {total_chapters}。")

    generated_chapter = _generate_chapter(gamework, chapter_index)
    return generated_chapter.content
