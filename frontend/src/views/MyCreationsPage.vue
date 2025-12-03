<template>
  <div class="creations-page">
    <van-nav-bar title="我的创作" left-arrow @click-left="handleBack" />
    
    <div class="book-list">
      <div 
        class="book-item" 
        v-for="book in myCreations" 
        :key="book.id"
      >
        <van-image 
          :src="book.image_url" 
          class="book-cover" 
          fit="cover"
          @click="navigateToBookDetail(book.id)"
        />
        <div class="book-info">
          <h3 class="book-title"  @click="navigateToBookDetail(book.id)">{{ book.title }}</h3>
          <p class="book-desc">{{ book.description }}</p>
          <div class="book-tags">
            <van-tag 
              v-for="tag in book.processedTags.slice(0,3)" 
              :key="tag.id"
              size="small"
              :style="tag.color"
            >
              {{ tag.name }}
            </van-tag>
          </div>
        </div>
         <van-icon 
          :name="book.is_published ? 'eye' : 'eye-o'" 
          class="visibility-icon"
          @click="handleIconClick(book)"
        />
        <van-icon
          name="delete"
          class="delete-icon"
          @click="handleDelete(book)"
          title="删除作品"
        />
      </div>
    </div>
  </div>

  <!--发布弹窗-->
  <div class="model-overlay" v-if="showPublishModel" @click="showPublishModel=false">
    <div class="publish-model" @click.stop>
      <div class="nav">
        <span class="back-arrow" @click="showPublishModel=false">×</span>
      </div>

      <!--信息卡片-->
      <div class="item-card">
        <!--作品封面-->
        <van-image 
          :src="currentBook.image_url" 
          class="book-cover" 
          fit="cover"
        />
        <!--作品信息-->
        <div class="book-info">
          <!--作品名-->
          <div class="book-title">{{ currentBook.title }}</div>
          <!--积分输入框-->
          <input type="number" 
            id="requiredCredits"  
            v-model="requiredCredits" 
            required
            min="0"
            max="50" 
            class="form-input"
            placeholder="设置解锁积分"
            @input="validateCredits"
          />
          <!--提示文字-->
          <span class="remind-txt">推荐积分范围为0-50积分</span>
        </div>
      </div>

      <!--发布按钮-->
      <button class="publish-btn" 
        @click="handlePublish(currentBook)"
        :class="{ active: currentBook.isPublished }"
        :disabled="!isAgreementChecked || !isCreditsValid"
        >确认发布
      </button>

      <!--取消发布按钮-->
      <button class="unpublish-btn" 
        @click="handleUnpublish(currentBook)"
        :disabled="!currentBook.is_published"
        >取消发布
      </button>
      
      <div class="checkbox-agreement-container">
        <!--协议圆圈-->
        <van-checkbox name="1" v-model="isAgreementChecked"></van-checkbox>
        <!--作者须知-->
        <span class="agreement" @click="showAgreementModel=true">作者须知</span>
      </div>  
    </div>
  </div>


  <!--用户协议弹窗-->
  <div class="model-overlay" v-if="showAgreementModel" @click="showAgreementModel=false">
    <div class="agreement-model" @click.stop>
      <div class="nav">
        <h2 class="agreement-title">故事匠用户协议</h2>
        <span class="back-arrow" @click="showAgreementModel=false">×</span>
      </div>

      <div class="agreement-container">
        <p class="agreement-welcome">欢迎使用故事匠平台（以下简称“本平台”）！点击“同意”按钮，即表示你已充分阅读、理解并接受本协议全部条款，愿意遵守本平台的相关规定和约束。若你不同意本协议，请勿使用本平台服务。</p>

        <h3 class="agreement-section">一、核心约定</h3>
        <ul class="agreement-list">
            <li>你在本平台发布的所有内容（包括但不限于文字、图片、AI生成作品等），均不得违反《中华人民共和国网络安全法》《中华人民共和国著作权法》《互联网信息服务管理办法》等相关法律法规及政策要求，不得包含危害国家安全、色情、暴力、诽谤、侵权等违法违规或不良信息。</li>
            <li>本平台提供的AI生成作品内容仅供娱乐消遣使用，不得用于商业盈利、学术研究、法律证明等正式场景，且不得擅自传播、篡改或二次创作后用于违规用途。</li>
            <li>你需对自身账号的使用行为负责，妥善保管账号信息，不得转借、出租或出售账号，若因账号泄露或违规使用导致的一切后果，由你自行承担。</li>
            <li>本平台有权对违规内容进行删除、屏蔽处理，对违规账号采取警告、限制功能、封禁账号等措施，情节严重的将依法移交相关部门处理。</li>
            <li>本平台有权根据业务发展调整服务内容及协议条款，调整后将通过平台公告等方式通知你，若你继续使用本平台服务，即视为接受修改后的条款。</li>
        </ul>

        <h3 class="agreement-section">二、免责声明</h3>
        <div class="disclaimer">
            <ul class="agreement-list">
                <li>因网络环境、设备故障、不可抗力等非本平台可控因素导致服务中断或使用异常的，本平台将尽力协助解决，但不承担由此造成的直接或间接损失。</li>
                <li>AI作品生成基于算法模型，可能存在内容偏差或不当信息，本平台不对AI作品的准确性、完整性、适用性作出任何承诺，你需自行甄别内容风险。</li>
            </ul>
        </div>

        <p class="agreement-welcome" style="margin-top: 20px;">请你遵守本协议约定，共同维护健康、合规的平台环境。</p>
      </div>

      <button class="agree-btn" @click="handleAgree">同意</button>
      <button class="disagree-btn" @click="showAgreementModel=false">不同意</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getMyworks, publishWorks, unpublishWorks} from '../api/user'
