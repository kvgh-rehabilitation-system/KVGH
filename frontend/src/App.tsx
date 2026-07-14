import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AdminLayout, DoctorLayout, NurseLayout, PatientLayout } from './layouts/roleLayouts'
import { LoginPage, roleHome } from './pages/LoginPage'
import { RequireRole } from './routes/RequireRole'

// 管理員端
import { AdminDashboardPage } from './features/admin/pages/AdminDashboardPage'
import { AdminUsersPage } from './features/admin/pages/AdminUsersPage'
import { AdminTasksPage } from './features/admin/pages/AdminTasksPage'

// 醫生端
import { DoctorDashboardPage } from './features/doctor/pages/DoctorDashboardPage'
import { PatientListPage } from './features/doctor/pages/PatientListPage'
import { PatientDetailPage } from './features/doctor/pages/PatientDetailPage'
import { CreateVisitRecordPage } from './features/doctor/pages/CreateVisitRecordPage'
import { RehabilitationPlanListPage } from './features/doctor/pages/RehabilitationPlanListPage'
import { RehabilitationPlanDetailPage } from './features/doctor/pages/RehabilitationPlanDetailPage'
import { PlanFormPage } from './features/doctor/pages/PlanFormPage'

// 護理師端
import { NurseDashboardPage } from './features/nurse/pages/NurseDashboardPage'
import { NursePatientListPage } from './features/nurse/pages/NursePatientListPage'
import { NursePatientDetailPage } from './features/nurse/pages/NursePatientDetailPage'
import { SubmissionQueuePage } from './features/nurse/pages/SubmissionQueuePage'
import { SubmissionReviewPage } from './features/nurse/pages/SubmissionReviewPage'
import { PlanItemsPage } from './features/nurse/pages/PlanItemsPage'
import { TeacherVideoLibraryPage } from './features/nurse/pages/TeacherVideoLibraryPage'
import { TeacherVideoAnnotatePage } from './features/nurse/pages/TeacherVideoAnnotatePage'

// 病患端
import { PortalDashboardPage } from './features/patient/pages/PortalDashboardPage'
import { PortalVisitsPage } from './features/patient/pages/PortalVisitsPage'
import { PortalPlanListPage } from './features/patient/pages/PortalPlanListPage'
import { PortalPlanDetailPage } from './features/patient/pages/PortalPlanDetailPage'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? roleHome[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="tasks" element={<AdminTasksPage />} />
          </Route>

          <Route
            path="/doctor"
            element={
              <RequireRole role="doctor">
                <DoctorLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DoctorDashboardPage />} />
            <Route path="patients" element={<PatientListPage />} />
            <Route path="patients/:patientId" element={<PatientDetailPage />} />
            <Route path="patients/:patientId/visits/new" element={<CreateVisitRecordPage />} />
            <Route
              path="patients/:patientId/rehabilitation-plans/new"
              element={<PlanFormPage mode="create" />}
            />
            <Route path="submissions/:submissionId" element={<SubmissionReviewPage readOnly />} />
            <Route path="rehabilitation-plans" element={<RehabilitationPlanListPage />} />
            <Route path="rehabilitation-plans/:planId" element={<RehabilitationPlanDetailPage />} />
            <Route
              path="rehabilitation-plans/:planId/adjust"
              element={<PlanFormPage mode="adjust" />}
            />
          </Route>

          <Route
            path="/nurse"
            element={
              <RequireRole role="nurse">
                <NurseLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<NurseDashboardPage />} />
            <Route path="patients" element={<NursePatientListPage />} />
            <Route path="patients/:patientId" element={<NursePatientDetailPage />} />
            <Route path="submissions" element={<SubmissionQueuePage />} />
            <Route path="submissions/:submissionId" element={<SubmissionReviewPage />} />
            <Route path="plans/:planId/items" element={<PlanItemsPage />} />
            <Route path="plans/:planId" element={<RehabilitationPlanDetailPage role="nurse" />} />
            <Route path="teacher-videos" element={<TeacherVideoLibraryPage />} />
            <Route
              path="teacher-videos/:teacherVideoId/annotate"
              element={<TeacherVideoAnnotatePage />}
            />
          </Route>

          <Route
            path="/portal"
            element={
              <RequireRole role="patient">
                <PatientLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PortalDashboardPage />} />
            <Route path="visits" element={<PortalVisitsPage />} />
            <Route path="rehabilitation-plans" element={<PortalPlanListPage />} />
            <Route path="rehabilitation-plans/:planId" element={<PortalPlanDetailPage />} />
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
