from datetime import date, timedelta
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from gameworks.models import Gamework
from interactions.models import ReadRecord
from game.models import GameSave
from users.models import UserSignIn, SignInLog
from django.utils import timezone

User = get_user_model()

class SendEmailCodeViewTests(APITestCase):
    def test_send_email_code(self):
        response = self.client.post('/api/auth/send-email-code/', {"email": "test@example.com"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("验证码已发送", response.data['message'])

    def test_send_email_code_without_email(self):
        response = self.client.post('/api/auth/send-email-code/', {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("邮箱不能为空", response.data['message'])

class RegisterViewTests(APITestCase):
    def test_register_success(self):
        data = {
            "username": "newuser",
            "password": "password123",
            "confirm_password": "password123",
            "email": "newuser@example.com",
            "email_code": "123456"
        }
        cache.set('verify_code_newuser@example.com', "123456")
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("注册成功", response.data['message'])

    def test_register_password_mismatch(self):
        data = {
            "username": "newuser",
            "password": "password123",
            "confirm_password": "wrongpassword",
            "email": "newuser@example.com",
            "email_code": "123456"
        }
        cache.set('verify_code_newuser@example.com', "123456")
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("两次输入的密码不一致", str(response.data))

class UserViewSetTestCase(APITestCase):
    """
    Test suite for UserViewSet.
    """

    def setUp(self):
        self.admin_user = User.objects.create_superuser(username='admin', password='adminpassword', email="admin@example.com")
        self.user = User.objects.create_user(username='testuser', password='testpassword', email="test@example.com")
        self.other_user = User.objects.create_user(username='otheruser', password='otherpassword', email="othertest@example.com")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = reverse('user-administration-detail', kwargs={'id': self.user.id})

    def test_partial_update_self_success(self):
        """
        Test partial update of own user data.
        """
        data = {'username': 'updateduser'}
        response = self.client.patch(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'updateduser')

    def test_partial_update_other_user_forbidden(self):
        """
        Test partial update of another user's data is forbidden.
        """
        url = reverse('user-administration-detail', kwargs={'id': self.other_user.id})
        data = {'username': 'forbiddenupdate'}
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_partial_update_as_admin_success(self):
        """
        Test partial update of another user's data as admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        data = {'username': 'adminupdated'}
        response = self.client.patch(f'/api/users/admin/{self.other_user.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.username, 'adminupdated')


class LoginViewTestCase(APITestCase):
    """
    Test suite for LoginView.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.url = reverse('login')

    def test_login_success(self):
        """
        Test successful login.
        """
        data = {'username': 'testuser', 'password': 'testpassword'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data['data'])
        self.assertIn('refresh', response.data['data'])

    def test_login_invalid_credentials(self):
        """
        Test login with invalid credentials.
        """
        data = {'username': 'testuser', 'password': 'wrongpassword'}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class ReadGameworkListViewTestCase(APITestCase):
    """
    Test suite for the ReadGameworkListView.
    """
    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email="test@example.com")
        self.other_user = User.objects.create_user(username='otheruser', password='testpassword', email='othertest@example.com')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.gamework1 = Gamework.objects.create(
            author=self.user,
            title="Test Gamework 1",
            price=10
        )
        self.gamework2 = Gamework.objects.create(
            author=self.user,
            title="Test Gamework 2",
            price=0
        )
        self.read_record1 = ReadRecord.objects.create(
            user=self.user,
            gamework=self.gamework1,
            is_visible=True
        )
        self.read_record2 = ReadRecord.objects.create(
            user=self.user,
            gamework=self.gamework2,
            is_visible=True
        )
        self.url = reverse('read_gameworks')

    def test_get_read_gameworks_success(self):
        """
        Test retrieving the list of read gameworks for the current user.
        """
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']), 2)
        self.assertEqual(response.data['data'][0]['title'], self.gamework2.title)
        self.assertEqual(response.data['data'][1]['title'], self.gamework1.title)

    def test_post_read_gamework_success(self):
        """
        Test recording a new read gamework.
        """
        new_gamework = Gamework.objects.create(
            author=self.other_user,
            title="New Gamework",
            price=0
        )
        data = {"gamework_id": new_gamework.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(ReadRecord.objects.filter(user=self.user, gamework=new_gamework).exists())

    def test_post_read_gamework_insufficient_credits(self):
        """
        Test recording a read gamework with insufficient credits.
        """
        self.user.user_credits = 0
        self.user.save()
        expensive_gamework = Gamework.objects.create(
            author=self.other_user,
            title="Expensive Gamework",
            price=100,
            is_published=True
        )
        data = {"gamework_id": expensive_gamework.id}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], '积分不足，无法阅读该作品')

    def test_post_read_gamework_not_found(self):
        """
        Test recording a read gamework that does not exist.
        """
        data = {"gamework_id": 999}
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], '作品不存在')

    def test_post_read_gamework_no_gamework_id(self):
        """
        Test recording a read gamework without providing a gamework_id.
        """
        response = self.client.post(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], 'gamework_id 不能为空')

    def test_delete_read_gameworks_success(self):
        """
        Test hiding specific read gameworks.
        """
        params = {'gamework_ids': f'{self.gamework1.id},{self.gamework2.id}'}
        response = self.client.delete(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], '隐藏 2 条记录')
        self.read_record1.refresh_from_db()
        self.read_record2.refresh_from_db()
        self.assertFalse(self.read_record1.is_visible)
        self.assertFalse(self.read_record2.is_visible)

    def test_delete_all_read_gameworks_success(self):
        """
        Test hiding all read gameworks.
        """
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], '隐藏 2 条记录')
        self.read_record1.refresh_from_db()
        self.read_record2.refresh_from_db()
        self.assertFalse(self.read_record1.is_visible)
        self.assertFalse(self.read_record2.is_visible)

class UserSignInViewTestCase(APITestCase):
    """
    Test suite for the UserSignInView.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')
        self.client.force_authenticate(user=self.user)
        self.url = reverse('user-signin')

    def test_get_signin_dates_success(self):
        """
        Test retrieving all sign-in dates for the current user.
        """
        # Create some sign-in logs for the user
        today = date.today()
        yesterday = today - timedelta(days=1)
        SignInLog.objects.create(user=self.user, date=today)
        SignInLog.objects.create(user=self.user, date=yesterday)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('dates', response.data)
        self.assertEqual(len(response.data['dates']), 2)
        self.assertEqual(str(response.data['dates'][0]), str(today))
        self.assertEqual(str(response.data['dates'][1]), str(yesterday))

    def test_post_signin_success(self):
        """
        Test successful user sign-in.
        """
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "签到成功")
        self.assertEqual(response.data['continuous_days'], 1)
        self.assertGreater(response.data['reward'], 0)
        self.assertGreater(response.data['credits'], 0)

        # Verify that the sign-in log was created
        signin_record = UserSignIn.objects.get(user=self.user)
        self.assertEqual(signin_record.continuous_days, 1)
        self.assertEqual(signin_record.last_signin_date, date.today())

    def test_post_signin_already_signed_in(self):
        """
        Test attempting to sign in when the user has already signed in today.
        """
        UserSignIn.objects.create(user=self.user, last_signin_date=date.today(), continuous_days=3)

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "今日已签到")
        self.assertEqual(response.data['continuous_days'], 3)
        self.assertEqual(response.data['reward'], 0)

    def test_post_signin_continuous_days(self):
        """
        Test signing in on consecutive days to verify continuous day calculation.
        """
        yesterday = date.today() - timedelta(days=1)
        UserSignIn.objects.create(user=self.user, last_signin_date=yesterday, continuous_days=2)

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)