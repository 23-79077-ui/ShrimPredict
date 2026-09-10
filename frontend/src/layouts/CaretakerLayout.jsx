import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FaSignOutAlt,
  FaClock,
  FaCheckDouble,
  FaSun,
  FaMoon,
  FaBell,
  FaBars,
  FaTimes,
  FaShieldAlt,
} from 'react-icons/fa';
import CaretakerAssistantChatHead from '../components/CaretakerAssistantChatHead';

// Minimalist vector icons for the Floating Top Dock Tabs
const dockIcons = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  myPond: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20" />
      <path d="M2 17c3 0 4-1 6-1s3 1 6 1 3-1 6-1" />
      <path d="M12 4a3 3 0 0 0-3 3c0 2 3 5 3 5s3-3 3-5a3 3 0 0 0-3-3z" />
    </svg>
  ),
  diseaseScan: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  ),
  feedingHistory: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  reports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  ),
  notifications: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

// Navigation Links for the Floating Top Dock
const dockLinks = [
  { to: '/caretaker/dashboard', label: 'Dashboard', icon: dockIcons.dashboard },
  { to: '/caretaker/my-pond', label: 'My Pond', icon: dockIcons.myPond },
  { to: '/caretaker/disease-scan', label: 'Disease Scan', icon: dockIcons.diseaseScan },
  { to: '/caretaker/feeding-history', label: 'Feeding History', icon: dockIcons.feedingHistory },
  { to: '/caretaker/reports', label: 'Issue Reports', icon: dockIcons.reports },
  { to: '/caretaker/notifications', label: 'Notifications', icon: dockIcons.notifications },
  { to: '/caretaker/settings', label: 'Settings', icon: dockIcons.settings },
];

