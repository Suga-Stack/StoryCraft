import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import GameIntroduction from '../views/game_introduction.vue'
import GamePage from '../views/GamePage.vue'
import SettlementPage from '../views/SettlementPage.vue'
import CreateWork from '../views/CreateWork.vue'
import LoginPage from '../views/LoginPage.vue'
import RegisterPage from '../views/RegisterPage.vue'
import PreferencesPage from '../views/PreferencesPage.vue'
import BookshelfPage from '../views/BookshelfPage.vue'
import SearchPage from '../views/SearchPage.vue'
import BookstorePage from '../views/BookstorePage.vue'
import ProfilePage from '../views/ProfilePage.vue'
import MyCreationsPage from '../views/MyCreationsPage.vue'
import ReadingHistoryPage from '../views/ReadinghistoryPage.vue'
import CreditsChargePage from '../views/CreditsChargePage.vue'

const routes = [
   {
    path: '/home',
    name: 'Home',
    component: HomePage
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage
  },
  {
    path: '/works/:id',
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
  },
  {
    path: '/preferences',
    name: 'preferences',
    component: PreferencesPage
  },
  {
    path: '/bookshelf',
    name: 'bookshelf',
    component: BookshelfPage
  },
  {
    path: '/', 
    name: 'bookstore',
    component: BookstorePage
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage
  },
  {
    path: '/mycreations',
    name: 'mycreations',
    component: MyCreationsPage  
  },
  {
    path: '/readinghistory',
    name: 'readinghistory',
    component: ReadingHistoryPage  
  },
  {
    path: '/search',
    name: 'search',
    component: SearchPage
  },
  {
    path: '/charge',
    name: 'charge',
    component: CreditsChargePage
  }
]

const router = createRouter({
  history: createWebHashHistory(), // 使用 Hash 模式（Capacitor 必需）
  routes
})


export default router
