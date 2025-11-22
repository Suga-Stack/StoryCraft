# AppPage API 文档

本文档包含软件游戏外页面API的交互流程。

---
## 1. 用户模块

### 1. 用户管理接口（UserViewSet）

#### GET /api/users/
**说明：查看用户列表（普通用户仅能查看自己）**

**请求：**
```json
{}
```

**响应（管理员）：**
```json
{
  "code": 200,
  "data": [
    { "id": 1, "username": "admin", "email": "admin@test.com" },
    { "id": 2, "username": "user1", "email": "user1@test.com" }
  ]
}
```

**响应（普通用户）：**
```json
{
  "code": 200,
  "data": [
    { "id": 2, "username": "user1", "email": "user1@test.com" }
  ]
}
```

---

#### GET /api/users/{id}/
**说明：查看用户详情（普通用户只能查看自己）**

**请求：**
```json
{}
```

**响应：**
```json
{
  "code": 200,
  "data": { "id": 2, "username": "user1", "email": "user1@test.com" }
}
```

**无权限：**
```json
{ "detail": "您没有查看该用户资料的权限。" }
```

---

#### PUT /api/users/{id}/

**请求：**
```json
{
  "username": "new_name",
  "email": "new_email@test.com"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 2,
    "username": "new_name",
    "email": "new_email@test.com"
  }
}
```

---

#### PATCH /api/users/{id}/

**请求：**
```json
{ "email": "updated@test.com" }
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 2,
    "username": "user1",
    "email": "updated@test.com"
  }
}
```

---

#### DELETE /api/users/{id}/

**响应：**
```json
{ "code": 200, "message": "用户已删除" }
```

---

#### POST /api/users/
**说明：禁止创建用户**

**响应：**
```json
{ "detail": "用户注册只能通过注册接口进行！" }
```

---

### 2. 邮箱验证码接口（SendEmailCodeView）

#### POST /api/auth/email-code/

**请求：**
```json
{ "email": "test@example.com" }
```

**成功：**
```json
{ "code": 200, "message": "验证码已发送" }
```

**错误：**
```json
{ "code": 400, "message": "邮箱不能为空" }
```

---

### 3. 注册接口（RegisterView）

#### POST /api/auth/register/

**请求：**
```json
{
  "username": "new_user",
  "email": "user@test.com",
  "password": "strongpassword",
  "code": "123456"
}
```

**成功：**
```json
{ "code": 200, "message": "注册成功" }
```

**失败：**
```json
{
  "code": 400,
  "message": { "code": ["验证码错误"] }
}
```

---

### 4. 登录接口（LoginView）

#### POST /api/auth/login/

**请求：**
```json
{
  "username": "user1",
  "password": "123456"
}
```

**成功：**
```json
{
  "code": 200,
  "message": "登录成功",
  "tokens": {
    "access": "xxxxx",
    "refresh": "yyyyy"
  }
}
```

---

### 5. 登出接口（LogoutView）

#### POST /api/auth/logout/

**请求：**
```json
{ "refresh": "refresh-token-here" }
```

**响应：**
```json
{ "code": 200, "message": "登出成功" }
```

---

### 6. 用户偏好设置（UserPreferenceView）

#### GET /api/users/preferences/

**响应：**
```json
{
  "code": 200,
  "data": { "theme": "dark", "language": "zh" }
}
```

---

#### PUT /api/users/preferences/

**请求：**
```json
{
  "theme": "light",
  "language": "en"
}
```

**响应：**
```json
{
  "code": 200,
  "data": { "theme": "light", "language": "en" }
}
```

---

### 7. 阅读记录接口（ReadGameworkListView）

#### GET /api/users/read/

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 10, "title": "作品A", "cover": "...", "published": true },
    { "id": 5, "title": "作品B", "cover": "...", "published": true }
  ]
}
```

---

#### POST /api/users/read/

**请求：**
```json
{ "gamework_id": 10 }
```

**响应：**
```json
{ "code": 200, "message": "阅读记录已创建" }
```

---

#### DELETE /api/users/read/?gamework_ids=10,12

**响应：**
```json
{ "code": 200, "message": "删除 2 条记录" }
```

**删除全部：**
```json
{ "code": 200, "message": "删除 8 条记录" }
```

---

### 8. 最近阅读（RecentReadGameworksView）

#### GET /api/users/read/recent/

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 3, "title": "作品C" },
    { "id": 1, "title": "作品D" }
  ]
}
```

---

### 9. 当前用户创作列表（MyGameworkListView）

