# 智慧互助养老平台 · 项目地图（开发前必读）

> 每次开发任务先读本文件，按索引直达相关文件，不要全项目扫描。
> 业务需求定稿规则以《智慧互助养老平台整体实现方案》为准（双模式派单、超时兜底、信用、探访、审批等）。

## 一、项目简介与技术栈

社区互助养老服务平台：老人/家属发布互助需求 → 互助员接单上门服务 → 社区管理员审核监管 → 时间币结算激励。三端共用一套后端：

| 端 | 位置 | 技术 |
|---|---|---|
| 微信小程序（老人/家属/互助员） | 项目根目录（`pages/` `components/` `utils/` `images/`），微信开发者工具直接导入根目录 | 微信原生 WXML/WXSS/JS |
| H5 管理后台（管理员） | `admin-web/` | Vue 3.5 + Element Plus 2.8 + ECharts 6.1 + Vite 5，端口 5173，dev 代理到 3000 |
| 后端 | `backend-java/` | Java 17 + SpringBoot 3.5 + Spring Data JPA + MySQL 8，端口 3000，约 43 个接口 |

- 认证：JWT（7 天），请求头 `Authorization: token`；密码 SCrypt（BouncyCastle）；验证码固定 `123456`
- 统一响应 `{ code, message, data }`：code 0 成功、401 未登录、403 无权限
- 数据库 `elderly_care`（MySQL 8）；上传图片存项目外 `D:/elderly-care-data/uploads`
- 选型：单体 SpringBoot（社区级规模部署简单、出错面小，接口已分层、具备微服务演进空间）；小程序保持原生不迁 uni-app（仅支持微信端，性能最优）；Vue3 + Element Plus（组件齐全、中文文档完善）；SCrypt 而非 MD5（加盐抗暴力破解）；Thumbnailator 图片压缩、@Scheduled 定时任务（超时兜底）
- 角色管理精细化（2026-10-16）：内置超管 `superadmin`（初始密码 `Super@123456`，启动时 SuperAdminInitializer 幂等建表+建号，无创建入口，仅 H5）；超管仅能创建/启停社区管理员（角色串「管理员」）与民政管理员；互助员注册改审核制（选互助员→先落普通用户→申请页填信息+签承诺书→社区管理员审核通过置互助员角色）；系统配置（接单距离上限/并发上限）修改强制写 append-only 操作日志；民政管理员只读+两项紧急干预（强制取消/强制指派，原因必填+留痕）+查老人手机号脱敏
- 启动：`启动服务.bat`（后端）、`启动管理后台.bat`（H5 后台，自动开浏览器）、`启动外网访问.bat`（临时公网演示）
- 测试账号：`账号密码.text`（密码 = 手机号 + `hhL.`）

## 二、小程序页面（`pages/` 共 35 页，注册表 `app.json`）

