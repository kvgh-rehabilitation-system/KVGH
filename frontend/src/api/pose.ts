import axios from 'axios'

import { client } from './client'
import { parseNpy, type NpyArray } from '../utils/npy'

/**
 * 取得病患 3D 骨架（MotionBERT .npy，幀×17×3）。
 * 走 axios（自帶 Bearer header），非 <video> 不需 ?token=。
 * 檔案不存在（seed 資料）回 null，由頁面 fallback 至舊版重播。
 */
export async function fetchPose3d(submissionId: number | string): Promise<NpyArray | null> {
  try {
    const { data } = await client.get<ArrayBuffer>(`/media/submissions/${submissionId}/pose3d`, {
      responseType: 'arraybuffer',
    })
    return parseNpy(data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}
