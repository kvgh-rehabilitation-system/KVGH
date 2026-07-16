/**
 * 全站唯一的 axios 實例：自動帶 Bearer token、401 統一導回登入頁。
 * baseURL 用相對路徑 /api——容器部署走 nginx 反代、本機 dev 走 vite proxy，兩邊通用。
 */
import axios from 'axios'

export const TOKEN_KEY = 'kvgh_token'
export const USER_KEY = 'kvgh_user'

export const client = axios.create({ baseURL: '/api' })

// 請求攔截器：每個請求出門前補上 localStorage 的 token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 回應攔截器：token 過期/無效（401）→ 清掉登入狀態、整頁導回 login。
// 排除已在 /login 的情況，避免登入失敗（也是 401）觸發重導迴圈
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** 從 axios error 取出後端 detail 訊息 */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return '發生錯誤，請稍後再試'
}
