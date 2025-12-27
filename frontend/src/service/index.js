/**
 * API 服务统一入口
 * 导出所有服务模块,提供统一的访问接口
 */

// HTTP 客户端
export { http, getUserId } from './http.js'

// 用户相关服务
export {
  login,
  register,
  logout,
  getCurrentUser,
  updateUser,
  changePassword,
  getCachedUserInfo,
  validateToken
} from './user.js'

// 故事相关服务
export {
  getScenes,
  getWorkInfo,
  getWorkList,
  createGame,
  updateWork,
  deleteWork,
  getInitialScenes
} from './story.js'

// 存档相关服务
export { saveGame, loadGame, getSavesList, deleteSave, loadAllSlots } from './save.js'

// 流式数据服务
export { createSSEConnection, createWebSocketConnection, parseNDJSON } from './stream.js'

// 默认导出所有服务模块
import userService from './user.js'
import storyService from './story.js'
import saveService from './save.js'
import streamService from './stream.js'

export default {
  user: userService,
  story: storyService,
  save: saveService,
  stream: streamService
}
