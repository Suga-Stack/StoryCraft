# 结局与结算报告 API 文档

本文档描述了游戏结局生成、获取、修改以及结算报告获取的相关接口。

## 1. 获取结局列表（大纲）

- **接口路径**：`GET /api/game/storyending/{gameworkId}/`
- **描述**：获取该作品所有结局的摘要信息（不包含具体场景内容）。通常在最后一章生成完毕后调用。
- **响应示例**：
```json
{
  "status": "ready",
  "endings": [
    {
      "endingIndex": 1,
      "title": "完美结局",
      "condition": {"勇气": ">=30", "智慧": ">=20"},
      "outline": "你战胜了魔王，成为了王国的英雄...",
      "status": "generated" 
    },
    {
      "endingIndex": 2,
      "title": "遗憾结局",
      "condition": {"勇气": "<=10"},
      "outline": "你选择了逃避，最终...",
      "status": "not_generated"
    }
  ]
}
```
- **结局状态 (`status`) 说明**：
  - `not_generated`: 仅有大纲，具体内容未生成。
  - `generating`: 具体内容正在生成中。
  - `generated`: 具体内容已生成。
  - `saved`: 创作者已手动保存，内容已锁定。

---

## 2. 获取单个结局详情

- **接口路径**：`GET /api/game/storyending/{gameworkId}/{endingIndex}/`
- **描述**：获取指定结局的完整内容，包括场景、图片和对话。
- **响应示例**：
  - **生成中**：
    ```json
    {
      "status": "generating",
      "message": "结局内容生成中"
    }
    ```
  - **未生成**：
    ```json
    {
      "status": "not_generated",
      "message": "结局尚未生成"
    }
    ```
  - **已就绪 (Generated/Saved)**：
    ```json
    {
      "status": "ready",
      "ending": {
        "endingIndex": 1,
        "title": "完美结局",
        "condition": {"勇气": ">=30"},
        "outline": "结局梗概...",
        "status": "generated", // 或 "saved"
        "scenes": [
          {
            "id": 1,
            "backgroundImage": "http://.../scene1.jpg",
            "dialogues": [
              {
                "narration": "阳光洒在你的脸上...",
                "playerChoices": null
              }
            ]
          }
        ]
      }
    }
    ```

---

## 3. 手动保存结局内容（创作者模式）

- **接口路径**：`PUT /api/game/storyending/{gameworkId}/{endingIndex}/`
- **描述**：创作者手动修改结局内容后保存。**此操作会将结局状态更新为 `saved`，并锁定AI再生成功能**。
- **请求体**：
```json
{
  "endingIndex": 1,
  "title": "修改后的结局标题",
  "scenes": [
    {
      "id": 1,
      "backgroundImage": "http://.../new_bg.jpg",
      "dialogues": [
        {
          "narration": "这是修改后的结局文本...",
          "playerChoices": null
        }
      ]
    }
  ]
}
```
- **响应**：`{ "ok": true }`

---

## 4. 创作者模式生成单个结局

- **接口路径**：`POST /api/game/ending/generate/{gameworkId}/{endingIndex}/`
- **描述**：创作者修改结局大纲或提供提示词，触发AI重新生成指定结局。**仅当结局状态不是 `saved` 时可用**。
- **请求体**：
```json
{
  "title": "新的结局标题",
  "outline": "修改后的结局大纲...",
  "userPrompt": "请让结局更悲壮一些"
}
```
- **响应**：`{ "ok": true }`
- **说明**：调用成功后，该结局状态将变为 `generating`，前端需轮询“获取单个结局详情”接口等待生成完成。

---

## 5. 获取结算报告（个性化评价）

- **接口路径**：`POST /api/game/report/{gameworkId}/{endingIndex}/`
- **描述**：根据玩家达成的结局和最终属性，生成或获取个性化结算报告。
- **请求体**：
```json
{
  "attributes": {
    "勇气": 45,
    "智慧": 20,
    "魅力": 10
  }
}
```
- **响应示例**：
```json
{
  "status": "ready",
  "details": {
    "title": "无畏的探险家",
    "content": "你在旅途中展现了非凡的勇气...",
    "traits": ["果敢", "冲动", "热血"],
    "scores": {
      "勇气": 90,
      "智慧": 40,
      "魅力": 20
    }
  }
}
```
- **说明**：`scores` 是根据属性值在整个游戏中的最大可能值计算出的百分制分数。