export default function CaretakerLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => localStorage.getItem('shrim_theme') || 'light');
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const bellRef = useRef(null);
  const userRef = useRef(null);

  // Real-Time System Clock Timer State
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('shrim_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.setAttribute('data-bs-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
    window.dispatchEvent(new CustomEvent('shrim-theme-changed', { detail: { theme: nextTheme } }));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const clockDigits = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const fetchUnreadNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/notifications.php?user_id=${user.id}&status=active`);
      if (res.data?.success) {
        setUnreadCount(res.data.counts?.unread || 0);
        setRecentNotifs((res.data.notifications || []).slice(0, 6));
      }
    } catch (e) {
      // Silently catch fetch errors
    }
  };

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 5000);
    const handleUpdate = () => fetchUnreadNotifications();

    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    try {
      logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications.php', { action: 'mark_all_read' });
      fetchUnreadNotifications();
    } catch (e) {
      console.error('Error marking all read:', e);
    }
  };

  const handleNotifClick = async (notif) => {
    setShowNotifMenu(false);
    try {
      if (!notif.is_read) {
        await api.post('/notifications.php', { action: 'mark_read', id: notif.id });
        fetchUnreadNotifications();
      }
    } catch (e) {
      console.error('Error marking read:', e);
    }

    const actionType = (notif.action_type || '').toLowerCase();
    const title = (notif.title || '').toLowerCase();

    if (actionType === 'report_update' || title.includes('report')) {
      navigate('/caretaker/reports');
    } else {
      navigate('/caretaker/notifications');
    }
  };

  return (
    <div className="saas-layout-canvas">
      {/* 🌟 FLOATING TOP NAVIGATION DOCK BAR (Exact match with Admin Portal) */}
      <header className="top-dock-bar d-flex align-items-center justify-content-between flex-wrap gap-2">
        {/* 1. Brand Logo & Emblem */}
        <div className="d-flex align-items-center gap-2.5 flex-shrink-0">
          <NavLink to="/caretaker/dashboard" className="d-flex align-items-center gap-2.5 text-decoration-none">
            <img
              src="/ob_aquafarm_logo.png"
              alt="O & B Aquafarm Logo"
              className="rounded-circle flex-shrink-0 shadow-sm"
              style={{
                width: '42px',
                height: '42px',
                objectFit: 'contain',
                backgroundColor: '#FFFFFF',
                padding: '1.5px',
                border: '1.5px solid rgba(255, 122, 0, 0.4)'
              }}
            />
            <div>
              <span className="fw-extrabold text-dark tracking-tight d-block" style={{ fontSize: '1.15rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Shrimp<span style={{ color: '#FF7B38' }}>Predict</span>
              </span>
              <span className="d-block text-muted" style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, marginTop: 2 }}>
                O & B AQUAFARM
              </span>
            </div>
          </NavLink>

          <span
            className="badge rounded-pill extra-small fw-semibold d-none d-xl-inline-block"
            style={{
              backgroundColor: 'rgba(255, 122, 0, 0.08)',
              color: '#FF7A00',
              border: '1px solid rgba(255, 122, 0, 0.25)',
              fontSize: '0.68rem',
              letterSpacing: '0.04em'
            }}
          >
            CARETAKER OS
          </span>
        </div>

        {/* 2. Floating Dock Navigation Tabs */}
        <nav className="d-none d-lg-flex align-items-center gap-1 flex-wrap">
          {dockLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `dock-nav-pill ${isActive ? 'active' : ''}`}
            >
              <span className="opacity-80">{link.icon}</span>
              <span>{link.label}</span>
              {link.to === '/caretaker/notifications' && unreadCount > 0 && (
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: '#F43F5E',
                    color: '#FFFFFF',
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.45rem'
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 3. Utility Controls Cluster (Clock, Theme, Notifications, User) */}
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {/* Real-time Clock & Date Pill */}
          <div
            className="d-none d-sm-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-light border text-muted extra-small"
            style={{ height: 36, fontSize: '0.78rem' }}
          >
            <FaClock size={11} style={{ color: '#0284C7' }} />
            <span className="fw-bold text-dark font-mono">{clockDigits}</span>
            <span className="opacity-40">•</span>
            <span className="fw-semibold">{formattedDate}</span>
          </div>

          {/* Theme Toggle Pill */}
          <button
            type="button"
            className="btn btn-light border rounded-pill d-flex align-items-center justify-content-center p-0"
            style={{ width: 36, height: 36 }}
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <FaSun size={13} className="text-warning" /> : <FaMoon size={12} className="text-muted" />}
          </button>

          {/* Notifications Dropdown Pill */}
          <div className="position-relative" ref={bellRef}>
            <button
              type="button"
              className="btn btn-light border rounded-pill position-relative d-flex align-items-center justify-content-center p-0"
              style={{ width: 36, height: 36 }}
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              title="Caretaker Notifications"
            >
              <FaBell size={13} className="text-muted" />
              {unreadCount > 0 && (
                <span
                  className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light p-1"
                  style={{ fontSize: '0.6rem' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div
                className="dropdown-menu show border-0 position-absolute end-0 mt-2 p-0 rounded-4 shadow-xl overflow-hidden"
                style={{
                  width: '340px',
                  zIndex: 1050,
                  backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0'
                }}
              >
                <div
                  className="p-3 px-3.5 d-flex align-items-center justify-content-between text-white"
                  style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 55%, #FF7A00 100%)' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <FaBell size={13} />
                    <span className="fw-bold small">Caretaker Updates</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-white text-dark rounded-pill extra-small px-2 py-0.5">
                      {unreadCount} Active
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-link text-white text-decoration-none extra-small p-0 opacity-80 hover-opacity-100"
                        onClick={handleMarkAllRead}
                      >
                        <FaCheckDouble size={10} className="me-1" /> Mark read
                      </button>
                    )}
                  </div>
                </div>

                <div className="list-group list-group-flush" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {recentNotifs.length === 0 ? (
                    <div className="p-4 text-center text-muted small">
                      <FaBell size={22} className="mb-2 opacity-25" />
                      <p className="mb-0 fw-semibold">No critical alerts</p>
                      <small className="extra-small text-muted">All assigned ponds and tasks are in order.</small>
                    </div>
                  ) : (
                    recentNotifs.map((n) => (
                      <div
                        key={n.id}
                        className="list-group-item p-3 px-3.5 small list-group-item-action cursor-pointer transition-all border-bottom"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: !n.is_read ? (theme === 'dark' ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF') : 'transparent',
                          color: theme === 'dark' ? '#F8FAFC' : '#10294A',
                          borderLeft: !n.is_read ? '3.5px solid #FF7A00' : '3.5px solid transparent'
                        }}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1 gap-2">
                          <span className="fw-bold extra-small text-truncate">
                            {n.title}
                          </span>
                          <span className="text-muted extra-small font-mono flex-shrink-0">
                            {new Date(n.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-muted mb-1 extra-small" style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        <span className="fw-bold extra-small" style={{ color: '#FF7A00', fontSize: '0.72rem' }}>
                          View Details →
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 text-center border-top bg-light">
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none fw-semibold p-0 extra-small"
                    style={{ color: '#0284C7' }}
                    onClick={() => {
                      setShowNotifMenu(false);
                      navigate('/caretaker/notifications');
                    }}
                  >
                    All Caretaker Notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown */}
          <div className="position-relative" ref={userRef}>
            <button
              type="button"
              className="btn btn-light border rounded-pill d-flex align-items-center gap-1.5 p-1 ps-1.5 pe-2"
              style={{ height: 36 }}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div
                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                style={{
                  width: 26,
                  height: 26,
                  fontSize: '0.72rem',
                  background: 'linear-gradient(135deg, #FF7A00 0%, #0B2C5F 100%)'
                }}
              >
                {(user?.full_name || 'Caretaker').slice(0, 2).toUpperCase()}
              </div>
              <span className="fw-semibold small text-dark d-none d-md-inline" style={{ fontSize: '0.78rem' }}>
                {user?.full_name || 'Caretaker'}
              </span>
            </button>

            {showUserMenu && (
              <div
                className="dropdown-menu show border-0 position-absolute end-0 mt-2 p-2 rounded-3 shadow-lg"
                style={{
                  width: 200,
                  zIndex: 1060,
                  backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0'
                }}
              >
                <div className="px-2 py-1.5 border-bottom mb-1">
                  <div className="fw-bold small text-truncate">{user?.full_name || 'Caretaker'}</div>
                  <div className="extra-small text-muted">{user?.email || 'caretaker@shrimpredict.io'}</div>
                </div>
                <NavLink to="/caretaker/settings" className="dropdown-item rounded-2 small py-1.5" onClick={() => setShowUserMenu(false)}>
                  Account Settings
                </NavLink>
                <button
                  type="button"
                  className="dropdown-item rounded-2 small py-1.5 text-danger d-flex align-items-center gap-2"
                  onClick={handleLogout}
                >
                  <FaSignOutAlt size={12} /> Log Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Navigation Toggle */}
          <button
            type="button"
            className="btn btn-light border rounded-pill d-flex d-lg-none align-items-center justify-content-center p-0"
            style={{ width: 36, height: 36 }}
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            {showMobileNav ? <FaTimes size={14} /> : <FaBars size={14} />}
          </button>
        </div>

        {/* Mobile Dropdown Navigation */}
        {showMobileNav && (
          <div className="w-100 d-lg-none pt-2 pb-1 border-top mt-2">
            <div className="d-flex flex-wrap gap-1">
              {dockLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `dock-nav-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setShowMobileNav(false)}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 🌟 MAIN PAGE CONTENT (Max Width 1480px, Spacious Padding) */}
      <main className="container-fluid px-3 px-md-4 pb-5" style={{ maxWidth: 1480, margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* Floating Caretaker AI Assistant */}
      <CaretakerAssistantChatHead />
    </div>
  );
}
