// 全局登录弹窗组件：
// main        两个登录入口（微信快捷登录 / 短信登录）+ 底部用户协议勾选
// phone       短信登录：只输手机号（未注册自动建号，默认普通用户）
// wechat-bind 微信未绑定账号时：手机号+验证码补绑，完成后直接登录
// 互助员注册改审核制：新用户统一普通用户，互助员身份经「申请成为互助员」审核获得
const app = getApp()
const { post } = require('../../utils/request')

Component({
  properties: {
    show: { type: Boolean, value: false }
  },

  data: {
    mode: 'main',            // main / phone
    agreed: false,
    phone: '',
    countdown: 0,
    submitting: false
  },

  observers: {
    show: function (show) {
      if (show) {
        this.setData({
          mode: 'main',
          phone: '',
          countdown: 0,
          submitting: false
        })
      }
    }
  },

  methods: {
    // ===== 通用 =====
    onClose() {
      this.triggerEvent('close')
    },

    preventClose() { },

    onAgreeTap() {
      console.log('=== login-popup 协议点击, 当前:', this.data.agreed)
      this.setData({ agreed: !this.data.agreed })
    },

    onShowAgreement(e) {
      const type = e.currentTarget.dataset.type
      wx.showModal({
        title: type === 'user' ? '用户协议' : '隐私协议',
        content: (type === 'user'
          ? '欢迎使用智慧互助养老平台。用户应遵守平台规则，诚信发布需求、如实提供互助服务，不得利用平台从事违法违规活动……'
          : '我们仅收集平台服务所必需的信息（手机号、微信身份、订单与服务留痕数据），并严格用于服务匹配与质量监管，不会向第三方泄露……')
          + '\n\n（正式协议文本由法务定稿后替换）',
        showCancel: false,
        confirmText: '我知道了'
      })
    },

    requireAgree() {
      if (!this.data.agreed) {
        wx.showToast({ title: '请先勾选同意用户协议', icon: 'none', duration: 2500 })
        return false
      }
      return true
    },

    goMain() {
      this.setData({ mode: 'main' })
    },

    /** 保存登录态（不关闭弹窗，供角色选择步骤继续） */
    storeLogin(result) {
      wx.setStorageSync('token', result.token)
      app.saveUserInfo(result.user)
    },

    /** 登录完成：通知页面并关闭；互助员按本地缓存的工作模式决定进入哪个端（双重身份共存） */
    finishLogin() {
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 })
      this.triggerEvent('success', { user: app.globalData.userInfo })
      const role = app.globalData.userInfo && app.globalData.userInfo.role
      if (role === '互助员') {
        // 接单模式 → 进互助员端；发单模式 → 留在当前页（用户端），不强制跳转
        if (app.getCurrentMode() === 'helper') {
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/helper/index/index' })
          }, 300)
        }
      } else if (role === '管理员' || role === '民政管理员' || role === '超级管理员') {
        // 管理角色登录后自动进入社区管理端
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/admin/index/index' })
        }, 300)
      }

    },

    // ===== 短信登录（手机号直接登录） =====
    onPhoneLoginTap() {
      console.log('=== login-popup 短信登录点击')
      if (!this.requireAgree()) return
      this.setData({ mode: 'phone' })
    },

    onPhoneInput(e) {
      this.setData({ phone: e.detail.value })
    },

    async onPhoneSubmit() {
      if (this.data.submitting) return
      if (this.data.phone.length !== 11) {
        wx.showToast({ title: '请输入11位手机号', icon: 'none' })
        return
      }
      this.setData({ submitting: true })
      try {
        const result = await post('/api/user/phone-login', { phone: this.data.phone }, { loadingTitle: '登录中...' })
        this.storeLogin(result)
        this.finishLogin()
      } catch (err) {
        this.setData({ submitting: false })
        wx.showToast({ title: (err && err.message) ? String(err.message) : '登录失败', icon: 'none' })
      }
    },

    // ===== 微信快捷登录 =====
    onWechatLoginTap() {
      console.log('=== login-popup 微信登录点击')
      if (!this.requireAgree()) return
      wx.login({
        success: async (res) => {
          if (!res.code) {
            wx.showToast({ title: '微信登录失败', icon: 'none' })
            return
          }
          try {
            // 未绑定的微信自动建号直接登录（手机号后续在账号与安全页补绑）
            const result = await post('/api/user/wechat-login', { code: res.code }, { loadingTitle: '微信登录中...' })
            this.storeLogin(result)
            this.finishLogin()
          } catch (err) {
            wx.showToast({
              title: (err && err.message) ? String(err.message) : '微信登录失败',
              icon: 'none',
              duration: 2500
            })
          }
        },
        fail: () => {
          wx.showToast({ title: '微信登录失败', icon: 'none' })
        }
      })
    },

  }
})
