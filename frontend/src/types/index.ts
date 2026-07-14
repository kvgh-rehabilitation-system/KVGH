// ---- Auth ----
export type Role = 'admin' | 'doctor' | 'nurse' | 'patient'

export interface AuthUser {
  username: string
  name: string
  role: Role
}

// ---- Visit ----
export interface Visit {
  id: number
  visit_date: string
  status: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED'
  visit_type: 'FIRST' | 'FOLLOW_UP'
  chief_complaint: string | null
  diagnosis: string | null
  assessment: string | null
  rehab_decision: string | null
  follow_up_date: string | null
  doctor_name: string
}

// ---- 上傳 / 演算法分析 / 審核 ----

export type SubmissionStatus = 'ANALYZING' | 'PENDING_REVIEW' | 'REVIEWED'
export type ReviewDecision = 'APPROVED' | 'NEEDS_ATTENTION'

export interface JointDeviation {
  joint: string
  label: string
  deviation_deg: number
  status: 'OK' | 'HIGH'
}

export interface MotionSequence {
  fps: number
  joints: string[]
  frames: number[][]
}

export interface AnalysisMetrics {
  joint_deviations: JointDeviation[]
  motion_sequence: MotionSequence
}

export interface Analysis {
  analyzed_at: string
  overall_score: number
  joint_angle_score: number
  stability_score: number
  posture_score: number
  metrics: AnalysisMetrics
  summary_text: string | null
  /** LLM 分析報告（未來由 LLM worker 產生；目前為 null 顯示預告卡） */
  ai_report: string | null
}

// ---- 審核頁儀表板（analysis-data 端點）----

/** 一個 TALMA 步驟段：導師/病患幀區間與其在輸出影片中的基準幀 */
export interface AnalysisSegment {
  index: number
  patient_start: number
  patient_end: number
  mentor_start: number
  mentor_end: number
  plain_base: number
  full_base: number
}

/** 動作分解卡：後端已預算好各影片版本的跳轉秒數 */
export interface ActionCard {
  index: number
  similarity: number
  patient_frame: number
  mentor_frame: number
  t_patient: number
  t_mentor: number | null
  t_plain: number
  t_full: number
  segment: AnalysisSegment
}

export interface CurvePoint {
  frame: number
  similarity: number
  t_patient: number
  t_plain: number
  t_full: number
}

export interface JointSeries {
  joint: string
  label: string
  values: number[]
}

export interface JointDeviationSeries {
  frames: number[]
  joints: JointSeries[]
}

export interface AnalysisData {
  version: number
  submission_id: number
  overall_score: number
  joint_angle_score: number
  stability_score: number
  posture_score: number
  summary_text: string | null
  joint_deviations: JointDeviation[]
  patient_fps: number
  output_fps: number
  mentor: {
    teacher_video_id: number
    fps: number | null
    frame_count: number | null
  } | null
  actions: ActionCard[]
  curve: CurvePoint[]
  joint_deviation_series: JointDeviationSeries | null
}

export interface ScoreTrendPoint {
  date: string
  overall: number
  joint_angle: number
  stability: number
  posture: number
}

export interface CompletionTrendPoint {
  week_start: string
  label: string
  completed: number
  prescribed: number
  rate: number
}

export interface SubmissionListItem {
  id: number
  patient_id: number
  patient_name: string
  patient_number: string
  plan_id: number
  plan_name: string
  item_name: string
  submitted_at: string
  status: SubmissionStatus
  decision: ReviewDecision | null
  overall_score: number | null
  needs_attention: boolean
}

export interface SubmissionItemInfo {
  id: number
  name: string
  frequency: string | null
  description: string | null
  precaution: string | null
  example_video_url: string | null
  example_video_note: string | null
  teacher_video_id: number | null
}