import { http } from '../service/http.js'
import { useTags } from '../composables/useTags'

// 初始化标签工具
const { getTagsByIds } = useTags();

const router = useRouter()
const myCreations = ref([])

//发布弹窗状态
const showPublishModel = ref(false)
//用户协议弹窗
const showAgreementModel = ref(false)
//协议勾选
const isAgreementChecked = ref(false)
// 存储当前操作的作品信息
const currentBook = ref(null);
//输入的解锁积分
const requiredCredits = ref('')
//积分有效
const isCreditsValid = ref(false)

// 在组件挂载时获取作品列表
onMounted(() => {
  fetchMyWorks()
})

// 获取当前用户创作的作品列表
const fetchMyWorks = async () => {
  try {
    const response = await getMyworks();
    
    if (!response.data.code || response.data.code !== 200) {
      throw new Error('获取作品列表失败')
    }

    const books = response.data.data;
    
    // 为每本书处理标签（转换ID为名称和颜色）
    for (const book of books) {
      book.processedTags = await getTagsByIds(book.tags || []);
    }

    myCreations.value = books;
  } catch (error) {
    showToast(error.message || '获取数据失败，请稍后重试')
    console.error('作品列表请求失败:', error)
  }
}

//处理眼睛Icon的点击事件
const handleIconClick = (book) => {
    showPublishModel.value = true;
    currentBook.value = book;
}

