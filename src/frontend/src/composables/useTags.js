import { ref } from 'vue'
import { getTagsName } from '../api/tags'
import { showToast } from 'vant'
import { defaultTags } from '../config/tags'

export function useTags() {
  // 1. 定义10种预设颜色（对应0-9的个位数）
  const colorList = [
    { backgroundColor: '#e0f2fe', color: '#0284c7' },
    { backgroundColor: '#dbeafe', color: '#3b82f6' },
    { backgroundColor: '#f0fdf4', color: '#166534' },
    { backgroundColor: '#fff7ed', color: '#c2410c' },
    { backgroundColor: '#f5f3ff', color: '#6b21a8' },
    { backgroundColor: '#fee2e2', color: '#b91c1c' },
    { backgroundColor: '#fef3c7', color: '#92400e' },
    { backgroundColor: '#e0e7ff', color: '#4338ca' },
    { backgroundColor: '#d1fae5', color: '#065f46' },
    { backgroundColor: '#fce7f3', color: '#9d174d' }
  ]

  // 2. 标签名称缓存
  const tagNameCache = ref({})

  // 3. 根据tagId的个位数获取颜色
  const getTagColorById = (tagId) => {
    // 处理非数字ID的情况
    if (typeof tagId !== 'number' && typeof tagId !== 'string') {
      return '#8c8c8c' // 默认灰色
    }
    // 转换为数字后取个位数
    const num = Number(tagId)
    const lastDigit = Math.abs(num) % 10 // 取绝对值避免负数问题
    return colorList[lastDigit] || '#8c8c8c'
  }

  // 4. 获取标签名称（优先本地defaultTags，找不到再请求后端）
  const getTagNameById = async (tagId) => {
    const cacheKey = String(tagId)
    if (tagNameCache.value[cacheKey] !== undefined) {
      return tagNameCache.value[cacheKey]
    }
    // 统一类型，优先本地查找
    const idNum = Number(tagId)
    const local = defaultTags.find((t) => Number(t.id) === idNum)
    if (local) {
      tagNameCache.value[cacheKey] = local.name
      return local.name
    }
    // 本地找不到再请求后端
    try {
      const response = await getTagsName(tagId)
      const tagName = response.data.name
      tagNameCache.value[cacheKey] = tagName
      return tagName
    } catch (error) {
      console.error(`获取标签ID ${tagId} 的名称失败`, error)
      tagNameCache.value[cacheKey] = `未知标签(${tagId})`
      showToast(`获取标签失败: ${tagId}`)
      return tagNameCache.value[cacheKey]
    }
  }

  // 5. 批量转换ID为名称数组（优先本地defaultTags，找不到再请求）
  const convertTagIdsToNames = async (tagIds) => {
    if (!Array.isArray(tagIds)) return []
    return Promise.all(
      tagIds.map(async (id) => {
        const idNum = Number(id)
        const local = defaultTags.find((t) => Number(t.id) === idNum)
        if (local) return local.name
        return getTagNameById(id)
      })
    )
  }

  // 6. 批量转换ID为颜色数组
  const convertTagIdsToColors = (tagIds) => {
    if (!Array.isArray(tagIds)) return []
    return tagIds.map((id) => getTagColorById(id))
  }

  // 7. 同时获取标签名称和颜色的对象数组
  const getTagsByIds = async (tagIds) => {
    if (!Array.isArray(tagIds)) return []
    const names = await convertTagIdsToNames(tagIds)
    const colors = convertTagIdsToColors(tagIds)
    return tagIds.map((id, index) => ({
      id,
      name: names[index],
      color: colors[index]
    }))
  }

  return {
    getTagNameById,
    getTagColorById,
    convertTagIdsToNames,
    convertTagIdsToColors,
    getTagsByIds,
    tagNameCache
  }
}
