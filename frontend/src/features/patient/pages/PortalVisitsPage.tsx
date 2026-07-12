import { useEffect, useState } from 'react'
import { listVisits } from '../../../api/patient'
import { VisitTimeline } from '../../../components/VisitTimeline'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import type { Visit } from '../../../types'

export function PortalVisitsPage() {
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
