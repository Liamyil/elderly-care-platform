// 共享订单详情页（老人端 / 互助员端共用）：
// 时间轴（发单 / 接单 / 服务完成 / 取消）+ 按身份显示的双方联系方式。
// 防泄露：后端按查看人身份下发——未接单/已取消/非当事方只回脱敏姓名、电话为空，
// 本页以电话非空为拨号按钮渲染条件，电话为空一律不渲染按钮。
const { OrderAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    orderId: '',
    order: null,
    loading: true,
    showLogin: false
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      orderId: (options && options.id) || ''
    })
    if (!this.data.orderId) {
      wx.showToast({ title: '订单信息有误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    if (!wx.getStorageSync('token')) {
      // 未登录 → 弹出全局登录弹窗，登录成功后继续加载
      this.setData({ showLogin: true })
      return
    }
    this.loadDetail()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadDetail()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
    if (!wx.getStorageSync('token')) {
      wx.navigateBack()
    }
  },

  loadDetail() {
    const that = this
    wx.showLoading({ title: '加载中...', mask: true })
    OrderAPI.getOrderDetail(this.data.orderId)
      .then((order) => {
        that.setData({ order: order || null, loading: false })
      })
      .catch((error) => {
        that.setData({ loading: false })
        if (error && error.code === 401) {
          // 登录态失效：改弹登录弹窗（request.js 已清理本地登录态）
          that.setData({ showLogin: true })
          return
        }
        // request.js 已弹出具体错误提示（如「订单不存在」），这里只负责退出页面
        setTimeout(() => wx.navigateBack(), 1500)
      })
      .finally(() => {
        wx.hideLoading()
      })
  },

  /** 拨打电话：先确认再呼叫（与陪诊客服热线交互一致） */
  onCallPhone(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) return
    wx.showModal({
      title: '拨打电话',
      content: phone,
      confirmText: '拨打',
      confirmColor: '#2D7D46',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: phone })
        }
      }
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
