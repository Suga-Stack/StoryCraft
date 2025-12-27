import { createRouter, createWebHashHistory } from 'vue-router'
import { isLogin, handleNotLogin } from '../utils/auth';
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
import TagWorksPage from '../views/TagWorksPage.vue';

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
 ,
  {
    path: '/staff',
    name: 'staff',
    component: () => import('../views/staff.vue')
  },
  {
    path: '/tag/:id',
    name: 'TagWorks',
    component: TagWorksPage,
    props: true // 允许将路由参数作为组件属性传递
  }
]

const router = createRouter({
  history: createWebHashHistory(), 
  routes
})

// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 需要登录的页面白名单
  const needLoginPages = ['/bookshelf', '/create', '/profile', '/mycreations', '/readinghistory', '/charge', '/preferences', '/settlement', '/game/:id?', '/works/:id', '/search', '/home', '/', '/staff', '/tag/:id'];
  
  if (needLoginPages.includes(to.path) && !isLogin()) {
    // 未登录且访问需要登录的页面，拦截并跳转登录页
    handleNotLogin(router, to);
  } else {
    next(); // 已登录或访问无需登录的页面，正常跳转
  }
});


export default router
