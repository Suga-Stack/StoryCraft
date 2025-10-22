<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToWorks = () => {
  router.push('/works')
}

const goToCreate = () => {
  router.push('/create')
}
</script>

<template>
  <div class="home-page">
    <div class="content">
      <h1 class="title">StoryCraft</h1>
      <p class="subtitle">欢迎来到故事创作平台</p>
      
      <div class="actions">
        <button class="main-button" @click="goToWorks">
          <span>进入作品主页</span>
          <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 12h14M12 5l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="secondary-button" @click="goToCreate">创建</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background-color: #faf8f3; /* 米白色背景 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.content {
  text-align: center;
  max-width: 600px;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 1.25rem;
  color: #6c757d;
  margin-bottom: 3rem;
}

.main-button {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.main-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.main-button:active {
  transform: translateY(0);
}

.arrow-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.main-button:hover .arrow-icon {
  transform: translateX(4px);
}

.actions { display:flex; gap: 1rem; justify-content:center; }
.secondary-button { padding: 0.9rem 1.6rem; border-radius: 50px; border:1px solid rgba(212,165,165,0.5); background:#fff; color:#2c1810; font-weight:600; cursor:pointer; transition: all .2s ease; }
.secondary-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }

/* 移动端适配 */
@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }
  
  .subtitle {
    font-size: 1rem;
    margin-bottom: 2rem;
  }
  
  .main-button {
    padding: 0.875rem 1.75rem;
    font-size: 1rem;
  }
}
</style>
