import {
  CalendarCheck,
  ClipboardList,
  FileHeart,
  Film,
  Home,
  MonitorPlay,
  Users,
} from 'lucide-react'
import { AppLayout } from './AppLayout'

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