export interface SubmissionDetail {
  id: number
  patient_id: number
  patient_name: string
  patient_number: string
  patient_age: number
  patient_gender: string
  plan_id: number
  plan_name: string
  plan_version: number
  item: SubmissionItemInfo
  submitted_at: string
  duration_seconds: number | null
  video_url: string | null
  status: SubmissionStatus
  analysis_status: AnalysisPipelineStatus
  analysis_error: string | null
  teacher_video_id: number | null
  analysis: Analysis | null
  reviewer_name: string | null
  reviewed_at: string | null
  decision: ReviewDecision | null
  feedback: string | null
  score_history: ScoreTrendPoint[]
}

export interface SubmissionListResponse {
  summary: {
    pending_review_count: number
    analyzing_count: number
    reviewed_today_count: number
    needs_attention_count: number
  }
  submissions: SubmissionListItem[]
}

export interface ReviewSubmit {
  decision: ReviewDecision
  feedback: string | null
}

// ---- 護理師回報醫生 ----

export type ReportKind = 'STATUS_REPORT' | 'ADJUSTMENT_SUGGESTION' | 'ABNORMALITY'

export interface NurseReport {
  id: number
  plan_id: number
  plan_name: string
  patient_id: number
  patient_name: string
  patient_number: string
  submission_id: number | null
  nurse_name: string
  kind: ReportKind
  severity: string
  content: string
  created_at: string
  status: 'PENDING_DOCTOR_REVIEW' | 'REVIEWED'
  doctor_comment: string | null
}

export interface NurseReportCreate {
  plan_id: number
  submission_id?: number | null
  kind: ReportKind
  severity: string
  content: string
}

// ---- Doctor: dashboard ----
export interface DoctorDashboard {
  summary: {
    today_patient_count: number
    waiting_patient_count: number
    completed_patient_count: number
    pending_report_count: number
  }
  today_patients: TodayPatient[]
  plan_reminders: PlanReminder[]
  pending_reports: NurseReport[]
}

export interface TodayPatient {
  patient_id: number
  patient_name: string
  patient_number: string
  visit_id: number
  visit_type: string
  status: string
  last_visit_date: string | null
  rehab_status: string
}

export interface PlanReminder {
  plan_id: number
  patient_name: string
  plan_name: string
  status: string
  evaluation_date: string | null
  reason: string
}

// ---- Doctor: patients ----
export interface PatientListItem {
  id: number
  patient_number: string
  name: string
  age: number
  gender: string
  last_visit_date: string | null
  visit_type: string | null
  rehab_status: string
  is_overdue: boolean
}

export interface PatientBasicInfo {
  id: number
  patient_number: string
  name: string
  birth_date: string
  age: number
  gender: string
  phone: string | null
  created_at: string
}

export interface PatientDetail {
  basic: PatientBasicInfo
  summary: {
    last_visit_date: string | null
    visit_count: number
    active_plan_count: number
    last_submission_date: string | null
  }
  rehab_status: string
  latest_visit: Visit | null
  current_plan: PlanCard | null
}

// ---- Plans ----
export interface PlanCard {
  id: number
  name: string
  status: string
  start_date: string
  evaluation_date: string | null
  nurse_name: string | null
  current_version: number | null
}

// ---- 導師影片與分析 pipeline ----

export type ExtractionStatus =
  | 'PENDING'
  | 'TRANSCODING'
  | 'EXTRACTING'
  | 'EXTRACTED'
  | 'FAILED'
export type AnnotationStatus = 'UNANNOTATED' | 'ANNOTATING' | 'ANNOTATED'
export type AnalysisPipelineStatus =
  | 'PENDING'
  | 'TRANSCODING'
  | 'EXTRACTING'
  | 'COMPARING'
  | 'DONE'
  | 'FAILED'

/** plan item 上綁定的導師影片狀態摘要 */
export interface PlanItemTeacherVideo {
  id: number
  name: string | null
  uploader_name: string | null
  extraction_status: ExtractionStatus
  annotation_status: AnnotationStatus
  fps: number | null
  frame_count: number | null
  extraction_error: string | null
}

