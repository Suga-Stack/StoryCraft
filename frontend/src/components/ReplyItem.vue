<script setup>
import { defineProps } from 'vue'

const props = defineProps({
  reply: { type: Object, required: true },
  startReply: { type: Function, required: true },
  toggleLike: { type: Function, required: true },
  onDeleteComment: { type: Function, required: true },
  onReportComment: { type: Function, required: true }
})
</script>

<template>
  <div class="reply-item">
    <div class="top-right-actions reply-top-actions">
      <button
        class="action-btn delete-btn"
        :disabled="reply._deleting"
        @click="onDeleteComment(reply)"
        title="删除回复">
        <span class="delete-x">×</span>
      </button>
      <button
        class="action-btn report-btn"
        :disabled="reply._reporting"
        @click="onReportComment(reply)"
        title="举报回复">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="comment-avatar reply-avatar">
      <img v-if="reply.profile_picture" :src="reply.profile_picture" class="avatar-img" />
      <template v-else>{{ reply.author?.charAt ? reply.author.charAt(0) : '访' }}</template>
    </div>
    <div class="comment-content">
      <div class="comment-header">
        <span class="comment-author">{{ reply.author }}</span>
        <span class="comment-time">{{ reply.time }}</span>
      </div>
      <p class="comment-text">{{ reply.text }}</p>
      <div class="comment-actions">
        <button 
          class="action-btn like-btn" 
          :class="{ active: reply.isLiked }"
          @click="toggleLike(reply)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>{{ reply.likes }}</span>
        </button>
        <button class="action-btn reply-btn" @click="startReply(reply.id, reply.author)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>回复</span>
        </button>
      </div>
    </div>
  </div>
  <div v-if="Array.isArray(reply.replies) && reply.replies.length" class="replies-list">
    <ReplyItem 
      v-for="child in reply.replies" 
      :key="child.id"
      :reply="child"
      :start-reply="startReply"
      :toggle-like="toggleLike"
      :on-delete-comment="onDeleteComment"
      :on-report-comment="onReportComment"
    />
  </div>
</template>

<script>
export default {
  name: 'ReplyItem'
}
</script>

<style scoped>
.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
</style>
