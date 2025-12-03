# Android 应用调试指南

## 问题诊断

如果 Android 应用(APK 或 Android Studio 模拟器)无法发送请求,但网页版可以正常运行,通常是以下原因:

1. **环境变量未正确加载** - Android 构建时没有使用正确的 `.env` 文件
2. **网络权限配置问题** - Android 需要额外的网络安全配置
3. **Capacitor 配置问题** - scheme 和导航配置不正确
4. **CORS 问题** - 后端 CORS 设置不允许来自应用的请求

## 已修复的问题

### 1. Capacitor 配置修复
- 将 `androidScheme` 从 `http` 改为 `https` (更安全)
- 删除了 `hostname` 配置(避免路由冲突)
- 添加了 `allowNavigation` 白名单,允许访问后端 API 地址

### 2. 环境变量支持
- 更新了 `vite.config.js` 支持多环境构建
- 添加了 `build:android` 脚本使用 `.env.android` 配置
- 在代码中添加了 Capacitor 环境检测

### 3. HTTP 客户端改进
- 添加了 Capacitor 环境检测逻辑
- 增强了日志输出,便于调试
- 确保在 Android 环境中使用正确的 API URL

### 4. 网络安全配置
- Android 清单文件已配置 `usesCleartextTraffic="true"`
- 网络安全配置文件已添加后端服务器域名

## 构建步骤

### 方式一:使用 Android 模式构建(推荐)

```powershell
# 1. 清理之前的构建
cd D:\homework\softwork\StoryCraft\frontend
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 2. 使用 Android 模式构建
npm run build:android

# 3. 打开 Android Studio
npm run cap:android
```

### 方式二:手动构建

```powershell
# 1. 使用 .env.android 配置
$env:NODE_ENV="android"

# 2. 构建项目
npm run build

# 3. 同步到 Android
npx cap sync android

# 4. 打开 Android Studio
npx cap open android
```

## 调试方法

### 1. Chrome DevTools 调试

在 Android 设备/模拟器运行应用后:

1. 在 Chrome 浏览器打开: `chrome://inspect/#devices`
2. 找到你的应用并点击 "inspect"
3. 查看 Console 标签页的日志输出
4. 检查 Network 标签页的请求

### 2. 检查日志输出

应用会输出以下关键日志:

```javascript
[HTTP Client] 初始化,BASE_URL: http://storycraft.work.gd
[getBaseURL] Capacitor 环境,使用远程服务器
[HTTP] GET http://storycraft.work.gd/api/...
[buildHeaders] 已添加 Authorization header
```

### 3. Logcat 调试(Android Studio)

在 Android Studio 底部的 Logcat 面板:

1. 选择你的设备
2. 过滤包名: `com.f4.storycraft`
3. 查看网络请求日志

## 常见问题排查

### 问题 1: 网络请求显示 "net::ERR_CLEARTEXT_NOT_PERMITTED"

**原因**: Android 9+ 默认禁止明文 HTTP 流量

**解决**:
- ✅ 已在 `AndroidManifest.xml` 中设置 `usesCleartextTraffic="true"`
- ✅ 已配置 `network_security_config.xml` 允许指定域名

### 问题 2: 请求被 CORS 拦截

**原因**: 后端 CORS 配置不允许来自应用的请求

**解决**:
检查后端 Django 设置:

```python
# backend/project/settings.py
CORS_ALLOWED_ORIGINS = [
    "http://storycraft.work.gd",
    "https://capacitor://localhost",  # Capacitor iOS
    "capacitor://localhost",  # Capacitor Android
]

# 或者开发时允许所有来源
CORS_ALLOW_ALL_ORIGINS = True
```

### 问题 3: 环境变量未生效

**症状**: 应用使用默认 URL 而不是 `.env.android` 中的配置

**解决**:
1. 确保 `.env.android` 文件存在且格式正确
2. 使用 `npm run build:android` 而不是 `npm run build`
3. 检查 `vite.config.js` 中的 `loadEnv` 配置

### 问题 4: 模拟器可以但真机不行

**原因**: 真机无法访问 `10.0.2.2` (模拟器专用地址)

**解决**:
使用公网 IP 或局域网 IP:

```dotenv
# .env.android
VITE_API_BASE_URL=http://storycraft.work.gd  # 公网 IP
# 或
VITE_API_BASE_URL=http://192.168.1.100:8000  # 局域网 IP
```

## 环境变量配置说明

### .env.android (Android 构建专用)

```dotenv
VITE_API_BASE_URL=http://storycraft.work.gd
VITE_WS_BASE_URL=ws://storycraft.work.gd
VITE_USE_MOCK=false
VITE_DEBUG=true
```

### .env.development (网页开发)

```dotenv
VITE_API_BASE_URL=http://storycraft.work.gd
VITE_WS_BASE_URL=ws://storycraft.work.gd
VITE_USE_MOCK=false
VITE_DEBUG=true
```

### .env.production (生产环境)

```dotenv
VITE_API_BASE_URL=http://storycraft.work.gd
VITE_WS_BASE_URL=ws://storycraft.work.gd
VITE_USE_MOCK=false
VITE_DEBUG=false
```

## 验证修复

1. **清理并重新构建**:
   ```powershell
   npm run build:android
   ```

2. **检查构建输出**:
   - 确认使用了正确的环境变量
   - 查看 `dist/index.html` 是否正确

3. **在 Android Studio 中运行**:
   - 打开 Chrome DevTools (`chrome://inspect`)
   - 查看 Console 日志确认 BASE_URL
   - 测试登录或其他 API 请求

4. **检查网络请求**:
   - DevTools Network 标签应该显示请求
   - 请求 URL 应该是 `http://storycraft.work.gd/api/...`
   - 响应状态应该是 200 或其他正常状态码

## 性能优化建议

1. **使用 HTTPS**: 生产环境建议使用 HTTPS 和 WSS
2. **启用缓存**: 配置 Service Worker 缓存静态资源
3. **代码分割**: 已在 `vite.config.js` 中配置
4. **图片优化**: 使用 WebP 格式,压缩图片

## 相关文件

- `capacitor.config.json` - Capacitor 配置
- `vite.config.js` - Vite 构建配置
- `src/service/http.js` - HTTP 客户端
- `src/service/config.js` - API 配置
- `android/app/src/main/AndroidManifest.xml` - Android 清单
- `android/app/src/main/res/xml/network_security_config.xml` - 网络安全配置

## 下一步

如果问题仍然存在:

1. 检查后端 CORS 配置
2. 确认后端服务器可访问
3. 查看完整的 Logcat 日志
4. 使用网络抓包工具(如 Charles)分析请求
