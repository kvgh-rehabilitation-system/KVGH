import { AnimatePresence, motion } from 'framer-motion'
import { HeartPulse, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip'
import { useAuth } from '../contexts/AuthContext'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface Props {
  navItems: NavItem[]
  roleLabel: string
}

const COLLAPSED_KEY = 'kvgh.sidebar.collapsed'

/** 收合時淡出、展開時淡入的文字容器 */
function FadeText({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          exit={{ opacity: 0 }}
          className="min-w-0 flex-1"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 收合狀態下用 tooltip 補回被隱藏的文字 */
function CollapsedTooltip({
  enabled,
  label,
  children,
}: {
  enabled: boolean
  label: ReactNode
  children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** 三種角色共用的 Sidebar Layout（可收合成窄欄） */
export function AppLayout({ navItems, roleLabel }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === '1',
  )

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1')
      return !prev
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full">
      <TooltipProvider delayDuration={150}>
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 64 : 240 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="flex shrink-0 flex-col overflow-hidden whitespace-nowrap border-r border-sand bg-white/70 backdrop-blur"
        >
          <div
            className={`flex items-center pb-4 pt-6 ${
              collapsed ? 'flex-col gap-3 px-0' : 'gap-2.5 px-5'
            }`}
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="rounded-xl bg-clay-500 p-2 text-white shadow-soft"
            >
              <HeartPulse size={18} />
            </motion.div>
            <FadeText show={!collapsed}>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-bark-700">KVGH 復健照護</p>
                <p className="text-[11px] text-bark-300">Rehabilitation Care</p>
              </div>
            </FadeText>
            <CollapsedTooltip enabled={collapsed} label="展開選單">
              <button
                onClick={toggleCollapsed}
                title={collapsed ? undefined : '收合選單'}
                className="rounded-lg p-2 text-bark-300 transition-colors hover:bg-parchment hover:text-bark-600"
              >
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            </CollapsedTooltip>
          </div>

          <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2.5' : 'px-3'}`}>
            {navItems.map((item) => (
              <CollapsedTooltip key={item.to} enabled={collapsed} label={item.label}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
                    } ${
                      isActive
                        ? 'bg-clay-50 text-clay-700'
                        : 'text-bark-400 hover:bg-parchment hover:text-bark-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-clay-500"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <item.icon
                        size={18}
                        strokeWidth={1.8}
                        className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                      />
                      <FadeText show={!collapsed}>
                        <span className="block truncate">{item.label}</span>
                      </FadeText>
                    </>
                  )}
                </NavLink>
              </CollapsedTooltip>
            ))}
          </nav>

          <div className={`border-t border-sand ${collapsed ? 'px-2.5 py-4' : 'p-4'}`}>
            <div
              className={`flex items-center ${
                collapsed ? 'flex-col gap-2' : 'gap-3'
              }`}
            >
              <CollapsedTooltip
                enabled={collapsed}
                label={`${user?.name ?? ''}・${roleLabel}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sm font-semibold text-sage-700">
                  {user?.name?.charAt(0)}
                </div>
              </CollapsedTooltip>
              <FadeText show={!collapsed}>
                <div className="leading-tight">
                  <p className="truncate text-sm font-medium text-bark-700">{user?.name}</p>
                  <p className="text-[11px] text-bark-300">{roleLabel}</p>
                </div>
              </FadeText>
              <CollapsedTooltip enabled={collapsed} label="登出">
                <button
                  onClick={handleLogout}
                  title={collapsed ? undefined : '登出'}
                  className="rounded-lg p-2 text-bark-300 transition-colors hover:bg-parchment hover:text-rust"
                >
                  <LogOut size={16} />
                </button>
              </CollapsedTooltip>
            </div>
          </div>
        </motion.aside>
      </TooltipProvider>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-screen-2xl px-6 py-8 lg:px-10 2xl:px-14">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
