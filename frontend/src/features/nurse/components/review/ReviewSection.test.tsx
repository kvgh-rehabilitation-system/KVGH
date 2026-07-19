import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SubmissionDetail } from '../../../../types'
import { ReviewSection } from './ReviewSection'

// API 層換成 mock：元件測試只驗表單 → payload 與成功/失敗的 UI 行為
const reviewMock = vi.hoisted(() => vi.fn())
vi.mock('../../../../api/nurse', () => ({
  reviewSubmission: reviewMock,
  createReport: vi.fn(),
}))

// toast 換 spy：錯誤路徑斷言有提示（sonner 無 <Toaster> 時不渲染，spy 才驗得到）
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock }))

/** 只填元件會讀的欄位（完整型別欄位很多，其餘與表單行為無關）。 */
function detail(overrides: Partial<SubmissionDetail> = {}): SubmissionDetail {
  return {
    id: 5,
    plan_id: 9,
    patient_name: '王小明',
    plan_name: '腰椎復健計畫',
    status: 'PENDING_REVIEW',
    decision: null,
    feedback: null,
    reviewer_name: null,
    reviewed_at: null,
    ...overrides,
  } as unknown as SubmissionDetail
}

describe('ReviewSection', () => {
  beforeEach(() => {
    reviewMock.mockReset()
    toastMock.error.mockReset()
  })
  afterEach(cleanup)

  test('未選審核結果就送出 → 擋下並提示，不打 API', async () => {
    const user = userEvent.setup()
    render(<ReviewSection data={detail()} onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /完成審核/ }))
    expect(reviewMock).not.toHaveBeenCalled()
    expect(toastMock.error).toHaveBeenCalled()
  })

  test('選「需注意」+ 留言送出 → 以正確 payload 打 API，成功後按鈕保持停用', async () => {
    reviewMock.mockResolvedValue({})
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<ReviewSection data={detail()} onSuccess={onSuccess} />)

    await user.click(screen.getByRole('button', { name: /需注意/ }))
    await user.type(screen.getByPlaceholderText(/動作標準，繼續保持/), '注意骨盆代償')
    await user.click(screen.getByRole('button', { name: /完成審核/ }))

    await waitFor(() =>
      expect(reviewMock).toHaveBeenCalledWith(5, {
        decision: 'NEEDS_ATTENTION',
        feedback: '注意骨盆代償',
      }),
    )
    expect(onSuccess).toHaveBeenCalled()
    // 成功刻意不還原 submitting：成功動畫期間防重複送出
    expect(screen.getByRole('button', { name: /送出中/ })).toBeDisabled()
  })

  test('API 失敗 → toast 錯誤、表單內容保留、按鈕恢復可再送', async () => {
    reviewMock.mockRejectedValue(new Error('boom'))
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<ReviewSection data={detail()} onSuccess={onSuccess} />)

    await user.click(screen.getByRole('button', { name: /通過/ }))
    await user.type(screen.getByPlaceholderText(/動作標準，繼續保持/), '寫到一半的留言')
    await user.click(screen.getByRole('button', { name: /完成審核/ }))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('寫到一半的留言')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /完成審核/ })).toBeEnabled()
  })

  test('已審核（REVIEWED）→ 唯讀顯示結果與留言，無審核表單', () => {
    render(
      <ReviewSection
        data={detail({
          status: 'REVIEWED',
          decision: 'APPROVED',
          feedback: '動作標準，繼續保持',
          reviewer_name: '林佳穎',
          reviewed_at: '2026-07-18T10:00:00',
        } as Partial<SubmissionDetail>)}
        onSuccess={vi.fn()}
      />,
    )
    expect(screen.getByText('動作標準，繼續保持')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完成審核/ })).not.toBeInTheDocument()
  })
})
