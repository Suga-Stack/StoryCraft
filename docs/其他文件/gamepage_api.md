# API 文档 - 创作者与读者双模式流程

本文档描述了支持“创作者”和“普通读者”两种模式的完整API交互流程。

## 核心概念

- **普通读者**: 创建作品后，所有章节由后端自动、连续生成。读者只能阅读和手动编辑（如果需要），但**不能**调用AI重新生成章节。
- **创作者**: 创建作品后，只生成大纲。创作者需按顺序逐章生成内容。对于每一章，可以：
    1.  修改大纲和Prompt，调用AI生成。
    2.  对AI生成的内容不满意，可再次调用AI重新生成。
    3.  对AI生成的内容进行手动编辑，然后**保存**。
    4.  一旦章节被**保存**，它将被锁定，无法再通过AI重新生成，但仍可手动编辑。
    5.  必须**保存**第 N 章后，才能开始生成第 N+1 章。

- **章节状态 (`status`)**:
    - `not_generated`: 未开始生成。
    - `generating`: 正在生成中。
    - `generated`: AI已生成，等待创作者审核/修改。
    - `saved`: 创作者已手动保存，此章节已锁定。

- 此接口返回的状态仅代表当前时刻的状态。

---

## 1. 创建游戏（获取初始大纲）

- **方法**：`POST`
- **路径**：`/api/game/create`
- **描述**：根据用户输入创建新作品，后端AI生成基础信息和**初始章节大纲**。
- **请求体**：
  ```json
  {
    "tags": ["玄幻", "穿越", "系统", "升级流"],
    "idea": "一个现代女孩穿越到修仙世界，获得氪金系统...",
    "length": "medium",
    "modifiable": true
  }
  ```
- **参数说明**: `modifiable`为 true 代表创作者模式，可自由编辑；`modifiable`为 false 或无`modifiable`参数代表一般阅读者身份。
- **成功响应示例**：
  ```json
  {
    "gameworkId": 123
  }
  ```
- **说明**：
  - 获取具体游戏详情页请使用GET请求轮询。



## 2. 获取作品详情页 (轮询接口)

- **方法**: `GET`
- **路径**: `/api/gameworks/gameworks/{id}/`
- **描述**: 获取作品的完整信息和所有章节的状态。这是连接所有操作的核心接口。
- **响应 (初始信息生成中)**:
  ```json
  {
    "status": "generating"
  }
  ```
- **响应 (初始信息已就绪)**:
```json
{
  "status": "ready",
  "data": {
    "id": 1,
    "author": "ZZY",
    "title": "AI生成失败的模拟作品",
    "description": "这是一个在AI生成失败时返回的模拟作品简介。",
    "tags": [
      1
    ],
    "image_url": "https://storycraft.work.gdmedia/gamework_covers/86955b32f4784273833cfbd2dcacc78b.jpg",
    "is_published": false,
    "created_at": "2025-11-10T14:22:08.104237Z",
    "updated_at": "2025-11-10T14:22:18.948827Z",
    "published_at": null,
    "favorite_count": 0,
    "average_score": 0,
    "rating_count": 0,
    "read_count": 0,
    "is_favorited": false,
    "is_complete": false,
    "generated_chapters": 1,
    "total_chapters": 2,
    "modifiable": true,
    "ai_callable": true,
    "initial_attributes": {
        // 
    },
    "initial_statuses": {
        // 
    },
    "outlines": [
        // 
    ],
    "chapters_status": [
      {
        "chapterIndex": 1,
        "status": "saved"
      },
      {
        "chapterIndex": 2,
        "status": "not_generated"
      }
    ]
  }
}
```
- **前端交互逻辑**:
  - 前端通过 `chapters_status` 列表来渲染每一章的状态和对应的操作按钮。
  - 例如，对于创作者：
    - 如果第1章 `status` 是 `not_generated`，显示“生成第1章”按钮。
    - 如果第1章 `status` 是 `generating`，显示“生成中...”并禁用按钮。
    - 如果第1章 `status` 是 `generated`，显示“重新生成”和“编辑/保存”按钮。
    - 如果第1章 `status` 是 `saved`，显示“编辑”按钮，但“重新生成”按钮禁用。
    - 如果第1章 `status` 不是 `saved`，则第2章及之后的所有章节按钮都应禁用。

---

## 3. 启动章节生成 (仅创作者)

- **方法**: `POST`
- **路径**: `/api/game/chapter/generate/{gameworkId}/{chapterIndex}`
- **描述**: 创作者提交大纲和Prompt，启动指定章节的AI生成。
- **请求体**:
  ```json
  {
    "chapterOutlines": [ /* 完整的最新大纲 */ ],
    "userPrompt": "本章请加入一个反派角色..."
  }
  ```
- **成功响应**:
  ```json
  { "ok": true }
  ```
- **后续流程**: 后端开始异步生成。前端应再次轮询 **获取作品详情页** 接口，`chapters_status` 中对应章节的状态会变为 `generating`，完成后变为 `generated`。

---

## 4. 获取生成的章节内容

