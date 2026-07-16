/**
 * 四種角色的 Sidebar 導覽定義。版面骨架共用 AppLayout，
 * 這裡只宣告各角色看得到的選單項目（路由守衛在 App.tsx 的 RequireRole）。
 */
import {
  Activity,
  CalendarCheck,
  ClipboardList,
  FileHeart,
  Film,
  Home,
  MonitorPlay,
  Users,
} from 'lucide-react'
import { AppLayout } from './AppLayout'

export function AdminLayout() {
  return (
    <AppLayout
      roleLabel="管理員"
      navItems={[
        { to: '/admin/dashboard', label: '系統總覽', icon: Home },
        { to: '/admin/users', label: '帳號管理', icon: Users },
        { to: '/admin/tasks', label: '分析任務', icon: Activity },
      ]}
    />
  )
}

export function DoctorLayout() {
  return (
    <AppLayout
      roleLabel="醫師"
      navItems={[
        { to: '/doctor/dashboard', label: '首頁', icon: Home },
        { to: '/doctor/patients', label: '病患列表', icon: Users },
        { to: '/doctor/rehabilitation-plans', label: '復健計畫', icon: ClipboardList },
      ]}
    />
  )
}

export function NurseLayout() {
  return (
    <AppLayout
      roleLabel="護理師"
      navItems={[
        { to: '/nurse/dashboard', label: '首頁', icon: Home },
        { to: '/nurse/patients', label: '我的病患', icon: Users },
        { to: '/nurse/submissions', label: '影片審核', icon: MonitorPlay },
        { to: '/nurse/teacher-videos', label: '導師影片庫', icon: Film },
      ]}
    />
  )
}

export function PatientLayout() {
  return (
    <AppLayout
      roleLabel="病患"
      navItems={[
        { to: '/portal/dashboard', label: '我的首頁', icon: Home },
        { to: '/portal/visits', label: '看診紀錄', icon: CalendarCheck },
        { to: '/portal/rehabilitation-plans', label: '復健計畫', icon: FileHeart },
      ]}
    />
  )
}
