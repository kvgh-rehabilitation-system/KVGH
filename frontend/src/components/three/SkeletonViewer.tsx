import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { MODEL_URL } from './skeleton-utils'

function Model() {
  const { scene } = useGLTF(MODEL_URL)
  const model = useMemo(() => {
    const clone = cloneSkeleton(scene)
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.frustumCulled = false
      }
    })
    return clone
  }, [scene])
  return <primitive object={model} />
}

interface Props {
  className?: string
  autoRotate?: boolean
}

/** 通用 GLTF 人形檢視器，提供棚燈、陰影與旋轉縮放控制。 */
export default function SkeletonViewer({ className, autoRotate = false }: Props) {
  return (
    <div className={className}>
      <Canvas shadows camera={{ position: [0.6, 1.35, 3.1], fov: 42 }} className="!touch-none">
        <ambientLight intensity={0.85} color="#FFF4E8" />
        <directionalLight position={[3, 6, 4]} intensity={1.4} color="#FFE8D0" castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#DCE5CB" />
        <Suspense fallback={null}>
          <group position={[0, -0.92, 0]}>
            <Model />
            <ContactShadows opacity={0.35} scale={5} blur={2.4} far={2} color="#3D3229" />
          </group>
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={1.6}
          maxDistance={5}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.15, 0]}
        />
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
