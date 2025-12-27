from django.test import TestCase

from game.game_generator import architecture, chapter, images, report


class TestGeneratorParsing(TestCase):
    def test_parse_creative_directions(self):
        text = """
        【创意方向1】
        内容1
        【创意方向2】
        内容2
        """
        result = architecture._parse_creative_directions(text)
        self.assertEqual(len(result), 2)
        self.assertIn("内容1", result[0])
        self.assertIn("内容2", result[1])

        text_single = "单一内容"
        result_single = architecture._parse_creative_directions(text_single)
        self.assertEqual(len(result_single), 1)

    def test_extract_section(self):
        text = """
        一、创意信息
        这是创意信息内容。
        二、主要角色设定
        这是角色内容。
        """
        content = architecture._extract_section(text, "创意信息")
        self.assertEqual(content, "这是创意信息内容。")

        content_missing = architecture._extract_section(text, "不存在的标题")
        self.assertEqual(content_missing, "")

    def test_parse_title_description(self):
        text = """
        一、创意信息
        创意标题：测试标题
        创意简介：测试简介
        """
        title, desc = architecture._parse_title_description(text)
        self.assertEqual(title, "测试标题")
        self.assertEqual(desc, "测试简介")

    def test_parse_attributes(self):
        text = """
        三、完整属性系统
        - 属性名称：勇气
        - 初始值：10
        - 属性名称：智慧
        - 初始值：20
        """
        attrs = architecture._parse_attributes(text)
        self.assertEqual(attrs.get("勇气"), 10)
        self.assertEqual(attrs.get("智慧"), 20)

    def test_parse_endings(self):
        text = """
        六、多结局设计
        结局1：结局一
        触发条件：条件一
        核心剧情：剧情一
        
        结局2：结局二
        触发条件：条件二
        核心剧情：剧情二
        """
        endings = architecture._parse_endings(text)
        self.assertEqual(len(endings), 2)
        self.assertEqual(endings[0]["title"], "结局一")
        self.assertEqual(endings[0]["condition"], "条件一")

    def test_extract_chapter_block(self):
        text = """
        ## 第1章 - 标题1
        内容1
        ## 第2章 - 标题2
        内容2
        """
        block1 = chapter._extract_chapter_block(text, 1)
        self.assertIn("标题1", block1)
        self.assertIn("内容1", block1)

        block_missing = chapter._extract_chapter_block(text, 3)
        self.assertEqual(block_missing, "未找到该章节设定")

    def test_parse_report(self):
        text = """
        [称号]：测试称号
        [评价]：测试评价
        [特质]：特质1，特质2
        """
        result = report._parse_report(text)
        self.assertEqual(result["title"], "测试称号")
        self.assertEqual(result["content"], "测试评价")
        self.assertEqual(result["traits"], ["特质1", "特质2"])

    def test_extract_scenes_prompt(self):
        text = """
        ## 画面1：
        ### 范围：[50]
        Prompt1
        
        **画面2：**
        **范围**：100
        Prompt2
        """
        ranges, prompts = images._extract_scenes_prompt(text)
        self.assertEqual(ranges, [50, 100])
        self.assertEqual(len(prompts), 2)
        self.assertIn("Prompt1", prompts[0])
        self.assertIn("Prompt2", prompts[1])
