from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.urls import reverse
from gameworks.models import Gamework
from stories.models import Story
from interactions.models import Favorite, Comment
from tags.models import Tag

User = get_user_model()

class GameworkViewSetTestCase(APITestCase):
    """
    Test suite for the GameworkViewSet retrieve method.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.other_user = User.objects.create_user(username='otheruser', password='testpassword', email='othertest@example.com')
        self.admin_user = User.objects.create_superuser(username='admin', password='adminpassword', email='admin@example.com')

        self.client.force_authenticate(user=self.user)

        self.gamework = Gamework.objects.create(
            author=self.user,
            title="Test Gamework",
            is_published=True
        )
        self.unpublished_gamework = Gamework.objects.create(
            author=self.user,
            title="Unpublished Gamework",
            is_published=False
        )
        self.other_user_gamework = Gamework.objects.create(
            author=self.other_user,
            title="Other User's Gamework",
            is_published=True
        )
        self.story = Story.objects.create(
            gamework=self.gamework,
            initial_generation_complete=True
        )
        self.unfinished_story = Story.objects.create(
            gamework=self.unpublished_gamework,
            initial_generation_complete=False
        )
        self.other_user_story = Story.objects.create(
            gamework=self.other_user_gamework,
            initial_generation_complete=True
        )

    def test_retrieve_published_gamework_success(self):
        """
        Test retrieving a published gamework successfully.
        """
        url = reverse('gamework-detail', kwargs={'pk': self.gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ready')
        self.assertIn('data', response.data)
        self.assertEqual(response.data['data']['title'], self.gamework.title)

    def test_retrieve_unpublished_gamework_as_author(self):
        """
        Test retrieving an unpublished gamework as the author.
        """
        url = reverse('gamework-detail', kwargs={'pk': self.unpublished_gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'generating')

    def test_retrieve_unpublished_gamework_as_other_user(self):
        """
        Test retrieving an unpublished gamework as another user.
        """
        self.client.force_authenticate(user=self.other_user)
        url = reverse('gamework-detail', kwargs={'pk': self.unpublished_gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_other_user_published_gamework(self):
        """
        Test retrieving a published gamework created by another user.
        """
        url = reverse('gamework-detail', kwargs={'pk': self.other_user_gamework.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ready')
        self.assertIn('data', response.data)
        self.assertEqual(response.data['data']['title'], self.other_user_gamework.title)

    def test_retrieve_nonexistent_gamework(self):
        """
        Test retrieving a non-existent gamework.
        """
        url = reverse('gamework-detail', kwargs={'pk': 999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

class PublishGameworkViewSetTestCase(APITestCase):
    """
    Test suite for the PublishGameworkViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.other_user = User.objects.create_user(username='otheruser', password='testpassword', email='othertest@example.com')
        self.admin_user = User.objects.create_superuser(username='admin', password='adminpassword', email='admin@example.com')

        self.client.force_authenticate(user=self.user)

        self.gamework = Gamework.objects.create(
            author=self.user,
            title="Test Gamework",
            is_published=False
        )
        self.other_user_gamework = Gamework.objects.create(
            author=self.other_user,
            title="Other User's Gamework",
            is_published=False
        )

    def test_publish_gamework_success(self):
        """
        Test successfully publishing a gamework as the author.
        """
        url = reverse('publish-gamework', kwargs={'pk': self.gamework.id})
        data = {"price": 10}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.gamework.refresh_from_db()
        self.assertTrue(self.gamework.is_published)
        self.assertEqual(self.gamework.price, 10)

    def test_publish_gamework_invalid_price(self):
        """
        Test publishing a gamework with an invalid price.
        """
        url = reverse('publish-gamework', kwargs={'pk': self.gamework.id})
        data = {"price": "invalid"}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], 'price 必须是整数')

    def test_publish_gamework_price_out_of_range(self):
        """
        Test publishing a gamework with a price out of the allowed range.
        """
        url = reverse('publish-gamework', kwargs={'pk': self.gamework.id})
        data = {"price": 100}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], 'price 必须在 0 ~ 50 之间')

    def test_publish_gamework_not_author(self):
        """
        Test that a user cannot publish a gamework they do not own.
        """
        url = reverse('publish-gamework', kwargs={'pk': self.other_user_gamework.id})
        data = {"price": 10}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['message'], '您没有权限发布该作品')

    def test_publish_gamework_as_admin(self):
        """
        Test successfully publishing a gamework as an admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('publish-gamework', kwargs={'pk': self.other_user_gamework.id})
        data = {"price": 20}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_user_gamework.refresh_from_db()
        self.assertTrue(self.other_user_gamework.is_published)
        self.assertEqual(self.other_user_gamework.price, 20)

    def test_publish_gamework_not_found(self):
        """
        Test publishing a non-existent gamework.
        """
        url = reverse('publish-gamework', kwargs={'pk': 999})
        data = {"price": 10}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['message'], '作品未找到')

    def test_unpublish_gamework_success(self):
        """
        Test successfully unpublishing a gamework as the author.
        """
        self.gamework.is_published = True
        self.gamework.save()

        url = reverse('unpublish-gamework', kwargs={'pk': self.gamework.id})
        response = self.client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.gamework.refresh_from_db()
        self.assertFalse(self.gamework.is_published)

    def test_unpublish_gamework_not_author(self):
        """
        Test that a user cannot unpublish a gamework they do not own.
        """
        self.other_user_gamework.is_published = True
        self.other_user_gamework.save()

        url = reverse('unpublish-gamework', kwargs={'pk': self.other_user_gamework.id})
        response = self.client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['message'], '您没有权限取消发布该作品')

    def test_unpublish_gamework_as_admin(self):
        """
        Test successfully unpublishing a gamework as an admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('unpublish-gamework', kwargs={'pk': self.other_user_gamework.id})
        response = self.client.post(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

class GameworkFavoriteLeaderboardViewSetTestCase(APITestCase):
    """
    Test suite for the GameworkFavoriteLeaderboardViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)

        # Create sample gameworks
        self.gamework1 = Gamework.objects.create(
            author=self.user,
            title="Gamework 1",
            is_published=True
        )
        self.gamework2 = Gamework.objects.create(
            author=self.user,
            title="Gamework 2",
            is_published=True
        )
        self.gamework3 = Gamework.objects.create(
            author=self.user,
            title="Gamework 3",
            is_published=True
        )

        # Create favorites for the gameworks
        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework1.id)
        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework2.id)
        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework3.id)

    def test_favorite_leaderboard(self):
        """
        Test retrieving the favorite leaderboard correctly.
        """
        url = reverse('gamework-leaderboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 3)
        self.assertEqual(response.data['data'][0]['title'], "Gamework 1")  # Gamework 2 has the most favorites

class GameworkRatingLeaderboardViewSetTestCase(APITestCase):
    """
    Test suite for the GameworkRatingLeaderboardViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)

        # Create gameworks
        self.gamework1 = Gamework.objects.create(
            author=self.user,
            title="Gamework 1",
            is_published=True
        )
        self.gamework2 = Gamework.objects.create(
            author=self.user,
            title="Gamework 2",
            is_published=True
        )
        self.gamework3 = Gamework.objects.create(
            author=self.user,
            title="Gamework 3",
            is_published=True
        )

        # Create ratings for the gameworks
        self.gamework1.ratings.create(user_id=self.user.id, gamework_id=self.gamework1.id, score=5)
        self.gamework2.ratings.create(user_id=self.user.id, gamework_id=self.gamework2.id, score=4)
        self.gamework3.ratings.create(user_id=self.user.id, gamework_id=self.gamework3.id, score=4)

    def test_rating_leaderboard(self):
        """
        Test retrieving the rating leaderboard correctly.
        """
        url = reverse('gamework-rating-leaderboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 3)
        self.assertEqual(response.data['data'][0]['title'], "Gamework 1")  # Gamework 1 has the highest average rating

class GameworkHotLeaderboardViewSetTestCase(APITestCase):
    """
    Test suite for the GameworkHotLeaderboardViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)

        # Create gameworks
        self.gamework1 = Gamework.objects.create(
            author=self.user,
            title="Gamework 1",
            is_published=True
        )
        self.gamework2 = Gamework.objects.create(
            author=self.user,
            title="Gamework 2",
            is_published=True
        )
        self.gamework3 = Gamework.objects.create(
            author=self.user,
            title="Gamework 3",
            is_published=True
        )

        # Create comments and favorites for gameworks
        Comment.objects.create(gamework=self.gamework1, user=self.user, content="Great game!")
        Comment.objects.create(gamework=self.gamework1, user=self.user, content="Nice game!")
        Comment.objects.create(gamework=self.gamework2, user=self.user, content="Amazing game!")

        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework1.id)
        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework2.id)
        Favorite.objects.create(user_id=self.user.id, gamework_id=self.gamework3.id)

    def test_hot_leaderboard_total(self):
        """
        Test retrieving the hot leaderboard with total range.
        """
        url = reverse('gamework-hot-leaderboard')
        response = self.client.get(url, {'range': 'total'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 3)
        self.assertEqual(response.data['data'][0]['title'], "Gamework 1")  # Gamework 1 has the highest hot score

    def test_hot_leaderboard_month(self):
        """
        Test retrieving the hot leaderboard with month range.
        """
        url = reverse('gamework-hot-leaderboard')
        response = self.client.get(url, {'range': 'month'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 3)
        self.assertEqual(response.data['data'][0]['title'], "Gamework 1")

    def test_hot_leaderboard_invalid_range(self):
        """
        Test invalid range parameter.
        """
        url = reverse('gamework-hot-leaderboard')
        response = self.client.get(url, {'range': 'year'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "无效的 range 参数，可选值: total, month, week")

class GameworkSearchViewTestCase(APITestCase):
    """
    Test suite for the GameworkSearchView.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)

        # Create sample tags
        self.tag_adventure = Tag.objects.create(name="冒险")
        self.tag_rpg = Tag.objects.create(name="RPG")

        # Create sample gameworks
        self.gamework1 = Gamework.objects.create(
            author=self.user,
            title="冒险之旅",
            description="一个冒险的故事",
            is_published=True
        )
        self.gamework1.tags.add(self.tag_adventure, self.tag_rpg)

        self.gamework2 = Gamework.objects.create(
            author=self.user,
            title="战斗传奇",
            description="一个传奇的战斗故事",
            is_published=True
        )
        self.gamework2.tags.add(self.tag_adventure)

        self.gamework3 = Gamework.objects.create(
            author=self.user,
            title="魔法世界",
            description="探索魔法世界",
            is_published=True
        )
        self.gamework3.tags.add(self.tag_rpg)

    def test_search_by_title(self):
        """
        Test searching by title.
        """
        url = reverse('gamework-search')
        response = self.client.get(url, {'q': '冒险'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)  # Two gameworks contain "冒险"
        self.assertEqual(response.data['data'][0]['title'], "冒险之旅")

    def test_search_by_author(self):
        """
        Test searching by author.
        """
        url = reverse('gamework-search')
        response = self.client.get(url, {'author': 'testuser'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 3)  # All gameworks by 'testuser'
        self.assertEqual(response.data['data'][0]['author'], 'testuser')

    def test_search_by_tag(self):
        """
        Test searching by tag.
        """
        url = reverse('gamework-search')
        response = self.client.get(url, {'tag': '冒险'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 2)  # Two gameworks with "冒险" tag

    def test_search_no_results(self):
        """
        Test search with no matching results.
        """
        url = reverse('gamework-search')
        response = self.client.get(url, {'q': '不存在的标题'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 0)  # No results

    def test_search_multiple_filters(self):
        """
        Test search with multiple filters: title, author, and tag.
        """
        url = reverse('gamework-search')
        response = self.client.get(url, {'q': '冒险', 'author': 'testuser', 'tag': 'RPG'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 1)  # Only one match
        self.assertEqual(response.data['data'][0]['title'], "冒险之旅")

class RecommendViewTestCase(APITestCase):
    """
    Test suite for the RecommendView.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.other_user = User.objects.create_user(username='otheruser', password='testpassword', email='othertest@example.com')
        self.client.force_authenticate(user=self.user)

        # Create sample tags
        self.tag_adventure = Tag.objects.create(name="冒险")
        self.tag_rpg = Tag.objects.create(name="RPG")

        # Create sample gameworks
        self.gamework1 = Gamework.objects.create(
            author=self.other_user,
            title="冒险之旅",
            description="一个冒险的故事",
            is_published=True
        )
        self.gamework1.tags.add(self.tag_adventure, self.tag_rpg)

        self.gamework2 = Gamework.objects.create(
            author=self.other_user,
            title="战斗传奇",
            description="一个传奇的战斗故事",
            is_published=True
        )
        self.gamework2.tags.add(self.tag_adventure)

        self.gamework3 = Gamework.objects.create(
            author=self.other_user,
            title="魔法世界",
            description="探索魔法世界",
            is_published=True
        )
        self.gamework3.tags.add(self.tag_rpg)

        # The user liked the "冒险" tag
        self.user.liked_tags.add(self.tag_adventure)

    def test_recommendations_success(self):
        """
        Test recommendations based on liked tags.
        """
        url = reverse('gamework-recommend')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 2)  # Two gameworks with "冒险" tag
        self.assertEqual(response.data['data'][0]['title'], "战斗传奇")

    def test_recommendations_no_liked_tags(self):
        """
        Test that the user gets a 404 if no liked tags are set.
        """
        # Remove liked tags
        self.user.liked_tags.clear()
        
        url = reverse('gamework-recommend')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['message'], "用户未设置喜欢的标签")

    def test_recommendations_exclude_user_created(self):
        """
        Test that the recommendations exclude the user's own gameworks.
        """
        # Add liked tags but also create a new gamework by the user
        self.gamework4 = Gamework.objects.create(
            author=self.user,
            title="用户自己的游戏",
            description="该作品是用户自己创作的",
            is_published=True
        )
        self.gamework4.tags.add(self.tag_adventure)

        url = reverse('gamework-recommend')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 2)  # Should exclude "用户自己的游戏"
        self.assertNotIn('用户自己的游戏', [gamework['title']for gamework in response.data['data']])
