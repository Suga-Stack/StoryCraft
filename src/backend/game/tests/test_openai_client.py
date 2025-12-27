from unittest.mock import MagicMock, patch

from django.test import TestCase

from game.game_generator import openai_client


class TestOpenAIClient(TestCase):
    @patch("game.game_generator.openai_client.text_client")
    def test_invoke_success(self, mock_client):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "AI Response"
        mock_client.chat.completions.create.return_value = mock_response

        result = openai_client.invoke([{"role": "user", "content": "test"}])
        self.assertEqual(result, "AI Response")

    @patch("game.game_generator.openai_client.text_client")
    def test_invoke_failure(self, mock_client):
        mock_client.chat.completions.create.side_effect = Exception("API Error")

        result = openai_client.invoke([{"role": "user", "content": "test"}])
        self.assertEqual(result, "")

    @patch("game.game_generator.openai_client.image_client")
    @patch("game.game_generator.openai_client._save_image_from_url")
    def test_generate_single_image_success(self, mock_save, mock_client):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(url="http://test.com/img.jpg")]
        mock_client.images.generate.return_value = mock_response
        mock_save.return_value = "http://local/img.jpg"

        url = openai_client.generate_single_image("prompt")
        self.assertEqual(url, "http://local/img.jpg")

    @patch("game.game_generator.openai_client.image_client")
    def test_generate_single_image_failure(self, mock_client):
        mock_client.images.generate.side_effect = Exception("API Error")
        url = openai_client.generate_single_image("prompt")
        self.assertIn("placeholders/cover.jpg", url)

    @patch("game.game_generator.openai_client.image_client")
    @patch("game.game_generator.openai_client._save_image_from_url")
    def test_generate_multi_images(self, mock_save, mock_client):
        mock_response = MagicMock()
        mock_response.data = [MagicMock(url="http://test.com/img1.jpg")]
        mock_client.images.generate.return_value = mock_response
        mock_save.return_value = "http://local/img1.jpg"

        # Request 2 images, API returns 1, logic should fill with placeholder or retry
        # Here we test basic flow
        urls = openai_client.generate_multi_images(["p1", "p2"])
        self.assertEqual(len(urls), 2)
        self.assertEqual(urls[0], "http://local/img1.jpg")
