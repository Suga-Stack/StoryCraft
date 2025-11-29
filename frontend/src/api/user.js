import http from '../utils/http'

// 登录接口
export const login = (username, password) => {
  return http.post('/auth/login/', {username, password})
}

// 注册接口
export const register = (username, password, confirm_password, email, email_code) => {
  return http.post('/auth/register/', {username, password, confirm_password, email, email_code})
}

// 退出登录接口
export const logout = (refresh) => {
  return http.post('/auth/logout/', {refresh})
}

// 发送邮箱验证码接口
export const sendEmailCode = (email) => {
  return http.post('/auth/send-email-code/', {email})
}

// 保存用户偏好
export const savePreferences = (gender, liked_tags) => {
  return http.put('/users/preferences/', {gender, liked_tags}) 
}

// 获取用户偏好
export const getPreferences = () => {
  return http.get('/users/preferences/')
}

// 获取用户信息
export const getUserInfo = (id) => {
  return http.get(`/users/admin/${id}/`)
}

// 更新用户信息
export const updateUserInfo = (id, data) => {
  return http.patch(`/users/admin/${id}/`, data)
}

export const uploadProfilePicture = (file) => {
  return http.post(`/game/upload-iamge/`, file )
}

export const recommend = () => {
  return http.get('/gameworks/recommend/')
}

export const getReadingHistory = () => {
  return http.get('/users/read/'); 
}

export const getRecentReadingHistory = () => {
  return http.get('/users/read/recent/'); 
}

export const getMyworks = () => {
  return http.get('/users/myworks/'); 
}

export const getRecentMyworks = () => {
  return http.get('/users/myworks/recent/'); 
}

export const search = (page, q, author, tag) => {
  return http.get('/gameworks/search/', {params: {page, q, author, tag}});
}

export const getFavoriteLeaderboard = () => {
  return http.get('/gameworks/favorite-leaderboard/');
}

export const getRatingLeaderboard = () => {
  return http.get('/gameworks/rating-leaderboard/');
}

export const getHotLeaderboard = (range) => {
  return http.get('/gameworks/hot-leaderboard/', {
    params: { range }
  })
}

//创建收藏夹
export const createFolders = (name) => {
  return http.post('/interactions/favorite-folders/',{name});
}

//获取所有的收藏夹
export const getFolders = () => {
  return http.get('/interactions/favorite-folders/');
}

//删除收藏夹
export const deleteFolders = (id) => {
  return http.delete(`/interactions/favorite-folders/${id}/`);
}

// 获取收藏夹中的作品列表
export const searchFavorites = (search, page, folder) => {
  return http.get('/interactions/favorites/',{search, page, folder});//folder筛选所属收藏夹ID（send empty value或为 null 显示未分组，不传显示全部）
}

// 把作品添加到收藏
export const addFavorite = (gamework_id, folder) => {
  return http.post('/interactions/favorites/', {gamework_id, folder});
}

// 取消收藏
export const deleteFavorite = (id) => {
  return http.delete(`/interactions/favorites/${id}/`)
}

//移动到其他收藏夹
export const moveFavorite = (id, folderId) => {
  return http.patch(`/interactions/favorites/${id}/`, {folderId, id})
}

//获取评论
export const getComments = (page, gameworkId) => {
  return http.get('/interactions/comments/', {page, gameworkId})
}

//发表评论
export const postComments = (content, gamework, parent) => {
  return http.post('/interactions/comments/', {content, gamework, parent})
}

export const recommendWorks = (page) => {
  return http.get('/gameworks/recommend/', page)
}

// 发布作品
export const publishWorks = (id) => {
  return http.post(`/gameworks/publish/${id}/`)
}

// 取消发布作品
export const unpublishWorks = (id, price) => {
  return http.post(`/gameworks/unpublish/${id}/`, price)
}

// 获取签到日期
export const getSignInDates = () => {
  return http.get('/users/signin/')
}

// 用户签到
export const userSignIn = () => {
  return http.post('/users/signin/')
}

// 积分充值
export const rechargeCredits = (credits) => {
  return http.post('/users/recharge/', {credits})
}

// 获取积分流水
export const getCreditsLog = (page) => {
  return http.get('/users/creditlog/', {page})
}