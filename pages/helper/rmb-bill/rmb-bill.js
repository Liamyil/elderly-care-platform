const { BankAPI } = require('../../../utils/api')

/**
 * 人民币账单（资金双轨制 · 人民币体系，双端复用页）：
 * - 互助员视图（默认，无参或 view 非 consume）：展示全部 asset_type == 'rmb' 流水——收入（陪诊结算等）+X 绿色、支出（提现冻结等）-X 红色
 * - 消费视图（老人/家属从「我的」页点击进入，view=consume）：仅展示作为下单人的人民币支出流水（如服务消费 -339元）
 * 数据安全：/api/bank/transactions 后端按登录用户 userId 过滤（findByUserId），只能拿到本人流水
 */
Page({
  data: {
    statusBarHeight: 0,
    viewMode: 'helper',   // 'helper' 互助员视图 / 'consume' 老人消费视图
    rmbBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    consumeTotal: 0,      // 消费视图：累计人民币消费（与「我的」页入口卡片同源）
    transactions: [],
    showLogin: false
  },

  onLoad(options) {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
    // 视图模式：入口参数显式区分（双重身份下互助员在发单端点击也进消费视图）；无参时按角色兜底
    var viewMode = options && options.view === 'consume' ? 'consume' : ''
    if (!viewMode) {
      var role = getApp().globalData.userInfo && getApp().globalData.userInfo.role
      viewMode = role === '互助员' ? 'helper' : 'consume'
    }
    this.setData({ viewMode: viewMode })
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

  /** 点击流水明细：有关联订单的跳转订单详情页（时间轴 + 双方联系方式）；提现等无订单流水静默忽略 */
  goOrderDetail(e) {
    var orderId = e.currentTarget.dataset.orderId
    if (!orderId) return
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + orderId })
  },

  async loadRmbBill() {
    var isConsume = this.data.viewMode === 'consume'
    try {
      // 消费视图无平台余额概念，余额接口跳过
      var balanceData = isConsume ? null : await BankAPI.getBalance()
      var transactionsData = await BankAPI.getTransactions(1, 999)

      // 仅保留人民币流水（时间币流水与人民币流水彻底隔离），并计算收支合计
      var totalIncome = 0
      var totalExpense = 0
      var rmbList = (transactionsData.list || [])
        .filter(function (item) {
          if (item.assetType !== 'rmb') return false
          // 消费视图：只展示支出流水（服务消费）；type 为枚举 income/expense，显式匹配 expense 更准确
          if (isConsume && item.type !== 'expense') return false
          return true
        })
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
            orderId: item.orderId || '',
            // 收入 +绿 / 支出 -红，金额带符号醒目展示
            displayAmount: (item.type === 'income' ? '+' : '-') + formatAmount(amount) + '元'
          }
        })

      // 消费视图累计消费：优先取「我的」页同源数据（/api/user/info 的 rmbSpent），无则用支出流水合计
      var app = getApp()
      var rmbSpent = app.globalData.userInfo && app.globalData.userInfo.rmbSpent
      var consumeTotal = rmbSpent != null && rmbSpent !== '' ? Number(rmbSpent) : totalExpense

      this.setData({
        rmbBalance: balanceData ? (balanceData.rmbBalance || 0) : 0,
        totalIncome: formatAmount(totalIncome),
        totalExpense: formatAmount(totalExpense),
        consumeTotal: formatAmount(consumeTotal),
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
