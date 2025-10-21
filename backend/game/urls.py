from django.urls import path
from . import views

urlpatterns = [
    # 现有路由
    path('start', views.GameStartView.as_view(), name='game-start'),
    path('choose', views.GameChoiceView.as_view(), name='game-choose'),
    path('save', views.GameSaveView.as_view(), name='game-save'),
    path('saves/<int:gameworkId>', views.GameSaveListView.as_view(), name='game-save-list'),
    
    # 接口文档中的路由
    path('story/<int:work_id>/choice', views.story_choice, name='story-choice'),
    path('story/<int:work_id>/next', views.story_next, name='story-next'),
    path('users/<int:user_id>/saves/<int:work_id>/<str:slot>', views.user_save, name='user-save'),
    
    # 调试用URL
    path('story/<int:gamework_id>', views.StoryDetailView.as_view(), name='story-detail'),
    path('chapter/<int:gamework_id>/<int:chapter_index>', views.ChapterDetailView.as_view(), name='chapter-detail'),
]
