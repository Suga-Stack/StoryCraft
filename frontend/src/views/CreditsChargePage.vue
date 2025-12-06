<template>
  <div class="credits-charge-page">
    <!-- 顶部导航栏 -->
    <header class="top-nav">
      <div class="nav-container">
        <!-- 返回按钮 -->
        <button class="back-btn" @click="handleBack">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        
        <!-- 积分显示区域 -->
        <div class="points-display">
          <span class="points-label">积分:</span>
          <span class="points-value">{{ userPoints }}</span>
        </div>
      </div>
    </header>

    <!-- 主要内容区 -->
    <main class="main-content">
      <!-- 固定充值选项 - 2x2网格 -->
      <div class="recharge-grid">
        <div class="recharge-card" v-for="(item, index) in fixedRechargeOptions" :key="index" @click="handleRecharge(item)">
          <!-- 心形图标 -->
          <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="url(#heartGradient)" stroke="none">
            <!-- 定义渐变（与原风格保持一致） -->
            <defs>
              <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#d4a5a5" />
                <stop offset="100%" stop-color="#f68084" />
              </linearGradient>
            </defs>
            <!-- 心形路径 -->
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          
          <!-- 积分数量 -->
          <div class="recharge-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>{{ item.points }}积分</span>
          </div>
          
          <!-- 价格 -->
          <div class="recharge-price">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="price-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{{ item.price }}元</span>
          </div>
          
          <!-- 充值按钮 -->
          <button class="recharge-btn">充值</button>
        </div>
      </div>

      <!-- 积分流水标题 -->
      <div class="log-section-header" @click="toggleChargeLog">
        <span class="log-section-title">积分流水</span>
        <svg class="toggle-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'rotate': showChargeLog }">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <!-- 积分流水内容区 -->
      <div v-if="showChargeLog" class="credits-log-container">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading">加载中...</div>
        
        <!-- 空状态 -->
        <div v-if="!loading && creditsLog.length === 0" class="empty-log">
          暂无积分记录
        </div>
        
        <!-- 流水列表 -->
        <div class="log-list">
          <div class="log-item" v-for="(log, index) in creditsLog" :key="index">
            <div class="log-header">
              <span class="log-type">{{ formatLogType(log.type) }}</span>
              <span :class="['log-amount', log.change_amount > 0 ? 'increase' : 'decrease']">
                {{ log.change_amount > 0 ? '+' : '' }}{{ log.change_amount }}
              </span>
            </div>
            <div class="log-details">
              <span class="log-time">{{ formatDateTime(log.created_at) }}</span>
              <span class="log-balance">余额: {{ log.after_balance }}</span>
            </div>
            <div class="log-remark" v-if="log.remark">
              {{ log.remark }}
            </div>
          </div>
        </div>
        
        <!-- 分页控制 -->
        <div class="pagination" v-if="!loading && creditsLog.length > 0">
          <button 
            class="page-btn" 
            :disabled="currentPage <= 1" 
            @click="fetchCreditsLog(currentPage - 1)"
          >
            上一页
          </button>
          <span class="page-info">第 {{ currentPage }} 页</span>
          <button 
            class="page-btn" 
            :disabled="!hasMore" 
            @click="fetchCreditsLog(currentPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
      

      <!--充值弹窗-->
      <div class="model-overlay" v-if="showChargeModal" @click="showChargeModal=false">
        <div class="charge-model" @click.stop>
          <!--弹窗导航栏-->
          <div class="charge-nav">
            <span class="charge-text">充值信息</span>
            <span class="close-btn" @click="showChargeModal = false">x</span>
          </div>
          
          <!--弹窗充值信息卡片-->
          <div class="charge-card">
            <!-- 心形图标 -->
            <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="url(#heartGradient)" stroke="none">
              <!-- 定义渐变（与原风格保持一致） -->
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#d4a5a5" />
                  <stop offset="100%" stop-color="#f68084" />
                </linearGradient>
              </defs>
              <!-- 心形路径 -->
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            
            <!-- 积分数量 -->
            <div class="info-container">
            <div class="recharge-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>{{ selectedRechargeItem.points }}积分</span>
            </div>
            
            <!-- 价格 -->
            <div class="recharge-price">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="price-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{{ selectedRechargeItem.price }}元</span>
            </div>
          </div>

        </div>  
          
          <!--支付文字-->
          <div class="pay-text">支付方式</div>  

          <!--支付按钮-->
          <div class="wechat-pay-btn" @click="handlePaymentSuccess">
            <svg class="wechat-icon" viewBox="0 0 36.5419 42.1944" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="36.541901" height="42.194435" fill="none" customFrame="#000000">
              <g id="微信" style="mix-blend-mode:normal">
                <g style="mix-blend-mode:normal">
                  <rect id="矩形" width="36.541893" height="42.194443" x="0.000031" y="0.000008" opacity="0" fill="rgb(0,0,0)" />
                </g>
                <g style="mix-blend-mode:normal">
                  <path id="形状" d="M23.704 15.1859C24.0614 15.1859 24.4139 15.2161 24.7629 15.2599C23.812 10.1995 19.0761 6.43873 13.6709 6.43873C7.6275 6.43873 2.67676 11.1457 2.67676 17.1222C2.67676 20.5715 4.32419 23.4044 7.07612 25.6017L5.9767 29.3815L9.81962 27.1788C11.1956 27.4894 12.2983 27.8096 13.6709 27.8096C14.0158 27.8096 14.3572 27.7902 14.697 27.7591C14.482 26.9199 14.3572 26.0399 14.3572 25.1276C14.3572 19.6398 18.4817 15.1859 23.704 15.1859ZM10.0996 14.9201C9.27497 14.9201 8.44366 14.2892 8.44366 13.3478C8.44366 12.4025 9.27497 11.7795 10.0996 11.7795C10.9232 11.7795 11.4721 12.4025 11.4721 13.3478C11.4721 14.2893 10.9232 14.9201 10.0996 14.9201ZM19.1698 13.348C19.1698 12.4027 18.6217 11.7796 17.7938 11.7796C16.9693 11.7796 16.143 12.4027 16.143 13.348C16.143 14.2894 16.9692 14.9202 17.7938 14.9202C18.6217 14.9202 19.1698 14.2894 19.1698 13.348ZM24.4004 15.8606C29.3402 15.8606 33.7388 19.9543 33.7388 24.9768C33.7388 27.8097 32.0947 30.3181 29.8874 32.2106L30.7145 35.3492L27.6986 33.4626C26.5993 33.7779 25.4948 34.0915 24.4004 34.0915C19.1697 34.0915 15.0503 30.0065 15.0503 24.9768C15.0503 19.9543 19.1697 15.8606 24.4004 15.8606ZM21.3686 23.4045C20.8215 23.4045 20.2692 22.7824 20.2692 22.1476C20.2692 21.5217 20.8215 20.8918 21.3686 20.8918C22.1999 20.8918 22.7446 21.5217 22.7446 22.1476C22.7446 22.7824 22.1999 23.4045 21.3686 23.4045ZM26.3236 22.1476C26.3236 22.7824 26.8725 23.4045 27.4154 23.4045C28.2399 23.4045 28.7913 22.7824 28.7913 22.1476C28.7913 21.5217 28.2399 20.8918 27.4154 20.8918C26.8725 20.8918 26.3236 21.5217 26.3236 22.1476Z" fill="rgb(0,213,117)" fill-rule="evenodd" />
                </g>
              </g>
            </svg>

            <span class="wechat-pay-txt">微信支付</span>
          </div> 

          <div class="alipay-btn" @click="handlePaymentSuccess">
            <svg class="alipay-icon" viewBox="0 0 24.136 26.5901" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24.136047" height="26.590130" fill="none" customFrame="#000000">
              <g id="支付宝" style="mix-blend-mode:normal">
                <g style="mix-blend-mode:normal">
                  <rect id="矩形" width="24.136049" height="26.590130" x="0.000000" y="-0.000004" opacity="0" fill="rgb(0,0,0)" />
                </g>
                <g style="mix-blend-mode:normal">
                  <path id="形状" d="M24.136 13.2951C24.136 15.1448 23.7863 16.8982 23.1741 18.4975C21.8973 17.9387 18.0671 16.2816 15.3561 15.2219C16.5629 12.8519 16.9652 10.4434 16.9652 10.4434L13.0649 10.4434L13.0649 8.70923L17.9446 8.70923L17.9446 7.84216L13.0649 7.84216L13.0649 5.68412L11.2985 5.68412C10.9662 5.68412 10.9137 5.8768 10.9137 6.10802L10.9137 7.84216L6.41879 7.84216L6.41879 8.7285L10.9137 8.7285L10.9137 10.4626L7.18834 10.4626L7.18834 11.3297L14.4466 11.3297C14.2543 12.1582 13.9394 13.3529 13.4497 14.4897C11.7007 13.796 9.63693 13.2373 8.44762 13.218C7.64308 13.218 6.08648 13.2758 4.93215 14.5282C4.38996 15.087 4.19757 15.6843 4.09263 16.2238C4.05765 16.4358 4.04016 16.6477 4.05765 16.8404C4.04016 16.9368 4.04016 17.0524 4.05765 17.168C4.07514 17.3221 4.11012 17.4763 4.1451 17.6304C4.21506 17.9387 4.32 18.1314 4.32 18.1314C4.32 18.1192 4.32 18.0993 4.31559 18.0815C4.50591 18.4728 4.74449 18.7733 4.94964 19.037C5.3694 19.538 6.08648 20.0389 7.08341 20.2702C8.06284 20.5014 9.02478 20.3665 10.0742 20.0197C11.7532 19.4802 13.2398 18.2277 14.2368 16.956C16.353 18.0736 19.7636 19.9619 21.8449 21.0794C19.6411 24.4128 16.0907 26.5901 12.068 26.5901C5.42187 26.5901 0 20.617 0 13.2951C0 5.97314 5.42187 -3.8147e-06 12.068 -3.8147e-06C18.7142 -3.8147e-06 24.136 5.97314 24.136 13.2951ZM4.31559 18.0815C4.31302 18.0711 4.30895 18.0614 4.30251 18.0543C4.30685 18.0634 4.31121 18.0725 4.31559 18.0815ZM5.43935 14.9714C5.14202 15.2219 4.84469 15.588 4.75724 16.0697C4.63481 16.7056 4.73975 17.5148 5.28194 18.1507C5.96404 18.9022 6.99595 19.1141 7.45069 19.1526C8.65749 19.249 9.95174 18.5746 10.9312 17.8424C11.316 17.5534 11.9631 16.9561 12.5927 16.0312C11.1935 15.2412 9.44453 14.3549 7.5906 14.4319C6.61117 14.4705 5.92906 14.6824 5.43935 14.9714Z" fill="rgb(6,180,253)" fill-rule="evenodd" />
                </g>
              </g>
            </svg>

            <span class="alipay-txt" >支付宝支付</span>
          </div> 
        </div>
      </div> 

      <!--充值成功弹窗-->
      <div class="model-overlay" v-if="showChargeSuccessModal" @click="showChargeSuccessModal=false">
        <div class="charge-success-model" @click.stop>
          <!--弹窗充值信息卡片-->
          <div class="charge-card">
            <!-- 心形图标 -->
            <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="url(#heartGradient)" stroke="none">
              <!-- 定义渐变（与原风格保持一致） -->
              <defs>
                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#d4a5a5" />
                  <stop offset="100%" stop-color="#f68084" />
                </linearGradient>
              </defs>
              <!-- 心形路径 -->
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            
            <!-- 积分数量 -->
            <div class="info-container">
              <div class="recharge-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="info-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>{{ selectedRechargeItem.points }}积分</span>
              </div>
              
              <!-- 价格 -->
              <div class="recharge-price">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="price-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{{ selectedRechargeItem.price }}元</span>
              </div>
            </div>  
          </div>

          <!--支付成功文字-->
          <span class="pay-success-txt">支付成功！</span>

          <!--支付成功确认按钮-->
          <button class="confirm-btn" @click="showChargeSuccessModal = false">确认</button>
        </div>
      </div>
    </main>
  </div>
