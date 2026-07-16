/**
 * 3D 元件的 lazy 載入包裝（全站唯一入口）。
 * three.js + fiber + drei 體積大，經 React.lazy 切成獨立 chunk，
 * 只有真正用到 3D 的頁面才下載；一般頁面完全不碰 three。
 */
import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
import { Skeleton } from '../ui/skeleton'

const MotionReplayInner = lazy(() => import('./MotionReplay'))
const MannequinReplayInner = lazy(() => import('./MannequinReplay'))
const SkeletonHeroInner = lazy(() => import('./SkeletonHero'))
const SkeletonViewerInner = lazy(() => import('./SkeletonViewer'))
const HumanReplayInner = lazy(() => import('./HumanReplay'))
const HumanMotionReplayInner = lazy(() => import('./HumanMotionReplay'))
const HumanHeroInner = lazy(() => import('./HumanHero'))

/** lazy 版 3D 動作重播：three 相關程式碼獨立 chunk，不拖慢一般頁面 */
export function LazyMotionReplay(props: ComponentProps<typeof MotionReplayInner>) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <MotionReplayInner {...props} />
    </Suspense>
  )
}

/** lazy 版程式化素體重播：由 .npy 3D 關節點驅動 */
export function LazyMannequinReplay(props: ComponentProps<typeof MannequinReplayInner>) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <MannequinReplayInner {...props} />
    </Suspense>
  )
}

/** lazy 版登入頁 3D hero */
export function LazySkeletonHero(props: ComponentProps<typeof SkeletonHeroInner>) {
  return (
    <Suspense fallback={<div className={props.className} />}>
      <SkeletonHeroInner {...props} />
    </Suspense>
  )
}

export function LazySkeletonViewer(props: ComponentProps<typeof SkeletonViewerInner>) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <SkeletonViewerInner {...props} />
    </Suspense>
  )
}

/** lazy 版素體重播：.npy 3D 關節點重定向驅動 rehab_human.glb */
export function LazyHumanReplay(props: ComponentProps<typeof HumanReplayInner>) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <HumanReplayInner {...props} />
    </Suspense>
  )
}

/** lazy 版素體示意動畫：關節角度序列驅動 rehab_human.glb（seed 降級用） */
export function LazyHumanMotionReplay(props: ComponentProps<typeof HumanMotionReplayInner>) {
  return (
    <Suspense fallback={<Skeleton className={props.className ?? 'h-72 w-full'} />}>
      <HumanMotionReplayInner {...props} />
    </Suspense>
  )
}

/** lazy 版登入頁素體 hero */
export function LazyHumanHero(props: ComponentProps<typeof HumanHeroInner>) {
  return (
    <Suspense fallback={<div className={props.className} />}>
      <HumanHeroInner {...props} />
    </Suspense>
  )
}
