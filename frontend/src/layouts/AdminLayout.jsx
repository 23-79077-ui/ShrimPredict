import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FaSignOutAlt,
  FaCalendarAlt,
  FaClock,
  FaCheckDouble,
  FaSun,
  FaMoon,
  FaBell,
  FaBars,
  FaTimes,
  FaCog,
  FaSlidersH,
  FaChevronLeft,
  FaChevronRight
} from 'react-icons/fa';
import { getEffectiveTheme, getThemePreference, setManualTheme, resetThemeToAuto, checkAndUpdateAutoTheme } from '../utils/theme';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';

// Minimalist vector icons for the Top Dock Tabs
const dockIcons = {
  dashboard: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  diseaseReports: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  ),
  feeding: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  harvest: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  waterQuality: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  ),
  ponds: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20" />
      <path d="M2 17c3 0 4-1 6-1s3 1 6 1 3-1 6-1" />
      <path d="M12 4a3 3 0 0 0-3 3c0 2 3 5 3 5s3-3 3-5a3 3 0 0 0-3-3z" />
    </svg>
  ),
  alerts: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  users: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  reports: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  ),
  settings: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
};

// Navigation Links for the Floating Top Dock
const dockLinks = [
  { to: '/admin/dashboard', key: 'nav.dashboard', label: 'Dashboard', icon: dockIcons.dashboard },
  { to: '/admin/scan-reports', key: 'nav.scanReports', label: 'Scan Reports', icon: dockIcons.diseaseReports },
  { to: '/admin/feeding', key: 'nav.feeding', label: 'Feeding Logs', icon: dockIcons.feeding },
  { to: '/admin/water-quality-reports', key: 'nav.waterQualityReports', label: 'Water Quality', icon: dockIcons.waterQuality },
  { to: '/admin/harvest', key: 'nav.harvest', label: 'Harvest Forecast', icon: dockIcons.harvest },
  { to: '/admin/pond-reports', key: 'nav.pondReports', label: 'Pond Reports', icon: dockIcons.ponds },
  { to: '/admin/alerts', key: 'nav.alerts', label: 'Alerts', icon: dockIcons.alerts },
  { to: '/admin/users', key: 'nav.users', label: 'Users', icon: dockIcons.users },
  { to: '/admin/reports', key: 'nav.reports', label: 'Reports', icon: dockIcons.reports },
  { to: '/admin/settings', key: 'nav.settings', label: 'Settings', icon: dockIcons.settings },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const { t, isFilipino } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => getEffectiveTheme());
  const [themePreference, setThemePreference] = useState(() => getThemePreference());
  const isAuto = themePreference === 'auto';
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const bellRef = useRef(null);
  const userRef = useRef(null);
  const navRowRef = useRef(null);

  // Category Dock Horizontal Swipe State
  const [navScroll, setNavScroll] = useState({
    scrollLeft: 0,
    maxScroll: 0,
    hasOverflow: false,
    percent: 0,
    canScrollLeft: false,
    canScrollRight: false
  });

  const updateNavScroll = () => {
    const el = navRowRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const hasOverflow = max > 10;
    const current = el.scrollLeft;
    const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((current / max) * 100))) : 0;
    setNavScroll({
      scrollLeft: current,
      maxScroll: max,
      hasOverflow,
      percent,
      canScrollLeft: current > 6,
      canScrollRight: current < max - 6
    });
  };

  useEffect(() => {
    updateNavScroll();
    const el = navRowRef.current;
    if (el) {
      el.addEventListener('scroll', updateNavScroll, { passive: true });
    }
    window.addEventListener('resize', updateNavScroll);
    return () => {
      if (el) el.removeEventListener('scroll', updateNavScroll);
      window.removeEventListener('resize', updateNavScroll);
    };
  }, []);

  useEffect(() => {
    // When location changes, scroll active dock pill into view if needed
    const el = navRowRef.current;
    if (!el) return;
    const activePill = el.querySelector('.dock-nav-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setTimeout(updateNavScroll, 300);
  }, [location.pathname]);

  const handleNavScrollNudge = (direction) => {
    const el = navRowRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -150 : 150;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Real-Time System Clock Timer State
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setManualTheme(nextTheme);
  };

  const handleResetToAuto = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    resetThemeToAuto();
  };

  useEffect(() => {
    checkAndUpdateAutoTheme();
    const handleThemeEvent = (e) => {
      if (e.detail?.theme) setTheme(e.detail.theme);
      if (e.detail?.preference !== undefined) setThemePreference(e.detail.preference);
    };
    window.addEventListener('shrim-theme-changed', handleThemeEvent);
    return () => window.removeEventListener('shrim-theme-changed', handleThemeEvent);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      checkAndUpdateAutoTheme();
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
    const interval = setInterval(fetchUnreadNotifications, 5000);
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
    const msg = (notif.message || '').toLowerCase();
    const targetId = notif.target_id || notif.report_id || '';
    const pondName = notif.pond_name || '';

    const queryParams = [];
    if (targetId) queryParams.push(`id=${targetId}`);
    if (pondName) queryParams.push(`pond=${encodeURIComponent(pondName)}`);
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    if (actionType === 'disease_scan' || actionType === 'scan_report' || title.includes('disease') || title.includes('scan') || msg.includes('wssv')) {
      navigate('/admin/scan-reports' + queryString);
    } else if (actionType === 'feeding' || title.includes('feed')) {
      navigate('/admin/feeding' + queryString);
    } else if (actionType === 'water_quality' || title.includes('water') || title.includes('dissolved oxygen') || title.includes('ph level') || title.includes('salinity')) {
      navigate('/admin/water-quality-reports' + queryString);
    } else if (actionType === 'pond' || title.includes('pond')) {
      navigate('/admin/pond-reports' + queryString);
    } else {
      navigate('/admin/reports' + queryString);
    }
  };

  return (
    <div className="saas-layout-canvas">
      {/* TOP NAVIGATION HEADER (Floating 2-Tier Dark Navy Capsule matching exact UI screenshot) */}
      <div className="top-dock-wrapper" style={{ position: 'sticky', top: 0, zIndex: 1050 }}>
        <header className="top-dock-bar">
          <div className="top-dock-inner" style={{ maxWidth: '100%', margin: '0 auto', width: '100%' }}>
            {/* Tier 1: Brand, Farm Identity, Badges & Utility Controls Bar */}
            <div className="top-dock-topbar d-flex align-items-center justify-content-between w-100">
              {/* 1. Left: Brand Logo, Farm Identity & Badges */}
              <div className="d-flex align-items-center gap-2.5 flex-shrink-0">
                <NavLink to="/admin/dashboard" className="d-flex align-items-center gap-2.5 text-decoration-none">
                  <img
                    src="/ob_aquafarm_logo.png"
                    alt="O & B Aquafarm Logo"
                    className="rounded-circle flex-shrink-0 shadow-sm"
                    style={{
                      width: '38px',
                      height: '38px',
                      objectFit: 'contain',
                      backgroundColor: '#FFFFFF',
                      padding: '1.5px',
                      border: '1.5px solid rgba(252, 86, 60, 0.4)'
                    }}
                  />
                  <div>
                    <span className="fw-extrabold text-white tracking-tight d-block" style={{ fontSize: '1.14rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                      Shrimp<span style={{ color: '#FC563C' }}>Predict</span>
                    </span>
                    <span className="d-block text-white-50" style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1, marginTop: 1 }}>
                      O & B AQUAFARM
                    </span>
                  </div>
                </NavLink>

                {/* ADMIN Pill Badge */}
                <span
                  className="badge rounded-pill fw-bold d-none d-sm-inline-block px-2.5 py-1 extra-small ms-1"
                  style={{
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    fontSize: '0.66rem',
                    letterSpacing: '0.05em'
                  }}
                >
                  ADMIN
                </span>

                {/* Admin Active Pill Badge with Orange Dot */}
                <span
                  className="badge rounded-pill fw-semibold d-none d-md-inline-flex align-items-center gap-1.5 px-2.5 py-1 extra-small ms-1"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    fontSize: '0.7rem'
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FC563C' }}></span>
                  <span>Admin Active</span>
                </span>
              </div>

              {/* 2. Right: Utility Controls Cluster (Clock, Theme, Notifications, User Profile) */}
              <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                {/* Language Switcher */}
                <LanguageToggle isDark={true} />

                {/* Real-time Clock Capsule Pill */}
                <div
                  className="d-none d-xl-flex align-items-center gap-1.5 text-white extra-small px-2.5 py-1 rounded-pill"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    fontSize: '0.74rem'
                  }}
                >
                  <FaClock size={11} style={{ color: '#38BDF8' }} />
                  <span className="fw-bold font-mono text-white">{clockDigits}</span>
                  <span className="text-white-50">•</span>
                  <span className="fw-medium text-white-50">{formattedDate}</span>
                </div>

                {/* Theme Toggle Pill & Auto Reset */}
                {!isAuto && (
                  <button
                    type="button"
                    onClick={handleResetToAuto}
                    className="btn btn-sm rounded-pill d-none d-sm-inline-flex align-items-center gap-1.5 shadow-xs px-2.5 py-0.5"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#FFFFFF',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      height: 32,
                      cursor: 'pointer',
                    }}
                    title={t('common.autoSchedule', 'Reset to Auto Schedule: 6 AM–6 PM Light, 6 PM–6 AM Dark')}
                    aria-label="Reset to Auto Theme Schedule"
                  >
                    <FaClock size={11} style={{ color: '#FC563C' }} />
                    <span>{t('common.auto', 'Auto')}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn text-white p-0 position-relative d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onClick={handleToggleTheme}
                  title={
                    isAuto
                      ? `Theme: Auto (${theme === 'dark' ? 'Dark mode 6 PM–6 AM' : 'Light mode 6 AM–6 PM'}) • Click to set ${theme === 'dark' ? 'Light' : 'Dark'} mode`
                      : `Theme: ${theme === 'dark' ? 'Dark' : 'Light'} (Manual) • Click to switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`
                  }
                  aria-label={
                    isAuto
                      ? `Theme is Auto. Click to switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode.`
                      : `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`
                  }
                >
                  {theme === 'dark' ? <FaSun size={12} className="text-warning" /> : <FaMoon size={11} className="text-white" />}
                  {isAuto && (
                    <span
                      className="position-absolute d-flex align-items-center justify-content-center rounded-circle"
                      style={{
                        bottom: -2,
                        right: -2,
                        width: 13,
                        height: 13,
                        backgroundColor: '#FC563C',
                        color: '#FFFFFF',
                        fontSize: 7.5,
                        fontWeight: 700,
                        boxShadow: '0 0 4px rgba(0,0,0,0.4)',
                      }}
                      title="Auto Day/Night Mode (6am–6pm Light, 6pm–6am Dark)"
                    >
                      <FaClock size={7} />
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Bell (Round Circle with Red Badge) */}
                <div className="position-relative" ref={bellRef}>
                  <button
                    type="button"
                    className="btn text-white p-0 position-relative d-flex align-items-center justify-content-center rounded-circle"
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    title="Pond Incident Notifications"
                  >
                    <FaBell size={12} className="text-white" />
                    {unreadCount > 0 && (
                      <span
                        className="position-absolute rounded-pill bg-danger text-white d-flex align-items-center justify-content-center"
                        style={{
                          top: -2,
                          right: -2,
                          minWidth: 15,
                          height: 15,
                          padding: '0 3.5px',
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          lineHeight: 1,
                          border: '1.5px solid #172A39',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                          pointerEvents: 'none'
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div
                      className="dropdown-menu show border-0 position-absolute end-0 mt-2 p-0 rounded-4 shadow-xl overflow-hidden notif-dropdown-menu"
                      style={{
                        width: '340px',
                        zIndex: 1050,
                        backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0'
                      }}
                    >
                      <div
                        className="p-3 px-3.5 d-flex align-items-center justify-content-between text-white"
                        style={{ background: 'linear-gradient(135deg, #172A39 0%, #203A4F 100%)' }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <FaBell size={13} />
                          <span className="fw-bold small">{t('Pond Incident Feed')}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-white text-dark rounded-pill extra-small px-2 py-0.5">
                            {unreadCount} {t('Active')}
                          </span>
                          {unreadCount > 0 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-white p-0 text-decoration-none extra-small opacity-80 hover-opacity-100"
                              onClick={handleMarkAllRead}
                              title={t('Mark all as read')}
                            >
                              <FaCheckDouble size={11} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '320px' }}>
                        {recentNotifs.length === 0 ? (
                          <div className="p-4 text-center text-muted">
                            <FaBell size={24} className="opacity-20 mb-2" />
                            <p className="mb-0 extra-small">{t('No new incident telemetry alerts.')}</p>
                          </div>
                        ) : (
                          recentNotifs.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 border-bottom transition-all cursor-pointer ${
                                !n.is_read ? (theme === 'dark' ? 'bg-primary-subtle bg-opacity-10' : 'bg-light') : ''
                              }`}
                              style={{
                                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                                fontSize: '0.8rem'
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
                              <span className="fw-bold extra-small" style={{ color: '#FC563C', fontSize: '0.72rem' }}>
                                {t('View Telemetry Details →')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-2.5 text-center border-top bg-light">
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none fw-semibold p-0 extra-small"
                          style={{ color: '#FC563C' }}
                          onClick={() => {
                            setShowNotifMenu(false);
                            navigate('/admin/alerts');
                          }}
                        >
                          {t('All Farm Notifications →')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Administrator Profile Capsule */}
                <div className="position-relative flex-shrink-0" ref={userRef}>
                  <button
                    type="button"
                    className="btn d-flex align-items-center gap-2 p-1 ps-1.5 pe-1.5 pe-md-3 rounded-pill text-white"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)'
                    }}
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <div
                      className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                      style={{
                        width: 28,
                        height: 28,
                        fontSize: '0.7rem',
                        background: 'linear-gradient(135deg, #FC563C 0%, #6E7575 100%)'
                      }}
                    >
                      {(user?.full_name || 'Admin').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="d-none d-md-flex flex-column text-start" style={{ lineHeight: 1.15 }}>
                      <span className="fw-bold text-white text-nowrap" style={{ fontSize: '0.78rem' }}>
                        {user?.full_name || 'Administrator'}
                      </span>
                      <span className="text-white-50 text-nowrap" style={{ fontSize: '0.62rem' }}>
                        Admin
                      </span>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div
                      className="dropdown-menu show border-0 position-absolute end-0 mt-2 p-2 rounded-3 shadow-lg"
                      style={{
                        width: 220,
                        zIndex: 1060,
                        backgroundColor: theme === 'dark' ? '#1E293B' : '#FFFFFF',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0'
                      }}
                    >
                      <div className="px-2 py-1.5 border-bottom mb-1">
                        <div className="fw-bold small text-truncate">{user?.full_name || 'Administrator'}</div>
                        <div className="extra-small text-muted">{user?.email || 'admin@shrimpredict.io'}</div>
                      </div>
                      {/* Theme Quick Actions in Profile Menu */}
                      <button
                        type="button"
                        className="dropdown-item rounded-2 small py-1.5 fw-semibold d-flex align-items-center justify-content-between"
                        onClick={handleResetToAuto}
                        title="Automatic schedule: 6 AM–6 PM Light, 6 PM–6 AM Dark"
                      >
                        <span className="d-flex align-items-center gap-2">
                          <FaClock size={12} style={{ color: '#FC563C' }} />
                          {t('common.auto', 'Auto Theme')}
                        </span>
                        {isAuto ? (
                          <span className="badge rounded-pill px-2 py-0.5 extra-small" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                            {t('Active')}
                          </span>
                        ) : (
                          <span className="badge rounded-pill px-2 py-0.5 extra-small bg-light text-secondary border">
                            {t('Off')}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        className="dropdown-item rounded-2 small py-1.5 fw-semibold d-flex align-items-center justify-content-between"
                        onClick={handleToggleTheme}
                      >
                        <span className="d-flex align-items-center gap-2">
                          {theme === 'dark' ? <FaSun size={12} className="text-warning" /> : <FaMoon size={12} className="text-primary" />}
                          {theme === 'dark' ? t('common.lightMode', 'Light Mode') : t('common.darkMode', 'Dark Mode')}
                        </span>
                        {!isAuto && (
                          <span className="badge rounded-pill px-2 py-0.5 extra-small" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' }}>
                            Manual
                          </span>
                        )}
                      </button>

                      <div className="dropdown-divider my-1" style={{ borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' }} />

                      <button
                        type="button"
                        className="dropdown-item rounded-2 small py-1.5 fw-semibold d-flex align-items-center gap-2"
                        onClick={() => {
                          setShowUserMenu(false);
                          navigate('/admin/settings');
                        }}
                      >
                        <FaCog size={12} className="text-primary" /> {t('common.settings', 'Settings & Preferences')}
                      </button>
                      <button
                        type="button"
                        className="dropdown-item rounded-2 small py-1.5 text-danger d-flex align-items-center gap-2"
                        onClick={handleLogout}
                      >
                        <FaSignOutAlt size={12} /> {t('common.logout', 'Log Out')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile / Tablet Navigation Toggle */}
                <button
                  type="button"
                  className="btn btn-sm text-white d-flex d-lg-none align-items-center justify-content-center p-0 rounded-circle"
                  style={{ width: 32, height: 32, backgroundColor: 'rgba(255, 255, 255, 0.12)', border: 'none' }}
                  onClick={() => setShowMobileNav(!showMobileNav)}
                  aria-label="Toggle navigation menu"
                >
                  {showMobileNav ? <FaTimes size={13} /> : <FaBars size={13} />}
                </button>
              </div>
            </div>

            {/* Subtle Hairline Divider between Tier 1 and Tier 2 */}
            <div className="top-dock-divider d-none d-lg-block" />

            {/* Tier 2: Floating Dock Navigation Tabs (Spacious, Dedicated Row - Zero Cutoff) */}
            <nav
              ref={navRowRef}
              onScroll={updateNavScroll}
              className="top-dock-nav-row d-flex align-items-center justify-content-between flex-nowrap w-100 py-0.5"
            >
              {dockLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => {
                    const isCurrentActive = isActive ||
                      (link.to === '/admin/scan-reports' && (location.pathname.startsWith('/admin/scan-reports') || location.pathname.startsWith('/admin/disease-reports'))) ||
                      (link.to === '/admin/water-quality-reports' && (location.pathname.startsWith('/admin/water-quality-reports') || location.pathname.startsWith('/admin/water-quality'))) ||
                      (link.to === '/admin/pond-reports' && (location.pathname.startsWith('/admin/pond-reports') || location.pathname.startsWith('/admin/ponds')));
                    return `dock-nav-pill ${isCurrentActive ? 'active' : ''}`;
                  }}
                >
                  <span className="opacity-80 flex-shrink-0">{link.icon}</span>
                  <span className="text-nowrap">{t(link.key, link.label)}</span>
                  {link.to === '/admin/alerts' && (
                    <span
                      className="badge rounded-pill flex-shrink-0 ms-1"
                      style={{
                        backgroundColor: '#EF4444',
                        color: '#FFFFFF',
                        fontSize: '0.62rem',
                        padding: '0.12rem 0.4rem',
                        fontWeight: 700
                      }}
                    >
                      {unreadCount > 0 ? unreadCount : 54}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Horizontal Swipe Progress Indicator for Header Categories (Visible on Mobile / Overflow) */}
            {navScroll.hasOverflow && (
              <div
                className="dock-swipe-tracker d-flex align-items-center justify-content-between px-2 pt-1 pb-0.5 w-100"
                style={{
                  fontSize: '0.66rem',
                  color: 'rgba(255, 255, 255, 0.88)',
                  userSelect: 'none',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  marginTop: '2px'
                }}
              >
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 border-0"
                  style={{
                    color: navScroll.canScrollLeft ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)',
                    fontSize: '0.66rem',
                    cursor: navScroll.canScrollLeft ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    fontWeight: 600
                  }}
                  onClick={() => handleNavScrollNudge('left')}
                  disabled={!navScroll.canScrollLeft}
                  aria-label="Swipe categories left"
                >
                  <FaChevronLeft size={8} />
                  <span>{t('common.swipe', 'Swipe')}</span>
                </button>

                <div className="d-flex align-items-center justify-content-center flex-grow-1 mx-2">
                  <div
                    style={{
                      width: 90,
                      height: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.18)',
                      borderRadius: 9999,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(navScroll.percent / 100) * (100 - Math.max(18, Math.min(45, ((navRowRef.current?.clientWidth || 300) / (navRowRef.current?.scrollWidth || 600)) * 100)))}%`,
                        width: `${Math.max(18, Math.min(45, ((navRowRef.current?.clientWidth || 300) / (navRowRef.current?.scrollWidth || 600)) * 100))}%`,
                        backgroundColor: '#FC563C',
                        borderRadius: 9999,
                        boxShadow: '0 0 6px rgba(252, 86, 60, 0.8)',
                        transition: 'left 0.08s ease-out'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-1 border-0"
                  style={{
                    color: navScroll.canScrollRight ? '#FC563C' : 'rgba(255, 255, 255, 0.35)',
                    fontSize: '0.66rem',
                    cursor: navScroll.canScrollRight ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    fontWeight: 600
                  }}
                  onClick={() => handleNavScrollNudge('right')}
                  disabled={!navScroll.canScrollRight}
                  aria-label="Swipe categories right"
                >
                  <span>{t('common.more', 'More')}</span>
                  <FaChevronRight size={8} />
                </button>
              </div>
            )}

            {/* Mobile / Tablet Dropdown Navigation Row */}
            {showMobileNav && (
              <div className="w-100 d-lg-none pt-2.5 pb-2 border-top mt-2" style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}>
                {/* Repurposed Theme Control: 3-Option Segmented Switcher (Light, Dark, Auto) */}
                <div
                  className="d-flex align-items-center p-1 rounded-pill mb-2.5 w-100 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    gap: '3px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setManualTheme('light')}
                    className="btn btn-sm rounded-pill flex-fill d-flex align-items-center justify-content-center gap-1.5 py-1.5 fw-bold border-0 transition-all"
                    style={{
                      backgroundColor: (!isAuto && theme === 'light') ? '#FC563C' : 'transparent',
                      color: (!isAuto && theme === 'light') ? '#FFFFFF' : '#CBD5E1',
                      fontSize: '0.78rem',
                      boxShadow: (!isAuto && theme === 'light') ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <FaSun size={12} style={{ color: (!isAuto && theme === 'light') ? '#FFFFFF' : '#F59E0B' }} />
                    <span>{t('common.light', 'Light')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualTheme('dark')}
                    className="btn btn-sm rounded-pill flex-fill d-flex align-items-center justify-content-center gap-1.5 py-1.5 fw-bold border-0 transition-all"
                    style={{
                      backgroundColor: (!isAuto && theme === 'dark') ? '#FC563C' : 'transparent',
                      color: (!isAuto && theme === 'dark') ? '#FFFFFF' : '#CBD5E1',
                      fontSize: '0.78rem',
                      boxShadow: (!isAuto && theme === 'dark') ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <FaMoon size={11} style={{ color: (!isAuto && theme === 'dark') ? '#FFFFFF' : '#93C5FD' }} />
                    <span>{t('common.dark', 'Dark')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToAuto}
                    className="btn btn-sm rounded-pill flex-fill d-flex align-items-center justify-content-center gap-1.5 py-1.5 fw-bold border-0 transition-all"
                    style={{
                      backgroundColor: isAuto ? '#FC563C' : 'transparent',
                      color: isAuto ? '#FFFFFF' : '#CBD5E1',
                      fontSize: '0.78rem',
                      boxShadow: isAuto ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                      cursor: 'pointer',
                    }}
                    title={t('common.autoSchedule', 'Auto Day/Night Mode (6 AM–6 PM Light, 6 PM–6 AM Dark)')}
                  >
                    <FaClock size={11} style={{ color: isAuto ? '#FFFFFF' : '#FC563C' }} />
                    <span>{t('common.auto', 'Auto')}</span>
                  </button>
                </div>

                {/* Touch-optimized 2-Column Mobile Navigation Grid */}
                <div className="mobile-nav-grid">
                  {dockLinks.map((link) => {
                    const isCurrentActive =
                      (link.to === '/admin/scan-reports' && (location.pathname.startsWith('/admin/scan-reports') || location.pathname.startsWith('/admin/disease-reports'))) ||
                      (link.to === '/admin/water-quality-reports' && (location.pathname.startsWith('/admin/water-quality-reports') || location.pathname.startsWith('/admin/water-quality'))) ||
                      (link.to === '/admin/pond-reports' && (location.pathname.startsWith('/admin/pond-reports') || location.pathname.startsWith('/admin/ponds')));
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `mobile-nav-pill-item ${(isActive || isCurrentActive) ? 'active' : ''}`}
                        onClick={() => setShowMobileNav(false)}
                      >
                        <span className="flex-shrink-0">{link.icon}</span>
                        <span className="text-truncate">{t(link.key, link.label)}</span>
                        {link.to === '/admin/alerts' && (
                          <span
                            className="badge rounded-pill ms-auto"
                            style={{
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              fontSize: '0.6rem',
                              padding: '0.12rem 0.35rem',
                              fontWeight: 700
                            }}
                          >
                            {unreadCount > 0 ? unreadCount : 54}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </header>
      </div>

      {/* MAIN PAGE CONTENT (Full Width Responsive Canvas) */}
      <main className="container-fluid px-3 px-md-4 px-xl-5 pt-3 pt-md-4 pb-5" style={{ maxWidth: '100%', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}
