import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../views/LoginPage.vue'
import RegisterPage from '../views/RegisterPage.vue'
import PreferencesPage from '../views/PreferencesPage.vue'
import BookshelfPage from '../views/BookshelfPage.vue'
import SearchPage from '../views/SearchPage.vue'
import BookstorePage from '../views/BookstorePage.vue'
import ProfilePage from '../views/ProfilePage.vue'
import MyCreationsPage from '../views/MyCreationsPage.vue'
import ReadingHistoryPage from '../views/ReadinghistoryPage.vue'

const routes = [
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
    