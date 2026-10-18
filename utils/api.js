const { get, post, put, del } = require('./request')

const OrderAPI = {
  getOrders: async (status, options) => {
    return get('/api/orders', status ? { status } : {}, options)
  },

  cancelOrder: async (orderId, cancelReason) => {
    return post(`/api/orders/${orderId}/cancel`, { cancelReason })
  },

  createOrder: async (data) => {
    return post('/api/orders', data)
  },

  getOrderDetail: async (orderId) => {
    return get(`/api/orders/${orderId}`)
  },

  getTypeStats: async (type, options) => {
    return get('/api/orders/type-stats', type ? { type } : {}, options)
  },

  getEvaluations: async (type, subType, options) => {
    const params = {}
    if (type) params.type = type
    if (subType) params.subType = subType
    return get('/api/orders/evaluations', params, options)
  },

  addTrace: async (orderId, data) => {
    return post(`/api/orders/${orderId}/trace`, data)
  },

  getTraces: async (orderId, options) => {
    return get(`/api/orders/${orderId}/traces`, {}, options)
  },

  acceptOrder: async (orderId) => {
    return post(`/api/orders/${orderId}/accept`)
  },

  getNearbyOrders: async () => {
    return get('/api/orders/nearby')
  },

  evaluateOrder: async (orderId, rating, comment) => {
    return post(`/api/orders/${orderId}/evaluate`, { rating, comment })
  },

  deleteOrder: async (orderId) => {
    return del(`/api/orders/${orderId}`)
  },

  completeService: async (orderId) => {
    return post(`/api/orders/${orderId}/complete-service`)
  },

  addReward: async (orderId, extraReward) => {
    return post(`/api/orders/${orderId}/add-reward`, { extra_reward: extraReward })
  },

  confirmComplete: async (orderId) => {
    return post(`/api/orders/${orderId}/confirm-complete`)
  }
}

const BankAPI = {
  getBalance: async (options) => {
    return get('/api/bank/balance', {}, options)
  },

  getTransactions: async (page = 1, pageSize = 10) => {
    return get('/api/bank/transactions', { page, pageSize })
  },

  exchangeService: async (serviceId) => {
    return post('/api/bank/exchange/service', { serviceId })
  },

  exchangeGift: async (giftId) => {
    return post('/api/bank/exchange/gift', { giftId })
  },

  transfer: async (toUserId, amount) => {
    return post('/api/bank/transfer', { toUserId, amount })
  }
}

const IndexAPI = {
  getHomeData: async (options) => {
    return get('/api/home', {}, options)
  }
}

const UserAPI = {
  getUserInfo: async () => {
    return get('/api/user/info')
  },

  // ===== 互助员注册申请（角色管理精细化：填信息+签承诺书 → 社区管理员审核） =====
  getHelperPledge: async (options) => {
    return get('/api/user/helper-pledge', {}, options)
  },

  submitHelperApplication: async (data, options) => {
    return post('/api/user/helper-application', data, options)
  },

  getMyHelperApplication: async (options) => {
    return get('/api/user/helper-application', {}, options)
  },

  confirmHelperApplication: async (data, options) => {
    return post('/api/user/helper-application/confirm', data || {}, options)
  },

  markRejectReadHelperApplication: async (data, options) => {
    return post('/api/user/helper-application/reject-read', data || {}, options)
  },

  listUsers: async (options) => {
    return get('/api/user/list', {}, options)
  },

  updateUserInfo: async (data) => {
    return put('/api/user/info', data)
  },

  getCertificates: async () => {
    return get('/api/user/certificates')
  }
}

// ===== 管理员小程序端接口（后端 /api/admin/** 已就绪，H5 后台共用同一套） =====
const AdminAPI = {
  // 订单分页列表：params 支持 { status 状态筛选, keyword 关键词搜索, page 页码, size 每页条数 }
  getAdminOrders: async (params, options) => {
    return get('/api/admin/orders', params || {}, options)
  },

  // 各状态订单数 + 今日新增（页签数量徽标用）
  getAdminStats: async (options) => {
    return get('/api/admin/orders/stats', {}, options)
  },

  // 订单服务留痕时间轴（开工/完工打卡：照片+定位+时间）
  getAdminTraces: async (orderId, options) => {
    return get(`/api/admin/orders/${orderId}/traces`, {}, options)
  },

  // 互助员列表（指派时选择用）
  getHelpers: async (options) => {
    return get('/api/admin/helpers', {}, options)
  },

  // 手动指派互助员（待接单/待派单 → 直接服务中）
  assignOrder: async (orderId, helperId, options) => {
    return post(`/api/admin/orders/${orderId}/assign`, { helperId }, options)
  },

  // 管理员取消订单（可带原因）
  cancelAdminOrder: async (orderId, reason, options) => {
    return post(`/api/admin/orders/${orderId}/cancel`, { reason }, options)
  },

  // 审核：通过 / 驳回（驳回可带原因）
  reviewOrder: async (orderId, approve, reason, options) => {
    return post(`/api/admin/orders/${orderId}/review`, { approve, reason }, options)
  },

  // ===== 角色管理精细化 =====
  // 互助员注册申请列表：status 可选 pending/approved/rejected，空为全部
  getHelperApplications: async (params, options) => {
    return get('/api/admin/helper-applications', params || {}, options)
  },

  approveHelperApplication: async (id, options) => {
    return post(`/api/admin/helper-applications/${id}/approve`, {}, options)
  },

  rejectHelperApplication: async (id, reason, options) => {
    return post(`/api/admin/helper-applications/${id}/reject`, { reason }, options)
  },

  // 系统配置：查看 / 修改（修改强制写操作日志，民政管理员只读）
  getConfigs: async (options) => {
    return get('/api/admin/configs', {}, options)
  },

  updateConfig: async (key, value, options) => {
    return put('/api/admin/configs', { key, value }, options)
  },

  // 紧急干预（高危动作，原因必填 + 操作日志留痕）
  forceCancelOrder: async (orderId, reason, options) => {
    return post(`/api/admin/orders/${orderId}/force-cancel`, { reason }, options)
  },

  forceAssignOrder: async (orderId, helperId, reason, options) => {
    return post(`/api/admin/orders/${orderId}/force-assign`, { helperId, reason }, options)
  },

  // 操作日志（append-only，仅查询）：operateType 可选 CONFIG_CHANGE/FORCE_CANCEL/FORCE_ASSIGN
  getOperationLogs: async (params, options) => {
    return get('/api/admin/operation-logs', params || {}, options)
  }
}

module.exports = {
  OrderAPI,
  BankAPI,
  IndexAPI,
  UserAPI,
  AdminAPI
}
