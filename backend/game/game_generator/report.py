import re
from .openai_client import invoke,prompt
from .prompts import build_report_prompt

def _parse_report(text: str) -> dict:
    title_match = re.search(r"\[称号\][：:]\s*(.+)", text)
    content_match = re.search(r"\[评价\][：:]\s*(.+)", text)
    traits_match = re.search(r"\[特质\][：:]\s*(.+)", text)

    title = title_match.group(1).strip() if title_match else "未知称号"
    content = content_match.group(1).strip() if content_match else "暂无评价"
    traits_str = traits_match.group(1).strip() if traits_match else ""
    
    # 处理特质分隔符
    traits = [t.strip() for t in re.split(r'[，,、]', traits_str) if t.strip()]

    return {
        "title": title,
        "content": content,
        "traits": traits
    }

def generate_report_content(global_summary: str, ending_summary: str, ending_title: str) -> dict:
    r_prompt = build_report_prompt(global_summary, ending_summary, ending_title)
    response = invoke(prompt("",r_prompt))
    return _parse_report(response)
