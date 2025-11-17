import openai
import re
import os
from typing import List

def build_core_seed_prompt(
    tags: List[str],
    idea: str,
    total_chapters: int
) -> str:
    return f"""
# 任务总览
你是一位资深文字冒险游戏编剧。请根据提供的核心信息，为一款新的基于对话选择的文字冒险游戏生成基础设定。

# 核心信息
- 核心标签: {', '.join(tags)}
- 核心构思: {idea if idea else '无特定构思，请根据标签自由发挥'}
- 总章节数: {total_chapters}
- 游戏风格：第二人称沉浸式

# 生成内容
1. 一个吸引人的游戏标题，简洁，概括力强。
2. 一段引人入胜的游戏剧情简介，大约100-150字。
3. 核心冲突：用单句公式概括游戏剧情本质，例如："作为一名[玩家身份]，你突然遭遇[核心事件]，必须[关键行动]，在这个过程中你将面临[主要挑战类型]的考验。"
4. 体验重点：包括：
  - 主要情感体验：[如：悬疑紧张、温馨治愈、热血冒险]
  - 自我发现旅程：通过选择了解自己的决策风格，同时获得游戏趣味
  - 核心互动形式：[如：对话选择、情境反应、道德抉择等]
5. 叙事特色：包括：
  - 沉浸感设计：[如何增强玩家代入感的具体方法]
  - 节奏控制：[如何合理控制章节间的节奏，保持玩家紧张感或期待感等]
  - 情感锚点：[让玩家产生情感共鸣的关键场景]
6. 玩家定位：明确玩家在游戏中的角色身份、初始处境、以及与其他角色的基本关系。

# 特别注意
- 生成的标题和简介旨在吸引读者注意，因此仅需简要概括，点到为止。
- 剧情核心冲突（故事本质）是全部章节剧情的核心"种子”，需具有高度概括性和冲突性，旨在为创作者提供一个清晰的故事主线和冲突基础。

# 格式要求
请严格按照以下格式返回结果，用中文输出，输出纯文本，不要输出任何解释：
[标题]：xxxx
[简介]：xxxx
[核心冲突]：xxxx
[体验重点]：xxxx
[叙事特色]：xxxx
[玩家定位]：xxxx
"""

def build_attribute_prompt(
    core_seed: str
) -> str:
    return f"""
# 任务总览
你是一位资深文字冒险游戏数值策划。请根据提供的游戏核心，设定玩家属性系统。

# 游戏核心
{core_seed}

# 属性维度设计
请设计4-6个核心属性，每个属性包含：
- 属性名称：[如"洞察力"]
- 定义说明：影响玩家什么方面的能力
- 初始值建议：15-25之间的具体数值
- 成长意义：该属性提升对游戏体验的影响
- 关键场景：在游戏中哪些情境下会用到此属性

# 数值平衡规则
- 初始总值限制：100点（4属性各25点，或5属性各20点等）
- 软性限制：避免某个属性过于强势

# 属性互动设计
为每个属性设计：
- 2个正向应用场景（属性高时的优势）
- 1个潜在风险（属性过高可能带来的问题）
- 与其他属性的协同效应

# 输出格式
请严格按以下表格形式输出（实际属性可与以下表格中属性不同），用中文输出，输出纯文本，不要输出任何解释：
| 属性 | 初始值 | 定义 | 关键应用 | 成长影响 |
|------|--------|------|----------|----------|
| 智力 | 20 | 逻辑分析和问题解决能力 | 解谜、推理、学习 | 解锁复杂对话选项 |
| 魅力 | 25 | 社交影响和说服力 | 谈判、建立关系 | 获得NPC更多帮助 |
| 勇气 | 18 | 面对危险时的决断力 | 冒险决策、对抗 | 解锁高风险高回报选项 |
| 洞察 | 22 | 观察细节和直觉判断 | 发现线索、识破谎言 | 提前获得关键信息 |
| 同理心 | 15 | 理解他人情感的能力 | 安慰、调解冲突 | 深化角色关系发展 |
"""

def build_character_dynamics_prompt(
    core_seed: str,
    attribute_system: str
) -> str:
    return f"""
# 任务总览
你是一位资深的文字冒险游戏编剧，请根据提供的游戏核心设定和属性系统，设计3-4个与玩家深度互动的核心角色。

# 游戏核心设定
{core_seed}

# 游戏属性系统
{attribute_system}

# 角色设计框架
每个角色包含：
- 角色姓名：[姓名]
- 身份标签：[简洁的身份描述，如"神秘导师"、"竞争对手"、"可靠盟友"]
- 与玩家关系：[初始关系+发展可能性]
- 核心互动模式：[如何与玩家互动，如"提供线索"、"制造冲突"、"情感支持"]
- 属性关联：[与哪些玩家属性产生互动]
- 关键选择点：[在哪些时刻会影响玩家的重要选择]

# 角色网络设计
- 角色间关系：简单的冲突或合作网络
- 与主线的关联：每个角色如何推动主线发展
- 情感权重：哪个角色承载最重要的情感体验

# 对话风格指引
为每个角色定义独特的对话风格，确保在第二人称叙事中保持一致性。

# 注意
避免复杂的角色背景故事，重点设计他们如何与"你"(玩家)互动。

# 格式要求
仅给出最终文本，用中文输出，不要输出任何解释。
"""