</template>


<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getUserInfo, rechargeCredits, getCreditsLog  } from '../api/user';
import { getCurrentUserId } from '../utils/auth.js';
import { showToast } from 'vant';

// 路由实例
const router = useRouter();

// 用户当前积分
const userPoints = ref(1250);

// 固定充值选项数据
const fixedRechargeOptions = ref([
  { points: 50, price: 10 },
  { points: 100, price: 20 },
  { points: 300, price: 50 },
  { points: 680, price: 100 }
]);

//弹窗显示
const showChargeModal = ref(false);
const showChargeSuccessModal = ref(false)

//充值对象
const selectedRechargeItem = ref(null);

//用户对象
const userInfo = ref({})

// 积分流水相关
const showChargeLog = ref(false);
const creditsLog = ref([]);
const currentPage = ref(1);
const loading = ref(false);
const hasMore = ref(true);

// 格式化日志类型
const formatLogType = (type) => {
  // 根据实际枚举值映射
  const typeMap = {
    'recharge': '积分充值',
    'consume': '积分消费',
    'reward': '任务奖励',
    'expire': '积分过期',
    'system': '系统调整',
    'other': '其他变动'
  };
  return typeMap[type] || type;
};

// 格式化日期时间
const formatDateTime = (datetime) => {
  if (!datetime) return '';
  const date = new Date(datetime);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 添加用户信息获取接口
const fetchUserInfo = async (userId) => {
  try {
    const response = await getUserInfo(userId)

    // 检查业务状态
    if (response.data.code && response.data.code !== 200) {
      throw new Error(`业务错误: ${response.data.message || '获取用户信息失败'}`);
    }

    return response.data;
  } catch (error) {
    const errorMsg = `获取用户信息失败: ${error.message}`;
    showToast(errorMsg);
    throw error;
  } 
}

const getUserIdFromStorage = () => {
  // 从 localStorage 读取用户信息
  try{
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id; // 返回 userId
    }
  }catch (err) {
    console.error('读取本地用户信息失败', err);
    localStorage.removeItem('userInfo'); // 清除无效数据
  }
  router.push('/login');
  return null;
}


