<template>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1>StoreCraft</h1>
                <p>请登录您的账号继续使用</p>
            </div>
            
            <form @submit.prevent="handleLogin" class="login-form">
                <div class="form-group">
                    <label for="username" class="form-label">用户名</label>
                    <input 
                        type="text" 
                        id="username" 
                        v-model="username" 
                        required 
                        class="form-input"
                        placeholder="请输入用户名"
                    />
                </div>
                
                <div class="form-group">
                    <label for="password" class="form-label">密码</label>
                    <input 
                        type="password" 
                        id="password" 
                        v-model="password" 
                        required 
                        class="form-input"
                        placeholder="请输入密码"
                    />
                </div>
                
                <button type="submit" class="btn primary-btn">登录</button>
                
                <div class="register-link">
                    还没有账号？
                    <span @click="goToRegister" class="link">立即注册</span>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup>
import {ref} from 'vue';
import {useRouter} from 'vue-router';
import {showLoadingToast, showSuccessToast, showFailToast} from 'vant';
import http from '../utils/http';

const username = ref('');
const password = ref('');
const router = useRouter();

const handleLogin = async () => {
    if (!username.value){
        showFailToast('用户名不能为空');
        return;
    }
    if (!password.value){
        showFailToast('密码不能为空');
        return;
    }
    showLoadingToast('登录中...');

    try {
        const res = await http.post('auth/login/', {
                    username: username.value,
                    password: password.value
                });
        if (!res) {
        showFailToast('登录失败，未收到响应');
        return;
        }

        if (res.status !== 200) {
        showFailToast(`登录失败，HTTP状态码: ${res.status}`);
        return;
        }

        const { code: businessCode, message: businessMsg, tokens = {} } = res.data || {};

        if (typeof businessCode !== 'undefined' && businessCode !== 200) {
        showFailToast(businessMsg || '登录失败，业务处理出错');
        return;
        }

        // 5. 令牌检查更严谨，增加类型判断
        if (typeof tokens !== 'object' || !tokens.access) {
        showFailToast('登录失败，未获取到有效的访问令牌');
        return;
        }

        localStorage.setItem('token', String(tokens.access));
        if (tokens.refresh) {
        localStorage.setItem('refreshToken', String(tokens.refresh));
        }

        showSuccessToast('登录成功，即将跳转...');

        const preData = await http.get('users/preferences/');
        // 检查是否存在有效的偏好设置
        const haspreferences = preData.data && Array.isArray(preData.data.liked_tags) && preData.data.liked_tags.length > 0;

        if (haspreferences) {
            router.push('/bookstore');
        } else {
            router.push('/preferences');
        }

    } catch (error) {
        showFailToast('登录失败，请检查用户名和密码');
    }
}

const goToRegister = () => {
    router.push('/register');
    console.log('跳转到注册页');
};
</script>


<style scoped>
.login-container {
    min-height: 100vh;
    background: #faf8f3;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
}

.login-card {
    width: 100%;
    max-width: 400px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 30px;
    border-radius: 30px;
}

.login-header {
    text-align: center;
    margin-bottom: 30px;
}

.login-header h1 {
  font-family: 'Comic Neue', 'Brush Script MT', cursive;
  
  font-size: 3rem;
  line-height: 1.0;
 
  font-weight: 400; 
  font-style: italic; 
  
  color: #3d3d3d;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.08);
  
  letter-spacing: 0.03em;
  word-spacing: 0.05em;
  
  transform: rotate(-1deg);
  transition: transform 0.3s ease;
}

.login-header p {
    color: #666;
    margin-top: 15px;
    font-size: 12px;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-label {
    font-size: 14px;
    color: #333;
    font-weight: 500;
}

.form-input {
    padding: 12px 15px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: #a86464;
}

.btn {
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.primary-btn {
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

.divider {
    display: flex;
    align-items: center;
    margin: 15px 0;
}

.divider::before,
.divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e5e7eb;
}

.divider-text {
    padding: 0 10px;
    font-size: 12px;
    color: #999;
}

.register-link {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: #666;
}

.link {
    color: #a86464;
    cursor: pointer;
    margin-left: 4px;
}

.link:hover {
    text-decoration: underline;
}
</style>