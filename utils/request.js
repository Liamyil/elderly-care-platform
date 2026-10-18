const config = require('../config')

let currentBaseUrl = ''

function initBaseUrl() {
  if (config.production && config.production.baseUrl) {
    currentBaseUrl = config.production.baseUrl
    return
  }

  currentBaseUrl = (config.local && config.local.baseUrl)
    ? config.local.baseUrl
    : 'http://localhost:3000'
}

initBaseUrl()

const request = (options) => {
  return new Promise((resolve, reject) => {
    const loadingTitle = options.loadingTitle || '加载中...'
    // silent 静默请求（轮询自动刷新用）：不弹加载框
    if (!options.silent) {
      wx.showLoading({
        title: loadingTitle,
        mask: true
      })
    }

    const fullUrl = currentBaseUrl + options.url
    const token = wx.getStorageSync('token') || ''

    wx.request({
      url: fullUrl,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      success: (res) => {
        if (!options.silent) wx.hideLoading()

        if (res.statusCode === 200) {
          const data = res.data

          if (data.code === 0) {
            resolve(data.data)
          } else if (data.code === 401) {
            // 登录失效（含账号已被删除）：清除本地登录态回到游客模式，由页面登录弹窗承接
            try {
              wx.removeStorageSync('token')
              wx.removeStorageSync('userInfo')
              const app = getApp()
              if (app && app.globalData) {
                app.globalData.userInfo = null
              }
            } catch (e) { /* 忽略 */ }
            reject(new Error('登录已过期，请重新登录'))
          } else {
            // 1001 = 微信未绑定账号：由页面引导补绑流程，不弹全局错误提示
            if (data.code !== 1001) {
              wx.showToast({
                title: data.message || '请求失败',
                icon: 'none'
              })
            }
            var err = new Error(data.message || '请求失败')
            err.code = data.code
            reject(err)
          }
        } else {
          wx.showToast({
            title: '网络请求失败',
            icon: 'none'
          })
          reject(new Error('网络请求失败'))
        }
      },
      fail: (err) => {
        if (!options.silent) wx.hideLoading()
        var errMsg = (err && err.errMsg) || '网络连接异常'
        wx.showToast({
          title: '网络连接异常',
          icon: 'none',
          duration: 3000
        })
        reject(new Error(errMsg))
      }
    })
  })
}

const get = (url, data, options) => {
  return request({ url: url, method: 'GET', data: data || {}, ...(options || {}) })
}

const post = (url, data, options) => {
  return request({ url: url, method: 'POST', data: data || {}, ...(options || {}) })
}

const put = (url, data, options) => {
  return request({ url: url, method: 'PUT', data: data || {}, ...(options || {}) })
}

const del = (url, data, options) => {
  return request({ url: url, method: 'DELETE', data: data || {}, ...(options || {}) })
}

const getBaseUrl = () => {
  return currentBaseUrl
}

const setBaseUrl = (url) => {
  if (url) {
    currentBaseUrl = url
    wx.setStorageSync('baseUrl', url)
  }
}

module.exports = {
  request: request,
  get: get,
  post: post,
  put: put,
  del: del,
  delete: del,
  getBaseUrl: getBaseUrl,
  setBaseUrl: setBaseUrl,
  BASE_URL: currentBaseUrl
}
