// 管理员订单管理（小程序端）：审核通过/驳回、指派互助员、取消订单、详情与留痕
const app = getApp()
const { AdminAPI } = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    role: '',
    statusTabs: [
      { key: 'reviewing', label: '待审核' },
      { key: 'pending', label: '待接单' },
      { key: 'dispatch_pool', label: '待派单' },
      { key: 'serving', label: '服务中' },
      { key: 'pending_confirm', label: '待确认' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    currentStatus: 'reviewing',
    currentLabel: '待审核',
    list: [],
    total: 0,
    page: 1,
    loading: false,
    // 指派弹层
    showAssignModal: false,
    assignOrderId: '',
    assignOrderLabel: '',
    helpers: [],
    // 详情弹层
    showDetailModal: false,
    detail: null,
    traces: [],
    // 紧急干预弹层（民政管理员：强制取消/强制指派，原因必填+留痕）
    showForceModal: false,
    forceAction: '',
    forceOrderId: '',
    forceOrderLabel: '',
    forceHelpers: [],
    forceHelperId: null,
    forceReason: ''
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const status = (options && options.status) || 'reviewing'
    const tab = this.data.statusTabs.find(function (t) { return t.key === status })
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      currentStatus: status,
      currentLabel: tab ? tab.label : '待审核'
    })
  },

  onShow() {
    const user = app.globalData.userInfo
    const role = (user && user.role) || ''
    if (['管理员', '民政管理员', '超级管理员'].indexOf(role) < 0) {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.setData({ role: role })
    this.loadOrders()
  },

  async loadOrders() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const res = await AdminAPI.getAdminOrders({ status: this.data.currentStatus, page: this.data.page, size: 50 }, { silent: true })
      this.setData({
        list: (res && res.list) || [],
        total: (res && res.total) || 0
      })
    } catch (e) {
      console.error('加载订单失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    const tab = this.data.statusTabs.find(function (t) { return t.key === key })
    this.setData({
      currentStatus: key,
      currentLabel: tab ? tab.label : '',
      page: 1
    })
    this.loadOrders()
  },

  priceText(order) {
    return order.priceText ? '¥' + order.priceText : '🪙 ' + order.reward + '时间币'
  },

  // ===== 审核 =====
  onApprove(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '审核通过',
      content: '通过后订单将公开到订单广场，互助员即可接单。',
      confirmText: '通过',
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await AdminAPI.reviewOrder(id, true, '')
          wx.showToast({ title: '已通过', icon: 'success' })
          this.loadOrders()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  onReject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '驳回订单',
      editable: true,
      placeholderText: '请填写驳回原因',
      confirmText: '驳回',
      confirmColor: '#E8852E',
      success: async (res) => {
        if (!res.confirm) return
        const reason = (res.content && res.content.trim()) || '信息不完整'
        try {
          await AdminAPI.reviewOrder(id, false, reason)
          wx.showToast({ title: '已驳回', icon: 'success' })
          this.loadOrders()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  // ===== 指派 =====
  async onAssign(e) {
    const id = e.currentTarget.dataset.id
    const label = e.currentTarget.dataset.label
    try {
      const helpers = await AdminAPI.getHelpers({ silent: true })
      this.setData({
        showAssignModal: true,
        assignOrderId: id,
        assignOrderLabel: label,
        helpers: helpers || []
      })
    } catch (err) {
      wx.showToast({ title: '互助员列表加载失败', icon: 'none' })
    }
  },

  onCloseAssign() {
    this.setData({ showAssignModal: false, assignOrderId: '', helpers: [] })
  },

  onHelperTap(e) {
    const helperId = e.currentTarget.dataset.id
    const helperName = e.currentTarget.dataset.name
    wx.showModal({
      title: '确认指派',
      content: '将该订单指派给 ' + helperName + '？指派后订单直接进入服务中。',
      confirmText: '指派',
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await AdminAPI.assignOrder(this.data.assignOrderId, helperId)
          wx.showToast({ title: '指派成功', icon: 'success' })
          this.onCloseAssign()
          this.loadOrders()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '指派失败', icon: 'none' })
        }
      }
    })
  },

  // ===== 取消 =====
  onCancelOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消订单',
      editable: true,
      placeholderText: '请填写取消原因',
      confirmText: '取消订单',
      confirmColor: '#E8852E',
      success: async (res) => {
        if (!res.confirm) return
        const reason = (res.content && res.content.trim()) || '管理员取消'
        try {
          await AdminAPI.cancelAdminOrder(id, reason)
          wx.showToast({ title: '已取消', icon: 'success' })
          this.loadOrders()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  // ===== 紧急干预（民政管理员：强制取消/强制指派，高危动作·原因必填·操作日志留痕） =====
  onForceCancel(e) {
    this.setData({
      showForceModal: true,
      forceAction: 'cancel',
      forceOrderId: e.currentTarget.dataset.id,
      forceOrderLabel: e.currentTarget.dataset.label || '',
      forceHelpers: [],
      forceHelperId: null,
      forceReason: ''
    })
  },

  async onForceAssign(e) {
    try {
      const helpers = await AdminAPI.getHelpers({ silent: true })
      this.setData({
        showForceModal: true,
        forceAction: 'assign',
        forceOrderId: e.currentTarget.dataset.id,
        forceOrderLabel: e.currentTarget.dataset.label || '',
        forceHelpers: helpers || [],
        forceHelperId: null,
        forceReason: ''
      })
    } catch (err) {
      wx.showToast({ title: '互助员列表加载失败', icon: 'none' })
    }
  },

  onCloseForce() {
    this.setData({
      showForceModal: false,
      forceHelpers: [],
      forceHelperId: null,
      forceReason: ''
    })
  },

  onForceHelperTap(e) {
    this.setData({ forceHelperId: e.currentTarget.dataset.id })
  },

  onForceReasonInput(e) {
    this.setData({ forceReason: e.detail.value })
  },

  async onForceConfirm() {
    const reason = (this.data.forceReason || '').trim()
    if (!reason) {
      wx.showToast({ title: '请填写干预原因（必填）', icon: 'none' })
      return
    }
    if (this.data.forceAction === 'assign' && !this.data.forceHelperId) {
      wx.showToast({ title: '请选择互助员', icon: 'none' })
      return
    }
    try {
      if (this.data.forceAction === 'assign') {
        await AdminAPI.forceAssignOrder(this.data.forceOrderId, this.data.forceHelperId, reason)
      } else {
        await AdminAPI.forceCancelOrder(this.data.forceOrderId, reason)
      }
      wx.showToast({ title: '已执行并写入操作日志', icon: 'success' })
      this.onCloseForce()
      this.loadOrders()
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    }
  },

  // ===== 详情 + 留痕 =====
  async onDetail(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.list.find(function (o) { return o.id === id })
    this.setData({ showDetailModal: true, detail: order || null, traces: [] })
    try {
      const traces = await AdminAPI.getAdminTraces(id, { silent: true })
      this.setData({ traces: traces || [] })
    } catch (err) { /* 留痕加载失败不阻塞详情 */ }
  },

  onCloseDetail() {
    this.setData({ showDetailModal: false, detail: null, traces: [] })
  },

  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls
    const current = e.currentTarget.dataset.current
    if (urls && urls.length) {
      wx.previewImage({ current: current, urls: urls })
    }
  },

  preventClose() { }
})
