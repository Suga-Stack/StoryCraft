from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from gameworks.models import Gamework
from interactions.models import Comment, ReadRecord
from users.models import CommentReport, CreditLog, GameworkReport, SignInLog, UserSignIn

User = get_user_model()


class SendEmailCodeViewTests(APITestCase):
    def test_send_email_code(self):
        response = self.client.post("/api/auth/send-email-code/", {"email": "test@example.com"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("验证码已发送", response.data["message"])

    def test_send_email_code_without_email(self):
        response = self.client.post("/api/auth/send-email-code/", {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("邮箱不能为空", response.data["message"])


class RegisterViewTests(APITestCase):
    def test_register_success(self):
        data = {
            "username": "newuser",
            "password": "password123",
            "confirm_password": "password123",
            "email": "newuser@example.com",
            "email_code": "123456",
        }
        cache.set("verify_code_newuser@example.com", "123456")
        response = self.client.post("/api/auth/register/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("注册成功", response.data["message"])

    def test_register_password_mismatch(self):
        data = {
            "username": "newuser",
            "password": "password123",
            "confirm_password": "wrongpassword",
            "email": "newuser@example.com",
            "email_code": "123456",
        }
        cache.set("verify_code_newuser@example.com", "123456")
        response = self.client.post("/api/auth/register/", data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("两次输入的密码不一致", str(response.data))


class UserViewSetTestCase(APITestCase):
    """
    Test suite for UserViewSet.
    """

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin", password="adminpassword", email="admin@example.com"
        )
        self.user = User.objects.create_user(username="testuser", password="testpassword", email="test@example.com")
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpassword", email="othertest@example.com"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.user_list_url = reverse("user-administration")
        self.url = reverse("user-administration-detail", kwargs={"id": self.user.id})

    def test_retrieve_user_as_admin(self):
        """
        Test that an admin can retrieve any user's details.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.user.username)

    def test_retrieve_user_as_normal_user(self):
        """
        Test that a normal user can only retrieve their own details.
        """
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.user.username)

        other_user_url = reverse("user-administration-detail", kwargs={"id": self.other_user.id})
        response = self.client.get(other_user_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_self_success(self):
        """
        Test that a user can delete their own account.
        """
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=self.user.id).exists())

    def test_delete_other_user_forbidden(self):
        """
        Test that a normal user cannot delete another user's account.
        """
        other_user_url = reverse("user-administration-detail", kwargs={"id": self.other_user.id})
        response = self.client.delete(other_user_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_user_as_admin(self):
        """
        Test that an admin can delete any user's account.
        """
        self.client.force_authenticate(user=self.admin_user)
        other_user_url = reverse("user-administration-detail", kwargs={"id": self.other_user.id})
        response = self.client.delete(other_user_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=self.other_user.id).exists())

    def test_list_users_as_admin(self):
        """
        Test that an admin can list all users.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.user_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), User.objects.count())

    def test_list_users_as_normal_user(self):
        """
        Test that a normal user can only see their own data.
        """
        response = self.client.get(self.user_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["username"], self.user.username)

    def test_partial_update_self_success(self):
        """
        Test partial update of own user data.
        """
        data = {"username": "updateduser"}
        response = self.client.patch(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "updateduser")

    def test_partial_update_other_user_forbidden(self):
        """
        Test partial update of another user's data is forbidden.
        """
        url = reverse("user-administration-detail", kwargs={"id": self.other_user.id})
        data = {"username": "forbiddenupdate"}
        response = self.client.patch(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_partial_update_as_admin_success(self):
        """
        Test partial update of another user's data as admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        data = {"username": "adminupdated"}
        response = self.client.patch(f"/api/users/admin/{self.other_user.id}/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.other_user.refresh_from_db()
        self.assertEqual(self.other_user.username, "adminupdated")


class LoginViewTestCase(APITestCase):
    """
    Test suite for LoginView.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="testpassword")
        self.url = reverse("login")

    def test_login_success(self):
        """
        Test successful login.
        """
        data = {"username": "testuser", "password": "testpassword"}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data["data"])
        self.assertIn("refresh", response.data["data"])

    def test_login_invalid_credentials(self):
        """
        Test login with invalid credentials.
        """
        data = {"username": "testuser", "password": "wrongpassword"}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ReadGameworkListViewTestCase(APITestCase):
    """
    Test suite for the ReadGameworkListView.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username="testuser", password="testpassword", email="test@example.com")
        self.other_user = User.objects.create_user(
            username="otheruser", password="testpassword", email="othertest@example.com"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.gamework1 = Gamework.objects.create(author=self.user, title="Test Gamework 1", price=10)
        self.gamework2 = Gamework.objects.create(author=self.user, title="Test Gamework 2", price=0)
        self.read_record1 = ReadRecord.objects.create(user=self.user, gamework=self.gamework1, is_visible=True)
        self.read_record2 = ReadRecord.objects.create(user=self.user, gamework=self.gamework2, is_visible=True)
        self.url = reverse("read_gameworks")

    def test_get_read_gameworks_success(self):
        """
        Test retrieving the list of read gameworks for the current user.
        """
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]), 2)
        self.assertEqual(response.data["data"][0]["title"], self.gamework2.title)
        self.assertEqual(response.data["data"][1]["title"], self.gamework1.title)

    def test_post_read_gamework_success(self):
        """
        Test recording a new read gamework.
        """
        new_gamework = Gamework.objects.create(author=self.other_user, title="New Gamework", price=0)
        data = {"gamework_id": new_gamework.id}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(ReadRecord.objects.filter(user=self.user, gamework=new_gamework).exists())

    def test_post_read_gamework_insufficient_credits(self):
        """
        Test recording a read gamework with insufficient credits.
        """
        self.user.user_credits = 0
        self.user.save()
        expensive_gamework = Gamework.objects.create(
            author=self.other_user, title="Expensive Gamework", price=100, is_published=True
        )
        data = {"gamework_id": expensive_gamework.id}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "积分不足，无法阅读该作品")

    def test_post_read_gamework_not_found(self):
        """
        Test recording a read gamework that does not exist.
        """
        data = {"gamework_id": 999}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "作品不存在")

    def test_post_read_gamework_no_gamework_id(self):
        """
        Test recording a read gamework without providing a gamework_id.
        """
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "gamework_id 不能为空")

    def test_delete_read_gameworks_success(self):
        """
        Test hiding specific read gameworks.
        """
        params = {"gamework_ids": f"{self.gamework1.id},{self.gamework2.id}"}
        response = self.client.delete(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "隐藏 2 条记录")
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
        self.assertEqual(response.data["message"], "隐藏 2 条记录")
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
        self.user = User.objects.create_user(username="testuser", password="testpassword", email="test@example.com")
        self.client.force_authenticate(user=self.user)
        self.url = reverse("user-signin")

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
        self.assertIn("dates", response.data)
        self.assertEqual(len(response.data["dates"]), 2)
        self.assertEqual(str(response.data["dates"][0]), str(today))
        self.assertEqual(str(response.data["dates"][1]), str(yesterday))

    def test_post_signin_success(self):
        """
        Test successful user sign-in.
        """
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "签到成功")
        self.assertEqual(response.data["continuous_days"], 1)
        self.assertGreater(response.data["reward"], 0)
        self.assertGreater(response.data["credits"], 0)

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
        self.assertEqual(response.data["message"], "今日已签到")
        self.assertEqual(response.data["continuous_days"], 3)
        self.assertEqual(response.data["reward"], 0)

    def test_post_signin_continuous_days(self):
        """
        Test signing in on consecutive days to verify continuous day calculation.
        """
        yesterday = date.today() - timedelta(days=1)
        UserSignIn.objects.create(user=self.user, last_signin_date=yesterday, continuous_days=2)

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RechargeViewSetTestCase(APITestCase):
    """
    Test suite for the RechargeViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username="testuser", password="testpassword", user_credits=100)
        self.client.force_authenticate(user=self.user)
        self.url = reverse("user-recharge")

    def test_recharge_success(self):
        """
        Test successful recharge of credits.
        """
        data = {"credits": 50}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["code"], 200)
        self.assertEqual(response.data["message"], "充值成功")
        self.assertEqual(response.data["new_credits"], 150)  # 100 + 50
        self.user.refresh_from_db()
        self.assertEqual(self.user.user_credits, 150)

    def test_recharge_invalid_credits_type(self):
        """
        Test recharge with invalid credits type (non-integer).
        """
        data = {"credits": "invalid"}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], 400)
        self.assertEqual(response.data["message"], "credits 必须为整数")
        self.user.refresh_from_db()
        self.assertEqual(self.user.user_credits, 100)

    def test_recharge_negative_credits(self):
        """
        Test recharge with negative credits.
        """
        data = {"credits": -10}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], 400)
        self.assertEqual(response.data["message"], "充值积分必须大于 0")
        self.user.refresh_from_db()
        self.assertEqual(self.user.user_credits, 100)

    def test_recharge_zero_credits(self):
        """
        Test recharge with zero credits.
        """
        data = {"credits": 0}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], 400)
        self.assertEqual(response.data["message"], "充值积分必须大于 0")
        self.user.refresh_from_db()
        self.assertEqual(self.user.user_credits, 100)

    def test_recharge_unauthenticated(self):
        """
        Test recharge without authentication.
        """
        self.client.force_authenticate(user=None)
        data = {"credits": 50}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.data)
        self.assertEqual(response.data["detail"], "Authentication credentials were not provided.")


