<template>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1>欢迎回来</h1>
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
                
                <div class="divider">
                    <span class="divider-text">其他登录方式</span>
                </div>
                
                <button 
                    type="button" 
                    class="btn wechat-btn"
                    @click="handleWeChatLogin"
                >
                    微信登录
                </button>
                
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
        const res = await http.post('/api/login', {
                    username: username.value,
                    password: password.value
                });
        const { code, message, data } = res;

        // 判断状态码是否成功
        if (code !== 200) {
        showFailToast(message || '登录失败，请重试');
        return;
        }

        const { token, user} = data || {};
        if (!token) {
        showFailToast('登录失败，未获取到令牌');
        return;
        }

        // 存储token
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        showSuccessToast('登录成功');

        const preData = await http.get('/api/preferences');
        const haspreferences = !!preData.value;
        if (haspreferences) {
            router.push('/bookstore');
        } else {
            router.push('/preferences');
        }
    } catch (error) {
        showFailToast('登录失败，请检查用户名和密码');
    }
}

const handleWeChatLogin = () => {
    // 微信登录逻辑
    showLoadingToast('微信登录暂未实现');
};

const goToRegister = () => {
    router.push('/register');
    console.log('跳转到注册页');
};
</script>


<style scoped>
.login-container {
    min-height: 100vh;
    background: #f5f7fa;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
}

.login-card {
    width: 100%;
    max-width: 400px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 30px;
}

.login-header {
    text-align: center;
    margin-bottom: 30px;
}

.login-header h1 {
    font-size: 24px;
    color: #333;
    margin-bottom: 8px;
}

.login-header p {
    color: #666;
    font-size: 14px;
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
    border-color: #4096ff;
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
    background: #4096ff;
    color: white;
}

.primary-btn:hover {
    background: #3688e6;
}

.wechat-btn {
    background: #07c160;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.wechat-btn:hover {
    background: #06b356;
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
    color: #4096ff;
    cursor: pointer;
    margin-left: 4px;
}

.link:hover {
    text-decoration: underline;
}
</style>