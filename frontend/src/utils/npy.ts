/**
 * 極簡 NumPy .npy 解析器。
 *
 * 只支援本專案 MotionBERT 輸出的格式：little-endian float32（'<f4'）、
 * C-order。3D 骨架為 shape (幀, 17, 3)。
 */

export interface NpyArray {
  shape: number[]
  data: Float32Array
}

export function parseNpy(buffer: ArrayBuffer): NpyArray {
  const bytes = new Uint8Array(buffer)
  const magic = String.fromCharCode(...bytes.slice(0, 6))
  if (magic !== '\x93NUMPY') throw new Error('不是 .npy 檔案')

  const major = bytes[6]
  const view = new DataView(buffer)
  const headerLen = major >= 2 ? view.getUint32(8, true) : view.getUint16(8, true)
  const headerStart = major >= 2 ? 12 : 10
  const header = new TextDecoder('ascii').decode(
    bytes.slice(headerStart, headerStart + headerLen),
  )

  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1]
  const fortran = /'fortran_order':\s*(True|False)/.exec(header)?.[1]
  const shapeStr = /'shape':\s*\(([^)]*)\)/.exec(header)?.[1]
  if (descr !== '<f4') throw new Error(`不支援的 dtype：${descr}`)
  if (fortran !== 'False') throw new Error('不支援 Fortran order')
  if (!shapeStr) throw new Error('無法解析 shape')

  const shape = shapeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
  const count = shape.reduce((a, b) => a * b, 1)

  const dataOffset = headerStart + headerLen
  // numpy 會把 header 補齊到 64 bytes 倍數，offset 必為 4 的倍數；保險起見仍留 slice 後路
  const data =
    dataOffset % 4 === 0
      ? new Float32Array(buffer, dataOffset, count)
      : new Float32Array(buffer.slice(dataOffset, dataOffset + count * 4))
  return { shape, data }
}
