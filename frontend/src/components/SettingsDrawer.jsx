import { useNavigate } from 'react-router-dom';
import {
  FaTimes,
  FaUser,
  FaLock,
  FaSlidersH,
  FaBell,
  FaDesktop,
  FaKey,
  FaDatabase,
  FaSignOutAlt,
  FaCog,
  FaChevronRight,
  FaShieldAlt,
  FaCheckCircle
} from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function SettingsDrawer({
  isOpen,
  onClose,
  user,
  role = 'caretaker',
  theme = 'light',
  onLogout
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSelectTab = (tabKey) => {
    onClose();
    const targetPath = role === 'admin' ? '/admin/settings' : '/caretaker/settings';
    navigate(`${targetPath}?tab=${tabKey}`);
  };

  const isDark = theme === 'dark';

  const caretakerMenu = [
    {
      key: 'profile',
      label: 'Operator Profile',
      desc: 'Personal profile, name & contact info',
      icon: <FaUser size={15} style={{ color: '#0284C7' }} />,
      badge: 'Profile'
    },
    {
      key: 'security',
      label: 'Account Security',
      desc: 'Password update & security credentials',
      icon: <FaLock size={15} style={{ color: '#EAB308' }} />,
      badge: 'Security'
    },
    {
      key: 'feeding',
      label: 'Basin Feeding Defaults',
      desc: 'Daily target kg & default feeding slots',
      icon: <FaSlidersH size={15} style={{ color: '#10B981' }} />,
      badge: 'SOP'
    },
    {
      key: 'notifications',
      label: 'Alert & Reminder Toggles',
      desc: 'Disease alerts & schedule notices',
      icon: <FaBell size={15} style={{ color: '#F97316' }} />,
      badge: 'Alerts'
    },
    {
      key: 'display',
      label: 'Display & Appearance',
      desc: 'Theme mode, language & date preferences',
      icon: <FaDesktop size={15} style={{ color: '#8B5CF6' }} />,
      badge: 'Theme'
    },
    {
      key: 'vision_key',
      label: 'AI Vision API Keys',
      desc: 'Google Gemini & OpenAI API configuration',
      icon: <FaKey size={15} style={{ color: '#EC4899' }} />,
      badge: 'Vision AI'
    }
  ];

  const adminMenu = [
    {
      key: 'general',
      label: 'System General Settings',
      desc: 'Farm identity, branding & operational mode',
      icon: <FaCog size={15} style={{ color: '#0284C7' }} />,
      badge: 'General'
    },
    {
      key: 'profile',
      label: 'Administrator Profile',
      desc: 'Account details, email & contact info',
      icon: <FaUser size={15} style={{ color: '#3B82F6' }} />,
      badge: 'Admin'
    },
    {
      key: 'security',
      label: 'Security & Access Control',
      desc: 'Password policy, multi-user permissions',
      icon: <FaShieldAlt size={15} style={{ color: '#EAB308' }} />,
      badge: 'Security'
    },
    {
      key: 'ai_vision',
      label: 'AI Vision Model Keys',
      desc: 'Gemini 2.5 Flash & GPT-4o-mini keys',
      icon: <FaKey size={15} style={{ color: '#EC4899' }} />,
      badge: 'AI Engine'
    },
    {
      key: 'notifications',
      label: 'Farm Notification Toggles',
      desc: 'Alert sensitivity & incident broadcasts',
      icon: <FaBell size={15} style={{ color: '#F97316' }} />,
      badge: 'Alerts'
    },
    {
      key: 'system',
      label: 'System Maintenance & Cache',
      desc: 'Database backup, logs & cache management',
      icon: <FaDatabase size={15} style={{ color: '#10B981' }} />,
      badge: 'Database'
    }
  ];

  const menuItems = role === 'admin' ? adminMenu : caretakerMenu;

  return (
    <div
      className="settings-drawer-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <aside
        className="settings-drawer-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          color: isDark ? '#F1F5F9' : '#0F172A',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
          animation: 'slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          className="p-3.5 px-4 d-flex align-items-center justify-content-between border-bottom"
          style={{
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'
          }}
        >
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white"
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #0B2C5F 0%, #FF7A00 100%)'
              }}
            >
              <FaCog size={16} />
            </div>
            <div>
              <h6 className="fw-extrabold mb-0 fs-6">Account &amp; System Settings</h6>
              <span className="extra-small text-muted d-block" style={{ fontSize: '0.72rem' }}>
                {role === 'admin' ? 'Administrator System Control' : 'Caretaker Operational Preferences'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle d-flex align-items-center justify-content-center p-0"
            style={{ width: 32, height: 32 }}
            onClick={onClose}
            title="Close Settings Sidebar"
          >
            <FaTimes size={13} />
          </button>
        </div>

        {/* User Card Summary */}
        <div className="p-3.5 px-4 border-bottom" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFAFA' }}>
          <div className="d-flex align-items-center gap-3 p-3 rounded-3 border" style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }}>
            <div
              className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #FF7A00 0%, #0B2C5F 100%)'
              }}
            >
              {(user?.full_name || 'User').slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="d-flex align-items-center gap-2">
                <strong className="text-truncate d-block" style={{ fontSize: '0.92rem' }}>
                  {user?.full_name || (role === 'admin' ? 'Administrator' : 'Caretaker Staff')}
                </strong>
                <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 extra-small px-2 py-0.5">
                  <FaCheckCircle size={9} className="me-1" /> Active
                </span>
              </div>
              <span className="extra-small text-muted d-block text-truncate mt-0.5">
                {user?.email || (role === 'admin' ? 'admin@shrimpredict.io' : 'caretaker@shrimpredict.io')}
              </span>
            </div>
          </div>
        </div>

        {/* Category Items List */}
        <div className="flex-grow-1 overflow-y-auto p-3.5 px-4">
          <div className="extra-small fw-bold text-uppercase text-muted mb-2.5" style={{ letterSpacing: '0.6px' }}>
            Settings Sections
          </div>

          <div className="d-flex flex-column gap-2">
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="w-100 text-start p-3 rounded-3 border d-flex align-items-center justify-content-between transition-all"
                style={{
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                  cursor: 'pointer'
                }}
                onClick={() => handleSelectTab(item.key)}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-3 p-2.5 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <strong className="d-block text-dark" style={{ fontSize: '0.86rem', color: isDark ? '#F1F5F9' : '#0F172A' }}>
                        {item.label}
                      </strong>
                      <span className="badge bg-light text-muted border extra-small px-2 py-0.5" style={{ fontSize: '0.65rem' }}>
                        {item.badge}
                      </span>
                    </div>
                    <span className="extra-small text-muted d-block mt-0.5" style={{ fontSize: '0.74rem' }}>
                      {item.desc}
                    </span>
                  </div>
                </div>

                <FaChevronRight size={11} className="text-muted opacity-60 ms-2 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div
          className="p-3.5 px-4 border-top d-flex align-items-center justify-content-between gap-2"
          style={{
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'
          }}
        >
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-2 extra-small fw-bold d-flex align-items-center gap-1.5"
            onClick={() => handleSelectTab('profile')}
          >
            Open Full Settings Page →
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger rounded-pill px-3 py-2 extra-small fw-bold d-flex align-items-center gap-1.5"
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
          >
            <FaSignOutAlt size={11} /> Log Out
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
