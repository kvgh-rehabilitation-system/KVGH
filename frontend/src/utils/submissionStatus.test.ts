import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd, env } from 'node:process'
import { describe, expect, test } from 'vitest'
import {
  PIPELINE_ACTIVE_STATUSES,
  displayStatusLabel,
  isPipelineActive,
  patientDisplayStatusLabel,
  statusLabel,
} from './submissionStatus'

/**
 * golden 檔尋找順序：CONTRACTS_DIR 環境變數 → /contracts（CI 容器掛載點）→
 * repo 相對路徑（本機直接跑）。與後端 backend/tests/unit/test_contract_golden.py 同一份。
 */
function loadGolden(): { display_status: string[]; pipeline_active: string[] } {
  // vitest 跑測試時 cwd = frontend/，repo 根目錄在上一層
  const repoContracts = resolve(cwd(), '../ci/contracts')
  const dir = [env.CONTRACTS_DIR, '/contracts', repoContracts].find(
    (d): d is string => !!d && existsSync(d),
  )
  if (!dir) throw new Error('找不到 ci/contracts golden 目錄（可用 CONTRACTS_DIR 指定）')
  return JSON.parse(readFileSync(`${dir}/submission_status.json`, 'utf-8'))
}

const golden = loadGolden()

describe('golden：display_status 值域（前後端雙寫契約）', () => {
  test('醫護版 label 表 key 完整覆蓋值域', () => {
    expect(Object.keys(displayStatusLabel).sort()).toEqual([...golden.display_status].sort())
  })

  test('病患版 label 表 key 完整覆蓋值域', () => {
    expect(Object.keys(patientDisplayStatusLabel).sort()).toEqual(
      [...golden.display_status].sort(),
    )
  })

  test('管線活躍狀態清單與 golden 一致', () => {
    expect([...PIPELINE_ACTIVE_STATUSES]).toEqual(golden.pipeline_active)
  })
})

describe('statusLabel', () => {
  test('雙 audience 文案分流', () => {
    expect(statusLabel('EXTRACTING')).toBe('2D/3D 姿態萃取中')
    expect(statusLabel('EXTRACTING', 'patient')).toBe('AI 分析中')
    expect(statusLabel('PENDING_REVIEW')).toBe('待審核')
    expect(statusLabel('PENDING_REVIEW', 'patient')).toBe('等待護理師回饋')
  })

  test('未知值 fallback 顯示原始字串', () => {
    expect(statusLabel('WHAT_IS_THIS')).toBe('WHAT_IS_THIS')
  })
})

describe('isPipelineActive', () => {
  test('管線階段為 true、終態為 false', () => {
    for (const s of golden.pipeline_active) expect(isPipelineActive(s)).toBe(true)
    for (const s of ['DONE', 'FAILED', 'PENDING_REVIEW', 'REVIEWED'])
      expect(isPipelineActive(s)).toBe(false)
  })
})
