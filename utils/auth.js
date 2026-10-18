// 登录态工具：游客可浏览小程序，执行需登录操作时弹出全局登录弹窗
function isLoggedIn() {
  return !!wx.getStorageSync('token')
}

/**
 * 确保已登录：未登录时在调用页面弹出登录弹窗
 * @param page 页面实例（需已引入 login-popup 组件并声明 data.showLogin）
 * @returns 是否已登录
 */
function ensureLogin(page) {
  if (isLoggedIn()) return true
  if (page && page.setData) {
    page.setData({ showLogin: true })
  }
  return false
}

module.exports = {
  isLoggedIn: isLoggedIn,
  ensureLogin: ensureLogin
}