export interface TeacherVideoFolder {
  id: number
  name: string
  video_count: number
  created_at: string
}

export interface TeacherVideo {
  id: number
  name: string | null
  original_filename: string | null
  folder_id: number | null
  uploader_name: string | null
  fps: number | null
  frame_count: number | null
  extraction_status: ExtractionStatus
  extraction_error: string | null
  annotation_status: AnnotationStatus
  annotation_frames: number[] | null
  created_at: string
}

export interface AnnotationInfo {
  teacher_video_id: number
  fps: number | null
  frame_count: number | null
  annotation_status: AnnotationStatus
  frames: number[]
}

/** 病患端輪詢上傳影片的分析進度 */
export interface SubmissionProgress {
  id: number
  status: SubmissionStatus
  analysis_status: AnalysisPipelineStatus
  analysis_error: string | null
  overall_score: number | null
}

export interface PlanItem {
  id: number
  name: string
  frequency: string | null
  times_per_week: number
  description: string | null
  precaution: string | null
  example_video_url: string | null
  example_video_note: string | null
  teacher_video?: PlanItemTeacherVideo | null
}

export interface PlanItemInput {
  name: string
  frequency?: string | null
  times_per_week?: number
  description?: string | null
  precaution?: string | null
  example_video_url?: string | null
  example_video_note?: string | null
  /** 從影片庫選用的導師影片（須已完成萃取）；null 解除綁定 */
  teacher_video_id?: number | null
}

export interface PlanVersion {
  id: number
  version: number
  goals: string[]
  change_summary: string | null
  started_at: string
  ended_at: string | null
  is_current: boolean
  items: PlanItem[]
}

export interface PlanListItem {
  id: number
  patient_id: number
  patient_name: string
  patient_number: string
  name: string
  status: string
  start_date: string
  evaluation_date: string | null
  nurse_name: string | null
}

export interface PlanListSummary {
  ongoing: number
  pending_evaluation: number
  ending_soon: number
  closed: number
}

export interface PlanDetail {
  id: number
  name: string
  status: string
  patient_id: number
  patient_name: string
  patient_number: string
  doctor_name: string
  nurse_name: string | null
  start_date: string
  evaluation_date: string | null
  current_version: PlanVersion | null
  versions: PlanVersion[]
  last_adjusted_at: string | null
}

export interface PlanCreate {
  name: string
  goals: string[]
  items: PlanItemInput[]
  nurse_id: number | null
  start_date: string
  evaluation_date: string | null
}

export interface PlanAdjust {
  change_summary: string
  goals: string[]
  items: PlanItemInput[]
  evaluation_date: string | null
}

export interface NurseOption {
  id: number
  name: string
}

export interface VisitCreate {
  chief_complaint: string
  diagnosis: string
  assessment: string
  rehab_decision: string
  follow_up_date: string | null
}

export interface PlanSubmissionsView {
  submissions: SubmissionListItem[]
  score_trend: ScoreTrendPoint[]
  completion_trend: CompletionTrendPoint[]
}

// ---- Nurse ----

export interface NurseDashboard {
  summary: {
    pending_review_count: number
    reviewed_today_count: number
    attention_patient_count: number
    my_patient_count: number
  }
  review_queue: SubmissionListItem[]
  attention_items: AttentionItem[]
}

export interface AttentionItem {
  patient_id: number
  patient_name: string
  plan_name: string
  last_score: number | null
  score_delta: number | null
  reason: string
}

export interface NursePatientRow {
  patient_id: number
  patient_number: string
  patient_name: string
  age: number
  gender: string
  plan_id: number | null
  plan_name: string | null
  plan_status: string | null
  /** 顯示計畫是否由目前登入的護理師負責 */
  is_mine: boolean
  nurse_name: string | null
  pending_review_count: number
  latest_submission_date: string | null
  latest_score: number | null
}

