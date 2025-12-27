# StoryCraft 单元测试文档

**时间:** 2025.12
**总览:** 5个主要测试模块，154个测试用例

---

## 目录

1. [用户认证与管理测试](#用户认证与管理测试)
2. [游戏作品测试](#游戏作品测试)
3. [游戏生成与视图测试](#游戏生成与视图测试)
4. [交互功能测试](#交互功能测试)
5. [标签管理测试](#标签管理测试)

---

## 用户认证与管理测试

**File:** `users/test_users.py`

**Test Count:** 49个测试用例

### SendEmailCodeViewTests

#### `test_send_email_code`
**功能:** 测试发送邮箱验证码成功场景
- 向指定邮箱发送验证码
- 返回 HTTP 200 成功
- 响应消息包含"验证码已发送"

#### `test_send_email_code_without_email`
**功能:** 测试发送验证码时邮箱缺失的错误处理
- 不提供邮箱时返回 HTTP 400
- 错误消息为"邮箱不能为空"

---

### RegisterViewTests

#### `test_register_success`
**功能:** 测试用户注册成功流程
- 创建新用户账户
- 验证密码和确认密码匹配
- 检查邮箱验证码有效性
- 返回 HTTP 201 CREATED
- 响应包含"注册成功"消息

#### `test_register_password_mismatch`
**功能:** 测试密码不匹配的注册错误
- 两次输入密码不一致
- 返回 HTTP 400
- 错误消息为"两次输入的密码不一致"

---

### UserViewSetTestCase (10个测试用例)

#### `test_retrieve_user_as_admin`
**功能:** 测试管理员查看任何用户信息
- 管理员权限验证
- 获取其他用户的详细信息
- 返回 HTTP 200 成功
- 检查返回的用户名正确

#### `test_retrieve_user_as_normal_user`
**功能:** 测试普通用户只能查看自己的信息
- 用户能查看自己的信息
- 用户不能查看其他用户信息（返回 404）
- 隐私保护有效

#### `test_delete_self_success`
**功能:** 测试用户删除自己账户
- 用户删除自己的账户
- 返回 HTTP 204 NO CONTENT
- 数据库中账户被删除

#### `test_delete_other_user_forbidden`
**功能:** 测试普通用户不能删除他人账户
- 尝试删除其他用户账户
- 返回 HTTP 404 NOT FOUND
- 无权限访问

#### `test_delete_user_as_admin`
**功能:** 测试管理员可以删除任何用户
- 管理员删除其他用户账户
- 返回 HTTP 204 成功
- 数据库中账户被删除

#### `test_list_users_as_admin`
**功能:** 测试管理员可以列出所有用户
- 获取所有用户列表
- 返回 HTTP 200
- 列表长度等于数据库中的用户数

#### `test_list_users_as_normal_user`
**功能:** 测试普通用户只能看到自己的数据
- 获取用户列表
- 只返回当前登录用户
- 列表长度为 1

#### `test_partial_update_self_success`
**功能:** 测试用户更新自己的信息
- 修改用户名等字段
- 返回 HTTP 200
- 数据库中的信息被更新

#### `test_partial_update_other_user_forbidden`
**功能:** 测试用户不能修改他人信息
- 尝试修改其他用户信息
- 返回 HTTP 404 NOT FOUND
- 权限控制有效

#### `test_partial_update_as_admin_success`
**功能:** 测试管理员可以修改任何用户信息
- 管理员修改其他用户信息
- 返回 HTTP 200
- 修改成功

---

### LoginViewTestCase (2个测试用例)

#### `test_login_success`
**功能:** 测试成功登录
- 使用正确的用户名和密码
- 返回 HTTP 200
- 响应包含 access token 和 refresh token

#### `test_login_invalid_credentials`
**功能:** 测试使用错误凭证登录
- 使用错误的密码
- 返回 HTTP 400 BAD REQUEST
- 登录被拒绝

---

### ReadGameworkListViewTestCase (7个测试用例)

#### `test_get_read_gameworks_success`
**功能:** 测试获取用户已阅读的作品列表
- 验证列出用户的阅读记录
- 返回 HTTP 200
- 列表包含正确的作品

#### `test_post_read_gamework_success`
**功能:** 测试记录新的阅读作品
- 添加新的阅读记录
- 返回 HTTP 200
- 数据库中创建了新记录

#### `test_post_read_gamework_insufficient_credits`
**功能:** 测试积分不足时的阅读限制
- 用户积分不足
- 尝试阅读付费作品
- 返回 HTTP 400
- 错误消息为"积分不足，无法阅读该作品"

#### `test_post_read_gamework_not_found`
**功能:** 测试阅读不存在的作品
- 使用无效的作品 ID
- 返回 HTTP 400
- 错误消息为"作品不存在"

#### `test_post_read_gamework_no_gamework_id`
**功能:** 测试缺少作品 ID 的阅读请求
- 不提供 gamework_id
- 返回 HTTP 400
- 错误消息为"gamework_id 不能为空"

#### `test_delete_read_gameworks_success`
**功能:** 测试隐藏特定的阅读记录
- 删除指定的阅读记录
- 返回 HTTP 200
- 记录被标记为不可见

#### `test_delete_all_read_gameworks_success`
**功能:** 测试隐藏所有阅读记录
- 删除所有阅读记录
- 返回 HTTP 200
- 所有记录被标记为不可见

---

### UserSignInViewTestCase (4个测试用例)

#### `test_get_signin_dates_success`
**功能:** 测试获取用户签到日期列表
- 检索签到历史
- 返回 HTTP 200
- 列表包含所有签到日期

#### `test_post_signin_success`
**功能:** 测试成功签到
- 用户签到
- 返回 HTTP 200
- 连续签到天数为 1
- 获得奖励

#### `test_post_signin_already_signed_in`
**功能:** 测试已签到用户重复签到
- 用户已在今天签到
- 再次尝试签到
- 返回消息"今日已签到"
- 奖励为 0

#### `test_post_signin_continuous_days`
**功能:** 测试连续签到天数计算
- 模拟连续多天签到
- 连续天数正确递增
- 签到成功

---

### RechargeViewSetTestCase (5个测试用例)

#### `test_recharge_success`
**功能:** 测试成功充值积分
- 充值 50 积分
- 返回 HTTP 200
- 积分正确增加
- 新积分 = 旧积分 + 充值积分

#### `test_recharge_invalid_credits_type`
**功能:** 测试充值时积分类型无效
- 提交字符串而非整数
- 返回 HTTP 400
- 错误消息为"credits 必须为整数"

#### `test_recharge_negative_credits`
**功能:** 测试充值负数积分
- 提交负数积分
- 返回 HTTP 400
- 错误消息为"充值积分必须大于 0"

#### `test_recharge_zero_credits`
**功能:** 测试充值零积分
- 提交 0 积分
- 返回 HTTP 400
- 错误消息为"充值积分必须大于 0"

#### `test_recharge_unauthenticated`
**功能:** 测试未认证用户充值
- 未认证状态下充值
- 返回 HTTP 401 UNAUTHORIZED
- 错误消息为"Authentication credentials were not provided."

---

### RewardViewSetTests (2个测试用例)

#### `test_reward_success`
**功能:** 测试成功打赏作者
- 用户向作者打赏
- 返回 HTTP 200
- 用户积分减少
- 作者积分增加

#### `test_reward_insufficient_credits`
**功能:** 测试积分不足时的打赏限制
- 用户积分不足
- 尝试打赏
- 返回 HTTP 400
- 错误消息为"积分不足，无法打赏"

---

### GameworkReportViewSetTests (6个测试用例)

#### `test_list_reports_as_user`
**功能:** 测试普通用户只看到自己的举报
- 普通用户列出举报
- 只返回用户自己的举报
- 返回 HTTP 200

#### `test_list_reports_as_admin`
**功能:** 测试管理员看到所有举报
- 管理员列出举报
- 返回所有举报
- 返回 HTTP 200

#### `test_create_report_success`
**功能:** 测试成功创建作品举报
- 创建新举报
- 返回 HTTP 201 CREATED
- 数据库中创建了记录

#### `test_create_report_invalid_gamework`
**功能:** 测试对不存在的作品进行举报
- 使用无效的作品 ID
- 返回 HTTP 400
- 错误处理正确

#### `test_retrieve_report_as_user`
**功能:** 测试用户查看自己的举报
- 获取举报详情
- 返回 HTTP 200
- 举报信息正确

#### `test_retrieve_report_as_admin`
**功能:** 测试管理员查看任何举报
- 管理员获取举报详情
- 返回 HTTP 200
- 信息正确

---

### CreditLogViewSetTests (1个测试用例)

#### `test_list_credit_logs_success`
**功能:** 测试用户查看自己的积分日志
- 获取用户的积分变化记录
- 返回 HTTP 200
- 包含所有日志

---

### CommentReportViewSetTests (8个测试用例)

#### `test_list_comment_reports_as_user`
**功能:** 测试普通用户只看到自己的评论举报
- 用户列出举报
- 只返回用户的举报
- 返回 HTTP 200

#### `test_list_comment_reports_as_admin`
**功能:** 测试管理员看到所有评论举报
- 管理员列出举报
- 返回所有举报
- 返回 HTTP 200

#### `test_create_comment_report_success`
**功能:** 测试成功创建评论举报
- 创建新的评论举报
- 返回 HTTP 201 CREATED
- 数据库中创建了记录

#### `test_create_comment_report_invalid`
**功能:** 测试使用无效数据创建评论举报
- 缺少必需字段
- 返回 HTTP 400
- 错误处理正确

#### `test_retrieve_comment_report_as_user`
**功能:** 测试用户查看自己的评论举报
- 获取举报详情
- 返回 HTTP 200
- 举报信息正确

#### `test_retrieve_comment_report_as_admin`
**功能:** 测试管理员查看任何评论举报
- 管理员获取举报详情
- 返回 HTTP 200
- 信息正确

#### `test_destroy_comment_report_as_admin`
**功能:** 测试管理员删除评论举报
- 管理员删除举报
- 返回 HTTP 204 NO CONTENT
- 数据库中举报被删除

#### `test_destroy_comment_report_as_user`
**功能:** 测试普通用户不能删除评论举报
- 用户尝试删除举报
- 返回 HTTP 403 FORBIDDEN
- 举报仍然存在

---

## 游戏作品测试

**File:** `gameworks/test_gameworks.py`

**Test Count:** 27个测试用例

### GameworkViewSetTestCase (5个测试用例)

#### `test_retrieve_published_gamework_success`
**功能:** 测试成功获取已发布的作品
- 获取已发布作品详情
- 返回 HTTP 200
- 状态为 'ready'
- 作品信息完整

#### `test_retrieve_unpublished_gamework_as_author`
**功能:** 测试作者可以查看自己未发布的作品
- 作者查看未发布作品
- 返回 HTTP 200
- 状态为 'generating'

#### `test_retrieve_unpublished_gamework_as_other_user`
**功能:** 测试其他用户不能查看未发布的作品
- 非作者查看未发布作品
- 返回 HTTP 404 NOT FOUND
- 权限控制有效

#### `test_retrieve_other_user_published_gamework`
**功能:** 测试任何人可以查看已发布的作品
- 其他用户查看已发布作品
- 返回 HTTP 200
- 作品信息正确

#### `test_retrieve_nonexistent_gamework`
**功能:** 测试获取不存在的作品
- 使用无效的作品 ID
- 返回 HTTP 404 NOT FOUND

---

### PublishGameworkViewSetTestCase (9个测试用例)

#### `test_publish_gamework_success`
**功能:** 测试作者成功发布作品
- 作者发布作品
- 返回 HTTP 200
- 作品状态改为已发布
- 价格设置正确

#### `test_publish_gamework_invalid_price`
**功能:** 测试价格类型无效的发布
- 提交非整数价格
- 返回 HTTP 400
- 错误消息为"price 必须是整数"

#### `test_publish_gamework_price_out_of_range`
**功能:** 测试价格超出范围的发布
- 提交超出范围的价格 (>50)
- 返回 HTTP 400
- 错误消息为"price 必须在 0 ~ 50 之间"

#### `test_publish_gamework_not_author`
**功能:** 测试非作者不能发布他人作品
- 非作者尝试发布作品
- 返回 HTTP 403 FORBIDDEN
- 错误消息为"您没有权限发布该作品"

#### `test_publish_gamework_as_admin`
**功能:** 测试管理员可以发布任何作品
- 管理员发布他人作品
- 返回 HTTP 200
- 作品成功发布

#### `test_publish_gamework_not_found`
**功能:** 测试发布不存在的作品
- 使用无效的作品 ID
- 返回 HTTP 404 NOT FOUND
- 错误消息为"作品未找到"

#### `test_unpublish_gamework_success`
**功能:** 测试作者成功取消发布作品
- 作者取消发布
- 返回 HTTP 200
- 作品状态改为未发布

#### `test_unpublish_gamework_not_author`
**功能:** 测试非作者不能取消发布他人作品
- 非作者尝试取消发布
- 返回 HTTP 403 FORBIDDEN
- 错误消息为"您没有权限取消发布该作品"

#### `test_unpublish_gamework_as_admin`
**功能:** 测试管理员可以取消发布任何作品
- 管理员取消发布
- 返回 HTTP 200

---

### GameworkFavoriteLeaderboardViewSetTestCase (1个测试用例)

#### `test_favorite_leaderboard`
**功能:** 测试获取收藏数排行榜
- 获取排行榜数据
- 返回 HTTP 200
- 按收藏数排序正确

---

### GameworkRatingLeaderboardViewSetTestCase (1个测试用例)

#### `test_rating_leaderboard`
**功能:** 测试获取评分排行榜
- 获取排行榜数据
- 返回 HTTP 200
- 按平均评分排序正确

---

### GameworkHotLeaderboardViewSetTestCase (3个测试用例)

#### `test_hot_leaderboard_total`
**功能:** 测试获取全部时间热度排行榜
- 获取 range=total 的排行榜
- 返回 HTTP 200
- 按热度值排序

#### `test_hot_leaderboard_month`
**功能:** 测试获取月度热度排行榜
- 获取 range=month 的排行榜
- 返回 HTTP 200
- 排序正确

#### `test_hot_leaderboard_invalid_range`
**功能:** 测试无效的排行榜范围参数
- 提交无效的 range 值
- 返回 HTTP 400
- 错误消息列出可选值

---

### GameworkSearchViewTestCase (5个测试用例)

#### `test_search_by_title`
**功能:** 测试按标题搜索作品
- 搜索特定标题的作品
- 返回 HTTP 200
- 搜索结果正确

#### `test_search_by_author`
**功能:** 测试按作者搜索作品
- 搜索特定作者的作品
- 返回 HTTP 200
- 返回该作者的所有作品

#### `test_search_by_tag`
**功能:** 测试按标签搜索作品
- 搜索特定标签的作品
- 返回 HTTP 200
- 返回带有该标签的作品

#### `test_search_no_results`
**功能:** 测试搜索无结果的情况
- 搜索不存在的内容
- 返回 HTTP 200（空结果）
- 结果为空列表

#### `test_search_multiple_filters`
**功能:** 测试多个筛选条件搜索
- 同时按标题、作者、标签搜索
- 返回 HTTP 200
- 结果满足所有条件

---

### RecommendViewTestCase (3个测试用例)

#### `test_recommendations_success`
**功能:** 测试基于喜欢标签的推荐
- 根据用户喜欢的标签生成推荐
- 返回 HTTP 200
- 推荐结果相关

#### `test_recommendations_no_liked_tags`
**功能:** 测试没有喜欢标签时的推荐
- 用户没有设置喜欢的标签
- 返回 HTTP 404
- 错误提示正确

#### `test_recommendations_exclude_user_created`
**功能:** 测试推荐排除用户自己创建的作品
- 获取推荐作品
- 不包含用户自己创建的作品
- 返回 HTTP 200

---

## 游戏生成与视图测试

### TestGeneratorParsing (8个测试用例)

**File:** `game/tests/test_generator_parsing.py`

#### `test_parse_creative_directions`
**功能:** 测试创意方向解析功能
- 解析包含多个【创意方向】标记的文本
- 检查单一内容的处理
- 确保提取的方向内容正确

#### `test_extract_section`
**功能:** 测试章节内容提取功能
- 从复杂文本中提取指定标题的内容
- 测试不存在的章节标题（返回空字符串）
- 确保精确定位和提取

#### `test_parse_title_description`
**功能:** 测试标题和描述解析功能
- 从"创意信息"章节中提取标题
- 从"创意信息"章节中提取描述
- 检查关键字段的正确识别

#### `test_parse_attributes`
**功能:** 测试属性系统解析功能
- 从文本中提取多个属性名称
- 正确提取每个属性的初始值
- 确保属性数据存储为字典格式

#### `test_parse_endings`
**功能:** 测试多结局解析功能
- 识别多个结局块（结局1、结局2等）
- 提取每个结局的标题、触发条件和核心剧情
- 确保结局数据结构正确

#### `test_extract_chapter_block`
**功能:** 测试章节内容块提取功能
- 根据章节号提取对应章节的完整内容
- 正确识别章节标题
- 测试提取不存在章节时的错误处理

#### `test_parse_report`
**功能:** 测试游戏报告解析功能
- 提取游戏结束时的称号（[称号]）
- 提取游戏评价内容（[评价]）
- 解析特质列表并转换为数组格式

#### `test_extract_scenes_prompt`
**功能:** 测试场景提示词和范围提取功能
- 提取多个场景的范围值（如[50]、100）
- 提取每个场景对应的Prompt文本
- 支持多种范围标记格式
- 确保范围值和Prompt正确对应

---

### TestGeneratorParsing (5个测试用例)

**File:** `game/tests/test_generator.py`

#### `test_parse_outlines_short_format`
**功能:** 测试短篇格式大纲解析
- 解析包含多个章节的短篇格式
- 验证提取的章节数量和内容
- 检查标题和大纲信息

#### `test_parse_outlines_long_format`
**功能:** 测试长篇格式大纲解析
- 解析长篇格式的大纲文本
- 验证章节数量正确
- 检查详细大纲内容

#### `test_calculate_attributes`
**功能:** 测试属性范围计算
- 根据玩家选择计算属性范围
- 验证最小值和最大值
- 支持多个属性的计算

#### `test_calculate_attributes_no_initial`
**功能:** 测试无初始属性的情况
- 在没有初始属性值的情况下计算范围
- 验证属性范围的正确性
- 处理边界情况

#### `test_parse_ending_condition`
**功能:** 测试结局条件解析
- 解析"较高"、"较低"、"中等"等条件
- 根据属性范围计算具体阈值
- 支持复杂条件的解析

---

### TestOpenAIClient (5个测试用例)

**File:** `game/tests/test_openai_client.py`

#### `test_invoke_success`
**功能:** 测试 OpenAI 文本生成成功场景
- Mock OpenAI 文本客户端的成功响应
- 验证正确调用 `invoke()` 方法
- 确保能够正确解析和返回 AI 的文本响应

#### `test_invoke_failure`
**功能:** 测试 OpenAI 文本生成失败场景
- Mock OpenAI API 抛出异常
- 验证错误处理机制是否正常工作
- 确保异常被捕获并返回空字符串

#### `test_generate_single_image_success`
**功能:** 测试单张图片生成成功场景
- Mock 图像生成 API 的成功响应
- 验证能否调用 `generate_single_image()` 方法
- 测试图片 URL 是否被正确保存到本地

#### `test_generate_single_image_failure`
**功能:** 测试单张图片生成失败场景
- Mock 图像生成 API 抛出异常
- 验证失败时是否返回占位符图片路径
- 测试降级方案：返回 `placeholders/cover.jpg`

#### `test_generate_multi_images`
**功能:** 测试批量图片生成功能
- 验证能否批量生成多张图片
- 测试多个 prompt 的处理能力
- 验证返回的图片 URL 数量正确

---

### TestServicesExtended (6个测试用例)

**File:** `game/tests/test_services_extended.py`

#### `test_select_background_music`
**功能:** 测试背景音乐选择功能
- 根据指定的标签筛选音乐
- 验证标签匹配逻辑
- 测试填充逻辑：数量不足时用随机音乐补充

#### `test_resolve_total_chapters`
**功能:** 测试章节数量解析功能
- 根据长度类型返回合理的章节数范围
- short（短篇）: 3-5 章
- medium（中篇）: 6-10 章
- long（长篇）: 11-15 章

#### `test_resolve_scene_cover_url`
**功能:** 测试场景封面 URL 解析功能
- 获取场景的背景图 URL
- 测试成功场景：返回有效的媒体文件路径
- 测试失败场景：查询不存在的章节或场景时返回 None

#### `test_get_chapter_status_logic`
**功能:** 测试章节状态获取功能
- Case 1 - ready（已就绪）：返回 "ready"
- Case 2 - generating（生成中）：返回 "generating"
- Case 3 - pending（待生成）：返回 "pending"

#### `test_generate_and_save_report`
**功能:** 测试游戏报告生成和保存功能
- Mock 报告生成函数
- 验证为结局对象创建关联的报告记录
- 测试数据保存的正确性

#### `test_get_ending_report_scores`
**功能:** 测试结局报告得分计算功能
- 根据属性值计算得分
- 验证得分映射的准确性
- 公式：(属性值 / 属性范围) × 100

---

### TestUtils (5个测试用例)

**File:** `game/tests/test_utils.py`

#### `test_parse_attr_deltas`
**功能:** 测试属性变化解析
- 从文本中提取属性变化值
- 支持正负数解析
- 确保解析精度

#### `test_split_sentences_quotes`
**功能:** 测试分句：包含引号的情况
- 分割包含引号的句子
- 正确处理引号内的句号
- 维护句子的完整性

#### `test_iter_choice_groups`
**功能:** 测试选项组识别
- 识别不同选项组
- 正确划分选项边界
- 处理嵌套选项

#### `test_parse_raw_chapter`
**功能:** 测试完整章节解析
- 解析完整的章节数据
- 提取场景、对话等子组件
- 验证数据结构完整性

#### `test_update_story_directory`
**功能:** 测试大纲更新
- 更新故事大纲信息
- 保持数据一致性
- 验证更新成功

---

### TestServicesIntegration (2个测试用例)

**File:** `game/tests/test_integration.py`

#### `test_generate_chapter_flow`
**功能:** 集成测试：生成章节流程
- 测试完整的章节生成工作流
- 验证各个步骤的协作
- 确保最终结果正确

#### `test_create_gamework`
**功能:** 集成测试：创建作品流程
- 测试完整的作品创建工作流
- 验证初始化逻辑
- 确保数据持久化

---

### GameViewsTestCase (20个测试用例)

**File:** `game/tests/test_views.py`

#### `test_user_image_upload_view_success`
**功能:** 测试成功上传图片
- 用户上传图片文件
- 返回 HTTP 201 CREATED
- 响应包含正确的图片 URL

#### `test_user_image_upload_view_no_file`
**功能:** 测试上传时未提供文件
- 未提供文件的上传请求
- 返回 HTTP 400 BAD REQUEST

#### `test_game_create_view_success`
**功能:** 测试成功创建游戏
- 创建新游戏作品
- 返回 HTTP 201 CREATED
- 响应包含游戏 ID

#### `test_game_create_view_invalid_data`
**功能:** 测试使用无效数据创建游戏
- 缺失必需字段
- 返回 HTTP 400 BAD REQUEST

#### `test_get_chapter_status_success`
**功能:** 测试成功获取章节状态
- 获取已生成章节的状态
- 返回 HTTP 200
- 状态为 'ready'

#### `test_get_chapter_status_not_found`
**功能:** 测试获取不存在的章节状态
- 查询无效的作品 ID
- 返回 HTTP 404 NOT FOUND

#### `test_update_chapter_manual_success`
**功能:** 测试手动更新章节成功
- 用户手动编辑章节内容
- 返回 HTTP 200
- 数据库中内容被更新

#### `test_update_chapter_manual_forbidden`
**功能:** 测试用户不能更新他人章节
- 用户尝试更新他人的章节
- 返回 HTTP 403 FORBIDDEN

#### `test_chapter_generate_view_success`
**功能:** 测试成功启动章节生成
- 启动单个章节的生成任务
- 返回 HTTP 200
- 返回 `{"ok": True}`

#### `test_chapter_generate_view_forbidden`
**功能:** 测试用户不能触发他人作品的生成
- 用户尝试触发他人作品的生成
- 返回 HTTP 403 FORBIDDEN

#### `test_game_save_put_create`
**功能:** 测试创建新的游戏存档
- 创建新存档
- 返回 HTTP 200
- 数据库中创建了存档记录

#### `test_game_save_get_success`
**功能:** 测试获取现有存档
- 检索已保存的存档
- 返回 HTTP 200
- 存档信息正确

#### `test_game_save_get_not_found`
**功能:** 测试获取不存在的存档
- 查询无效的存档位置
- 返回 HTTP 404 NOT FOUND

#### `test_game_save_delete_success`
**功能:** 测试删除存档
- 删除已保存的存档
- 返回 HTTP 200
- 数据库中存档被删除

#### `test_game_save_list_view`
**功能:** 测试列出所有存档
- 获取某个作品的所有存档
- 返回 HTTP 200
- 存档列表正确

#### `test_game_ending_list_view`
**功能:** 测试列出所有结局
- 获取故事的所有结局
- 返回 HTTP 200
- 结局列表正确

#### `test_game_ending_detail_view`
**功能:** 测试获取单个结局详情
- 获取特定结局的详细信息
- 返回 HTTP 200
- 结局信息完整

#### `test_game_ending_manual_update`
**功能:** 测试手动更新结局
- 用户手动编辑结局内容
- 返回 HTTP 200
- 数据库中内容被更新

#### `test_ending_generate_view`
**功能:** 测试启动结局生成
- 启动结局的生成任务
- 返回 HTTP 200
- 生成任务成功启动

#### `test_game_report_view`
**功能:** 测试获取游戏报告
- 获取游戏的最终报告
- 返回 HTTP 200
- 报告内容完整

---

## 交互功能测试

**File:** `interactions/test_interactions.py`

**Test Count:** 21个测试用例

### FavoriteViewSetTests (10个测试用例)

#### `test_list_favorites_with_folder_filter`
**功能:** 测试按文件夹过滤收藏
- 获取特定文件夹中的收藏
- 返回 HTTP 200
- 结果正确过滤

#### `test_list_favorites_with_null_folder_filter`
**功能:** 测试获取未分类的收藏
- 获取文件夹为空的收藏
- 返回 HTTP 200
- 结果正确

#### `test_list_favorites_search`
**功能:** 测试搜索收藏
- 按关键词搜索收藏
- 返回 HTTP 200
- 搜索结果正确

#### `test_create_duplicate_favorite`
**功能:** 测试防止重复收藏
- 尝试收藏已收藏的作品
- 返回 HTTP 400 或适当的错误
- 防止重复成功

#### `test_update_move_to_folder`
**功能:** 测试移动收藏到文件夹
- 将收藏移动到指定文件夹
- 返回 HTTP 200
- 位置更新成功

#### `test_update_invalid_folder`
**功能:** 测试移动到无效文件夹
- 尝试移动到不存在的文件夹
- 返回 HTTP 400
- 错误处理正确

#### `test_destroy_favorite`
**功能:** 测试删除收藏
- 删除已收藏的作品
- 返回 HTTP 204 或 HTTP 200
- 收藏被删除

#### `test_move_to_folder`
**功能:** 测试批量移动到文件夹
- 批量移动多个收藏
- 返回 HTTP 200
- 所有收藏都被移动

#### `test_move_to_folder_invalid_folder`
**功能:** 测试批量移动到无效文件夹
- 批量移动到不存在的文件夹
- 返回 HTTP 400
- 错误处理正确

#### `test_move_to_folder_invalid_ids_format`
**功能:** 测试无效的 ID 格式
- 提交格式错误的 ID
- 返回 HTTP 400
- 错误处理正确

---

### FavoriteFolderViewSetTests (4个测试用例)

#### `test_create_folder`
**功能:** 测试创建收藏文件夹
- 创建新的收藏分类文件夹
- 返回 HTTP 201 CREATED
- 文件夹信息正确

#### `test_list_folders`
**功能:** 测试列出所有文件夹
- 获取用户的所有文件夹
- 返回 HTTP 200
- 文件夹列表正确

#### `test_patch_folder_name`
**功能:** 测试修改文件夹名称
- 更改文件夹的名称
- 返回 HTTP 200
- 名称更新成功

#### `test_delete_folder`
**功能:** 测试删除文件夹
- 删除已创建的文件夹
- 返回 HTTP 204
- 文件夹被删除

---

### CommentViewSetTests (5个测试用例)

#### `test_create_comment`
**功能:** 测试创建评论
- 用户创建新评论
- 返回 HTTP 201 CREATED
- 评论内容正确

#### `test_list_comments`
**功能:** 测试列出评论
- 获取作品的所有评论
- 返回 HTTP 200
- 评论列表正确

#### `test_like_comment`
**功能:** 测试点赞评论
- 用户点赞评论
- 返回 HTTP 200
- 点赞数增加

#### `test_unlike_comment`
**功能:** 测试取消点赞评论
- 用户取消点赞
- 返回 HTTP 200
- 点赞数减少

#### `test_delete_comment`
**功能:** 测试删除评论
- 删除已创建的评论
- 返回 HTTP 204
- 评论被删除

---

### RatingViewSetTests (2个测试用例)

#### `test_list_ratings`
**功能:** 测试列出评分
- 获取作品的所有评分
- 返回 HTTP 200
- 评分列表正确

#### `test_invalid_rating_score`
**功能:** 测试无效的评分值
- 提交超出范围的评分（如 > 5 星）
- 返回 HTTP 400
- 错误处理正确

---

## 标签管理测试

### TagViewSetTestCase (6个测试用例)

**File:** `tags/test_tags.py`

#### `test_list_tags`
**功能:** 测试列出所有标签
- 获取系统中的所有标签
- 返回 HTTP 200
- 标签列表完整

#### `test_retrieve_tag`
**功能:** 测试获取单个标签
- 获取特定标签的详细信息
- 返回 HTTP 200
- 标签信息正确

#### `test_create_tag`
**功能:** 测试创建新标签
- 创建新的标签
- 返回 HTTP 201 CREATED
- 标签数据正确

#### `test_update_tag`
**功能:** 测试完全更新标签
- 修改标签的所有字段
- 返回 HTTP 200
- 标签信息被完全替换

#### `test_partial_update_tag`
**功能:** 测试部分更新标签
- 只修改标签的某些字段
- 返回 HTTP 200
- 指定字段被更新

#### `test_delete_tag`
**功能:** 测试删除标签
- 删除已创建的标签
- 返回 HTTP 204
- 标签被删除

---

## 测试统计

| 测试文件 | 测试类 | 测试用例 |
|------|--------|---------|
| test_users.py | 11 | 49 |
| test_gameworks.py | 7 | 27 |
| test_generator_parsing.py | 1 | 8 |
| test_generator.py | 1 | 5 |
| test_openai_client.py | 1 | 5 |
| test_services_extended.py | 1 | 6 |
| test_utils.py | 1 | 5 |
| test_integration.py | 1 | 2 |
| test_views.py | 1 | 20 |
| test_interactions.py | 4 | 21 |
| test_tags.py | 1 | 6 |
| **总计** | **30** | **154** |


**总体覆盖度:** 83%

---

*文档生成时间: 2025*