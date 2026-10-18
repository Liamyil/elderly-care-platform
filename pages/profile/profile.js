// 个人信息页：头像（微信头像选择+上传保存）、姓名（修改落库）、手机号/角色/用户ID 展示
const app = getApp()
const { put, getBaseUrl } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    userInfo: {
      name: '',
      phone: '',
      role: '',
      userId: '',
      avatar: ''
    },
    showNameModal: false,
    editName: ''
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
  },

  loadUserInfo() {
    const globalUserInfo = app.globalData.userInfo
    if (globalUserInfo) {
      // 头像地址主机自适应（防止旧 IP 导致真机加载失败）
      const avatar = (globalUserInfo.avatar || '').replace(/https?:\/\/[^/]+/, getBaseUrl())
      this.setData({
        userInfo: {
          name: globalUserInfo.name || '',
          phone: globalUserInfo.phone || '',
          role: globalUserInfo.role || '',
          userId: globalUserInfo.userId || '',
          avatar: avatar
        }
      })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  // 更换头像（微信头像选择）
  onChooseAvatar(e) {
    const path = e.detail.avatarUrl
    if (!path) return
    // 立即本地预览
    this.setData({ 'userInfo.avatar': path })
    this.uploadAvatar(path)
  },

  uploadAvatar(path) {
    wx.uploadFile({
      url: `${getBaseUrl()}/api/upload`,
      filePath: path,
      name: 'images',
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 0 && data.data && data.data.length > 0) {
            this.saveProfile(data.data[0], this.data.userInfo.name, '头像已更新')
          } else {
            wx.showToast({ title: data.message || '头像上传失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '头像上传失败', icon: 'none' })
        }
      },
      fail: (err) => {
        wx.showModal({
          title: '头像上传失败',
          content: '请检查网络后重试（' + ((err && err.errMsg) || '网络错误') + '）',
          showCancel: false
        })
      }
    })
  },

  async saveProfile(avatar, name, successTitle) {
    try {
      await put('/api/user/info', { name: name, avatar: avatar }, { loadingTitle: '保存中...' })
      const updated = Object.assign({}, app.globalData.userInfo, { avatar: avatar, name: name })
      app.saveUserInfo(updated)
      this.setData({
        'userInfo.avatar': avatar,
        'userInfo.name': name
      })
      wx.showToast({ title: successTitle || '已更新', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: (e && e.message) ? String(e.message) : '保存失败', icon: 'none' })
    }
  },

  onNameClick() {
    this.setData({
      showNameModal: true,
      editName: this.data.userInfo.name
    })
  },

  onNameInput(e) {
    this.setData({
      editName: e.detail.value
    })
  },

  onCloseNameModal() {
    this.setData({
      showNameModal: false,
      editName: ''
    })
  },

  preventClose() { },

  async onSaveName() {
    const newName = this.data.editName.trim()
    if (!newName) {
      return
    }
    await this.saveProfile(this.data.userInfo.avatar, newName, '姓名已更新')
    this.setData({
      showNameModal: false,
      editName: ''
    })
  }
})
