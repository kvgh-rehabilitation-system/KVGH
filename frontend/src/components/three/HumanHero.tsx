import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { indexBones, normalizeBoneName, useHumanModel } from './human-model'

function HeroModel() {
  const model = useHumanModel()

  // 綁定姿即 A-pose（模型無內建動畫），加一點呼吸微動畫
  const spine = useMemo(() => {
    const bones = indexBones(model)
    const bone = bones.get(normalizeBoneName('spine03'))
    return bone ? { bone, rest: bone.quaternion.clone() } : null
  }, [model])
  const t = useRef(0)

  useFrame((_, delta) => {
    if (!spine) return
    t.current += delta
    spine.bone.quaternion.copy(spine.rest)
    spine.bone.rotateX(0.02 * Math.sin(t.current * 1.1))
  })

  return <primitive object={model} />
}

/** 登入頁 / Dashboard 裝飾用：緩慢自轉的 A-pose 素體 */
export default function HumanHero({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0.4, 1.3, 3.4], fov: 40 }} className="!touch-none">
        <ambientLight intensity={0.9} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.5} color="#FFE8D0" />
        <directionalLight position={[-4, 3, -3]} intensity={0.55} color="#DCE5CB" />
        <Suspense fallback={null}>
          <group position={[0, -0.9, 0]}>
            <HeroModel />
            <ContactShadows opacity={0.3} scale={5} blur={2.6} far={2} color="#3D3229" />
          </group>
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.9}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.2, 0]}
        />
      </Canvas>
    </div>
  )
}
