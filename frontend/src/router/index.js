import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../views/LoginPage.vue'
import RegisterPage from '../views/RegisterPage.vue'
import PreferencesPage from '../views/PreferencesPage.vue'
//import BookshelfPage from '../views/BookshelfPage.vue'
//import SearchPage from '../views/SearchPage.vue'
//import BookstorePage from '../views/BookstorePage.vue'
//import CreatePage from '../views/CreatePage.vue'
//import ProfilePage from '../views/ProfilePage.vue'
//import MyCreationsPage from '../views/MyCreationsPage.vue'

const routes = [
  {
    path: '/',
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
    