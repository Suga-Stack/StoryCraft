import { defineStore } from 'pinia';

export const useCheckInStore = defineStore('checkIn', {
  state: () => ({
    showModal: false, // 控制弹窗显示/隐藏
  }),
  actions: {
    setShowModal(visible) {
      this.showModal = visible;
    },
  },
});