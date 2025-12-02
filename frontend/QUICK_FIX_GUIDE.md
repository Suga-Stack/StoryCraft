# 🚀 快速修复和测试指南

## ✅ 已修复的问题

我已经修复了 Android 应用无法发送请求的问题。主要修改包括:

### 1. **Capacitor 配置** (`capacitor.config.json`)
- 将 `androidScheme` 改为 `https` (更安全更稳定)
- 移除了 `hostname` 配置
- 添加了 `allowNavigation` 白名单,允许访问后端 API

### 2. **HTTP 客户端** (`src/service/http.js`)
- 添加了 Capacitor 环境自动检测
- 增强了调试日志输出
- 确保在所有环境下使用正确的 API URL

### 3. **流式传输** (`src/service/stream.js`)
- 为 SSE 和 WebSocket 添加了 Capacitor 环境检测
- 增加了详细的连接日志

### 4. **构建配置** (`vite.config.js` 和 `package.json`)
- 支持多环境构建(android/development/production)
- 正确加载和注入环境变量
- 优化了代码分割

## 🎯 立即测试

### 步骤 0: 确保后端服务运行

```powershell
# 在新的 PowerShell 窗口中启动后端
cd D:\homework\softwork\StoryCraft\backend
python manage.py runserver 0.0.0.0:8000
```

### 步骤 1: 清理并重新构建

在 PowerShell 中执行:

```powershell
# 进入前端目录
cd D:\homework\softwork\StoryCraft\frontend

# 清理旧的构建文件
if (Test-Path dist) { Remove-Item -Recurse -Force dist }

# 使用 Android 模式构建
npm run build:android
```

### 步骤 2: 打开 Android Studio

```powershell
# 自动打开 Android Studio
npm run cap:android
```

或手动打开:
1. 打开 Android Studio
2. 打开项目: `D:\homework\softwork\StoryCraft\frontend\android`

### 步骤 3: 运行并调试

1. **在 Android Studio 中**:
   - 选择模拟器或连接真机
   - 点击 Run 按钮 (绿色三角形)

2. **启用 Chrome DevTools 调试**:
   - 在 Chrome 浏览器打开: `chrome://inspect/#devices`
   - 等待应用启动,找到 "com.f4.storycraft"
   - 点击 "inspect" 打开开发者工具

3. **查看日志**:
   在 Console 中应该看到:
   ```
   [HTTP Client] 初始化,BASE_URL: http://82.157.231.8:8000
   [getBaseURL] Capacitor 环境,使用远程服务器
   ```

4. **测试功能**:
   - 尝试登录
   - 查看 Network 标签,应该能看到请求发送到 `http://82.157.231.8:8000/api/...`
   - 检查请求状态码和响应

## 🔍 验证修复成功的标志

✅ **成功的标志**:
- Console 显示正确的 BASE_URL
- Network 标签显示请求已发送
- 能够成功登录或获取数据
- 没有 CORS 错误
- 没有 "net::ERR_CLEARTEXT_NOT_PERMITTED" 错误

❌ **仍有问题的标志**:
- Console 没有日志输出
- Network 标签为空
- 显示连接错误
- CORS 错误

## 🐛 如果仍有问题

### 问题 1: 模拟器能访问,真机不能

**原因**: 真机无法访问该 IP

**解决方案**:
1. 确保真机和服务器在同一网络
2. 或者使用公网 IP (当前已配置 82.157.231.8)
3. 检查防火墙设置

### 问题 2: 完全没有网络请求

**检查**:
1. Android 权限:打开 `AndroidManifest.xml`,确认有 `<uses-permission android:name="android.permission.INTERNET" />` (✅已配置)
2. 网络安全配置:检查 `network_security_config.xml` (✅已配置)
3. 后端是否运行:访问 `http://82.157.231.8:8000/api/` 测试

### 问题 3: CORS 错误

后端 CORS 已配置为允许所有来源 (`CORS_ALLOW_ALL_ORIGINS = True`),应该不会有 CORS 问题。

如果仍有 CORS 错误,检查后端是否正确安装了 `django-cors-headers`:

```bash
pip install django-cors-headers
```

## 📱 网页版 vs 应用版区别

### 网页版 (模拟器浏览器 chrome://inspect)
- URL: `http://localhost:5173` 或开发服务器地址
- 使用开发服务器代理,避免 CORS
- 热重载支持

### 应用版 (APK/模拟器应用)
- 从 `capacitor://localhost` 或 `https://localhost` 加载
- 直接请求后端 API,需要后端 CORS 支持
- 需要重新构建才能看到更改

## 📝 环境变量说明

当前配置 (`.env.android`):
```dotenv
VITE_API_BASE_URL=http://82.157.231.8:8000
VITE_WS_BASE_URL=ws://82.157.231.8:8000
VITE_USE_MOCK=false
VITE_DEBUG=true
```

这个配置:
- ✅ 适用于 Android 模拟器
- ✅ 适用于真机(如果在同一网络或使用公网 IP)
- ✅ 适用于调试(VITE_DEBUG=true)

## 🎉 预期结果

修复成功后,你应该能够:
1. 在 Android 模拟器中正常运行应用
2. 成功发送和接收 API 请求
3. 登录、浏览作品、开始游戏等功能正常
4. 在 Chrome DevTools 中看到详细的网络日志

## 📚 更多信息

详细的调试指南请参考: `ANDROID_DEBUG.md`

## 🆘 需要帮助?

如果问题仍然存在,请提供:
1. Chrome DevTools Console 的完整日志
2. Network 标签的截图
3. Android Logcat 日志
4. 具体的错误信息
