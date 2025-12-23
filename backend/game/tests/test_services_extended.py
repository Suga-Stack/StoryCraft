from django.test import TestCase
from unittest.mock import patch, MagicMock
from game import services
from gameworks.models import Gamework, Music
from tags.models import Tag
from users.models import User
from stories.models import Story, StoryChapter, StoryScene, StoryEnding

class TestServicesExtended(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.gamework = Gamework.objects.create(author=self.user, title="Test")
        self.story = Story.objects.create(gamework=self.gamework, total_chapters=5)

    def test_select_background_music(self):
        tag1 = Tag.objects.create(name="Tag1")
        tag2 = Tag.objects.create(name="Tag2")
        
        m1 = Music.objects.create(url="m1")
        m1.tags.add(tag1)
        m2 = Music.objects.create(url="m2")
        m2.tags.add(tag2)
        m3 = Music.objects.create(url="m3") # No tags
        
        selected = services._select_background_music(["Tag1"])
        self.assertIn(m1, selected)
        # Should fill up to 3 (or 4 based on logic) with random if needed
        self.assertTrue(len(selected) >= 1)

    def test_resolve_total_chapters(self):
        self.assertTrue(3 <= services._resolve_total_chapters("short") <= 5)
        self.assertTrue(6 <= services._resolve_total_chapters("medium") <= 10)
        self.assertTrue(11 <= services._resolve_total_chapters("long") <= 15)

    def test_resolve_scene_cover_url(self):
        chapter = StoryChapter.objects.create(story=self.story, chapter_index=1)
        scene = StoryScene.objects.create(chapter=chapter, scene_index=1, background_image_url="/media/test.jpg")
        
        url = services.resolve_scene_cover_url(self.gamework, chapter_index=1, scene_index=1)
        self.assertIn("/media/test.jpg", url)
        
        url_none = services.resolve_scene_cover_url(self.gamework, chapter_index=99, scene_index=1)
        self.assertIsNone(url_none)

    def test_get_chapter_status_logic(self):
        # Case 1: Chapter exists
        StoryChapter.objects.create(story=self.story, chapter_index=1, status=StoryChapter.ChapterStatus.GENERATED)
        status = services.get_chapter_status(self.gamework, 1)
        self.assertEqual(status["status"], "ready")
        
        # Case 2: Generating
        self.story.is_generating = True
        self.story.current_generating_chapter = 2
        self.story.save()
        status = services.get_chapter_status(self.gamework, 2)
        self.assertEqual(status["status"], "generating")
        
        # Case 3: Pending
        status = services.get_chapter_status(self.gamework, 3)
        self.assertEqual(status["status"], "pending")

    @patch('game.services.generate_report_content')
    def test_generate_and_save_report(self, mock_gen):
        mock_gen.return_value = {"title": "T", "content": "C", "traits": ["A"]}
        ending = StoryEnding.objects.create(story=self.story, ending_index=1)
        
        services._generate_and_save_report(self.story, ending)
        
        self.assertTrue(hasattr(ending, 'report'))
        self.assertEqual(ending.report.title, "T")

    def test_get_ending_report_scores(self):
        # Setup attributes ranges
        # Mock calculate_attributes via patching or setting up parsed content
        # Here we just test the score calculation logic if we can mock calculate_attributes
        with patch('game.services.calculate_attributes') as mock_calc:
            mock_calc.return_value = {"勇气": [0, 10]}
            ending = StoryEnding.objects.create(story=self.story, ending_index=1)
            from game.models import GameReport
            GameReport.objects.create(story_ending=ending, title="T", content="C", traits=[])
            
            report = services.get_ending_report(self.gamework.id, 1, {"勇气": 5})
            self.assertEqual(report["status"], "ready")
            self.assertEqual(report["details"]["scores"]["勇气"], 50) # 5/10 * 100
