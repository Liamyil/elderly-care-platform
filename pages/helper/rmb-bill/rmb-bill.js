const { BankAPI } = require('../../../utils/api')

/**
 * 人民币账单（资金双轨制 · 人民币体系）：仅展示 asset_type == 'rmb' 的流水
 * 收入（陪诊结算等）绿色 +，支出（提现冻结等）红色 -；老人端无人民币余额，故无入口
 */
Page({
  data: {
    statusBarHeight: 0,
    rmbBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    transactions: [],
    showLogin: false
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    // 游客进入人民币账单页 → 弹出登录提示
    if (!wx.getStorageSync('token')) {
      this.setData({ showLogin: true })
      return
    }
    this.loadRmbBill()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadRmbBill()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  goBack() {
    wx.navigateBack()
  },

  async loadRmbBill() {
    try {
      var balanceData = await BankAPI.getBalance()
      var transactionsData = await BankAPI.getTransactions(1, 999)

      // 仅保留人民币流水（时间币流水与人民币流水彻底隔离），并计算收支合计
      var totalIncome = 0
      var totalExpense = 0
      var rmbList = (transactionsData.list || [])
        .filter(function (item) { return item.assetType === 'rmb' })
        .map(function (item) {
          var amount = item.rmbAmount != null ? Number(item.rmbAmount) : Number(item.amount)
          if (isNaN(amount)) amount = 0
          if (item.type === 'income') totalIncome += amount
          else totalExpense += amount
          return {
            id: item.id,
            name: item.name,
            time: item.time,
            type: item.type,
            // 收入 +绿 / 支出 -红，金额带符号醒目展示
            displayAmount: (item.type === 'income' ? '+' : '-') + formatAmount(amount) + '元'
          }
        })

      this.setData({
        rmbBalance: balanceData.rmbBalance || 0,
        totalIncome: formatAmount(totalIncome),
        totalExpense: formatAmount(totalExpense),
        transactions: rmbList
      })
    } catch (error) {
      console.error('加载人民币账单失败:', error)
    }
  }
})

/** 金额格式化：去掉多余小数零（339.00 → 339，100.50 → 100.5） */
function formatAmount(v) {
  var n = Number(v)
  if (isNaN(n)) return '0'
  return String(Math.round(n * 100) / 100)
}
