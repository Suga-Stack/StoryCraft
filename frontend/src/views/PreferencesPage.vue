<template>
  <div class="preferences-container">
    <van-nav-bar 
      :title="currentStep === 0 ? '选择性别' : '选择感兴趣的标签'" 
      :left-arrow="currentStep > 0"
      @click-left="handleBack"
    />
    
    <!-- 滑动容器 -->
    <div class="slider-container" :style="{ transform: `translateX(-${currentStep * 100}%)` }">
      <div class="slider-page">
        <!-- 性别选择页面 -->
        <div class="section gender-section">
          <h3 class="section-title">请选择您的性别</h3>
          <van-radio-group v-model="selectedGender" class="gender-radio-group">
            <van-radio name="Male" class="gender-radio">男</van-radio>
            <van-radio name="Female" class="gender-radio">女</van-radio>
            <van-radio name="Other" class="gender-radio">其他</van-radio>
          </van-radio-group>
          <p class="error-text" v-if="errors.gender">{{ errors.gender }}</p>
          
          <div class="next-btn-container">
            <van-button 
              type="primary" 
              round 
              block 
              @click="goToNextStep"
              class=" next-btn"
            >
              下一步
            </van-button>
          </div>
        </div>
      </div>
      
      <div class="slider-page">
        <!-- 标签选择页面 -->
        <div class="section tags-section">
          <h3 class="section-title">选择感兴趣的标签（至少选1个）</h3>

          <!-- 分类切换按钮 -->
          <div class="category-buttons">
            <van-button 
              v-for="(category, index) in categories" 
              :key="index"
              :type="currentCategory === index ? 'primary' : 'default'"
              @click="switchCategory(index)"
              round
              size="small"
            >
              {{ category.name }}
            </van-button>
          </div>
          
          <!-- 加载状态 -->
          <van-loading v-if="isLoadingTags" color="#c78c8c" size="24" class="loading-indicator" />
          
          <!-- 标签容器（加载完成且无错误时显示） -->
          <div v-else-if="!tagsError" class="tags-container">
            <van-tag 
              v-for="(tag, index) in filteredTags"  
              :key="tag.id"
              :name="tag.name"
              :checked="selectedTags.includes(tag.id)"
              @click="toggleTag(tag.id)"
              type="primary"
              class="custom-tag"
              :style="{
                backgroundColor: selectedTags.includes(tag.id) ? '#D4A5A5' : '#fff',
                color: selectedTags.includes(tag.id) ? '#ffffff' : '#444444',
                borderColor: selectedTags.includes(tag.id) ? '#e5b7b7' : '#b88484'
              }"
            >
              {{ tag.name }}
            </van-tag>
          </div>
          
          <!-- 错误提示 -->
          <p class="error-text" v-if="tagsError">{{ tagsError }}</p>
          <p class="error-text" v-if="errors.tags">{{ errors.tags }}</p>
          
          <div class="button-group">
            <van-button 
              type="info" 
              round 
              @click="goToPrevStep"
              class="prev-btn"
            >
              上一步
            </van-button>
            <van-button 
              type="primary" 
              round 
              @click="handleSubmit"
              :loading="isSubmitting"
              class="submit-btn"
              :disabled="isLoadingTags || !!tagsError"
            >
              保存偏好设置
            </van-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../store';
import { showToast, Loading } from 'vant';
import http from '../utils/http';

// 状态管理
const userStore = useUserStore();
const router = useRouter();

// 步骤控制
const currentStep = ref(0); // 0: 性别选择, 1: 标签选择

// 表单数据
const selectedGender = ref('');
const selectedTags = ref([]);
const isSubmitting = ref(false);
const errors = ref({
  gender: '',
  tags: ''
});

// 标签相关状态
const allTags = ref([]);
const isLoadingTags = ref(false);
const tagsError = ref('');

// 标签分类相关状态
const categories = ref([
  { name: '类型', range: [0, 15] },    // 类型标签：0-15
  { name: '风格', range: [16, 48] },   // 风格标签：16-48
  { name: '世界观', range: [49, 63] }, // 世界观标签：49-63
  { name: '题材', range: [64, 88] }    // 题材标签：64-88
]);
const currentCategory = ref(0); // 当前选中的分类索引，默认选中"类型"

// 筛选当前分类的标签
const filteredTags = computed(() => {
  const { range } = categories.value[currentCategory.value];
  const [min, max] = range;
  // 筛选出id在[min, max]范围内的标签
  return allTags.value.filter(tag => tag.id >= min && tag.id <= max);
});

// 切换分类
const switchCategory = (index) => {
  currentCategory.value = index;
  window.scrollTo(0, 0); // 切换时滚动到顶部
};

    const newTagsRes = await http.get('/api/tags/', {
      params: { page }
    });
    return {
      results: response.data?.results || [], // 当前页标签
      totalPages: Math.ceil((response.data?.count || 0) / 10) 
    };
  } catch (error) {
//  console.error(`获取第${page}页标签失败:`, error);
    throw error; // 抛出错误让外层处理
  }
};