#### GET /api/users/myworks/

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 10, "title": "我的作品 X", "created_at": "2025-01-01" },
    { "id": 6,  "title": "我的作品 Y", "created_at": "2024-12-20" }
  ]
}
```

---

### 10. 最近创作（RecentMyGameworksView）

#### GET /api/users/my-works/recent/

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 10, "title": "最近的作品 X" },
    { "id": 6,  "title": "最近的作品 Y" }
  ]
}
```

---
## 2. 标签模块

#### GET /api/tags/

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 1, "name": "奇幻", "created_at": "2025-01-12T10:22:33Z" },
    { "id": 2, "name": "科幻", "created_at": "2025-01-12T10:22:50Z" }
  ]
}
```

---

#### POST /api/tags/

**请求：**
```json
{
  "name": "悬疑"
}
```

**响应：**
```json
{
  "code": 201,
  "data": {
    "id": 3,
    "name": "悬疑",
    "created_at": "2025-01-12T10:25:14Z"
  }
}
```

---

#### GET /api/tags/{id}/

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 3,
    "name": "悬疑",
    "created_at": "2025-01-12T10:25:14Z",
    "updated_at": "2025-01-12T10:25:14Z"
  }
}
```

---

#### PUT /api/tags/{id}/

**请求：**
```json
{
  "name": "悬疑（更新）"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 3,
    "name": "悬疑（更新）",
    "created_at": "2025-01-12T10:25:14Z",
    "updated_at": "2025-01-12T11:00:32Z"
  }
}
```

---

#### PATCH /api/tags/{id}/

**请求：**
```json
{
  "name": "推理"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": 3,
    "name": "推理",
    "created_at": "2025-01-12T10:25:14Z",
    "updated_at": "2025-01-12T11:05:00Z"
  }
}
```

---

#### DELETE /api/tags/{id}/

**响应：**
```json
{
  "code": 204,
  "message": "标签已删除"
}
```

---
## 3. 作品模块

### 1. 作品接口（GameworkViewSet）

#### GET /api/gameworks/

返回所有可见作品：  
- 已发布作品：所有人可见  
- 未发布作品：仅作者和管理员可见  
自动包含：收藏数、评分数、阅读数、平均评分、是否被当前用户收藏。

**响应：**
```json
{
  "code": 200,
  "data": [
    {
      "id": 1,
      "title": "冒险故事",
      "author": "alice",
      "favorite_count": 12,
      "rating_count": 4,
      "average_score": 4.7,
      "read_count": 21,
      "is_favorited": true
    }
  ]
}
```

---

#### GET /api/gameworks/{id}/

若作品尚未完成初始生成：

**响应：**
```json
{ "status": "generating" }
```

若已完成：

**响应：**
```json
{
  "status": "ready",
  "data": {
    "id": 1,
    "title": "冒险故事",
    "content": "……"
  }
}
```

---

#### POST /api/gameworks/

创建作品，作者自动设置为当前用户。

**请求示例：**
```json
{
  "title": "新的游戏作品",
  "description": "这是一个简介……"
}
```

**响应：**
```json
{
  "code": 200,
  "message": "创建成功",
  "data": { "id": 15 }
}
```

---

#### PUT /api/gameworks/{id}/  
#### PATCH /api/gameworks/{id}/  

更新作品，仅作者或管理员可操作。

**请求示例：**
```json
{
  "title": "新标题"
}
```

**响应：**
```json
{ "code": 200, "message": "更新成功" }
```

---

#### DELETE /api/gameworks/{id}/

**响应：**
```json
{ "code": 200, "message": "删除成功" }
```

---

### 2. 发布作品接口（PublishGameworkViewSet）

#### POST /api/gameworks/{id}/publish/

将作品发布，使其对所有用户可见。

**成功：**
```json
{
  "message": "作品已成功发布",
  "gamework": {
    "id": 3,
    "title": "作品标题"
  }
}
```

**失败：作品不存在：**
```json
{ "message": "作品未找到" }
```

**失败：无权限：**
```json
{ "message": "您没有权限发布该作品" }
```

---

#### POST /api/gameworks/{id}/unpublish/

把作品设为未发布，仅作者和管理员可见。

**成功：**
```json
{
  "message": "作品已成功取消发布",
  "gamework": {
    "id": 3,
    "title": "作品标题"
  }
}
```

**失败：作品不存在：**
```json
{ "message": "作品未找到" }
```

**失败：无权限：**
```json
{ "message": "您没有权限取消发布该作品" }
```

---

### 3. 作品搜索接口（GameworkSearchView）

示例：  
`/api/gameworks/search/?q=冒险&author=alice&tag=3`

#### GET /api/gameworks/search/

**响应：**
```json
{
  "code": 200,
  "message": "搜索成功",
  "data": [
    {
      "id": 1,
      "title": "冒险之旅",
      "author": "alice",
      "tags": ["冒险", "RPG"]
    }
  ]
}
```

