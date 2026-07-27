import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FaBars,
  FaTachometerAlt,
  FaTimes,
  FaWater,
  FaVirus,
  FaUtensils,
  FaFileAlt,
  FaUser,
  FaSignOutAlt,
  FaSeedling,
  FaSlidersH,
  FaCalendarAlt,
  FaClock,
  FaBell,
  FaCheckDouble,
  FaCheckCircle,
  FaInfoCircle
} from 'react-icons/fa';
import CaretakerAssistantChatHead from '../components/CaretakerAssistantChatHead';

const links = [
  { to: '/caretaker/dashboard', label: 'Dashboard', icon: <FaTachometerAlt /> },
  { to: '/caretaker/my-pond', label: 'My Pond', icon: <FaWater /> },
  { to: '/caretaker/disease-scan', label: 'Disease Scan', icon: <FaVirus /> },
  { to: '/caretaker/feeding-history', label: 'Feeding History', icon: <FaUtensils /> },
  { to: '/caretaker/reports', label: 'Reports', icon: <FaFileAlt /> },
  { to: '/caretaker/notifications', label: 'Notifications', icon: <FaBell /> },
  { to: '/caretaker/settings', label: 'Settings', icon: <FaSlidersH /> },
];

export default function CaretakerLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = links.find((link) => location.pathname.startsWith(link.to)) || links[0];

  // Notification & Clock State
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const bellRef = useRef(null);

  // Real-Time System Clock Timer State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const clockDigits = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).replace(/\s*(AM|PM)$/i, '');

  const clockAmPm = currentTime.getHours() >= 12 ? 'PM' : 'AM';

  // Fetch live notifications for current caretaker
  const fetchCaretakerNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/notifications.php?user_id=${user.id}`);
      if (res.data?.success) {
        setUnreadCount(res.data.counts?.unread || 0);
        setNotifications(res.data.notifications || []);
      }
    } catch (e) {
      // Silently handle fetch error
    }
  };

  useEffect(() => {
    fetchCaretakerNotifications();
    const interval = setInterval(fetchCaretakerNotifications, 4000);
    const handleUpdate = () => fetchCaretakerNotifications();

    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('shrim-report-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('shrim-report-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications.php', { action: 'mark_all_read' });
      fetchCaretakerNotifications();
    } catch (e) {
      console.error('Error marking read:', e);
    }
  };

  const handleNotifClick = async (notif) => {
    setShowNotifMenu(false);
    try {
      if (!notif.is_read) {
        await api.post('/notifications.php', { action: 'mark_read', id: notif.id });
        fetchCaretakerNotifications();
      }
    } catch (e) {
      console.error('Error marking read:', e);
    }

    // Navigate to Reports if report update notification
    if (notif.action_type === 'report_update' || notif.title.includes('Report')) {
      navigate('/caretaker/reports');
    }
  };

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
      {/* DESKTOP SIDEBAR */}
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

      {/* MOBILE MENU BACKDROP & SIDEBAR */}
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

      {/* MAIN CONTENT AREA */}
      <main className="dashboard-main">
        {/* MOBILE TOPBAR */}
        <div className="caretaker-mobile-topbar d-lg-none">
          <button type="button" className="btn btn-primary rounded-circle mobile-menu-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <FaBars />
          </button>
          <div>
            <div className="small text-muted">Caretaker Console</div>
            <h1 className="mb-0">{currentPage.label}</h1>
          </div>
        </div>

        {/* HEADER BAR (DATE, CLOCK, NOTIFICATIONS, PROFILE CHIP - SAME AS ADMIN) */}
        <div className="dashboard-header d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 mb-4">
          <div className="header-left">
            {/* Clean top header area without redundant Caretaker Console text */}
          </div>

          {/* TOPBAR ACTION WIDGETS: DATE, REAL-TIME CLOCK, NOTIFICATION BELL, PROFILE CHIP */}
          <div className="d-flex align-items-center flex-wrap gap-2.5 ms-auto">
            {/* 1. Date Card */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill d-flex align-items-center text-dark"
              style={{ width: 205, height: 44, padding: '0 1.15rem', gap: '0.65rem', flexShrink: 0 }}
              title="Today's Date"
            >
              <div
                className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 28, height: 28 }}
              >
                <FaCalendarAlt size={13} />
              </div>
              <span className="extra-small fw-bold text-dark text-nowrap" style={{ fontSize: '0.82rem' }}>
                {formattedDate}
              </span>
            </div>

            {/* 2. Real-Time Ticking Clock Card */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill d-flex align-items-center text-dark"
              style={{ width: 175, height: 44, padding: '0 1.15rem', gap: '0.65rem', flexShrink: 0 }}
              title="Real-Time System Clock"
            >
              <div
                className="rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 28, height: 28 }}
              >
                <FaClock size={13} />
              </div>
              <div className="d-flex align-items-center extra-small fw-bold text-dark text-nowrap" style={{ fontSize: '0.85rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 68,
                    fontVariantNumeric: 'tabular-nums',
                    fontFeatureSettings: '"tnum"',
                    letterSpacing: '0.2px'
                  }}
                >
                  {clockDigits}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 24,
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#0b2c5f'
                  }}
                >
                  {clockAmPm}
                </span>
              </div>
            </div>

            {/* 3. Notification Bell Icon Button with Dropdown */}
            <div className="position-relative" ref={bellRef}>
              <button
                type="button"
                className="btn btn-white border border-secondary border-opacity-25 shadow-sm rounded-circle d-flex align-items-center justify-content-center position-relative p-0"
                style={{ width: 44, height: 44 }}
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                title="Notifications"
              >
                <FaBell className="text-secondary fs-5" />
                {unreadCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-danger border border-2 border-white d-flex align-items-center justify-content-center"
                    style={{ width: 20, height: 20, fontSize: '0.7rem' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATION DROPDOWN MENU */}
              {showNotifMenu && (
                <div
                  className="position-absolute end-0 mt-2 bg-white border border-slate-200 rounded-4 shadow-2xl p-0 overflow-hidden z-3"
                  style={{ width: 350, zIndex: 1050 }}
                >
                  <div className="p-3 bg-primary text-white d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <FaBell />
                      <h6 className="fw-bold mb-0 text-white fs-6">Admin Responses & Updates</h6>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-light rounded-pill extra-small px-2 py-0.5"
                        onClick={handleMarkAllRead}
                      >
                        <FaCheckDouble className="me-1" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: 320 }}>
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-muted">
                        <FaInfoCircle size={24} className="mb-2 opacity-50" />
                        <p className="small mb-0">No admin responses yet for your reported issues.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 8).map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          className={`list-group-item list-group-item-action p-3 text-start border-bottom transition-all ${
                            !notif.is_read ? 'bg-primary bg-opacity-10' : 'bg-white'
                          }`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <div className="d-flex align-items-start justify-content-between mb-1">
                            <h6 className={`mb-0 small ${!notif.is_read ? 'fw-extrabold text-primary' : 'fw-bold text-dark'}`}>
                              {notif.title}
                            </h6>
                            {!notif.is_read && (
                              <span className="badge bg-primary rounded-circle p-1" style={{ width: 8, height: 8 }}></span>
                            )}
                          </div>
                          <p className="text-secondary extra-small mb-1" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                            {notif.message}
                          </p>
                          <span className="text-muted extra-small font-mono" style={{ fontSize: '0.72rem' }}>
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Profile Chip */}
            <div className="profile-chip d-flex align-items-center gap-2 p-1.5 px-3 rounded-pill bg-white border shadow-sm" style={{ height: 44 }}>
              {user?.avatar_path ? (
                <img src={user.avatar_path} alt="Caretaker avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span className="caretaker-avatar-fallback small">{initials}</span>
              )}
              <div>
                <div className="fw-semibold text-dark small mb-0 lh-1">{user?.full_name || 'Field Staff'}</div>
                <small className="text-muted extra-small" style={{ fontSize: '0.7rem' }}>Caretaker</small>
              </div>
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
