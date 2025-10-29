<template>
  <div class="register-container">
    <div class="register-card">
      <h2 class="title">账号注册</h2>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <!-- 用户名输入 -->
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            type="text"
            id="username"
            v-model="formData.username"
            @blur="validateUsername"
            placeholder="请输入用户名"
            required
          >
          <p class="error-message" v-if="errors.username">{{ errors.username }}</p>
        </div>

        <!-- 密码输入 -->
        <div class="form-group">
          <label for="password">密码</label>
          <input
            type="password"
            id="password"
            v-model="formData.password"
            @blur="validatePassword"
            placeholder="请输入密码"
            required
          >
          <p class="error-message" v-if="errors.password">{{ errors.password }}</p>
        </div>

        <!-- 确认密码输入 -->
        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="formData.confirmPassword"
            @blur="validateEmail"
            placeholder="请再次输入密码"
            required
          >
          <p class="error-message" v-if="errors.confirmPassword">{{ errors.confirmPassword }}</p>
        </div>

        <!-- 邮箱输入 -->
        <div class="form-group">
          <label for="email">邮箱</label>
          <input
            type="email"
            id="email"
            v-model="formData.email"
            @blur="validateConfirmPassword"
            placeholder="请输入邮箱"
            required
          >
          <p class="error-message" v-if="errors.confirmEmail">{{ errors.confirmEmail }}</p>
        </div>


        <!-- 验证码输入 -->
        <div class="form-group">
          <label for="verifyingCode">验证码</label>
          <input
            type="verifyingCode"
            id="verifyingCode"
            v-model="formData.verifyingCode"
            @blur="validateConfirmVerifyingCode"
            placeholder="请输入验证码"
            required
          >
          <p class="error-message" v-if="errors.confirmVerifyCode">{{ errors.confirmVerifyCode }}</p>
        </div>

        <!-- 发送验证码按钮 -->
        <button 
          type="verify" 
          class="verify-btn"
          :disabled="isVerifying"
          @click="handleVerify"
        >
          <span v-if="!isVerifying">发送验证码</span>
          <span v-if="isVerifying">验证中...</span>
        </button>

        <!-- 注册按钮 -->
        <button 
          type="submit" 
          class="register-btn"
          :disabled="isSubmitting"
        >
          <span v-if="!isSubmitting">注册</span>
          <span v-if="isSubmitting">注册中...</span>
        </button>

        <!-- 跳转登录 -->
        <div class="link-to-login">
          已有账号？<router-link to="/login">立即登录</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import http from '../utils/http'; 

// 表单数据
const formData = ref({
  username: '',
  password: '',
  confirmPassword: ''
});

// 错误信息
const errors = ref({
  username: '',
  password: '',
  confirmPassword: ''
});

// 状态控制
const isSubmitting = ref(false);
const router = useRouter();

// 表单验证
const validateUsername = () => {
  if (!formData.value.username.trim()) {
    errors.value.username = '用户名不能为空';
    return false;
  }
  if (formData.value.username.length < 3 || formData.value.username.length > 20) {
    errors.value.username = '用户名长度需在3-20个字符之间';
    return false;
  }
  errors.value.username = '';
  return true;
};

const validatePassword = () => {
  if (!formData.value.password) {
    errors.value.password = '密码不能为空';
    return false;
  }
  if (formData.value.password.length < 6) {
    errors.value.password = '密码长度不能少于6位';
    return false;
  }
  errors.value.password = '';
  return true;
};

const validateConfirmPassword = () => {
  if (formData.value.confirmPassword !== formData.value.password) {
    errors.value.confirmPassword = '两次输入的密码不一致';
    return false;
  }
  errors.value.confirmPassword = '';
  return true;
};

const validateEmail = () => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(formData.value.email)) {
    errors.value.confirmEmail = '请输入有效的邮箱地址';
    return false;
  }
  errors.value.confirmEmail = '';
  return true;
};

const validateConfirmVerifyingCode = () => {
  if (!formData.value.verifyingCode) {
    errors.value.confirmVerifyCode = '验证码不能为空';
    return false;
  }
  errors.value.confirmVerifyCode = '';
  return true;
};

// 整体验证
const validateForm = () => {
  const isUsernameValid = validateUsername();
  const isPasswordValid = validatePassword();
  const isConfirmValid = validateConfirmPassword();
  const isEmailValid = validateEmail();
  const isVerifyCodeValid = validateConfirmVerifyingCode();
  return isUsernameValid && isPasswordValid && isConfirmValid && isEmailValid && isVerifyCodeValid;
};

// 处理注册
const handleRegister = async () => {
  if (!validateForm()) return;

  try {
    isSubmitting.value = true;
    
    // 密码加密处理（实际项目中建议在前端进行简单加密，后端再进行二次加密）
    const encryptedPassword = btoa(formData.value.password); // 示例：Base64加密
    const encryptedConfirm = btoa(formData.value.confirmPassword);

    // 调用注册接口
    const response = await request.post('/api/auth/register', {
      username: formData.value.username,
      password: encryptedPassword,
      confirmPassword: encryptedConfirm,
      email: formData.value.email,
      verifyingCode: formData.value.verifyingCode
    });

    if (response.code === 200) {
      // 保存token和用户信息
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userInfo', JSON.stringify(response.data.user));
      
      // 提示成功并跳转首页或用户中心
      alert('注册成功！即将跳转到首页');
      router.push('/');
    } else {
      alert(response.message || '注册失败，请稍后重试');
    }
  } catch (error) {
    console.error('注册请求失败:', error);
    if (error.response) {
      // 处理后端返回的错误信息
      switch (error.response.status) {
        case 400:
          alert(error.response.data.message || '参数错误，请检查输入');
          break;
        case 409:
          alert('用户名已存在，请更换用户名');
          break;
        default:
          alert('服务器错误，请稍后重试');
      }
    } else {
      alert('网络错误，请检查网络连接');
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 400px;
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  color: #333;
  margin-bottom: 25px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

.error-message {
  color: #ff4d4f;
  font-size: 12px;
  margin-top: 5px;
  min-height: 18px;
}

.verify-btn {
  width: 100%;
  padding: 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-bottom: 15px;
}

.verify-btn:disabled {
  background-color: #a0d995;
  cursor: not-allowed;
}

.verify-btn:not(:disabled):hover {
  background-color: #359e75;
}

.register-btn {
  width: 100%;
  padding: 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.register-btn:disabled {
  background-color: #a0d995;
  cursor: not-allowed;
}

.register-btn:not(:disabled):hover {
  background-color: #359e75;
}

.link-to-login {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.link-to-login a {
  color: #42b983;
  text-decoration: none;
}

.link-to-login a:hover {
  text-decoration: underline;
}
</style>