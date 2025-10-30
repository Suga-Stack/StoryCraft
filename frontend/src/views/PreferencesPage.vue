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
            <van-radio name="male" class="gender-radio">男</van-radio>
            <van-radio name="female" class="gender-radio">女</van-radio>
            <van-radio name="other" class="gender-radio">其他</van-radio>
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
          <div class="tags-container">
            <van-tag 
              v-for="(tag, index) in allTags"  
              :key="tag.id"
              :name="tag.id"
              :checked="selectedTags.includes(tag.id)"
              @click="toggleTag(tag.id)"
              type="primary"
              class="custom-tag"
              :style="{
              backgroundColor: selectedTags.includes(tag.id) ? '#e5b7b7' : '#fff',
              color: selectedTags.includes(tag.id) ? '#fff' : '#c78c8c',
              borderColor: '#c78c8c'
            }" 
            >
              {{ tag.name }}
            </van-tag>
          </div>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../store';
import { showToast } from 'vant';
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

// 所有可选标签
const allTags = ref([
  { id: '1', name: '科幻' },
  { id: '2', name: '悬疑' },
  { id: '3', name: '爱情' },
  { id: '4', name: '历史' },
  { id: '5', name: '武侠' },
  { id: '6', name: '都市' },
  { id: '7', name: '奇幻' },
  { id: '8', name: '推理' },
  { id: '9', name: '青春' },
  { id: '10', name: '军事' }
]);

// 初始化：获取已保存的偏好
onMounted(async () => {
  try {
    const res = await http.get('/users/preferences/');
    if (res.code === 200 && res.data?.preferences) {
      const { gender, favoriteTags } = res.data.preferences;
      selectedGender.value = gender || '';
      selectedTags.value = favoriteTags || [];
    }
    else {
      console.log('未获取到偏好设置');
    }
  } catch (error) {
    console.error('获取偏好设置失败:', error);
    if (error.response?.data?.message) {
      showToast(error.response.data.message);
    }
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
    
    const response = await http.put('/users/preferences/', {
      gender: selectedGender.value,
      liked_tags: selectedTags.value
    });

    if (response.code === 200) {
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
  width: 80%;
  grid-template-columns: repeat(3, 1fr); /* 每3个标签一行 */
  gap: 12px;
  padding: 0 8px;
}

::v-deep .custom-tag{
  border-radius: 12px; 
  padding: 14px 0; 
  font-size: 17px; 
  display: flex;
  justify-content: center;
  align-items: center;
  width: 80px;
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