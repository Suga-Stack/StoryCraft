import axios from 'axios';

// 创建Axios实例
const http = axios.create({
  baseURL: '/api', // 基础URL，所有请求都会加上这个前缀
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