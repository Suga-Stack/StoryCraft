from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.GameCreateView.as_view(), name='game-create'),
    path('chapter/', views.GameChapterView.as_view(), name='game-chapter'),
    path('settlement/report/<int:workId>/', views.SettlementReportView.as_view(), name='settlement-report'),
]