- **方法**: `GET`
- **路径**: `/api/game/chapter/{gameworkId}/{chapterIndex}`
- **描述**: 获取一个已生成章节（状态为 `generated` 或 `saved`）的具体内容，用于展示在编辑区。
- **成功响应**:
  - 已完成：
    ```json
    {
      "status": "ready",
      "chapter": {
        "chapterIndex": 1,
        "title": "第一章：青云遗孤下山来",
        "scenes": [
          {
            "id": 1,
            "backgroundImage": "/media/gamework_scenes/132693169d27471fa8cb7f30630b7983.jpg",
            "dialogues": [
              {
                "narration": "你背着半旧的青锋剑，站在名为“望归”的古道入口……",
                "playerChoices": [
                  {
                    "text": "查看行囊里的地图，仔细辨认“定”字附近的蛛丝马迹",
                    "attributesDelta": { "气运": 1 },
                    "statusesDelta": { "正在追踪线索": true },
                    "subsequentDialogues": [
                      "你指尖抚过地图上“定”字旁的一条淡淡朱砂线……"
                    ],
                    "choiceId": 1
                  }
                  // ...更多选项...
                ]
              }
              // ...更多对白...
            ]
          }
          // ...更多场景...
        ]
      }
    }
    ```
- **注意**: 如果此时章节正在生成，此接口会返回 `generating` 状态。

---

## 4.1.1 获取剧情结局梗概
- **方法**: `GET`
- **路径**: `/api/game/storyending/{gameworkId}`
- **描述**: 全部章节结束后，获取最终结局。
- **成功响应**:
  - 未完成
  ```json
  {
    "status": "generating"
  }
  ```
  - 已完成：
    ```json
    {
      "status": "ready",
      "endings": [
        { 
          "endingIndex": 1,
          "title": "结局1",
          "condition": {"心计": ">=50", "圣宠": ">=30"},
          "outline": "结局梗概...",
        },
        {
          "title": "结局2",
          "condition": {"健康": ">=80", "心机": "<=30"},
          "summary": "结局梗概...",
        },
        {
          "title": "结局3",
          "condition": {"心机": "<=30"}, // 目前暂没有默认结局，可认为最后一个结局为默认结局
          "summary": "结局梗概...",
        }
      ]
    }
    ```

## 4.2 保存手动修改后的结局内容

- **方法**: `PUT`
- **路径**: `/api/game/storyending/{gameworkId}`
- **描述**: 创作者手动修改某个结局后，提交内容进行保存。
- **请求体**:
  ```json
  {
    "endingId": 101,
    "title": "结局1：新的开始",
    "scenes": [ /* ...手动修改后的场景数据... */ ]
  }
  ```
- **成功响应**:
  ```json
  { "ok": true }
  ```

   
## 5. 保存手动修改后的章节内容 (锁定章节)

- **方法**: `PUT`
- **路径**: `/api/game/chapter/{gameworkId}/{chapterIndex}`
- **描述**: 创作者手动修改后，提交内容进行保存。**此操作会将章节状态更新为 `saved`，并锁定AI再生成功能**。
- **请求体**:
  ```json
  {
    "chapterIndex": 1,
    "title": "第一章：新的开始",
    "scenes": [ /* ...手动修改后的场景数据... */ ]
  }
  ```
- **成功响应**:
  ```json
  { "ok": true }
  ```
- **后续流程**: 保存成功后，前端应刷新作品详情，此时 `chapters_status` 中该章节状态变为 `saved`，下一章的生成按钮变为可用。


## 6. 存档（Save）接口

### 6.1 保存存档（PUT）
- 路径：PUT /api/game/saves/{gameworkId}/{slot}
- 例如：/api/game/saves/123/1
- 描述：将当前游戏进度保存到指定的槽位（slot）。
- 参数：
  - `gameworkId`（整数） 作品 ID
  - `slot`（整数） 存档槽（从 1 开始）

请求体（JSON）示例（完整示例）：
```json
{
  "title": "自动存档 2024-05-21",
  "timestamp": 1690500000000,
  "state": {
    "chapterIndex": 2,
    "sceneId": 1,
    "dialogueIndex": 1,
    "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
    "statuses": { "修为": "炼气期三层", "线人网络": true },
    "choiceHistory": [
      {"chapterIndex":1, "sceneId": 4, "choiceTriggerIndex": 5, "choiceId": 2}
    ]
  } 
}
```

响应示例（成功）

```json
{
  "ok": true
}
```

### 6.2 读取存档（GET）

- 路径：GET /api/game/saves/{gameworkId}/{slot}
- 描述：返回指定槽位的完整存档（如果存在）。

响应示例（存在存档）

```json
{
  "title": "自动存档 2024-05-21",
  "timestamp": 1690500000000,
  "state": {
    "chapterIndex": 2,
    "sceneId": 1,
    "dialogueIndex": 1,
    "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
    "statuses": { "修为": "炼气期三层", "线人网络": true },
    "choiceHistory": [
      {"chapterIndex":1, "sceneId": 4, "choiceTriggerIndex": 5, "choiceId": 2}
    ]
  } 
}
```

如果不存在，返回 HTTP 404（前端将把该槽视为空位）。

### 6.3 批量列出存档

- 路径建议：GET /api/game/saves/{gameworkId}
- 作用：返回该作品下所有槽位的摘要（用于存档列表/预览）。

建议响应示例：

```json
{
  "saves": [
    {
      "slot": 1,
      "title": "自动存档 2024-05-21",
      "timestamp": 1690500000000,
      "chapterIndex": 2,
      "sceneId": 4,
      "dialogueIndex": 1,
      "coverUrl":"media/gamework_scenes/xxx.jpg"
    },
    { 
      "slot": 2, 
    }
  ]
}
```

### 6.4 删除存档（DELETE）

- 路径：DELETE /api/game/saves/{gameworkId}/{slot}
- 响应示例：

```json
{
  "ok": true
}
```