// 删除作品
const handleDelete = async (book) => {
  if (!book || !book.id) return
  if (!confirm('确认要删除此作品吗？此操作不可恢复。')) return
  try {
    let res = null
    // 优先尝试后端规定的 DELETE（带 /api 且带尾斜杠）
    const endpoints = [
      `/api/gameworks/gameworks/${book.id}/`,
      `/api/gameworks/gameworks/${book.id}`,
      `/gameworks/gameworks/${book.id}/`,
      `/gameworks/gameworks/${book.id}`,
      `/api/interactions/gameworks/${book.id}/`,
      `/api/interactions/gameworks/${book.id}`
    ]

    for (const ep of endpoints) {
      try {
        res = await http.delete(ep)
        if (res) break
      } catch (err) {
        // 如果是 405，记录并继续尝试其他变体，同时将 Allow 头打印出来帮助定位
        if (err && err.response && err.response.status === 405) {
          console.warn(`DELETE ${ep} returned 405 Method Not Allowed. Allow:`, err.response.headers && err.response.headers.allow)
          // 显示友好提示，告知后端可能未开放 DELETE
          showToast('删除操作被服务器拒绝（405）。请检查后端是否允许 DELETE 或需要额外权限。', 'warning')
          // 继续尝试下一个 endpoint
          continue
        }
        // 其它错误继续尝试下一个 endpoint
        continue
      }
    }

    const ok = res && (res.status === 200 || res.status === 204 || (res.data && (res.data.code === 200 || res.data.success)))
    if (ok) {
      myCreations.value = myCreations.value.filter(b => b.id !== book.id)
      showToast('作品已删除', 'success')
    } else {
      showToast('删除失败，请稍后重试', 'error')
    }
  } catch (e) {
    console.error('删除作品失败', e)
    showToast((e?.response?.data?.message) || '删除失败，请稍后重试', 'error')
  }
}

//取消发布接口
const handleUnpublish = async (book) => {
  try {
    // 调用取消发布接口，假设接口为unpublishWorks
    const response = await unpublishWorks(book.id);
    
    if (response.status === 200) {
      book.is_published = false;
      showToast('作品已取消发布');
      fetchMyWorks(); // 刷新作品列表
    } else {
      showToast('取消发布失败：' + (response.data.message || '未知错误'));
    }
  } catch (error) {
    console.error('取消发布操作失败:', error);
    // 错误处理
    if (error.response && error.response.status === 403) {
      showToast('您没有权限取消发布该作品');
    } else if (error.response && error.response.status === 404) {
      showToast('作品未找到');
    } else {
      showToast('操作失败，请稍后重试');
    }
  }
};

// 返回上一页
const handleBack = () => {
  router.back()
};

// 随机获取一个颜色样式
const getRandomTagStyle = () => {
  const randomIndex = Math.floor(Math.random() * tagColorOptions.length);
  return tagColorOptions[randomIndex];
};

// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/works/${bookId}`)
};

const handleAgree = () =>{
  isAgreementChecked.value = true;
  showAgreementModel.value = false;
}

const validateCredits = () =>{
  const num = Number(requiredCredits.value)
  isCreditsValid.value = !isNaN(num) && num >= 0 && num <= 50 && requiredCredits.value !== ''
}

// 发布/隐藏功能
const handlePublish = async (book) => {
  if(!isAgreementChecked.value){
    showToast('请先阅读作者须知')
    return
  }
  try {
    if (!book.is_published) {
      const response = await publishWorks(book.id, Number(requiredCredits.value));
      
      // 假设接口返回200时表示发布成功
      if (response.status === 200) {
        book.isPublished = true;
        showPublishModel.value = false;
        showToast('作品已发布');
        fetchMyWorks();
      } else {
        showToast('发布失败：' + (response.data.message || '未知错误'));
      }
    }
  } catch (error) {
    // 处理接口调用失败的情况
    console.error('发布操作失败:', error);
    // 恢复状态（因为接口调用失败，前端状态不应该改变）
    book.isPublished = !book.isPublished;
    
    // 根据错误类型显示不同提示
    if (error.response && error.response.status === 403) {
      showToast('您没有权限发布该作品');
    } else if (error.response && error.response.status === 404) {
      showToast('作品未找到');
    } else {
      showToast('操作失败，请稍后重试');
    }
  }
};
</script>

<style scoped>
/* 与阅读历史页面样式相同 */
.creations-page {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 20px;
}

.book-list {
  padding: 16px;
}

.book-item {
  display: flex;
  background-color: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.book-cover {
  width: 150px;
  height: 100px;
  border-radius: 4px;
  flex-shrink: 0;
}

.book-info {
  margin-left: 12px;
  flex-grow: 1;
  overflow: hidden;
}

.book-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 12px;
  color: #666;
  margin: 0 0 6px 0;
}

