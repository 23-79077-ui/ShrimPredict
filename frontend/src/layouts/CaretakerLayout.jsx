import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaTachometerAlt, FaWater, FaVirus, FaUtensils, FaFileAlt, FaUser, FaSignOutAlt, FaSeedling } from 'react-icons/fa';

const links = [
  { to: '/caretaker/dashboard', label: 'Dashboard', icon: <FaTachometerAlt /> },
  { to: '/caretaker/my-pond', label: 'My Pond', icon: <FaWater /> },
  { to: '/caretaker/disease-scan', label: 'Disease Scan', icon: <FaVirus /> },
  { to: '/caretaker/feeding-history', label: 'Feeding History', icon: <FaUtensils /> },
  { to: '/caretaker/reports', label: 'Reports', icon: <FaFileAlt /> },
  { to: '/caretaker/profile', label: 'Profile', icon: <FaUser /> },
];

export default function CaretakerLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    try {
      logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="app-shell caretaker-shell d-flex">
      <aside className="dashboard-sidebar d-none d-lg-flex flex-column">
        <div className="brand mb-5">
          <span className="brand-icon"><FaSeedling /></span>
          ShrimPredict
        </div>
        <div className="mb-5 text-white-75">
          <div className="fw-semibold">{user?.full_name || 'Caretaker'}</div>
          <small>Field operator</small>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="btn btn-outline-light w-100" onClick={handleLogout}>
            <FaSignOutAlt className="me-2" />Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-header d-flex align-items-center justify-content-between">
          <div className="header-left">
            <h1 className="mb-2">Caretaker Console</h1>
            <p className="text-muted mb-0">Fast access to scan, monitor, and manage your assigned ponds.</p>
          </div>
          <div className="profile-chip d-flex align-items-center gap-2 p-2 px-3 rounded-pill bg-white border shadow-sm">
            <img src="https://i.pravatar.cc/100?img=47" alt="Caretaker avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <div>
              <div className="fw-semibold text-dark small mb-0">{user?.full_name || 'Field Staff'}</div>
              <small className="text-muted extra-small">Caretaker access</small>
            </div>
          </div>
        </div>
        <div className="glass-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
