import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import Vant from 'vant'
import 'vant/lib/index.css'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'

const app = createApp(App)
const pinia = createPinia()


app.use(Vant)
app.use(pinia)
app.use(router)
app.mount('#app')

// 尝试在原生平台隐藏状态栏（Android / iOS）。在 web 环境中该调用会被忽略。
try {
	if (Capacitor && Capacitor.getPlatform && Capacitor.getPlatform() !== 'web') {
		// 隐藏状态栏，若失败则静默忽略
		StatusBar.hide().catch(() => {})
	}
} catch (e) {
	// 忽略任何运行时错误（例如在纯浏览器环境）
}

