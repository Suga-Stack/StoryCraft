**File:** `test_generator_parsing.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 8

---

## TestGeneratorParsing

**Test Count:** 8

### Test Methods

#### `test_parse_creative_directions`
测试创意方向解析功能

#### `test_extract_section`
测试章节内容提取功能

#### `test_parse_title_description`
测试标题和描述解析功能

#### `test_parse_attributes`
测试属性系统解析功能

#### `test_parse_endings`
测试多结局解析功能

#### `test_extract_chapter_block`
测试章节内容块提取功能

#### `test_parse_report`
测试游戏报告解析功能

#### `test_extract_scenes_prompt`
测试场景提示词和范围提取功能

---


**File:** `test_generator.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 5

---

## TestGeneratorParsing

**Test Count:** 5

### Test Methods

#### `test_parse_outlines_short_format`

测试短篇格式大纲解析

#### `test_parse_outlines_long_format`

测试长篇格式大纲解析

#### `test_calculate_attributes`

测试属性范围计算

#### `test_calculate_attributes_no_initial`

测试无初始属性的情况

#### `test_parse_ending_condition`

测试结局条件解析

---


**File:** `test_integration.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 2

---

## TestServicesIntegration

**Test Count:** 2

### Test Methods

#### `test_generate_chapter_flow`

集成测试：生成章节流程

#### `test_create_gamework`

集成测试：创建作品流程

---


**File:** `test_openai_client.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 5

---

## TestOpenAIClient

**Test Count:** 5

### Test Methods

#### `test_invoke_success`
测试 OpenAI 文本生成成功场景

#### `test_invoke_failure`
测试 OpenAI 文本生成失败场景

#### `test_generate_single_image_success`
测试单张图片生成成功场景

#### `test_generate_single_image_failure`
测试单张图片生成失败场景

#### `test_generate_multi_images`
测试批量图片生成功能

---


**File:** `test_services_extended.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 6

---

## TestServicesExtended

**Test Count:** 6

### Test Methods

#### `test_select_background_music`
测试背景音乐选择功能

#### `test_resolve_total_chapters`
测试章节数量解析功能

#### `test_resolve_scene_cover_url`
测试场景封面 URL 解析功能

#### `test_get_chapter_status_logic`
测试章节状态获取功能

#### `test_generate_and_save_report`
测试游戏报告生成和保存功能

#### `test_get_ending_report_scores`
测试结局报告得分计算功能

---


**File:** `test_utils.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 5

---

## TestUtils

**Test Count:** 5

### Test Methods

#### `test_parse_attr_deltas`

测试属性变化解析

#### `test_split_sentences_quotes`

测试分句：包含引号的情况

#### `test_iter_choice_groups`

测试选项组识别

#### `test_parse_raw_chapter`

测试完整章节解析

#### `test_update_story_directory`

测试大纲更新

---


