from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.GameCreateView.as_view(), name='game-create'),
    path('upload-image/', views.UserImageUploadView.as_view(), name='user-upload-image'),
    path('chapter/<int:gameworkId>/<int:chapterIndex>/', views.GameChapterView.as_view(), name='game-chapter'),
    path('chapter/generate/<int:gameworkId>/<int:chapterIndex>/', views.ChapterGenerateView.as_view(), name='game-chapter-generate'),
    path('saves/<int:gameworkId>/<int:slot>/', views.GameSaveDetailView.as_view(), name='game-save-detail'),
    path('saves/<int:gameworkId>/', views.GameSaveListView.as_view(), name='game-saves'),
    path('storyending/<int:gameworkId>/', views.GameEndingView.as_view(), name='story-ending'),
    path('settlement/report/<int:workId>/', views.SettlementReportView.as_view(), name='settlement-report'),
]
