import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import DiseaseReportsPage from './pages/admin/DiseaseReportsPage';
import PondMonitoringPage from './pages/admin/PondMonitoringPage';
import FeedingPage from './pages/admin/FeedingPage';
import HarvestPage from './pages/admin/HarvestPage';
import UsersPage from './pages/admin/UsersPage';
import AlertsPage from './pages/admin/AlertsPage';
import ReportsPage from './pages/admin/ReportsPage';
import SettingsPage from './pages/admin/SettingsPage';
import CaretakerDashboard from './pages/caretaker/CaretakerDashboard';
import MyPondPage from './pages/caretaker/MyPondPage';
import DiseaseScanPage from './pages/caretaker/DiseaseScanPage';
import FeedingHistoryPage from './pages/caretaker/FeedingHistoryPage';
import ProfilePage from './pages/caretaker/ProfilePage';
import CaretakerReportsPage from './pages/caretaker/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminLayout from './layouts/AdminLayout';
import CaretakerLayout from './layouts/CaretakerLayout';

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
        <Route path="disease-reports" element={<DiseaseReportsPage />} />
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
        <Route path="my-pond" element={<MyPondPage />} />
        <Route path="disease-scan" element={<DiseaseScanPage />} />
        <Route path="feeding-history" element={<FeedingHistoryPage />} />
        <Route path="reports" element={<CaretakerReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
