# 项目演示前 Bug 与风险体检报告

> 生成日期：2026-10-19 · 审计方式：4 个只读审计维度（状态机资金 / 接口假数据 / 权限 / 双端同步）全量扫描 + 关键结论二次复核，每条附 文件:行号。
> 修复进度：P0 批次修复中（2026-10-19 起）。

---

## 🔴 致命（12 项）——按「演示会不会露馅」排序

### A 组：演示现场必现（观众能看见）

**🔴-1 登录成功后首页不重拉数据，游客态空屏**
`pages/index/index.js:118-120` — `onLoginSuccess` 只关弹窗不调 `loadHomeData`。演示第一步：游客点下单 → 登录 → 首页附近订单仍是空的，切 tab 才恢复。**修法**：onLoginSuccess 里补 `this.loadHomeData()`。✅ 已修（2026-10-19）

**🔴-2 时间银行 tab 永不刷新**
`pages/bank/bank.js:28-33` — onShow 只查 token，`loadBankData` 只在 onLoad 执行一次。结算/退款后切到时间银行，余额流水全是旧数据。**修法**：onShow 有 token 时重拉。✅ 已修（2026-10-19）

**🔴-3 「我的」页三个编造兜底数字**
`pages/mine/mine.js:78-80` — `timeCoins || 168`、`serviceCount || 12`、`evaluationScore || 4.9`，后两个字段后端根本不下发（`orders`/`rating` 不存在），新注册账号恒显示「12 单 / 4.9 分」。**修法**：serviceCount 改用后端已下发的 `serviceCount`，评分无数据时显示「暂无」，删掉兜底。✅ 已修（2026-10-19）

**🔴-4 提现全链路前端零入口（6 个接口全是死代码）**
后端完备（`/api/bank/withdraw` + `/api/admin/withdrawals` approve/reject/paid），但 pages/ 与 admin-web 全项目 grep 不到一个提现按钮/页面。互助员「我的」页能看见 ¥ 余额（刚加的），却没有任何出口。**修法**：互助员端加提现申请入口 + H5 加提现审核页。

**🔴-5 服务中取消后的「人工退款」无任何 UI 入口 → 资金永久冻结**
`AdminController.java:311` 有接口，但 H5 Orders.vue 和小程序管理端都没有「退款」按钮。演示「服务中取消 → 资金裁决」环节：钱冻住了，管理员在界面上退不回去。**修法**：H5 订单操作列给已取消且有冻结资金的订单加「退款」按钮。

**🔴-6 待支付订单三端不可见 → 支付中断即孤儿订单**
订单页/管理端小程序/H5 均无「待支付」页签或筛选。陪诊下单弹窗期间杀小程序/断网 → 订单永久 pending_pay，本人看不到、取消不了（后端支持 pay/cancel，纯没入口）。**修法**：订单页加「待支付」页签（支付/取消按钮），或后端加超时自动作废。

**🔴-7 首页消息红点硬编码 + 已读仅本地**
`pages/index/index.js:23` `hasUnreadMessages: true` 永不读 `/api/messages/unread`；notice 页已读是纯本地 setData，刷新还原。**修法**：首页接 unread 接口，notice 点击时调 `PUT /api/messages/read`。✅ 已修（2026-10-19）

### B 组：资金正确性（不演示也会出事）

**🔴-8 人工退款不校验订单已取消 → 对服务中订单退款+再结算 = 凭空铸币**
`AdminService.java:389-400` — manualRefund 只查「非 completed / 未退 / 未结算 / 有冻结资金」，没查 statusKey==cancelled。对一张 serving 订单退款 → 冻结币退回下单人、refunded=1 → 订单继续走完打卡/完成/确认 → 结算再给互助员全额。平台净增一单金额。**修法**：开头加 `if (!"cancelled".equals(statusKey)) return error`。

