const { BankAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    balance: 0,
    totalRedeemed: 0,
    iconExists: {
      service: false,
      gift: false,
      transfer: false,
      bill: false
    },
    transactions: [],
    recentTransactions: [],
    showLogin: false
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
  },

  onShow() {
    // 游客进入时间银行页 → 弹出登录提示；已登录 → 每次进入都刷新余额与流水
    if (!wx.getStorageSync('token')) {
      this.setData({ showLogin: true })
    } else {
      this.loadBankData()
    }
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadBankData()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  async loadBankData() {
    try {
      const balanceData = await BankAPI.getBalance()
      const transactionsData = await BankAPI.getTransactions(1, 12)

      this.setData({
        balance: balanceData.balance,
        totalRedeemed: balanceData.totalRedeemed,
        transactions: transactionsData.list,
        recentTransactions: transactionsData.list.slice(0, 5)
      })
    } catch (error) {
      console.error('加载时间银行数据失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
    }
  },

  onServiceExchange() {
    wx.navigateTo({
      url: '/pages/serviceExchange/serviceExchange'
    })
  },

  onGiftExchange() {
    wx.navigateTo({
      url: '/pages/giftExchange/giftExchange'
    })
  },

  async onTransfer() {
    wx.showToast({
      title: '转赠功能开发中',
      icon: 'none'
    })
  },

  async onBill() {
    wx.showToast({
      title: '跳转明细账单页面',
      icon: 'none'
    })
  },

  async onViewAll() {
    wx.showToast({
      title: '跳转全部明细',
      icon: 'none'
    })
  },

  onTransactionClick(e) {
    const transaction = e.currentTarget.dataset.transaction
    wx.showToast({
      title: '交易详情开发中',
      icon: 'none'
    })
  }
})