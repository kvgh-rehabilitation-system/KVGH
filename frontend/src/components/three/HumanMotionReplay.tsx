/**
 * 素體「示意動畫」重播：吃 DB 的關節角度序列（metrics.motion_sequence），
 * 不需要磁碟上的 .npy——是 seed 假資料與 pose3d 404 時的降級方案。
 * 真實資料的忠實重播請看 HumanReplay（.npy 重定向驅動）。
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { JointDeviation, MotionSequence } from '../../types'
import { findJointBones, useHumanModel } from './human-model'
import { JointMarkers } from './JointMarkers'
import { ReplayControls } from './ReplayControls'

/** 播放狀態放 ref（非 state）：每幀更新 time 不能觸發 React re-render */
interface PlaybackState {
  playing: boolean
  speed: number
  time: number
}

function ReplayModel({
  sequence,
  deviations,
  playback,
}: {
  sequence: MotionSequence
  deviations: JointDeviation[]
  playback: React.MutableRefObject<PlaybackState>
}) {
  const model = useHumanModel()
  const bones = useMemo(() => findJointBones(model, sequence.joints), [model, sequence.joints])

  // 綁定姿 local 四元數 + 「世界 X 軸」在各骨 local 座標系的方向：
  // MakeHuman 骨骼 local 軸向與 Mixamo 不同，繞世界 X 擺動才保證是矢狀面前後擺
  const restPose = useMemo(() => {
    model.updateWorldMatrix(true, true)
    const worldX = new THREE.Vector3(1, 0, 0)
    const rest = new Map<string, { quat: THREE.Quaternion; axis: THREE.Vector3 }>()
    const tmpQ = new THREE.Quaternion()
    bones.forEach((bone, joint) => {
      bone.getWorldQuaternion(tmpQ)
      rest.set(joint, {
        quat: bone.quaternion.clone(),
        axis: worldX.clone().applyQuaternion(tmpQ.invert()).normalize(),
      })
    })
    return rest
  }, [model, bones])

  const highJoints = useMemo(
    () => new Set(deviations.filter((d) => d.status === 'HIGH').map((d) => d.joint)),
    [deviations],
  )
  const markersRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const tmpVec = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])

  useFrame((_, delta) => {
    const pb = playback.current
    if (pb.playing) pb.time += delta * pb.speed

    const { fps, frames, joints } = sequence
    if (frames.length > 0) {
      // 幀間線性插值讓低 fps（10fps）序列播起來平滑
      const total = frames.length
      const framePos = (pb.time * fps) % total
      const idx = Math.floor(framePos)
      const next = (idx + 1) % total
      const blend = framePos - idx

      joints.forEach((joint, j) => {
        const bone = bones.get(joint)
        const rest = restPose.get(joint)
        if (!bone || !rest) return
        const angle = frames[idx][j] * (1 - blend) + frames[next][j] * blend
        // ×0.6：角度序列滿幅 ±30° 直接套會讓素體擺動過猛，示意動畫縮小幅度較自然
        tmpQuat.setFromAxisAngle(rest.axis, THREE.MathUtils.degToRad(angle * 0.6))
        bone.quaternion.copy(rest.quat).multiply(tmpQuat)
      })
    }

    // 偏差關節標記跟隨骨骼位置
    markersRef.current.forEach((marker, joint) => {
      const bone = bones.get(joint)
      if (bone) {
        bone.getWorldPosition(tmpVec)
        marker.parent?.worldToLocal(tmpVec)
        marker.position.copy(tmpVec)
      }
    })
  })

  return (
    <>
      <primitive object={model} position={[0, 0, 0]} />
      <JointMarkers joints={[...highJoints]} markerRefs={markersRef} />
    </>
  )
}

interface Props {
  sequence: MotionSequence
  deviations?: JointDeviation[]
  className?: string
}

/** 3D 動作示意重播：以演算法輸出的關節角度序列驅動 rehab_human.glb 素體，偏差關節紅色標記 */
export default function HumanMotionReplay({ sequence, deviations = [], className }: Props) {
  const playback = useRef<PlaybackState>({ playing: true, speed: 1, time: 0 })
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    playback.current.playing = playing
  }, [playing])
  useEffect(() => {
    playback.current.speed = speed
  }, [speed])

  const duration = sequence.frames.length / sequence.fps

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-sand bg-gradient-to-b from-[#F3EDE3] to-[#EAE3D8] ${className ?? ''}`}
    >
      <Canvas shadows camera={{ position: [0.6, 1.35, 3.1], fov: 42 }} className="!touch-none">
        <ambientLight intensity={0.85} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.4} color="#FFE8D0" castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#DCE5CB" />
        <Suspense fallback={null}>
          <group position={[0, -0.85, 0]}>
            <ReplayModel sequence={sequence} deviations={deviations} playback={playback} />
            <ContactShadows opacity={0.35} scale={5} blur={2.4} far={2} color="#3D3229" />
          </group>
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={5}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.15, 0]}
        />
      </Canvas>

      <ReplayControls
        playing={playing}
        speed={speed}
        duration={duration}
        onTogglePlay={() => setPlaying((p) => !p)}
        onRestart={() => {
          playback.current.time = 0
        }}
        onSpeedChange={setSpeed}
      />
    </div>
  )
}
