App({
  onLaunch() {
    // 注：微信 openid 绑定仅由用户主动操作触发（微信一键登录 / 账号页绑定），
    // 不做启动静默绑定——避免开发者工具测试时把测试微信误绑到演示账号
    var savedUserInfo = wx.getStorageSync('userInfo')
    if (savedUserInfo) {
      this.globalData.userInfo = savedUserInfo
    }

    // 双重身份共存：工作模式（'user' 发单端 / 'helper' 接单端）从本地缓存恢复，默认发单端
    this.globalData.currentMode = wx.getStorageSync('currentMode') === 'helper' ? 'helper' : 'user'

    // 已登录用户静默刷新用户信息（拉取 isHelper 等新字段，失败静默不影响本地缓存）
    var token = wx.getStorageSync('token')
    if (token) {
      const { UserAPI } = require('./utils/api')
      UserAPI.getUserInfo({ silent: true }).then((user) => {
        this.saveUserInfo(user)
      }).catch(() => {})
    }

    console.log('=== App onLaunch ===')
  },
  
  onShow() {
    console.log('=== App onShow ===')
    // 每次进入小程序：检测互助员申请通知（已通过未确认 → 恭喜弹窗；被驳回未读 → 驳回原因弹窗）
    this.checkHelperApplicationNotice()
  },
  
  onHide() {
    console.log('=== App onHide ===')
  },
  
  onError(error) {
    console.error('=== 小程序错误 ===')
    if (error instanceof Error) {
      console.error('消息:', error.message)
    } else {
      try {
        console.error('内容:', JSON.stringify(error))
      } catch(e) {
        console.error('内容:', String(error))
      }
    }
  },
  
  onPageNotFound(page) {
    console.error('=== 页面未找到 ===', page)
  },
  
  globalData: {
    userInfo: null,
    city: '上海市',
    district: '浦东新区',
    // 双重身份共存：当前工作模式 'user' 发单端 / 'helper' 接单端
    currentMode: 'user'
  },
  
  saveUserInfo: function(userInfo) {
    // 头像地址主机自适应：防止存的是旧局域网 IP 时真机加载失败
    if (userInfo && userInfo.avatar) {
      try {
        userInfo.avatar = userInfo.avatar.replace(/https?:\/\/[^/]+/, require('./utils/request').getBaseUrl())
      } catch (e) { /* 忽略 */ }
    }
    this.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)
  },
  
  clearUserInfo: function() {
    this.globalData.userInfo = null
    wx.removeStorageSync('userInfo')
  },

  // ===== 双重身份共存：工作模式（发单端/接单端切换，无需重新登录/重复审核） =====

  /** 读取当前工作模式：'user' 发单端 / 'helper' 接单端 */
  getCurrentMode: function() {
    return this.globalData.currentMode || 'user'
  },

  /** 切换工作模式：写内存 + 本地缓存（非法值一律落回 'user'） */
  setCurrentMode: function(mode) {
    var next = mode === 'helper' ? 'helper' : 'user'
    this.globalData.currentMode = next
    wx.setStorageSync('currentMode', next)
  },

  // ===== 互助员申请通知弹窗（审核通过引导切换 / 驳回原因提示） =====

  /** 检测互助员申请通知并弹窗（app.onShow 与「我的」页 onShow 均会调用）：
   *  approved 且未确认切换 → 「恭喜」弹窗引导切换；rejected 且未读 → 驳回原因弹窗（弹出即标记已读）。
   *  noticeModalShowing 守卫防止重复弹窗；preloadedApplication 复用已查到的申请省一次请求。 */
  checkHelperApplicationNotice: function(preloadedApplication) {
    const user = this.globalData.userInfo
    if (!user) return
    if (user.role === '互助员' || user.role === '管理员' || user.role === '民政管理员' || user.role === '超级管理员') return
    if (this.noticeModalShowing) return
    const { UserAPI } = require('./utils/api')
    const handle = (application) => {
      if (!application) return
      // 已通过且未确认切换 → 恭喜弹窗
      if (application.status === 'approved' && !application.confirmed) {
        this.noticeModalShowing = true
        wx.showModal({
          title: '恭喜',
          content: '您的互助员申请已审核通过，是否立即切换至互助员工作台？',
          confirmText: '立即切换',
          cancelText: '稍后切换',
          confirmColor: '#2D7D46',
          success: (res) => {
            this.noticeModalShowing = false
            if (res.confirm) {
              this.confirmHelperSwitch()
            }
          },
          fail: () => {
            this.noticeModalShowing = false
          }
        })
        return
      }
      // 被驳回且未读 → 驳回原因弹窗，弹出即静默标记已读（下次不再弹）
      if (application.status === 'rejected' && !application.rejectRead) {
        this.noticeModalShowing = true
        wx.showModal({
          title: '申请被驳回',
          content: '您的互助员申请被驳回，原因：' + (application.rejectReason || '未填写'),
          showCancel: false,
          confirmText: '知道了',
          confirmColor: '#2D7D46',
          success: () => {
            this.noticeModalShowing = false
          },
          fail: () => {
            this.noticeModalShowing = false
          }
        })
        UserAPI.markRejectReadHelperApplication({}, { silent: true }).catch(() => {})
      }
    }
    if (preloadedApplication) {
      handle(preloadedApplication)
      return
    }
    UserAPI.getMyHelperApplication({ silent: true }).then(handle).catch(() => {})
  },

  /** 立即切换：后端确认接口在此处才把角色置为互助员并签发新 token →
   *  替换本地 token → 刷新用户信息（角色已为互助员）→ 进入互助员端 */
  confirmHelperSwitch: function() {
    const { UserAPI } = require('./utils/api')
    UserAPI.confirmHelperApplication({}, { loadingTitle: '切换中...' }).then((data) => {
      if (data && data.token) {
        wx.setStorageSync('token', data.token)
      }
      // 双重身份共存：激活互助员身份后默认进入接单端，此后由「我的」页按钮双向切换
      this.setCurrentMode('helper')
      UserAPI.getUserInfo().then((user) => {
        this.saveUserInfo(user)
        wx.reLaunch({ url: '/pages/helper/index/index' })
      }).catch(() => {
        // 拉取用户信息失败：本地兜底改角色，仍可进入互助员端
        const u = this.globalData.userInfo || {}
        u.role = '互助员'
        this.saveUserInfo(u)
        wx.reLaunch({ url: '/pages/helper/index/index' })
      })
    }).catch((err) => {
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
    })
  }
})
