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
            v-model="formData.confirm_password"
            @blur="validateConfirmPassword"
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
            @blur="validateEmail"
            placeholder="请输入邮箱"
            required
          >
          <p class="error-message" v-if="errors.confirmEmail">{{ errors.confirmEmail }}</p>
        </div>


        <!-- 验证码输入 -->
        <div class="form-group">
          <label for="verifyingCode">验证码</label>
          <input
            type="text"
            id="verifyingCode"
            v-model="formData.email_code"
            placeholder="请输入验证码"
            required
          >
          <p class="error-message" v-if="errors.confirmVerifyCode">{{ errors.confirmVerifyCode }}</p>
        </div>

        <!-- 发送验证码按钮 -->
        <button 
          type="button" 
          class="verify-btn"
          :disabled="isVerifying || countDown > 0"  
          @click="handleVerify"
        >
          <span v-if="!isVerifying && countDown === 0">发送验证码</span>
          <span v-if="isVerifying">验证中...</span>
          <span v-if="countDown > 0">{{ countDown }}秒后重新发送</span>  
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
import { ref, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import http from '../utils/http'; 

const countDown = ref(0);
const timer = ref(null);

// 表单数据
const formData = ref({
  username: '',
  password: '',
  confirm_password: '',
  email: '',
  email_code: ''
});

// 错误信息
const errors = ref({
  username: '',
  password: '',
  confirm_password: '',
  confirmEmail: '',
  confirmVerifyCode: ''
});

// 状态控制
const isSubmitting = ref(false);
const router = useRouter();
const isVerifying = ref(false); 

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
  if (formData.value.confirm_password !== formData.value.password) {
    errors.value.confirm_password = '两次输入的密码不一致';
    return false;
  }
  errors.value.confirm_password = '';
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
  if (!formData.value.email_code) {
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

// 处理发送验证码
const handleVerify = async () => {
  // 先验证邮箱格式
  if (!validateEmail()) {
    return;
  }

  try {
    isVerifying.value = true;
    
    // 调用发送验证码接口
    const response = await http.post('/api/auth/send-email-code/', {
      email: formData.value.email
    });
    if (response.data.code === 200) {
      alert('验证码已发送，请查收');
      // 开始倒计时
      countDown.value = 60;
      timer.value = setInterval(() => {
        countDown.value--;
        if (countDown.value <= 0) {
          clearInterval(timer.value);
        }
      }, 1000);
    } else {
      alert(response.message || '发送验证码失败');
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    alert('发送验证码失败，请稍后重试');
  } finally {
    isVerifying.value = false;
  }
};

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timer.value) {
    clearInterval(timer.value);
  }
});

// 处理注册
const handleRegister = async () => {
  if (!validateForm()) return;

  try {
    isSubmitting.value = true;

    // 调用注册接口
    const response = await http.post('/api/auth/register/', {
      username: formData.value.username,
      password: formData.value.password,
      confirm_password: formData.value.confirm_password,
      email: formData.value.email,
      email_code: formData.value.email_code
    });

    // 兼容后端返回结构：后端可能返回 { code: 200, message: '注册成功', data: { tokens, user } }
    const resData = response?.data || {};
    const code = resData.code || response.status;

    if (code === 200 || code === 201) {
      // 注册成功：尝试从响应中提取 tokens 与 user
      const tokens = (resData.data && (resData.data.tokens || resData.data.tokens)) || resData.tokens || {};
      const user = (resData.data && resData.data.user) || resData.user || null;

      if (tokens && tokens.access) {
        localStorage.setItem('token', tokens.access);
      }
      if (tokens && tokens.refresh) {
        localStorage.setItem('refreshToken', tokens.refresh);
      }
      if (user) {
        localStorage.setItem('userInfo', JSON.stringify(user));
      }

      // 根据需求跳转到偏好设置页面
      router.push('/preferences');
    } else {
      // 处理正常响应中的错误信息
      const msg = resData.message || (resData.data && resData.data.message) || '注册失败，请稍后重试';
      const errorMsg = Array.isArray(msg) ? msg.join('; ') : msg;
      alert(errorMsg);
    }
  }// 处理注册
  catch (error) {
    console.error('注册错误详情:', {
      status: error.response?.status,
      data: error.response?.data, // 打印后端返回的错误信息（可能包含具体原因）
      config: error.config // 打印请求配置（参数、URL等）
    });
    
    console.error('注册请求失败:', error);
    if (error.response) {
      // 1. 提取嵌套的错误信息（核心修改）
      const errorData = error.response.data;
      // 后端错误信息可能在 errorData.message.message 中，且是数组
      const rawMessages = errorData.message?.message || [];

      // 2. 将数组转换为字符串（解决类型警告）
      let errorMsg = '';
      if (Array.isArray(rawMessages)) {
        errorMsg = rawMessages.join('; '); // 用分号拼接数组元素
      } else if (typeof rawMessages === 'string') {
        errorMsg = rawMessages;
      } else {
        errorMsg = '参数错误，请检查输入'; // 默认提示
      }

      // 3. 根据状态码提示
      switch (error.response.status) {
        case 400:
          alert(errorMsg); // 现在会正确显示"用户名已存在"
          break;
        case 409:
          alert('用户名已存在，请更换用户名');
          break;
        case 500:
          if (error.response.data.includes('UNIQUE constraint failed: users_user.email')) {
            alert('该邮箱已被注册，请更换邮箱');
          }
          break;

        default:
          alert('服务器错误，请稍后重试');
      }
    } else {
      alert('网络错误，请检查网络连接');
    }
  }finally{
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
  background-color: #faf8f3;
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 400px;
  background: white;
  padding: 30px;
  border-radius: 30px;
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
  border-color: #a86464;
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
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-bottom: 15px;
  color: white;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}


.register-btn {
  width: 100%;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
   color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}


.link-to-login {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.link-to-login a {
  color: #a86464;
  text-decoration: none;
}

.link-to-login a:hover {
  text-decoration: underline;
}
</style>