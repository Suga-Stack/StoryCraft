import uuid
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APITestCase,APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gameworks.models import Gamework
from stories.models import Story, StoryChapter, StoryScene, StoryEnding
from ..models import GameSave, GameReport
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

class GameViewsTestCase(APITestCase):
    """
    测试 game 相关的接口
    """

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='testuser@example.com', password='testpassword')
        self.other_user = User.objects.create_user(username='otheruser', email='otheruser@example.com', password='testpassword')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.gamework = Gamework.objects.create(
            author=self.user,
            title="Test Gamework",
        )
        self.story = Story.objects.create(
            gamework=self.gamework,
            total_chapters=3,
            ai_callable=True,
            initial_generation_complete=True
        )
        self.chapter = StoryChapter.objects.create(
            story=self.story,
            chapter_index=1,
            title="Chapter 1",
            status=StoryChapter.ChapterStatus.GENERATED
        )
        self.scene = StoryScene.objects.create(
            chapter=self.chapter,
            scene_index=1,
            background_image_url="https://example.com/image.png"
        )

    @patch('game.views.default_storage.save')
    @patch('game.views.uuid.uuid4')
    def test_user_image_upload_view_success(self, mock_uuid, mock_save):
        """
        Test successful image upload.
        """
        mock_uuid.return_value = MagicMock(hex='testuuid')
        mock_save.return_value = 'user_upload/testuuid.png'
        
        image = SimpleUploadedFile("test_image.png", b"file_content", content_type="image/png")
        url = reverse('user-upload-image')
        response = self.client.post(url, {'file': image}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('imageUrl', response.data)
        self.assertIn('user_upload/testuuid.png', response.data['imageUrl'])
        mock_save.assert_called_once()

    def test_user_image_upload_view_no_file(self):
        """
        Test image upload with no file provided.
        """
        url = reverse('user-upload-image')
        response = self.client.post(url, {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('game.services.create_gamework')
    def test_game_create_view_success(self, mock_create_gamework):
        """
        Test successful game creation.
        """
        mock_create_gamework.return_value = {'gameworkId': self.gamework.id}
        url = reverse('game-create')
        data = {
            "tags": ["奇幻", "玄幻", "仙侠"],
            "idea": "A grand adventure",
            "length": "medium",
            "modifiable": True
        }
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data, {'gameworkId': self.gamework.id})
        mock_create_gamework.assert_called_once()

    def test_game_create_view_invalid_data(self):
        """
        Test game creation with invalid data.
        """
        url = reverse('game-create')
        data = {"tags": ["fantasy"]}  # 缺失其他必需字段
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('game.services.get_chapter_status')
    def test_get_chapter_status_success(self, mock_get_chapter_status):
        """
        Test successfully getting chapter status.
        """
        mock_get_chapter_status.return_value = {'status': 'ready', 'content': {}}
        url = reverse('game-chapter', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ready')
        mock_get_chapter_status.assert_called_once()

    def test_get_chapter_status_not_found(self):
        """
        Test getting chapter status for a non-existent gamework.
        """
        url = reverse('game-chapter', kwargs={'gameworkId': 999, 'chapterIndex': 1})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_chapter_manual_success(self):
        """
        Test manually updating a chapter successfully.
        """
        url = reverse('game-chapter', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        data = {
            "chapterIndex": 1,
            "title": "Updated Chapter Title",
            "scenes": [
                {
                    "id": 1,
                    "backgroundImage": "http://new.image/url.jpg",
                    "dialogues": [{"narration": "A new beginning."}]
                }
            ]
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.title, "Updated Chapter Title")
        self.assertEqual(self.chapter.scenes.count(), 1)
        self.assertEqual(self.chapter.scenes.first().dialogues[0]['narration'], "A new beginning.")

    def test_update_chapter_manual_forbidden(self):
        """
        Test that a user cannot update a chapter they do not own.
        """
        self.client.force_authenticate(user=self.other_user)
        url = reverse('game-chapter', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        data = {"chapterIndex": 1, "title": "Forbidden Update", "scenes": []}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        self.client.force_authenticate(user=self.user)

    @patch('game.services.start_single_chapter_generation')
    def test_chapter_generate_view_success(self, mock_start_generation):
        """
        Test successfully starting single chapter generation.
        """
        url = reverse('game-chapter-generate', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 2})
        data = {
            "chapterOutlines": [{"chapterIndex": 2, "title": "T2", "outline": "O2"}],
            "userPrompt": "Make it dramatic."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"ok": True})
        mock_start_generation.assert_called_once()

    def test_chapter_generate_view_forbidden(self):
        """
        Test that a user cannot trigger generation for a gamework they don't own.
        """
        url = reverse('game-chapter-generate', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 2})
        data = {"chapterOutlines": []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_game_save_put_create(self):
        """
        Test creating a new game save.
        """
        url = reverse('game-save-detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        data = {
            "title": "My Save",
            "timestamp": 123456789,
            "state": {
                "chapterIndex": 1,
                "sceneId": 1,
                "dialogueIndex": 1
            }
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(GameSave.objects.filter(user=self.user, gamework=self.gamework, slot=1).exists())

    def test_game_save_get_success(self):
        """
        Test retrieving an existing game save.
        """
        save = GameSave.objects.create(
            user=self.user,
            gamework=self.gamework,
            slot=1,
            title="Test Save",
            timestamp=123,
            state={"chapterIndex": 1, "sceneId": 1},
            cover_url="http://example.com/cover.jpg"
        )
        url = reverse('game-save-detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], save.title)

    def test_game_save_get_not_found(self):
        """
        Test retrieving a non-existent game save.
        """
        url = reverse('game-save-detail', kwargs={'gameworkId': self.gamework.id, 'slot': 99})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_game_save_delete_success(self):
        """
        Test deleting a game save.
        """
        GameSave.objects.create(user=self.user, gamework=self.gamework, slot=1, state={}, timestamp=1, cover_url="http://example.com/cover.jpg")
        url = reverse('game-save-detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(GameSave.objects.filter(user=self.user, gamework=self.gamework, slot=1).exists())

    def test_game_save_list_view(self):
        """
        Test listing all game saves for a gamework.
        """
        GameSave.objects.create(
            user=self.user, gamework=self.gamework, slot=1, title="Save 1",
            state={"chapterIndex": 1, "sceneId": 1}, cover_url="url1", timestamp=1
        )
        GameSave.objects.create(
            user=self.user, gamework=self.gamework, slot=2, title="Save 2",
            state={"chapterIndex": 2, "sceneId": 1}, cover_url="url2", timestamp=2
        )
        url = reverse('game-saves', kwargs={'gameworkId': self.gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['saves']), 2)
        self.assertEqual(response.data['saves'][0]['slot'], 1)
        self.assertEqual(response.data['saves'][1]['slot'], 2)

    @patch('game.services.get_story_endings')
    def test_game_ending_list_view(self, mock_get_endings):
        """Test listing story endings"""
        mock_get_endings.return_value = {"status": "ready", "endings": []}
        url = reverse('story-ending', kwargs={'gameworkId': self.gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_endings.assert_called_once()

    @patch('game.services.get_single_story_ending')
    def test_game_ending_detail_view(self, mock_get_single):
        """Test getting single ending detail"""
        mock_get_single.return_value = {"status": "ready", "ending": {}}
        url = reverse('story-ending-detail', kwargs={'gameworkId': self.gamework.id, 'endingIndex': 1})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_single.assert_called_once()

    def test_game_ending_manual_update(self):
        """Test manually updating an ending"""
        # Create an ending first
        StoryEnding.objects.create(story=self.story, ending_index=1, title="Old Title")
        
        url = reverse('story-ending-detail', kwargs={'gameworkId': self.gamework.id, 'endingIndex': 1})
        data = {
            "endingIndex": 1,
            "title": "New Ending Title",
            "scenes": []
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        ending = StoryEnding.objects.get(story=self.story, ending_index=1)
        self.assertEqual(ending.title, "New Ending Title")
        self.assertEqual(ending.status, StoryEnding.EndingStatus.SAVED)

    @patch('game.services.start_single_ending_generation')
    def test_ending_generate_view(self, mock_start_gen):
        """Test starting ending generation"""
        # Need an ending object to exist for validation in service (though mocked here, view checks permissions)
        StoryEnding.objects.create(story=self.story, ending_index=1)
        
        url = reverse('game-ending-generate', kwargs={'gameworkId': self.gamework.id, 'endingIndex': 1})
        data = {
            "title": "Ending Title",
            "outline": "Ending Outline",
            "userPrompt": "Prompt"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_start_gen.assert_called_once()

    @patch('game.services.get_ending_report')
    def test_game_report_view(self, mock_get_report):
        """Test getting game report"""
        mock_get_report.return_value = {"status": "ready", "details": {}}
        url = reverse('settlement-report', kwargs={'gameworkId': self.gamework.id, 'endingIndex': 1})
        data = {"attributes": {"courage": 10}}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_report.assert_called_once()