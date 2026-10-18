const app = getApp()
const { UserAPI, OrderAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    isLoggedIn: false,
    showLogin: false,
    // 互助员申请状态：'' 未申请 / pending 审核中 / approved 已通过 / rejected 已驳回 / helper 已是互助员
    helperApplyStatus: '',
    helperApplication: null,
    applyTimeText: '',
    // 顶部申请进度通知卡片（无申请/已切换时隐藏）
    noticeCard: { show: false },
    showPledge: false,
    pledgeCountdown: 5,
    pledgeReady: false,
    userInfo: {
      name: '点击登录',
      id: '',
      phone: '',
      role: '',
      isHelper: false,
      timeCoins: 0,
      serviceCount: 0,
      evaluationScore: 0
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    this.loadHelperApplyStatus()
    // 游客进入"我的"页 → 立即弹出登录提示
    if (!app.globalData.userInfo) {
      this.setData({ showLogin: true })
    }
  },

  onHide() {
    this.clearPledgeTimer()
  },

  onUnload() {
    this.clearPledgeTimer()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadUserInfo()
    this.loadHelperApplyStatus()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  loadUserInfo() {
    const globalUserInfo = app.globalData.userInfo
    if (globalUserInfo) {
      this.setData({
        isLoggedIn: true,
        userInfo: {
          name: globalUserInfo.name || '张大爷',
          id: globalUserInfo.userId ? `ID：${globalUserInfo.userId}` : '',
          phone: globalUserInfo.phone || '',
          role: globalUserInfo.role || '',
          // 双重身份共存：拥有互助员身份时显示「切换至接单端」入口（role 兜底兼容旧缓存数据）
          isHelper: !!(globalUserInfo.isHelper || globalUserInfo.role === '互助员'),
          avatar: globalUserInfo.avatar || '',
          timeCoins: globalUserInfo.timeCoins || 168,
          serviceCount: globalUserInfo.orders || 12,
          evaluationScore: globalUserInfo.rating || 4.9
        }
      })
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: {
          name: '点击登录',
          id: '',
          phone: '',
          role: '',
          isHelper: false,
          timeCoins: 0,
          serviceCount: 0,
          evaluationScore: 0
        }
      })
    }
  },

  /** 切换至接单端（双重身份共存）：写模式缓存 → 有服务中订单给弱提示 → 进入互助员首页 */
  onSwitchToHelper() {
    if (!this.data.isLoggedIn) {
      this.setData({ showLogin: true })
      return
    }
    app.setCurrentMode('helper')
    OrderAPI.getOrders('serving', { silent: true }).then((list) => {
      if (list && list.length > 0) {
        wx.showToast({ title: '您有正在进行的服务订单，请注意时间', icon: 'none', duration: 2000 })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/helper/index/index' })
        }, 1200)
      } else {
        wx.reLaunch({ url: '/pages/helper/index/index' })
      }
    }).catch(() => {
      wx.reLaunch({ url: '/pages/helper/index/index' })
    })
  },

  onProfileClick() {
    // 未登录 → 弹登录；已登录 → 进入个人信息页
    if (!this.data.isLoggedIn) {
      this.setData({ showLogin: true })
      return
    }
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/setting/setting'
    })
  },

  goToOrderList() {
    wx.switchTab({
      url: '/pages/order/order'
    })
  },

  goToAccount() {
    if (!this.data.isLoggedIn) {
      this.setData({ showLogin: true })
      return
    }
    wx.navigateTo({
      url: '/pages/account/account'
    })
  },

  goToBank() {
    wx.switchTab({
      url: '/pages/bank/bank'
    })
  },

  goToHealth() {
    wx.navigateTo({
      url: '/pages/health/health'
    })
  },

  goToHelpers() {
    wx.showToast({
      title: '互助员列表功能开发中',
      icon: 'none'
    })
  },

  goToEvaluation() {
    wx.navigateTo({
      url: '/pages/rating/rating'
    })
  },

  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  // ===== 申请成为互助员（入口按钮 + 承诺书倒计时弹窗） =====

  /** 查询我的互助员申请状态，控制通知卡片与菜单入口显示；已通过/被驳回 → 通知弹窗（app 级函数处理） */
  async loadHelperApplyStatus() {
    const user = app.globalData.userInfo
    if (!user) {
      this.setData({ helperApplyStatus: '', helperApplication: null, applyTimeText: '', noticeCard: { show: false } })
      return
    }
    if (user.role === '互助员') {
      // 已是互助员 → 隐藏入口
      this.setData({ helperApplyStatus: 'helper', helperApplication: null, applyTimeText: '', noticeCard: { show: false } })
      return
    }
    try {
      const application = await UserAPI.getMyHelperApplication({ silent: true })
      this.setData({
        helperApplyStatus: application ? application.status : '',
        helperApplication: application || null,
        applyTimeText: this.formatTime(application && application.createdAt),
        noticeCard: this.buildNoticeCard(application)
      })
      // 已通过未确认 / 被驳回未读 → 通知弹窗（app 级函数带防重复守卫，直接复用已查到的申请）
      if (application) {
        app.checkHelperApplicationNotice(application)
      }
    } catch (e) {
      console.error('查询互助员申请状态失败:', e)
    }
  },

  /** 构建顶部申请进度通知卡片：审核中（浅橙）/ 被驳回（浅红）/ 已通过未切换（浅绿），其余隐藏 */
  buildNoticeCard(application) {
    if (!application) return { show: false }
    if (application.status === 'pending') {
      return { show: true, theme: 'notice-pending', icon: '⏳', title: '审核中', sub: '请耐心等待社区管理员审核' }
    }
    if (application.status === 'rejected') {
      return { show: true, theme: 'notice-rejected', icon: '❌', title: '申请被驳回', sub: '驳回原因：' + (application.rejectReason || '未填写') }
    }
    if (application.status === 'approved' && !application.confirmed) {
      return { show: true, theme: 'notice-approved', icon: '✅', title: '申请已通过', sub: '点击立即切换为互助员' }
    }
    return { show: false }
  },

  /** 申请时间格式化：后端 ISO 时间 → YYYY-MM-DD HH:mm */
  formatTime(value) {
    if (!value) return ''
    return String(value).replace('T', ' ').slice(0, 16)
  },

  /** 点击申请进度通知卡片：已通过未切换 → 弹切换确认；审核中/被驳回 → 跳申请页查看详情 */
  onHelperNoticeTap() {
    if (this.data.helperApplyStatus === 'approved') {
      app.checkHelperApplicationNotice(this.data.helperApplication)
      return
    }
    wx.navigateTo({ url: '/pages/helper/apply/apply' })
  },

  /** 菜单入口「申请成为互助员」：审核中→查看状态；未申请/被驳回→承诺书弹窗流程 */
  onHelperApplyMenuTap() {
    if (!this.data.isLoggedIn) {
      this.setData({ showLogin: true })
      return
    }
    if (this.data.helperApplyStatus === 'pending') {
      wx.navigateTo({ url: '/pages/helper/apply/apply' })
      return
    }
    this.setData({ showPledge: true, pledgeCountdown: 5, pledgeReady: false })
    this.startPledgeCountdown()
  },

  /** 5 秒倒计时：结束后按钮高亮可点 */
  startPledgeCountdown() {
    this.clearPledgeTimer()
    this.pledgeTimer = setInterval(() => {
      const next = this.data.pledgeCountdown - 1
      if (next <= 0) {
        this.clearPledgeTimer()
        this.setData({ pledgeCountdown: 0, pledgeReady: true })
      } else {
        this.setData({ pledgeCountdown: next })
      }
    }, 1000)
  },

  clearPledgeTimer() {
    if (this.pledgeTimer) {
      clearInterval(this.pledgeTimer)
      this.pledgeTimer = null
    }
  },

  /** 右上角 ×：直接退出申请流程 */
  onPledgeClose() {
    this.clearPledgeTimer()
    this.setData({ showPledge: false, pledgeCountdown: 5, pledgeReady: false })
  },

  /** 同意并承诺：关闭弹窗，跳转填写申请信息页 */
  onPledgeAgree() {
    if (!this.data.pledgeReady) return
    this.clearPledgeTimer()
    this.setData({ showPledge: false, pledgeCountdown: 5, pledgeReady: false })
    wx.navigateTo({
      url: '/pages/helper/apply/apply'
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#E8852E',
      success: (res) => {
        if (res.confirm) {
          app.clearUserInfo()
          wx.removeStorageSync('token')
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})