def _calculate_narrative_structure(total_chapters: int):
    """根据章节数量计算叙事结构参数"""
    
    # 规模分类
    if total_chapters <= 5:
        scale_type = "短篇体验"
        scale_description = "紧凑叙事，快速情感建立"
    elif total_chapters <= 10:
        scale_type = "中篇故事" 
        scale_description = "平衡发展，完整情感弧线"
    else:
        scale_type = "长篇冒险"
        scale_description = "丰富层次，深度角色发展"
    
    # 阶段划分计算
    if total_chapters <= 3:
        # 超短篇：引入→高潮→收尾
        stage_breakdown = """
【阶段一：快速建立】（第1章）
- 目标：极速建立玩家代入感和核心冲突
- 情感：好奇→投入

【阶段二：集中高潮】（第2章）
- 目标：核心情感爆发和关键选择
- 情感：紧张→释放

【阶段三：自然收束】（第3章）
- 目标：展现选择后果和个性报告铺垫
- 情感：满足→反思
"""
    elif total_chapters <= 6:
        # 短篇：建立→挑战→高潮→收尾
        setup_end = max(2, total_chapters // 3)
        climax_start = total_chapters - 1
        
        stage_breakdown = f"""
【阶段一：建立联结】（第1-{setup_end}章）
- 目标：快速建立核心关系和初始目标
- 情感：好奇→初步投入

【阶段二：核心挑战】（第{setup_end+1}-{climax_start-1}章）
- 目标：集中展现主要冲突和属性应用
- 情感：紧张→成长

【阶段三：情感高潮】（第{climax_start}章）
- 目标：情感爆发和关键决策
- 情感：激烈→释放

【阶段四：收尾反思】（第{total_chapters}章）
- 目标：自然收束和为报告铺垫
- 情感：满足→反思
"""
    elif total_chapters <= 10:
        # 中篇：完整四阶段
        setup_end = max(2, total_chapters // 4)
        development_end = total_chapters // 2
        climax_start = total_chapters - 2
        
        stage_breakdown = f"""
【阶段一：建立联结】（第1-{setup_end}章）
- 目标：建立玩家与角色、世界的深度联结
- 情感：好奇→情感投入

【阶段二：挑战成长】（第{setup_end+1}-{development_end}章）
- 目标：通过系列挑战促进属性成长
- 情感：紧张→成就感到

【阶段三：关系深化】（第{development_end+1}-{climax_start-1}章）
- 目标：深化角色关系，准备情感高潮
- 情感：复杂→情感累积

【阶段四：情感高潮】（第{climax_start}-{total_chapters-1}章）
- 目标：多层次情感爆发和重大选择
- 情感：激烈→释放

【阶段五：收尾反思】（第{total_chapters}章）
- 目标：完整收束和为个性报告提供素材
- 情感：满足→深度反思
"""
    else:
        # 长篇：丰富层次
        setup_end = max(3, total_chapters // 5)
        development1_end = total_chapters // 3
        development2_end = total_chapters // 2
        climax_start = total_chapters - 3
        
        stage_breakdown = f"""
【阶段一：世界建立】（第1-{setup_end}章）
- 目标：深度建立世界观和核心角色关系
- 情感：探索→初步联结

【阶段二：成长挑战】（第{setup_end+1}-{development1_end}章）
- 目标：基础属性成长和初步冲突
- 情感：挑战→小成就

【阶段三：关系发展】（第{development1_end+1}-{development2_end}章）
- 目标：深化角色关系和情感复杂度
- 情感：复杂→情感投资

【阶段四：危机累积】（第{development2_end+1}-{climax_start-1}章）
- 目标：累积紧张感，为高潮做准备
- 情感：压力→期待

【阶段五：情感高潮】（第{climax_start}-{total_chapters-1}章）
- 目标：多层次情感爆发和重大选择
- 情感：激烈→释放→反思

【阶段六：完整收束】（第{total_chapters}章）
- 目标：全面展现成长和关系变化
- 情感：满足→希望→反思
"""
    
    # 情感峰值计算
    if total_chapters <= 3:
        emotional_peaks = "- 核心高潮：第2章（唯一主要情感爆发点）"
    elif total_chapters <= 6:
        emotional_peaks = f"- 小高潮：第{total_chapters//2}章\n- 核心高潮：第{total_chapters-1}章"
    elif total_chapters <= 10:
        emotional_peaks = f"- 初期小高潮：第{total_chapters//3}章\n- 中期高潮：第{total_chapters//2}章\n- 核心高潮：第{total_chapters-1}章"
    else:
        emotional_peaks = f"- 初期小高潮：第{total_chapters//4}章\n- 成长高潮：第{total_chapters//2}章\n- 情感高潮：第{total_chapters-2}章\n- 最终高潮：第{total_chapters-1}章"
    
    # 集群规划
    cluster_count = min(4, max(2, total_chapters // 3))
    cluster_size = total_chapters // cluster_count
    
    cluster_breakdown = ""
    for i in range(cluster_count):
        start_chap = i * cluster_size + 1
        end_chap = (i + 1) * cluster_size if i < cluster_count - 1 else total_chapters
        cluster_breakdown += f"- 集群{i+1}（第{start_chap}-{end_chap}章）：[情感主题待定]\n"
    
    # 规模特异性设计
    scale_specific_design = ""
    if total_chapters <= 3:
        scale_specific_design = "**超短篇设计重点**：\n- 极速情感建立：第一章就要让玩家产生强烈代入感\n- 集中爆发：所有情感权重集中在第2章\n- 简洁收尾：第3章专注于选择后果展现和报告铺垫"
    elif total_chapters <= 6:
        scale_specific_design = "**短篇设计重点**：\n- 快速但不仓促：在有限章节内完成完整情感弧线\n- 选择精炼：每个选择都要有明确的情感权重\n- 属性聚焦：重点展示2-3个核心属性的成长"
    elif total_chapters <= 10:
        scale_specific_design = "**中篇设计重点**：\n- 平衡发展：确保每个阶段都有足够的情感发展空间\n- 关系深度：有空间发展1-2个深度角色关系\n- 节奏控制：避免前期过于平淡或后期过于仓促"
    else:
        scale_specific_design = "**长篇设计重点**：\n- 层次丰富：可以设计多层次的情感发展和角色弧光\n- 渐进成长：属性成长和关系变化更加细腻\n- 副线空间：可以有适当的支线情感发展"
    
    return {
        "scale_type": scale_type,
        "scale_description": scale_description,
        "stage_breakdown": stage_breakdown,
        "emotional_peaks": emotional_peaks,
        "cluster_count": cluster_count,
        "cluster_breakdown": cluster_breakdown,
        "scale_specific_design": scale_specific_design
    }

def build_game_architecture_prompt(
    core_seed: str,
    attribute_system: str,
    characters: str,
    total_chapters: int
) -> str:
    structure = _calculate_narrative_structure(total_chapters)
    return f"""
# 任务总览
你是一位资深的文字冒险游戏编剧，请根据给定的游戏核心设定、角色属性系统、人物设定为{total_chapters}章的文字冒险游戏设计叙事架构。

# 游戏核心设定
{core_seed}

# 属性系统
{attribute_system}

# 人物设定
{characters}

# 章节规模
共{total_chapters}章，{structure["scale_type"]}（{structure["scale_description"]}）

# 叙事曲线
{structure["stage_breakdown"]}

# 情感节奏设计
{structure["emotional_peaks"]}

# 章节集群规划
将{total_chapters}章划分为{structure["cluster_count"]}个情感单元：
{structure["cluster_breakdown"]}

# 架构设计原则
为确保不同规模下的体验完整性：
1. 核心情感弧线：无论章节多少，都要包含"建立→发展→高潮→收尾"的完整循环
2. 关键体验保障：确保以下核心体验点得到覆盖：
   - 玩家与至少1个核心角色的深度联结
   - 至少2次有意义的属性成长展示
   - 1个让玩家印象深刻的情感高潮
   - 自然的反思和收束时刻
3. 节奏密度控制：章节越少，情感节奏越紧凑；章节越多，情感层次越丰富

# 规模设计原则
{structure["scale_specific_design"]}

注意：此架构要为后续的章节生成提供清晰的阶段定位和情感目标，同时保留足够的创作灵活性。

# 输出格式要求
请严格按照以下结构和格式输出，输出纯文本，用中文输出，不要输出任何解释：
## 阶段详细规划

### 阶段一：[阶段名称]
**章节范围**：第[起始章]-[结束章]章
**核心目标**：[此阶段要达成的核心叙事目标]
**情感基调**：[主要的情感氛围]
**关键任务**：
- 任务1：[具体要完成的内容]
- 任务2：[具体要完成的内容]
- 任务3：[具体要完成的内容]
**属性聚焦**：[此阶段重点展示哪些属性]
**角色发展**：[此阶段重点发展哪些角色关系]

### 阶段二：[阶段名称]
**章节范围**：第[起始章]-[结束章]章
**核心目标**：[此阶段要达成的核心叙事目标]
**情感基调**：[主要的情感氛围]
**关键任务**：
- 任务1：[具体要完成的内容]
- 任务2：[具体要完成的内容]
- 任务3：[具体要完成的内容]
**属性聚焦**：[此阶段重点展示哪些属性]
**角色发展**：[此阶段重点发展哪些角色关系]

[根据实际阶段数量继续...]

## 章节集群设计

### 集群一：[集群主题]
**章节范围**：第[起始章]-[结束章]章
**情感主题**：[此集群的核心情感主题]
**关键互动**：
- [互动类型1]：[具体描述]
- [互动类型2]：[具体描述]
**情感发展**：[从什么情感状态发展到什么状态]
**选择权重**：[此集群中选择的情感影响程度：低/中/高]

### 集群二：[集群主题]
**章节范围**：第[起始章]-[结束章]章
**情感主题**：[此集群的核心情感主题]
**关键互动**：
- [互动类型1]：[具体描述]
- [互动类型2]：[具体描述]
**情感发展**：[从什么情感状态发展到什么状态]
**选择权重**：[此集群中选择的情感影响程度：低/中/高]

[根据实际集群数量继续...]

## 情感节奏控制点

### 情感峰值规划
- **第[X]章**：[峰值类型，如"小高潮"/"核心高潮"] - [具体情感描述]
- **第[Y]章**：[峰值类型，如"小高潮"/"核心高潮"] - [具体情感描述]
- **第[Z]章**：[峰值类型，如"小高潮"/"核心高潮"] - [具体情感描述]

### 情感低谷安排
- **第[A]章**：[安排平静期的目的]
- **第[B]章**：[安排反思期的价值]

## 属性系统整合

### 属性展示规划
- **[属性名称]**：重点展示阶段 = [阶段X, 阶段Y]；关键应用场景 = [场景1, 场景2]
- **[属性名称]**：重点展示阶段 = [阶段X, 阶段Y]；关键应用场景 = [场景1, 场景2]
- [继续所有属性...]

### 属性成长曲线
描述各属性在整个游戏过程中的预期成长路径和展示时机。

## 角色互动蓝图

### 核心角色发展路径
- **[角色A]**：情感联结阶段 = [阶段X]；关系深化阶段 = [阶段Y]；关键互动时刻 = [第Z章]
- **[角色B]**：情感联结阶段 = [阶段X]；关系深化阶段 = [阶段Y]；关键互动时刻 = [第Z章]
- [继续所有角色...]

---
**注意**：请确保所有章节编号、阶段范围与实际总章数{total_chapters}一致，避免出现超出范围的章节引用。
"""

def build_chapter_directory_prompt(
    core_seed: str,
    attribute_system: str, 
    characters: str,
    architecture: str,
    total_chapters: int
) -> str:
    """
    构建章节目录生成提示词
    """
    return f"""
# 任务概述
你是一位专业的文字冒险游戏编剧，需要为{total_chapters}章的游戏生成具体的章节目录。

# 核心约束信息（必须严格遵守）

## 游戏核心设定
{core_seed}

## 游戏属性系统
{attribute_system}

## 主要角色设定
{characters}

# 完整叙事架构
{architecture}

# 生成要求

## 每章目录格式
每章必须严格按照以下格式输出，不要输出任何解释：
### 第X章 - [章节标题]
**本章定位**：[基于架构中的阶段定位，如"危机建立"/"关系深化"/"真相揭露"]
**核心作用**：[具体说明本章要推进什么情节、展示什么属性、发展什么关系]
**悬念设计**：[低/中/高] - [具体悬念描述]
**伏笔操作**：[埋设/强化/回收] [具体伏笔内容]
**选择点设计**：
- 位置1：[选择情境描述]
  → 选项A：[选项描述] [影响属性：属性名±值]
  → 选项B：[选项描述] [影响属性：属性名±值] 
- 位置2：[选择情境描述]
  → 选项A：[选项描述] [影响属性：属性名±值]
  → 选项B：[选项描述] [影响属性：属性名±值]
**章节大纲**：[100-150字的情节概要，确保与前后章衔接]

## 生成规则

### 结构遵守
- 必须严格遵循架构中的阶段划分和章节范围
- 情感节奏必须匹配架构中的峰值规划
- 集群主题必须在对应章节中得到体现

### 属性整合
- 每章至少重点展示1-2个属性
- 选择点的属性影响值应在±2到±8点之间
- 确保各属性在整个游戏中得到均衡展示机会

### 角色发展
- 每章至少与1-2个核心角色有深度互动
- 角色关系发展要符合架构中的路径规划
- 关键互动时刻要安排在架构指定的章节

### 选择点设计原则
1. 每个选择点提供2个选项
2. 选项间体现不同的价值观倾向
3. 属性影响要合理且有意义
4. 确保选择后能在3句话内回归主线

### 技术实现约束
- 每章字数目标：1500-2000字

# 输出格式
请生成{total_chapters}章的完整目录，从第1章到第{total_chapters}章，严格按照上述每章格式输出。
"""

def extract_chapter_from_architecture(architecture: str, chapter_number: int) -> str:
    """从架构中提取本章特定信息"""
    
    stage_info = get_stage_for_chapter(architecture, chapter_number)
    
    return f"""
**所属阶段**：{stage_info['stage_name']}（第{stage_info['start_chapter']}-{stage_info['end_chapter']}章）
**阶段目标**：{stage_info['core_goal']}
**情感基调**：{stage_info['emotional_tone']}
**关键任务**：
{get_key_tasks_for_chapter(architecture, stage_info)}
**属性聚焦**：{get_focused_attributes(architecture, stage_info)}
**关键角色互动**：{get_key_character_interactions(architecture, chapter_number, stage_info)}
**所属集群**：{get_cluster_for_chapter(architecture, chapter_number)['cluster_name']} - {get_cluster_for_chapter(architecture, chapter_number)['emotional_theme']}
**选择权重**：{get_cluster_for_chapter(architecture, chapter_number)['choice_weight']}
"""

def get_stage_for_chapter(architecture: str, chapter_number: int) -> dict:
    """获取章节所属的阶段信息"""
    # 匹配阶段详细规划部分
    stages_section = re.search(r"## 阶段详细规划\s*(.*?)(?=## 章节集群设计|$)", architecture, flags=re.DOTALL)
    if not stages_section:
        print("not stages_section")
        return {"stage_name": "根据大纲自行判断", "core_goal": "根据大纲自行判断","emotional_tone":"根据大纲自行判断", "start_chapter": 1, "end_chapter": 1, "stage_num_str": "一"}
    
    stages_text = stages_section.group(1)

    stage_pattern = r"### (阶段(一|二|三|四|五|六|七|八|九|十))：([^\n]+)\s*.*?章节范围.*?：第(\d+)-(\d+)章\s*.*?核心目标.*?：([^\n]+)\s*.*?情感基调.*?：([^\n]+)"
    stages = re.findall(stage_pattern, stages_text, re.DOTALL)
    
    for stage in stages:
        stage_name, stage_num_str, stage_subtitle, start_chap, end_chap, core_goal, emotional_tone = stage
        start_chap = int(start_chap)
        end_chap = int(end_chap)
        # print(f"检查阶段: {stage_name}, 范围: {start_chap}-{end_chap}, 章节: {chapter_number}")  
        if start_chap <= chapter_number <= end_chap:
            result = {
                "stage_name": f"{stage_name}：{stage_subtitle.strip()}",
                "core_goal": core_goal.strip(),
                "emotional_tone": emotional_tone.strip(),
                "start_chapter": start_chap,
                "end_chapter": end_chap,
                "stage_num_str": stage_num_str
            }
            # print(result)
            return result
    
    # 如果没有找到匹配的阶段，返回默认值
    return {"stage_name": "根据大纲自行判断", "core_goal": "根据大纲自行判断","emotional_tone":"根据大纲自行判断", "start_chapter": 1, "end_chapter": 1, "stage_num_str": "一"}
    
def get_focused_attributes(architecture: str, stage_info: dict) -> str:
    """获取本章重点展示的属性"""
    # 从阶段信息中提取属性聚焦
    stage_section_pattern = rf"### {stage_info['stage_name']}[^#]*?属性聚焦\s*\*?\*?：\s*([^\n]+)"
    match = re.search(stage_section_pattern, architecture, re.DOTALL)
    if match:
        return match.group(1).strip()

    # 回退：从属性系统整合中获取
    attribute_section = re.search(r"## 属性系统整合\s*(.*?)(?=## 角色互动蓝图|$)", architecture, re.DOTALL)
    if attribute_section:
        # 提取属性展示规划
        attribute_display = re.search(r"### 属性展示规划\s*(.*?)(?=### |$)", attribute_section.group(1), re.DOTALL)
        if attribute_display:
            attributes = []
            lines = attribute_display.group(1).strip().split('\n')
            for line in lines:
                if '重点展示阶段' in line and f"阶段{stage_info['stage_num_str']}" in line:
                    attr_match = re.search(r"-?\s*\*?\*?([^：]+)\*?\*?[：:]", line)
                    if attr_match:
                        attributes.append(attr_match.group(1).strip())
            if attributes:
                return "、".join(attributes)
    
    return "所有属性综合考验"

def get_key_character_interactions(architecture: str, chapter_number: int, stage_info: dict) -> str:
    """获取本章关键角色互动（修复正则与回退逻辑）"""
    # 角色互动蓝图块提取
    blueprint_section = re.search(r"## 角色互动蓝图\s*(.*?)(?=## 技术实现指引|$)", architecture, re.DOTALL)
    if blueprint_section:
        block = blueprint_section.group(1)
        # 支持：- **姓名**：情感联结阶段 = [阶段一]；关系深化阶段 = [阶段二]；关键互动时刻 = [第5章]
        character_pattern = re.compile(
            r"-\s*\*{0,2}([^*\n：]+)\*{0,2}\s*：\s*情感联结阶段\s*=\s*\[([^\]]+)\]\s*；\s*关系深化阶段\s*=\s*\[([^\]]+)\]\s*；\s*关键互动时刻\s*=\s*\[第(\d+)章.*?\]",
            re.MULTILINE
        )
        characters = character_pattern.findall(block)
        interactions = []
        for char_name, connect_stage, deepen_stage, key_chapter in characters:
            try:
                key_chapter_int = int(key_chapter)
            except ValueError:
                continue
            stage_tag = f"阶段{stage_info['stage_num_str']}"
            if key_chapter_int == chapter_number:
                interactions.append(f"{char_name.strip()}（关键互动时刻）")
            elif stage_tag in connect_stage:
                interactions.append(f"{char_name.strip()}（情感联结）")
            elif stage_tag in deepen_stage:
                interactions.append(f"{char_name.strip()}（关系深化）")
        if interactions:
            return "、".join(interactions)

    # 回退：匹配对应阶段块中的“角色发展”行
    # 找到该阶段完整块
    # stage_info['stage_name'] 示例：阶段一：世界建立
    stage_heading_pattern = re.compile(
        rf"###\s*{re.escape(stage_info['stage_name'])}\s*(.*?)(?=###\s*阶段|##\s*章节集群设计|$)",
        re.DOTALL
    )
    stage_block_match = stage_heading_pattern.search(architecture)
    if stage_block_match:
        stage_block = stage_block_match.group(1)
        dev_line_match = re.search(r"\*{0,2}角色发展\*{0,2}\s*：\s*([^\n]+)", stage_block)
        if dev_line_match:
            return dev_line_match.group(1).strip()

    return "所有核心角色"

def get_key_tasks_for_chapter(architecture: str, stage_info: dict) -> str:
    """获取本章的关键任务"""
    # 从阶段信息中提取关键任务
    stage_section_pattern = rf"### {stage_info['stage_name'].split('：')[0]}[^#]*?关键任务\s*([^#]*?)(?=属性聚焦|角色发展|###|$)"
    match = re.search(stage_section_pattern, architecture, re.DOTALL)
    
    if match:
        tasks_section = match.group(1)
        tasks = re.findall(r"-\s*任务\d+\s*：\s*([^\n]+)", tasks_section)
        if tasks:
            formatted_tasks = "\n".join([f"- {task.strip()}" for task in tasks])
            return formatted_tasks
    
    return "- 推进主线情节发展\n- 深化角色关系\n- 展示关键属性"

def get_cluster_for_chapter(architecture: str, chapter_number: int) -> dict:
    """获取章节所属的集群信息"""
    clusters_section = re.search(r"## 章节集群设计\s*(.*?)(?=## 情感节奏控制点|$)", architecture, re.DOTALL)
    if not clusters_section:
        return {"cluster_name": "根据大纲自行判断", "emotional_theme": "", "choice_weight": "中"}

    text = clusters_section.group(1)
    # 按集群标题切块：### 集群一：主题
    cluster_block_pattern = re.compile(
        r"###\s*(集群[一二三四五六七八九十]+)：([^\n]+)\s*(.*?)(?=###\s*集群|$)",
        re.DOTALL
    )
    for m in cluster_block_pattern.finditer(text):
        cluster_title = m.group(1).strip()
        cluster_subtitle = m.group(2).strip()
        block = m.group(3)

        # 提取章节范围
        range_match = re.search(r"\*{0,2}章节范围\*{0,2}\s*：\s*第(\d+)-(\d+)章", block)
        if not range_match:
            continue
        start_chap = int(range_match.group(1))
        end_chap = int(range_match.group(2))
        if not (start_chap <= chapter_number <= end_chap):
            continue

        # 情感主题
        emotional_match = re.search(r"\*{0,2}情感主题\*{0,2}\s*：\s*([^\n]+)", block)
        emotional_theme = emotional_match.group(1).strip() if emotional_match else ""

        # 选择权重
        weight_match = re.search(r"\*{0,2}选择权重\*{0,2}\s*：\s*([^\n]+)", block)
        choice_weight = weight_match.group(1).strip() if weight_match else "中"

        return {
            "cluster_name": f"{cluster_title}：{cluster_subtitle}",
            "emotional_theme": emotional_theme,
            "choice_weight": choice_weight
        }

    return {"cluster_name": "根据大纲自行判断", "emotional_theme": "", "choice_weight": "中"}

def build_chapter_prompt(
    chapter_index: int,
    chapter_directory: str, 
    core_seed: str,
    attribute_system: str,
    characters: str, 
    architecture: str,
    previous_chapter_content: str = None,  # 前一章内容（第一章为空）
    global_summary: str = ""  # 累积的全局摘要
) -> str:
    
    # 从架构中提取本章的特定信息
    chapter_specific_info = extract_chapter_from_architecture(architecture, chapter_index)
    
    return f"""
# 任务概述
你正在创作文字冒险游戏的第 {chapter_index} 章。请基于以下设定生成具体章节剧情，特别注意将选择点自然地嵌入到对话和情境中。

# 核心约束（必须严格遵守）

## 本章在叙事架构中的定位
{chapter_specific_info}

## 属性系统规则
{attribute_system}

## 选择点设计规则
- 选择点必须出现在自然的对话或决策情境后
- 每个选择点提供2个选项，体现不同的价值观
- 属性影响值范围：±2到±8点
- 选择后的反应：2-3句话展示立即后果，然后自然回归主线
- 确保无论选择哪个选项，主线情节都能继续推进

# 上下文信息

## 游戏核心设定
{core_seed}

## 主要角色设定
{characters}

## 全局叙事架构
{architecture}

## 全局章节目录
{chapter_directory}

## 前文摘要
{global_summary}

{"## 前一章内容" + previous_chapter_content if previous_chapter_content else "# 这是第一章，无前章内容"}

# 生成要求

## 内容规范
- **叙事视角**：主要使用第二人称（"你"）
- **字数范围**：1000-1500字
- **选择点数量**：1-2个，自然分布在章节中
- **沉浸感**：通过对话场景、动作场景、心里场景和环境描写等增强玩家代入感

## 选择点嵌入规范
选择点必须以下列格式嵌入在剧情中：
这里是前文剧情，引出玩家选择...
→ A. [选项描述] [属性影响：属性名±值]
[选择后的立即反应，2-3句话]
→ B. [选项描述] [属性影响：属性名±值]
[选择后的立即反应，2-3句话]
这里是后面的主线剧情...

要求：
1. 选择点要出现在合适的对话交锋或决策时刻
2. 选项要体现角色性格和处境
3. 选择后的反应要展示立即的后果和角色反应
4. 主线剧情剧情始终是线性的，不会因为玩家选择而影响主线剧情，玩家选择仅会带来后面几句话的即时响应。且必须能够自然过渡到后续主线情节

## 对话设计规范
- 对话要符合角色性格设定
- 通过对话自然引出决策点
- 对话中要体现角色关系和情感变化
- 避免冗长的独白，保持对话的互动性

# 输出格式
请严格按照以下格式输出：
第{chapter_index}章 - [章节标题]

### 剧情内容
[完整的叙事内容，包含嵌入的选择点]

注意：确保选择点自然融入剧情，不要让玩家感觉选项是突兀插入的。且不要打破剧情与玩家的第四面窗，
即主线剧情中不要出现“无论你怎么选择，xxx都会xxx”或跟“玩家选项”有关的话语。
"""

def update_summary_prompt(
    global_summary: str,
    new_chapter: str
) -> str:
    return f"""
# 任务
你是一位资深的文字冒险游戏剧情策划。请根据现有的前文摘要和最新一章的剧情更新摘要。

# 以下是新完成的章节文本：
{new_chapter}

# 以下是前文摘要（为空则说明现在是第一章）：
{global_summary}

# 要求：
- 保留既有重要信息，同时融入新剧情要点。
- 以简洁、连贯的语言描述剧情进展，仅关注剧情发展，忽略文本中给出的选项。
- 客观描绘，不展开联想或解释。
- 总字数控制在1000字以内。

仅返回更新后的前文摘要文本，不要解释任何内容。
"""

def build_cover_image_prompt_prompt(core_seed: str) -> str:
    """AI辅助构建生成作品封面的prompt
    """
    return f"""
# 角色
你是一位经验丰富的AI绘画提示词（Prompt）工程师，专精于将小说设定转化为高质量、高表现力、完整、全面的图像生成Prompt。

# 任务
你将收到一段小说（文字冒险游戏）的核心设定。你的任务是分析这段设定，并生成一个结构完整、细节丰富的图像生成Prompt，用于绘制这本小说的封面。

# 核心设定
{core_seed}

---

# Prompt生成指南

请严格按照以下结构，生成一个完整的、可以直接用于AI绘画工具的Prompt。你需要根据【核心设定】的内容，进行合理的推断和艺术化加工，填充到各个模块中。

## 1. 核心主题与氛围
- **一句话总结**：用一句话概括画面的核心主题和要传达的情绪。
- **关键词**：列出3-5个最能代表故事氛围的关键词（例如：史诗、神秘、浪漫、赛博朋克、复古、恐怖、希望）。

## 2. 画面主体与构图
- **主体**：明确画面的中心是谁或什么。描述主角/核心元素的外观、姿态、表情。
- **构图**：选择一个合适的构图方式（例如：中心构图、黄金分割、特写、远景），并描述视角（例如：仰视、俯视、平视）。

## 3. 环境与背景
- **场景**：描述主角所处的具体环境，包括建筑、自然景观等。
- **关键元素**：列出背景中必须出现的、与故事紧密相关的物品或符号（例如：一把剑、一朵奇特的花、一座漂浮的城堡）。

## 4. 艺术风格与媒介
- **风格**：选择一种最匹配的艺术风格（例如：日系动漫风、写实主义、水彩、油画、像素艺术、暗黑艺术）。
- **参考**：可以提及1-2位艺术家或风格作为参考（例如：风格类似宫崎骏，或类似《赛博朋克2077》的美术风格）。

## 5. 色彩与光影
- **色彩方案**：描述主色调和点缀色，以及它们如何营造氛围（例如：以冷色调为主，用暖色高光点缀）。
- **光影效果**：描述光线的来源和质感（例如：柔和的晨光、戏剧性的伦勃朗光、霓虹灯的冷光）。

## 6. 技术与质量词
- **技术参数**：添加通用的提升画质的关键词（例如：杰作, 最佳质量, 8k, 超精细细节, 复杂细节, 电影光效）。
- **画面比例**：默认使用 16:9。

# 最终输出要求
- 将以上所有模块的内容，整合成一段连贯、流畅的Prompt文本。
- 不要包含任何解释性文字，只输出最终的Prompt。
- 确保Prompt逻辑清晰，重点突出。
"""

def build_scene_image_prompt_prompt(chapter_content: str) -> str:
    """AI辅助构建生成场景画面的prompt
    """
    return f"""
# 角色
你是一位经验丰富的AI绘画提示词（Prompt）工程师，专精于将小说剧情转化为高质量、高表现力、完整、全面的图像生成Prompt。

# 任务
你将收到一段小说（文字冒险游戏）剧情的某一章节内容。你的任务是分析这段内容，将其按顺序合理切分为一个或多个画面单元（最少一个，最多三个），
并生成一个结构完整、细节丰富的图像生成Prompt，用于绘制场景背景图片。

# 章节剧情
{chapter_content}

# prompt生成指南
请严格按照以下结构，为每个画面单元生成一个完整的、可以直接用于AI绘画工具的Prompt。你需要根据【章节剧情】的内容，进行合理的推断和艺术化加工，填充到各个模块中。

## 画面1：

### 范围：[结束百分比]

### 核心主题与氛围
- **一句话总结**：用一句话概括画面的核心主题和要传达的情绪。
- **关键词**：列出3-5个最能代表故事氛围的关键词（例如：史诗、神秘、浪漫、赛博朋克、复古、恐怖、希望）。

### 画面主体与构图
- **主体**：明确画面的中心是谁或什么。描述主角/核心元素的外观、姿态、表情。
- **构图**：选择一个合适的构图方式（例如：中心构图、黄金分割、特写、远景），并描述视角（例如：仰视、俯视、平视）。

### 环境与背景
- **场景**：描述主角所处的具体环境，包括建筑、自然景观等。
- **关键元素**：列出背景中必须出现的、与故事紧密相关的物品或符号（例如：一把剑、一朵奇特的花、一座漂浮的城堡）。

### 艺术风格与媒介
- **风格**：选择一种最匹配的艺术风格（例如：日系动漫风、写实主义、水彩、油画、像素艺术、暗黑艺术）。
- **参考**：可以提及1-2位艺术家或风格作为参考（例如：风格类似宫崎骏，或类似《赛博朋克2077》的美术风格）。

### 色彩与光影
- **色彩方案**：描述主色调和点缀色，以及它们如何营造氛围（例如：以冷色调为主，用暖色高光点缀）。
- **光影效果**：描述光线的来源和质感（例如：柔和的晨光、戏剧性的伦勃朗光、霓虹灯的冷光）。

### 技术与质量词
- **技术参数**：添加通用的提升画质的关键词（例如：杰作, 最佳质量, 8k, 超精细细节, 复杂细节, 电影光效）。
- **画面比例**：默认使用 16:9。

## 画面2：

### 范围：[结束百分比]
（结构同上）

如果还有画面请继续...

# 特别注意
- 范围指的是百分数占比（但不带百分号），例如画面1范围是70即代表从开头持续到本章剧情字数的70%，画面2范围是100即代表从本章内容的70%持续到100%
- 最后一个画面的范围必须是100。
- 每个画面都要保持连贯性和逻辑顺序。
- 根据剧情的场景变化合理划分画面单元。
- 画面单元最少为 1 个，最多为 3 个。
- 忽略剧情文本中的选项相关信息（如果存在的话）。
- 确保每个Prompt都能独立生成高质量的背景图像。
- 直接按要求返回有效格式，不要任何解释。
"""
