// 账号与安全页：基本信息（头像/昵称）+ 手机号 + 微信绑定
// 手机号为唯一主账号（不可自助修改）；微信仅作登录凭证（一对一绑定）
// 注：角色切换功能已按需求移除，后续再添加
const app = getApp()
const { put, post, getBaseUrl } = require('../../utils/request')
const { UserAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    user: null,
    nameInput: '',
    avatarUrl: '',
    phoneInput: '',
    showLogin: false,
    saving: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    if (!wx.getStorageSync('token')) {
      this.setData({ showLogin: true })
      return
    }
    this.loadUser()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadUser()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  goBack() {
    wx.navigateBack()
  },

  async loadUser() {
    try {
      const info = await UserAPI.getUserInfo({ silent: true })
      const user = info || {}
      // 头像地址主机自适应：防止存的是旧 IP 时真机加载失败
      const fixedAvatar = (user.avatar || '').replace(/https?:\/\/[^/]+/, getBaseUrl())
      user.avatar = fixedAvatar
      this.setData({
        user: user,
        nameInput: user.name || '',
        avatarUrl: fixedAvatar
      })
      // 同步全局用户信息，退出本页后"我的"页头像/昵称实时刷新
      app.saveUserInfo(user)
    } catch (e) {
      console.error('加载用户信息失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
    }
  },

  onNameInput(e) {
    this.setData({ nameInput: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value })
  },

  // 补绑手机号（微信直接登录的账号；验证码固定 123456，试玩阶段约定）
  async onBindPhone() {
    if (this.data.phoneInput.length !== 11) {
      wx.showToast({ title: '请输入11位手机号', icon: 'none' })
      return
    }
    try {
      await post('/api/user/bind-phone', { phone: this.data.phoneInput, smsCode: '123456' }, { loadingTitle: '绑定中...' })
      wx.showToast({ title: '手机号绑定成功', icon: 'success' })
      this.setData({ phoneInput: '' })
      this.loadUser()
    } catch (e) {
      wx.showToast({ title: (e && e.message) ? String(e.message) : '绑定失败', icon: 'none', duration: 2500 })
    }
  },

  // 更换头像（微信头像选择，wxml 按钮 open-type=chooseAvatar 触发）
  onChooseAvatar(e) {
    const path = e.detail.avatarUrl
    if (!path) return
    // 立即本地预览，上传成功后再替换为服务器地址
    this.setData({ avatarUrl: path })
    this.uploadAvatar(path)
  },

  uploadAvatar(path) {
    const baseUrl = getBaseUrl()
    wx.uploadFile({
      url: `${baseUrl}/api/upload`,
      filePath: path,
      name: 'images',
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 0 && data.data && data.data.length > 0) {
            this.saveProfile(data.data[0], this.data.nameInput)
          } else {
            wx.showToast({ title: data.message || '头像上传失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '头像上传失败', icon: 'none' })
        }
      },
      fail: (err) => {
        const errMsg = (err && err.errMsg) || '网络错误'
        console.error('头像上传失败:', errMsg)
        wx.showModal({
          title: '头像上传失败',
          content: '请检查网络后重试（' + errMsg + '）',
          showCancel: false
        })
      }
    })
  },

  onSaveName() {
    this.saveProfile(this.data.avatarUrl, this.data.nameInput)
  },

  async saveProfile(avatar, name) {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      await put('/api/user/info', { name: name, avatar: avatar }, { loadingTitle: '保存中...' })
      wx.showToast({ title: '头像/资料已更新', icon: 'success' })
      await this.loadUser()
    } catch (e) {
      wx.showToast({ title: (e && e.message) ? String(e.message) : '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  // 绑定微信（登录凭证 + 订阅消息推送）
  onBindWechat() {
    wx.login({
      success: async (res) => {
        if (!res.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' })
          return
        }
        try {
          await post('/api/user/bind-openid', { code: res.code }, { loadingTitle: '绑定中...' })
          wx.showToast({ title: '微信绑定成功', icon: 'success' })
          this.loadUser()
        } catch (e) {
          wx.showToast({
            title: (e && e.message) ? String(e.message) : '绑定失败',
            icon: 'none',
            duration: 2500
          })
        }
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' })
      }
    })
  }
})
