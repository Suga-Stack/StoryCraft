import http from '@/utils/http'

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