| 页面 | 路径 | 说明 |
|---|---|---|
| 首页（tab） | `pages/index/` | 居民端首页 |
| 订单（tab） | `pages/order/` | 居民订单，含待接单/服务中/待确认/已完成/已取消页签（审核暂跳过，"待审核"页签已移除） |
| 订单详情 | `pages/order-detail/` | 共享详情页：时间轴（发单/接单/服务完成/取消）+按身份显示双方联系方式（未接单/已取消脱敏、电话置空，电话按钮拨号） |
| 时间银行（tab） | `pages/bank/` | 余额、流水 |
| 我的（tab） | `pages/mine/` | 居民个人中心，含「申请成为互助员」醒目入口+承诺书倒计时弹窗 |
| 互助员首页 | `pages/helper/index/` | 互助员端首页/抢单 |
| 互助员订单 | `pages/helper/order/` | 接单履约、打卡留痕 |
| 互助员时间银行 | `pages/helper/bank/` | 互助员台账 |
| 互助员我的 | `pages/helper/mine/` | 互助员个人中心 |
| 服务打卡留痕 | `pages/helper/trace/` | 开工/完工打卡：定位+现场拍照+人工确认（完工打卡为完成服务前置） |
| 管理员工作台 | `pages/admin/index/` | 管理员小程序端：统计概览、订单管理入口（管理角色登录自动进入；民政管理员只读+紧急干预+脱敏） |
| 管理员订单管理 | `pages/admin/orders/` | 手机端审核（通过/驳回）、指派互助员、取消订单、详情+服务留痕；民政管理员强制取消/强制指派（原因必填+操作日志留痕） |
| 互助员申请审核 | `pages/admin/helper-audit/` | 社区管理员：互助员注册申请列表+通过/驳回（驳回必填原因） |
| 系统配置与日志 | `pages/admin/config/` | 业务参数修改（社区管理员/超管，自动留痕）+操作日志查看（append-only） |
| 互助员申请 | `pages/helper/apply/` | 「我的」页入口→承诺书倒计时弹窗同意后进入：填信息（姓名/只读手机号/年龄18-70校验/性别单选/简介快捷标签）提交申请；展示审核状态/驳回原因（可修改重提） |
| 发布需求 | `pages/publish/` | 老人/家属发布互助需求 |
| 陪诊下单 / 类型详情 | `pages/peizhen/` `pages/peizhen-type/` | 陪诊专项（类型详情页含健康评估入口+用户评价区） |
| 陪诊专属下单页 | `pages/peizhen-order/` | 医院两级选择/帮办事项多选/患者信息/就诊时间/健康评估联动/单据上传 |
| 健康评估问卷 | `pages/health-assessment/` | 陪诊下单前身体状况评估（风险分级，结果随订单提交） |
| 医院 | `pages/hospital/` | 医院列表/选择 |
| 互助员列表 / 详情 | `pages/helpers/` `pages/helper-detail/` | 浏览互助员 |
| 评价 | `pages/rating/` | 订单评价 |
| 健康 | `pages/health/` | 健康服务 |
| 一键求助 / 紧急联系人 | `pages/sos/` `pages/emergency/` | SOS |
| 消息 | `pages/notice/` | 通知列表 |
| 账号与安全 | `pages/account/` | 头像/昵称修改、手机号展示（未绑可补绑）、微信绑定（角色切换功能暂移除，后续再加） |
| 资料 / 设置 / 地址 / 关于 | `pages/profile/` `pages/setting/` `pages/address/` `pages/about/` | 个人页 |
| 服务兑换 / 实物兑换 | `pages/serviceExchange/` `pages/giftExchange/` | 时间币兑换 |

公共代码：`utils/request.js`（请求封装）、`utils/api.js`（接口地址）、`utils/auth.js`（登录态工具）、`utils/helper-data.js`、`utils/peizhen-data.js`（本地演示数据）、`config.js`（后端地址）、`components/`（nav-bar、select-panel、**login-popup 全局登录弹窗**）。
登录方式：游客可浏览，操作时拦截弹出 `login-popup`——微信快捷登录（未绑定微信自动建号直登，手机号后续在账号页补绑）或短信登录（只输手机号，未注册自动建号）；**所有新用户默认普通用户（老人），互助员身份经「我的」页入口申请→承诺书倒计时签署→社区管理员审核（通过后重新登录自动进互助员端）**；H5 后台仍用账号密码（超管账号 `superadmin` 内置）。

## 三、后端接口（`backend-java/src/main/java/com/elderly/care/controller/`）

| 文件 | 接口 |
|---|---|
| `UserController.java` | 认证与用户：`/api/user/login`、`/api/user/register`、`/api/user/wechat-login`（微信免密登录）、`/api/user/wechat-bind`（微信补绑手机号）、`/api/user/bind-openid`（绑定微信openid，订阅消息用）、`/api/user/info`、`/api/user/certificates`、`/api/user/list` |
| `OrderController.java` | 订单：`/api/orders`（mine/nearby/public）、`/api/orders/evaluations`（公开评价列表）、`/api/orders/type-stats`（类型真实销量统计）、`/api/orders/:id/` 下的 accept、grab、cancel、complete-service、add-reward、confirm-complete、evaluate、trace（打卡留痕）、traces（留痕列表）、`/api/home` |
| `BankController.java` | 时间银行：`/api/bank/balance`、`/api/bank/transactions`、`/api/bank/exchange/*`（服务/实物/转赠） |
| `MessageController.java` | 消息：`/api/messages`、未读数、标记已读 |
| `UploadController.java` | 图片上传 `/api/upload`（最多 3 张，压缩到 800px） |
| `AdminController.java` | 管理端 `/api/admin/**`（仅管理员角色）：订单审核/指派/取消、统计报表、用户管理、互助员列表、订单留痕查询 |

配套目录：`service/`（业务逻辑）、`repository/`（JPA 数据访问）、`entity/`（实体=表）、`config/JwtUtil.java`、`security/JwtAuthFilter.java`（JWT 鉴权过滤器）、`common/Result.java`（统一响应）。

