import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { PlanItem } from '../../../types'
import { SubmissionUploader } from './SubmissionUploader'

const uploadMock = vi.hoisted(() => vi.fn())
const progressMock = vi.hoisted(() => vi.fn())
vi.mock('../../../api/patient', () => ({
  uploadSubmission: uploadMock,
  getSubmissionProgress: progressMock,
}))

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock }))

/** 只填元件會讀的欄位。teacher_video 狀態決定上傳按鈕是否解鎖。 */
function item(ready = true): PlanItem {
  return {
    id: 3,
    name: '橋式',
    teacher_video: ready
      ? { id: 7, extraction_status: 'EXTRACTED', annotation_status: 'ANNOTATED' }
      : { id: 7, extraction_status: 'PENDING', annotation_status: 'UNANNOTATED' },
  } as unknown as PlanItem
}

/** 對隱藏的 file input 塞檔案（Playwright setInputFiles 的 jsdom 等價操作）。 */
function pickFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]')!
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(16)], 'practice.mp4', { type: 'video/mp4' })] },
  })
}

describe('SubmissionUploader', () => {
  beforeEach(() => {
    uploadMock.mockReset()
    progressMock.mockReset()
    toastMock.error.mockReset()
    toastMock.success.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  test('導師影片未就緒 → 按鈕鎖住並顯示原因', () => {
    render(<SubmissionUploader planId={1} item={item(false)} onFinished={vi.fn()} />)
    const button = screen.getByRole('button', { name: /導師影片準備中/ })
    expect(button).toBeDisabled()
  })

  test('選檔 → 上傳並進入進度膠囊；輪詢到 DONE → 通知父層重抓', async () => {
    // render 前就開 fake timers，元件的輪詢 interval 才會註冊在假時鐘上;
    // shouldAdvanceTime 讓 waitFor 的內部計時照常走
    vi.useFakeTimers({ shouldAdvanceTime: true })
    uploadMock.mockResolvedValue({ id: 77, analysis_status: 'PENDING' })
    progressMock.mockResolvedValue({
      id: 77,
      analysis_status: 'DONE',
      analysis_error: null,
      overall_score: 88,
    })
    const onFinished = vi.fn()
    const { container } = render(
      <SubmissionUploader planId={1} item={item()} onFinished={onFinished} />,
    )

    pickFile(container)
    await waitFor(() => expect(uploadMock).toHaveBeenCalledWith(1, 3, expect.any(File)))
    // 進度膠囊取代按鈕：分析中防重複上傳
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /上傳練習影片/ })).not.toBeInTheDocument(),
    )

    // 走 4 秒輪詢（快轉假時鐘；advanceAsync 讓 interval 內的 await 跑完）
    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(progressMock).toHaveBeenCalledWith(77)
    expect(toastMock.success).toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalled()
  })

  test('輪詢到 FAILED → 錯誤 toast 帶後端訊息、通知父層重抓', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    uploadMock.mockResolvedValue({ id: 78, analysis_status: 'PENDING' })
    progressMock.mockResolvedValue({
      id: 78,
      analysis_status: 'FAILED',
      analysis_error: '影片毀損無法轉檔',
      overall_score: null,
    })
    const onFinished = vi.fn()
    const { container } = render(
      <SubmissionUploader planId={1} item={item()} onFinished={onFinished} />,
    )

    pickFile(container)
    await waitFor(() => expect(uploadMock).toHaveBeenCalled())

    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(toastMock.error).toHaveBeenCalledWith('影片毀損無法轉檔')
    expect(onFinished).toHaveBeenCalled()
  })

  test('上傳失敗 → toast 錯誤、按鈕恢復可重選', async () => {
    uploadMock.mockRejectedValue(new Error('boom'))
    const { container } = render(
      <SubmissionUploader planId={1} item={item()} onFinished={vi.fn()} />,
    )

    pickFile(container)
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /上傳練習影片/ })).toBeEnabled()
  })
})
