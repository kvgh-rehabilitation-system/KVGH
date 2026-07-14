import * as THREE from 'three'
import { indexBones, normalizeBoneName } from './human-model'

/**
 * H36M 17 關節座標 → MakeHuman 蒙皮骨架的重定向器（基底驅動 swing+twist）。
 *
 * 每個受驅部位由資料建「完整正交基底」，qWorld = qTargetFrame · qRestFrame⁻¹ · Q_rest：
 * - 軀幹三框架：骨盆（up=0→7、left=右髖→左髖）、軀幹（up=0→8、left=右肩→左肩）、
 *   頭（up=頸根8→頭頂10 跳過鼻、面向由 胸廓8→鼻9 決定），分別驅動 root / spine05 / neck01，
 *   身體朝向（yaw）與傾角全數忠實傳遞——swing-only 最短弧會把 yaw 抵銷，不可回退。
 * - 四肢：主軸 = 骨段方向、第二軸 = 彎曲平面法線 cross(上段, 下段)；
 *   近伸直時實測法線退化，改用「身體框架搬運的綁定法線」並依彎曲量平滑混合防抖。
 * - 腳（foot.*）不驅動：H36M 無腳趾關節，小腿扭轉正確後綁定姿即中性腳型。
 * 骨長用模型自身 → 關節「位置」是近似、「方向/角度/扭轉」忠實於演算法輸出。
 */

interface LimbSegDef {
  bone: string
  /** restDir 終點骨（骨段末端） */
  end: string
  from: number
  to: number
}

interface LimbDef {
  upper: LimbSegDef
  lower: LimbSegDef
  /** 搬運 default 法線的身體框架 */
  body: 'pelvis' | 'trunk'
  /** 綁定姿伸直時 canonical 法線 = restDir × (身體前方 × flexSign)：肘向前屈 +1、膝向後屈 -1 */
  flexSign: 1 | -1
}

const LIMB_DEFS: LimbDef[] = [
  {
    upper: { bone: 'upperarm01.L', end: 'lowerarm01.L', from: 11, to: 12 },
    lower: { bone: 'lowerarm01.L', end: 'wrist.L', from: 12, to: 13 },
    body: 'trunk',
    flexSign: 1,
  },
  {
    upper: { bone: 'upperarm01.R', end: 'lowerarm01.R', from: 14, to: 15 },
    lower: { bone: 'lowerarm01.R', end: 'wrist.R', from: 15, to: 16 },
    body: 'trunk',
    flexSign: 1,
  },
  {
    upper: { bone: 'upperleg01.L', end: 'lowerleg01.L', from: 4, to: 5 },
    lower: { bone: 'lowerleg01.L', end: 'foot.L', from: 5, to: 6 },
    body: 'pelvis',
    flexSign: -1,
  },
  {
    upper: { bone: 'upperleg01.R', end: 'lowerleg01.R', from: 1, to: 2 },
    lower: { bone: 'lowerleg01.R', end: 'foot.R', from: 2, to: 3 },
    body: 'pelvis',
    flexSign: -1,
  },
]

export interface Retargeter {
  /** 以一幀 17×3 座標（preparePose 空間：Y-up、公尺、貼地）驅動模型 */
  apply(pose: Float32Array): void
}

const UP = new THREE.Vector3(0, 1, 0)

