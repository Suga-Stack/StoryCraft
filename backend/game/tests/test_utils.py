from django.test import TestCase
from game import utils

class TestUtils(TestCase):

    def test_extract_chapter_title(self):
        self.assertEqual(utils._extract_chapter_title("第1章 - 初始"), (1, "初始"))
        self.assertEqual(utils._extract_chapter_title("  第10章  -  复杂的标题  \n后续内容"), (10, "复杂的标题"))
        self.assertEqual(utils._extract_chapter_title("第5章-无空格"), (5, "无空格"))
        self.assertEqual(utils._extract_chapter_title("无效标题"), (0, "未命名章节"))
        self.assertEqual(utils._extract_chapter_title(""), (0, "未命名章节"))
        self.assertEqual(utils._extract_chapter_title("第章 - 标题"), (0, "未命名章节"))

    def test_parse_attr_deltas(self):
        self.assertEqual(utils._parse_attr_deltas("勇气+1"), {"勇气": 1})
        self.assertEqual(utils._parse_attr_deltas("智慧+2 魅力-1"), {"智慧": 2, "魅力": -1})
        self.assertEqual(utils._parse_attr_deltas("敏捷+5,体质+10"), {"敏捷": 5, "体质": 10})
        self.assertEqual(utils._parse_attr_deltas("力量-2、精神+3"), {"力量": -2, "精神": 3})
        self.assertEqual(utils._parse_attr_deltas("  好感度 +5  "), {"好感度": 5})
        self.assertEqual(utils._parse_attr_deltas("声望+1, 道德-1 财富+100"), {"声望": 1, "道德": -1, "财富": 100})
        self.assertEqual(utils._parse_attr_deltas("无效+ 5"), {})
        self.assertEqual(utils._parse_attr_deltas(""), {})

    def test_normalize_block(self):
        text = "  你好\n\n世界。\r\n  这  是\t测试。  "
        expected = "你好 世界。 这 是 测试。"
        self.assertEqual(utils._normalize_block(text), expected)
        self.assertEqual(utils._normalize_block(""), "")
        self.assertEqual(utils._normalize_block("   "), "")

    def test_split_sentences(self):
        text = "第一句话。第二句话！第三句话？\n第四句话。"
        expected = ["第一句话。", "第二句话！", "第三句话？", "第四句话。"]
        self.assertEqual(utils._split_sentences(text), expected)
        self.assertEqual(utils._split_sentences(""), [])

    def test_chunk_narrations(self):
        text = "这是一个非常长的句子，它的长度肯定会超过默认的最大值限制，所以它自己应该成为一个独立的块。"
        self.assertEqual(utils._chunk_narrations(text, max_len=30), [text])

        text = "短句1。短句2。短句3。这是一个稍长一点的句子aaaaaa。最后一句。"
        expected = ["短句1。短句2。短句3。", "这是一个稍长一点的句子aaaaaa。", "最后一句。"]
        self.assertEqual(utils._chunk_narrations(text, min_len=10, max_len=20), expected)

        # Test merging short chunks
        text = "第一句。第二句。第三句。第四句。"
        expected = ["第一句。第二句。第三句。第四句。"]
        self.assertEqual(utils._chunk_narrations(text, min_len=10, max_len=30), expected)
        
        self.assertEqual(utils._chunk_narrations(""), [])

    def test_chunk_reaction(self):
        text = "这是一个即时反应。它由两个句子组成。"
        expected = ["这是一个即时反应。它由两个句子组成。"]
        self.assertEqual(utils._chunk_reaction(text, min_len=10, max_len=50), expected)

        # Test merging last short chunk
        text = "这是一个比较长的反应，用来分割。这是个短反应。"
        expected = ["这是一个比较长的反应，用来分割。这是个短反应。"]
        self.assertEqual(utils._chunk_reaction(text, min_len=20, max_len=25), expected)

        # Test single short chunk is kept
        text = "很短。"
        self.assertEqual(utils._chunk_reaction(text, min_len=20), ["很短。"])
        
        self.assertEqual(utils._chunk_reaction(""), [])

    def test_smart_quotes(self):
        self.assertEqual(utils._smart_quotes('他说："你好\'世界\'"'), '他说：“你好‘世界’”')
        self.assertEqual(utils._smart_quotes('""'), '“”')
        self.assertEqual(utils._smart_quotes("''"), "‘’")
        self.assertEqual(utils._smart_quotes(""), "")

    def test_strip_headers(self):
        text = "第1章 - 标题\n### 剧情内容\n这是正文。"
        self.assertEqual(utils._strip_headers(text), "这是正文。")
        text_no_subtitle = "第2章 - 另一个\n这是正文。"
        self.assertEqual(utils._strip_headers(text_no_subtitle), "这是正文。")
        text_only_title = "第3章 - 标题\n"
        self.assertEqual(utils._strip_headers(text_only_title), "")

    def test_iter_choice_groups(self):
        text = """
这是剧情。
→ A. 选择1 [属性影响：勇气+1]
这是选择1的反应。
→ B. 选择2 [属性影响：智慧-1]

→ C. 选择3 [属性影响：魅力+5]
这是选择3的反应。
这是结尾。
"""
        groups = utils._iter_choice_groups(text)
        self.assertEqual(len(groups), 1)
        choices = groups[0]["choices"]
        self.assertEqual(len(choices), 3)
        self.assertEqual(choices[0]["text"], "选择1")
        self.assertEqual(choices[0]["attributesDelta"], {"勇气": 1})
        self.assertEqual(choices[0]["subsequentDialogues"], ["这是选择1的反应。"])
        self.assertEqual(choices[1]["text"], "选择2")
        self.assertEqual(choices[1]["subsequentDialogues"], []) # No reaction line
        self.assertEqual(choices[2]["text"], "选择3")
        self.assertEqual(choices[2]["attributesDelta"], {"魅力": 5})
        self.assertEqual(choices[2]["subsequentDialogues"], ["这是选择3的反应。"])

    def test_parse_raw_chapter_full(self):
        raw_content = """
第1章 - 冒险的开始

### 剧情内容

你站在一个古老的十字路口，风中传来远方的呼唤。这是一个重要的决定。你必须做出选择。

→ A. 向北走 [属性影响：勇气+1]
你踏上了北方的道路，感觉一股暖流涌上心头。

→ B. 向南走 [属性影响：智慧+1]

你选择了南方，一条更为隐蔽的小径。

故事继续，你遇到了一条河。
"""
        parsed = utils.parse_raw_chapter(raw_content, ranges=[50,100])
        
        self.assertEqual(parsed["chapterIndex"], 1)
        self.assertEqual(parsed["title"], "冒险的开始")
        self.assertEqual(len(parsed["scenes"]), 2)

        # Scene 1
        scene1 = parsed["scenes"][0]
        self.assertEqual(scene1["id"], 1)
        dialogues1 = scene1["dialogues"]
        self.assertEqual(len(dialogues1), 2)
        self.assertEqual(dialogues1[0]["narration"], "你站在一个古老的十字路口，风中传来远方的呼唤。")
        self.assertEqual(dialogues1[0]["playerChoices"], None)
        
        self.assertEqual(dialogues1[1]["narration"], "这是一个重要的决定。你必须做出选择。")
        choices = dialogues1[1]["playerChoices"]
        self.assertIsNotNone(choices)
        self.assertEqual(len(choices), 2)
        
        self.assertEqual(choices[0]["text"], "向北走")
        self.assertEqual(choices[0]["attributesDelta"], {"勇气": 1})
        self.assertEqual(choices[0]["subsequentDialogues"], ["你踏上了北方的道路，感觉一股暖流涌上心头。"])

        self.assertEqual(choices[1]["text"], "向南走")
        self.assertEqual(choices[1]["attributesDelta"], {"智慧": 1})
        self.assertEqual(choices[1]["subsequentDialogues"], ["你选择了南方，一条更为隐蔽的小径。"])

        # Scene 2
        scene2 = parsed["scenes"][1]
        self.assertEqual(scene2["id"], 2)
        dialogues2 = scene2["dialogues"]
        self.assertEqual(len(dialogues2), 1)
        self.assertEqual(dialogues2[0]["narration"], "故事继续，你遇到了一条河。")
        self.assertEqual(dialogues2[0]["playerChoices"], None)
