/**
 * 現行主力重播元件：.npy 3D 骨架 → preparePose 正規化 → retarget 逐幀驅動
 * rehab_human.glb 蒙皮素體。分析資料齊全時審核頁走這裡（缺 .npy 時
 * 降級為 HumanMotionReplay 示意動畫，選擇邏輯在 MotionReplayPanel）。
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { NpyArray } from '../../utils/npy'
import { H36M_JOINTS, preparePose, type PreparedPose } from './pose-utils'
import { findJointBones, useHumanModel } from './human-model'
import { createRetargeter } from './retarget'
import { JointMarkers } from './JointMarkers'
import { ReplayControls } from './ReplayControls'

/** 播放狀態放 ref（非 state）：每幀更新 time 不能觸發 React re-render */
interface PlaybackState {
  playing: boolean
  speed: number
  time: number
}

function RetargetedHuman({
  pose,
  fps,
  highJoints,
  playback,
}: {
  pose: PreparedPose
  fps: number
  highJoints: string[]
  playback: React.MutableRefObject<PlaybackState>
}) {
  const model = useHumanModel()
  const retargeter = useMemo(() => createRetargeter(model), [model])
  const markerBones = useMemo(() => findJointBones(model, highJoints), [model, highJoints])
  const markersRef = useRef<Map<string, THREE.Mesh>>(new Map())

  // 隱藏校驗疊層（localStorage.debugPose='1'）：直接畫 17 關節資料點，
  // 重定向正確 ⇔ 點全程貼合素體對應關節
  const debugDots = useMemo(() => {
    if (localStorage.getItem('debugPose') !== '1') return null
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.022, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#B5543B', depthTest: false }),
      H36M_JOINTS,
    )
    mesh.frustumCulled = false
    mesh.renderOrder = 10
    return mesh
  }, [])
  const tmpMat = useMemo(() => new THREE.Matrix4(), [])

  // 逐幀插值的暫存（避免 GC）
  const scratch = useMemo(() => new Float32Array(H36M_JOINTS * 3), [])
  const tmpVec = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const pb = playback.current
    if (pb.playing) pb.time += delta * pb.speed

    // 以播放時間換算幀位置，相鄰兩幀線性插值（60fps 螢幕播 30/60fps 資料都平滑）
    const { frames, positions } = pose
    const framePos = (pb.time * fps) % frames
    const idx = Math.floor(framePos)
    const next = Math.min(idx + 1, frames - 1) // 不繞回首幀：末→首插值會混出一幀鬼姿勢
    const blend = framePos - idx
    const baseA = idx * H36M_JOINTS * 3
    const baseB = next * H36M_JOINTS * 3
    for (let i = 0; i < H36M_JOINTS * 3; i++) {
      scratch[i] = positions[baseA + i] * (1 - blend) + positions[baseB + i] * blend
    }

    retargeter.apply(scratch)

    if (debugDots) {
      for (let j = 0; j < H36M_JOINTS; j++) {
        tmpMat.makeTranslation(scratch[j * 3], scratch[j * 3 + 1], scratch[j * 3 + 2])
        debugDots.setMatrixAt(j, tmpMat)
      }
      debugDots.instanceMatrix.needsUpdate = true
    }

    // 偏差關節紅標跟隨骨骼世界座標
    markersRef.current.forEach((marker, joint) => {
      const bone = markerBones.get(joint)
      if (bone) {
        bone.getWorldPosition(tmpVec)
        marker.parent?.worldToLocal(tmpVec)
        marker.position.copy(tmpVec)
      }
    })
  })

  return (
    <>
      <primitive object={model} />
      {debugDots && <primitive object={debugDots} />}
      <JointMarkers joints={highJoints} markerRefs={markersRef} />
    </>
  )
}

interface Props {
  /** 病患 3D 骨架 .npy（幀×17×3，MotionBERT H36M） */
  pose: NpyArray
  /** 病患原片 fps（motion_sequence.fps） */
  fps: number
  /** 高偏差關節 key（left_shoulder 等），標紅 */
  highJoints?: string[]
  className?: string
}

/**
 * 素體 3D 重播：由演算法 3D 關節點逐幀重定向驅動 rehab_human.glb 蒙皮素體，
 * 方向/角度忠實於演算法輸出，可 360° 旋轉觀察。
 */
export default function HumanReplay({ pose, fps, highJoints = [], className }: Props) {
  const prepared = useMemo(() => preparePose(pose), [pose])

  // .npy 的 XZ 沒有置中（root 置中只是逐幀相對），取骨盆中位數平移到鏡頭中心，
  // 保留片內位移但不讓整段動作偏出構圖
  const center = useMemo(() => {
    const { frames, positions } = prepared
    const xs: number[] = []
    const zs: number[] = []
    const stride = Math.max(1, Math.floor(frames / 200))
    for (let f = 0; f < frames; f += stride) {
      xs.push(positions[f * H36M_JOINTS * 3])
      zs.push(positions[f * H36M_JOINTS * 3 + 2])
    }
    xs.sort((a, b) => a - b)
    zs.sort((a, b) => a - b)
    return {
      x: xs[Math.floor(xs.length / 2)] ?? 0,
      z: zs[Math.floor(zs.length / 2)] ?? 0,
    }
  }, [prepared])

  const playback = useRef<PlaybackState>({ playing: true, speed: 1, time: 0 })
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    playback.current.playing = playing
  }, [playing])
  useEffect(() => {
    playback.current.speed = speed
  }, [speed])

  const duration = prepared.frames / fps

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-sand bg-gradient-to-b from-[#F3EDE3] to-[#EAE3D8] ${className ?? ''}`}
    >
      {/* preparePose 已正規化面向 +Z，預設鏡位即正面 */}
      <Canvas shadows camera={{ position: [0.6, 1.35, 3.1], fov: 42 }} className="!touch-none">
        <ambientLight intensity={0.85} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.4} color="#FFE8D0" castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#DCE5CB" />
        <Suspense fallback={null}>
          <group position={[0, -0.85, 0]}>
            <group position={[-center.x, 0, -center.z]}>
              <RetargetedHuman
                pose={prepared}
                fps={fps}
                highJoints={highJoints}
                playback={playback}
              />
            </group>
            <ContactShadows opacity={0.35} scale={5} blur={2.4} far={2} color="#3D3229" />
          </group>
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={5}
          maxPolarAngle={Math.PI * 0.97}
          target={[0, 0.05, 0]}
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
