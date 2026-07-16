import { TOKEN_KEY } from './client'

/**
 * 影片串流 URL（HTTP Range 206，faststart mp4 → 邊播邊緩衝）。
 * <video> 標籤無法帶 Authorization header，改以 ?token= 傳遞。
 * 代價：token 會出現在網址（瀏覽器歷史/伺服器 log），內網原型可接受。
 */
function withToken(path: string): string {
  const token = localStorage.getItem(TOKEN_KEY)
  return `/api/media${path}${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export function teacherVideoUrl(teacherVideoId: number): string {
  return withToken(`/teacher-videos/${teacherVideoId}/video`)
}

export function submissionVideoUrl(submissionId: number): string {
  return withToken(`/submissions/${submissionId}/video`)
}

/** 演算法輸出的比對影片 URL（full=完整分析畫面、plain=2×2 並排）。 */
export function analysisVideoUrl(submissionId: number, variant: 'full' | 'plain' = 'full'): string {
  const token = localStorage.getItem(TOKEN_KEY)
  const params = new URLSearchParams()
  if (variant !== 'full') params.set('variant', variant)
  if (token) params.set('token', token)
  const qs = params.toString()
  return `/api/media/submissions/${submissionId}/analysis-video${qs ? `?${qs}` : ''}`
}