---

### 4. 推荐作品接口（RecommendView）

根据当前用户喜欢的标签推荐作品。  
推荐依据：标签匹配数量 + 平均评分排序。

#### GET /api/gameworks/recommend/

**成功：**
```json
{
  "code": 200,
  "message": "推荐成功",
  "data": [
    {
      "id": 12,
      "title": "魔法之森",
      "match_count": 2,
      "average_score": 4.8
    }
  ]
}
```

**失败：未设置喜欢的标签：**
```json
{
  "code": 404,
  "message": "用户未设置喜欢的标签",
  "data": []
}
```

---

### 5. 收藏排行榜（GameworkFavoriteLeaderboardViewSet）

按收藏数倒序返回前 10 名作品。

#### GET /api/gameworks/leaderboard/favorites/

**响应：**
```json
{
  "message": "作品排行榜",
  "data": [
    { "id": 1, "title": "作品A", "favorite_count": 120 }
  ]
}
```

---

### 6. 评分排行榜（GameworkRatingLeaderboardViewSet）

按平均评分倒序返回前 10 名作品。

#### GET /api/gameworks/leaderboard/ratings/

**响应：**
```json
{
  "message": "作品评分排行榜",
  "data": [
    { "id": 1, "title": "作品A", "average_score": 4.9 }
  ]
}
```

---

### 7. 热度排行榜（GameworkHotLeaderboardViewSet）

热度 = 回复数 × 2 + 收藏数 × 1  
支持时间范围：

| range | 说明 |
|-------|------|
| total | 总榜 |
| month | 月榜（30 天） |
| week  | 周榜（7 天） |

---

#### GET /api/gameworks/leaderboard/hot/?range=week

**响应：**
```json
{
  "message": "作品热度排行榜（week）",
  "data": [
    {
      "id": 22,
      "title": "奇幻大陆",
      "reply_count": 23,
      "favorite_count": 12,
      "hot_score": 58
    }
  ]
}
```

**无效参数：**
```json
{
  "message": "无效的 range 参数，可选值: total, month, week"
}
```

---
## 4. 交互模块
### 1. 收藏夹管理接口（FavoriteFolderViewSet）
管理用户的收藏夹，包括创建、修改、删除收藏夹，并自动管理收藏夹中作品的归属。

---

#### GET /api/folders/

获取当前登录用户的收藏夹列表。

**响应：**
```json
{
  "code": 200,
  "data": [
    { "id": 1, "name": "默认收藏夹", "count": 5 },
    { "id": 3, "name": "科幻作品", "count": 12 }
  ]
}
```

---

#### POST /api/folders/

创建一个新的收藏夹。如果 `name` 为空，系统自动命名。

**请求：**
```json
{
  "name": "我的收藏夹"
}
```

**响应：**
```json
{
  "code": 201,
  "message": "收藏夹创建成功",
  "data": {
    "id": 10,
    "name": "我的收藏夹",
    "created_at": "2025-01-12T10:25:14Z"
  }
}
```

---

#### PATCH /api/folders/{id}/
 
修改收藏夹名称。

**请求：**
```json
{
  "name": "新的收藏夹名"
}
```

**响应：**
```json
{
  "code": 200,
  "message": "收藏夹名称修改成功",
  "data": {
    "id": 10,
    "name": "新的收藏夹名"
  }
}
```

---

#### DELETE /api/folders/{id}/

删除收藏夹。收藏夹中的作品自动移动到未分组（folder = null）。

**响应：**
```json
{
  "code": 204,
  "message": "收藏夹删除成功"
}
```
---

### 2. 用户收藏作品（FavoriteViewSet）

管理用户收藏的作品，包括获取收藏列表、收藏作品、移动收藏夹和取消收藏。支持批量移动收藏。

---

#### GET /api/favorites/

获取当前用户收藏列表，支持按作品标题搜索和收藏夹筛选。

**查询参数：**
- `search`：按作品标题模糊搜索（可选）
- `folder`：收藏夹 ID，可为空显示未分组，不传显示全部（可选）

**响应：**
```json
{
  "code": 200,
  "message": "获取收藏列表成功",
  "data": [
    {
      "id": 101,
      "gamework": { "id": 10, "title": "冒险之旅" },
      "folder": { "id": 3, "name": "科幻作品" }
    },
    {
      "id": 102,
      "gamework": { "id": 12, "title": "森林探险" },
      "folder": null
    }
  ]
}
```

---

#### POST /api/favorites/

收藏作品，可指定收藏夹。

**请求：**
```json
{
  "gamework_id": 10,
  "folder": 3
}
```