**File:** `test_views.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 20

---

## GameViewsTestCase

**Description:** 测试 game 相关的接口

**Test Count:** 20

### Test Methods

#### `test_user_image_upload_view_success`

Test successful image upload.

#### `test_user_image_upload_view_no_file`

Test image upload with no file provided.

#### `test_game_create_view_success`

Test successful game creation.

#### `test_game_create_view_invalid_data`

Test game creation with invalid data.

#### `test_get_chapter_status_success`

Test successfully getting chapter status.

#### `test_get_chapter_status_not_found`

Test getting chapter status for a non-existent gamework.

#### `test_update_chapter_manual_success`

Test manually updating a chapter successfully.

#### `test_update_chapter_manual_forbidden`

Test that a user cannot update a chapter they do not own.

#### `test_chapter_generate_view_success`

Test successfully starting single chapter generation.

#### `test_chapter_generate_view_forbidden`

Test that a user cannot trigger generation for a gamework they don't own.

#### `test_game_save_put_create`

Test creating a new game save.

#### `test_game_save_get_success`

Test retrieving an existing game save.

#### `test_game_save_get_not_found`

Test retrieving a non-existent game save.

#### `test_game_save_delete_success`

Test deleting a game save.

#### `test_game_save_list_view`

Test listing all game saves for a gamework.

#### `test_game_ending_list_view`

Test listing story endings

#### `test_game_ending_detail_view`

Test getting single ending detail

#### `test_game_ending_manual_update`

Test manually updating an ending

#### `test_ending_generate_view`

Test starting ending generation

#### `test_game_report_view`

Test getting game report

---

**File:** `test_gameworks.py`

## Overview

- **Total Test Classes:** 7
- **Total Test Cases:** 27

---

## GameworkFavoriteLeaderboardViewSetTestCase

**Description:** Test suite for the GameworkFavoriteLeaderboardViewSet.

**Test Count:** 1

### Test Methods

#### `test_favorite_leaderboard`

Test retrieving the favorite leaderboard correctly.

---

## GameworkHotLeaderboardViewSetTestCase

**Description:** Test suite for the GameworkHotLeaderboardViewSet.

**Test Count:** 3

### Test Methods

#### `test_hot_leaderboard_total`

Test retrieving the hot leaderboard with total range.

#### `test_hot_leaderboard_month`

Test retrieving the hot leaderboard with month range.

#### `test_hot_leaderboard_invalid_range`

Test invalid range parameter.

---

## GameworkRatingLeaderboardViewSetTestCase

**Description:** Test suite for the GameworkRatingLeaderboardViewSet.

**Test Count:** 1

### Test Methods

#### `test_rating_leaderboard`

Test retrieving the rating leaderboard correctly.

---

## GameworkSearchViewTestCase

**Description:** Test suite for the GameworkSearchView.

**Test Count:** 5

### Test Methods

#### `test_search_by_title`

Test searching by title.

#### `test_search_by_author`

Test searching by author.

#### `test_search_by_tag`

Test searching by tag.

#### `test_search_no_results`

Test search with no matching results.

#### `test_search_multiple_filters`

Test search with multiple filters: title, author, and tag.

---

## GameworkViewSetTestCase

**Description:** Test suite for the GameworkViewSet retrieve method.

**Test Count:** 5

### Test Methods

#### `test_retrieve_published_gamework_success`

Test retrieving a published gamework successfully.

#### `test_retrieve_unpublished_gamework_as_author`

Test retrieving an unpublished gamework as the author.

#### `test_retrieve_unpublished_gamework_as_other_user`

Test retrieving an unpublished gamework as another user.

#### `test_retrieve_other_user_published_gamework`

Test retrieving a published gamework created by another user.

#### `test_retrieve_nonexistent_gamework`

Test retrieving a non-existent gamework.

---

## PublishGameworkViewSetTestCase

**Description:** Test suite for the PublishGameworkViewSet.

**Test Count:** 9

### Test Methods

#### `test_publish_gamework_success`

Test successfully publishing a gamework as the author.

#### `test_publish_gamework_invalid_price`

Test publishing a gamework with an invalid price.

#### `test_publish_gamework_price_out_of_range`

Test publishing a gamework with a price out of the allowed range.

#### `test_publish_gamework_not_author`

Test that a user cannot publish a gamework they do not own.

#### `test_publish_gamework_as_admin`

Test successfully publishing a gamework as an admin.

#### `test_publish_gamework_not_found`

Test publishing a non-existent gamework.

#### `test_unpublish_gamework_success`

Test successfully unpublishing a gamework as the author.

#### `test_unpublish_gamework_not_author`

Test that a user cannot unpublish a gamework they do not own.

#### `test_unpublish_gamework_as_admin`

Test successfully unpublishing a gamework as an admin.

---

## RecommendViewTestCase

**Description:** Test suite for the RecommendView.

**Test Count:** 3

### Test Methods

#### `test_recommendations_success`

Test recommendations based on liked tags.

#### `test_recommendations_no_liked_tags`

Test that the user gets a 404 if no liked tags are set.

#### `test_recommendations_exclude_user_created`

Test that the recommendations exclude the user's own gameworks.

---

**File:** `test_interactions.py`

## Overview

- **Total Test Classes:** 4
- **Total Test Cases:** 21

---

## CommentViewSetTests

**Test Count:** 5

### Test Methods

#### `test_create_comment`


#### `test_list_comments`


#### `test_like_comment`


#### `test_unlike_comment`


#### `test_delete_comment`


---

## FavoriteFolderViewSetTests

**Test Count:** 4

### Test Methods

#### `test_create_folder`


#### `test_list_folders`


#### `test_patch_folder_name`


#### `test_delete_folder`


---

## FavoriteViewSetTests

**Test Count:** 10

### Test Methods

#### `test_list_favorites_with_folder_filter`


#### `test_list_favorites_with_null_folder_filter`


#### `test_list_favorites_search`


#### `test_create_duplicate_favorite`


#### `test_update_move_to_folder`


#### `test_update_invalid_folder`


#### `test_destroy_favorite`


#### `test_move_to_folder`


#### `test_move_to_folder_invalid_folder`


#### `test_move_to_folder_invalid_ids_format`


---

## RatingViewSetTests

**Test Count:** 2

### Test Methods

#### `test_list_ratings`


#### `test_invalid_rating_score`


---

**File:** `test_tags.py`

## Overview

- **Total Test Classes:** 1
- **Total Test Cases:** 6

---

## TagViewSetTestCase

**Description:** Test suite for the TagViewSet.

**Test Count:** 6

### Test Methods

#### `test_list_tags`

Test retrieving a list of tags.

#### `test_retrieve_tag`

Test retrieving a single tag by ID.

#### `test_create_tag`

Test creating a new tag.

#### `test_update_tag`

Test updating an existing tag.

#### `test_partial_update_tag`

Test partially updating an existing tag.

#### `test_delete_tag`

Test deleting an existing tag.

---

**File:** `test_users.py`

## Overview

- **Total Test Classes:** 11
- **Total Test Cases:** 49

---

## CommentReportViewSetTests

**Description:** Test suite for CommentReportViewSet.

**Test Count:** 8

### Test Methods

#### `test_list_comment_reports_as_user`

Test that a normal user can only see their own comment reports.

#### `test_list_comment_reports_as_admin`

Test that an admin can see all comment reports.

#### `test_create_comment_report_success`

Test successfully creating a comment report.

#### `test_create_comment_report_invalid`

Test creating a comment report with invalid data.

#### `test_retrieve_comment_report_as_user`

Test retrieving a comment report as the reporter.

#### `test_retrieve_comment_report_as_admin`

Test retrieving a comment report as an admin.

#### `test_destroy_comment_report_as_admin`

Test deleting a comment report as an admin.

#### `test_destroy_comment_report_as_user`

Test deleting a comment report as a normal user.

---

## CreditLogViewSetTests

**Description:** Test suite for CreditLogViewSet.

**Test Count:** 1

### Test Methods

#### `test_list_credit_logs_success`

Test that a user can retrieve their own credit logs.

---

## GameworkReportViewSetTests

**Description:** Test suite for GameworkReportViewSet.

**Test Count:** 6

### Test Methods

#### `test_list_reports_as_user`

Test that a normal user can only see their own reports.

#### `test_list_reports_as_admin`

Test that an admin can see all reports.

#### `test_create_report_success`

Test successfully creating a report.

#### `test_create_report_invalid_gamework`

Test creating a report for a non-existent gamework.

#### `test_retrieve_report_as_user`

Test retrieving a report as the reporter.

#### `test_retrieve_report_as_admin`

Test retrieving a report as an admin.

---

## LoginViewTestCase

**Description:** Test suite for LoginView.

**Test Count:** 2

### Test Methods

#### `test_login_success`

Test successful login.

#### `test_login_invalid_credentials`

Test login with invalid credentials.

---

## ReadGameworkListViewTestCase

**Description:** Test suite for the ReadGameworkListView.

**Test Count:** 7

### Test Methods

#### `test_get_read_gameworks_success`

Test retrieving the list of read gameworks for the current user.

#### `test_post_read_gamework_success`

Test recording a new read gamework.

#### `test_post_read_gamework_insufficient_credits`

Test recording a read gamework with insufficient credits.

#### `test_post_read_gamework_not_found`

Test recording a read gamework that does not exist.

#### `test_post_read_gamework_no_gamework_id`

Test recording a read gamework without providing a gamework_id.

#### `test_delete_read_gameworks_success`

Test hiding specific read gameworks.

#### `test_delete_all_read_gameworks_success`

Test hiding all read gameworks.

---

## RechargeViewSetTestCase

**Description:** Test suite for the RechargeViewSet.

**Test Count:** 5

### Test Methods

#### `test_recharge_success`

Test successful recharge of credits.

#### `test_recharge_invalid_credits_type`

Test recharge with invalid credits type (non-integer).

#### `test_recharge_negative_credits`

Test recharge with negative credits.

#### `test_recharge_zero_credits`

Test recharge with zero credits.

#### `test_recharge_unauthenticated`

Test recharge without authentication.

---

## RegisterViewTests

**Test Count:** 2

### Test Methods

#### `test_register_success`


#### `test_register_password_mismatch`


---

## RewardViewSetTests

**Description:** Test suite for RewardViewSet.

**Test Count:** 2

### Test Methods

#### `test_reward_success`

Test successfully rewarding a gamework author.

#### `test_reward_insufficient_credits`

Test rewarding a gamework author with insufficient credits.

---

## SendEmailCodeViewTests

**Test Count:** 2

### Test Methods

#### `test_send_email_code`


#### `test_send_email_code_without_email`


---

## UserSignInViewTestCase

**Description:** Test suite for the UserSignInView.

**Test Count:** 4

### Test Methods

#### `test_get_signin_dates_success`

Test retrieving all sign-in dates for the current user.

#### `test_post_signin_success`

Test successful user sign-in.

#### `test_post_signin_already_signed_in`

Test attempting to sign in when the user has already signed in today.

#### `test_post_signin_continuous_days`

Test signing in on consecutive days to verify continuous day calculation.

---

## UserViewSetTestCase

**Description:** Test suite for UserViewSet.

**Test Count:** 10

### Test Methods

#### `test_retrieve_user_as_admin`

Test that an admin can retrieve any user's details.

#### `test_retrieve_user_as_normal_user`

Test that a normal user can only retrieve their own details.

#### `test_delete_self_success`

Test that a user can delete their own account.

#### `test_delete_other_user_forbidden`

Test that a normal user cannot delete another user's account.

#### `test_delete_user_as_admin`

Test that an admin can delete any user's account.

#### `test_list_users_as_admin`

Test that an admin can list all users.

#### `test_list_users_as_normal_user`

Test that a normal user can only see their own data.

#### `test_partial_update_self_success`

Test partial update of own user data.

#### `test_partial_update_other_user_forbidden`

Test partial update of another user's data is forbidden.

#### `test_partial_update_as_admin_success`

Test partial update of another user's data as admin.

---
