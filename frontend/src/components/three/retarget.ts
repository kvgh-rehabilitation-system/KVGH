import * as THREE from 'three'
import { indexBones, normalizeBoneName } from './human-model'

/**
 * H36M 17 關節座標 → MakeHuman 蒙皮骨架的重定向器（swing-only）。
 *
 * 逐段方向對齊：每根受驅骨記下綁定姿的世界四元數 Q_rest 與骨段世界方向 d_rest，
 * 逐幀算目標方向 d_tgt 後 Q_world = align(d_rest→d_tgt)·Q_rest，再轉回 local。
 * 不控制扭轉（twist），復健動作以矢狀/額狀面擺動為主，誤差可接受。
 * 骨長用模型自身 → 關節「位置」是近似、「方向/角度」忠實於演算法輸出。
 */

/** 受驅骨 → H36M 骨段（from→to 關節索引；endBone 的骨頭即骨段末端） */
const SEGMENTS: { bone: string; endBone: string; from: number; to: number }[] = [
  // 軀幹整體傾角（骨盆0→胸廓8），父骨先於子骨
  { bone: 'spine05', endBone: 'neck01', from: 0, to: 8 },
  { bone: 'neck01', endBone: 'head', from: 8, to: 10 },
  { bone: 'upperarm01.L', endBone: 'lowerarm01.L', from: 11, to: 12 },
  { bone: 'lowerarm01.L', endBone: 'wrist.L', from: 12, to: 13 },
  { bone: 'upperarm01.R', endBone: 'lowerarm01.R', from: 14, to: 15 },
  { bone: 'lowerarm01.R', endBone: 'wrist.R', from: 15, to: 16 },
  { bone: 'upperleg01.L', endBone: 'lowerleg01.L', from: 4, to: 5 },
  { bone: 'lowerleg01.L', endBone: 'foot.L', from: 5, to: 6 },
  { bone: 'upperleg01.R', endBone: 'lowerleg01.R', from: 1, to: 2 },
  { bone: 'lowerleg01.R', endBone: 'foot.R', from: 2, to: 3 },
]

interface DrivenBone {
  bone: THREE.Bone
  from: number
  to: number
  /** 綁定姿的骨段世界方向（單位向量） */
  restDir: THREE.Vector3
  /** 綁定姿的骨骼世界四元數 */
  restWorldQuat: THREE.Quaternion
}

export interface Retargeter {
  /** 以一幀 17×3 座標（preparePose 空間：Y-up、公尺、貼地）驅動模型 */
  apply(pose: Float32Array): void
}

const UP = new THREE.Vector3(0, 1, 0)

export function createRetargeter(model: THREE.Object3D): Retargeter {
  model.updateWorldMatrix(true, true)
  const bones = indexBones(model)
  const get = (name: string) => bones.get(normalizeBoneName(name))

  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()

  const driven: DrivenBone[] = []
  for (const seg of SEGMENTS) {
    const bone = get(seg.bone)
    const end = get(seg.endBone)
    if (!bone || !end) continue
    bone.getWorldPosition(tmpA)
    end.getWorldPosition(tmpB)
    driven.push({
      bone,
      from: seg.from,
      to: seg.to,
      restDir: tmpB.clone().sub(tmpA).normalize(),
      restWorldQuat: bone.getWorldQuaternion(new THREE.Quaternion()),
    })
  }

  // 模型骨盆錨點（兩髖中點的綁定姿世界座標）：逐幀讓它落在 .npy 骨盆上
  const anchor = new THREE.Vector3()
  const hipL = get('upperleg01.L')
  const hipR = get('upperleg01.R')
  if (hipL && hipR) {
    hipL.getWorldPosition(tmpA)
    hipR.getWorldPosition(tmpB)
    anchor.addVectors(tmpA, tmpB).multiplyScalar(0.5)
  }

  const tmpDir = new THREE.Vector3()
  const tmpForward = new THREE.Vector3()
  const qAlign = new THREE.Quaternion()
  const qWorld = new THREE.Quaternion()
  const qParent = new THREE.Quaternion()
  const lastForward = new THREE.Vector3(0, 0, 1)

  const jointAt = (pose: Float32Array, j: number, out: THREE.Vector3) =>
    out.set(pose[j * 3], pose[j * 3 + 1], pose[j * 3 + 2])

  return {
    apply(pose: Float32Array) {
      // 骨盆朝向（yaw）：forward = (左髖 − 右髖) × Y，退化時沿用前一幀
      jointAt(pose, 4, tmpA)
      jointAt(pose, 1, tmpB)
      tmpDir.subVectors(tmpA, tmpB)
      tmpForward.crossVectors(tmpDir, UP)
      tmpForward.y = 0
      if (tmpForward.lengthSq() > 1e-8) {
        tmpForward.normalize()
        lastForward.copy(tmpForward)
      } else {
        tmpForward.copy(lastForward)
      }
      model.quaternion.setFromAxisAngle(UP, Math.atan2(tmpForward.x, tmpForward.z))

      // 骨盆位置：模型錨點（依 yaw 旋轉後）貼齊 .npy 骨盆，深蹲/移動跟著走
      jointAt(pose, 0, tmpA)
      tmpB.copy(anchor).applyQuaternion(model.quaternion)
      model.position.subVectors(tmpA, tmpB)

      // 逐段方向對齊（陣列序即父先子後）
      for (const d of driven) {
        jointAt(pose, d.from, tmpA)
        jointAt(pose, d.to, tmpB)
        tmpDir.subVectors(tmpB, tmpA)
        if (tmpDir.lengthSq() < 1e-8) continue
        tmpDir.normalize()
        qAlign.setFromUnitVectors(d.restDir, tmpDir)
        qWorld.copy(qAlign).multiply(d.restWorldQuat)
        d.bone.parent!.getWorldQuaternion(qParent) // 內部會先更新祖先矩陣
        d.bone.quaternion.copy(qParent.invert()).multiply(qWorld)
      }
    },
  }
}
