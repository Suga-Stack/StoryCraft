import axios from 'axios';

// 创建Axios实例
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const http = axios.create({
  // 默认指向后端主机，调用方仍可使用以 `/api/` 开头的路径
  baseURL: API_BASE,
  timeout: 10000 // 超时时间10秒
});

// 添加请求拦截器：在所有请求发送前，自动添加 Token 头
http.interceptors.request.use(
  (config) => {
    // 从 localStorage 中获取 Token
    const token = localStorage.getItem('token');
    // 如果 Token 存在，添加到请求头
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;  // 与后端格式保持一致
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理token过期
http.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 如果是401错误且未尝试过刷新token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 使用refreshToken获取新的accessToken
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // 没有刷新令牌，需要重新登录
          redirectToLogin();
          return Promise.reject(error);
        }

        const res = await axios.post('/api/auth/token/refresh/', {
          refresh: refreshToken
        });

        // 存储新的accessToken
        if (res.data.access) {
          localStorage.setItem('token', res.data.access);
          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return http(originalRequest);
        }
      } catch (refreshError) {
        // 刷新令牌失败，需要重新登录
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 跳转到登录页的函数
function redirectToLogin() {
  // 清除过期的令牌
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  // 跳转到登录页，可根据实际路由调整
  router.push('/login');
}


export default http;