import re

from .openai_client import invoke, prompt
from .prompts import report_system_prompt


def _parse_report(text: str) -> dict:
    """从报告文本中提取称号、评价和特质"""
    title_match = re.search(r"\[称号\][：:]\s*(.+)", text)
    content_match = re.search(r"\[评价\][：:]\s*(.+)", text)
    traits_match = re.search(r"\[特质\][：:]\s*(.+)", text)

    title = title_match.group(1).strip() if title_match else "未知称号"
    content = content_match.group(1).strip() if content_match else "暂无评价"
    traits_str = traits_match.group(1).strip() if traits_match else ""

    # 处理特质分隔符
    traits = [t.strip() for t in re.split(r"[，,、]", traits_str) if t.strip()]

    return {"title": title, "content": content, "traits": traits}


def generate_report_content(global_summary: str, ending_summary: str, ending_title: str) -> dict:
    """生成游戏结局报告内容"""
    user_prompt = f"""
# 全局剧情摘要
{global_summary}

# 达成结局
标题：{ending_title}
概述：{ending_summary}
"""
    response = invoke(prompt(report_system_prompt, user_prompt))
    return _parse_report(response)
