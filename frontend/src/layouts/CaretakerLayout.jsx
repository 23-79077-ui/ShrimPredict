import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaBars, FaTachometerAlt, FaTimes, FaWater, FaVirus, FaUtensils, FaFileAlt, FaUser, FaSignOutAlt, FaSeedling } from 'react-icons/fa';
import CaretakerAssistantChatHead from '../components/CaretakerAssistantChatHead';

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
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = links.find((link) => location.pathname.startsWith(link.to)) || links[0];

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

  const closeMenu = () => setMenuOpen(false);
  const initials = (user?.full_name || 'Caretaker')
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

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

      {menuOpen && <button type="button" className="caretaker-mobile-backdrop d-lg-none" aria-label="Close menu" onClick={closeMenu} />}
      <aside className={`caretaker-mobile-menu d-lg-none ${menuOpen ? 'open' : ''}`}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="brand mb-0">
            <span className="brand-icon"><FaSeedling /></span>
            ShrimPredict
          </div>
          <button type="button" className="btn btn-sm btn-light rounded-circle" aria-label="Close menu" onClick={closeMenu}>
            <FaTimes />
          </button>
        </div>
        <div className="mb-4 text-white-75">
          <div className="fw-semibold">{user?.full_name || 'Caretaker'}</div>
          <small>Field operator</small>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMenu}
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
        <div className="caretaker-mobile-topbar d-lg-none">
          <button type="button" className="btn btn-primary rounded-circle mobile-menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <FaBars />
          </button>
          <div>
            <div className="small text-muted">Caretaker Console</div>
            <h1 className="mb-0">{currentPage.label}</h1>
          </div>
        </div>

        <div className="dashboard-header d-flex align-items-center justify-content-between">
          <div className="header-left">
            <h1 className="mb-2">Caretaker Console</h1>
            <p className="text-muted mb-0">Fast access to scan, monitor, and manage your assigned ponds.</p>
          </div>
          <div className="profile-chip d-flex align-items-center gap-2 p-2 px-3 rounded-pill bg-white border shadow-sm">
            {user?.avatar_path ? (
              <img src={user.avatar_path} alt="Caretaker avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <span className="caretaker-avatar-fallback small">{initials}</span>
            )}
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
      <CaretakerAssistantChatHead />
    </div>
  );
}
