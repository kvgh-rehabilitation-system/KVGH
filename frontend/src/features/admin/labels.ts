export const roleLabel: Record<string, string> = {
  admin: '管理員',
  doctor: '醫師',
  nurse: '護理師',
  patient: '病患',
}

export const analysisStatusLabel: Record<string, string> = {
  PENDING: '排隊中',
  TRANSCODING: '轉檔中',
  EXTRACTING: '骨架萃取中',
  COMPARING: '動作比對中',
  DONE: '完成',
  FAILED: '失敗',
}

export const IN_PROGRESS_STATUSES = ['TRANSCODING', 'EXTRACTING', 'COMPARING']