// 返回上一页
const handleBack = () => {
  router.push('/profile');
};

// 处理固定金额充值
const handleRecharge = (item) => {
  selectedRechargeItem.value = item;
  showChargeModal.value = true; // 显示弹窗  
};

const handlePaymentSuccess = async () => {
  try {
    // 调用充值接口
    const response = await rechargeCredits(selectedRechargeItem.value.points);

    // 处理成功响应
    if (response.data.code === 200) {
      showChargeModal.value = false;
      showChargeSuccessModal.value = true;
      // 更新用户积分
      userPoints.value = response.data.new_credits;
      showToast(response.data.message || '充值成功');
    } else {
      showToast(response.data.message || '充值失败，请重试');
    }
  } catch (error) {
    console.error('充值接口调用失败:', error);
    showToast('网络错误，充值失败');
  }
};

// 从后端获取用户积分
const fetchUserPoints = async () => {
  try {
    const userId = getUserIdFromStorage();
    if (!userId) {
      showToast('请先登录');
      router.push('/login');
      return;
    }
    
    const userData = await fetchUserInfo(userId)
    userInfo.value = userData
    userPoints.value = userData.user_credits || 0;
  } catch (error) {
    console.error('获取用户积分失败:', error);
    showToast(error.message || '加载积分信息出错');
  }
};

