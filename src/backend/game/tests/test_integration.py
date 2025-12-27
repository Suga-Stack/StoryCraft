from unittest.mock import patch

from django.test import TestCase

from game import services
from gameworks.models import Gamework
from stories.models import Story, StoryChapter
from users.models import User


class TestServicesIntegration(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.gamework = Gamework.objects.create(author=self.user, title="Test Game")
        self.story = Story.objects.create(
            gamework=self.gamework,
            total_chapters=3,
            initial_generation_complete=True,
            chapter_directory="## 第1章 - 测试\n核心剧情：测试内容",
            initial_attributes={"勇气": 10},
        )

    @patch("game.services.generate_chapter_content")
    @patch("game.services.generate_scene_images")
    def test_generate_chapter_flow(self, mock_gen_images, mock_gen_content):
        """集成测试：生成章节流程"""
        # 模拟 AI 生成的内容
        mock_gen_content.return_value = (
            """
            这是第一章的正文内容。
            
            → A. [选项] [属性：勇气+1]
            反应文本。
            """,
            "Updated Summary",
        )

        # 模拟图片生成
        mock_gen_images.return_value = ([100], ["http://test.com/img.jpg"])

        # 调用 Service (同步调用)
        services._generate_chapter(self.gamework.id, 1)

        # 验证数据库状态
        chapter = StoryChapter.objects.get(story=self.story, chapter_index=1)

        # 1. 验证标题解析
        self.assertEqual(chapter.title, "第1章")

        # 2. 验证状态
        self.assertEqual(chapter.status, StoryChapter.ChapterStatus.GENERATED)

        # 3. 验证解析内容
        parsed = chapter.parsed_content
        self.assertIn("scenes", parsed)
        self.assertEqual(len(parsed["scenes"]), 1)

        # 4. 验证场景对象创建
        self.assertEqual(chapter.scenes.count(), 1)
        scene = chapter.scenes.first()
        self.assertEqual(scene.background_image_url, "http://test.com/img.jpg")

        # 5. 验证 Story 更新
        self.story.refresh_from_db()
        self.assertEqual(self.story.global_summary, "Updated Summary")

    @patch("game.services._start_gamework_details_generation")
    def test_create_gamework(self, mock_start_gen):
        """集成测试：创建作品流程"""
        tags = ["冒险", "奇幻"]
        idea = "测试构思"

        result = services.create_gamework(self.user, tags, idea, "short")

        self.assertIn("gameworkId", result)
        gamework_id = result["gameworkId"]

        # 验证 Gamework 创建
        gw = Gamework.objects.get(pk=gamework_id)
        self.assertEqual(gw.author, self.user)
        self.assertEqual(gw.tags.count(), 2)

        # 验证 Story 创建
        self.assertTrue(hasattr(gw, "story"))
        self.assertTrue(3 <= gw.story.total_chapters <= 5)  # short: 3-5

        # 验证后台任务触发
        mock_start_gen.assert_called_once()
