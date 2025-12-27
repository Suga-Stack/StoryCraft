import http from '../utils/http'

// 登录接口
export const login = (username, password) => {
  return http.post('/api/auth/login/', {username, password})
}

// 注册接口
export const register = (username, password, confirm_password, email, email_code) => {
  return http.post('/api/auth/register/', {username, password, confirm_password, email, email_code})
}

// 退出登录接口
export const logout = (refresh) => {
  return http.post('/api/auth/logout/', {refresh})
}

// 发送邮箱验证码接口
export const sendEmailCode = (email) => {
  return http.post('/api/auth/send-email-code/', {email})
}

// 保存用户偏好
export const savePreferences = (gender, liked_tags) => {
  return http.put('/api/users/preferences/', {gender, liked_tags}) 
}

// 获取用户偏好
export const getPreferences = () => {
  return http.get('/api/users/preferences/')
}

// 获取用户信息
export const getUserInfo = (id) => {
  return http.get(`/api/users/admin/${id}/`)
}

// 更新用户信息
export const updateUserInfo = (id, data) => {
  return http.patch(`/api/users/admin/${id}/`, data)
}

export const uploadProfilePicture = (file) => {
  return http.post(`/api/game/upload-image/`, file )
}

export const recommend = () => {
  return http.get('/api/gameworks/recommend/')
}

export const getReadingHistory = () => {
  return http.get('/api/users/read/'); 
}

/**
 * 删除阅读历史
 * @param {number|number[]=} gameworkId 单个id、id数组，或不传为全部删除
 * @returns {Promise}
 */
export const clearReadingHistory = (gameworkId) => {
  // 不传参数，全部删除（隐藏所有记录）
  if (gameworkId === undefined || gameworkId === null) {
    return http.delete('/api/users/read/');
  }
  // 组装逗号分隔的 ID 字符串
  const ids = Array.isArray(gameworkId) ? gameworkId : [gameworkId]
  const paramValue = ids.join(',')
  // 后端在 DELETE 中通过 query 参数 `gamework_ids` 解析
  return http.delete('/api/users/read/', { params: { gamework_ids: paramValue } })
}

export const getRecentReadingHistory = () => {
  return http.get('/api/users/read/recent/'); 
}

export const getMyworks = () => {
  return http.get('/api/users/myworks/'); 
}

// 获取当前用户的举报列表
export const getMyReports = () => {
  return http.get('/api/interactions/reports/');
}

export const getRecentMyworks = () => {
  return http.get('/api/users/myworks/recent/'); 
}

export const search = (page, q, author, tag) => {
  return http.get('/api/gameworks/search/', {params: {page, q, author, tag}});
}

export const getFavoriteLeaderboard = () => {
  return http.get('/api/gameworks/favorite-leaderboard/');
}

export const getRatingLeaderboard = () => {
  return http.get('/api/gameworks/rating-leaderboard/');
}

export const getHotLeaderboard = (range) => {
  return http.get('/api/gameworks/hot-leaderboard/', {
    params: { range }
  })
}

//创建收藏夹
export const createFolders = (name) => {
  return http.post('/api/interactions/favorite-folders/',{name});
}

//获取所有的收藏夹
export const getFolders = () => {
  return http.get('/api/interactions/favorite-folders/');
}

//删除收藏夹
export const deleteFolders = (id) => {
  return http.delete(`/api/interactions/favorite-folders/${id}/`);
}

// 获取收藏夹中的作品列表
export const searchFavorites = (search, page, folder) => {
  return http.get('/api/interactions/favorites/',{search, page, folder});
}

// 把作品添加到收藏
export const addFavorite = (gamework_id, folder) => {
  return http.post('/api/interactions/favorites/', {gamework_id, folder});
}

// 取消收藏
export const deleteFavorite = (id) => {
  return http.delete(`/api/interactions/favorites/${id}/`)
}

//移动到其他收藏夹
export const moveFavorite = (id, folderId) => {
  return http.post(`/api/interactions/favorites/move_to_folder/`,{
    favorite_ids: [id], 
    folder: folderId} 
  )
}

//获取评论
export const getComments = (page, gameworkId) => {
  return http.get('/api/interactions/comments/', {page, gameworkId})
}

//发表评论
export const postComments = (content, gamework, parent) => {
  return http.post('/api/interactions/comments/', {content, gamework, parent})
}

// 点赞评论
export const likeComment = (commentId) => {
  return http.post(`/api/interactions/comments/${commentId}/like/`)
}

// 取消点赞评论
export const unlikeComment = (commentId) => {
  return http.post(`/api/interactions/comments/${commentId}/unlike/`)
}

export const recommendWorks = (page) => {
  return http.get('/api/gameworks/recommend/', page)
}

// 发布作品（可传解锁积分 price）
export const publishWorks = (id, price) => {
  const body = (price !== undefined && price !== null) ? { price } : {}
  return http.post(`/api/gameworks/publish/${id}/`, body)
}

// 取消发布作品
export const unpublishWorks = (id, price) => {
  return http.post(`/api/gameworks/unpublish/${id}/`, price)
}

// 获取签到日期
export const getSignInDates = () => {
  return http.get('/api/users/signin/')
}

// 用户签到
export const userSignIn = () => {
  return http.post('/api/users/signin/')
}

// 积分充值
export const rechargeCredits = (credits) => {
  return http.post('/api/users/recharge/', {credits})
}

// 获取积分流水，支持自定义每页条数
export const getCreditsLog = (page) => {
  return http.get('/api/users/creditlog/', { params: {page} })
}

// 举报评论：向后端提交 CommentReport 对象
// body: { comment: integer (被举报的评论主键 ID), tag: string (1-100), remark?: string }
export const reportComment = (comment, tag, remark = '') => {
  return http.post('/api/users/reports/comments/', { comment, tag, remark })
}