const toggleChargeLog = () => {
  showChargeLog.value = !showChargeLog.value;
  // 如果是显示状态且还没有加载数据，就加载第一页
  if (showChargeLog.value && creditsLog.value.length === 0) {
    fetchCreditsLog(1);
  }
};

// 获取积分流水
const fetchCreditsLog = async (page) => {
  try {
    const userId = getUserIdFromStorage();
    if (!userId) return;
    
    loading.value = true;
    currentPage.value = page;
    
    const response = await getCreditsLog(page);
    if (response.status === 200) {
      creditsLog.value = page === 1 ? response.data : [...creditsLog.value, ...response.data.data];
      hasMore.value = response.data.has_more || false;
    } else {
      showToast(response.data.message || '获取积分流水失败');
    }
  } catch (error) {
    console.error('获取积分流水失败:', error);
    showToast('加载积分记录失败');
  } finally {
    loading.value = false;
  }
};

// 页面挂载时获取积分
onMounted(async () => {
  await fetchUserPoints();
  await fetchCreditsLog(1);
});
</script>

<style scoped>
.credits-charge-page {
  min-height: 100vh;
  background-color: #faf8f3;
  color: #2c1810;
}

/* 顶部导航 */
.top-nav {
  background-color: #faf8f3;
  padding: 8px 10px;
}

