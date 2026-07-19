import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { PlanFormPage } from './PlanFormPage'

const getPlanMock = vi.hoisted(() => vi.fn())
const adjustPlanMock = vi.hoisted(() => vi.fn())
vi.mock('../../../api/doctor', () => ({
  getPlan: getPlanMock,
  adjustPlan: adjustPlanMock,
  createPlan: vi.fn(),
  getPatient: vi.fn(),
  listNurses: vi.fn().mockResolvedValue([]),
}))

/** adjust 模式的最小計畫詳情（元件只讀這些欄位）。 */
const planDetail = {
  patient_name: '王小明',
  name: '腰椎復健計畫',
  evaluation_date: null,
  current_version: {
    goals: ['改善腰部活動度'],
    items: [
      {
        name: '橋式',
        frequency: '每週 3 次',
        times_per_week: 3,
        description: '每次 15 分鐘',
        precaution: null,
        example_video_url: null,
        example_video_note: null,
        teacher_video: { id: 7, name: '腰椎示範' },
      },
    ],
  },
}

function renderAdjust() {
  return render(
    <MemoryRouter initialEntries={['/doctor/rehabilitation-plans/3/adjust']}>
      <Routes>
        <Route
          path="/doctor/rehabilitation-plans/:planId/adjust"
          element={<PlanFormPage mode="adjust" />}
        />
        <Route
          path="/doctor/rehabilitation-plans/3"
          element={<div data-testid="plan-detail-page" />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlanFormPage（adjust 模式）', () => {
  beforeEach(() => {
    getPlanMock.mockReset().mockResolvedValue(planDetail)
    adjustPlanMock.mockReset()
  })
  afterEach(cleanup)

  test('載入後預填目前版本內容，計畫名稱鎖定不可改', async () => {
    renderAdjust()
    expect(await screen.findByTestId('plan-form')).toBeInTheDocument()
    expect(screen.getByDisplayValue('腰椎復健計畫')).toBeDisabled()
    expect(screen.getByTestId('item-frequency')).toHaveValue('每週 3 次')
  })

  test('缺調整摘要 → 擋提交並顯示錯誤，不打 API', async () => {
    const user = userEvent.setup()
    renderAdjust()
    await screen.findByTestId('plan-form')

    await user.click(screen.getByTestId('plan-save'))
    expect(await screen.findByText('請填寫本次調整摘要')).toBeInTheDocument()
    expect(adjustPlanMock).not.toHaveBeenCalled()
  })

  test('改頻率 + 摘要提交 → payload 正確（沿用導師影片綁定）、導回計畫詳情', async () => {
    adjustPlanMock.mockResolvedValue({})
    const user = userEvent.setup()
    renderAdjust()
    await screen.findByTestId('plan-form')

    const freq = screen.getByTestId('item-frequency')
    await user.clear(freq)
    await user.type(freq, '每週 2 次')
    await user.type(screen.getByTestId('plan-change-summary'), '頻率調整為每週 2 次')
    await user.click(screen.getByTestId('plan-save'))

    await waitFor(() =>
      expect(adjustPlanMock).toHaveBeenCalledWith('3', {
        change_summary: '頻率調整為每週 2 次',
        goals: ['改善腰部活動度'],
        items: [
          expect.objectContaining({
            name: '橋式',
            frequency: '每週 2 次',
            teacher_video_id: 7, // 顯示用 teacherVideo 剝掉、綁定 id 保留
          }),
        ],
        evaluation_date: null,
      }),
    )
    // 成功導回計畫詳情頁
    expect(await screen.findByTestId('plan-detail-page')).toBeInTheDocument()
  })

  test('API 失敗 → 表單內顯示錯誤、停留原頁可重送', async () => {
    adjustPlanMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderAdjust()
    await screen.findByTestId('plan-form')

    await user.type(screen.getByTestId('plan-change-summary'), '任何摘要')
    await user.click(screen.getByTestId('plan-save'))

    // 非 axios 錯誤走 apiErrorMessage 通用文案
    expect(await screen.findByText('發生錯誤，請稍後再試')).toBeInTheDocument()
    expect(screen.queryByTestId('plan-detail-page')).not.toBeInTheDocument()
    expect(screen.getByTestId('plan-save')).toBeEnabled()
  })
})
