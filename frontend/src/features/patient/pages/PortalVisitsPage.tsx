import { useEffect, useState } from 'react'
import { listVisits } from '../../../api/patient'
import { VisitTimeline } from '../../../components/VisitTimeline'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import type { Visit } from '../../../types'

/**
 * 病患端看診紀錄頁：唯讀時間軸列出自己的歷史看診（醫師、診斷、處置決定）。
 * 資料一次載入不輪詢——看診紀錄只會在醫師建立後改變，頁面停留期間不會更新。
 */
export function PortalVisitsPage() {
  // null = 載入中，[] = 已載入但無紀錄，兩者 UI 不同（Loading vs EmptyState）
  const [visits, setVisits] = useState<Visit[] | null>(null)

  useEffect(() => {
    listVisits().then(setVisits)
  }, [])

  if (!visits) return <Loading />

  return (
    <PageTransition>
      <PageHeader title="看診紀錄" subtitle="您的歷史看診資訊" />
      {visits.length === 0 ? (
        <EmptyState message="尚無看診紀錄" />
      ) : (
        <div className="max-w-3xl">
          <VisitTimeline visits={visits} />
        </div>
      )}
    </PageTransition>
  )
}
