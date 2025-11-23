from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core.cache import cache
from gameworks.models import Gamework
from interactions.models import ReadRecord
from game.models import GameSave
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
