// 系统配置页（社区管理员/超级管理员可改，民政管理员只读）：
// 基础业务参数修改（每次修改后端强制写不可篡改操作日志，记录前后内容）+ 操作日志列表
const app = getApp()
const { AdminAPI } = require('../../../utils/api')

const CONFIG_LABELS = {
  helper_grab_radius_km: { name: '互助员接单距离上限', unit: '公里', placeholder: '如 5' },
  helper_max_concurrent_orders: { name: '互助员并发订单数上限', unit: '个', placeholder: '如 3' }
}

const LOG_TYPE_LABELS = {
  CONFIG_CHANGE: '配置修改',
  FORCE_CANCEL: '强制取消',
  FORCE_ASSIGN: '强制指派'
}

Page({
  data: {
    statusBarHeight: 0,
    role: '',
    activeTab: 'config',   // config / logs
    configs: [],
    logs: [],
    logPage: 1,
    logTotal: 0,
    loadingLogs: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    const user = app.globalData.userInfo
    const role = (user && user.role) || ''
    if (['管理员', '民政管理员', '超级管理员'].indexOf(role) < 0) {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.setData({ role: role })
    this.loadConfigs()
  },

  async loadConfigs() {
    try {
      const configs = await AdminAPI.getConfigs({ silent: true })
      this.setData({ configs: (configs || []).map((c) => {
        const meta = CONFIG_LABELS[c.configKey] || {}
        return Object.assign({}, c, {
          label: meta.name || c.configKey,
          unit: meta.unit || '',
          placeholder: meta.placeholder || '请输入新值'
        })
      }) })
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  },

  async loadLogs() {
    if (this.data.loadingLogs) return
    this.setData({ loadingLogs: true })
    try {
      const res = await AdminAPI.getOperationLogs({ page: this.data.logPage, size: 20 }, { silent: true })
      const list = ((res && res.list) || []).map((l) => Object.assign({}, l, {
        typeLabel: LOG_TYPE_LABELS[l.operateType] || l.operateType
      }))
      this.setData({
        logs: this.data.logPage === 1 ? list : this.data.logs.concat(list),
        logTotal: (res && res.total) || 0
      })
    } catch (e) {
      console.error('加载操作日志失败:', e)
    } finally {
      this.setData({ loadingLogs: false })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'logs' && !this.data.logs.length) {
      this.setData({ logPage: 1 })
      this.loadLogs()
    }
  },

  onLoadMore() {
    if (this.data.loadingLogs || this.data.logs.length >= this.data.logTotal) return
    this.setData({ logPage: this.data.logPage + 1 })
    this.loadLogs()
  },

  // ===== 配置修改（后端校验角色并强制写操作日志） =====
  onEditConfig(e) {
    const key = e.currentTarget.dataset.key
    const config = this.data.configs.find((c) => c.configKey === key)
    if (!config) return
    wx.showModal({
      title: '修改' + config.label,
      editable: true,
      placeholderText: config.placeholder,
      content: '当前值：' + config.configValue + ' ' + config.unit + '\n修改后将写入操作日志（记录修改前后内容）。',
      confirmText: '确认修改',
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (!res.confirm) return
        const value = (res.content && res.content.trim())
        if (!value) {
          wx.showToast({ title: '请输入新值', icon: 'none' })
          return
        }
        try {
          await AdminAPI.updateConfig(key, value)
          wx.showToast({ title: '已更新并留痕', icon: 'success' })
          this.loadConfigs()
          this.setData({ logs: [], logPage: 1 })
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '修改失败', icon: 'none' })
        }
      }
    })
  }
})
