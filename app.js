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

    // 站内信闭环：记录会话启动时间，悬浮横幅只弹此时间之后产生的新消息（历史未读只走铃铛红点）
    this._messageSessionStart = Date.now()
    console.log('[msg-poll] 会话启动时间(ms) =', this._messageSessionStart, '=>', new Date(this._messageSessionStart).toLocaleString())
  },
  
  onShow() {
    console.log('=== App onShow ===')
    // 每次进入小程序：检测互助员申请通知（已通过未确认 → 恭喜弹窗；被驳回未读 → 驳回原因弹窗）
    this.checkHelperApplicationNotice()
    // 站内信闭环：回前台启动 15 秒未读消息轮询（未登录内部直接跳过）
    this.startMessagePolling()
  },

  onHide() {
    console.log('=== App onHide ===')
    // 退后台停轮询：微信后台会挂起 JS，避免回前台瞬间积压请求
    this.stopMessagePolling()
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
    currentMode: 'user',
    // 完工通知点击定位：悬浮窗写入目标订单与页签，订单页 onShow 消费后立即清空
    targetOrderId: '',
    targetTab: ''
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
  },

  // ===== 站内信闭环 · 全局悬浮横幅（5 秒轮询最新未读，测试期；稳定后可回调 15 秒） =====
  // 性能闸门：仅登录后 + 仅前台（onShow 启 / onHide 停）；请求为轻量静默接口（latest-unread 最多 3 条）；
  // 排查结论落地：时间锁过滤已移除，仅保留同一消息 ID 去重；轮询响应同步驱动首页铃铛红点。

  /** 启动消息轮询（app.onShow 与登录弹窗登录成功后调用；未登录直接返回） */
  startMessagePolling: function() {
    var token = wx.getStorageSync('token')
    console.log('[msg-poll] startMessagePolling 被调用, token存在 =', !!token)
    if (!token) return
    this.stopMessagePolling()
    if (!this._shownMessageIds) this._shownMessageIds = {}
    var self = this
    this._messagePollTimer = setInterval(function () { self.pollLatestUnread() }, 5000)
    console.log('[msg-poll] 定时器已启动, timerId =', this._messagePollTimer)
    this.pollLatestUnread()
  },

  /** 停止消息轮询（app.onHide 调用；登出后轮询内部自停） */
  stopMessagePolling: function() {
    console.log('[msg-poll] stopMessagePolling 被调用, 原 timerId =', this._messagePollTimer)
    if (this._messagePollTimer) {
      clearInterval(this._messagePollTimer)
      this._messagePollTimer = null
    }
  },

  /** 拉取最新未读 → 命中新消息则驱动当前页面的悬浮横幅展示；响应同步刷新首页铃铛红点 */
  pollLatestUnread: function() {
    var token = wx.getStorageSync('token')
    if (!token) {
      // 已登出：停止轮询，避免 401 空转
      console.log('[msg-poll] pollLatestUnread: 无 token, 停止轮询')
      this.stopMessagePolling()
      return
    }
    if (this._messagePollBusy) {
      console.log('[msg-poll] pollLatestUnread: 上一次请求未完成, 跳过本轮')
      return
    }
    var self = this
    this._messagePollBusy = true
    console.log('[msg-poll] 请求 /api/messages/latest-unread ...', new Date().toLocaleTimeString())
    const { get } = require('./utils/request')
    get('/api/messages/latest-unread', {}, { silent: true }).then(function (list) {
      self._messagePollBusy = false
      console.log('[msg-poll] 接口返回:', JSON.stringify(list))
      // 首页铃铛红点实时刷新：停留在页面上不触发 onShow，由轮询响应直接驱动红点
      self.updateUnreadBadge(!!(list && list.length))
      if (!list || !list.length) {
        console.log('[msg-poll] 无未读消息, 本轮结束')
        return
      }
      for (var i = 0; i < list.length; i++) {
        var msg = list[i]
        // 仅保留 ID 去重（同一条消息只弹一次）；时间锁过滤已按排查要求移除
        if (self._shownMessageIds[msg.id]) {
          console.log('[msg-poll] 跳过消息', msg.id, '「' + msg.title + '」, 原因: 该消息 ID 已弹过（去重命中）')
          continue
        }
        self._shownMessageIds[msg.id] = true
        var shown = self.showGlobalToast(msg)
        console.log('[msg-poll] showGlobalToast 结果 =', shown, ', 消息 =', msg.id, '「' + msg.title + '」')
        if (!shown) {
          // 兜底：拿不到悬浮组件实例（页面未就绪/挂载异常）时用系统提示展示，标记保持不重复弹出
          console.warn('[msg-poll] 悬浮组件不可用，改用系统 toast 兜底展示')
          wx.showToast({
            title: (msg.title || '新消息') + '：' + String(msg.content || '').slice(0, 30),
            icon: 'none',
            duration: 4000
          })
        }
        break
      }
    }).catch(function (err) {
      self._messagePollBusy = false
      console.error('[msg-poll] 请求失败:', err && err.message)
    })
  },

  /** 首页铃铛红点：轮询响应驱动当前页面（data 含 hasUnreadMessages 的页面，即首页）实时更新 */
  updateUnreadBadge: function(hasUnread) {
    var pages = getCurrentPages()
    if (!pages.length) return
    var page = pages[pages.length - 1]
    if (!page || !page.setData || !page.data || !('hasUnreadMessages' in page.data)) return
    if (page.data.hasUnreadMessages !== hasUnread) {
      console.log('[msg-poll] 更新铃铛红点: hasUnreadMessages =', hasUnread, ', route =', page.route)
      page.setData({ hasUnreadMessages: hasUnread })
    }
  },

  /** 驱动当前页面的悬浮横幅展示（返回是否成功展示） */
  showGlobalToast: function(msg) {
    var pages = getCurrentPages()
    console.log('[msg-poll] 页面栈深度 =', pages.length)
    var page = pages.length ? pages[pages.length - 1] : null
    if (!page || !page.selectComponent) {
      console.log('[msg-poll] 当前页面不存在或无 selectComponent 方法')
      return false
    }
    console.log('[msg-poll] 当前页面 route =', page.route)
    var toast = page.selectComponent('#globalToast')
    console.log('[msg-poll] selectComponent("#globalToast") =>', toast ? '拿到组件实例' : 'null（拿不到实例！）')
    if (!toast) return false
    toast.show(msg)
    return true
  }
})