订单状态机：待接单 pending → 服务中 serving → 待确认 pending_confirm → 已完成 completed；**审核环节已按产品决定暂跳过（2026-10-10），发布即待接单**（方案原为"发布先经管理员审核"，恢复时改 OrderService.create 状态并放开订单页"待审核"页签）；**超时兜底已按产品调整（2026-10-16）：待接单超 30 分钟不再自动转待派单池，订单留在广场置顶显示超时时长（仍可抢单），管理员端标记"建议指派"（恢复转池机制见 AdminService.sweepTimeoutOrders 注释）**。

## 四、数据库表（8 张，实体在 `backend-java/src/main/java/com/elderly/care/entity/`；ddl-auto=none，新表由 `config/SuperAdminInitializer.java` 启动时幂等建表）

| 实体 | 说明 |
|---|---|
| `User.java` | 用户：六角色（老人/家属/互助员/管理员[社区管理员]/民政管理员/超级管理员，代码内角色串以此为准）、时间币余额、status 账号状态（1 正常/0 禁用，null 视为正常） |
| `Order.java` | 订单：状态机字段、接单互助员、金额/加价、留痕、sub_type 服务子类型（评价按子类型展示）、就诊人三字段、tasks 帮办事项 JSON、assessment 健康评估 JSON（结构化统计） |
| `ServiceTrace.java` | 服务留痕：开工/完工打卡（定位+现场照片），完工打卡为完成服务前置 |
| `Transaction.java` | 时间币收支流水 |
| `Message.java` | 站内消息 |
| `HelperApplication.java` | 互助员注册申请：信息+承诺书版本/签署时间、pending/approved/rejected、驳回原因（审核通过置用户为互助员） |
| `SystemConfig.java` | 系统配置键值：helper_grab_radius_km（接单距离上限，默认5）、helper_max_concurrent_orders（并发上限，默认3） |
| `OperationLog.java` | 操作日志 append-only（仅插入查询，无修改删除）：CONFIG_CHANGE/FORCE_CANCEL/FORCE_ASSIGN + 修改前后内容 + 原因 |

## 五、H5 管理后台页面（`admin-web/src/views/`）

| 文件 | 说明 |
|---|---|
| `Login.vue` | 管理员登录 |
| `Layout.vue` | 后台整体布局（菜单按角色显隐：超管=管理员账号；社区=互助员审核） |
| `Orders.vue` | 订单管理（审核/指派/取消）；民政管理员强制取消/强制指派（原因必填+留痕） |
| `Stats.vue` | 统计报表（ECharts）+ 汇总报表 CSV 导出 |
| `Users.vue` | 用户/账号管理（社区管理员启停普通用户/互助员；民政看脱敏手机号） |
| `AdminAccounts.vue` | 超管：新建/启停社区管理员与民政管理员账号 |
| `HelperAudit.vue` | 社区管理员：互助员注册申请审核 |
| `SystemConfig.vue` | 系统配置修改（留痕）+ 操作日志只读查看 |

## 六、文档与约定（本文件保留在根目录以便自动加载；其余说明文档集中存于 `project_docs/`）

- `project_docs/智慧互助养老平台整体实现方案.md`：周总提供的原始完整需求方案，业务需求定稿以此为准
- `project_docs/项目进度.md`：实时进度文档，**每完成一个开发/修复/数据变更任务必须更新**（更新记录加一行，并修正"实现进度总览"状态）
- `project_docs/试玩版操作手册.md`：试玩演示操作步骤（账号/环境准备/演示剧本/常见问题）
- `project_docs/通知功能配置清单.md`：订阅消息（微信模板申请）+ 短信（阿里云）配置步骤；未配置时通知静默跳过
- 陪诊遗留事项：专项陪诊 11 张配图未出（产出后放 `images/陪诊/专项陪诊/`，改 `utils/peizhen-data.js` 对应 image 字段）；后台服务项目管理入口（增删改查+小程序自动同步）未开发（跟踪见项目进度.md）
- `scripts/`：演示数据脚本（`reset-demo-data.js` 一键重置、`prepare-peizhen-demo.js` 陪诊试玩版演示数据、`seed-evaluations.js` 陪诊评价种子、`integration-test-peizhen.js` 陪诊联调测试、`replace-order-images.js` 订单图片随机替换）
