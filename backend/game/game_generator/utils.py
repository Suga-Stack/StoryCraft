def calculate_structure(total_chapters: int, tags: list[str] = None):
    """计算故事结构，考虑章节数和故事类型"""
    
    # 分析故事类型倾向
    has_conflict = any(tag in ["悬疑", "惊悚", "权谋", "争霸", "热血", "灵异", "军事"] for tag in (tags or []))
    is_relationship = any(tag in ["言情", "甜宠", "耽美", "百合", "校园", "青春", "日常"] for tag in (tags or []))
    is_adventure = any(tag in ["玄幻", "奇幻", "仙侠", "武侠", "科幻", "冒险", "无限流"] for tag in (tags or []))
    
    # 根据章节数量决定阶段数量
    if total_chapters <= 3:
        # 超短篇
        return {
            "stage1": (1, 1, "快速引入", "极速建立世界观和核心吸引力", "紧急"),
            "stage2": (2, total_chapters-1, "核心发展", "快速推进剧情和情感建立", "紧张"),
            "stage3": (total_chapters, total_chapters, "高潮结局", "情感爆发和多结局展开", "爆发")
        }
    
    elif total_chapters <= 6:
        # 短篇：需要紧凑但完整
        if has_conflict:
            # 冲突型故事：引入-冲突-解决
            conflict_point = max(2, total_chapters // 2)
            return {
                "stage1": (1, 2, "引入与建立", "建立世界观、主角和核心冲突", "建立"),
                "stage2": (3, conflict_point, "冲突升级", "矛盾激化，角色面临挑战", "紧张"),
                "stage3": (conflict_point+1, total_chapters-1, "解决之路", "寻找解决方案，角色成长", "发展"),
                "stage4": (total_chapters, total_chapters, "最终结局", "解决冲突，多结局展开", "爆发")
            }
        elif is_relationship:
            # 关系型故事：相遇-发展-危机-结局
            mid = total_chapters // 2
            return {
                "stage1": (1, 2, "相遇与初识", "角色相遇，建立初步关系", "轻松"),
                "stage2": (3, mid, "关系发展", "关系深入，情感加深", "温馨"),
                "stage3": (mid+1, total_chapters-1, "关系危机", "面临挑战，考验关系", "紧张"),
                "stage4": (total_chapters, total_chapters, "关系结局", "关系走向确定，多结局", "情感")
            }
        else:
            # 通用短篇结构
            return {
                "stage1": (1, 2, "引入阶段", "建立世界观和主角处境", "建立"),
                "stage2": (3, total_chapters-2, "探索发展", "推进剧情，角色成长", "发展"),
                "stage3": (total_chapters-1, total_chapters, "高潮结局", "情感高潮和多结局", "爆发")
            }
    
    elif total_chapters <= 10:
        # 中篇：有空间发展多层次
        quarter = total_chapters // 4
        half = total_chapters // 2
        three_quarters = quarter * 3
        
        if is_relationship:
            # 关系型中篇：完整的情感弧线
            return {
                "stage1": (1, 2, "相遇建立", "角色相遇，建立初步关系", "轻松期待"),
                "stage2": (3, half, "关系发展", "关系深入，共同经历成长", "温馨成长"),
                "stage3": (half+1, three_quarters, "关系挑战", "面临内外挑战，关系波动", "紧张矛盾"),
                "stage4": (three_quarters+1, total_chapters-2, "关系抉择", "面对关键抉择，情感深化", "深刻反思"),
                "stage5": (total_chapters-1, total_chapters, "关系结局", "关系最终走向，多结局", "情感升华")
            }
        elif is_adventure:
            # 冒险型中篇：完整的冒险旅程
            return {
                "stage1": (1, 2, "启程准备", "接受使命，准备冒险", "期待冒险"),
                "stage2": (3, half, "冒险探索", "面对挑战，探索世界", "紧张探索"),
                "stage3": (half+1, three_quarters, "危机转折", "遭遇重大危机或转折", "紧张危机"),
                "stage4": (three_quarters+1, total_chapters-2, "决战准备", "为最终决战做准备", "紧张准备"),
                "stage5": (total_chapters-1, total_chapters, "最终决战", "最终对决和多结局", "激烈爆发")
            }
        else:
            # 通用中篇结构
            return {
                "stage1": (1, 2, "建立阶段", "建立世界观、角色和核心驱动力", "建立期待"),
                "stage2": (3, half, "发展阶段", "推进主要情节，角色成长", "发展探索"),
                "stage3": (half+1, three_quarters, "深化阶段", "深化矛盾，提升情感强度", "紧张深化"),
                "stage4": (three_quarters+1, total_chapters-2, "高潮准备", "为高潮结局做铺垫", "紧张准备"),
                "stage5": (total_chapters-1, total_chapters, "高潮结局", "情感高潮和多结局展开", "爆发释放")
            }
    
    else:
        # 长篇（11-15章）：有更丰富的层次
        intro_len = max(2, total_chapters // 6)  # 引入部分
        build_len = total_chapters // 4          # 建设部分
        develop_len = total_chapters // 3        # 发展部分
        crisis_len = total_chapters // 4         # 危机部分
        climax_len = total_chapters - (intro_len + build_len + develop_len + crisis_len)
        
        # 计算各阶段范围
        s1_end = intro_len
        s2_end = s1_end + build_len
        s3_end = s2_end + develop_len
        s4_end = s3_end + crisis_len
        
        if has_conflict and is_relationship:
            # 混合型长篇：既有冲突又有关系发展
            return {
                "stage1": (1, s1_end, "世界与关系建立", "建立世界观和基础人物关系", "探索建立"),
                "stage2": (s1_end+1, s2_end, "冲突与关系发展", "矛盾初现，关系深入发展", "发展交织"),
                "stage3": (s2_end+1, s3_end, "危机深化", "多重危机出现，关系面临考验", "紧张复杂"),
                "stage4": (s3_end+1, s4_end, "抉择时刻", "重大抉择，决定各方命运", "深刻抉择"),
                "stage5": (s4_end+1, total_chapters-2, "最终准备", "为最终对决做准备", "紧张期待"),
                "stage6": (total_chapters-1, total_chapters, "最终结局", "解决所有矛盾，多结局展开", "爆发释放")
            }
        elif is_relationship:
            # 纯关系型长篇：细腻的情感发展
            return {
                "stage1": (1, s1_end, "初识建立", "角色相遇，建立初步情感连接", "轻松好奇"),
                "stage2": (s1_end+1, s2_end, "关系深化", "共同经历，情感逐渐加深", "温馨成长"),
                "stage3": (s2_end+1, s3_end, "关系挑战", "面临内外挑战，关系波动", "紧张矛盾"),
                "stage4": (s3_end+1, s4_end, "关系危机", "重大危机，考验关系本质", "深刻危机"),
                "stage5": (s4_end+1, total_chapters-2, "关系抉择", "面对关键抉择，决定关系走向", "深刻反思"),
                "stage6": (total_chapters-1, total_chapters, "关系结局", "情感最终走向，多结局", "情感升华")
            }
        else:
            # 通用长篇结构
            return {
                "stage1": (1, s1_end, "世界引入", "深度建立世界观和基础设定", "探索建立"),
                "stage2": (s1_end+1, s2_end, "挑战成长", "面对系列挑战，角色成长", "发展成长"),
                "stage3": (s2_end+1, s3_end, "关系深化", "深化角色关系，增加复杂性", "复杂深化"),
                "stage4": (s3_end+1, s4_end, "危机累积", "多重危机出现，紧张感累积", "紧张危机"),
                "stage5": (s4_end+1, total_chapters-2, "高潮准备", "为最终高潮做好全面准备", "紧张期待"),
                "stage6": (total_chapters-1, total_chapters, "最终结局", "情感高潮和多结局展开", "爆发释放")
            }