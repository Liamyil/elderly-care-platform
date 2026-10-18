// 互助员注册申请审核（社区管理员，小程序端快速审核）：
// 查看申请信息与承诺书签署留痕 → 通过（用户保持普通用户，切换由用户端确认触发）/ 驳回（必填原因）
const app = getApp()
const { AdminAPI } = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    statusTabs: [
      { key: '', label: '全部' },
      { key: 'pending', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'rejected', label: '已驳回' }
    ],
    currentStatus: '',
    list: [],
    loading: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    const user = app.globalData.userInfo
    const role = (user && user.role) || ''
    // 仅社区管理员可审核（后端同权限校验兜底）
    if (role !== '管理员') {
      wx.showToast({ title: '仅社区管理员可操作', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1200)
      return
    }
    this.loadList()
  },

  async loadList() {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      const params = {}
      if (this.data.currentStatus) params.status = this.data.currentStatus
      const res = await AdminAPI.getHelperApplications(params, { silent: true })
      // WXML 不支持方法调用：申请时间预格式化为文本
      const rows = (res || []).map((item) => Object.assign({}, item, {
        createdAtText: this.formatTime(item.createdAt)
      }))
      this.setData({ list: rows })
    } catch (e) {
      console.error('加载互助员申请失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  /** 申请时间格式化：后端 ISO 时间 → YYYY-MM-DD HH:mm */
  formatTime(value) {
    if (!value) return ''
    return String(value).replace('T', ' ').slice(0, 16)
  },

  goBack() {
    wx.navigateBack()
  },

  onTabTap(e) {
    this.setData({ currentStatus: e.currentTarget.dataset.key })
    this.loadList()
  },

  statusLabel(status) {
    return status === 'pending' ? '待审核' : (status === 'approved' ? '已通过' : '已驳回')
  },

  onApprove(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    wx.showModal({
      title: '审核通过',
      content: '通过后「' + name + '」保持普通用户身份，下次进入小程序时将收到切换提示，点击确认后进入互助员端接单。',
      confirmText: '通过',
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await AdminAPI.approveHelperApplication(id)
          wx.showToast({ title: '已通过', icon: 'success' })
          this.loadList()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  },

  onReject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '驳回申请',
      editable: true,
      placeholderText: '请填写驳回原因（必填）',
      confirmText: '驳回',
      confirmColor: '#E8852E',
      success: async (res) => {
        if (!res.confirm) return
        const reason = (res.content && res.content.trim())
        if (!reason) {
          wx.showToast({ title: '请填写驳回原因', icon: 'none' })
          return
        }
        try {
          await AdminAPI.rejectHelperApplication(id, reason)
          wx.showToast({ title: '已驳回', icon: 'success' })
          this.loadList()
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
        }
      }
    })
  }
})
