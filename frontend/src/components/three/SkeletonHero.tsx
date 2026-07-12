import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MODEL_URL } from './skeleton-utils'

function HeroModel() {
  const { scene, animations } = useGLTF(MODEL_URL)
  const model = useMemo(() => cloneSkeleton(scene), [scene])
  const { actions } = useAnimations(animations, model)

  useEffect(() => {
    const idle = actions['idle'] ?? actions['Idle'] ?? actions['TPose']
    idle?.reset().fadeIn(0.4).play()
    return () => {
      idle?.fadeOut(0.2)
    }
  }, [actions])

  useMemo(() => {
    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) mesh.frustumCulled = false
    })
  }, [model])

  return <primitive object={model} />
}

/** 登入頁 / Dashboard 裝飾用：緩慢自轉的 idle 骨架 */
export default function SkeletonHero({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0.4, 1.3, 3.4], fov: 40 }} className="!touch-none">
        <ambientLight intensity={0.9} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.5} color="#FFE8D0" />
        <directionalLight position={[-4, 3, -3]} intensity={0.55} color="#DCE5CB" />
        <Suspense fallback={null}>
          <group position={[0, -0.95, 0]}>
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

useGLTF.preload(MODEL_URL)
