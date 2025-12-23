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
                        {"attributesDelta": {"勇气": 5, "智慧": 1}},
                        {"attributesDelta": {"勇气": -2}}
                    ]
                }]
            }]
        }]
        initial = {"勇气": 10}
        ranges = chapter.calculate_attributes(parsed_chapters, initial)
        # min: 10 + (-2) = 8, max: 10 + 5 = 15
        self.assertEqual(ranges["勇气"], [8, 15])
        # 智慧: 初始0, min=0+0=0, max=0+1=1
        self.assertEqual(ranges["智慧"], [0, 1])

    def test_calculate_attributes_no_initial(self):
        """测试无初始属性的情况"""
        parsed_chapters = [{
            "scenes": [{
                "dialogues": [{
                    "playerChoices": [
                        {"attributesDelta": {"魅力": 5}}
                    ]
                }]
            }]
        }]
        ranges = chapter.calculate_attributes(parsed_chapters, None)
        self.assertEqual(ranges["魅力"], [5, 5])

    def test_parse_ending_condition(self):
        """测试结局条件解析"""
        attr_ranges = {"勇气": [0, 100]}
        
        # 测试 较高 (>= 50%)
        text_high = "勇气较高"
        cond_high = chapter.parse_ending_condition(text_high, attr_ranges)
        self.assertEqual(cond_high["勇气"], ">=50")

        # 测试 较低 (<= 40%)
        text_low = "勇气较低"
        cond_low = chapter.parse_ending_condition(text_low, attr_ranges)
        self.assertEqual(cond_low["勇气"], "<=40")
        
        # 测试 中等 (>= 30%)
        text_mid = "勇气中等"
        cond_mid = chapter.parse_ending_condition(text_mid, attr_ranges)
        self.assertEqual(cond_mid["勇气"], ">=30")

        # 测试不在范围内的属性
        text_ignore = "理智值较高"
        cond_ignore = chapter.parse_ending_condition(text_ignore, attr_ranges)
        self.assertNotIn("理智值", cond_ignore)
        
        # 测试复杂句子与Markdown清洗
        text_complex = "若**勇气**较高，且[智慧]较低"
        ranges_complex = {"勇气": [0, 100], "智慧": [0, 100]}
        cond_complex = chapter.parse_ending_condition(text_complex, ranges_complex)
        self.assertEqual(cond_complex["勇气"], ">=50")
        self.assertEqual(cond_complex["智慧"], "<=40")
