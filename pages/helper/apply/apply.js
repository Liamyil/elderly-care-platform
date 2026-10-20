// 互助员注册申请页：
// 「我的」页申请入口 → 承诺书倒计时弹窗同意 → 本页填写信息 → 提交，由社区管理员审核。
// 手机号自动读取当前登录账号（只读）；年龄 18~70 实时校验（越界红框+红字）；
// 性别单选；常住区域（支持📍定位回填）/相关经验必填；个人简介快捷标签单条纵向自动轮播、点击追加；
// 承诺书已在上一步签署，本页勾选默认已勾且置灰不可取消；
// 审核中隐藏表单；驳回显示原因、回填上次内容，可修改后重新提交。
const app = getApp()
const { UserAPI } = require('../../../utils/api')

// 真实姓名校验：仅中文/英文字母，2-20 位（前后端同规则，防乱码/特殊符号/数字）
const REAL_NAME_REG = /^[a-zA-Z一-龥]{2,20}$/

Page({
  data: {
    statusBarHeight: 0,
    form: { realName: '', phone: '', age: '', gender: '男', area: '', experience: '', intro: '' },
    nameError: false,
    ageError: false,
    quickTags: [
      '耐心细致，善于与老人沟通，时间充裕。',
      '本地人，熟悉周边环境，能快速上门。',
      '有护理经验，能协助老人日常起居。',
      '热心公益，愿意利用业余时间提供陪伴服务。'
    ],
    experienceOptions: ['无经验', '有照顾家人经验', '有专业护理经验'],
    application: null,
    applyTimeText: '',
    submitting: false
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
    // 手机号自动读取当前登录账号（只读不可修改）
    const user = app.globalData.userInfo
    this.setData({ 'form.phone': (user && user.phone) || '' })
    this.loadMyApplication()
  },

  async loadMyApplication() {
    try {
      const application = await UserAPI.getMyHelperApplication({ silent: true })
      const next = application || null
      this.setData({ application: next, applyTimeText: this.formatTime(next && next.createdAt) })
      // 被驳回：回填上次填写的内容，便于修改后重新提交
      if (next && next.status === 'rejected') {
        this.setData({
          form: {
            realName: next.realName || '',
            phone: next.phone || this.data.form.phone,
            age: next.age != null ? String(next.age) : '',
            gender: next.gender || '男',
            area: next.area || '',
            experience: next.experience || '',
            intro: next.intro || ''
          }
        })
      }
    } catch (e) {
      console.error('加载申请状态失败:', e)
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['form.' + field]: e.detail.value })
  },

  /** 真实姓名实时校验：仅中英文（2-20 位），不合法时红框 + 红字提示 */
  onRealNameInput(e) {
    const value = e.detail.value
    this.setData({ 'form.realName': value })
    if (value === '') {
      this.setData({ nameError: false })
      return
    }
    this.setData({ nameError: !REAL_NAME_REG.test(value.trim()) })
  },

  /** 年龄输入实时校验：18~70，越界时红框 + 红字提示 */
  onAgeInput(e) {
    const value = e.detail.value
    this.setData({ 'form.age': value })
    if (value === '') {
      this.setData({ ageError: false })
      return
    }
    const age = Number(value)
    this.setData({ ageError: age < 18 || age > 70 })
  },

  onGenderTap(e) {
    this.setData({ 'form.gender': e.currentTarget.dataset.gender })
  },

  onExperienceTap(e) {
    this.setData({ 'form.experience': e.currentTarget.dataset.experience })
  },

  /** 地图定位选点：自动回填常住区域（参考发布需求页定位逻辑，可手动修改） */
  onLocateTap() {
    wx.chooseLocation({
      success: (res) => {
        if (!res.address) {
          wx.showToast({ title: '未获取到位置', icon: 'none' })
          return
        }
        this.setData({ 'form.area': res.address })
        wx.showToast({ title: '定位成功，已填入区域', icon: 'success' })
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') > -1) return
        wx.showModal({ title: '定位失败', content: '请确认手机已开启定位权限后重试', showCancel: false })
      }
    })
  },

  /** 申请时间格式化：后端 ISO 时间 → YYYY-MM-DD HH:mm */
  formatTime(value) {
    if (!value) return ''
    return String(value).replace('T', ' ').slice(0, 16)
  },

  /** 点击官方推荐快捷标签：追加到简介末尾 */
  onQuickTagTap(e) {
    const text = e.currentTarget.dataset.text
    const intro = this.data.form.intro
    const merged = intro.trim() ? (intro.trim() + '。' + text) : text
    this.setData({ 'form.intro': merged })
  },

  toast(title) {
    wx.showToast({ title: title, icon: 'none' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const f = this.data.form
    if (!f.realName.trim()) return this.toast('请填写真实姓名')
    if (this.data.nameError || !REAL_NAME_REG.test(f.realName.trim())) {
      this.setData({ nameError: true })
      return this.toast('请输入真实的姓名（仅限中英文字母）')
    }
    if (!f.phone.trim()) return this.toast('请先在账号与安全页绑定手机号')
    if (f.age === '') return this.toast('请填写年龄')
    const age = Number(f.age)
    if (age < 18 || age > 70) return this.toast('请输入18-70岁之间的年龄')
    if (!f.gender) return this.toast('请选择性别')
    if (!f.area.trim()) return this.toast('请填写常住区域')
    if (!f.experience) return this.toast('请选择相关经验')

    this.setData({ submitting: true })
    try {
      await UserAPI.submitHelperApplication({
        realName: f.realName.trim(),
        phone: f.phone.trim(),
        age: age,
        gender: f.gender,
        area: f.area.trim(),
        experience: f.experience,
        intro: f.intro.trim(),
        pledged: true
      }, { loadingTitle: '提交中...' })
      wx.showToast({ title: '申请已提交', icon: 'success' })
      // 刷新申请状态 → 页面切换为「审核中」
      this.loadMyApplication()
    } catch (err) {
      this.toast((err && err.message) || '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  }
})
