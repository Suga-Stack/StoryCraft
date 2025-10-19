import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import GameIntroduction from '../views/game_introduction.vue'
import GamePage from '../views/GamePage.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/works',
    name: 'Works',
    component: GameIntroduction
  },
  {
    path: '/game/:id?',
    name: 'Game',
    component: GamePage
  }
]

const router = createRouter({
  history: createWebHashHistory(), // 使用 Hash 模式（Capacitor 必需）
  routes
})

export default router