.nav-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background-color: transparent;
  color: #8B7355;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background-color: rgba(212, 165, 165, 0.2);
}

.points-display {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 14px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 4px #d4a5a5;
}

.points-label {
  color: #666;
  margin-right: 6px;
}

.points-value {
  color: #d4a5a5;
  font-weight: 600;
}

/* 主要内容区 */
.main-content {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

/* 充值选项网格 */
.recharge-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.recharge-card, .custom-recharge-card {
  background-color: rgba(212, 165, 165, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid #d4a5a5;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
}

.recharge-card:hover, .custom-recharge-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

/* 心形图标 */
.heart-icon {
  margin-bottom: 16px;
  filter: drop-shadow(0 0 12px rgba(212, 165, 165, 0.3)); /* 保持原阴影效果 */
}

/* 响应式调整 */
@media (max-width: 375px) {
  .heart-icon {
    width: 80px;
    height: 80px;
  }
}

/* 充值信息 */
.recharge-info, .recharge-price, .custom-amount {
  display: flex;
  align-items: center;
  color: #5a4533;
  margin-bottom: 8px;
}

.info-icon, .price-icon {
  margin-right: 6px;
  color: #8B7355;
}

/* 自定义金额输入 */
.amount-input-wrapper {
  position: relative;
}

.amount-input {
  width: 112px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(212, 165, 165, 0.35);
  padding: 4px 0;
  text-align: center;
  font-size: 14px;
  color: #2c1810;
  outline: none;
}

.amount-input:focus {
  border-color: #d4a5a5;
}

.amount-unit {
  position: absolute;
  right: -18px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

/* 充值按钮 */
.recharge-btn {
  background-color: #fff;
  border: 1px solid rgba(212, 165, 165, 0.35);
  color: #d4a5a5;
  border-radius: 20px;
  padding: 6px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.recharge-btn:hover {
  background-color: rgba(212, 165, 165, 0.1);
}

.recharge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #fff;
}

/* 响应式设计 */
@media (max-width: 375px) {
  .recharge-grid {
    gap: 12px;
  }
  
  .top-nav {
    padding: 12px 16px;
  }
  
  .main-content {
    padding: 20px 16px 36px;
  }
  
  .heart-icon {
    width: 50px;
    height: 45px;
  }
  
  .heart-icon::before,
  .heart-icon::after {
    width: 50px;
    height: 50px;
  }
  
  .heart-icon::before {
    top: -25px;
  }
  
  .heart-icon::after {
    right: -25px;
  }
}

/* 积分流水标题 */
.log-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin-bottom: 12px;
}

.log-section-title {
  font-size: 18px;
  font-weight: 600;
  color: #5a4533;
  margin-bottom: 0; /* 移除原有的margin-bottom */
}

/* 箭头样式及动画 */
.toggle-arrow {
  transition: transform 0.3s ease;
  color: #8B7355;
}

.toggle-arrow.rotate {
  transform: rotate(180deg);
}

/* 积分流水样式 */
.credits-log-container {
  margin-top: 16px;
}

.loading {
  text-align: center;
  padding: 40px 0;
  color: #8B7355;
}

.empty-log {
  text-align: center;
  padding: 60px 0;
  color: #8B7355;
  font-size: 16px;
}

.log-list {
  gap: 12px;
  display: flex;
  flex-direction: column;
}

.log-item {
  background-color: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(212, 165, 165, 0.1);
}

.log-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.log-type {
  font-weight: 600;
  color: #5a4533;
}

.log-amount {
  font-weight: 600;
}

.log-amount.increase {
  color: #4CAF50;
}

.log-amount.decrease {
  color: #F44336;
}

.log-details {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8B7355;
  margin-bottom: 8px;
}

.log-remark {
  font-size: 13px;
  color: #666;
  padding-top: 8px;
  border-top: 1px dashed rgba(212, 165, 165, 0.2);
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding: 12px 0;
}

.page-btn {
  background-color: white;
  border: 1px solid #d4a5a5;
  color: #d4a5a5;
  border-radius: 20px;
  padding: 6px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn:hover:not(:disabled) {
  background-color: #d4a5a5;
  color: white;
}

.page-info {
  color: #8B7355;
  font-size: 14px;
}

/*充值弹窗*/
.model-overlay{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3); /* 半透明黑色遮罩 */
  backdrop-filter: blur(5px); /* 背景虚化效果 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; 
  z-index: 1000; 
}

.charge-model{
  width: 100%;
  max-width: 300px;
  background-color: #faf8f3;
  border-radius: 16px;
  overflow: hidden;
  padding: 10px 20px;
}

.charge-nav{
  padding: 8px 10px;
  justify-content: center;
  display: flex;
  position: relative;
}

.charge-text{
  font-size: 17px;
  color:#444444;
  text-align: center;
}

.close-btn{
  position:absolute;
  right: 0px;
  width: 30px;
  height: 30px;
}

.charge-card{
  background-color: rgba(212, 165, 165, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid #d4a5a5;
  border-radius: 16px;
  padding: 5px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s ease;
}

.charge-card:hover{
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.charge-card .heart-icon{
  height: 80px;
  width: 80px;
  margin-right: 12px;
}

.charge-card .info-container {
  display: flex;
  flex-direction: column;
  flex: 1;
}


.charge-card .recharge-info {
  font-size: 16px;
  margin-bottom: 12px;
}

.charge-card .recharge-price {
  font-size: 22px;
  font-weight: 600;
  color: #f68084;
}

.pay-text{
  text-align: center;
  font-size: 16px;
  color: #444444;
  margin-top: 40px;
}

.wechat-icon, .alipay-icon{
  height: 30px;
  width: 30px;
  margin-right: auto;
}

.wechat-pay-txt, .alipay-txt{
  font-size: 16px;
  color: #d4a5a5;
}

.wechat-pay-btn, .alipay-btn{
  background-color: #fff;
  border: 1px solid rgba(212, 165, 165, 0.35);
  color: #d4a5a5;
  border-radius: 20px;
  padding: 6px 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
  display: flex;          /* 启用弹性布局 */
  align-items: center;    /* 垂直居中 */
  justify-content: center;
}

.alipay-btn{
  margin-bottom: 30px;
}

/*支付成功弹窗*/
.charge-success-model{
  width: 100%;
  max-width: 300px;
  background-color: #faf8f3;
  border-radius: 16px;
  overflow: hidden;
  padding: 30px 20px;
}

.pay-success-txt{
  font-size: 20px;
  color: #d4a5a5;
  display: block;
  text-align: center;
  margin: 15px;
}

.confirm-btn{
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
}
</style>