.book-desc {
  font-size: 12px;
  color: #888;
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-tags {
  display: flex;
  gap: 4px;
}

.favorite-icon {
  font-size: 18px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ffcc00;
}


.visibility-icon {
  font-size: 20px;
  margin-left: 12px;
  flex-shrink: 0;
}

.delete-icon {
  font-size: 20px;
  margin-left: 8px;
  color: #e74c3c;
  cursor: pointer;
}

.model-overlay{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3); /* 半透明黑色遮罩 */
  backdrop-filter: blur(5px); /* 背景虚化效果 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; 
  z-index: 1000; 
}

.publish-model, .agreement-model{
  background-color: #faf8f3;
  border-radius: 20px;
  padding: 40px 10px 25px;
  width: 340px;
  height: auto;
}

.nav{
  display: flex;
  width: 100%;
  padding: 10px;
  position: relative;
  justify-content: center;
  margin: -30px 0 10px 0;
}

.back-arrow{
  position: absolute;
  right: 10px;
  font-size: 20px;
}

.item-card{
  display: flex;
  flex-direction: row;
  background-color: #ffffff;
  border: 1px solid #D4A5A5;
  border-radius: 15px;
  padding: 15px;
  margin: 0 5px 10px;
}

.item-card .book-cover{
  border-radius: 15px;
  width: 150px;
  height: 100px;
  overflow: hidden;
}

.item-card .book-info{
  flex-direction: column;
}

.item-card .book-info .book-title{
  font-size: 16px;
  color: #444444;
}

.form-input{
  background-color: #ffffff;
  width: 80%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 8px;
  margin: 10px 0;
  border-radius: 10px;
}

.form-input::placeholder{
  color:#D4A5A5;
  font-size: 13px;
}

.remind-txt{
  color: #444444;
  font-size: 10px;
  display: block;
}

.publish-btn, .agreement-btn, .unpublish-btn{
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
  margin: 10px 0 0 0;
}

.publish-btn:disabled, .unpublish-btn:disabled {
  background: #cccccc; 
  color: #999999;
  cursor: not-allowed; 
  opacity: 0.7; 
}

.checkbox-agreement-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 15px 0; 
}

::v-deep .van-checkbox {
  margin: 0 10px 0 0;
}

.agreement{
  color: #BB8585;
  text-decoration: underline;
  font-size: 12px;
}

.agreement-title{
  font-size: 16px;
  color: #444444;
  text-align: center;
}

.agreement-container {
  margin: -10px 10px 0 10px;
  padding: 20px 16px;
  max-height: 400px; /* 限制容器高度，超出可滚动 */
  overflow-y: auto; /* 内容超出时显示滚动条 */
  font-size: 14px;
  color: #444444;
  line-height: 1.6; /* 行高适中，提升可读性 */
}

/* 标题样式调整 */
.agreement-container .agreement-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
  color: #444444;
}

/* 欢迎语样式 */
.agreement-container .agreement-welcome {
  margin-bottom: 16px;
  text-align: justify; /* 文本两端对齐 */
}

/* 章节标题样式 */
.agreement-container .agreement-section {
  font-size: 16px;
  font-weight: 500;
  margin: 16px 0 8px;
  color: #444444;
}

/* 列表样式 */
.agreement-container .agreement-list {
  padding-left: 20px;
  margin-bottom: 12px;
}

.agreement-container .agreement-list li {
  margin-bottom: 8px;
  text-align: justify;
}

/* 免责声明区块样式 */
.agreement-container .disclaimer {
  margin-bottom: 16px;
}

.agree-btn{
  margin-top: 20px;
  color: white;
  font-size: 16px;
  width: 80%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
}
.agreement-model{
  display: flex;
  flex-direction: column;
  align-items: center;
}

.disagree-btn{
  background-color: #fff;
  border: 1px solid rgba(212, 165, 165, 0.35);
  color: #d4a5a5;
  border-radius: 20px;
  padding: 6px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
  width: 80%;
}

</style>