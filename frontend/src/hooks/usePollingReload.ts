import { useEffect } from 'react'

/**
 * 條件輪詢：shouldPoll 為 true 時每 intervalMs 呼叫一次 reload。
 * reload 必須是穩定引用（useCallback），且**不得先清空資料**（避免整頁 Loading 閃爍）。
 */
export function usePollingReload(
  reload: () => void | Promise<unknown>,
  shouldPoll: boolean,
  intervalMs = 10_000,
) {
  useEffect(() => {
    if (!shouldPoll) return
    const timer = setInterval(reload, intervalMs)
    return () => clearInterval(timer)
  }, [reload, shouldPoll, intervalMs])
}
