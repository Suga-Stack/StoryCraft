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


export default http;