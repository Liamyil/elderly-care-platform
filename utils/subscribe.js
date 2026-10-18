/**
 * 订阅消息配置与请求封装
 * 模板ID：在微信公众平台【功能 → 订阅消息】里申请模板后，把模板ID填到这里
 * 申请模板时的字段建议：thing1（服务类型）、time2（时间）、amount3（金额）
 */
const TEMPLATE_IDS = {
  assign: '',    // 指派提醒（管理员指派订单给我）
  timeout: '',   // 超时提醒（订单超时未完成）
  settle: ''     // 结算到账（服务完成，时间币到账）
}

/** 已配置的模板ID列表 */
function availableIds() {
  return Object.values(TEMPLATE_IDS).filter(function (id) { return id && id.length > 0 })
}

/**
 * 发起订阅授权（必须由用户点击事件触发）
 * 返回 Promise，无论用户同意/拒绝都 resolve，不打断业务主流程
 */
function requestSubscribe() {
  var ids = availableIds()
  if (!ids.length) return Promise.resolve()
  return new Promise(function (resolve) {
    wx.requestSubscribeMessage({
      tmplIds: ids,
      success: function () { resolve() },
      fail: function () { resolve() },
      complete: function () { resolve() }
    })
  })
}

module.exports = {
  TEMPLATE_IDS: TEMPLATE_IDS,
  requestSubscribe: requestSubscribe
}
