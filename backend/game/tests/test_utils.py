from django.test import TestCase

from game import utils


class TestUtils(TestCase):
    def test_parse_attr_deltas(self):
        """测试属性变化解析"""
        text1 = "观察力+5， 信任值-3, 智力+1"
        result = utils._parse_attr_deltas(text1)
        self.assertEqual(result, {"观察力": 5, "信任值": -3, "智力": 1})

        text2 = "策略值+5，记忆完整度-10"
        result2 = utils._parse_attr_deltas(text2)
        self.assertEqual(result2, {"策略值": 5, "记忆完整度": -10})

        text3 = "无属性变化"
        result3 = utils._parse_attr_deltas(text3)
        self.assertEqual(result3, {})

    def test_split_sentences_quotes(self):
        """测试分句：包含引号的情况"""
        text = '她笑着说："你好啊，今天天气真不错。"然后转身离开。'
        sents = utils._split_sentences(text)
        # 期望引号内的内容不被拆分，且尽量与引导语合并
        full_text = "".join(sents)
        self.assertIn('："你好啊，今天天气真不错。"', full_text)

    def test_iter_choice_groups(self):
        """测试选项组识别"""
        text = """
        前文。
        → A. [选项一] [属性：勇猛+1]
        反应一。
        
        → B. [选项二] [属性：智慧+1]
        反应二。
        
        后文。
        """
        groups = utils._iter_choice_groups(text)
        self.assertEqual(len(groups), 1)
        choices = groups[0]["choices"]
        self.assertEqual(len(choices), 2)
        self.assertEqual(choices[0]["text"], "选项一")
        self.assertEqual(choices[0]["effects"], {"勇猛": 1})
        self.assertEqual(choices[0]["reaction_text"], "反应一。")
        self.assertEqual(choices[1]["text"], "选项二")
        self.assertEqual(choices[1]["reaction_text"], "反应二。")

    def test_parse_raw_chapter(self):
        """测试完整章节解析"""
        raw = """
        这是开场白。
        
        → A. [进攻] [属性：勇猛+1]
        你冲了上去。
        
        → B. [撤退] [属性：智慧+1]
        你悄悄溜走了。
        
        这是结局。
        """
        # 假设 ranges=[100]
        result = utils.parse_raw_chapter(raw, [100])
        scenes = result["scenes"]
        self.assertEqual(len(scenes), 1)
        dialogues = scenes[0]["dialogues"]

        # 验证结构
        has_choices = False
        for d in dialogues:
            if "playerChoices" in d:
                has_choices = True
                choices = d["playerChoices"]
                self.assertEqual(len(choices), 2)
                self.assertEqual(choices[0]["text"], "进攻")
                self.assertIn("你冲了上去", choices[0]["subsequentDialogues"][0])

        self.assertTrue(has_choices)

    def test_update_story_directory(self):
        """测试大纲更新"""

        class MockStory:
            chapter_directory = """
## 第1章 - 旧标题
**核心剧情**：旧剧情内容。
- 选择点设计：保留。

## 第2章 - 其他
"""

            def save(self):
                pass

        story = MockStory()
        new_outlines = [{"chapterIndex": 1, "title": "新标题", "outline": "新剧情内容。"}]

        utils.update_story_directory(story, new_outlines)

        self.assertIn("第1章 - 新标题", story.chapter_directory)
        self.assertIn("新剧情内容。", story.chapter_directory)
        self.assertNotIn("旧剧情内容", story.chapter_directory)
        self.assertIn("- 选择点设计：保留", story.chapter_directory)
