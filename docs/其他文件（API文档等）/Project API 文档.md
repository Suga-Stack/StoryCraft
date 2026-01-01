---
title: Project API 文档
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
code_clipboard: true
highlight_theme: darkula
headingLevel: 2
generator: "@tarslib/widdershins v4.0.30"

---

# Project API 文档

这是项目的接口文档，自动从 DRF 视图生成

Base URLs:

 License: BSD License

# Authentication

* API Key (Bearer)
    - Parameter Name: **Authorization**, in: header. JWT Authorization header using the Bearer scheme. Example: "Bearer {your token}"

# auth

<a id="opIdauth_login_create"></a>

## POST auth_login_create

POST /auth/login/

登录接口

> Body 请求参数

```json
{
  "username": "string",
  "password": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[Login](#schemalogin)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "access": "string",
    "refresh": "string",
    "user": {
      "id": 0,
      "username": "string",
      "profile_picture": "string",
      "user_credits": 0,
      "gender": "Male",
      "liked_tags": [
        0
      ]
    }
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|登录成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|登录失败|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||状态码|
|» message|string|false|none||提示信息|
|» data|object|false|none||none|
|»» access|string|false|none||JWT访问令牌|
|»» refresh|string|false|none||JWT刷新令牌|
|»» user|object|false|none||none|
|»»» id|integer|false|none||用户ID|
|»»» username|string|false|none||用户名|
|»»» profile_picture|string¦null|false|none||头像URL|
|»»» user_credits|integer¦null|false|none||用户积分|
|»»» gender|string¦null|false|none||性别|
|»»» liked_tags|[integer]¦null|false|none||喜欢的标签|

#### 枚举值

|属性|值|
|---|---|
|gender|Male|
|gender|Female|
|gender|Other|
|gender|null|

状态码 **400**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|object|false|none||错误信息|

<a id="opIdauth_logout_create"></a>

## POST auth_logout_create

POST /auth/logout/

登出接口

> Body 请求参数

```json
{
  "refresh": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[Logout](#schemalogout)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|登出成功|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|

<a id="opIdauth_register_create"></a>

## POST auth_register_create

POST /auth/register/

注册接口

> Body 请求参数

```json
{
  "username": "string",
  "password": "string",
  "confirm_password": "string",
  "email": "user@example.com",
  "email_code": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[Register](#schemaregister)| 是 |none|

> 返回示例

> 201 Response

```json
{
  "code": 0,
  "message": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|注册成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|验证失败|Inline|

### 返回数据结构

状态码 **201**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|

状态码 **400**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|object|false|none||none|

<a id="opIdauth_send-email-code_create"></a>

## POST auth_send-email-code_create

POST /auth/send-email-code/

发送邮箱验证码

> Body 请求参数

```json
{
  "email": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» email|body|string| 是 |邮箱地址|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string",
  "email_code": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|验证码发送成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|邮箱为空|None|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|邮件发送失败|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» email_code|string|false|none||none|

<a id="opIdauth_token_create"></a>

## POST auth_token_create

POST /auth/token/

Takes a set of user credentials and returns an access and refresh JSON web
token pair to prove the authentication of those credentials.

> Body 请求参数

```json
{
  "username": "string",
  "password": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[TokenObtainPair](#schematokenobtainpair)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "refresh": "string",
  "access": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» refresh|string|true|none||none|
|» access|string|true|none||none|

<a id="opIdauth_token_refresh_create"></a>

## POST auth_token_refresh_create

POST /auth/token/refresh/

Takes a refresh type JSON web token and returns an access type JSON web
token if the refresh token is valid.

> Body 请求参数

```json
{
  "refresh": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[TokenRefresh](#schematokenrefresh)| 是 |none|

> 返回示例

> 201 Response

```json
{
  "refresh": "string",
  "access": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|[TokenRefresh](#schematokenrefresh)|

# game

<a id="opIdgame_chapter_generate_create"></a>

## POST 启动章节生成(创作者模式)

POST /game/chapter/generate/{gameworkId}/{chapterIndex}/

为创作者启动指定章节的生成

> Body 请求参数

```json
{
  "chapterOutlines": [
    {
      "chapterIndex": 0,
      "title": "string",
      "outline": "string"
    }
  ],
  "userPrompt": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|chapterIndex|path|string| 是 |none|
|body|body|[ChapterGenerate](#schemachaptergenerate)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权操作或非创作者模式|None|

<a id="opIdgame_chapter_read"></a>

## GET 查询章节生成状态或获取内容

GET /game/chapter/{gameworkId}/{chapterIndex}/

轮询接口，返回章节生成状态(pending/generating/ready)或已生成的章节内容。

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|integer| 是 |作品ID|
|chapterIndex|path|integer| 是 |章节索引(从1开始)|

> 返回示例

> 200 Response

```json
{
  "status": "pending",
  "message": "string",
  "progress": {
    "currentChapter": 0,
    "totalChapters": 0
  },
  "chapter": {
    "chapterIndex": 0,
    "title": "string",
    "scenes": [
      {
        "id": 0,
        "backgroundImage": "string",
        "dialogues": [
          {
            "narration": null,
            "playerChoices": null
          }
        ]
      }
    ]
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[GameChapterStatusResponse](#schemagamechapterstatusresponse)|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|请求参数错误|None|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|未认证，请先登录|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|作品不存在|None|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|服务器内部错误|None|

<a id="opIdgame_chapter_update"></a>

## PUT 手动保存修改后的章节内容

PUT /game/chapter/{gameworkId}/{chapterIndex}/

轮询查询游戏章节生成状态或手动保存章节

> Body 请求参数

```json
{
  "chapterIndex": 0,
  "title": "string",
  "scenes": [
    {
      "id": 0,
      "backgroundImage": "string",
      "dialogues": [
        {
          "narration": "string",
          "playerChoices": [
            {}
          ]
        }
      ]
    }
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|chapterIndex|path|string| 是 |none|
|body|body|[GameChapterManualUpdate](#schemagamechaptermanualupdate)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|chapterIndex参数不匹配|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权修改|None|

<a id="opIdgame_create_create"></a>

## POST 创建新作品

POST /game/create/

根据用户选择的标签、构思和篇幅，调用AI生成并创建一个新的游戏作品。

> Body 请求参数

```json
{
  "tags": [
    "string",
    "string",
    "string"
  ],
  "idea": "string",
  "length": "short",
  "modifiable": false
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[GameCreate](#schemagamecreate)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|{"gameworkId": 123}|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|请求参数错误|None|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|未认证，请先登录|None|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|服务器内部错误|None|

<a id="opIdgame_saves_read"></a>

## GET 读取存档

GET /game/saves/{gameworkId}/{slot}/

存档详情：PUT 保存/更新； GET 读取； DELETE 删除

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|slot|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|返回完整存档对象|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|存档不存在|None|

<a id="opIdgame_saves_update"></a>

## PUT 保存或更新存档

PUT /game/saves/{gameworkId}/{slot}/

存档详情：PUT 保存/更新； GET 读取； DELETE 删除

> Body 请求参数

```json
{
  "title": "string",
  "timestamp": 0,
  "state": {
    "chapterIndex": 0,
    "endingIndex": 0,
    "sceneId": 0,
    "dialogueIndex": 0,
    "attributes": {},
    "statuses": {},
    "choiceHistory": []
  }
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|slot|path|string| 是 |none|
|body|body|[GameSavePayload](#schemagamesavepayload)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|保存成功|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|存档参数错误|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|作品不存在|None|

<a id="opIdgame_saves_delete"></a>

## DELETE 删除存档

DELETE /game/saves/{gameworkId}/{slot}/

存档详情：PUT 保存/更新； GET 读取； DELETE 删除

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|slot|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|成功删除|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|存档不存在|None|

<a id="opIdgame_settlement_report_create"></a>

## POST 生成结算报告候选 variants

POST /game/settlement/report/{workId}/

后端返回满足业务的所有候选报告，前端根据 attributes/statuses 自行匹配。

> Body 请求参数

```json
{
  "attributes": {},
  "statuses": {}
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|workId|path|string| 是 |none|
|body|body|[SettlementRequest](#schemasettlementrequest)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "success": true,
  "reports": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "minAttributes": {
        "property1": 0,
        "property2": 0
      },
      "requiredStatuses": [
        "string"
      ],
      "report": {
        "title": "string",
        "content": "string",
        "traits": [
          "string"
        ],
        "scores": {
          "property1": 0,
          "property2": 0
        }
      }
    }
  ],
  "debug": {
    "property1": "string",
    "property2": "string"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[SettlementResponse](#schemasettlementresponse)|

<a id="opIdgame_storyending_read"></a>

## GET 获取单个结局详情

GET /game/storyending/{gameworkId}/{endingIndex}/

返回指定结局的详细内容（包含场景）。

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|endingIndex|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "status": "string",
  "ending": {
    "endingIndex": 0,
    "title": "string",
    "condition": {},
    "outline": "string",
    "status": "string",
    "scenes": [
      {}
    ]
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|结局不存在|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» status|string|false|none||none|
|» ending|object|false|none||none|
|»» endingIndex|integer|false|none||none|
|»» title|string|false|none||none|
|»» condition|object|false|none||none|
|»» outline|string|false|none||none|
|»» status|string|false|none||none|
|»» scenes|[object]|false|none||none|

<a id="opIdgame_storyending_update"></a>

## PUT 手动保存修改后的结局内容

PUT /game/storyending/{gameworkId}/{endingIndex}/

获取单个结局的详细内容或手动更新结局

> Body 请求参数

```json
{
  "endingIndex": 0,
  "title": "string",
  "scenes": [
    {
      "id": 0,
      "backgroundImage": "string",
      "dialogues": [
        {
          "narration": "string",
          "playerChoices": [
            {}
          ]
        }
      ]
    }
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|endingIndex|path|string| 是 |none|
|body|body|[GameEndingManualUpdate](#schemagameendingmanualupdate)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权修改|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|结局不存在|None|

<a id="opIdgame_upload-image_create"></a>

## POST 上传自定义图片

POST /game/upload-image/

用户上传图片文件，服务器存储后返回图片的URL。

> Body 请求参数

```yaml
file: ""

```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 否 |none|
|» file|body|string(binary)| 是 |要上传的图片文件|

> 返回示例

> 201 Response

```json
{
  "imageUrl": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|上传成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|请求无效或未提供文件|None|

### 返回数据结构

状态码 **201**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» imageUrl|string|false|none||图片的访问URL|

<a id="opIdgame_ending_generate_create"></a>

## POST 启动结局生成(创作者模式)

POST /game/ending/generate/{gameworkId}/{endingIndex}/

为创作者启动指定结局的生成

> Body 请求参数

```json
{
  "title": "string",
  "outline": "string",
  "userPrompt": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|endingIndex|path|string| 是 |none|
|body|body|[EndingGenerate](#schemaendinggenerate)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权操作或非创作者模式|None|

<a id="opIdgame_report_create"></a>

## POST 获取结算报告

POST /game/report/{gameworkId}/{endingIndex}/

根据结局和属性获取个性化报告

> Body 请求参数

```json
{
  "attributes": {}
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gameworkId|path|string| 是 |none|
|endingIndex|path|string| 是 |none|
|body|body|object| 是 |none|
|» attributes|body|object| 否 |玩家最终属性值|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|报告内容|None|

# gameworks

<a id="opIdgameworks_favorite-leaderboard_list"></a>

## GET 作品排行榜（收藏量）

GET /gameworks/favorite-leaderboard/

返回收藏最多的10部作品，降序排列

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<a id="opIdgameworks_gameworks_read"></a>

## GET gameworks_gameworks_read

GET /gameworks/gameworks/{id}/

游戏作品视图集：
- 已发布作品对所有人可见
- 未发布作品仅作者和管理员可见
- 自动统计收藏数、评分数、阅读数、平均评分
- 返回字段包括是否被当前用户收藏

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "data": {
    "id": 0,
    "author": "string",
    "title": "string",
    "description": "string",
    "tags": [
      0
    ],
    "image_url": "string",
    "background_music_urls": "string",
    "is_published": true,
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "published_at": "2019-08-24T14:15:22Z",
    "favorite_count": "string",
    "average_score": "string",
    "rating_count": "string",
    "read_count": "string",
    "is_favorited": "string",
    "price": -9223372036854776000,
    "user_reward_amount": "string",
    "is_complete": "string",
    "generated_chapters": "string",
    "total_chapters": "string",
    "modifiable": "string",
    "ai_callable": "string",
    "initial_attributes": "string",
    "initial_statuses": "string",
    "outlines": "string",
    "chapters_status": "string",
    "comments_by_time": "string",
    "comments_by_hot": "string",
    "rating_details": "string"
  },
  "status": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» data|[GameworkDetail](#schemagameworkdetail)|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» author|string|false|read-only|Author|none|
|»» title|string|false|none|Title|none|
|»» description|string¦null|false|none|Description|none|
|»» tags|[integer]|true|none||none|
|»» image_url|string|false|read-only|Image url|none|
|»» background_music_urls|string|false|read-only|Background music urls|none|
|»» is_published|boolean|false|none|Is published|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|
|»» updated_at|string(date-time)|false|read-only|Updated at|none|
|»» published_at|string(date-time)¦null|false|none|Published at|none|
|»» favorite_count|string|false|read-only|Favorite count|none|
|»» average_score|string|false|read-only|Average score|none|
|»» rating_count|string|false|read-only|Rating count|none|
|»» read_count|string|false|read-only|Read count|none|
|»» is_favorited|string|false|read-only|Is favorited|none|
|»» price|integer|false|none|Price|none|
|»» user_reward_amount|string|false|read-only|User reward amount|none|
|»» is_complete|string|false|read-only|Is complete|none|
|»» generated_chapters|string|false|read-only|Generated chapters|none|
|»» total_chapters|string|false|read-only|Total chapters|none|
|»» modifiable|string|false|read-only|Modifiable|none|
|»» ai_callable|string|false|read-only|Ai callable|none|
|»» initial_attributes|string|false|read-only|Initial attributes|none|
|»» initial_statuses|string|false|read-only|Initial statuses|none|
|»» outlines|string|false|read-only|Outlines|none|
|»» chapters_status|string|false|read-only|Chapters status|none|
|»» comments_by_time|string|false|read-only|Comments by time|none|
|»» comments_by_hot|string|false|read-only|Comments by hot|none|
|»» rating_details|string|false|read-only|Rating details|none|
|» status|string|true|none||none|

<a id="opIdgameworks_gameworks_delete"></a>

## DELETE gameworks_gameworks_delete

DELETE /gameworks/gameworks/{id}/

游戏作品视图集：
- 已发布作品对所有人可见
- 未发布作品仅作者和管理员可见
- 自动统计收藏数、评分数、阅读数、平均评分
- 返回字段包括是否被当前用户收藏

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

<a id="opIdgameworks_hot-leaderboard_list"></a>

## GET 作品热度排行榜

GET /gameworks/hot-leaderboard/

返回热度最高的10部作品，热度计算公式：
热度 = 回复数 × 2 + 收藏数 × 1
可通过 ?range=total|month|week 指定时间范围，默认 total（总榜）

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|range|query|string| 否 |排行榜时间范围，可选 total, month, week|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<a id="opIdgameworks_publish"></a>

## POST 发布作品

POST /gameworks/publish/{id}/

作品发布前对作者和管理员以外不可见。

> Body 请求参数

```json
{
  "price": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|object| 是 |none|
|» price|body|integer| 否 |作品价格（积分）|

> 返回示例

> 200 Response

```json
[
  {
    "id": 0,
    "author": "string",
    "title": "string",
    "description": "string",
    "tags": [
      0
    ],
    "image_url": "string",
    "is_published": true,
    "published_at": "2019-08-24T14:15:22Z",
    "favorite_count": "string",
    "average_score": "string",
    "read_count": "string",
    "is_favorited": "string",
    "price": -9223372036854776000,
    "hot_score": "string"
  }
]
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|作品已成功发布|Inline|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|您没有权限发布该作品|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|作品未找到|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|*anonymous*|[[GameworkSimple](#schemagameworksimple)]|false|none||none|
|» id|integer|false|read-only|ID|none|
|» author|string|false|read-only|Author|none|
|» title|string|false|none|Title|none|
|» description|string¦null|false|none|Description|none|
|» tags|[integer]|false|read-only||none|
|» image_url|string|false|read-only|Image url|none|
|» is_published|boolean|false|none|Is published|none|
|» published_at|string(date-time)¦null|false|none|Published at|none|
|» favorite_count|string|false|read-only|Favorite count|none|
|» average_score|string|false|read-only|Average score|none|
|» read_count|string|false|read-only|Read count|none|
|» is_favorited|string|false|read-only|Is favorited|none|
|» price|integer|false|none|Price|none|
|» hot_score|string|false|read-only|Hot score|none|

<a id="opIdgameworks_rating-leaderboard_list"></a>

## GET 作品排行榜（评分）

GET /gameworks/rating-leaderboard/

返回平均分最高的10部作品，降序排列

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<a id="opIdgameworks_recommend_list"></a>

## GET 推荐作品

GET /gameworks/recommend/

根据当前用户喜欢的标签推荐作品。

推荐依据：用户的 liked_tags 与作品的 tags 标签匹配数量。
不推荐用户自己创作的作品。

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
[
  {
    "id": 0,
    "author": "string",
    "title": "string",
    "description": "string",
    "tags": [
      0
    ],
    "image_url": "string",
    "is_published": true,
    "published_at": "2019-08-24T14:15:22Z",
    "favorite_count": "string",
    "average_score": "string",
    "read_count": "string",
    "is_favorited": "string",
    "price": -9223372036854776000,
    "hot_score": "string"
  }
]
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|推荐结果|Inline|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|用户未设置喜欢的标签|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|*anonymous*|[[GameworkSimple](#schemagameworksimple)]|false|none||none|
|» id|integer|false|read-only|ID|none|
|» author|string|false|read-only|Author|none|
|» title|string|false|none|Title|none|
|» description|string¦null|false|none|Description|none|
|» tags|[integer]|false|read-only||none|
|» image_url|string|false|read-only|Image url|none|
|» is_published|boolean|false|none|Is published|none|
|» published_at|string(date-time)¦null|false|none|Published at|none|
|» favorite_count|string|false|read-only|Favorite count|none|
|» average_score|string|false|read-only|Average score|none|
|» read_count|string|false|read-only|Read count|none|
|» is_favorited|string|false|read-only|Is favorited|none|
|» price|integer|false|none|Price|none|
|» hot_score|string|false|read-only|Hot score|none|

<a id="opIdgameworks_search_list"></a>

## GET 搜索作品

GET /gameworks/search/

根据关键词、作者名或标签搜索作品。

示例：`/api/gameworks/search/?q=冒险&author=Alice&tag=3`

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|
|q|query|string| 否 |关键词（标题或简介匹配）|
|author|query|string| 否 |作者用户名|
|tag|query|string| 否 |标签 ID 或标签名|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "message": "搜索成功",
  "data": [
    {
      "id": 1,
      "title": "冒险之旅",
      "author": "Alice",
      "tags": [
        "冒险",
        "RPG"
      ]
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|搜索成功|Inline|

### 返回数据结构

<a id="opIdgameworks_unpublish"></a>

## POST 取消发布作品

POST /gameworks/unpublish/{id}/

将作品标记为未发布。未发布的作品只对作者本人和管理员可见。

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "is_published": true,
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "hot_score": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|作品已成功取消发布|[GameworkSimple](#schemagameworksimple)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|您没有权限取消发布该作品|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|作品未找到|None|

# interactions

<a id="opIdinteractions_comments_list"></a>

## GET 获取评论列表（分页顶级评论+嵌套回复）

GET /interactions/comments/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|
|gamework|query|integer| 否 |按作品ID筛选评论|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "user": "string",
      "profile_picture": "string",
      "content": "string",
      "gamework": 0,
      "created_at": "2019-08-24T14:15:22Z",
      "replies": [
        {}
      ],
      "parent": 0,
      "like_count": "string",
      "is_liked": "string"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[Comment](#schemacomment)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» user|string|false|read-only|User|none|
|»» profile_picture|string|false|read-only|Profile picture|none|
|»» content|string|true|none|Content|none|
|»» gamework|integer|true|none|Gamework|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|
|»» replies|[[RecursiveField](#schemarecursivefield)]|false|read-only||none|
|»» parent|integer¦null|false|none|Parent|none|
|»» like_count|string|false|read-only|Like count|none|
|»» is_liked|string|false|read-only|Is liked|none|

<a id="opIdinteractions_comments_create"></a>

## POST 发表评论或回复

POST /interactions/comments/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

> Body 请求参数

```json
{
  "content": "string",
  "gamework": 0,
  "parent": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[Comment](#schemacomment)| 是 |none|

> 返回示例

> 201 Response

```json
{
  "code": 0,
  "message": "string",
  "data": {
    "id": 0,
    "user": "string",
    "profile_picture": "string",
    "content": "string",
    "gamework": 0,
    "created_at": "2019-08-24T14:15:22Z",
    "replies": [
      {}
    ],
    "parent": 0,
    "like_count": "string",
    "is_liked": "string"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

### 返回数据结构

状态码 **201**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» message|string|true|none||none|
|» data|[Comment](#schemacomment)|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» user|string|false|read-only|User|none|
|»» profile_picture|string|false|read-only|Profile picture|none|
|»» content|string|true|none|Content|none|
|»» gamework|integer|true|none|Gamework|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|
|»» replies|[[RecursiveField](#schemarecursivefield)]|false|read-only||none|
|»» parent|integer¦null|false|none|Parent|none|
|»» like_count|string|false|read-only|Like count|none|
|»» is_liked|string|false|read-only|Is liked|none|

<a id="opIdinteractions_comments_read"></a>

## GET interactions_comments_read

GET /interactions/comments/{id}/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "user": "string",
  "profile_picture": "string",
  "content": "string",
  "gamework": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "replies": [
    {}
  ],
  "parent": 0,
  "like_count": "string",
  "is_liked": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Comment](#schemacomment)|

<a id="opIdinteractions_comments_delete"></a>

## DELETE 删除评论（用户只能删除自己的评论，作者可删除本书评论。管理员可删除所有评论）

DELETE /interactions/comments/{id}/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权限删除该评论|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|评论不存在|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» message|string|true|none||none|

<a id="opIdinteractions_comments_like"></a>

## POST 点赞评论

POST /interactions/comments/{id}/like/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string",
  "data": {
    "liked": true,
    "like_count": 0
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» data|object|false|none||none|
|»» liked|boolean|false|none||none|
|»» like_count|integer|false|none||none|

<a id="opIdinteractions_comments_unlike"></a>

## POST 取消点赞评论

POST /interactions/comments/{id}/unlike/

用户评论作品接口
- GET: 获取评论列表（可筛选 gamework）
- POST: 评论作品或回复
- DELETE: 删除评论

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string",
  "data": {
    "liked": true,
    "like_count": 0
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» data|object|false|none||none|
|»» liked|boolean|false|none||none|
|»» like_count|integer|false|none||none|

<a id="opIdinteractions_favorite-folders_list"></a>

## GET interactions_favorite-folders_list

GET /interactions/favorite-folders/

收藏夹管理接口
- GET: 获取收藏夹列表
- POST: 创建收藏夹
- PATCH: 修改收藏夹名称
- DELETE: 删除收藏夹

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "name": "string",
      "favorites_count": 0,
      "created_at": "2019-08-24T14:15:22Z"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[FavoriteFolder](#schemafavoritefolder)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» name|string|false|none|Name|none|
|»» favorites_count|integer|false|read-only|Favorites count|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|

<a id="opIdinteractions_favorite-folders_create"></a>

## POST 创建收藏夹

POST /interactions/favorite-folders/

创建收藏夹

> Body 请求参数

```json
{
  "name": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» name|body|string| 否 |收藏夹名称，可为空，系统自动命名|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|收藏夹创建成功|None|

<a id="opIdinteractions_favorite-folders_read"></a>

## GET interactions_favorite-folders_read

GET /interactions/favorite-folders/{id}/

收藏夹管理接口
- GET: 获取收藏夹列表
- POST: 创建收藏夹
- PATCH: 修改收藏夹名称
- DELETE: 删除收藏夹

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "name": "string",
  "favorites_count": 0,
  "created_at": "2019-08-24T14:15:22Z"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[FavoriteFolder](#schemafavoritefolder)|

<a id="opIdinteractions_favorite-folders_partial_update"></a>

## PATCH interactions_favorite-folders_partial_update

PATCH /interactions/favorite-folders/{id}/

收藏夹管理接口
- GET: 获取收藏夹列表
- POST: 创建收藏夹
- PATCH: 修改收藏夹名称
- DELETE: 删除收藏夹

> Body 请求参数

```json
{
  "name": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|[FavoriteFolder](#schemafavoritefolder)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "name": "string",
  "favorites_count": 0,
  "created_at": "2019-08-24T14:15:22Z"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[FavoriteFolder](#schemafavoritefolder)|

<a id="opIdinteractions_favorite-folders_delete"></a>

## DELETE 删除收藏夹

DELETE /interactions/favorite-folders/{id}/

删除收藏夹，作品自动转为未分组

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|收藏夹删除成功，作品转为未分组|None|

<a id="opIdinteractions_favorites_list"></a>

## GET 获取收藏列表（支持按作品标题和收藏夹筛选）

GET /interactions/favorites/

用户收藏作品接口
- GET: 获取当前用户收藏列表
- POST: 收藏作品（传入 id 与可选收藏夹）
- PATCH: 移动收藏到其他收藏夹
- DELETE: 取消收藏

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|search|query|string| 否 |按作品标题模糊搜索收藏|
|page|query|integer| 否 |A page number within the paginated result set.|
|folder|query|string| 否 |筛选所属收藏夹ID（send empty value或为 null 显示未分组，不传显示全部）|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "user": "string",
      "gamework_id": 0,
      "gamework_detail": "string",
      "folder": 0,
      "created_at": "2019-08-24T14:15:22Z"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[Favorite](#schemafavorite)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» user|string|false|read-only|User|none|
|»» gamework_id|integer|true|none|Gamework id|none|
|»» gamework_detail|string|false|read-only|Gamework detail|none|
|»» folder|integer¦null|false|none|Folder|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|

<a id="opIdinteractions_favorites_create"></a>

## POST 收藏作品

POST /interactions/favorites/

用户收藏作品接口
- GET: 获取当前用户收藏列表
- POST: 收藏作品（传入 id 与可选收藏夹）
- PATCH: 移动收藏到其他收藏夹
- DELETE: 取消收藏

> Body 请求参数

```json
{
  "gamework_id": 0,
  "folder": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» gamework_id|body|integer| 否 |作品ID|
|» folder|body|integer| 否 |收藏夹ID，可选|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|收藏成功|None|

<a id="opIdinteractions_favorites_move_to_folder"></a>

## POST 批量移动收藏到指定收藏夹

POST /interactions/favorites/move_to_folder/

用户收藏作品接口
- GET: 获取当前用户收藏列表
- POST: 收藏作品（传入 id 与可选收藏夹）
- PATCH: 移动收藏到其他收藏夹
- DELETE: 取消收藏

> Body 请求参数

```json
{
  "favorite_ids": [
    0
  ],
  "folder": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» favorite_ids|body|[integer]| 是 |要移动的收藏记录ID列表|
|» folder|body|integer| 否 |目标收藏夹ID，可为空（移出收藏夹）|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string",
  "data": [
    {}
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|批量移动成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» data|[object]|false|none||none|

<a id="opIdinteractions_favorites_read"></a>

## GET interactions_favorites_read

GET /interactions/favorites/{id}/

用户收藏作品接口
- GET: 获取当前用户收藏列表
- POST: 收藏作品（传入 id 与可选收藏夹）
- PATCH: 移动收藏到其他收藏夹
- DELETE: 取消收藏

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "user": "string",
  "gamework_id": 0,
  "gamework_detail": "string",
  "folder": 0,
  "created_at": "2019-08-24T14:15:22Z"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Favorite](#schemafavorite)|

<a id="opIdinteractions_favorites_delete"></a>

## DELETE 取消收藏

DELETE /interactions/favorites/{id}/

用户收藏作品接口
- GET: 获取当前用户收藏列表
- POST: 收藏作品（传入 id 与可选收藏夹）
- PATCH: 移动收藏到其他收藏夹
- DELETE: 取消收藏

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|integer| 是 |当前作品 ID|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|取消收藏成功|None|

<a id="opIdinteractions_ratings_list"></a>

## GET interactions_ratings_list

GET /interactions/ratings/

用户评分作品接口
- GET: 获取评分列表
- POST: 为作品评分

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "user": "string",
      "score": 2,
      "gamework_detail": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[Rating](#schemarating)]|true|none||none|
|»» id|integer|true|none|Id|none|
|»» user|string|false|read-only|User|none|
|»» score|integer|true|none|Score|none|
|»» gamework_detail|string|false|read-only|Gamework detail|none|
|»» created_at|string(date-time)|false|read-only|Created at|none|
|»» updated_at|string(date-time)|false|read-only|Updated at|none|

<a id="opIdinteractions_ratings_create"></a>

## POST 为作品评分

POST /interactions/ratings/

用户评分作品接口
- GET: 获取评分列表
- POST: 为作品评分

> Body 请求参数

```json
{
  "id": 0,
  "score": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» id|body|integer| 是 |作品ID|
|» score|body|integer| 是 |评分（2~10）|

> 返回示例

> 201 Response

```json
{
  "id": 0,
  "score": 0
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

### 返回数据结构

状态码 **201**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» id|integer|true|none||作品ID|
|» score|integer|true|none||评分（2~10）|

<a id="opIdinteractions_ratings_read"></a>

## GET interactions_ratings_read

GET /interactions/ratings/{id}/

用户评分作品接口
- GET: 获取评分列表
- POST: 为作品评分

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "user": "string",
  "score": 2,
  "gamework_detail": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Rating](#schemarating)|

<a id="opIdinteractions_ratings_delete"></a>

## DELETE interactions_ratings_delete

DELETE /interactions/ratings/{id}/

用户评分作品接口
- GET: 获取评分列表
- POST: 为作品评分

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

# settlement

<a id="opIdsettlement_report_create"></a>

## POST 生成结算报告候选 variants

POST /settlement/report/{workId}/

后端返回满足业务的所有候选报告，前端根据 attributes/statuses 自行匹配。

> Body 请求参数

```json
{
  "attributes": {},
  "statuses": {}
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|workId|path|string| 是 |none|
|body|body|[SettlementRequest](#schemasettlementrequest)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "success": true,
  "reports": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "minAttributes": {
        "property1": 0,
        "property2": 0
      },
      "requiredStatuses": [
        "string"
      ],
      "report": {
        "title": "string",
        "content": "string",
        "traits": [
          "string"
        ],
        "scores": {
          "property1": 0,
          "property2": 0
        }
      }
    }
  ],
  "debug": {
    "property1": "string",
    "property2": "string"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[SettlementResponse](#schemasettlementresponse)|

# tags

<a id="opIdtags_list"></a>

## GET tags_list

GET /tags/

标签的CRUD接口

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "name": "string"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[Tag](#schematag)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» name|string|true|none|Name|none|

<a id="opIdtags_create"></a>

## POST tags_create

POST /tags/

标签的CRUD接口

> Body 请求参数

```json
{
  "name": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[Tag](#schematag)| 是 |none|

> 返回示例

> 201 Response

```json
{
  "id": 0,
  "name": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|[Tag](#schematag)|

<a id="opIdtags_read"></a>

## GET tags_read

GET /tags/{id}/

标签的CRUD接口

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "name": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Tag](#schematag)|

<a id="opIdtags_update"></a>

## PUT tags_update

PUT /tags/{id}/

标签的CRUD接口

> Body 请求参数

```json
{
  "name": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|[Tag](#schematag)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "name": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Tag](#schematag)|

<a id="opIdtags_partial_update"></a>

## PATCH tags_partial_update

PATCH /tags/{id}/

标签的CRUD接口

> Body 请求参数

```json
{
  "name": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|[Tag](#schematag)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "name": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[Tag](#schematag)|

<a id="opIdtags_delete"></a>

## DELETE tags_delete

DELETE /tags/{id}/

标签的CRUD接口

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

# users

<a id="opIdusers_admin_list"></a>

## GET users_admin_list

GET /users/admin/

查看用户列表
普通用户只能看到自己，管理员可以看到所有用户

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "username": "string",
      "profile_picture": "http://example.com",
      "user_credits": 0,
      "gender": "Male",
      "liked_tags": [
        0
      ],
      "is_staff": true
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[User](#schemauser)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» username|string|true|none|Username|none|
|»» profile_picture|string(uri)¦null|false|none|Profile picture|none|
|»» user_credits|integer¦null|false|read-only|User credits|none|
|»» gender|string¦null|false|none|Gender|none|
|»» liked_tags|[integer]|false|none||none|
|»» is_staff|boolean|false|read-only|Is staff|none|

#### 枚举值

|属性|值|
|---|---|
|gender|Male|
|gender|Female|
|gender|Other|

<a id="opIdusers_admin_read"></a>

## GET users_admin_read

GET /users/admin/{id}/

查看用户详情
普通用户只能查看自己的详情，管理员可以查看任何用户

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "username": "string",
  "profile_picture": "http://example.com",
  "user_credits": 0,
  "gender": "Male",
  "liked_tags": [
    0
  ],
  "is_staff": true
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[User](#schemauser)|

<a id="opIdusers_admin_update"></a>

## PUT users_admin_update

PUT /users/admin/{id}/

禁止用户修改他人资料

> Body 请求参数

```json
{
  "username": "string",
  "profile_picture": "http://example.com",
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|[User](#schemauser)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "username": "string",
  "profile_picture": "http://example.com",
  "user_credits": 0,
  "gender": "Male",
  "liked_tags": [
    0
  ],
  "is_staff": true
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[User](#schemauser)|

<a id="opIdusers_admin_partial_update"></a>

## PATCH users_admin_partial_update

PATCH /users/admin/{id}/

禁止用户部分修改他人资料

> Body 请求参数

```json
{
  "username": "string",
  "profile_picture": "http://example.com",
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|
|body|body|[User](#schemauser)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "username": "string",
  "profile_picture": "http://example.com",
  "user_credits": 0,
  "gender": "Male",
  "liked_tags": [
    0
  ],
  "is_staff": true
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[User](#schemauser)|

<a id="opIdusers_admin_delete"></a>

## DELETE users_admin_delete

DELETE /users/admin/{id}/

删除用户
普通用户只能删除自己，管理员可以删除任何用户

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

<a id="opIdusers_creditlog_list"></a>

## GET 获取用户积分流水

GET /users/creditlog/

返回当前登录用户所有积分变动记录（积分增加、减少、任务奖励、消费扣减等）

> 返回示例

> 200 Response

```json
[
  {
    "change_amount": -9223372036854776000,
    "before_balance": -9223372036854776000,
    "after_balance": -9223372036854776000,
    "type": "recharge",
    "remark": "string",
    "created_at": "2019-08-24T14:15:22Z"
  }
]
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|积分流水列表|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|*anonymous*|[[CreditLog](#schemacreditlog)]|false|none||none|
|» change_amount|integer|true|none|Change amount|none|
|» before_balance|integer|true|none|Before balance|none|
|» after_balance|integer|true|none|After balance|none|
|» type|string|true|none|Type|none|
|» remark|string¦null|false|none|Remark|none|
|» created_at|string(date-time)|false|read-only|Created at|none|

#### 枚举值

|属性|值|
|---|---|
|type|recharge|
|type|reward|
|type|read_pay|
|type|manual|
|type|reward_out|
|type|reward_in|

<a id="opIdusers_myworks_list"></a>

## GET 获取当前用户创作的作品列表

GET /users/myworks/

返回当前登录用户创作的作品列表
GET /api/users/myworks/

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "is_published": true,
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "hot_score": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|当前用户创作的作品列表|[GameworkSimple](#schemagameworksimple)|

<a id="opIdusers_myworks_recent_list"></a>

## GET 获取当前用户最近创作的两部作品

GET /users/myworks/recent/

返回当前用户最近创作的两部作品
GET /api/users/my-works/recent/

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "is_published": true,
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "hot_score": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|最近两部创作的作品|[GameworkSimple](#schemagameworksimple)|

<a id="opIdusers_preferences_read"></a>

## GET users_preferences_read

GET /users/preferences/

> 返回示例

> 200 Response

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[UserPreference](#schemauserpreference)|

<a id="opIdusers_preferences_update"></a>

## PUT users_preferences_update

PUT /users/preferences/

> Body 请求参数

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[UserPreference](#schemauserpreference)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[UserPreference](#schemauserpreference)|

<a id="opIdusers_preferences_partial_update"></a>

## PATCH users_preferences_partial_update

PATCH /users/preferences/

> Body 请求参数

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[UserPreference](#schemauserpreference)| 是 |none|

> 返回示例

> 200 Response

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[UserPreference](#schemauserpreference)|

<a id="opIdusers_read_list"></a>

## GET 获取当前用户读过的作品

GET /users/read/

获取、记录或删除当前用户读过的作品

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "data": [
    {}
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|作品列表|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» data|[object]|false|none||none|

<a id="opIdusers_read_create"></a>

## POST 记录用户阅读作品

POST /users/read/

获取、记录或删除当前用户读过的作品

> Body 请求参数

```json
{
  "gamework_id": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» gamework_id|body|integer| 是 |作品ID|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|记录成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|

<a id="opIdusers_read_delete"></a>

## DELETE 隐藏当前用户读过的作品记录

DELETE /users/read/

获取、记录或删除当前用户读过的作品

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|gamework_ids_param|query|integer| 否 |要删除的作品ID列表，不传则删除所有|

> 返回示例

> 200 Response

```json
{
  "code": 0,
  "message": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|删除成功|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|

<a id="opIdusers_read_recent_list"></a>

## GET 获取最近两部读过的作品

GET /users/read/recent/

获取当前用户最近读过的两部作品
路径：GET /api/users/read/recent/

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "is_published": true,
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "hot_score": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|返回最近两部用户读过的作品|[GameworkSimple](#schemagameworksimple)|

<a id="opIdusers_recharge_create"></a>

## POST 积分充值

POST /users/recharge/

> Body 请求参数

```json
{
  "credits": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» credits|body|integer| 是 |充值积分数量|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "message": "充值成功",
  "new_credits": 500
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|充值成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|参数错误|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» new_credits|integer|false|none||none|

<a id="opIdusers_report_gamework_list"></a>

## GET users_report_gamework_list

GET /users/report/gamework/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "reporter": "string",
      "gamework": 0,
      "gamework_title": "string",
      "tag": "string",
      "remark": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "is_resolved": true
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[GameworkReport](#schemagameworkreport)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» reporter|string|false|read-only|Reporter|none|
|»» gamework|integer|true|none|被举报作品|none|
|»» gamework_title|string|false|read-only|Gamework title|none|
|»» tag|string|true|none|违规标签|none|
|»» remark|string|false|none|备注|none|
|»» created_at|string(date-time)|false|read-only|举报时间|none|
|»» is_resolved|boolean|false|read-only|Is resolved|none|

<a id="opIdusers_report_gamework_create"></a>

## POST 举报作品

POST /users/report/gamework/

> Body 请求参数

```json
{
  "gamework": 0,
  "tag": "string",
  "remark": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[GameworkReport](#schemagameworkreport)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|举报成功|None|

<a id="opIdusers_reports_comments_list"></a>

## GET users_reports_comments_list

GET /users/reports/comments/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|page|query|integer| 否 |A page number within the paginated result set.|

> 返回示例

> 200 Response

```json
{
  "count": 0,
  "next": "http://example.com",
  "previous": "http://example.com",
  "results": [
    {
      "id": 0,
      "reporter": "string",
      "comment": 0,
      "comment_content": "string",
      "tag": "string",
      "remark": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "is_resolved": true,
      "gamework": "string"
    }
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» count|integer|true|none||none|
|» next|string(uri)¦null|false|none||none|
|» previous|string(uri)¦null|false|none||none|
|» results|[[CommentReport](#schemacommentreport)]|true|none||none|
|»» id|integer|false|read-only|ID|none|
|»» reporter|string|false|read-only|Reporter|none|
|»» comment|integer|true|none|被举报评论|none|
|»» comment_content|string|false|read-only|Comment content|none|
|»» tag|string|true|none|违规标签|none|
|»» remark|string|false|none|备注|none|
|»» created_at|string(date-time)|false|read-only|举报时间|none|
|»» is_resolved|boolean|false|read-only|Is resolved|none|
|»» gamework|string|false|read-only|Gamework|none|

<a id="opIdusers_reports_comments_create"></a>

## POST 举报评论

POST /users/reports/comments/

> Body 请求参数

```json
{
  "comment": 0,
  "tag": "string",
  "remark": "string"
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|[CommentReport](#schemacommentreport)| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|举报成功|None|

<a id="opIdusers_reward_create"></a>

## POST 打赏作品作者

POST /users/reward/

> Body 请求参数

```json
{
  "gamework_id": 0,
  "amount": 0
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|body|body|object| 是 |none|
|» gamework_id|body|integer| 否 |被打赏的作品ID|
|» amount|body|integer| 是 |打赏金额 (整数 > 0)|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "message": "打赏成功",
  "amount": 20,
  "author": "作者用户名"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|打赏成功|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|积分不足 或 金额非法|None|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|false|none||none|
|» message|string|false|none||none|
|» amount|integer|false|none||none|
|» author|string|false|none||none|

<a id="opIdusers_signin_list"></a>

## GET 获取用户所有签到日期

GET /users/signin/

> 返回示例

> 200 Response

```json
{
  "dates": [
    "2019-08-24"
  ]
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|返回签到日期列表|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» dates|[string]|false|none||签到日期列表（倒序）|

<a id="opIdusers_signin_create"></a>

## POST 用户签到

POST /users/signin/

用户每日签到接口。

功能：
- 判断今日是否已经签到
- 自动计算连续签到天数（断签重置为1）
- 根据连续天数发放积分（1~7天循环）
- 更新用户积分 user_credits

> 返回示例

> 200 Response

```json
{
  "message": "string",
  "continuous_days": 0,
  "reward": 0,
  "credits": 0
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|签到成功 / 今日已签到|Inline|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|未登录或 token 无效|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» message|string|false|none||签到结果提示|
|» continuous_days|integer|false|none||连续签到天数|
|» reward|integer|false|none||本次获取积分|
|» credits|integer|false|none||当前用户积分|

状态码 **401**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» detail|string|false|none||错误信息|

<a id="opIdusers_reports_comments_read"></a>

## GET 获取评论举报详情

GET /users/reports/comments/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "reporter": "string",
  "comment": 0,
  "comment_content": "string",
  "tag": "string",
  "remark": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "is_resolved": true,
  "gamework": "string"
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[CommentReport](#schemacommentreport)|

<a id="opIdusers_reports_comments_partial_update"></a>

## PATCH 处理评论举报（仅管理员）

PATCH /users/reports/comments/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|处理完成|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权限|None|

<a id="opIdusers_reports_comments_delete"></a>

## DELETE 删除举报记录（仅管理员）

DELETE /users/reports/comments/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

<a id="opIdusers_saves_read"></a>

## GET 读取存档

GET /users/{userId}/saves/{workId}/{slot}/

存档详情：PUT 保存/更新；GET 读取；DELETE 删除
路径：
  - PUT    /api/users/:userId/saves/:workId/:slot
  - GET    /api/users/:userId/saves/:workId/:slot
  - DELETE /api/users/:userId/saves/:workId/:slot

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|path|string| 是 |none|
|workId|path|string| 是 |none|
|slot|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"data": {...}}|None|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|未找到|None|

<a id="opIdusers_saves_update"></a>

## PUT 保存或更新存档

PUT /users/{userId}/saves/{workId}/{slot}/

存档详情：PUT 保存/更新；GET 读取；DELETE 删除
路径：
  - PUT    /api/users/:userId/saves/:workId/:slot
  - GET    /api/users/:userId/saves/:workId/:slot
  - DELETE /api/users/:userId/saves/:workId/:slot

> Body 请求参数

```json
{
  "data": {}
}
```

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|path|string| 是 |none|
|workId|path|string| 是 |none|
|slot|path|string| 是 |none|
|body|body|object| 是 |none|
|» data|body|object| 是 |需持久化的完整存档对象|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|

<a id="opIdusers_saves_delete"></a>

## DELETE 删除存档

DELETE /users/{userId}/saves/{workId}/{slot}/

存档详情：PUT 保存/更新；GET 读取；DELETE 删除
路径：
  - PUT    /api/users/:userId/saves/:workId/:slot
  - GET    /api/users/:userId/saves/:workId/:slot
  - DELETE /api/users/:userId/saves/:workId/:slot

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|userId|path|string| 是 |none|
|workId|path|string| 是 |none|
|slot|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|{"ok": true}|None|

<a id="opIdusers_reports_gameworks_read"></a>

## GET 获取作品举报详情

GET /users/reports/gameworks/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

> 返回示例

> 200 Response

```json
{
  "id": 0,
  "reporter": "string",
  "gamework": 0,
  "gamework_title": "string",
  "tag": "string",
  "remark": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "is_resolved": true
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|[GameworkReport](#schemagameworkreport)|

<a id="opIdusers_reports_gameworks_partial_update"></a>

## PATCH 处理作品举报（仅管理员）

PATCH /users/reports/gameworks/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|处理完成|None|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|无权限|None|

<a id="opIdusers_reports_gameworks_delete"></a>

## DELETE 删除举报记录（仅管理员）

DELETE /users/reports/gameworks/{id}/

### 请求参数

|名称|位置|类型|必选|说明|
|---|---|---|---|---|
|id|path|string| 是 |none|

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

# 数据模型

<h2 id="tocS_Login">Login</h2>

<a id="schemalogin"></a>
<a id="schema_Login"></a>
<a id="tocSlogin"></a>
<a id="tocslogin"></a>

```json
{
  "username": "string",
  "password": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|username|string|true|none|Username|none|
|password|string|true|none|Password|none|

<h2 id="tocS_Logout">Logout</h2>

<a id="schemalogout"></a>
<a id="schema_Logout"></a>
<a id="tocSlogout"></a>
<a id="tocslogout"></a>

```json
{
  "refresh": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|refresh|string|true|none|Refresh|none|

<h2 id="tocS_Register">Register</h2>

<a id="schemaregister"></a>
<a id="schema_Register"></a>
<a id="tocSregister"></a>
<a id="tocsregister"></a>

```json
{
  "username": "string",
  "password": "string",
  "confirm_password": "string",
  "email": "user@example.com",
  "email_code": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|username|string|true|none|Username|none|
|password|string|true|none|Password|none|
|confirm_password|string|true|none|Confirm password|none|
|email|string(email)|true|none|Email|none|
|email_code|string|true|none|Email code|none|

<h2 id="tocS_TokenObtainPair">TokenObtainPair</h2>

<a id="schematokenobtainpair"></a>
<a id="schema_TokenObtainPair"></a>
<a id="tocStokenobtainpair"></a>
<a id="tocstokenobtainpair"></a>

```json
{
  "username": "string",
  "password": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|username|string|true|none|Username|none|
|password|string|true|none|Password|none|

<h2 id="tocS_TokenRefresh">TokenRefresh</h2>

<a id="schematokenrefresh"></a>
<a id="schema_TokenRefresh"></a>
<a id="tocStokenrefresh"></a>
<a id="tocstokenrefresh"></a>

```json
{
  "refresh": "string",
  "access": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|refresh|string|true|none|Refresh|none|
|access|string|false|read-only|Access|none|

<h2 id="tocS_ChapterOutline">ChapterOutline</h2>

<a id="schemachapteroutline"></a>
<a id="schema_ChapterOutline"></a>
<a id="tocSchapteroutline"></a>
<a id="tocschapteroutline"></a>

```json
{
  "chapterIndex": 0,
  "title": "string",
  "outline": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|chapterIndex|integer|true|none|Chapterindex|none|
|title|string|false|none|Title|none|
|outline|string|true|none|Outline|none|

<h2 id="tocS_ChapterGenerate">ChapterGenerate</h2>

<a id="schemachaptergenerate"></a>
<a id="schema_ChapterGenerate"></a>
<a id="tocSchaptergenerate"></a>
<a id="tocschaptergenerate"></a>

```json
{
  "chapterOutlines": [
    {
      "chapterIndex": 0,
      "title": "string",
      "outline": "string"
    }
  ],
  "userPrompt": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|chapterOutlines|[[ChapterOutline](#schemachapteroutline)]|true|none||none|
|userPrompt|string|false|none|Userprompt|none|

<h2 id="tocS_GameChapterProgress">GameChapterProgress</h2>

<a id="schemagamechapterprogress"></a>
<a id="schema_GameChapterProgress"></a>
<a id="tocSgamechapterprogress"></a>
<a id="tocsgamechapterprogress"></a>

```json
{
  "currentChapter": 0,
  "totalChapters": 0
}

```

生成进度(仅在generating时返回)

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|currentChapter|integer|true|none|Currentchapter|none|
|totalChapters|integer|true|none|Totalchapters|none|

<h2 id="tocS_GameChapterChoice">GameChapterChoice</h2>

<a id="schemagamechapterchoice"></a>
<a id="schema_GameChapterChoice"></a>
<a id="tocSgamechapterchoice"></a>
<a id="tocsgamechapterchoice"></a>

```json
{
  "choiceId": 0,
  "text": "string",
  "attributesDelta": {},
  "statusesDelta": {},
  "subsequentDialogues": [
    "string"
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|choiceId|integer|true|none|Choiceid|none|
|text|string|true|none|Text|none|
|attributesDelta|object¦null|false|none|Attributesdelta|none|
|» **additionalProperties**|integer|false|none||none|
|statusesDelta|object¦null|false|none|Statusesdelta|none|
|» **additionalProperties**|object|false|none||none|
|subsequentDialogues|[string]¦null|false|none||none|

<h2 id="tocS_GameChapterDialogue">GameChapterDialogue</h2>

<a id="schemagamechapterdialogue"></a>
<a id="schema_GameChapterDialogue"></a>
<a id="tocSgamechapterdialogue"></a>
<a id="tocsgamechapterdialogue"></a>

```json
{
  "narration": "string",
  "playerChoices": [
    {
      "choiceId": 0,
      "text": "string",
      "attributesDelta": {},
      "statusesDelta": {},
      "subsequentDialogues": [
        "string"
      ]
    }
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|narration|string|true|none|Narration|none|
|playerChoices|[[GameChapterChoice](#schemagamechapterchoice)]¦null|false|none||none|

<h2 id="tocS_GameChapterScene">GameChapterScene</h2>

<a id="schemagamechapterscene"></a>
<a id="schema_GameChapterScene"></a>
<a id="tocSgamechapterscene"></a>
<a id="tocsgamechapterscene"></a>

```json
{
  "id": 0,
  "backgroundImage": "string",
  "dialogues": [
    {
      "narration": "string",
      "playerChoices": [
        {
          "choiceId": 0,
          "text": "string",
          "attributesDelta": {},
          "statusesDelta": {},
          "subsequentDialogues": [
            "string"
          ]
        }
      ]
    }
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|true|none|Id|none|
|backgroundImage|string|true|none|Backgroundimage|none|
|dialogues|[[GameChapterDialogue](#schemagamechapterdialogue)]|true|none||none|

<h2 id="tocS_GameChapterResponse">GameChapterResponse</h2>

<a id="schemagamechapterresponse"></a>
<a id="schema_GameChapterResponse"></a>
<a id="tocSgamechapterresponse"></a>
<a id="tocsgamechapterresponse"></a>

```json
{
  "chapterIndex": 0,
  "title": "string",
  "scenes": [
    {
      "id": 0,
      "backgroundImage": "string",
      "dialogues": [
        {
          "narration": "string",
          "playerChoices": [
            {}
          ]
        }
      ]
    }
  ]
}

```

章节内容(仅在ready时返回)

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|chapterIndex|integer|true|none|Chapterindex|none|
|title|string|true|none|Title|none|
|scenes|[[GameChapterScene](#schemagamechapterscene)]|true|none||none|

<h2 id="tocS_GameChapterStatusResponse">GameChapterStatusResponse</h2>

<a id="schemagamechapterstatusresponse"></a>
<a id="schema_GameChapterStatusResponse"></a>
<a id="tocSgamechapterstatusresponse"></a>
<a id="tocsgamechapterstatusresponse"></a>

```json
{
  "status": "pending",
  "message": "string",
  "progress": {
    "currentChapter": 0,
    "totalChapters": 0
  },
  "chapter": {
    "chapterIndex": 0,
    "title": "string",
    "scenes": [
      {
        "id": 0,
        "backgroundImage": "string",
        "dialogues": [
          {
            "narration": null,
            "playerChoices": null
          }
        ]
      }
    ]
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|status|string|true|none|Status|章节状态: pending(未开始)/generating(生成中)/ready(已完成)/error(错误)|
|message|string|false|none|Message|状态说明|
|progress|[GameChapterProgress](#schemagamechapterprogress)|false|none||生成进度(仅在generating时返回)|
|chapter|[GameChapterResponse](#schemagamechapterresponse)|false|none||章节内容(仅在ready时返回)|

#### 枚举值

|属性|值|
|---|---|
|status|pending|
|status|generating|
|status|ready|
|status|error|

<h2 id="tocS_GameChapterManualUpdate">GameChapterManualUpdate</h2>

<a id="schemagamechaptermanualupdate"></a>
<a id="schema_GameChapterManualUpdate"></a>
<a id="tocSgamechaptermanualupdate"></a>
<a id="tocsgamechaptermanualupdate"></a>

```json
{
  "chapterIndex": 0,
  "title": "string",
  "scenes": [
    {
      "id": 0,
      "backgroundImage": "string",
      "dialogues": [
        {
          "narration": "string",
          "playerChoices": [
            {}
          ]
        }
      ]
    }
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|chapterIndex|integer|true|none|Chapterindex|none|
|title|string|true|none|Title|none|
|scenes|[[GameChapterScene](#schemagamechapterscene)]|true|none||none|

<h2 id="tocS_GameCreate">GameCreate</h2>

<a id="schemagamecreate"></a>
<a id="schema_GameCreate"></a>
<a id="tocSgamecreate"></a>
<a id="tocsgamecreate"></a>

```json
{
  "tags": [
    "string",
    "string",
    "string"
  ],
  "idea": "string",
  "length": "short",
  "modifiable": false
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|tags|[string]|true|none||用户选择的标签数组（3-6个）|
|idea|string|false|none|Idea|用户输入的构思文本|
|length|string|true|none|Length|篇幅类型：'short' (3-5章) / 'medium' (6-10章) / 'long' (10章以上)|
|modifiable|boolean|false|none|Modifiable|是否为创作者模式|

#### 枚举值

|属性|值|
|---|---|
|length|short|
|length|medium|
|length|long|

<h2 id="tocS_GameSaveState">GameSaveState</h2>

<a id="schemagamesavestate"></a>
<a id="schema_GameSaveState"></a>
<a id="tocSgamesavestate"></a>
<a id="tocsgamesavestate"></a>

```json
{
  "chapterIndex": 0,
  "endingIndex": 0,
  "sceneId": 0,
  "dialogueIndex": 0,
  "attributes": {},
  "statuses": {},
  "choiceHistory": []
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|chapterIndex|integer¦null|false|none|Chapterindex|none|
|endingIndex|integer¦null|false|none|Endingindex|none|
|sceneId|integer¦null|true|none|Sceneid|none|
|dialogueIndex|integer¦null|false|none|Dialogueindex|none|
|attributes|object|false|none|Attributes|none|
|» **additionalProperties**|integer|false|none||none|
|statuses|object|false|none|Statuses|none|
|» **additionalProperties**|object|false|none||none|
|choiceHistory|[object]|false|none||none|
|» **additionalProperties**|string¦null|false|none||none|

<h2 id="tocS_EndingGenerate">EndingGenerate</h2>

<a id="schemaendinggenerate"></a>
<a id="schema_EndingGenerate"></a>
<a id="tocSendinggenerate"></a>
<a id="tocsendinggenerate"></a>

```json
{
  "title": "string",
  "outline": "string",
  "userPrompt": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|title|string|true|none|Title|标题|
|outline|string|true|none|Outline|修改后的结局大纲|
|userPrompt|string|false|none|Userprompt|用户提示词|

<h2 id="tocS_GameSavePayload">GameSavePayload</h2>

<a id="schemagamesavepayload"></a>
<a id="schema_GameSavePayload"></a>
<a id="tocSgamesavepayload"></a>
<a id="tocsgamesavepayload"></a>

```json
{
  "title": "string",
  "timestamp": 0,
  "state": {
    "chapterIndex": 0,
    "endingIndex": 0,
    "sceneId": 0,
    "dialogueIndex": 0,
    "attributes": {},
    "statuses": {},
    "choiceHistory": []
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|title|string|false|none|Title|none|
|timestamp|integer¦null|false|none|Timestamp|none|
|state|[GameSaveState](#schemagamesavestate)|true|none||none|

<h2 id="tocS_SettlementRequest">SettlementRequest</h2>

<a id="schemasettlementrequest"></a>
<a id="schema_SettlementRequest"></a>
<a id="tocSsettlementrequest"></a>
<a id="tocssettlementrequest"></a>

```json
{
  "attributes": {},
  "statuses": {}
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|attributes|object|false|none|Attributes|属性字典，键为属性名，值为数值|
|» **additionalProperties**|integer|false|none||none|
|statuses|object|false|none|Statuses|状态字典，键为状态名，值可以是字符串/布尔/数值|
|» **additionalProperties**|object|false|none||none|

<h2 id="tocS_SettlementReportContent">SettlementReportContent</h2>

<a id="schemasettlementreportcontent"></a>
<a id="schema_SettlementReportContent"></a>
<a id="tocSsettlementreportcontent"></a>
<a id="tocssettlementreportcontent"></a>

```json
{
  "title": "string",
  "content": "string",
  "traits": [
    "string"
  ],
  "scores": {
    "property1": 0,
    "property2": 0
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|title|string|true|none|Title|none|
|content|string|true|none|Content|none|
|traits|[string]|false|none||none|
|scores|object|false|none|Scores|none|
|» **additionalProperties**|integer|false|none||none|

<h2 id="tocS_SettlementVariant">SettlementVariant</h2>

<a id="schemasettlementvariant"></a>
<a id="schema_SettlementVariant"></a>
<a id="tocSsettlementvariant"></a>
<a id="tocssettlementvariant"></a>

```json
{
  "id": "string",
  "title": "string",
  "summary": "string",
  "minAttributes": {
    "property1": 0,
    "property2": 0
  },
  "requiredStatuses": [
    "string"
  ],
  "report": {
    "title": "string",
    "content": "string",
    "traits": [
      "string"
    ],
    "scores": {
      "property1": 0,
      "property2": 0
    }
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|string|true|none|Id|none|
|title|string|true|none|Title|none|
|summary|string|true|none|Summary|none|
|minAttributes|object|false|none|Minattributes|none|
|» **additionalProperties**|integer|false|none||none|
|requiredStatuses|[string]|false|none||none|
|report|[SettlementReportContent](#schemasettlementreportcontent)|true|none||none|

<h2 id="tocS_SettlementResponse">SettlementResponse</h2>

<a id="schemasettlementresponse"></a>
<a id="schema_SettlementResponse"></a>
<a id="tocSsettlementresponse"></a>
<a id="tocssettlementresponse"></a>

```json
{
  "success": true,
  "reports": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "minAttributes": {
        "property1": 0,
        "property2": 0
      },
      "requiredStatuses": [
        "string"
      ],
      "report": {
        "title": "string",
        "content": "string",
        "traits": [
          "string"
        ],
        "scores": {
          "property1": 0,
          "property2": 0
        }
      }
    }
  ],
  "debug": {
    "property1": "string",
    "property2": "string"
  }
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|success|boolean|true|none|Success|none|
|reports|[[SettlementVariant](#schemasettlementvariant)]|true|none||none|
|debug|object|false|none|Debug|none|
|» **additionalProperties**|string¦null|false|none||none|

<h2 id="tocS_GameworkDetail">GameworkDetail</h2>

<a id="schemagameworkdetail"></a>
<a id="schema_GameworkDetail"></a>
<a id="tocSgameworkdetail"></a>
<a id="tocsgameworkdetail"></a>

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "background_music_urls": "string",
  "is_published": true,
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "rating_count": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "user_reward_amount": "string",
  "is_complete": "string",
  "generated_chapters": "string",
  "total_chapters": "string",
  "modifiable": "string",
  "ai_callable": "string",
  "initial_attributes": "string",
  "initial_statuses": "string",
  "outlines": "string",
  "chapters_status": "string",
  "comments_by_time": "string",
  "comments_by_hot": "string",
  "rating_details": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|author|string|false|read-only|Author|none|
|title|string|false|none|Title|none|
|description|string¦null|false|none|Description|none|
|tags|[integer]|true|none||none|
|image_url|string|false|read-only|Image url|none|
|background_music_urls|string|false|read-only|Background music urls|none|
|is_published|boolean|false|none|Is published|none|
|created_at|string(date-time)|false|read-only|Created at|none|
|updated_at|string(date-time)|false|read-only|Updated at|none|
|published_at|string(date-time)¦null|false|none|Published at|none|
|favorite_count|string|false|read-only|Favorite count|none|
|average_score|string|false|read-only|Average score|none|
|rating_count|string|false|read-only|Rating count|none|
|read_count|string|false|read-only|Read count|none|
|is_favorited|string|false|read-only|Is favorited|none|
|price|integer|false|none|Price|none|
|user_reward_amount|string|false|read-only|User reward amount|none|
|is_complete|string|false|read-only|Is complete|none|
|generated_chapters|string|false|read-only|Generated chapters|none|
|total_chapters|string|false|read-only|Total chapters|none|
|modifiable|string|false|read-only|Modifiable|none|
|ai_callable|string|false|read-only|Ai callable|none|
|initial_attributes|string|false|read-only|Initial attributes|none|
|initial_statuses|string|false|read-only|Initial statuses|none|
|outlines|string|false|read-only|Outlines|none|
|chapters_status|string|false|read-only|Chapters status|none|
|comments_by_time|string|false|read-only|Comments by time|none|
|comments_by_hot|string|false|read-only|Comments by hot|none|
|rating_details|string|false|read-only|Rating details|none|

<h2 id="tocS_GameEndingManualUpdate">GameEndingManualUpdate</h2>

<a id="schemagameendingmanualupdate"></a>
<a id="schema_GameEndingManualUpdate"></a>
<a id="tocSgameendingmanualupdate"></a>
<a id="tocsgameendingmanualupdate"></a>

```json
{
  "endingIndex": 0,
  "title": "string",
  "scenes": [
    {
      "id": 0,
      "backgroundImage": "string",
      "dialogues": [
        {
          "narration": "string",
          "playerChoices": [
            {}
          ]
        }
      ]
    }
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|endingIndex|integer|true|none|Endingindex|结局Index|
|title|string|true|none|Title|结局标题|
|scenes|[[GameChapterScene](#schemagamechapterscene)]|true|none||none|

<h2 id="tocS_GameworkSimple">GameworkSimple</h2>

<a id="schemagameworksimple"></a>
<a id="schema_GameworkSimple"></a>
<a id="tocSgameworksimple"></a>
<a id="tocsgameworksimple"></a>

```json
{
  "id": 0,
  "author": "string",
  "title": "string",
  "description": "string",
  "tags": [
    0
  ],
  "image_url": "string",
  "is_published": true,
  "published_at": "2019-08-24T14:15:22Z",
  "favorite_count": "string",
  "average_score": "string",
  "read_count": "string",
  "is_favorited": "string",
  "price": -9223372036854776000,
  "hot_score": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|author|string|false|read-only|Author|none|
|title|string|false|none|Title|none|
|description|string¦null|false|none|Description|none|
|tags|[integer]|false|read-only||none|
|image_url|string|false|read-only|Image url|none|
|is_published|boolean|false|none|Is published|none|
|published_at|string(date-time)¦null|false|none|Published at|none|
|favorite_count|string|false|read-only|Favorite count|none|
|average_score|string|false|read-only|Average score|none|
|read_count|string|false|read-only|Read count|none|
|is_favorited|string|false|read-only|Is favorited|none|
|price|integer|false|none|Price|none|
|hot_score|string|false|read-only|Hot score|none|

<h2 id="tocS_RecursiveField">RecursiveField</h2>

<a id="schemarecursivefield"></a>
<a id="schema_RecursiveField"></a>
<a id="tocSrecursivefield"></a>
<a id="tocsrecursivefield"></a>

```json
{}

```

### 属性

*None*

<h2 id="tocS_Comment">Comment</h2>

<a id="schemacomment"></a>
<a id="schema_Comment"></a>
<a id="tocScomment"></a>
<a id="tocscomment"></a>

```json
{
  "id": 0,
  "user": "string",
  "profile_picture": "string",
  "content": "string",
  "gamework": 0,
  "created_at": "2019-08-24T14:15:22Z",
  "replies": [
    {}
  ],
  "parent": 0,
  "like_count": "string",
  "is_liked": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|user|string|false|read-only|User|none|
|profile_picture|string|false|read-only|Profile picture|none|
|content|string|true|none|Content|none|
|gamework|integer|true|none|Gamework|none|
|created_at|string(date-time)|false|read-only|Created at|none|
|replies|[[RecursiveField](#schemarecursivefield)]|false|read-only||none|
|parent|integer¦null|false|none|Parent|none|
|like_count|string|false|read-only|Like count|none|
|is_liked|string|false|read-only|Is liked|none|

<h2 id="tocS_FavoriteFolder">FavoriteFolder</h2>

<a id="schemafavoritefolder"></a>
<a id="schema_FavoriteFolder"></a>
<a id="tocSfavoritefolder"></a>
<a id="tocsfavoritefolder"></a>

```json
{
  "id": 0,
  "name": "string",
  "favorites_count": 0,
  "created_at": "2019-08-24T14:15:22Z"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|name|string|false|none|Name|none|
|favorites_count|integer|false|read-only|Favorites count|none|
|created_at|string(date-time)|false|read-only|Created at|none|

<h2 id="tocS_Favorite">Favorite</h2>

<a id="schemafavorite"></a>
<a id="schema_Favorite"></a>
<a id="tocSfavorite"></a>
<a id="tocsfavorite"></a>

```json
{
  "id": 0,
  "user": "string",
  "gamework_id": 0,
  "gamework_detail": "string",
  "folder": 0,
  "created_at": "2019-08-24T14:15:22Z"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|user|string|false|read-only|User|none|
|gamework_id|integer|true|none|Gamework id|none|
|gamework_detail|string|false|read-only|Gamework detail|none|
|folder|integer¦null|false|none|Folder|none|
|created_at|string(date-time)|false|read-only|Created at|none|

<h2 id="tocS_Rating">Rating</h2>

<a id="schemarating"></a>
<a id="schema_Rating"></a>
<a id="tocSrating"></a>
<a id="tocsrating"></a>

```json
{
  "id": 0,
  "user": "string",
  "score": 2,
  "gamework_detail": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|true|none|Id|none|
|user|string|false|read-only|User|none|
|score|integer|true|none|Score|none|
|gamework_detail|string|false|read-only|Gamework detail|none|
|created_at|string(date-time)|false|read-only|Created at|none|
|updated_at|string(date-time)|false|read-only|Updated at|none|

<h2 id="tocS_Tag">Tag</h2>

<a id="schematag"></a>
<a id="schema_Tag"></a>
<a id="tocStag"></a>
<a id="tocstag"></a>

```json
{
  "id": 0,
  "name": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|name|string|true|none|Name|none|

<h2 id="tocS_User">User</h2>

<a id="schemauser"></a>
<a id="schema_User"></a>
<a id="tocSuser"></a>
<a id="tocsuser"></a>

```json
{
  "id": 0,
  "username": "string",
  "profile_picture": "http://example.com",
  "user_credits": 0,
  "gender": "Male",
  "liked_tags": [
    0
  ],
  "is_staff": true
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|username|string|true|none|Username|none|
|profile_picture|string(uri)¦null|false|none|Profile picture|none|
|user_credits|integer¦null|false|read-only|User credits|none|
|gender|string¦null|false|none|Gender|none|
|liked_tags|[integer]|false|none||none|
|is_staff|boolean|false|read-only|Is staff|none|

#### 枚举值

|属性|值|
|---|---|
|gender|Male|
|gender|Female|
|gender|Other|

<h2 id="tocS_UserPreference">UserPreference</h2>

<a id="schemauserpreference"></a>
<a id="schema_UserPreference"></a>
<a id="tocSuserpreference"></a>
<a id="tocsuserpreference"></a>

```json
{
  "gender": "Male",
  "liked_tags": [
    0
  ]
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|gender|string¦null|false|none|Gender|none|
|liked_tags|[integer]|true|none||none|

#### 枚举值

|属性|值|
|---|---|
|gender|Male|
|gender|Female|
|gender|Other|

<h2 id="tocS_CreditLog">CreditLog</h2>

<a id="schemacreditlog"></a>
<a id="schema_CreditLog"></a>
<a id="tocScreditlog"></a>
<a id="tocscreditlog"></a>

```json
{
  "change_amount": -9223372036854776000,
  "before_balance": -9223372036854776000,
  "after_balance": -9223372036854776000,
  "type": "recharge",
  "remark": "string",
  "created_at": "2019-08-24T14:15:22Z"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|change_amount|integer|true|none|Change amount|none|
|before_balance|integer|true|none|Before balance|none|
|after_balance|integer|true|none|After balance|none|
|type|string|true|none|Type|none|
|remark|string¦null|false|none|Remark|none|
|created_at|string(date-time)|false|read-only|Created at|none|

#### 枚举值

|属性|值|
|---|---|
|type|recharge|
|type|reward|
|type|read_pay|
|type|manual|
|type|reward_out|
|type|reward_in|

<h2 id="tocS_GameworkReport">GameworkReport</h2>

<a id="schemagameworkreport"></a>
<a id="schema_GameworkReport"></a>
<a id="tocSgameworkreport"></a>
<a id="tocsgameworkreport"></a>

```json
{
  "id": 0,
  "reporter": "string",
  "gamework": 0,
  "gamework_title": "string",
  "tag": "string",
  "remark": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "is_resolved": true
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|reporter|string|false|read-only|Reporter|none|
|gamework|integer|true|none|被举报作品|none|
|gamework_title|string|false|read-only|Gamework title|none|
|tag|string|true|none|违规标签|none|
|remark|string|false|none|备注|none|
|created_at|string(date-time)|false|read-only|举报时间|none|
|is_resolved|boolean|false|read-only|Is resolved|none|

<h2 id="tocS_CommentReport">CommentReport</h2>

<a id="schemacommentreport"></a>
<a id="schema_CommentReport"></a>
<a id="tocScommentreport"></a>
<a id="tocscommentreport"></a>

```json
{
  "id": 0,
  "reporter": "string",
  "comment": 0,
  "comment_content": "string",
  "tag": "string",
  "remark": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "is_resolved": true,
  "gamework": "string"
}

```

### 属性

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|id|integer|false|read-only|ID|none|
|reporter|string|false|read-only|Reporter|none|
|comment|integer|true|none|被举报评论|none|
|comment_content|string|false|read-only|Comment content|none|
|tag|string|true|none|违规标签|none|
|remark|string|false|none|备注|none|
|created_at|string(date-time)|false|read-only|举报时间|none|
|is_resolved|boolean|false|read-only|Is resolved|none|
|gamework|string|false|read-only|Gamework|none|

