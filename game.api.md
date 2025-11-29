## 1. 创建游戏
- 方法：POST
- 路径：/api/game/create
- 描述：根据用户选择的标签、篇幅、构思等信息创建新作品，后端生成标题、封面、作品简介等内容。
- 请求体（完整参数）：
```json
{
  "tags": ["玄幻", "穿越", "系统", "升级流"],
  "idea": "一个现代女孩穿越到修仙世界，获得氪金系统...",
  "length": "medium"
}
```
- 后端返回示例：
```json
{
  "gameworkId":123,
  "title":"xxxx",
  "coverUrl":"xxx.jpg",
  "description":"作品简介",
  "initialAttributes":{
    "人气":100,
    "灵石":1000,
  },
  "initialStatuses":{
    "修为": "炼气期三层"
  }
}
```
- 参数说明：
  - `tags` (Array, 必须) - 用户选择的标签数组（严格3-6个），如类型、风格、世界观等
  - `idea` (String, 可为空) - 用户输入的构思文本，一句话概述或开头设定
  - `length` (String, 必须) - 篇幅类型：`"short"` (3-5章) / `"medium"` (6-10章) / `"long"` (10章以上)
- 返回值
  - `gameworkId` (int, 必须)
  - `description` (String, 必须) - 作品简介
  - `coverUrl` (String, 必须) - 封面图片 URL
  - `initialAttributes` (Object, 必须) - 初始属性值（如灵石、人气等），属性值为 int
  - `statuses` (Object, 必选) - 当前状态集合，键为状态名，值为状态值（通常为字符串或布尔/数值），例如 { "修为": "炼气期三层" }


- 前端处理策略（已在 `createWork.js` 中实现）：
  - 从 `CreateWork.vue` 收集用户输入：`tags`、`idea`、`length`
  - 通过 `createWorkOnBackend(payload)` 发送到后端
  - 前端将结果保存到 sessionStorage，供游戏页面使用

**注意事项：**
- `tags` 数组应包含 3-6 个标签，涵盖类型、风格、世界观等维度
- `length` 影响后端生成的章节数量和故事长度规划
- `idea` 会作为提示词注入到 AI 生成过程中

---

## 2. 获取游戏章节内容
- 方法：POST
- 路径：/api/game/chapter/
- 描述：根据作品ID和章节索引获取章节内容。如果内容尚未生成，后端将调用AI实时生成并返回。如果已生成，则直接从数据库读取。
- 请求体：
```json
{
  "gameworkId": 123,
  "chapterIndex": 1
}
```
- 后端返回示例（成功时）：
```json
{
  "chapterIndex": 1,
  "title": "第一章：初入异世",
  "scenes": [
    {
      "id": 1,
      "backgroundImage": "古色古香的房间，雕花木窗外是繁忙的古代街道",
      "dialogues": [
        {
          "narration": "你睁开眼，发现自己躺在一张古朴的木床上。陌生的环境让你意识到，你似乎穿越了。",
          "playerChoices": null
        },
        {
          "narration": "一个声音在你脑海中响起：【氪金系统已激活，新手礼包已发放，获得灵石1000】",
          "playerChoices": [
            {
              "id": "c_1",
              "text": "“这是什么情况？”",
              "attributesDelta": {},
              "statusesDelta": {},
              "subsequentDialogues": ["系统毫无感情地回答：【欢迎来到修仙世界，宿主。】","系统提示：【宿主心态良好，有助于后续发展。】"]
            },
            {
              "id": "c_2",
              "text": "“太棒了，我的金手指到了！”",
              "attributesDelta": {"心态": 1},
              "statusesDelta": {"宿主乐观": true},
              "subsequentDialogues": ["系统提示：【宿主心态良好，有助于后续发展。】"]
            }
          ]
        }
      ],
      "isChapterEnding": false
    }
  ],
  "isGameEnding": false
}
```
- 参数说明：
  - `gameworkId` (Integer, 必须) - 游戏作品的ID。
  - `chapterIndex` (Integer, 必须) - 要获取的章节序号（从1开始）。

- 前端处理策略：
  - 玩家进入游戏或完成一章后，根据当前进度请求下一章内容。
  - 请求 `chapterIndex` 为 `1` 获取第一章，完成第一章后请求 `chapterIndex` 为 `2`，以此类推。
  - 将获取到的章节内容数据用于渲染游戏画面。

### 响应结构
```python
class GameChapterResponseSerializer(serializers.Serializer):
    chapterIndex = serializers.IntegerField()
    title = serializers.CharField()
    scenes = GameChapterSceneSerializer(many=True)
    isGameEnding = serializers.BooleanField(required=False)

class GameChapterSceneSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    backgroundImage = serializers.CharField()
    dialogues = GameChapterDialogueSerializer(many=True)
    isChapterEnding = serializers.BooleanField(required=False)

class GameChapterDialogueSerializer(serializers.Serializer):
    narration = serializers.CharField()
    playerChoices = GameChapterChoiceSerializer(many=True, required=False, allow_null=True)

class GameChapterChoiceSerializer(serializers.Serializer):
    text = serializers.CharField()
  id = serializers.CharField(required=False)
  text = serializers.CharField()
  attributesDelta = serializers.DictField(child=serializers.IntegerField(), required=False, default=dict)
  statusesDelta = serializers.DictField(child=serializers.JSONField(), required=False, default=dict)
  subsequentDialogues = serializers.ListField(child=serializers.CharField())
```

### 模型定义
```python
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
```
