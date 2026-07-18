import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { statusLabel } from '@/utils/submissionStatus'
import { StatusBadge } from './StatusBadge'

// display_status → label → badge 渲染：審核清單/病患端狀態顯示的穩定契約
describe('StatusBadge × statusLabel', () => {
  afterEach(cleanup)

  test.each([
    ['DONE', '分析完成'],
    ['FAILED', '分析失敗'],
    ['PENDING_REVIEW', '待審核'],
  ])('%s 渲染醫護版文案「%s」', (status, label) => {
    render(<StatusBadge status={status} label={statusLabel(status)} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('病患版文案：管線階段收斂為 AI 分析中', () => {
    render(<StatusBadge status="EXTRACTING" label={statusLabel('EXTRACTING', 'patient')} />)
    expect(screen.getByText('AI 分析中')).toBeInTheDocument()
  })

  test('未登記的狀態仍渲染 label（落中性灰，不炸版）', () => {
    render(<StatusBadge status="SOMETHING_NEW" label="新狀態" />)
    expect(screen.getByText('新狀態')).toBeInTheDocument()
  })
})
