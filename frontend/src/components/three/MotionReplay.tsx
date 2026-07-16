/**
 * 【遺留元件】Michelle.glb（Mixamo 骨架）版的示意動畫重播。
 * 現行審核頁用的是 HumanMotionReplay（rehab_human.glb）；
 * 本檔保留供隨時切回舊素體比對，勿刪（見 frontend/CLAUDE.md）。
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { JointDeviation, MotionSequence } from '../../types'
import { JointMarkers } from './JointMarkers'
import { ReplayControls } from './ReplayControls'
import { MODEL_URL, findJointBones } from './skeleton-utils'

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
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => {
    const m = cloneSkeleton(scene)
    m.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.frustumCulled = false
      }
    })
    return m
  }, [scene])

  const bones = useMemo(() => findJointBones(model, sequence.joints), [model, sequence.joints])
  const restPose = useMemo(() => {
    const rest = new Map<string, THREE.Quaternion>()
    bones.forEach((bone, joint) => rest.set(joint, bone.quaternion.clone()))
    return rest
  }, [bones])

  const highJoints = useMemo(
    () => new Set(deviations.filter((d) => d.status === 'HIGH').map((d) => d.joint)),
    [deviations],
  )
  const markersRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const tmpVec = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const axis = useMemo(() => new THREE.Vector3(1, 0, 0), [])

  useFrame((_, delta) => {
    const pb = playback.current
    if (pb.playing) pb.time += delta * pb.speed

    const { fps, frames, joints } = sequence
    if (frames.length > 0) {
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
        tmpQuat.setFromAxisAngle(axis, THREE.MathUtils.degToRad(angle * 0.6))
        bone.quaternion.copy(rest).multiply(tmpQuat)
      })
    }

    // 偏差關節標記跟隨骨骼位置
    markersRef.current.forEach((marker, joint) => {
      const bone = bones.get(joint)
      if (bone) {
        bone.getWorldPosition(tmpVec)
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

/** 3D 動作重播：以演算法輸出的關節角度序列驅動 GLTF 骨架，偏差關節紅色標記 */
export default function MotionReplay({ sequence, deviations = [], className }: Props) {
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
          <group position={[0, -0.92, 0]}>
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

useGLTF.preload(MODEL_URL)
