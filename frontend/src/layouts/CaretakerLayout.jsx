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
  FaSignOutAlt,
  FaSeedling,
  FaSlidersH,
  FaCalendarAlt,
  FaClock,
  FaBell,
  FaCheckDouble,
  FaInfoCircle
} from 'react-icons/fa';
import CaretakerAssistantChatHead from '../components/CaretakerAssistantChatHead';

const links = [
  { 
    to: '/caretaker/dashboard', 
    label: 'Dashboard', 
    kicker: 'CARETAKER CONSOLE',
    description: 'Monitor today\'s feeding logs, schedule completion, disease scans, and active pond alerts.', 
    icon: <FaTachometerAlt /> 
  },
  { 
    to: '/caretaker/my-pond', 
    label: 'My Pond', 
    kicker: 'CARETAKER CONSOLE',
    description: 'Track water quality, log feeding schedules, and manage your assigned ponds.', 
    icon: <FaWater /> 
  },
  { 
    to: '/caretaker/disease-scan', 
    label: 'Disease Scan', 
    kicker: 'CARETAKER CONSOLE',
    description: 'Scan shrimp for WSSV and health risks using AI computer vision.', 
    icon: <FaVirus /> 
  },
  { 
    to: '/caretaker/feeding-history', 
    label: 'Feeding History', 
    kicker: 'CARETAKER FEEDING RECORDS',
    description: 'Review feed consumption, vitamins, product type, and pond activity logs.', 
    icon: <FaUtensils /> 
  },
  { 
    to: '/caretaker/reports', 
    label: 'Pond Issue Reports', 
    kicker: 'MAINTENANCE REPORTING',
    description: 'Send clear pond issues, equipment concerns, photos, and videos directly to farm administrators.', 
    icon: <FaFileAlt /> 
  },
  { 
    to: '/caretaker/notifications', 
    label: 'Notifications', 
    kicker: 'CARETAKER CONSOLE',
    description: 'Admin responses and status updates for your submitted pond reports.', 
    icon: <FaBell /> 
  },
  { 
    to: '/caretaker/settings', 
    label: 'Account Settings', 
    kicker: 'CARETAKER CONSOLE',
    description: 'Manage your caretaker profile, pond preferences, notification alerts, and security options.', 
    icon: <FaSlidersH /> 
  },
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
    if (notif.action_type === 'report_update' || (notif.title || '').includes('Report')) {
      navigate('/caretaker/reports');
    } else {
      navigate('/caretaker/notifications');
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
          <small>Caretaker</small>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span className="position-relative">
                {link.icon}
                {link.to === '/caretaker/notifications' && unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style={{ width: 8, height: 8 }} />
                )}
              </span>
              {link.label}
              {link.to === '/caretaker/notifications' && unreadCount > 0 && (
                <span className="badge bg-danger rounded-pill ms-auto extra-small shadow-xs px-2 py-1 fw-bold">
                  {unreadCount}
                </span>
              )}
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
          <small>Caretaker</small>
        </div>
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span className="position-relative">
                {link.icon}
                {link.to === '/caretaker/notifications' && unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style={{ width: 8, height: 8 }} />
                )}
              </span>
              {link.label}
              {link.to === '/caretaker/notifications' && unreadCount > 0 && (
                <span className="badge bg-danger rounded-pill ms-auto extra-small shadow-xs px-2 py-1 fw-bold">
                  {unreadCount}
                </span>
              )}
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
      <main className="dashboard-main flex-grow-1 p-3 p-md-4">
        {/* TOP HERO HEADER BANNER (EXACT SAME DESIGN AS ADMIN HEADER) */}
        <div className="site-header caretaker-topbar caretaker-dashboard-hero mb-4">
          <div className="flex-grow-1 me-3" style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center gap-2 d-lg-none mb-3">
              <button
                type="button"
                className="btn btn-sm btn-light rounded-circle p-2 d-flex align-items-center justify-content-center"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
                style={{ width: 36, height: 36 }}
              >
                <FaBars />
              </button>
              <div className="admin-brand mb-0 text-white fw-bold d-flex align-items-center gap-2">
                <span className="brand-icon"><FaSeedling /></span>
                <span>ShrimPredict</span>
              </div>
            </div>
            <span className="caretaker-dashboard-kicker">{currentPage.kicker || 'CARETAKER CONSOLE'}</span>
            <h3 className="fw-bold mb-1 text-white text-truncate">{currentPage.label}</h3>
            <p className="mb-0 text-white-75 small">{currentPage.description}</p>
          </div>

          {/* TOPBAR ACTION WIDGETS: DATE, REAL-TIME CLOCK, NOTIFICATION BELL BUTTON */}
          <div className="admin-actions d-flex align-items-center flex-nowrap gap-2.5 flex-shrink-0 ms-auto">
            {/* 1. Date Card Pill */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill d-flex align-items-center text-dark flex-shrink-0"
              style={{ width: 205, height: 44, padding: '0 1.15rem', gap: '0.65rem' }}
              title="Today's Date"
            >
              <div
                className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 28, height: 28 }}
              >
                <FaCalendarAlt size={13} />
              </div>
              <span className="extra-small fw-bold text-dark text-nowrap" style={{ fontSize: '0.85rem', letterSpacing: '0.1px' }}>
                {formattedDate}
              </span>
            </div>

            {/* 2. Real-Time Ticking Clock Card Pill (Steady fixed digit widths) */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill d-flex align-items-center text-dark flex-shrink-0"
              style={{ width: 175, height: 44, padding: '0 1.15rem', gap: '0.65rem' }}
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

            {/* 3. Notification Bell Icon Button */}
            <div className="position-relative flex-shrink-0" ref={bellRef}>
              <button
                type="button"
                className="btn bg-white border border-secondary border-opacity-25 shadow-sm rounded-circle d-flex align-items-center justify-content-center position-relative transition-all hover-shadow p-0 flex-shrink-0"
                style={{ width: 44, height: 44 }}
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                title="Notifications"
              >
                <div
                  className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32 }}
                >
                  <FaBell size={15} />
                </div>
                {unreadCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
                    style={{ fontSize: '0.65rem' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATION POPOVER DROPDOWN MENU */}
              {showNotifMenu && (
                <div
                  className="dropdown-menu show shadow-2xl border border-primary border-opacity-25 position-absolute end-0 mt-3 p-0 rounded-4 overflow-hidden bg-white"
                  style={{ width: 410, zIndex: 1060, boxShadow: '0 25px 50px rgba(11, 44, 95, 0.25)' }}
                >
                  {/* Header with Generous Padding */}
                  <div
                    className="p-4 px-4.5 text-white d-flex align-items-center justify-content-between"
                    style={{ background: 'linear-gradient(135deg, #0b2c5f 0%, #1e40af 100%)' }}
                  >
                    <div className="d-flex align-items-center gap-2.5">
                      <FaBell size={18} className="text-warning" />
                      <span className="fw-bold fs-6">Admin Updates</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-white text-primary rounded-pill px-3 py-1.5 extra-small fw-bold shadow-xs">
                        {unreadCount} New
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-xs btn-link text-white text-decoration-none extra-small p-0 opacity-90 hover-opacity-100 ms-1"
                          onClick={handleMarkAllRead}
                          title="Mark all as read"
                        >
                          <FaCheckDouble size={13} className="me-1" /> Read All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Notifications List */}
                  <div className="list-group list-group-flush" style={{ maxHeight: 350, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-muted small">
                        <FaBell size={28} className="mb-2 opacity-30 text-primary" />
                        <p className="mb-0 fw-semibold">No new notifications</p>
                        <small className="extra-small text-muted">All farm updates are up to date.</small>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`list-group-item p-4 px-4.5 small list-group-item-action cursor-pointer transition-all border-bottom ${
                            !n.is_read ? 'bg-light bg-opacity-75 fw-semibold border-start border-primary border-4' : ''
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="d-flex justify-content-between align-items-start mb-2 gap-3">
                            <span className="fw-bold text-dark fs-6 d-flex flex-wrap align-items-center gap-2" style={{ lineHeight: 1.35 }}>
                              {n.title}
                            </span>
                            <span className="text-muted extra-small font-mono flex-shrink-0 pt-0.5">
                              {new Date(n.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-secondary mb-2 extra-small" style={{ lineHeight: 1.55 }}>
                            {n.message}
                          </p>
                          <span className="text-primary fw-bold extra-small d-inline-flex align-items-center gap-1.5">
                            View Details →
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3.5 bg-light text-center border-top">
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-decoration-none fw-semibold p-0 text-primary extra-small"
                      onClick={() => {
                        setShowNotifMenu(false);
                        navigate('/caretaker/notifications');
                      }}
                    >
                      View All System Notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <Outlet />
        </div>
      </main>
      <CaretakerAssistantChatHead />
    </div>
  );
}

