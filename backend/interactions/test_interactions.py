from gameworks.models import Gamework
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from .models import Favorite, FavoriteFolder, Comment, Rating, CommentLike

class FavoriteViewSetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass")
        self.other_user = User.objects.create_user(username="otheruser", email="other@example.com", password="otherpass")
        self.gamework = Gamework.objects.create(title="Test Gamework", description="Test", author=self.user)
        self.gamework2 = Gamework.objects.create(title="Test Gamework 2", description="Test 2", author=self.user)
        self.folder = FavoriteFolder.objects.create(user=self.user, name="Test Folder")
        self.folder2 = FavoriteFolder.objects.create(user=self.user, name="Test Folder 2")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_favorites_with_folder_filter(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework, folder=self.folder)
        response = self.client.get(f'/api/interactions/favorites/?folder={self.folder.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_favorites_with_null_folder_filter(self):
        Favorite.objects.create(user=self.user, gamework=self.gamework)
        Favorite.objects.create(user=self.user, gamework=self.gamework2, folder=self.folder)
        response = self.client.get('/api/interactions/favorites/?folder=null')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_favorites_search(self):
        Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.get('/api/interactions/favorites/?search=Test')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_duplicate_favorite(self):
        Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.post('/api/interactions/favorites/', {
            "gamework_id": self.gamework.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_partial_update_move_to_folder(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.patch(
            f'/api/interactions/favorites/{favorite.id}/',
            {"folder": self.folder.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_partial_update_remove_from_folder(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework, folder=self.folder)
        response = self.client.patch(
            f'/api/interactions/favorites/{favorite.id}/',
            {"folder": None},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_partial_update_invalid_folder(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.patch(
            f'/api/interactions/favorites/{favorite.id}/',
            {"folder": 9999},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_favorite(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.delete(f'/api/interactions/favorites/{favorite.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_move_to_folder(self):
        favorite1 = Favorite.objects.create(user=self.user, gamework=self.gamework)
        favorite2 = Favorite.objects.create(user=self.user, gamework=self.gamework2)
        response = self.client.post('/api/interactions/favorites/move_to_folder/', {
            "favorite_ids": [favorite1.id, favorite2.id],
            "folder": self.folder.id
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_move_to_folder_invalid_folder(self):
        favorite = Favorite.objects.create(user=self.user, gamework=self.gamework)
        response = self.client.post('/api/interactions/favorites/move_to_folder/', {
            "favorite_ids": [favorite.id],
            "folder": 9999
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_move_to_folder_invalid_ids_format(self):
        response = self.client.post('/api/interactions/favorites/move_to_folder/', {
            "favorite_ids": ["invalid"],
            "folder": self.folder.id
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FavoriteFolderViewSetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_folder(self):
        response = self.client.post('/api/interactions/favorite-folders/', {"name": "New Folder"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_folders(self):
        FavoriteFolder.objects.create(user=self.user, name="Folder 1")
        response = self.client.get('/api/interactions/favorite-folders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_patch_folder_name(self):
        folder = FavoriteFolder.objects.create(user=self.user, name="Old Name")
        response = self.client.patch(f'/api/interactions/favorite-folders/{folder.id}/', {"name": "New Name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_folder(self):
        folder = FavoriteFolder.objects.create(user=self.user, name="Folder")
        response = self.client.delete(f'/api/interactions/favorite-folders/{folder.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class CommentViewSetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass")
        self.gamework = Gamework.objects.create(title="Test Gamework", description="Test", author=self.user)
        self.comment = Comment.objects.create(user=self.user, gamework=self.gamework, content="Test Comment")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_comment(self):
        response = self.client.post('/api/interactions/comments/', {
            "gamework": self.gamework.id,
            "content": "New Comment"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_comments(self):
        response = self.client.get(f'/api/interactions/comments/?gamework={self.gamework.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_like_comment(self):
        response = self.client.post(f'/api/interactions/comments/{self.comment.id}/like/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['data']['liked'])

    def test_unlike_comment(self):
        CommentLike.objects.create(user=self.user, comment=self.comment)
        response = self.client.post(f'/api/interactions/comments/{self.comment.id}/unlike/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['data']['liked'])

    def test_delete_comment(self):
        response = self.client.delete(f'/api/interactions/comments/{self.comment.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class RatingViewSetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass")
        self.gamework = Gamework.objects.create(title="Test Gamework", description="Test", author=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_ratings(self):
        Rating.objects.create(user=self.user, gamework=self.gamework, score=8)
        response = self.client.get(f'/api/interactions/ratings/?gamework={self.gamework.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_rating_score(self):
        response = self.client.post('/api/interactions/ratings/', {
            "id": self.gamework.id,
            "score": 15
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)