**响应：**
```json
{
  "code": 201,
  "message": "收藏成功",
  "data": {
    "id": 101,
    "gamework": { "id": 10, "title": "冒险之旅" },
    "folder": { "id": 3, "name": "科幻作品" }
  }
}
```

---

#### PATCH /api/favorites/{id}/

移动收藏到其他收藏夹或移出收藏夹。

**请求：**
```json
{
  "folder": 5
}
```

**响应：**
```json
{
  "code": 200,
  "message": "移动收藏成功",
  "data": {
    "id": 101,
    "gamework": { "id": 10, "title": "冒险之旅" },
    "folder": { "id": 5, "name": "新收藏夹" }
  }
}
```

---

#### DELETE /api/favorites/{id}/

取消收藏。

**响应：**
```json
{
  "code": 204,
  "message": "取消收藏成功"
}
```

---

#### POST /api/favorites/move_to_folder/

批量移动收藏到指定收藏夹，可移出收藏夹（folder 为空）。

**请求：**
```json
{
  "favorite_ids": [101, 102],
  "folder": 5
}
```

**响应：**
```json
{
  "code": 200,
  "message": "批量移动收藏成功",
  "data": [
    {
      "id": 101,
      "gamework": { "id": 10, "title": "冒险之旅" },
      "folder": { "id": 5, "name": "新收藏夹" }
    },
    {
      "id": 102,
      "gamework": { "id": 12, "title": "森林探险" },
      "folder": { "id": 5, "name": "新收藏夹" }
    }
  ]
}
```

---

### 3. 用户评论作品（CommentViewSet）

管理用户对作品的评论，包括获取评论列表、发表评论/回复、点赞与取消点赞。支持顶级评论分页和嵌套回复显示。

---

#### GET /api/comments/

获取评论列表，可按作品 ID 筛选。

**查询参数：**
- `gamework`：作品 ID（可选）

**响应：**
```json
{
  "code": 200,
  "message": "获取评论列表成功",
  "data": [
    {
      "id": 201,
      "content": "这是一个很棒的作品！",
      "user": { "id": 1, "username": "Alice" },
      "gamework": { "id": 10, "title": "冒险之旅" },
      "like_count": 5,
      "replies": [
        {
          "id": 202,
          "content": "我也觉得很棒！",
          "user": { "id": 2, "username": "Bob" },
          "like_count": 2
        }
      ]
    }
  ]
}
```

---

#### POST /api/comments/

发表评论或回复。

**请求：**
```json
{
  "gamework": 10,
  "content": "这是一个很棒的作品！",
  "parent": null
}
```

**响应：**
```json
{
  "code": 201,
  "message": "评论发布成功",
  "data": {
    "id": 201,
    "content": "这是一个很棒的作品！",
    "user": { "id": 1, "username": "Alice" },
    "gamework": { "id": 10, "title": "冒险之旅" },
    "like_count": 0,
    "parent": null
  }
}
```

---

#### POST /api/comments/{id}/like/

点赞评论。

**响应：**
```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "liked": true,
    "like_count": 6
  }
}
```

---

#### POST /api/comments/{id}/unlike/

取消点赞评论。

**响应：**
```json
{
  "code": 200,
  "message": "取消点赞成功",
  "data": {
    "liked": false,
    "like_count": 5
  }
}
```

---

#### DELETE /api/comments/{id}/

删除评论。

**响应：**
```json
{
  "code": 204,
  "message": "评论删除成功"
}
```

### 4. 用户评分作品（RatingViewSet）
管理用户对作品的评分，包括获取评分列表和为作品评分。

---

#### GET /api/ratings/

获取评分列表，可按作品 ID 筛选。

**查询参数：**
- `gamework`：作品 ID（可选）

**响应：**
```json
{
  "code": 200,
  "message": "获取评分列表成功",
  "data": [
    {
      "id": 301,
      "score": 9,
      "user": { "id": 1, "username": "Alice" },
      "gamework": { "id": 10, "title": "冒险之旅" }
    },
    {
      "id": 302,
      "score": 8,
      "user": { "id": 2, "username": "Bob" },
      "gamework": { "id": 10, "title": "冒险之旅" }
    }
  ]
}
```

---

#### POST /api/ratings/

为作品评分。

**请求：**
```json
{
  "id": 10,
  "score": 9
}
```

**响应：**
```json
{
  "code": 201,
  "message": "评分成功",
  "average_score": 8.5,
  "data": {
    "id": 301,
    "score": 9,
    "user": { "id": 1, "username": "Alice" },
    "gamework": { "id": 10, "title": "冒险之旅" }
  }
}
```

---

#### DELETE /api/ratings/{id}/

删除评分。

**响应：**
```json
{
  "code": 204,
  "message": "评分删除成功"
}
```
