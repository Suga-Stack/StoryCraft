<template>
  <!-- 路由出口：所有页面都会在这里渲染 -->
  <router-view />
</template>

<style>
/* 全局基础样式，作用于整个应用 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box; /* 确保padding和border不影响元素总宽度 */
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f5f5f5; /* 全局背景色，避免页面切换时出现白屏 */
  color: #333; /* 默认文字颜色 */
  -webkit-tap-highlight-color: transparent; /* 去除移动端点击元素时的默认高亮 */
}

/* 解决页面内容被底部导航栏遮挡的问题 */
#app {
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom); /* 适配移动端安全区域 */
}
</style>
    