class RewardViewSetTests(APITestCase):
    """
    Test suite for RewardViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(
            username="testuser", password="testpassword", email="test@example.com", user_credits=100
        )
        self.author = User.objects.create_user(
            username="authoruser", password="authorpassword", email="author@example.com", user_credits=50
        )
        self.gamework = Gamework.objects.create(author=self.author, title="Test Gamework")
        self.url = reverse("user-reward")
        self.client.force_authenticate(user=self.user)

    def test_reward_success(self):
        """
        Test successfully rewarding a gamework author.
        """
        data = {"gamework_id": self.gamework.id, "amount": 20}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["code"], 200)
        self.assertEqual(response.data["message"], "打赏成功")
        self.assertEqual(response.data["amount"], 20)
        self.assertEqual(response.data["author"], self.author.username)

        self.user.refresh_from_db()
        self.author.refresh_from_db()
        self.assertEqual(self.user.user_credits, 80)  # 100 - 20
        self.assertEqual(self.author.user_credits, 70)  # 50 + 20

    def test_reward_insufficient_credits(self):
        """
        Test rewarding a gamework author with insufficient credits.
        """
        data = {"gamework_id": self.gamework.id, "amount": 200}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], 400)
        self.assertEqual(response.data["message"], "积分不足，无法打赏")

        self.user.refresh_from_db()
        self.author.refresh_from_db()


class GameworkReportViewSetTests(APITestCase):
    """
    Test suite for GameworkReportViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username="testuser", password="testpassword", email="test@example.com")
        self.admin_user = User.objects.create_superuser(
            username="admin", password="adminpassword", email="other@example.com"
        )
        self.gamework = Gamework.objects.create(author=self.user, title="Test Gamework", is_published=True)
        self.report = GameworkReport.objects.create(
            gamework=self.gamework, reporter=self.user, tag="Inappropriate content"
        )
        self.url_list = reverse("gamework-report")
        self.url_detail = reverse("gamework-report-detail", kwargs={"pk": self.report.id})
        self.client.force_authenticate(user=self.user)

    def test_list_reports_as_user(self):
        """
        Test that a normal user can only see their own reports.
        """
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["tag"], self.report.tag)

    def test_list_reports_as_admin(self):
        """
        Test that an admin can see all reports.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_report_success(self):
        """
        Test successfully creating a report.
        """
        data = {"gamework": self.gamework.id, "tag": "Spam content"}
        response = self.client.post(self.url_list, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "作品举报成功")
        self.assertEqual(response.data["data"]["tag"], "Spam content")

    def test_create_report_invalid_gamework(self):
        """
        Test creating a report for a non-existent gamework.
        """
        data = {"gamework": 999, "tag": "Invalid gamework"}
        response = self.client.post(self.url_list, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_report_as_user(self):
        """
        Test retrieving a report as the reporter.
        """
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tag"], self.report.tag)

    def test_retrieve_report_as_admin(self):
        """
        Test retrieving a report as an admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tag"], self.report.tag)


