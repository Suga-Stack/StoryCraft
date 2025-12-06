import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import Vant from 'vant'
import 'vant/lib/index.css'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const app = createApp(App)
const pinia = createPinia()


app.use(Vant)
app.use(pinia)
app.use(router)
app.mount('#app')

