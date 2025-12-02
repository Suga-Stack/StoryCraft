import axios from 'axios';

// 检测是否在 Capacitor 应用中
const isCapacitor = () => {
  return window.Capacitor !== undefined;
};

// 获取 API 基础 URL
const getBaseURL = () => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL;
    console.log('[utils/http] 使用环境变量 VITE_API_BASE_URL:', url);
    return url;
  }
  
  // 在 Capacitor Android 应用中,使用远程服务器
  if (isCapacitor()) {
    console.log('[utils/http] Capacitor 环境,使用远程服务器');
    return 'http://82.157.231.8:8000';
  }
  
  // 浏览器环境:默认使用远程服务器地址
  console.log('[utils/http] 浏览器环境,使用远程服务器');
  return 'http://82.157.231.8:8000';
};

const API_BASE = getBaseURL();
console.log('[utils/http] axios 实例初始化,baseURL:', API_BASE);

const http = axios.create({
  // 默认指向后端主机,调用方仍可使用以 `/api/` 开头的路径
  baseURL: API_BASE,
  timeout: 30000, // 增加超时时间到30秒
  // 允许跨域携带凭证
  withCredentials: false // Capacitor 环境下不需要携带 cookie
});

// 添加请求拦截器：在所有请求发送前，自动添加 Token 头
http.interceptors.request.use(
  (config) => {
    // 打印请求信息(便于调试)
    console.log('[utils/http] 发送请求:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      data: config.data
    });
    
    // 从 localStorage 中获取 Token
    const token = localStorage.getItem('token');
    // 如果 Token 存在，添加到请求头
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;  // 与后端格式保持一致
      console.log('[utils/http] 已添加 Authorization header');
    } else {
      console.log('[utils/http] 未找到 token');
    }
    return config;
  },
  (error) => {
    console.error('[utils/http] 请求配置错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器：处理token过期
http.interceptors.response.use(
  response => {
    console.log('[utils/http] 响应成功:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  async error => {
    // 详细的错误日志
    console.error('[utils/http] 请求失败:', {
      message: error.message,
      code: error.code,
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      isNetworkError: error.message === 'Network Error',
      isTimeout: error.code === 'ECONNABORTED'
    });
    
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
        
        const res = await axios.post(`${API_BASE}/api/auth/token/refresh/`, {
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
  console.log('[utils/http] 重定向到登录页');
  // 清除过期的令牌
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  // 动态导入 router 避免循环依赖
  // 注意: 这里可能需要根据实际路由配置调整
  if (window.location) {
    window.location.href = '/login';
  }
}


export default http;