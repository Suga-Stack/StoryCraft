/**
 * 类型定义文件
 * 使用 JSDoc 注释提供类型提示,无需引入 TypeScript
 */

/**
 * @typedef {Object} Work
 * @property {string|number} id - 作品 ID
 * @property {string} title - 作品标题
 * @property {string} [coverUrl] - 封面图 URL
 * @property {string} [authorId] - 作者 ID
 * @property {string} [description] - 作品描述
 */

/**
 * @typedef {Object} DialogueItem
 * @property {string} text - 对白文本
 * @property {string} [backgroundImage] - 背景图 URL
 */

/**
 * @typedef {Object} Choice
 * @property {string|number} id - 选项 ID
 * @property {string} text - 选项文本
 * @property {Object.<string, number>} [attributesDelta] - 属性变化
 * @property {Object.<string, any>} [statusesDelta] - 状态变化
 * @property {Scene[]} [nextScenes] - 后续场景
 */

/**
 * @typedef {Object} Scene
 * @property {string|number} id - 场景 ID
 * @property {string} [backgroundImage] - 背景图 URL
 * @property {(string|DialogueItem)[]} dialogues - 对白数组
 * @property {number} [choiceTriggerIndex] - 选项触发索引
 * @property {Choice[]} [choices] - 选项数组
 * @property {string|number} [nextScene] - 下一场景 ID
 * @property {Scene[]} [nextScenes] - 下一组场景
 */

/**
 * @typedef {Object} SavePayload
 * @property {Work} work - 作品信息
 * @property {number} currentSceneIndex - 当前场景索引
 * @property {number} currentDialogueIndex - 当前对白索引
 * @property {Object.<string, number>} attributes - 属性
 * @property {Object.<string, any>} statuses - 状态
 * @property {Scene[]} storyScenes - 场景数组
 * @property {number} timestamp - 时间戳
 */

/**
 * @typedef {Object} SaveData
 * @property {SavePayload} data - 存档数据
 * @property {number} timestamp - 时间戳
 */

/**
 * @typedef {Object} User
 * @property {string} id - 用户 ID
 * @property {string} username - 用户名
 * @property {string} [email] - 邮箱
 * @property {string} [avatar] - 头像 URL
 * @property {number} [createdAt] - 创建时间
 */

/**
 * @typedef {Object} AuthResult
 * @property {string} token - 认证 token
 * @property {User} user - 用户信息
 */

/**
 * @typedef {Object} ChoiceContext
 * @property {string} userId - 用户 ID
 * @property {string|number} workId - 作品 ID
 * @property {string|number} currentSceneId - 当前场景 ID
 * @property {number} currentDialogueIndex - 当前对白索引
 * @property {Object.<string, number>} attributes - 属性
 * @property {Object.<string, any>} statuses - 状态
 */

/**
 * @typedef {Object} ChoiceResult
 * @property {Object.<string, number>} [attributesDelta] - 属性变化
 * @property {Object.<string, any>} [statusesDelta] - 状态变化
 * @property {Scene[]} [insertScenes] - 插入的场景
 * @property {boolean} end - 是否结束
 */

/**
 * @typedef {Object} NextScenesResult
 * @property {boolean} end - 是否结束
 * @property {Scene[]} [nextScenes] - 后续场景
 * @property {boolean} [generating] - 是否正在生成
 */

/**
 * @typedef {Object} StreamMessage
 * @property {string} type - 消息类型 (work_meta, scene, choice_effect, mainline, special_event, end, report)
 * @property {number} seq - 序号
 * @property {string|number} workId - 作品 ID
 * @property {number} [timestamp] - 时间戳
 * @property {string} [note] - 备注
 * @property {*} [data] - 消息数据
 */

/**
 * @typedef {Object} SSEOptions
 * @property {number} [resumeAfterSeq] - 恢复序号
 * @property {function(StreamMessage): void} [onMessage] - 消息回调
 * @property {function(Error): void} [onError] - 错误回调
 * @property {function(): void} [onOpen] - 连接打开回调
 * @property {function(): void} [onClose] - 连接关闭回调
 */

/**
 * @typedef {Object} SSEConnection
 * @property {function(): void} close - 关闭连接
 * @property {function(): void} reconnect - 重新连接
 * @property {function(): number} getLastSeq - 获取最后序号
 */

/**
 * @typedef {Object} WebSocketConnection
 * @property {function(Object): void} send - 发送消息
 * @property {function(): void} close - 关闭连接
 * @property {function(): void} reconnect - 重新连接
 * @property {function(): number} getLastSeq - 获取最后序号
 */

/**
 * @typedef {Object} ErrorHandlerOptions
 * @property {boolean} [showToast] - 是否显示提示
 * @property {function(Error): void} [onAuthError] - 认证错误回调
 * @property {function(Error): void} [onNetworkError] - 网络错误回调
 */

/**
 * @typedef {Object} HandledError
 * @property {string} message - 错误消息
 * @property {string} type - 错误类型
 * @property {Error} original - 原始错误
 */

export {}
