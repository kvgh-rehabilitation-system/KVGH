import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { HeartPulse, Lock, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { LazyHumanHero } from '../components/three/lazy'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'

export const roleHome: Record<Role, string> = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  nurse: '/nurse/dashboard',
  patient: '/portal/dashboard',
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(username, password)
      navigate(roleHome[user.role])
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-gradient-to-br from-cream via-parchment to-clay-50">
      {/* 背景漂浮光暈 */}
      <motion.div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-clay-100/60 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-sage-100/50 blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative mx-auto grid min-h-full w-full max-w-screen-2xl lg:grid-cols-[1.25fr_0.75fr]">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="relative hidden min-h-[100svh] overflow-hidden border-r border-white/50 lg:block"
        >
          <div className="absolute inset-x-0 top-0 z-10 p-10 xl:p-14">
            <div className="inline-flex items-center gap-3">
              <span className="rounded-2xl bg-clay-500 p-3 text-white shadow-glow">
                <HeartPulse size={25} />
              </span>
              <div>
                <p className="font-display text-xl font-semibold text-bark-700">KVGH 復健照護</p>
                <p className="text-[11px] tracking-[0.18em] text-bark-400">MOTION INTELLIGENCE</p>
              </div>
            </div>
          </div>
          <LazyHumanHero className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-cream via-cream/80 to-transparent px-10 pb-12 pt-28 xl:px-14">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="max-w-xl font-display text-4xl font-semibold leading-tight tracking-tight text-bark-700 xl:text-5xl"
            >
              讓每一次練習，
              <br />
              都留下可理解的進步。
            </motion.p>
            <p className="mt-4 max-w-md text-sm leading-6 text-bark-500">
              從居家影片、動作分析到專業審核，連結病患與復健團隊的照護流程。
            </p>
          </div>
        </motion.section>

        <section className="flex min-h-[100svh] items-center justify-center px-5 py-10 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm"
          >
            <div className="mb-8 lg:hidden">
              <div className="mb-4 inline-flex rounded-2xl bg-clay-500 p-3.5 text-white shadow-lifted">
                <HeartPulse size={28} />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-bark-700">KVGH 復健照護系統</h1>
              <p className="mt-1.5 text-sm text-bark-400">動作分析與跨角色照護平台</p>
            </div>
            <div className="mb-7 hidden lg:block">
              <p className="text-sm font-medium text-clay-600">安全登入</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-bark-700">回到您的照護工作區</h1>
              <p className="mt-2 text-sm text-bark-400">請使用院內帳號或病患帳號登入</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/70 bg-white/65 p-7 shadow-lifted backdrop-blur-xl">
              <div>
                <label className="label">帳號</label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-300" />
                  <input className="input pl-10" placeholder="doctor01 / nurse01 / patient01" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                </div>
              </div>
              <div>
                <label className="label">密碼</label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-300" />
                  <input className="input pl-10" type="password" placeholder="請輸入密碼" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              {error && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-[#F7E8E4] px-3.5 py-2.5 text-sm text-rust">
                  {error}
                </motion.p>
              )}
              <motion.button whileTap={{ scale: 0.98 }} className="btn-primary w-full justify-center py-3" disabled={submitting || !username || !password}>
                {submitting ? '登入中…' : '登入'}
              </motion.button>
            </form>
            <p className="mt-6 text-center text-xs text-bark-300">高雄榮民總醫院 復健醫學部</p>
          </motion.div>
        </section>
      </main>
    </div>
  )
}
