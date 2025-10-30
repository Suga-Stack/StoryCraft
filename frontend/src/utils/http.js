import axios from 'axios';

// 创建Axios实例
const http = axios.create({
  baseURL: '/api', // 基础URL，所有请求都会加上这个前缀
  timeout: 10000 // 超时时间10秒
});



export default http;