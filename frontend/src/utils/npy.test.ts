import { describe, expect, test } from 'vitest'
import { parseNpy } from './npy'

/** 手工組最小 .npy（v1.0）buffer；align=false 時故意讓資料區 offset 非 4 倍數。 */
function buildNpy(
  values: number[],
  shape: number[],
  opts?: { descr?: string; align?: boolean },
): ArrayBuffer {
  const descr = opts?.descr ?? '<f4'
  const shapeStr = `(${shape.join(', ')}${shape.length === 1 ? ',' : ''})`
  let header = `{'descr': '${descr}', 'fortran_order': False, 'shape': ${shapeStr}, }`
  const wantAligned = opts?.align !== false
  // numpy 慣例：pad 到資料區 offset 對齊（此處對齊 4 已足夠測快路徑）
  while ((10 + header.length + 1) % 4 !== (wantAligned ? 0 : 1)) header += ' '
  header += '\n'

  const buffer = new ArrayBuffer(10 + header.length + values.length * 4)
  const bytes = new Uint8Array(buffer)
  bytes.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0]) // \x93NUMPY v1.0
  new DataView(buffer).setUint16(8, header.length, true)
  for (let i = 0; i < header.length; i++) bytes[10 + i] = header.charCodeAt(i)
  const dataOffset = 10 + header.length
  if (dataOffset % 4 === 0) {
    new Float32Array(buffer, dataOffset).set(values)
  } else {
    const tmp = new Float32Array(values)
    bytes.set(new Uint8Array(tmp.buffer), dataOffset)
  }
  return buffer
}

describe('parseNpy', () => {
  test('解析 (2,3) float32', () => {
    const arr = parseNpy(buildNpy([1, 2, 3, 4, 5, 6], [2, 3]))
    expect(arr.shape).toEqual([2, 3])
    expect([...arr.data]).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('資料區未對齊 4 bytes 時走 slice 後路', () => {
    const arr = parseNpy(buildNpy([7, 8], [2], { align: false }))
    expect(arr.shape).toEqual([2])
    expect([...arr.data]).toEqual([7, 8])
  })

  test('非 .npy 檔拋錯', () => {
    expect(() => parseNpy(new ArrayBuffer(16))).toThrow('不是 .npy 檔案')
  })

  test('不支援的 dtype 拋錯', () => {
    expect(() => parseNpy(buildNpy([1], [1], { descr: '<f8' }))).toThrow('不支援的 dtype')
  })
})