**🔴-9 评价接口完全无校验**
`OrderService.java:676-692` — `uid` 参数未使用：不查订单归属、不查状态、不查已评、rating 可写 999。任意登录用户可评任意订单/刷分/覆盖。**修法**：校验 `uid==userId && statusKey==completed && evaluated==0`，rating 限 1-5。

### C 组：安全红线（演示期可权衡，上线前必须闭环）

**🔴-10 登录体系可被零成本击穿**
`UserService.java:262` 固定验证码 `123456` 可登录任意已注册账号（含管理员/超管）；`UserService.java:81` `phone-login` 连验证码都没有，传手机号即发 token。产品定稿的演示设计（试玩版约定），但意味着拿到管理员手机号 = 拿到管理员权限。**修法**：演示期至少给管理角色账号禁用 phone-login 通道；上线前接真实短信。

**🔴-11 公开接口泄露全量完整手机号 + 老人住址**
`JwtAuthFilter.java:42` `/api/user/list` 在公开白名单，`UserService.java:345-359` 返回全用户明文手机号，匿名可爬。叠加 `/api/orders/public` 返回老人家庭住址+服务时间。**修法**：list 移出白名单或脱敏；public 订单地址只留街道级。

**🔴-12 订单详情/留痕无归属校验 → 就诊人、健康评估、GPS 坐标裸奔**
`OrderService.java:189-228` `detail(String orderId)` 签名里没有 uid——任意登录用户传任意订单号，可读就诊人姓名/年龄、健康评估、家庭地址、打卡照片与经纬度。**修法**：uid 必须 ∈ {下单人, 接单人} 或为管理员。

---

## 🟡 警告（19 项，按维度分组）

### 状态机与资金

1. **pending_confirm 永久卡死**：老人不确认 → 无超时自动确认、下单人不能取消（cancel 白名单无此状态）、互助员并发额度被占满 3 单后无法再接单。`OrderService.java:480-483`
2. **serving 卡死**：互助员永不打卡/永不完成 → 只有下单人取消（资金又因 🔴-5 无退款 UI 冻结）或管理员取消。
3. **accept/grab/complete-service 无锁无事务**：双互助员同时抢单 last-write-wins；取消与完成并发可把已退款订单「复活」再结算（低概率 TOCTOU）。`OrderService.java:382-416`
4. **指派/强制指派不受并发上限约束**：可给满 3 单的互助员派第 4 单。`AdminService.java:304-344`
5. **发布页固定 5 币、无时长选择**：1~24 小时规则名存实亡。`pages/publish/publish.js:391`
6. **发布页可选「陪诊服务」但提交必失败**（死胡同）：rmbAmount 没接，后端必拦 400。`pages/publish/publish.js:14` ✅ 已修（2026-10-19，从通用发布页移除陪诊服务选项）
7. **softDelete 无状态校验**：API 层可软删服务中订单 → 全线不可见、冻结资金无处可退。`OrderService.java:503-512`
8. **服务中取消的资金裁决只有「全额退下单人」**，无「判给互助员」通道；提现审核 approve/reject 无行锁（并发窗口极窄，存疑）。
9. **pay/cancel 并发竞态**：已取消订单可被「复活」为待接单（低概率，存疑）。

### 权限与双身份

10. **管理员/超管账号可以直接抢单**：accept 只拦「老人/家属」两个角色。`OrderService.java:387`
11. **双身份口径不一致**：审核通过→未确认切换的窗口期，前端显示接单端入口、后端 accept/withdraw 全 403；超管把互助员降级后 is_helper 残留=1 → 前端永久展示接单端、后端永久拒绝。后端认 role、前端认 isHelper，需统一。
12. **wechat-bind 固定验证码可劫持未绑微信的账号**（绑定攻击者 openid 直取受害者 token）。`UserService.java:186-230`
13. **changeRole 可把任意用户直接提为超级管理员**、无操作日志。`AdminService.java:455-467`
14. **强制取消/强制指派无细分角色检查**（三个管理角色皆可调，与「仅民政+超管」口径不符）；超管还能启停普通用户/改配置（超「仅账号管理」口径）。