class CreditLogViewSetTests(APITestCase):
    """
    Test suite for CreditLogViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(
            username="testuser", password="testpassword", email="test@ex.com", user_credits=100
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="testpassword", email="other@ex.com", user_credits=50
        )
        self.client.force_authenticate(user=self.user)

        # Create credit logs for the user
        self.credit_log1 = CreditLog.objects.create(
            user=self.user,
            change_amount=50,
            type="recharge",
            remark="User recharge",
            before_balance=50,
            after_balance=100,
        )

        self.url = reverse("user-creditlog")

    def test_list_credit_logs_success(self):
        """
        Test that a user can retrieve their own credit logs.
        """
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class CommentReportViewSetTests(APITestCase):
    """
    Test suite for CommentReportViewSet.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.user = User.objects.create_user(username="testuser", password="testpassword", email="test@example.com")
        self.admin_user = User.objects.create_superuser(
            username="admin", password="adminpassword", email="admin@example.com"
        )
        self.gamework = Gamework.objects.create(author=self.user, title="Test Gamework", is_published=True)
        self.comment = Comment.objects.create(user=self.user, gamework=self.gamework, content="This is a test comment.")
        self.comment_report = CommentReport.objects.create(comment=self.comment, reporter=self.user, tag="Spam")
        self.url_list = reverse("comment-report")
        self.url_detail = reverse("comment-report-detail", kwargs={"pk": self.comment_report.id})
        self.client.force_authenticate(user=self.user)

    def test_list_comment_reports_as_user(self):
        """
        Test that a normal user can only see their own comment reports.
        """
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["tag"], self.comment_report.tag)

    def test_list_comment_reports_as_admin(self):
        """
        Test that an admin can see all comment reports.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data["results"]), 1)

    def test_create_comment_report_success(self):
        """
        Test successfully creating a comment report.
        """
        data = {"comment": 1, "tag": "Inappropriate"}
        response = self.client.post(self.url_list, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "评论举报成功")
        self.assertEqual(response.data["data"]["tag"], "Inappropriate")

    def test_create_comment_report_invalid(self):
        """
        Test creating a comment report with invalid data.
        """
        data = {"tag": "Inappropriate"}
        response = self.client.post(self.url_list, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_comment_report_as_user(self):
        """
        Test retrieving a comment report as the reporter.
        """
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tag"], self.comment_report.tag)

    def test_retrieve_comment_report_as_admin(self):
        """
        Test retrieving a comment report as an admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tag"], self.comment_report.tag)

    def test_destroy_comment_report_as_admin(self):
        """
        Test deleting a comment report as an admin.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CommentReport.objects.filter(id=self.comment_report.id).exists())

    def test_destroy_comment_report_as_user(self):
        """
        Test deleting a comment report as a normal user.
        """
        response = self.client.delete(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(CommentReport.objects.filter(id=self.comment_report.id).exists())