// 获取所有标签
const fetchAllTags = async () => {
  isLoadingTags.value = true;
  tagsError.value = '';
  allTags.value = []; // 清空现有数据

  try {
    // 先请求第1页，获取总页数
    const firstPage = await fetchTagsPage(1);
    allTags.value.push(...firstPage.results); // 合并第1页数据

    // 如果总页数大于1，循环请求剩余页数
    if (firstPage.totalPages > 1) {
      // 从第2页循环到最后一页
      for (let page = 2; page <= firstPage.totalPages; page++) {
        const currentPage = await fetchTagsPage(page);
        allTags.value.push(...currentPage.results); // 合并当前页数据
      }
    }

  //console.log('全部标签加载完成，共', allTags.value.length, '条');
  } catch (error) {
    tagsError.value = '加载标签失败，请重试';
    showToast(tagsError.value);
  } finally {
    isLoadingTags.value = false;
  }
};

// 初始化：获取已保存的偏好和标签列表
onMounted(async () => {
  // 并行请求：同时获取偏好设置和标签列表
  try {
    
    await fetchAllTags();
    // 再获取用户偏好
    const res = await http.get('/api/users/preferences/');
    if (res.code === 200 && res.data?.preferences) {
      const { gender, favoriteTags } = res.data.preferences;
      selectedGender.value = gender || '';
      selectedTags.value = favoriteTags || [];
    }
  } catch (error) {
    console.error('初始化数据失败:', error);
  }
});


// 切换标签选择状态
const toggleTag = (tagId) => {
  const index = selectedTags.value.indexOf(tagId);
  if (index > -1) {
    selectedTags.value = selectedTags.value.filter(id => id !== tagId);
  } else {
    selectedTags.value.push(tagId);
  }
  errors.value.tags = ''; // 清除错误提示
};

// 步骤切换
const goToNextStep = () => {
  if (!selectedGender.value) {
    errors.value.gender = '请选择性别';
    return;
  }
  currentStep.value = 1;
  window.scrollTo(0, 0); // 滚动到顶部
};

const goToPrevStep = () => {
  currentStep.value = 0;
  window.scrollTo(0, 0); // 滚动到顶部
};

const handleBack = () => {
  if (currentStep.value > 0) {
    goToPrevStep();
  }
};

// 表单验证
const validateForm = () => {
  let isValid = true;
  errors.value = { gender: '', tags: '' };

  if (!selectedGender.value) {
    errors.value.gender = '请选择性别';
    isValid = false;
  }

  if (selectedTags.value.length === 0) {
    errors.value.tags = '请至少选择一个感兴趣的标签';
    isValid = false;
  }

  return isValid;
};

// 提交表单
const handleSubmit = async () => {
  if (!validateForm()) return;

  try {
    isSubmitting.value = true;
    
    const submitData = {
      gender: selectedGender.value,
      liked_tags: selectedTags.value.map(tagId => parseInt(tagId, 10)) // 转换为整数
    };

    const response = await http.put('/api/users/preferences/', submitData);

    if (response.status === 200) {
      userStore.setPreferences(response.data.preferences);
      showToast('偏好设置保存成功');
      router.push('/');
    } else {
      showToast(response.message || '保存失败，请重试');
    }
  } catch (error) {
    console.error('保存偏好设置失败:', error);
    showToast(error.response?.data?.message || '网络错误，请稍后重试');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.loading-indicator {
  text-align: center;
  padding: 20px 0;
}


.preferences-container {
  background-color: #f5f5f5;
  min-height: 100vh;
  overflow: hidden; /* 隐藏超出容器的内容 */
  position: relative;
}

/* 滑动容器样式 */
.slider-container {
  display: flex;
  transition: transform 0.3s ease; /* 滑动动画 */
  height: calc(100vh - 46px); /* 减去导航栏高度 */
}

.slider-page {
  width: 100%;
  flex-shrink: 0; /* 禁止收缩 */
  padding: 16px;
  background-color: #fff;
  box-sizing: border-box;
  overflow-y: auto; /* 允许页面内滚动 */
}

.section-title {
  font-size: 18px;
  color: #333;
  margin-bottom: 30px;
  font-weight: 500;
  text-align: center;
  padding-top: 20px;
}

/* 性别选择样式 */
.gender-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.gender-radio-group {
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
  padding: 0 20px;
}

.gender-radio {
  flex: 1;
  text-align: center;
  padding: 20px 0;
  font-size: 16px;
}

::v-deep .van-radio__icon--checked .van-icon {
  display: inline-block !important;
}

/* 标签选择样式 */
.tags-container {
  display: grid;
  margin: 0 auto;
  width: 94%;
  grid-template-columns: repeat(3, 1fr); /* 每3个标签一行 */
  gap: 8px;
  padding: 0 8px;
  border-radius: 15px;
  background-color: #ffffff;
  padding: 15px 20px;
}

.category-buttons {
  display: flex;
  gap: 8px;
  margin: 0 16px 20px;
  overflow-x: auto; /* 防止按钮过多时溢出 */
  padding-bottom: 8px;
}

/* 自定义按钮样式 */
::v-deep .van-button--primary {
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

::v-deep .van-button--default {
  background-color: #fff;
  color: #c78c8c;
  border: 1px solid #c78c8c;
}

::v-deep .custom-tag {
  border-radius: 12px; 
  padding: 10px 0; 
  font-size: 14px; 
  display: flex;
  justify-content: center;
  align-items: center;
  width: 90px;
}

/* 按钮样式 */
.next-btn-container {
  margin-top: auto;
  padding: 0 16px 30px;
}

.next-btn{
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

.button-group {
  display: flex;
  gap: 16px;
  margin-top: 40px;
  padding: 0 16px 30px;
}

.prev-btn, .submit-btn {
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

.error-text {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 5px;
  min-height: 18px;
  text-align: center;
}
</style>