import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import DiseaseReportsPage from './pages/admin/DiseaseReportsPage';
import WaterQualityReportsPage from './pages/admin/WaterQualityReportsPage';
import PondMonitoringPage from './pages/admin/PondMonitoringPage';
import FeedingPage from './pages/admin/FeedingPage';
import HarvestPage from './pages/admin/HarvestPage';
import UsersPage from './pages/admin/UsersPage';
import AlertsPage from './pages/admin/AlertsPage';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import CaretakerDashboard from './pages/caretaker/CaretakerDashboard';
import MyTasksPage from './pages/caretaker/MyTasksPage';
import MyPondPage from './pages/caretaker/MyPondPage';
import DiseaseScanPage from './pages/caretaker/DiseaseScanPage';
import FeedingHistoryPage from './pages/caretaker/FeedingHistoryPage';
import CaretakerSettingsPage from './pages/caretaker/CaretakerSettingsPage';
import CaretakerNotificationsPage from './pages/caretaker/CaretakerNotificationsPage';
import CaretakerReportsPage from './pages/caretaker/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './layouts/AdminLayout';
import CaretakerLayout from './layouts/CaretakerLayout';

import NotificationsPage from './pages/admin/NotificationsPage';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [pathname]);

  return null;
}

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="text-center py-5">Loading your workspace...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/caretaker/dashboard'} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="scan-reports" element={<DiseaseReportsPage />} />
        <Route path="disease-reports" element={<DiseaseReportsPage />} />
        <Route path="water-quality-reports" element={<WaterQualityReportsPage />} />
        <Route path="water-quality" element={<WaterQualityReportsPage />} />
        <Route path="pond-reports" element={<PondMonitoringPage />} />
        <Route path="ponds" element={<PondMonitoringPage />} />
        <Route path="feeding" element={<FeedingPage />} />
        <Route path="harvest" element={<HarvestPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/caretaker" element={<ProtectedRoute role="caretaker"><CaretakerLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CaretakerDashboard />} />
        <Route path="my-tasks" element={<Navigate to="/caretaker/dashboard#my-tasks" replace />} />
        <Route path="my-pond" element={<MyPondPage />} />
        <Route path="disease-scan" element={<DiseaseScanPage />} />
        <Route path="feeding-history" element={<FeedingHistoryPage />} />
        <Route path="reports" element={<CaretakerReportsPage />} />
        <Route path="notifications" element={<CaretakerNotificationsPage />} />
        <Route path="profile" element={<Navigate to="/caretaker/settings" replace />} />
        <Route path="settings" element={<CaretakerSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <AuthProvider>
        <LanguageProvider>
          <AppRoutes />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
