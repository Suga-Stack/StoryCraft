import os
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sympy import true
from volcenginesdkarkruntime import Ark
from stories.models import Story, StoryChapter

# 定义Pydantic模型以匹配接口文档中的数据结构
class DialogueItem(BaseModel):
    """对白项 - 可以是简单字符串或带背景图的对象"""
    text: str
    backgroundImage: Optional[str] = None

class Choice(BaseModel):
    """选项 - 玩家可选择的选项"""
    id: str  
    text: str
    attributesDelta: Optional[Dict[str, int]] = Field(default_factory=dict)
    statusesDelta: Optional[Dict[str, Any]] = Field(default_factory=dict)
    nextSceneId: str

class Scene(BaseModel):
    """场景 - 游戏中的一个画面单元"""
    id: str
    backgroundImage: Optional[str] = None
    dialogues: List[DialogueItem]  
    choiceTriggerIndex: Optional[int] = None
    choices: Optional[List[Choice]] = None
    isEnding: Optional[bool] = False
    isGameEnding: Optional[bool] = False

class ChapterContent(BaseModel):
    """章节内容 - 一组场景的集合"""
    chapterIndex: int
    title: str
    scenes: Dict[str, Scene]  # 场景ID到场景对象的映射

client = Ark(
    api_key="3f00ab95-6096-4639-a8b0-09c711a63d9c",
    base_url="https://ark.cn-beijing.volces.com/api/v3",
)

