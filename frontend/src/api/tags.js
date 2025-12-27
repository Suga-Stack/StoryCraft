import http from '../utils/http'

//获取标签
export const getTags = () => {
  return http.get('/api/tags/')
}

//由标签id获取标签名称
export const getTagsName = (id) => {
  return http.get(`/api/tags/${id}/`)
}