const smoothstep = (x: number, e0: number, e1: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function createRetargeter(model: THREE.Object3D): Retargeter {
  // 骨盆完整朝向改由 root 骨承接，model 本體不再帶 yaw
  model.quaternion.identity()
  model.updateWorldMatrix(true, true)
  const bones = indexBones(model)
  const get = (name: string) => bones.get(normalizeBoneName(name))

  // ---- 共用暫存（apply 內零配置） ----
  const vU = new THREE.Vector3()
  const vF = new THREE.Vector3()
  const vL = new THREE.Vector3()
  const vY = new THREE.Vector3()
  const vHint = new THREE.Vector3() // 頭部 leftHint 專用（勿與 frameFromUpLeft 內部的 vL 共用）
  const mBasis = new THREE.Matrix4()
  const pA = new THREE.Vector3()
  const pB = new THREE.Vector3()
  const dirU = new THREE.Vector3()
  const dirL = new THREE.Vector3()
  const nM = new THREE.Vector3()
  const nD = new THREE.Vector3()
  const nC = new THREE.Vector3()
  const qTmp = new THREE.Quaternion()
  const qWorld = new THREE.Quaternion()
  const qParent = new THREE.Quaternion()

  /** up + 左方提示 → 正交基底四元數（x=左 y=上 z=前）；輸入退化時回 false、不動 outQ */
  const frameFromUpLeft = (
    up: THREE.Vector3,
    leftHint: THREE.Vector3,
    outQ: THREE.Quaternion,
  ): boolean => {
    if (up.lengthSq() < 1e-10) return false
    vU.copy(up).normalize()
    vF.crossVectors(leftHint, vU)
    if (vF.lengthSq() < 1e-10) return false
    vF.normalize()
    vL.crossVectors(vU, vF)
    mBasis.makeBasis(vL, vU, vF)
    outQ.setFromRotationMatrix(mBasis)
    return true
  }

  /** 骨段方向（單位向量）+ 彎曲法線 → 正交基底四元數；共線退化回 false */
  const basisFromDirNormal = (
    dir: THREE.Vector3,
    normal: THREE.Vector3,
    outQ: THREE.Quaternion,
  ): boolean => {
    vF.crossVectors(dir, normal)
    if (vF.lengthSq() < 1e-10) return false
    vF.normalize()
    vY.crossVectors(vF, dir)
    mBasis.makeBasis(dir, vY, vF)
    outQ.setFromRotationMatrix(mBasis)
    return true
  }

  // ---- 綁定姿身體框架（模型直立 → up 取 +Y，left 取左右對稱骨連線水平分量） ----
  const qRestPelvis = new THREE.Quaternion()
  const qRestTrunk = new THREE.Quaternion()
  const restFrame = (leftName: string, rightName: string, outQ: THREE.Quaternion) => {
    const l = get(leftName)
    const r = get(rightName)
    if (!l || !r) return
    l.getWorldPosition(pA)
    r.getWorldPosition(pB)
    frameFromUpLeft(UP, pA.sub(pB).setY(0), outQ)
  }
  restFrame('upperleg01.L', 'upperleg01.R', qRestPelvis)
  restFrame('upperarm01.L', 'upperarm01.R', qRestTrunk)
  const qRestPelvisInv = qRestPelvis.clone().invert()
  const qRestTrunkInv = qRestTrunk.clone().invert()

  interface DrivenBone {
    bone: THREE.Bone
    restWorldQuat: THREE.Quaternion
  }
  const mkDriven = (name: string): DrivenBone | null => {
    const bone = get(name)
    return bone ? { bone, restWorldQuat: bone.getWorldQuaternion(new THREE.Quaternion()) } : null
  }
  const dRoot = mkDriven('root')
  const dSpine = mkDriven('spine05') // MakeHuman 脊椎編號由下而上：spine05 在腰際
  const dNeck = mkDriven('neck01')

  // ---- 四肢綁定資料 ----
  interface LimbBoneState extends DrivenBone {
    from: number
    to: number
    /** 綁定姿骨段世界方向（單位向量） */
    restDir: THREE.Vector3
    /** (restDir, rest法線) 基底之逆；null 表示建置失敗 → swing-only 退路 */
    qRestBasisInv: THREE.Quaternion | null
  }
  interface LimbState {
    upper: LimbBoneState
    lower: LimbBoneState
    body: 'pelvis' | 'trunk'
    /** 綁定彎曲法線（rest 身體框架座標），逐幀搬運為 default 法線 */
    defaultNormalLocal: THREE.Vector3
    lastNormal: THREE.Vector3
  }

  const mkLimbBone = (def: LimbSegDef): LimbBoneState | null => {
    const bone = get(def.bone)
    const end = get(def.end)
    if (!bone || !end) return null
    bone.getWorldPosition(pA)
    end.getWorldPosition(pB)
    return {
      bone,
      restWorldQuat: bone.getWorldQuaternion(new THREE.Quaternion()),
      from: def.from,
      to: def.to,
      restDir: pB.clone().sub(pA).normalize(),
      qRestBasisInv: null,
    }
  }

  const limbs: LimbState[] = []
  for (const def of LIMB_DEFS) {
    const upper = mkLimbBone(def.upper)
    const lower = mkLimbBone(def.lower)
    if (!upper || !lower) continue
    const qRestBody = def.body === 'trunk' ? qRestTrunk : qRestPelvis
    // rest 彎曲法線：取綁定姿本身的肘/膝微彎；近伸直則用 canonical（對身體前方叉積）
    const nRest = new THREE.Vector3().crossVectors(upper.restDir, lower.restDir)
    if (nRest.length() < 0.15) {
      vF.set(0, 0, def.flexSign).applyQuaternion(qRestBody)
      nRest.crossVectors(upper.restDir, vF)
    }
    if (nRest.lengthSq() < 1e-10) continue
    nRest.normalize()
    for (const lb of [upper, lower]) {
      const q = new THREE.Quaternion()
      lb.qRestBasisInv = basisFromDirNormal(lb.restDir, nRest, q) ? q.invert() : null
    }
    limbs.push({
      upper,
      lower,
      body: def.body,
      defaultNormalLocal: nRest.clone().applyQuaternion(qRestBody.clone().invert()),
      lastNormal: new THREE.Vector3(),
    })
  }

  // 骨盆錨定用的兩髖骨
  const hipL = get('upperleg01.L')
  const hipR = get('upperleg01.R')

  // 目標框架跨幀保留：退化幀沿用前值，初值 = rest（資料異常時停在綁定姿）
  const qPelvisT = qRestPelvis.clone()
  const qTrunkT = qRestTrunk.clone()
  const qHeadT = qRestTrunk.clone()

  const jointAt = (pose: Float32Array, j: number, out: THREE.Vector3) =>
    out.set(pose[j * 3], pose[j * 3 + 1], pose[j * 3 + 2])

  const setWorldQuat = (bone: THREE.Bone, qW: THREE.Quaternion) => {
    bone.parent!.getWorldQuaternion(qParent) // 內部會先更新祖先矩陣（父骨必須先驅動）
    bone.quaternion.copy(qParent.invert()).multiply(qW)
  }

  const driveFrame = (d: DrivenBone | null, qT: THREE.Quaternion, qRestFrameInv: THREE.Quaternion) => {
    if (!d) return
    qWorld.copy(qT).multiply(qRestFrameInv).multiply(d.restWorldQuat)
    setWorldQuat(d.bone, qWorld)
  }

  const driveLimbBone = (lb: LimbBoneState, dir: THREE.Vector3, normal: THREE.Vector3) => {
    if (lb.qRestBasisInv && basisFromDirNormal(dir, normal, qTmp)) {
      qWorld.copy(qTmp).multiply(lb.qRestBasisInv).multiply(lb.restWorldQuat)
    } else {
      // 法線退化：退回 swing-only 最短弧（僅方向、無扭轉）
      qTmp.setFromUnitVectors(lb.restDir, dir)
      qWorld.copy(qTmp).multiply(lb.restWorldQuat)
    }
    setWorldQuat(lb.bone, qWorld)
  }

  return {
    apply(pose: Float32Array) {
      // 1) 身體三框架（骨盆 / 軀幹 / 頭）
      jointAt(pose, 7, pA)
      jointAt(pose, 0, pB)
      pA.sub(pB)
      jointAt(pose, 4, pB)
      jointAt(pose, 1, dirU)
      frameFromUpLeft(pA, pB.sub(dirU), qPelvisT)

      jointAt(pose, 8, pA)
      jointAt(pose, 0, pB)
      pA.sub(pB)
      jointAt(pose, 11, pB)
      jointAt(pose, 14, dirU)
      frameFromUpLeft(pA, pB.sub(dirU), qTrunkT)

      // 頭部：up = 頸根(8)→頭頂(10)（跳過鼻 9，避免鼻朝前造成頭後仰）；
      //       面向提示 = 胸廓(8)→鼻(9)（鼻才是真實面向）；leftHint = up × fwdHint
      jointAt(pose, 10, pA)
      jointAt(pose, 8, pB)
      pA.sub(pB) // up
      jointAt(pose, 9, dirU)
      jointAt(pose, 8, pB)
      dirU.sub(pB) // fwdHint = 鼻 − 胸廓
      vHint.crossVectors(pA, dirU) // leftHint
      if (vHint.lengthSq() < 1e-10) vHint.set(1, 0, 0).applyQuaternion(qTrunkT) // 抬頭看天退化 → 軀幹 left
      frameFromUpLeft(pA, vHint, qHeadT)

      // 2) 軀幹骨（父先子後：root → spine05 → neck01）
      driveFrame(dRoot, qPelvisT, qRestPelvisInv)
      driveFrame(dSpine, qTrunkT, qRestTrunkInv)
      driveFrame(dNeck, qHeadT, qRestTrunkInv) // rest 頭框架 = rest 軀幹框架

      // 3) 四肢：方向 + 彎曲平面法線
      for (const limb of limbs) {
        const qBodyT = limb.body === 'trunk' ? qTrunkT : qPelvisT

        jointAt(pose, limb.upper.from, pA)
        jointAt(pose, limb.upper.to, pB)
        dirU.subVectors(pB, pA)
        const upperOk = dirU.lengthSq() > 1e-8
        if (upperOk) dirU.normalize()

        jointAt(pose, limb.lower.from, pA)
        jointAt(pose, limb.lower.to, pB)
        dirL.subVectors(pB, pA)
        const lowerOk = dirL.lengthSq() > 1e-8
        if (lowerOk) dirL.normalize()

        // default 法線由身體框架搬運；實測法線依彎曲量（|cross| = sinθ）平滑混入
        nD.copy(limb.defaultNormalLocal).applyQuaternion(qBodyT)
        let w = 0
        if (upperOk && lowerOk) {
          nM.crossVectors(dirU, dirL)
          const mag = nM.length()
          if (mag > 1e-8) {
            w = smoothstep(mag, 0.05, 0.3)
            nM.divideScalar(mag)
          }
        }
        nC.copy(nD).multiplyScalar(1 - w)
        if (w > 0) nC.addScaledVector(nM, w)
        if (nC.lengthSq() < 1e-10) nC.copy(nD)
        nC.normalize()
        // 過伸瞬間實測法線會翻面：彎曲量不足以信任時沿用前一幀
        if (limb.lastNormal.lengthSq() === 0) limb.lastNormal.copy(nC)
        if (nC.dot(limb.lastNormal) < 0 && w < 0.6) nC.copy(limb.lastNormal)
        limb.lastNormal.copy(nC)

        if (upperOk) driveLimbBone(limb.upper, dirU, nC)
        if (lowerOk) driveLimbBone(limb.lower, dirL, nC)
      }

      // 4) 骨盆錨定：套完旋轉後量測兩髖骨中點（model 父座標系），平移貼齊資料骨盆
      if (hipL && hipR && model.parent) {
        hipL.getWorldPosition(pA)
        hipR.getWorldPosition(pB)
        pA.add(pB).multiplyScalar(0.5)
        model.parent.worldToLocal(pA)
        jointAt(pose, 0, pB)
        model.position.add(pB.sub(pA))
      }
    },
  }
}
