from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from .models import GameSave
from gameworks.models import Gamework
from stories.models import Story, StoryChapter
from .serializers import (
    GameSaveSerializer, GameSaveListSerializer,
    GameStartSerializer, GameChoiceSerializer
)
from .services import ai_service

class GameStartView(views.APIView):
    """
    POST /api/game/start
    开始新游戏或从存档继续。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        gamework_id = request.data.get('gameworkId')
        gamework = get_object_or_404(Gamework, id=gamework_id)
        save_id = request.data.get('saveId')
        
        if save_id:
            # 从存档加载
            game_save = get_object_or_404(GameSave, id=save_id, user=request.user, gamework=gamework)
            game_state = game_save.game_state
            
            # 获取当前章节和场景
            chapter = ai_service.get_or_generate_chapter(
                gamework, 
                game_state.get('currentChapterIndex', 1)
            )
            
            current_scene_id = game_state.get('currentSceneId')
            current_scene = chapter.content.get('scenes', {}).get(current_scene_id)
            
            if not current_scene:
                return Response({"error": "无法从存档加载场景"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # 开始新游戏
            # 确保Story存在并获取第一章
            story = ai_service.ensure_story_exists(gamework)
            chapter = ai_service.get_or_generate_chapter(gamework, chapter_index=1)
            
            # 查找第一章的起始场景
            scenes = chapter.content.get('scenes', {})
            initial_scene_id = None
            
            # 尝试找到以"start"结尾的场景ID
            for scene_id in scenes:
                if scene_id.endswith("start"):
                    initial_scene_id = scene_id
                    break
            
            if not initial_scene_id or initial_scene_id not in scenes:
                return Response({"error": "无法加载初始场景"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            current_scene = scenes.get(initial_scene_id)
            
            # 初始化游戏状态
            game_state = {
                "gameworkId": gamework.id,
                "userId": request.user.id,
                "currentChapterIndex": 1,
                "currentSceneId": initial_scene_id,
                "history": [],
                "character": {"name": request.user.username},
                "inventory": [],
                "relationships": {},
                "flags": {},
                "branch_exploration": {
                    "total_choices": 0,
                    "explored_choices": []
                }
            }

        return Response({
            "gameState": game_state,
            "currentScene": current_scene,
            "storyProgress": {
                "currentChapter": game_state.get('currentChapterIndex', 1),
                "totalChapters": story.total_chapters if 'story' in locals() else 3
            }
        }, status=status.HTTP_200_OK)

class GameChoiceView(views.APIView):
    """
    POST /api/game/choose
    玩家做出选择，获取下一场景。
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        game_state = request.data.get('gameState')
        choice_id = request.data.get('choiceId')
        
        if not game_state or not choice_id:
            return Response({"error": "缺少必要参数"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            gamework = get_object_or_404(Gamework, id=game_state.get('gameworkId'))
            chapter_index = game_state.get('currentChapterIndex', 1)
            current_scene_id = game_state.get('currentSceneId')
            
            # 获取下一个场景
            result = ai_service.get_next_scene(
                gamework, 
                chapter_index, 
                current_scene_id, 
                choice_id
            )
            
            # 更新游戏状态
            game_state['history'].append({
                "chapterIndex": chapter_index,
                "sceneId": current_scene_id,
                "choiceId": choice_id
            })
            
            # 记录已探索的选择
            if 'branch_exploration' not in game_state:
                game_state['branch_exploration'] = {'total_choices': 0, 'explored_choices': []}
            
            if choice_id not in game_state['branch_exploration']['explored_choices']:
                game_state['branch_exploration']['explored_choices'].append(choice_id)
            
            # 更新当前场景ID
            game_state['currentSceneId'] = result['scene'].get('id', result['scene'].get('sceneId', ''))
            
            # 如果是章节结束并且有下一章
            if result['is_ending'] and result['next_chapter']:
                game_state['currentChapterIndex'] = result['next_chapter']['chapter_index']
                game_state['currentSceneId'] = result['next_chapter']['start_scene_id']
                
                return Response({
                    "gameState": game_state,
                    "nextScene": result['scene'],
                    "nextChapter": {
                        "chapterIndex": result['next_chapter']['chapter_index'],
                        "startScene": result['next_chapter']['start_scene']
                    },
                    "isGameEnding": False
                }, status=status.HTTP_200_OK)
            
            # 如果是游戏结束
            if result['is_game_ending']:
                return Response({
                    "gameState": game_state,
                    "nextScene": result['scene'],
                    "isGameEnding": True
                }, status=status.HTTP_200_OK)
                
            # 普通场景转换
            return Response({
                "gameState": game_state,
                "nextScene": result['scene'],
                "isGameEnding": False
            }, status=status.HTTP_200_OK)
                
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"处理请求时出错: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GameSaveView(generics.CreateAPIView):
    """
    POST /api/game/save
    保存游戏进度。
    """
    queryset = GameSave.objects.all()
    serializer_class = GameSaveSerializer
    permission_classes = [IsAuthenticated]

class GameSaveListView(generics.ListAPIView):
    """
    GET /api/game/saves/{gameworkId}
    获取指定作品的存档列表。
    """
    serializer_class = GameSaveListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        gamework_id = self.kwargs['gameworkId']
        return GameSave.objects.filter(user=self.request.user, gamework_id=gamework_id)

class StoryDetailView(views.APIView):
    def get(self, request, gamework_id):
        from .services import ai_service
        gamework = get_object_or_404(Gamework, id=gamework_id)
        story = ai_service.ensure_story_exists(gamework)
        chapters = StoryChapter.objects.filter(story=story).count()
        
        return Response({
            "storyId": story.id,
            "gameworkId": gamework.id,
            "title": gamework.title,
            "totalChapters": story.total_chapters,
            "generatedChapters": chapters,
            "isComplete": story.is_complete,
            "completionPercentage": story.completion_percentage
        })

class ChapterDetailView(views.APIView):
    def get(self, request, gamework_id, chapter_index):
        from .services import ai_service
        gamework = get_object_or_404(Gamework, id=gamework_id)
        chapter = ai_service.get_or_generate_chapter(gamework, chapter_index)
        return Response(chapter.content)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def story_choice(request, work_id):
    """
    POST /api/story/{workId}/choice
    处理玩家做出的选择，返回后续剧情
    """
    try:
        choice_id = request.data.get('choiceId')
        context = request.data.get('context', {})
        
        if not choice_id or not context:
            return Response({"error": "缺少必要参数"}, status=status.HTTP_400_BAD_REQUEST)
            
        gamework = get_object_or_404(Gamework, gamework_id=work_id)
        current_scene_id = context.get('currentSceneId')
        
        # 从scene_id推断章节编号(假设ID格式为"chX_scene_YY")
        try:
            chapter_index = int(current_scene_id.split('_')[0].replace('ch', ''))
        except:
            chapter_index = 1  # 默认为第一章
            
        # 获取选择后的下一个场景
        result = ai_service.get_next_scene(gamework, chapter_index, current_scene_id, choice_id)
        
        # 构造符合接口文档的响应
        response_data = {
            "attributesDelta": result.get('attributesDelta', {}),
            "statusesDelta": result.get('statusesDelta', {}),
            "insertScenes": [result['scene']],
            "end": result.get('is_game_ending', False)
        }
        
        # 如果是章节结束且有下一章
        if result.get('next_chapter'):
            response_data["insertScenes"].append(result['next_chapter']['start_scene'])
            
        return Response(response_data)
        
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def story_next(request, work_id):
    """
    GET /api/story/{workId}/next?after={sceneId}
    按需获取后续剧情
    """
    try:
        after_scene_id = request.query_params.get('after')
        gamework = get_object_or_404(Gamework, gamework_id=work_id)
        
        # 获取后续场景
        result = ai_service.get_next_scenes(gamework, after_scene_id)
        
        return Response(result)
        
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
