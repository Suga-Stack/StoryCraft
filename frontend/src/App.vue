<template>
  <div class="app-container" :style="{ paddingTop: statusBarHeight + 'px' }">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar' // 引入插件

const statusBarHeight = ref(0)

onMounted(async () => {
  // 仅在原生平台获取状态栏高度
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await StatusBar.getInfo() // 插件API获取高度
      statusBarHeight.value = info.height || 0
    } catch (e) {
      statusBarHeight.value = 48 // 兜底值
    }
  }
})
</script>

<style>
.app-container {
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  overflow: auto;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100vh;
}

@media screen and (orientation: landscape) {
  .app-container {
    padding-top: 0 !important;
  }
}
</style>
