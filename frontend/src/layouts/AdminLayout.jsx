import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FaTachometerAlt,
  FaVirus,
  FaWater,
  FaUtensils,
  FaChartLine,
  FaUsers,
  FaBell,
  FaFileAlt,
  FaCog,
  FaSignOutAlt,
  FaSeedling,
  FaCalendarAlt,
  FaClock,
  FaCheckDouble
} from 'react-icons/fa';

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', description: 'Overview of ponds, alerts, and predictions.', icon: <FaTachometerAlt /> },
  { to: '/admin/notifications', label: 'Notifications', description: 'Caretaker records and system alerts.', icon: <FaBell /> },
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

  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
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

  const realTimeClock = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/notifications.php?status=active');
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
    const interval = setInterval(fetchUnreadNotifications, 4000);
    const handleUpdate = () => fetchUnreadNotifications();

    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Mark all as read handler
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications.php', { action: 'mark_all_read' });
      fetchUnreadNotifications();
    } catch (e) {
      console.error('Error marking all read:', e);
    }
  };

  // Notification Click Handler: Mark read and navigate to target page
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
    const msg = (notif.message || '').toLowerCase();

    if (actionType === 'feeding' || title.includes('feed') || msg.includes('feed')) {
      navigate('/admin/feeding');
    } else if (actionType === 'disease_scan' || title.includes('disease') || msg.includes('scanned for disease')) {
      navigate('/admin/disease-reports');
    } else if (actionType === 'water_quality' || (title.includes('pond') && !title.includes('report')) || (msg.includes('pond') && !msg.includes('report'))) {
      navigate('/admin/ponds');
    } else {
      // Maintenance / Reports / General -> /admin/reports
      navigate('/admin/reports');
    }
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
              <span className="admin-nav-icon position-relative">
                {link.icon}
                {link.to === '/admin/notifications' && unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style={{ width: 8, height: 8 }}></span>
                )}
              </span>
              <span>{link.label}</span>
              {link.to === '/admin/notifications' && unreadCount > 0 && (
                <span className="badge bg-danger ms-auto rounded-pill" style={{ fontSize: '0.7rem' }}>{unreadCount}</span>
              )}
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
          
          {/* 🌟 100% PERFECT SPACIOUS VERTICAL HEADER STACK (260px FIXED WIDTH, 18px INLINE GAP) */}
          <div className="admin-actions d-flex flex-column align-items-end gap-2.5">
            {/* 1. Date Card */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill w-100 d-flex align-items-center justify-content-between px-4 py-2 text-dark"
              style={{ width: 260, height: 48, boxShadow: '0 4px 14px rgba(11,44,95,0.06)' }}
              title="Today's Date"
            >
              <div className="d-flex align-items-center" style={{ gap: 18 }}>
                <div
                  className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 34, height: 34, minWidth: 34 }}
                >
                  <FaCalendarAlt size={14} />
                </div>
                <span className="extra-small fw-bold text-dark text-truncate" style={{ fontSize: '0.88rem', letterSpacing: '0.2px' }}>
                  {formattedDate}
                </span>
              </div>
            </div>

            {/* 2. Real-Time Ticking Clock Card */}
            <div
              className="bg-white border border-secondary border-opacity-25 shadow-sm rounded-pill w-100 d-flex align-items-center justify-content-between px-4 py-2 text-dark font-mono"
              style={{ width: 260, height: 48, fontVariantNumeric: 'tabular-nums', boxShadow: '0 4px 14px rgba(11,44,95,0.06)' }}
              title="Real-Time System Clock"
            >
              <div className="d-flex align-items-center" style={{ gap: 18 }}>
                <div
                  className="rounded-circle bg-info bg-opacity-10 text-info d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 34, height: 34, minWidth: 34 }}
                >
                  <FaClock size={14} />
                </div>
                <span className="extra-small fw-bold text-dark" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                  {realTimeClock}
                </span>
              </div>
            </div>

            {/* 3. Notifications Pill Card */}
            <div className="position-relative" ref={bellRef} style={{ width: 260 }}>
              <button
                type="button"
                className="btn btn-white border border-secondary border-opacity-25 shadow-sm rounded-pill w-100 d-flex align-items-center justify-content-between px-4 py-2 transition-all hover-shadow text-dark"
                style={{ height: 48, boxShadow: '0 4px 14px rgba(11,44,95,0.06)' }}
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                title="Notifications"
              >
                <div className="d-flex align-items-center" style={{ gap: 18 }}>
                  <div
                    className="rounded-circle bg-warning bg-opacity-20 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 34, height: 34, minWidth: 34 }}
                  >
                    <FaBell className={unreadCount > 0 ? 'text-warning' : 'text-muted'} size={14} />
                  </div>
                  <span className="extra-small fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                    Notifications
                  </span>
                </div>

                {unreadCount > 0 ? (
                  <span className="badge rounded-pill bg-danger shadow-xs px-2.5 py-1" style={{ fontSize: '0.74rem' }}>
                    {unreadCount}
                  </span>
                ) : (
                  <span className="badge rounded-pill bg-light text-muted border px-2 py-1 extra-small" style={{ fontSize: '0.72rem' }}>
                    0
                  </span>
                )}
              </button>

              {/* 🌟 ULTRA-SPACIOUS HIGH-CONTRAST DROPDOWN POPOVER */}
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
                      <span className="fw-bold fs-6">Farm Notifications</span>
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

                  {/* Scrollable Notifications List with Generous Padding */}
                  <div className="list-group list-group-flush" style={{ maxHeight: 350, overflowY: 'auto' }}>
                    {recentNotifs.length === 0 ? (
                      <div className="p-5 text-center text-muted small">
                        <FaBell size={28} className="mb-2 opacity-30 text-primary" />
                        <p className="mb-0 fw-semibold">No new notifications</p>
                        <small className="extra-small text-muted">All farm events are up to date.</small>
                      </div>
                    ) : (
                      recentNotifs.map((n) => (
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
                              {n.pond_name && (
                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 extra-small rounded-pill">
                                  {n.pond_name}
                                </span>
                              )}
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
                        navigate('/admin/notifications');
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

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
