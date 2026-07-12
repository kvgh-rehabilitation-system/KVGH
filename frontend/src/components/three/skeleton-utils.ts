import * as THREE from 'three'

/** 演算法關節鍵 → Mixamo 骨骼名稱字尾 */
export const JOINT_TO_MIXAMO: Record<string, string> = {
  left_shoulder: 'LeftArm',
  right_shoulder: 'RightArm',
  left_elbow: 'LeftForeArm',
  right_elbow: 'RightForeArm',
  left_hip: 'LeftUpLeg',
  right_hip: 'RightUpLeg',
  left_knee: 'LeftLeg',
  right_knee: 'RightLeg',
}

const normalize = (name: string) => name.replace(/[^a-z]/gi, '').toLowerCase()

/** 依關節鍵在模型中找到對應骨骼（容忍 GLTFLoader 對名稱的 sanitize） */
export function findJointBones(
  root: THREE.Object3D,
  joints: string[],
): Map<string, THREE.Bone> {
  const wanted = new Map<string, string>() // normalized bone name -> joint key
  for (const joint of joints) {
    const suffix = JOINT_TO_MIXAMO[joint]
    if (suffix) wanted.set(normalize(`mixamorig${suffix}`), joint)
  }
  const found = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const key = wanted.get(normalize(obj.name))
      if (key && !found.has(key)) found.set(key, obj as THREE.Bone)
    }
  })
  return found
}

export const MODEL_URL = '/models/Michelle.glb'
