<script setup>
import DailyCheckIn from './components/DailyCheckIn.vue'
import { useCheckInStore } from './store/checkIn'
const checkInStore = useCheckInStore()
</script>

<template>
  <router-view />
  <!-- 签到弹窗组件 -->
  <DailyCheckIn 
    v-if="checkInStore.showModal" 
    @close="checkInStore.setShowModal(false)"
  />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  min-height: 100vh;
}
</style>