export interface NursePatientDetail {
  basic: PatientBasicInfo
  rehab_status: string
  diagnosis_summary: {
    diagnosis: string | null
    assessment: string | null
    visit_date: string
    doctor_name: string
  } | null
  current_plan: {
    id: number
    name: string
    status: string
    version: number | null
    doctor_name: string
    nurse_name: string | null
    start_date: string
    evaluation_date: string | null
    goals: string[]
    items: PlanItem[]
  } | null
  submissions: SubmissionListItem[]
  score_trend: ScoreTrendPoint[]
  completion_trend: CompletionTrendPoint[]
}

export interface PlanItemsView {
  plan_id: number
  plan_name: string
  plan_status: string
  version: number
  patient_id: number
  patient_name: string
  patient_number: string
  goals: string[]
  items: PlanItem[]
}

// ---- Patient portal ----

export interface PatientDashboard {
  name: string
  patient_number: string
  next_follow_up_date: string | null
  current_plan_id: number | null
  current_plan_name: string | null
  current_plan_status: string | null
  week_completed: number
  week_prescribed: number
  week_completion_rate: number
  last_submission_date: string | null
  latest_score: number | null
  latest_feedback: string | null
  latest_feedback_nurse: string | null
  score_trend: ScoreTrendPoint[]
  completion_trend: CompletionTrendPoint[]
}

export interface PortalPlanListItem {
  id: number
  name: string
  status: string
  start_date: string
  evaluation_date: string | null
  doctor_name: string
  nurse_name: string | null
  goals: string[]
  item_count: number
}

export interface PortalSubmission {
  id: number
  item_name: string
  submitted_at: string
  status: SubmissionStatus
  analysis_status: AnalysisPipelineStatus
  analysis_error: string | null
  decision: ReviewDecision | null
  overall_score: number | null
  joint_angle_score: number | null
  stability_score: number | null
  posture_score: number | null
  summary_text: string | null
  feedback: string | null
  reviewer_name: string | null
  reviewed_at: string | null
}

export interface PortalPlanDetail {
  id: number
  name: string
  status: string
  version: number | null
  start_date: string
  evaluation_date: string | null
  doctor_name: string
  nurse_name: string | null
  goals: string[]
  items: PlanItem[]
  week_completed: number
  week_prescribed: number
  week_completion_rate: number
  score_trend: ScoreTrendPoint[]
  completion_trend: CompletionTrendPoint[]
  submissions: PortalSubmission[]
}

// ---- Admin（帳號管理 / 系統總覽 / 分析任務監控）----

export interface AdminUser {
  id: number
  username: string
  role: Role
  name: string
  title: string | null
  is_active: boolean
  created_at: string
  patient_number: string | null
  /** 被看診/計畫/影片等資料引用；true 時刪除會降級為停用 */
  has_related_data: boolean
}

export interface AdminPatientProfileInput {
  patient_number: string
  birth_date: string
  gender: string
  phone?: string | null
}

export interface AdminUserCreateInput {
  username: string
  password?: string
  role: 'doctor' | 'nurse' | 'patient'
  name: string
  title?: string | null
  patient_profile?: AdminPatientProfileInput | null
}

export interface AdminUserUpdateInput {
  name?: string
  title?: string
  phone?: string
}

export interface AdminOverview {
  users: Record<string, { total: number; active: number }>
  submissions_total: number
  pending_review: number
  analysis: { done: number; failed: number; in_progress: number; pending: number }
  media_disk: { media_bytes: number; disk_total_bytes: number; disk_free_bytes: number }
}

export interface AdminTaskRow {
  submission_id: number
  patient_name: string
  item_name: string | null
  submitted_at: string
  status: SubmissionStatus
  analysis_status: AnalysisPipelineStatus
  analysis_error: string | null
  celery_task_id: string | null
  teacher_video_id: number | null
}

export interface AdminTaskList {
  items: AdminTaskRow[]
  total: number
  page: number
  page_size: number
  status_counts: Record<string, number>
}
