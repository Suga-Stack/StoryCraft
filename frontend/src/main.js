import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import Vant from 'vant'
import 'vant/lib/index.css'
import { useUserStore } from './store'

// 导入Vant组件
import { 
  Button, Cell, CellGroup, Tabbar, TabbarItem, NavBar, 
  Field, Toast, Tabs, Tab, List, Grid, GridItem, Empty, 
  Icon, RadioGroup, Radio, Tag, Dialog, Search,
  Swipe, SwipeItem, Divider, Loading, Image, Row, Col, Popup, showToast
} from 'vant'
import 'vant/lib/index.css'

// 创建应用实例
const app = createApp(App)

// 1. 注册所有需要的Vant组件
app.use(Button)
app.use(Cell)
app.use(CellGroup)
app.use(Tabbar)
app.use(TabbarItem)
app.use(NavBar)
app.use(Field)
app.use(Toast)
app.use(Tabs)
app.use(Tab)
app.use(List)
app.use(Grid)
app.use(GridItem)
app.use(Empty)
app.use(Icon)
app.use(RadioGroup)
app.use(Radio)
app.use(Tag)
app.use(Dialog)
app.use(Search)
app.use(Swipe)
app.use(SwipeItem)
app.use(Divider)
app.use(Loading)
app.use(Image)
app.use(Row)
app.use(Col)
app.use(Popup)
app.use(pinia)

// 2. 注册路由和状态管理
app.use(router)
app.use(store)

async function initApp() {
  // 暂时注释所有可能出错的代码，只保留挂载逻辑
  app.mount('#app') // 直接挂载，不依赖其他初始化
}

// 启动应用初始化流程
initApp()

