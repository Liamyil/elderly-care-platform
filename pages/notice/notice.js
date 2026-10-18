const app = getApp()
const { get } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    messages: [],
    filteredMessages: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
  },

  onShow() {
    this.loadMessages()
  },

  async loadMessages() {
    wx.showLoading({ title: '加载中...', mask: true })
    try {
      const messages = await get('/api/messages')
      wx.hideLoading()

      // 只显示订单相关通知
      const orderMessages = (messages || []).filter(msg => msg.type === 'order')
      
      this.setData({
        messages: orderMessages,
        filteredMessages: orderMessages
      })
    } catch (error) {
      wx.hideLoading()
      console.error('加载消息失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      this.setData({
        messages: [],
        filteredMessages: []
      })
    }
  },

  getTypeIcon(type) {
    return '📋'
  },

  onMessageClick(e) {
    const id = e.currentTarget.dataset.id
    const message = this.data.messages.find(msg => msg.id === id)
    if (!message) return

    // 标记为已读
    this.setData({
      messages: this.data.messages.map(msg =>
        msg.id === id ? { ...msg, isRead: true } : msg
      )
    })
    this.setData({
      filteredMessages: this.data.filteredMessages.map(msg =>
        msg.id === id ? { ...msg, isRead: true } : msg
      )
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
