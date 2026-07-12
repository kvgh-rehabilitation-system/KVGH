import type { MutableRefObject } from 'react'
import type * as THREE from 'three'

interface Props {
  joints: string[]
  markerRefs: MutableRefObject<Map<string, THREE.Mesh>>
}

/** 將高偏差關節標成紅色光暈球，位置由動作重播逐幀同步。 */
export function JointMarkers({ joints, markerRefs }: Props) {
  return joints.map((joint) => (
    <mesh
      key={joint}
      ref={(mesh) => {
        if (mesh) markerRefs.current.set(joint, mesh)
        else markerRefs.current.delete(joint)
      }}
    >
      <sphereGeometry args={[0.045, 16, 16]} />
      <meshBasicMaterial color="#B5543B" transparent opacity={0.85} />
      <pointLight color="#B5543B" intensity={0.35} distance={0.35} />
    </mesh>
  ))
}
