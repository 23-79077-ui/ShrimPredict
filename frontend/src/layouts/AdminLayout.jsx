import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaTachometerAlt, FaVirus, FaWater, FaUtensils, FaChartLine, FaUsers, FaBell, FaFileAlt, FaCog, FaSignOutAlt, FaSeedling } from 'react-icons/fa';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', description: 'Overview of ponds, alerts, and predictions.', icon: <FaTachometerAlt /> },
  { to: '/admin/disease-reports', label: 'Disease Reports', description: 'Review scan results and disease risk.', icon: <FaVirus /> },
  { to: '/admin/ponds', label: 'Pond Monitoring', description: 'Track water quality and pond status.', icon: <FaWater /> },
  { to: '/admin/feeding', label: 'Feeding Consumption', description: 'Monitor feed usage and schedules.', icon: <FaUtensils /> },
  { to: '/admin/harvest', label: 'Harvest Prediction', description: 'Forecast readiness and expected yield.', icon: <FaChartLine /> },
  { to: '/admin/users', label: 'Users', description: 'Manage admin and caretaker accounts.', icon: <FaUsers /> },
  { to: '/admin/alerts', label: 'Alerts', description: 'Prioritize farm notices and warnings.', icon: <FaBell /> },
  { to: '/admin/reports', label: 'Reports', description: 'Analyze farm summaries and exports.', icon: <FaFileAlt /> },
  { to: '/admin/settings', label: 'Settings', description: 'Configure system preferences.', icon: <FaCog /> },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = links.find((link) => location.pathname.startsWith(link.to)) || links[0];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell admin-shell">
      <aside className="layout-aside d-none d-lg-flex flex-column">
        <div className="admin-brand mb-4">
          <span className="brand-icon"><FaSeedling /></span>
          <span>ShrimPredict</span>
        </div>
        <div className="admin-profile mb-4">
          <div className="admin-avatar">{(user?.full_name || 'Admin').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="fw-semibold">{user?.full_name || 'Administrator'}</div>
            <small>Admin access</small>
          </div>
        </div>
        <nav className="admin-sidebar-nav flex-grow-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
              <span className="admin-nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-outline-light w-100 admin-logout" onClick={handleLogout}>
            <FaSignOutAlt className="me-2" />Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="site-header admin-topbar d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
          <div>
            <div className="admin-brand d-flex d-lg-none mb-3">
              <span className="brand-icon"><FaSeedling /></span>
              <span>ShrimPredict</span>
            </div>
            <div className="eyebrow admin-eyebrow mb-2">Admin Console</div>
            <h1 className="admin-page-title mb-1">{currentPage.label}</h1>
            <p className="text-muted mb-0">{currentPage.description}</p>
          </div>
          <div className="admin-actions d-flex gap-2 align-items-center flex-wrap">
            <button className="btn btn-outline-primary btn-sm">New Report</button>
            <button className="btn btn-primary btn-sm">Manage Ponds</button>
          </div>
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
