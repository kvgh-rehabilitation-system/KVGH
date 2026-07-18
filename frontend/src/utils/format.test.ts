import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  formatDate,
  formatDateTime,
  greeting,
  scoreColor,
  scoreGrade,
  withRole,
} from './format'

describe('formatDate / formatDateTime', () => {
  test('空值顯示破折號', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })

  test('ISO 字串 → YYYY/MM/DD（月日補零）', () => {
    expect(formatDate('2026-07-05T08:30:00')).toBe('2026/07/05')
  })

  test('formatDateTime 帶時分', () => {
    expect(formatDateTime('2026-07-05T08:03:00')).toBe('2026/07/05 08:03')
  })
})

describe('withRole', () => {
  test('姓名後綴角色標籤', () => {
    expect(withRole('王大明', 'doctor')).toBe('王大明 醫師')
  })

  test('空姓名回空字串', () => {
    expect(withRole(null, 'nurse')).toBe('')
  })
})

describe('scoreColor 門檻（80 / 65）', () => {
  test.each([
    [80, '#8A9B6E'], // 綠：>= 80
    [79.9, '#D9A441'], // 琥珀：65 <= x < 80
    [65, '#D9A441'],
    [64.9, '#B5543B'], // 赭紅：< 65
  ])('score %s → %s', (score, color) => {
    expect(scoreColor(score)).toBe(color)
  })
})

describe('scoreGrade 門檻（85 / 72 / 60）', () => {
  test.each([
    [85, '優秀'],
    [84.9, '良好'],
    [72, '良好'],
    [71.9, '待加強'],
    [60, '待加強'],
    [59.9, '需指導'],
  ])('score %s → %s', (score, grade) => {
    expect(scoreGrade(score)).toBe(grade)
  })
})

describe('greeting 時段', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test.each([
    ['04:00', '夜深了'],
    ['05:00', '早安'],
    ['11:00', '午安'],
    ['14:00', '午後好'],
    ['18:00', '晚安'],
  ])('%s → %s', (time, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-07-18T${time}:00`))
    expect(greeting()).toBe(expected)
  })
})
