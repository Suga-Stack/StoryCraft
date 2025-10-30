import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import GameIntroduction from '../views/game_introduction.vue'
import GamePage from '../views/GamePage.vue'
import SettlementPage from '../views/SettlementPage.vue'
import CreateWork from '../views/CreateWork.vue'

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
    path: '/create',
    name: 'Create',
    component: CreateWork
  },
  {
    path: '/game/:id?',
    name: 'Game',
    component: GamePage
  },
  {
    path: '/settlement',
    name: 'Settlement',
    component: SettlementPage
  }
]

const router = createRouter({
  history: createWebHashHistory(), // 使用 Hash 模式（Capacitor 必需）
  routes
})

export default router
