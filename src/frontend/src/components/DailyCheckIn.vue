<template>
  <div class="model-overlay">
    <div class="sign-model">
      <!--顶部导航栏-->
      <div class="nav">
        <span class="check-in-txt">每日签到！</span>
        <span class="close-btn" @click="handleClose">x</span>
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
              empty: !day,
              signed: day && isSignedDate(day),
              today: day && isToday(day)
            }"
          >
            {{ day ? day.getDate() : '' }}
            <span v-if="day && isSignedDate(day)" class="signed-mark">✓</span>
          </div>
        </div>
      </div>

      <!--明细文字-->
      <span class="detail-txt" v-if="showDetail">
        签到成功！连续签到{{ continuousDays }}天，你获得了{{ reward }}积分，目前积分余额{{
          credits
        }}，明天继续！
      </span>

      <!--确认按钮-->
      <div class="btn-container">
        <button class="confirm-btn" @click="handleButtonClick">
          {{ isCheckedIn ? '谢谢' : '签到' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCheckInStore } from '../store/checkIn'
import { getSignInDates, userSignIn } from '../api/user'

const checkInStore = useCheckInStore()

// 状态管理
const today = new Date()

// 当前显示的年月
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const signedDates = ref([])

// 从store获取签到相关状态
const isCheckedIn = computed(() => checkInStore.hasCheckedIn)
const continuousDays = computed(() => checkInStore.continuousDays)
const reward = computed(() => checkInStore.reward)
const credits = computed(() => checkInStore.credits)
const showDetail = ref(false)

// 初始化 - 获取已签到日期
onMounted(async () => {
  try {
    const res = await getSignInDates()
    signedDates.value = res.dates || []
  } catch (error) {
    console.error('获取已签到日期失败:', error)
  }
})

// 格式化日期为yyyy-mm-dd
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 切换月份
const changeMonth = (step) => {
  currentMonth.value += step
  // 处理年份切换
  if (currentMonth.value > 11) {
    currentMonth.value = 0
    currentYear.value++
  } else if (currentMonth.value < 0) {
    currentMonth.value = 11
    currentYear.value--
  }
}

// 计算当月天数数组（包含空白天数占位）
const daysInMonth = computed(() => {
  const days = []
  // 当月第一天
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  // 当月最后一天
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)

  // 填充月初空白天数
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null)
  }

  // 填充当月日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(currentYear.value, currentMonth.value, i))
  }

  return days
})

// 判断日期是否已签到
const isSignedDate = (date) => {
  return signedDates.value?.includes(formatDate(date)) || false
}

// 判断是否是今天
const isToday = (date) => {
  const dateString = formatDate(date)
  return signedDates.value.includes(dateString)
}

const handleButtonClick = () => {
  if (isCheckedIn.value) {
    handleConfirm()
  } else {
    handleCheckIn()
  }
}

// 处理签到逻辑
const handleCheckIn = async () => {
  try {
    const res = await userSignIn()
    continuousDays.value = res.continuous_days
    reward.value = res.reward
    credits.value = res.credits
    showDetail.value = true
  } catch (error) {
    console.error('签到失败:', error)
  }
}

// 确认按钮点击事件
const handleConfirm = () => {
  checkInStore.setShowModal(false) // 关闭弹窗
}

// 关闭按钮事件
const handleClose = () => {
  checkInStore.setShowModal(false)
}
</script>

<style>
.model-overlay {
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

.sign-model {
  background-color: #faf8f3;
  height: auto;
  width: 300px;
  border: 1.5px solid #d4a5a5;
  border-radius: 15px;
  padding: 20px 10px;
}

.nav {
  padding: 0 10px 8px 10px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-in-txt {
  font-size: 20px;
  color: #d4a5a5;
}

.close-btn {
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

.next-arrow,
.before-arrow {
  color: #444444;
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

.detail-txt {
  color: #d4a5a5;
  font-size: 16px;
  margin: 10px 8px;
  display: block;
  text-align: center;
}

.btn-container {
  background-color: rgba(212, 165, 165, 0.25);
  width: calc(100% + 20px);
  height: 80px;
  margin: 0 -10px -20px; /* 抵消父容器的padding */
  padding: 15px 10px; /* 内部间距 */
  box-sizing: border-box; /* 确保padding不影响宽度计算 */
  display: flex;
  justify-content: center;
  align-items: center;
}

.confirm-btn {
  color: white;
  font-size: 16px;
  width: 50%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
}

.day-cell.signed {
  background-color: #d4a5a5;
  color: #ffffff;
  position: relative;
}

.signed-mark {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 8px;
}

.detail-txt {
  color: #d4a5a5;
  font-size: 14px;
  margin: 10px 8px;
  display: block;
  text-align: center;
  min-height: 40px; /* 防止按钮跳动 */
}

.close-btn {
  cursor: pointer;
  color: #d4a5a5;
}
</style>
