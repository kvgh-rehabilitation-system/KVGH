import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Check, Cpu } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import {
  getAnalysisData as getDoctorAnalysisData,
  getSubmission as getDoctorSubmission,
} from '../../../api/doctor'
import {
  getAnalysisData as getNurseAnalysisData,
  getSubmission as getNurseSubmission,
  reanalyzeSubmission,
} from '../../../api/nurse'
import { fetchPose3d } from '../../../api/pose'
import { Button } from '../../../components/ui/button'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { ScoreTrendChart } from '../../../components/ui/ScoreTrendChart'
import type { ActionCard, AnalysisData, CurvePoint, SubmissionDetail } from '../../../types'
import type { NpyArray } from '../../../utils/npy'
import { ActionBreakdown } from '../components/review/ActionBreakdown'
import { AiReportCard } from '../components/review/AiReportCard'
import { AnalysisPanel } from '../components/review/AnalysisPanel'
import {
  ComparisonVideoPanel,
  type ComparisonVideoHandle,
} from '../components/review/ComparisonVideoPanel'
import { MotionReplayPanel } from '../components/review/MotionReplayPanel'
import { ReviewSection } from '../components/review/ReviewSection'
import { SimilarityTimeline } from '../components/review/SimilarityTimeline'
import { SubmissionHeader } from '../components/review/SubmissionHeader'

interface Props {
  readOnly?: boolean
}

export function SubmissionReviewPage({ readOnly = false }: Props) {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SubmissionDetail | null>(null)
  // undefined = 載入中；null = 無資料（seed 或分析未完成），面板優雅降級
  const [analysisData, setAnalysisData] = useState<AnalysisData | null | undefined>(undefined)
  const [pose, setPose] = useState<NpyArray | null | undefined>(undefined)
  const [success, setSuccess] = useState(false)

  const videoHandleRef = useRef<ComparisonVideoHandle>(null)
  const videoSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!submissionId) return
    const loadSubmission = readOnly ? getDoctorSubmission : getNurseSubmission
    const loadAnalysisData = readOnly ? getDoctorAnalysisData : getNurseAnalysisData
    loadSubmission(submissionId).then(setData)
    loadAnalysisData(submissionId)
      .then(setAnalysisData)
      .catch(() => setAnalysisData(null))
    fetchPose3d(submissionId)
      .then(setPose)
      .catch(() => setPose(null))
  }, [submissionId, readOnly])

  if (!data) return <Loading />

  const analysis = data.analysis

  const seekAction = (a: ActionCard) => {
    videoHandleRef.current?.seekAction(a)
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const seekCurvePoint = (p: CurvePoint) => {
    videoHandleRef.current?.seekCurvePoint(p)
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const onReviewSuccess = () => {
    setSuccess(true)
    setTimeout(() => navigate('/nurse/submissions'), 1400)
  }

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </button>

      <div className="space-y-6">
        <SubmissionHeader
          data={data}
          role={readOnly ? 'doctor' : 'nurse'}
          readOnly={readOnly}
        />

        {analysis ? (
          <>
            {/* 3D 重播 + 演算法分析 */}
            <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
              <MotionReplayPanel analysis={analysis} pose={pose} />
              <AnalysisPanel analysis={analysis} />
            </div>

            {/* 動作分解與時間軸（需要比對明細） */}
            {analysisData ? (
              <>
                <ActionBreakdown actions={analysisData.actions} onSeek={seekAction} />
                <SimilarityTimeline
                  curve={analysisData.curve}
                  actions={analysisData.actions}
                  onSeek={seekCurvePoint}
                />
              </>
            ) : (
              analysisData === null && (
                <p className="px-1 text-xs text-bark-300">
                  此筆沒有演算法比對明細（動作分解與時間軸不可用）。
                </p>
              )
            )}

            {/* 比對影片（seek 目標） */}
            <div ref={videoSectionRef}>
              <ComparisonVideoPanel
                key={analysisData ? 'with-data' : 'raw-only'}
                ref={videoHandleRef}
                data={data}
                hasAnalysisData={!!analysisData}
              />
            </div>

            <AiReportCard report={analysis.ai_report} />

            {/* 歷次分數 */}
            {data.score_history.length > 1 && (
              <section className="card p-6">
                <h2 className="mb-4 text-base font-semibold text-bark-700">
                  「{data.item.name}」歷次分數
                </h2>
                <ScoreTrendChart data={data.score_history} height={200} />
              </section>
            )}
          </>
        ) : data.analysis_status === 'FAILED' ? (
          <div className="card space-y-3 p-6 text-sm">
            <p className="flex items-center gap-2 font-medium text-rust">
              <AlertTriangle size={17} /> 演算法分析失敗
            </p>
            {data.analysis_error && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-parchment/70 p-3 text-xs text-bark-500">
                {data.analysis_error}
              </pre>
            )}
            {!readOnly && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await reanalyzeSubmission(data.id)
                    toast.success('已重新排入分析，已萃取的資料會直接重用')
                    navigate(0)
                  } catch (err) {
                    toast.error(apiErrorMessage(err))
                  }
                }}
              >
                重新分析
              </Button>
            )}
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-6 text-sm text-bark-500">
            <Cpu size={18} className="animate-breathe text-clay-500" />
            演算法分析中（{data.analysis_status}），完成後即可審核。
          </div>
        )}

        <ReviewSection data={data} onSuccess={onReviewSuccess} readOnly={readOnly} />
      </div>

      {/* 成功動畫 */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-cream/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-sage-500 shadow-glow"
              >
                <Check size={40} className="text-white" strokeWidth={3} />
              </motion.div>
              <p className="font-display text-xl font-semibold text-bark-700">審核完成</p>
              <p className="text-sm text-bark-400">病患將在自己的頁面看到你的回饋</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