class AIGenerationService:
    """封装与AI剧情生成相关的所有逻辑，按章节生成。"""
    
    def _generate_chapter_with_ai(self, prompt: str) -> ChapterContent:
        """使用豆包API生成一个章节"""
        try:
            # 调用AI生成章节内容
            completion = client.beta.chat.completions.parse(
                model="doubao-seed-1-6-250615",  
                messages=[
                    {"role": "system", "content": "你是一位专业的游戏剧情编剧。"},
                    {"role": "user", "content": prompt}
                ],
                response_format=ChapterContent,
                extra_body={
                    "thinking": {
                    "type": "disabled" # 不使用深度思考能力
                    }
                }
            )
            response = completion.choices[0].message.parsed
            return response
            
        except Exception as e:
            print(f"AI生成错误: {e}")
            # 出错时返回模拟数据
            return self._get_mock_chapter(1)

    def _get_mock_chapter(self, chapter_index=1) -> ChapterContent:
        """开发测试用：返回一个模拟的章节内容"""
        print(f"--- 使用模拟章节数据 (章节 {chapter_index}) ---")
        
        # 创建一个唯一的场景ID前缀
        prefix = f"ch{chapter_index}_"
        
        # 为每章定义不同的主题和场景
        themes = {
            1: {"title": "迷雾森林的召唤", "setting": "森林入口", "goal": "寻找古老的遗迹"},
            2: {"title": "古城的秘密", "setting": "废弃城市", "goal": "解开古城之谜"},
            3: {"title": "最终决战", "setting": "神秘神殿", "goal": "对抗远古邪恶"}
        }
        
        theme = themes.get(chapter_index, themes[1])
        
        # 构建场景集合
        scenes = {}
        
        # 起始场景
        start_scene_id = f"{prefix}scene_01_start"
        scenes[start_scene_id] = {
            "id": start_scene_id,
            "backgroundImage": f"url/to/chapter{chapter_index}_start.jpg",
            "dialogues": [
                {"text": f"（场景描写）你站在{theme['setting']}前，远处云雾缭绕。", "backgroundImage": f"url/to/chapter{chapter_index}_panorama.jpg"},
                f"这里就是传说中的{theme['setting']}，据说隐藏着不为人知的秘密。",
                "微风拂过你的脸庞，带来一丝凉意。",
                f"你的目标是{theme['goal']}，但首先要找到进入的方法。"
            ],
            "choiceTriggerIndex": 3,
            "choices": [
                {
                    "id": f"{prefix}choice_01_explore",
                    "text": "仔细探索周围环境",
                    "attributesDelta": {"观察力": 2},
                    "statusesDelta": {"线索发现": 1},
                    "nextSceneId": f"{prefix}scene_02_explore"
                },
                {
                    "id": f"{prefix}choice_01_rush",
                    "text": "直接向前方走去",
                    "attributesDelta": {"勇气": 3, "谨慎": -1},
                    "nextSceneId": f"{prefix}scene_03_rush"
                }
            ]
        }
        
        # 探索场景
        explore_scene_id = f"{prefix}scene_02_explore"
        scenes[explore_scene_id] = {
            "id": explore_scene_id,
            "backgroundImage": f"url/to/chapter{chapter_index}_explore.jpg",
            "dialogues": [
                "你仔细查看周围的环境，发现一些奇怪的痕迹。",
                {"text": "（场景描写）地面上有一些看似随意的石块排列，像是某种图案。", "backgroundImage": f"url/to/chapter{chapter_index}_pattern.jpg"},
                "你蹲下身来，拨开杂草，看到一个古老的符号。"
            ],
            "choiceTriggerIndex": 2,
            "choices": [
                {
                    "id": f"{prefix}choice_02_pattern",
                    "text": "尝试理解符号的含义",
                    "attributesDelta": {"智慧": 2},
                    "statusesDelta": {"古代知识": 1},
                    "nextSceneId": f"{prefix}scene_04_pattern"
                },
                {
                    "id": f"{prefix}choice_02_ignore",
                    "text": "忽略符号，继续前进",
                    "attributesDelta": {"实用主义": 1},
                    "nextSceneId": f"{prefix}scene_05_continue"
                }
            ]
        }
        
        # 直接前进场景
        rush_scene_id = f"{prefix}scene_03_rush"
        scenes[rush_scene_id] = {
            "id": rush_scene_id,
            "dialogues": [
                "你果断向前走去，穿过茂密的植被。",
                "突然，你的脚下一空，踩到了一个隐藏的陷阱！",
                {"text": "（场景描写）你滑入一个倾斜的通道，向下方的黑暗滑去。", "backgroundImage": f"url/to/chapter{chapter_index}_trap.jpg"}
            ],
            "choiceTriggerIndex": 2,
            "choices": [
                {
                    "id": f"{prefix}choice_03_grab",
                    "text": "尝试抓住什么来减缓下滑",
                    "attributesDelta": {"敏捷": 2, "力量": 1},
                    "nextSceneId": f"{prefix}scene_06_grab"
                },
                {
                    "id": f"{prefix}choice_03_slide",
                    "text": "控制姿势，顺势滑下",
                    "attributesDelta": {"适应力": 2},
                    "nextSceneId": f"{prefix}scene_07_slide"
                }
            ]
        }
        
        # 后续场景(简化)...
        pattern_scene_id = f"{prefix}scene_04_pattern"
        scenes[pattern_scene_id] = {
            "id": pattern_scene_id,
            "dialogues": [
                "通过研究符号，你理解了这是一个指向特定方向的标记。",
                "顺着标记指示的方向，你发现了一条隐藏的小路。"
            ],
            "choiceTriggerIndex": 1,
            "choices": [
                {
                    "id": f"{prefix}choice_04_follow",
                    "text": "沿着小路前进",
                    "nextSceneId": f"{prefix}scene_08_end"
                }
            ]
        }
        
        # 章节结束场景
        end_scene_id = f"{prefix}scene_08_end"
        end_scene = {
            "id": end_scene_id,
            "backgroundImage": f"url/to/chapter{chapter_index}_ending.jpg",
            "dialogues": [
                {"text": f"（场景描写）道路尽头，你发现了一个神秘的入口。", "backgroundImage": f"url/to/chapter{chapter_index}_entrance.jpg"},
                f"第{chapter_index}章 —— {theme['title']} 结束",
                "你准备好迎接下一章的挑战了吗？"
            ],
            "isEnding": True,
            "choices": []
        }
        
        # 如果是最后一章，标记为游戏结束
        if chapter_index == 3:
            end_scene["isGameEnding"] = True
            end_scene["dialogues"].append("恭喜你完成了整个游戏！远古邪恶已被封印，世界恢复和平。")
            
        scenes[end_scene_id] = end_scene
        
        # 添加其他场景(简化)...
        for scene_id in [f"{prefix}scene_05_continue", f"{prefix}scene_06_grab", f"{prefix}scene_07_slide"]:
            scenes[scene_id] = {
                "id": scene_id,
                "dialogues": [
                    f"这是{scene_id}的内容，通常这里会有更详细的描述。",
                    "为了简化示例，我们省略了具体内容。"
                ],
                "choices": [
                    {
                        "id": f"{scene_id}_choice",
                        "text": "继续前进",
                        "nextSceneId": end_scene_id
                    }
                ]
            }
            
        return ChapterContent(
            chapterIndex=chapter_index,
            title=theme["title"],
            scenes=scenes
        )

    def _build_chapter_prompt(self, gamework, chapter_index, total_chapters) -> str:
        """构建生成完整章节的Prompt"""
        tags = ', '.join([tag.name for tag in gamework.tags.all()]) if hasattr(gamework, 'tags') else ""
        
        return f"""
# 任务
你是一位顶级的文字冒险游戏设计师。请为以下游戏作品生成第{chapter_index}章的完整内容（总共{total_chapters}章）。
在游戏结构上，每章应该包含多个场景(Scene)，每个场景包含对白和选项，选项会引导到不同的场景。每一章剧情长度在1500字左右。

# 游戏作品信息
- 标题: {gamework.title}
- 简介: {gamework.description}
- 标签: {tags}

# 生成要求
- 创建有深度的剧情，符合作品主题
- 每个选项应导向不同的结果，但这些结果无关剧情主线走向，仅会在几句话的上下文范围内影响剧情，不同选项最终都要收敛到章节结尾
- 加入场景描写，增强沉浸感
- 选择应该影响角色属性和状态

# 数据格式要求
请严格按照以下JSON模板格式生成章节内容:

{
    "chapterIndex": {chapter_index},
    "title": "章节标题",
    "scenes": {{
        "ch{chapter_index}_scene_01_start": {
            "id": "ch{chapter_index}_scene_01_start",
            "backgroundImage": "故事场景背景图描述，如'森林小径'，应尽量详细",
            "dialogues": [
                {"text": "（场景描写）详细的环境描述或其他...", "backgroundImage": "可选的特定背景图"},
                {"text":"普通对白文本1"},
                {"text":"普通对白文本2"}
            ],
            "choiceTriggerIndex": 2,
            "choices": [
                {
                "id": "ch{chapter_index}_choice_01_A",
                "text": "选项A的描述",
                "attributesDelta": {{"观察力": 2, "智慧": 1}},
                "statusesDelta": {{"线索发现": 1}},
                "nextSceneId": "ch{chapter_index}_scene_02"
                },
                {
                "id": "ch{chapter_index}_choice_01_B",
                "text": "选项B的描述",
                "attributesDelta": {{"勇气": 2}},
                "nextSceneId": "ch{chapter_index}_scene_03"
                }
            ]
        },
        "ch{chapter_index}_scene_02": {
            "# 场景2定义，选择A后的场景"
        },
        "ch{chapter_index}_scene_XX_end": {
            "id": "ch{chapter_index}_scene_XX_end",
            "backgroundImage": "章节结束场景背景",
            "dialogues": [
                "# 章节结束描述..."
            ],
            "isEnding": true, 
            "choices": []
        }
    }}
}

如果是最终章节（第{total_chapters}章），结束场景应该添加`"isGameEnding": true`来表示游戏结束。
场景ID应该以章节编号开头，如`ch{chapter_index}_scene_XX`，确保唯一性。
请不要添加注释，直接生成有效的JSON对象。
"""

    def ensure_story_exists(self, gamework, total_chapters=3):
        """确保Gamework关联的Story存在，如不存在则创建"""
        story, created = Story.objects.get_or_create(
            gamework=gamework,
            defaults={'total_chapters': total_chapters}
        )
        return story
        
    def generate_chapter(self, gamework, chapter_index=1):
        """强制生成指定章节的内容"""
        # 确保Story存在
        story = self.ensure_story_exists(gamework)
        
        # 生成章节内容
        prompt = self._build_chapter_prompt(gamework, chapter_index, story.total_chapters)
        
        # 开发阶段使用模拟数据，生产环境使用AI
        if os.environ.get("USE_MOCK_DATA", "True") == "True":
            chapter_data = self._get_mock_chapter(chapter_index)
        else:
            chapter_data = self._generate_chapter_with_ai(prompt)
        
        # 创建或更新StoryChapter
        chapter, created = StoryChapter.objects.update_or_create(
            story=story,
            chapter_index=chapter_index,
            defaults={
                'content': chapter_data.model_dump(),
                'title': chapter_data.title
            }
        )
        
        # 检查是否所有章节都已生成，如是则标记Story为完成
        generated_chapters = StoryChapter.objects.filter(story=story).count()
        if generated_chapters == story.total_chapters:
            story.is_complete = True
            story.save()
            
        return chapter

    def get_or_generate_chapter(self, gamework, chapter_index=1):
        """获取指定章节，如果不存在则生成"""
        story = self.ensure_story_exists(gamework)
        
        try:
            return StoryChapter.objects.get(story=story, chapter_index=chapter_index)
        except StoryChapter.DoesNotExist:
            return self.generate_chapter(gamework, chapter_index)

    def get_next_scene(self, gamework, chapter_index, current_scene_id, choice_id):
        """根据当前场景ID和选择ID，返回下一个场景"""
        chapter = self.get_or_generate_chapter(gamework, chapter_index)
        scenes = chapter.content.get('scenes', {})
        
        # 获取当前场景
        current_scene = scenes.get(current_scene_id)
        if not current_scene:
            raise ValueError(f"Scene {current_scene_id} not found in chapter {chapter_index}")
        
        # 查找选择对应的下一个场景ID
        next_scene_id = None
        choice_data = None
        for option in current_scene.get('choices', []):
            if option.get('id') == choice_id:
                next_scene_id = option.get('nextSceneId')
                choice_data = option
                break
                
        if not next_scene_id:
            raise ValueError(f"Choice {choice_id} not found in scene {current_scene_id}")
            
        # 获取下一个场景
        next_scene = scenes.get(next_scene_id)
        if not next_scene:
            raise ValueError(f"Next scene {next_scene_id} not found")
            
        result = {
            'scene': next_scene,
            'is_ending': next_scene.get('isEnding', False),
            'is_game_ending': next_scene.get('isGameEnding', False),
            'next_chapter': None,
            'attributesDelta': choice_data.get('attributesDelta', {}),
            'statusesDelta': choice_data.get('statusesDelta', {})
        }
        
        # 如果是章节结束但不是游戏结束，预加载下一章
        if result['is_ending'] and not result['is_game_ending']:
            next_chapter_index = chapter_index + 1
            story = chapter.story
            
            # 检查是否有下一章
            if next_chapter_index <= story.total_chapters:
                next_chapter = self.get_or_generate_chapter(gamework, next_chapter_index)
                next_chapter_scenes = next_chapter.content.get('scenes', {})
                
                # 查找下一章的起始场景（通常以"start"结尾）
                start_scene_id = None
                for scene_id in next_chapter_scenes:
                    if "start" in scene_id.lower():
                        start_scene_id = scene_id
                        break
                
                if start_scene_id and start_scene_id in next_chapter_scenes:
                    start_scene = next_chapter_scenes.get(start_scene_id)
                    result['next_chapter'] = {
                        'chapter_index': next_chapter_index,
                        'start_scene_id': start_scene_id,
                        'start_scene': start_scene
                    }
        
        return result
    
    def get_scene_by_id(self, gamework, chapter_index, scene_id):
        """获取指定场景"""
        chapter = self.get_or_generate_chapter(gamework, chapter_index)
        return chapter.content.get('scenes', {}).get(scene_id)
    
    def get_next_scenes(self, gamework, after_scene_id=None):
        """
        按照GamePage接口文档，获取后续场景
        如果after_scene_id为None，返回第1章第1个场景
        否则返回指定场景后的后续场景
        """
        # 如果没有提供after_scene_id，返回第一章第一个场景
        if not after_scene_id:
            chapter = self.get_or_generate_chapter(gamework, 1)
            scenes = chapter.content.get('scenes', {})
            # 查找第一章起始场景
            start_scene_id = None
            for scene_id in scenes:
                if "start" in scene_id.lower():
                    start_scene_id = scene_id
                    break
                    
            if start_scene_id:
                return {
                    "end": False,
                    "nextScenes": [scenes.get(start_scene_id)]
                }
            return {"end": True}  # 如果找不到起始场景
            
        # 解析after_scene_id来确定章节和场景
        # 假设ID格式为"chX_scene_YY"，其中X是章节编号
        try:
            # 提取章节编号
            chapter_index = int(after_scene_id.split('_')[0].replace('ch', ''))
            chapter = self.get_or_generate_chapter(gamework, chapter_index)
            scenes = chapter.content.get('scenes', {})
            
            # 检查当前场景是否为章节结束场景
            current_scene = scenes.get(after_scene_id)
            if current_scene and current_scene.get('isEnding'):
                # 如果是游戏结束
                if current_scene.get('isGameEnding'):
                    return {"end": True}
                    
                # 如果只是章节结束，获取下一章
                next_chapter_index = chapter_index + 1
                story = chapter.story
                
                if next_chapter_index <= story.total_chapters:
                    next_chapter = self.get_or_generate_chapter(gamework, next_chapter_index)
                    next_scenes = next_chapter.content.get('scenes', {})
                    
                    # 查找下一章起始场景
                    start_scene_id = None
                    for scene_id in next_scenes:
                        if "start" in scene_id.lower():
                            start_scene_id = scene_id
                            break
                            
                    if start_scene_id:
                        return {
                            "end": False,
                            "nextScenes": [next_scenes.get(start_scene_id)]
                        }
                
                # 如果没有下一章或找不到起始场景，游戏结束
                return {"end": True}
                
            # 如果不是结束场景，可能是前端请求下一个逻辑场景
            # 由于我们的设计是基于选择的，这种情况应该很少出现
            # 但为完整性，我们可以提供一个默认的后续场景
            
            # 简单起见，返回空列表表示没有自动后续场景
            return {
                "end": False,
                "nextScenes": []
            }
            
        except Exception as e:
            print(f"解析场景ID出错: {e}")
            return {"end": True}  # 出错默认结束

# 创建一个单例
ai_service = AIGenerationService()
