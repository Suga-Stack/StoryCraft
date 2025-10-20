import axios from 'axios';
import { Toast } from 'vant';

// 创建Axios实例
const http = axios.create({
  baseURL: '/api', 
  timeout: 10000 // 超时时间10秒
});


// 请求拦截器：所有请求都携带Token（登录后）
http.interceptors.request.use(
  (config) => {
    // 从本地存储获取Token（登录成功后存的）
    const token = localStorage.getItem('token');
    if (token) {
      // 把Token放到请求头里（后端会通过这个头获取Token）
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：统一处理后端返回的错误
http.interceptors.response.use(
  (response) => {
    // 直接返回后端的data（简化前端获取数据）
    return response.data;
  },
  (error) => {
    // 处理401错误（Token无效或未登录）
    if (error.response?.status === 401) {
      Toast('请先登录');
      localStorage.removeItem('token'); // 清除无效Token
      router.push('/login'); // 跳回登录页
    } else {
      // 其他错误提示
      Toast(error.response?.data?.message || '网络错误，请重试');
    }
    return Promise.reject(error);
  }
);

export default http;