import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import type { NpyArray } from '../../utils/npy'
import {
  EDGE_RADII,
  H36M_EDGES,
  H36M_JOINTS,
  H36M_JOINT_INDEX,
  preparePose,
  type PreparedPose,
} from './pose-utils'
import { ReplayControls } from './ReplayControls'

const SKIN_COLOR = '#D9B99B'
const HIGH_COLOR = '#B5543B'

/** 每個關節球半徑（H36M 索引序；骨盆/胸廓被軀幹橢球覆蓋，可小） */
const JOINT_RADII = [
  0.05, 0.052, 0.048, 0.04, 0.052, 0.048, 0.04, 0.05, 0.05, 0.04, 0.03, 0.052,
  0.045, 0.038, 0.052, 0.045, 0.038,
]

interface PlaybackState {
  playing: boolean
  speed: number
  time: number
}

function Mannequin({
  pose,
  fps,
  highIndices,
  playback,
}: {
  pose: PreparedPose
  fps: number
  highIndices: Set<number>
  playback: React.MutableRefObject<PlaybackState>
}) {
  const jointRefs = useRef<(THREE.Mesh | null)[]>([])
  const boneRefs = useRef<(THREE.Mesh | null)[]>([])
  const chestRef = useRef<THREE.Mesh>(null)
  const pelvisRef = useRef<THREE.Mesh>(null)
  const headRef = useRef<THREE.Mesh>(null)

  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.85 }),
    [],
  )
  const highMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HIGH_COLOR,
        emissive: HIGH_COLOR,
        emissiveIntensity: 0.45,
        roughness: 0.6,
      }),
    [],
  )

  // 逐幀插值的暫存（避免 GC）
  const scratch = useMemo(() => new Float32Array(H36M_JOINTS * 3), [])
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  const setFromScratch = (v: THREE.Vector3, j: number) =>
    v.set(scratch[j * 3], scratch[j * 3 + 1], scratch[j * 3 + 2])

  useFrame((_, delta) => {
    const pb = playback.current
    if (pb.playing) pb.time += delta * pb.speed

    const { frames, positions } = pose
    const framePos = (pb.time * fps) % frames
    const idx = Math.floor(framePos)
    const next = (idx + 1) % frames
    const blend = framePos - idx
    const baseA = idx * H36M_JOINTS * 3
    const baseB = next * H36M_JOINTS * 3
    for (let i = 0; i < H36M_JOINTS * 3; i++) {
      scratch[i] = positions[baseA + i] * (1 - blend) + positions[baseB + i] * blend
    }

    // 關節球
    for (let j = 0; j < H36M_JOINTS; j++) {
      const mesh = jointRefs.current[j]
      if (mesh) mesh.position.set(scratch[j * 3], scratch[j * 3 + 1], scratch[j * 3 + 2])
    }

    // 骨段膠囊：對齊兩關節連線
    H36M_EDGES.forEach(([a, b], k) => {
      const mesh = boneRefs.current[k]
      if (!mesh) return
      setFromScratch(tmpA, a)
      setFromScratch(tmpB, b)
      tmpDir.subVectors(tmpB, tmpA)
      const dist = tmpDir.length()
      if (dist < 1e-4) return
      mesh.position.addVectors(tmpA, tmpB).multiplyScalar(0.5)
      tmpQuat.setFromUnitVectors(UP, tmpDir.normalize())
      mesh.quaternion.copy(tmpQuat)
      mesh.scale.set(1, dist / pose.boneLengths[k], 1)
    })

    // 胸廓橢球：沿脊椎方向，寬度取肩距
    if (chestRef.current) {
      setFromScratch(tmpA, 7)
      setFromScratch(tmpB, 8)
      tmpDir.subVectors(tmpB, tmpA)
      const spineLen = tmpDir.length()
      chestRef.current.position.copy(tmpA).addScaledVector(tmpDir, 0.6)
      chestRef.current.quaternion.setFromUnitVectors(UP, tmpDir.normalize())
      const lx = scratch[11 * 3] - scratch[14 * 3]
      const ly = scratch[11 * 3 + 1] - scratch[14 * 3 + 1]
      const lz = scratch[11 * 3 + 2] - scratch[14 * 3 + 2]
      const shoulderW = Math.hypot(lx, ly, lz)
      chestRef.current.scale.set(shoulderW * 0.42, spineLen * 0.8, shoulderW * 0.27)
    }

    // 骨盆橢球
    if (pelvisRef.current) {
      setFromScratch(tmpA, 0)
      setFromScratch(tmpB, 7)
      tmpDir.subVectors(tmpB, tmpA)
      const lowerLen = tmpDir.length()
      pelvisRef.current.position.copy(tmpA).addScaledVector(tmpDir, 0.12)
      pelvisRef.current.quaternion.setFromUnitVectors(UP, tmpDir.normalize())
      const hx = scratch[1 * 3] - scratch[4 * 3]
      const hy = scratch[1 * 3 + 1] - scratch[4 * 3 + 1]
      const hz = scratch[1 * 3 + 2] - scratch[4 * 3 + 2]
      const hipW = Math.hypot(hx, hy, hz)
      pelvisRef.current.scale.set(hipW * 0.62, lowerLen * 0.55, hipW * 0.4)
    }

    // 蛋形頭：沿頸→頭方向
    if (headRef.current) {
      setFromScratch(tmpA, 9)
      setFromScratch(tmpB, 10)
      tmpDir.subVectors(tmpB, tmpA)
      const neckLen = tmpDir.length()
      const r = Math.max(0.085, neckLen * 0.9)
      headRef.current.position.copy(tmpA).addScaledVector(tmpDir, 0.85)
      headRef.current.quaternion.setFromUnitVectors(UP, tmpDir.normalize())
      headRef.current.scale.set(r, r * 1.28, r * 0.92)
    }
  })

  return (
    <group>
      {Array.from({ length: H36M_JOINTS }, (_, j) => (
        <mesh
          key={`joint-${j}`}
          ref={(m) => {
            jointRefs.current[j] = m
          }}
          material={highIndices.has(j) ? highMat : skinMat}
          castShadow
        >
          <sphereGeometry args={[JOINT_RADII[j] * (highIndices.has(j) ? 1.25 : 1), 20, 20]} />
          {highIndices.has(j) && (
            <pointLight color={HIGH_COLOR} intensity={0.3} distance={0.3} />
          )}
        </mesh>
      ))}
      {H36M_EDGES.map(([a, b], k) => (
        <mesh
          key={`bone-${a}-${b}`}
          ref={(m) => {
            boneRefs.current[k] = m
          }}
          material={skinMat}
          castShadow
        >
          <capsuleGeometry
            args={[EDGE_RADII[k], Math.max(0.02, pose.boneLengths[k] - EDGE_RADII[k]), 6, 14]}
          />
        </mesh>
      ))}
      <mesh ref={chestRef} material={skinMat} castShadow>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      <mesh ref={pelvisRef} material={skinMat} castShadow>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
      <mesh ref={headRef} material={skinMat} castShadow>
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
    </group>
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
 * 程式化素體 3D 重播：由演算法 3D 關節點逐幀驅動的中性人偶，
 * 關節位置即演算法實際使用的關節點，可 360° 旋轉觀察。
 */
export default function MannequinReplay({ pose, fps, highJoints = [], className }: Props) {
  const prepared = useMemo(() => preparePose(pose), [pose])
  const highIndices = useMemo(
    () =>
      new Set(
        highJoints
          .map((j) => H36M_JOINT_INDEX[j])
          .filter((i): i is number => i !== undefined),
      ),
    [highJoints],
  )

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
      <Canvas shadows camera={{ position: [0.6, 1.35, 3.1], fov: 42 }} className="!touch-none">
        <ambientLight intensity={0.85} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.4} color="#FFE8D0" castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#DCE5CB" />
        <group position={[0, -0.85, 0]}>
          <Mannequin pose={prepared} fps={fps} highIndices={highIndices} playback={playback} />
          <ContactShadows opacity={0.35} scale={5} blur={2.4} far={2} color="#3D3229" />
        </group>
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
