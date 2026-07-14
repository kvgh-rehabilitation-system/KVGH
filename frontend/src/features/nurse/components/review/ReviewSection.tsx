import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Megaphone, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../../api/client'
import { createReport, reviewSubmission } from '../../../../api/nurse'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import { Textarea } from '../../../../components/ui/textarea'
import type { ReportKind, ReviewDecision, SubmissionDetail } from '../../../../types'
import {
  decisionLabel,
  formatDateTime,
  reportKindLabel,
  severityLabel,
} from '../../../../utils/format'

interface Props {
  data: SubmissionDetail
  /** 審核送出成功後呼叫（頁面顯示成功動畫並導回列表） */
  onSuccess: () => void
  readOnly?: boolean
}

/** 審核與回饋區：通過／需注意 + 給病患留言 + 回報醫生 */
export function ReviewSection({ data, onSuccess, readOnly = false }: Props) {
  const reviewed = data.status === 'REVIEWED'
  const [feedback, setFeedback] = useState(data.feedback ?? '')
  const [decision, setDecision] = useState<ReviewDecision | null>(data.decision)
  const [submitting, setSubmitting] = useState(false)

  // 回報醫生
  const [reportOpen, setReportOpen] = useState(false)
  const [reportKind, setReportKind] = useState<ReportKind>('STATUS_REPORT')
  const [reportSeverity, setReportSeverity] = useState('NORMAL')
  const [reportContent, setReportContent] = useState('')
  const [reporting, setReporting] = useState(false)

  const submitReview = async () => {
    if (!decision) {
      toast.error('請選擇審核結果（通過 / 需注意）')
      return
    }
    setSubmitting(true)
    try {
      await reviewSubmission(data.id, { decision, feedback: feedback || null })
      onSuccess()
    } catch (err) {
      toast.error(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  const submitReport = async () => {
    if (!reportContent.trim()) {
      toast.error('請填寫回報內容')
      return
    }
    setReporting(true)
    try {
      await createReport({
        plan_id: data.plan_id,
        submission_id: data.id,
        kind: reportKind,
        severity: reportSeverity,
        content: reportContent,
      })
      toast.success('已回報醫生')
      setReportOpen(false)
      setReportContent('')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setReporting(false)
    }
  }

  return (
    <section className={`card p-6 ${reviewed || readOnly ? '' : 'border-clay-200/80 shadow-glow'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-bark-700">
          {reviewed ? '審核結果' : readOnly ? '審核狀態' : '審核與回饋'}
        </h2>
        {!readOnly && (
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Megaphone size={14} /> 回報醫生
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>回報醫生</DialogTitle>
                <DialogDescription>
                  針對 {data.patient_name} 的「{data.plan_name}」向主治醫師回報。
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="label">回報類型</span>
                    <Select value={reportKind} onValueChange={(v) => setReportKind(v as ReportKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(reportKindLabel).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="label">嚴重程度</span>
                    <Select value={reportSeverity} onValueChange={setReportSeverity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(severityLabel).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <span className="label">回報內容</span>
                  <Textarea
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="描述病患狀況、分數變化或建議的計畫調整…"
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReportOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitReport} disabled={reporting}>
                  {reporting ? '送出中…' : '送出回報'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {reviewed ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={data.decision!} label={decisionLabel[data.decision!]} />
            <span className="text-xs text-bark-300">
              {data.reviewer_name}・{formatDateTime(data.reviewed_at)}
            </span>
          </div>
          {data.feedback && (
            <p className="rounded-xl bg-sage-50 p-4 leading-relaxed text-bark-600">
              {data.feedback}
            </p>
          )}
        </div>
      ) : readOnly ? (
        <p className="rounded-xl bg-parchment/60 p-4 text-sm text-bark-400">
          此影片尚未完成護理審核。
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <span className="label">給病患的回饋留言</span>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例如：動作標準，繼續保持！或提醒病患對照範例影片修正…"
              rows={3}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDecision('APPROVED')}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                decision === 'APPROVED'
                  ? 'border-sage-500 bg-sage-50 text-sage-700 shadow-soft'
                  : 'border-sand bg-white text-bark-500 hover:border-sage-300'
              }`}
            >
              <ThumbsUp size={16} /> 通過
            </button>
            <button
              onClick={() => setDecision('NEEDS_ATTENTION')}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all ${
                decision === 'NEEDS_ATTENTION'
                  ? 'border-rust bg-[#FBF5F3] text-rust shadow-soft'
                  : 'border-sand bg-white text-bark-500 hover:border-rust/40'
              }`}
            >
              <AlertTriangle size={16} /> 需注意
            </button>
            <div className="flex-1" />
            <Button size="lg" onClick={submitReview} disabled={submitting}>
              <CheckCircle2 size={17} />
              {submitting ? '送出中…' : '完成審核'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