### 双端同步与体验

15. **互助员广场对指派单无感知**：H5 指派后广场列表只是少一单，无横幅/角标；订阅推送依赖 openid 且只在主动接单时引导订阅。演示「指派后互助员端变化」需预先停在「我的订单」页。
16. **H5 订单详情留痕时间轴不实时**：只在打开弹窗时拉一次，开着弹窗等打卡不会自己出现。`admin-web/src/views/Orders.vue:353-363`
17. **「我的」页审核状态无轮询 + 驳回弹窗双请求竞态**：H5 审核后，小程序停在「我的」页看不到结果，须切 tab 往返；冷启动时可能同一驳回弹窗弹两次。
18. **H5 Orders/Stats 轮询未传 silent**：演示中断网/后端重启时每 5-10 秒弹一条错误提示刷屏。
19. **假数据与死按钮**：
    - 5 个整页全假数据：health（张大爷血压）、sos、emergency、address、setting；
    - `utils/helper-data.js` 3 个互助员档案全字段空 → 互助员详情页档案区一片空白；
    - 14 处「开发中」toast 死按钮（含首页消息铃铛——notice 页已实现、我的互助员——helpers 页已实现）；
    - 转赠按钮与后端「禁用转赠」规则冲突（点出来是「开发中」，显得功能残缺）；
    - 首页公告是后端写死的 2 条固定文案；
    - 接单距离配置改了无任何业务效果（模型无坐标，注释自认）。

---

## 🟢 优化（暂不影响演示，共 14 项）

- 鉴权失败 HTTP 恒 200（body 里 401/403）、CORS 全开、异常回显原始 message、JWT 算法未钉死、`/api/admin/**` 重复查库
- 硬编码密钥入库：`application.yml:27` jwt-secret 默认值、微信 secret、DB root/123456、超管 Super@123456（本地演示可接受，上线前轮换）
- 死标志 `goToCancelledTab`（有读无写）；`needRefreshOrders` switchTab 失败时残留
- `home()` 接口返回写死的 userInfo（150 币/8 单，前端没消费）；refundOnCancel 后 frozenCoins 不清零；admin timeout 字段对所有状态计算
- 兑换商品前后端双写硬编码；api.js 3 个零调用封装；transactions 分页参数被后端忽略
- dispatch_pool 已成死路径（accept/grab/assign/cancel 里的兼容分支）；订单页「转入待派单池」提示文案已失效（10-16 调整后永不转池）
- H5 HelperAudit 不查 document.hidden；Orders.vue 轮询无 in-flight 守卫；小程序管理端 4 页无轮询
- 后端 21 个接口无前端承接（register/role/wechat-bind/certificates/helper-pledge/nearby/traces/grab/transfer/notify-test/refund 等——多数是兼容保留，提现 6 个见 🔴-4）

---

## 修复批次建议

| 批次 | 内容 | 预估量 |
|---|---|---|
| **P0 演示前必修** | 🔴-1~7（纯前端小修）+ 🔴-8/9（后端 2 处校验）+ 发布页陪诊死胡同 | 9 项 |
| **P1 强烈建议** | 待支付页签、指派单横幅、H5 详情弹窗轮询、H5 silent、死按钮清理、双身份口径统一、accept 白名单、changeRole 收紧 | 约半天 |
| **P2 演示后再说** | 行锁补全、超时自动确认/作废、退款裁决「判给互助员」、安全红线 🔴-10~12、假数据 5 页、密钥轮换 | 上线前完成即可 |

## 一句话总结

状态机主链和资金结算的幂等设计是稳的（settled/refunded 双标志、行锁都在关键路径上），正向接口断层为 0；真正的雷在「三个不可见」（待支付订单、提现入口、人工退款按钮）+「三处没接上的刷新」（首页登录后、时间银行 tab、详情弹窗）+「假数据兜底」。
