import { ref } from 'vue';
import { getTagsName } from '../api/tags'; 
import { showToast } from 'vant';

export function useTags() {
  // 1. 定义10种预设颜色（对应0-9的个位数）
  const colorList = [
    '#ff4d4f', // 0-红色
    '#1890ff', // 1-蓝色
    '#52c41a', // 2-绿色
    '#faad14', // 3-黄色
    '#722ed1', // 4-紫色
    '#f5222d', // 5-深红
    '#13c2c2', // 6-青色
    '#fa8c16', // 7-橙色
    '#7b1fe4', // 8-深紫
    '#f7ba1e'  // 9-浅黄
  ];

  // 2. 标签名称缓存
  const tagNameCache = ref({});

  // 3. 根据tagId的个位数获取颜色
  const getTagColorById = (tagId) => {
    console.log('tagId:', tagId, '类型:', typeof tagId); // 检查ID格式
    // 处理非数字ID的情况
    if (typeof tagId !== 'number' && typeof tagId !== 'string') {
      return '#8c8c8c'; // 默认灰色
    }
    // 转换为数字后取个位数
    const num = Number(tagId);
    const lastDigit = Math.abs(num) % 10; // 取绝对值避免负数问题
    return colorList[lastDigit] || '#8c8c8c';
  };

  // 4. 获取标签名称（保留原有逻辑）
  const getTagNameById = async (tagId) => {
    if (tagNameCache.value[tagId] !== undefined) {
      return tagNameCache.value[tagId];
    }

    try {
      const response = await getTagsName(tagId);
      const tagName = response.data.name;
      tagNameCache.value[tagId] = tagName;
      return tagName;
    } catch (error) {
      console.error(`获取标签ID ${tagId} 的名称失败`, error);
      tagNameCache.value[tagId] = `未知标签(${tagId})`;
      showToast(`获取标签失败: ${tagId}`);
      return tagNameCache.value[tagId];
    }
  };
  
  // 5. 批量转换ID为名称数组
  const convertTagIdsToNames = async (tagIds) => {
    if (!Array.isArray(tagIds)) return [];
    const tagNames = await Promise.all(
      tagIds.map(id => getTagNameById(id))
    );
    return tagNames;
  };

  // 6. 批量转换ID为颜色数组
  const convertTagIdsToColors = (tagIds) => {
    if (!Array.isArray(tagIds)) return [];
    return tagIds.map(id => getTagColorById(id));
  };

  // 7. 同时获取标签名称和颜色的对象数组
  const getTagsByIds = async (tagIds) => {
    if (!Array.isArray(tagIds)) return [];
    const names = await convertTagIdsToNames(tagIds);
    const colors = convertTagIdsToColors(tagIds);
    return tagIds.map((id, index) => ({
      id,
      name: names[index],
      color: colors[index]
    }));
  };

  return {
    getTagNameById,
    getTagColorById,
    convertTagIdsToNames,
    convertTagIdsToColors,
    getTagsByIds,
    tagNameCache
  };
}