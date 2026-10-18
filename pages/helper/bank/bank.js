const { BankAPI } = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    balance: 0,
    totalEarned: 0,
    totalRedeemed: 0,
    recentTransactions: [],
    showLogin: false
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    // 游客进入互助员台账页 → 弹出登录提示
    if (!wx.getStorageSync('token')) {
      this.setData({ showLogin: true })
      return
    }
    this.loadBankData()
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
      var balanceData = await BankAPI.getBalance()
      var transactionsData = await BankAPI.getTransactions(1, 12)

      this.setData({
        balance: balanceData.balance,
        totalEarned: balanceData.totalEarned,
        totalRedeemed: balanceData.totalRedeemed,
        recentTransactions: transactionsData.list.slice(0, 5)
      })
    } catch (error) {
      console.error('加载时间银行数据失败:', error)
    }
  },

  onServiceExchange() {
    wx.navigateTo({ url: '/pages/serviceExchange/serviceExchange' })
  },

  onGiftExchange() {
    wx.navigateTo({ url: '/pages/giftExchange/giftExchange' })
  },

  onTransfer() {
    wx.showToast({ title: '转赠功能开发中', icon: 'none' })
  },

  onBill() {
    wx.showToast({ title: '明细账单开发中', icon: 'none' })
  },

  onViewAll() {
    wx.showToast({ title: '全部明细开发中', icon: 'none' })
  },

  onTransactionClick() {
    wx.showToast({ title: '交易详情开发中', icon: 'none' })
  }
})
