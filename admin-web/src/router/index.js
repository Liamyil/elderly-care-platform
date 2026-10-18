import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/orders',
    children: [
      { path: 'orders', component: () => import('../views/Orders.vue') },
      { path: 'stats', component: () => import('../views/Stats.vue') },
      { path: 'users', component: () => import('../views/Users.vue') },
      { path: 'accounts', component: () => import('../views/AdminAccounts.vue') },
      { path: 'helper-audit', component: () => import('../views/HelperAudit.vue') },
      { path: 'config', component: () => import('../views/SystemConfig.vue') }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

// 登录守卫：未登录跳转登录页
router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) {
    return '/login'
  }
  if (to.path === '/login' && token) {
    return '/'
  }
  return true
})

export default router
