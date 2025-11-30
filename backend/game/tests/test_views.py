import uuid
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from gameworks.models import Gamework
from stories.models import Story, StoryChapter, StoryScene
from ..models import GameSave
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

class GameViewsTestCase(APITestCase):
    """
    Test suite for the game views.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.other_user = User.objects.create_user(username='otheruser', password='testpassword')
        self.client.login(username='testuser', password='testpassword')

        self.gamework = Gamework.objects.create(
            author=self.user,
            title="Test Gamework",
            tags=["tag1", "tag2"],
            idea="An idea",
            length="short",
            modifiable=True
        )
        self.story = Story.objects.create(gamework=self.gamework)
        self.chapter = StoryChapter.objects.create(
            story=self.story,
            chapter_index=1,
            title="Chapter 1",
            status=StoryChapter.ChapterStatus.READY
        )
        self.scene = StoryScene.objects.create(
            chapter=self.chapter,
            scene_index=1,
            background_image_url="http://example.com/image.png"
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
        url = reverse('upload_image')
        response = self.client.post(url, {'file': image}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('imageUrl', response.data)
        self.assertIn('user_upload/testuuid.png', response.data['imageUrl'])
        mock_save.assert_called_once()

    def test_user_image_upload_view_no_file(self):
        """
        Test image upload with no file provided.
        """
        url = reverse('upload_image')
        response = self.client.post(url, {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('game.services.create_gamework')
    def test_game_create_view_success(self, mock_create_gamework):
        """
        Test successful game creation.
        """
        mock_create_gamework.return_value = {'gameworkId': self.gamework.id}
        url = reverse('game_create')
        data = {
            "tags": ["fantasy", "adventure"],
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
        url = reverse('game_create')
        data = {"tags": ["fantasy"]}  # Missing 'length'
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('game.services.get_chapter_status')
    def test_get_chapter_status_success(self, mock_get_chapter_status):
        """
        Test successfully getting chapter status.
        """
        mock_get_chapter_status.return_value = {'status': 'ready', 'content': {}}
        url = reverse('game_chapter_detail', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ready')
        mock_get_chapter_status.assert_called_once()

    def test_get_chapter_status_not_found(self):
        """
        Test getting chapter status for a non-existent gamework.
        """
        url = reverse('game_chapter_detail', kwargs={'gameworkId': 999, 'chapterIndex': 1})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_chapter_manual_success(self):
        """
        Test manually updating a chapter successfully.
        """
        url = reverse('game_chapter_detail', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        data = {
            "chapterIndex": 1,
            "title": "Updated Chapter Title",
            "scenes": [
                {
                    "id": 1,
                    "backgroundImage": "http://new.image/url.jpg",
                    "dialogues": [{"character": "Narrator", "text": "A new beginning."}]
                }
            ]
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.title, "Updated Chapter Title")
        self.assertEqual(self.chapter.scenes.count(), 1)
        self.assertEqual(self.chapter.scenes.first().dialogues[0]['text'], "A new beginning.")

    def test_update_chapter_manual_forbidden(self):
        """
        Test that a user cannot update a chapter they do not own.
        """
        self.client.login(username='otheruser', password='testpassword')
        url = reverse('game_chapter_detail', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 1})
        data = {"chapterIndex": 1, "title": "Forbidden Update"}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('game.services.start_single_chapter_generation')
    def test_chapter_generate_view_success(self, mock_start_generation):
        """
        Test successfully starting single chapter generation.
        """
        url = reverse('chapter_generate', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 2})
        data = {
            "chapterOutlines": ["Outline 1", "Outline 2"],
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
        self.client.login(username='otheruser', password='testpassword')
        url = reverse('chapter_generate', kwargs={'gameworkId': self.gamework.id, 'chapterIndex': 2})
        data = {}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_game_save_put_create(self):
        """
        Test creating a new game save.
        """
        url = reverse('game_save_detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        data = {
            "title": "My Save",
            "timestamp": 123456789,
            "state": {
                "chapterIndex": 1,
                "sceneId": 1,
                "dialogueIndex": 0
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
            state={"chapterIndex": 1, "sceneId": 1}
        )
        url = reverse('game_save_detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], save.title)

    def test_game_save_get_not_found(self):
        """
        Test retrieving a non-existent game save.
        """
        url = reverse('game_save_detail', kwargs={'gameworkId': self.gamework.id, 'slot': 99})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_game_save_delete_success(self):
        """
        Test deleting a game save.
        """
        GameSave.objects.create(user=self.user, gamework=self.gamework, slot=1)
        url = reverse('game_save_detail', kwargs={'gameworkId': self.gamework.id, 'slot': 1})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(GameSave.objects.filter(user=self.user, gamework=self.gamework, slot=1).exists())

    def test_game_save_list_view(self):
        """
        Test listing all game saves for a gamework.
        """
        GameSave.objects.create(
            user=self.user, gamework=self.gamework, slot=1, title="Save 1",
            state={"chapterIndex": 1, "sceneId": 1}, cover_url="url1"
        )
        GameSave.objects.create(
            user=self.user, gamework=self.gamework, slot=2, title="Save 2",
            state={"chapterIndex": 2, "sceneId": 1}, cover_url="url2"
        )
        url = reverse('game_save_list', kwargs={'gameworkId': self.gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['saves']), 2)
        self.assertEqual(response.data['saves'][0]['slot'], 1)
        self.assertEqual(response.data['saves'][1]['slot'], 2)

    @patch('game.services.build_settlement_variants')
    def test_settlement_report_view(self, mock_build_variants):
        """
        Test the settlement report generation view.
        """
        mock_build_variants.return_value = {"variants": [{"title": "Hero", "description": "You were a hero."}]}
        url = reverse('settlement_report', kwargs={'workId': self.gamework.id})
        data = {
            "attributes": {"strength": 10},
            "statuses": {"brave": True}
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("variants", response.data)
        mock_build_variants.assert_called_once_with(data["attributes"], data["statuses"])