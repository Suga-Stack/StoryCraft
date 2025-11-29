<template>
    <div class="model-overlay">
        <div class="sign-model">
            <!--顶部导航栏-->
            <div class="nav">
                <span class="check-in-txt">每日签到！</span>
                <span class="close-btn">x</span>
            </div>

            <!--签到日历-->
            <div class="calendar">
                <!-- 月份导航 -->
                <div class="calendar-header">
                <div class="before-arrow" @click="changeMonth(-1)"><</div>
                <h3>{{ currentYear }}年{{ currentMonth + 1 }}月</h3>
                <div class="next-arrow" @click="changeMonth(1)">></div>
                </div>

                <!-- 星期标题 -->
                <div class="weekdays">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                </div>

                <!-- 日期网格 -->
                <div class="days">
                <div 
                    v-for="(day, index) in daysInMonth" 
                    :key="index" 
                    class="day-cell"
                    :class="{
                    'empty': !day,
                    'signed': day && isSignedDate(day),
                    'today': day && isToday(day)
                    }"
                >
                    {{ day ? day.getDate() : '' }}
                </div>
                </div>   
            </div>

            <!--明细文字-->
            <span class="detail-txt">签到成功！连续签到{{continuousDays}}天，你获得了{{rewardCredits}}积分明天继续！</span>

            <!--确认按钮-->
            <div class="btn-container">
                <button class="confirm-btn" @click="handleConfirm">谢谢！</button>
            </div>    
                
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useUserStore } from '../store/index'  
import { useCheckInStore } from '../store/checkIn'

const userStore = useUserStore()
const checkInStore = useCheckInStore()

// 从后端获取的已签到日期列表
const signedDates = ref(['2025-11-24', '2025-11-25']); 
const today = new Date();

const continuousDays = ref(2)
const rewardCredits = ref(10)

// 当前显示的年月
const currentYear = ref(today.getFullYear());
const currentMonth = ref(today.getMonth());

// 切换月份
const changeMonth = (step) => {
  currentMonth.value += step;
  // 处理年份切换
  if (currentMonth.value > 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else if (currentMonth.value < 0) {
    currentMonth.value = 11;
    currentYear.value--;
  }
};

// 计算当月天数数组（包含空白天数占位）
const daysInMonth = computed(() => {
  const days = [];
  // 当月第一天
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  // 当月最后一天
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);
  
  // 填充月初空白天数（第一天是星期几就留几个空位）
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }
  
  // 填充当月日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(currentYear.value, currentMonth.value, i));
  }
  
  return days;
});

// 判断日期是否已签到
const isSignedDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return signedDates.value.includes(dateString);
};

// 判断是否是今天
const isToday = (date) => {
  return date.toDateString() === today.toDateString();
};

// 监听签到成功事件，更新用户积分
const handleCheckInSuccess = (data) => {
  console.log('签到成功，更新用户积分...');
  // 这里可以调用userStore的action来重新获取用户信息，以更新积分
  // 或者直接更新本地状态
  if (data.credits_added) {
    userStore.userInfo.user_credits += data.credits_added;
  }
  // 可以在这里显示一个全局的成功提示
  // showToast(data.message);
};

// 确认按钮点击事件
const handleConfirm = () => {
  // 假设通过接口请求签到，这里用模拟数据
  const checkInData = {
    credits_added: 10,
    message: '签到成功'
  };
  handleCheckInSuccess(checkInData);  // 调用处理函数
  checkInStore.setShowModal(false);  // 关闭弹窗
};
</script>

<style>
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

.sign-model{
    background-color: #faf8f3;
    height: auto;
    width: 300px;
    border: 1.5px solid #d4a5a5;
    border-radius: 15px;
    padding: 20px 10px;
}

.nav{
    padding:0 10px 8px 10px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}

.check-in-txt{
    font-size: 20px;
    color: #d4a5a5;
}

.close-btn{
    font-size: 22px;
    position: absolute;
    right: 20px;

}

.calendar {
  width: 250px;
  margin: 0 auto;
  padding: 16px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.calendar-header button {
  padding: 4px 12px;
  cursor: pointer;
}

.next-arrow, .before-arrow{
  color:#444444;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.weekdays span {
  text-align: center;
  font-weight: bold;
  color: #666;
  font-size: 11px;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.day-cell {
  aspect-ratio: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: 1px solid #eee;
  border-radius: 8px;
  position: relative;
  font-size: 11px;
}

.day-cell.empty {
  border: none;
}

.day-cell.signed {
  background-color: #d4a5a5;
  color: #ffffff;
}

.detail-txt{
    color: #d4a5a5;
    font-size: 16px; 
    margin: 10px 8px;
    display: block;
    text-align: center;
}

.btn-container{
    background-color: rgba(212, 165, 165, 0.25);
    width: calc(100% + 20px);
    height: 80px;        
    margin: 0 -10px -20px; /* 抵消父容器的padding */
    padding: 15px 10px;   /* 内部间距 */
    box-sizing: border-box; /* 确保padding不影响宽度计算 */
    display: flex;
    justify-content: center;
    align-items: center;
}

.confirm-btn{
  color: white;
  font-size: 16px;
  width: 50%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
}
</style>