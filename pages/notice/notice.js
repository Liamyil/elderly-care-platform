const app = getApp()
const { get, put } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    messages: [],
    filteredMessages: [],
    // 分类 Tab：all 全部 / order 订单动态
    activeTab: 'all'
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
      // 进入消息页即视为已读全部（messageId 为空 = 后端全部已读），先标记再拉列表，
      // 列表直接呈已读态，首页铃铛红点随之消除
      await put('/api/messages/read', { messageId: '' }, { silent: true }).catch(() => {})

      const messages = await get('/api/messages')
      wx.hideLoading()

      this.setData({
        messages: messages || [],
        filteredMessages: this.filterMessages(messages || [], this.data.activeTab)
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

  /** 按 Tab 过滤：订单动态 = type=order；全部 = 不过滤 */
  filterMessages(messages, tab) {
    if (tab === 'order') {
      return messages.filter(msg => msg.type === 'order')
    }
    return messages
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({
      activeTab: tab,
      filteredMessages: this.filterMessages(this.data.messages, tab)
    })
  },

  getTypeIcon(type) {
    return '📋'
  },

  async onMessageClick(e) {
    const id = e.currentTarget.dataset.id
    const message = this.data.messages.find(msg => msg.id === id)
    if (!message) return

    // 标记为已读（本地即时更新 + 同步后端，失败静默下次可重试）
    this.setData({
      messages: this.data.messages.map(msg =>
        msg.id === id ? { ...msg, isRead: true } : msg
      )
    })
    this.setData({
      filteredMessages: this.filterMessages(this.data.messages, this.data.activeTab)
    })
    put('/api/messages/read', { messageId: id }, { silent: true }).catch(() => {})

    // 带订单号的消息 → 跳转关联订单详情页
    if (message.orderId) {
      wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + message.orderId })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
