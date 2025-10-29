import http from '@/utils/http'

// 登录接口
export const login = (username, password) => {
  return http.post('/auth/login/password', {username, password})
}

// 注册接口
export const register = (username, password, confirmPassword, email, verifyingCode) => {
  return http.post('/auth/register', {username, password, confirmPassword, email, verifyingCode})
}

// 微信登陆接口
export const wechatLogin = (code) => {
  return http.post('/auth/login/wechat', {code})
}

// 退出登录接口
export const logout = (token) => {
  return http.post('/auth/logout', {token})
}

// 获取用户信息接口
export const getUserInfo = (token) => {
  return http.get('/auth/current-user', {token})
}

// 更新用户信息接口
export const updateUserInfo = (token, nickname, avatar) => {
  return http.put('/user/profile', {token,nickname,avatar})
}

// 保存用户偏好
export const savePreferences = (tokens, gender, favoriteTags) => {
  return http.put('/user/preferences', {tokens, gender, favoriteTags}) 
}

// 获取用户偏好
export const getPreferences = (token) => {
  return http.get('/user/preferences', {token})
}

