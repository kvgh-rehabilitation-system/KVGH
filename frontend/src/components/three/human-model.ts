import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * rehab_human.glb（MakeHuman 匯出）共用載入層。
 *
 * 檔內含兩份重複 rig+mesh：Human.rig 與 Human.rig_export_copy。
 * 載入後移除 export_copy；自帶膚色貼圖統一換成素色膚材（展示假人樣式）。
 */

export const HUMAN_MODEL_URL = '/models/rehab_human.glb'
export const HUMAN_SKIN_COLOR = '#E8C8A8'

/**
 * 演算法儀表板 8 關節鍵 → MakeHuman 骨骼名。
 * 注意 GLTFLoader 會移除名稱中的「.」（upperarm01.L → upperarm01L），
 * 查找一律走 normalizeBoneName 比對。
 */
export const JOINT_TO_BONE: Record<string, string> = {
  left_shoulder: 'upperarm01.L',
  right_shoulder: 'upperarm01.R',
  left_elbow: 'lowerarm01.L',
  right_elbow: 'lowerarm01.R',
  left_hip: 'upperleg01.L',
  right_hip: 'upperleg01.R',
  left_knee: 'lowerleg01.L',
  right_knee: 'lowerleg01.R',
}

/**
 * 骨名正規化：先剝 GLTFLoader 重名去重可能附加的 `_N` 後綴，
 * 再去符號、轉小寫。數字要保留（upperarm01/upperarm02 不可撞名）。
 */
export const normalizeBoneName = (name: string) =>
  name.replace(/_\d+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase()

/** 建立 正規化骨名 → Bone 的索引表 */
export function indexBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const bones = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const key = normalizeBoneName(obj.name)
      if (!bones.has(key)) bones.set(key, obj as THREE.Bone)
    }
  })
  return bones
}

/** 依關節鍵找到對應骨骼 */
export function findJointBones(
  root: THREE.Object3D,
  joints: string[],
): Map<string, THREE.Bone> {
  const index = indexBones(root)
  const found = new Map<string, THREE.Bone>()
  for (const joint of joints) {
    const boneName = JOINT_TO_BONE[joint]
    if (!boneName) continue
    const bone = index.get(normalizeBoneName(boneName))
    if (bone) found.set(joint, bone)
  }
  return found
}

/** 共用素色膚材（所有素體實例共享） */
const skinMaterial = new THREE.MeshStandardMaterial({
  color: HUMAN_SKIN_COLOR,
  roughness: 0.6,
})

/**
 * 載入並整理素體模型：移除重複副本、素色膚材、投影設定。
 * 回傳的是 clone，可安全掛進多個場景。
 */
export function useHumanModel(): THREE.Object3D {
  const { scene } = useGLTF(HUMAN_MODEL_URL)
  return useMemo(() => {
    const model = cloneSkeleton(scene)
    // 檔內兩份 rig+mesh 完全重複，只保留原始 Human.rig。
    model.children
      .filter((child) => /export_copy/i.test(child.name))
      .forEach((child) => model.remove(child))
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.frustumCulled = false
        mesh.material = skinMaterial
      }
    })
    model.updateWorldMatrix(true, true)
    return model
  }, [scene])
}

useGLTF.preload(HUMAN_MODEL_URL)
