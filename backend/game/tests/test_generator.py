from django.test import TestCase
from game.game_generator import architecture, chapter

class TestGeneratorParsing(TestCase):
    def test_parse_outlines_short_format(self):
        """测试短篇格式大纲解析"""
        text = """
        ## 第1章 - 起源
        - 核心剧情：主角醒来。
        - 选择点设计：...
        
        ## 第2章 - 冲突
        **核心剧情**：遇到敌人。
        """
        outlines = architecture._parse_outlines(text)
        self.assertEqual(len(outlines), 2)
        self.assertEqual(outlines[0]['title'], "起源")
        self.assertEqual(outlines[0]['outline'], "主角醒来。")
        self.assertEqual(outlines[1]['title'], "冲突")
        self.assertEqual(outlines[1]['outline'], "遇到敌人。")

    def test_parse_outlines_long_format(self):
        """测试长篇格式大纲解析"""
        text = """
        ## 第1章 - 序幕
        **章节大纲**：这是详细的大纲内容。
        
        ## 第2章 - 发展
        """
        outlines = architecture._parse_outlines(text)
        self.assertEqual(len(outlines), 2)
        self.assertEqual(outlines[0]['outline'], "这是详细的大纲内容。")

    def test_calculate_attributes(self):
        """测试属性范围计算"""
        parsed_chapters = [{
            "scenes": [{
                "dialogues": [{
                    "playerChoices": [
                        {"attributesDelta": {"勇气": 5}},
                        {"attributesDelta": {"勇气": -2}}
                    ]
                }]
            }]
        }]
        initial = {"勇气": 10}
        ranges = chapter.calculate_attributes(parsed_chapters, initial)
        # min: 10 + (-2) = 8, max: 10 + 5 = 15
        self.assertEqual(ranges["勇气"], [8, 15])

    def test_parse_ending_condition(self):
        """测试结局条件解析"""
        attr_ranges = {"勇气": [0, 100]}
        text = "勇气较高，理智值较低" # 理智值不在ranges里，应忽略
        
        cond = chapter.parse_ending_condition(text, attr_ranges)
        
        # 较高 >= 60% -> >= 60
        self.assertIn("勇气", cond)
        self.assertEqual(cond["勇气"], ">=60")
        self.assertNotIn("理智值", cond)
