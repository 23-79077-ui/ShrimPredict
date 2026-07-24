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

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/notifications.php?status=active');
      if (res.data?.success) {
        setUnreadCount(res.data.counts?.unread || 0);
        setRecentNotifs((res.data.notifications || []).slice(0, 5));
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

  // Notification Click Handler: Mark read and navigate to target page (e.g. /admin/reports)
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
    } else if (actionType === 'water_quality' || (title.includes('pond') && !title.includes('report')) || (msg.includes('pond') && !msg.includes('report'))) {
      navigate('/admin/ponds');
    } else {
      // Maintenance / Reports / Disease Scans / General -> /admin/reports
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
          
          <div className="admin-actions d-flex gap-2 align-items-center flex-wrap">
            {/* Topbar Notification Bell */}
            <div className="position-relative" ref={bellRef}>
              <button
                className="btn btn-light border position-relative d-flex align-items-center justify-content-center p-2 rounded-circle"
                style={{ width: 40, height: 40 }}
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                title="Notifications"
              >
                <FaBell className={unreadCount > 0 ? 'text-primary' : 'text-muted'} />
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Quick Preview Dropdown */}
              {showNotifMenu && (
                <div
                  className="dropdown-menu show shadow-lg border-0 position-absolute end-0 mt-2 p-0 rounded-3 overflow-hidden"
                  style={{ width: 340, zIndex: 1050 }}
                >
                  <div className="p-3 bg-primary text-white d-flex align-items-center justify-content-between">
                    <span className="fw-semibold small">Caretaker Notifications</span>
                    <span className="badge bg-white text-primary rounded-pill">{unreadCount} new</span>
                  </div>

                  <div className="list-group list-group-flush" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {recentNotifs.length === 0 ? (
                      <div className="p-3 text-center text-muted small">No notifications yet.</div>
                    ) : (
                      recentNotifs.map((n) => (
                        <div
                          key={n.id}
                          className={`list-group-item p-2.5 small list-group-item-action cursor-pointer transition-all ${
                            !n.is_read ? 'bg-light fw-medium border-start border-primary border-3' : ''
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold text-dark">{n.title}</span>
                            <span className="text-muted extra-small">
                              {new Date(n.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-secondary mb-1 text-truncate" style={{ fontSize: '0.8rem' }}>
                            {n.message}
                          </p>
                          <span className="text-primary fw-semibold extra-small text-decoration-underline">
                            View Report Details →
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 bg-light text-center border-top">
                    <button
                      className="btn btn-link btn-sm text-decoration-none fw-semibold p-0 text-primary"
                      onClick={() => {
                        setShowNotifMenu(false);
                        navigate('/admin/notifications');
                      }}
                    >
                      View All Notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/admin/reports')}>Reports</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/ponds')}>Manage Ponds</button>
          </div>
        </div>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
