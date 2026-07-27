import { useState, useEffect, useRef } from 'react';
import {
  FaUser,
  FaLock,
  FaWater,
  FaFish,
  FaBell,
  FaSlidersH,
  FaDatabase,
  FaInfoCircle,
  FaSearch,
  FaSun,
  FaMoon,
  FaSave,
  FaShieldAlt,
  FaSignOutAlt,
  FaDownload,
  FaUpload,
  FaCamera,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaClock,
  FaGlobe,
  FaDesktop,
  FaCog,
  FaEdit,
  FaTimes,
  FaEnvelope,
  FaPhone,
  FaUserShield,
  FaUserCheck,
  FaArchive,
  FaTrashAlt,
  FaEye,
  FaHistory,
  FaClipboardList,
  FaBug,
  FaStar,
  FaUtensils
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { applyAppTheme } from '../../main';

export default function SettingsPage() {
  const { user: authUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Profile Edit Mode state & backup draft
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(null);

  // Archived Caretakers Repository State
  const [archivedCaretakers, setArchivedCaretakers] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState('');
  const [selectedArchivedDetails, setSelectedArchivedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchArchivedCaretakers = async () => {
    setLoadingArchived(true);
    try {
      const res = await api.get('/archived_caretakers.php');
      if (res.data && res.data.success) {
        setArchivedCaretakers(res.data.archived_caretakers || []);
      }
    } catch (err) {
      console.warn('Archived caretakers fetch error:', err);
    } finally {
      setLoadingArchived(false);
    }
  };

  const openArchivedDetails = async (caretakerId) => {
    setLoadingDetails(true);
    setSelectedArchivedDetails(null);
    try {
      const res = await api.get(`/archived_caretakers.php?action=details&user_id=${caretakerId}`);
      if (res.data && res.data.success) {
        setSelectedArchivedDetails(res.data.details);
      } else {
        Swal.fire('Error', res.data?.message || 'Could not load profile details.', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRestoreCaretaker = (caretaker) => {
    const info = caretaker.personal_info || caretaker;
    const name = info.full_name || 'Caretaker';
    const id = info.id || caretaker.id;

    Swal.fire({
      title: `Restore Caretaker "${name}"?`,
      text: 'This account will be restored to Active Caretakers.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Restore Account',
      confirmButtonColor: '#10b981'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/users.php', { action: 'restore_caretaker', user_id: id });
          if (res.data && res.data.success) {
            Swal.fire('Restored!', `${name} has been restored to active caretakers successfully!`, 'success');
            setSelectedArchivedDetails(null);
            fetchArchivedCaretakers();
          }
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  const handleDeletePermanently = (caretaker) => {
    const info = caretaker.personal_info || caretaker;
    const name = info.full_name || 'Caretaker';
    const id = info.id || caretaker.id;

    Swal.fire({
      title: `Delete Permanently "${name}"?`,
      text: 'This action is permanent and cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete Permanently',
      confirmButtonColor: '#ef4444'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/users.php', { action: 'delete_user', user_id: id });
          if (res.data && res.data.success) {
            Swal.fire('Deleted!', `${name} record removed permanently.`, 'success');
            setSelectedArchivedDetails(null);
            fetchArchivedCaretakers();
          }
        } catch (err) {
          Swal.fire('Error', err.message, 'error');
        }
      }
    });
  };

  useEffect(() => {
    if (activeTab === 'archived_caretakers') {
      fetchArchivedCaretakers();
    }
  }, [activeTab]);

  // Profile State
  const [profile, setProfile] = useState({
    id: authUser?.id || 0,
    full_name: authUser?.full_name || 'System Administrator',
    email: authUser?.email || 'admin@shrimpredict.com',
    phone: '09123456789',
    position: 'System Administrator',
    last_login: 'July 25, 2026, 09:05 AM',
    avatar_path: '',
    two_factor_enabled: false
  });

  const handleStartEditProfile = () => {
    setTempProfile({ ...profile });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    if (tempProfile) {
      setProfile(tempProfile);
    }
    setIsEditingProfile(false);
  };

  // Security State
  const [security, setSecurity] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Pond Settings State
  const [pondSettings, setPondSettings] = useState({
    max_ponds: '30',
    default_pond_status: 'Healthy',
    auto_assign_pond_number: 'ON'
  });

  // Harvest Settings State
  const [harvestSettings, setHarvestSettings] = useState({
    target_harvest_age: '120',
    harvest_ready_percentage: '95',
    prediction_refresh: 'Daily'
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    receive_disease_alerts: 'ON',
    receive_harvest_alerts: 'ON',
    receive_feeding_alerts: 'ON',
    receive_caretaker_activity_alerts: 'ON',
    receive_email_notifications: 'OFF'
  });

  // System Preferences State
  const [systemPreferences, setSystemPreferences] = useState({
    theme: localStorage.getItem('shrim_theme') === 'dark' ? 'Dark' : 'Light',
    language: 'English',
    date_format: 'MM/DD/YYYY',
    time_format: '12 Hours'
  });

  // Backup & Restore State
  const [backupSettings, setBackupSettings] = useState({
    last_backup: 'July 23, 2026 10:00 AM',
    automatic_backup: 'ON',
    backup_frequency: 'Weekly'
  });

  // Fetch initial settings & profile from backend APIs
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile
      try {
        const profRes = await api.get('/profile.php');
        if (profRes.data && profRes.data.success && profRes.data.profile) {
          const p = profRes.data.profile;
          setProfile((prev) => ({
            ...prev,
            id: p.id || prev.id,
            full_name: p.full_name || prev.full_name,
            email: p.email || prev.email,
            phone: p.phone || prev.phone,
            position: p.position || prev.position,
            avatar_path: p.avatar_path || prev.avatar_path,
            two_factor_enabled: Boolean(Number(p.two_factor_enabled)),
            last_login: p.last_login || prev.last_login
          }));
        }
      } catch (err) {
        console.warn('Profile fetch warning:', err);
      }

      // 2. Fetch System Settings
      try {
        const setRes = await api.get('/settings.php');
        if (setRes.data && setRes.data.success && setRes.data.settings) {
          const s = setRes.data.settings;

          if (s.max_ponds || s.default_pond_status || s.auto_assign_pond_number) {
            setPondSettings((prev) => ({
              ...prev,
              max_ponds: s.max_ponds ?? prev.max_ponds,
              default_pond_status: s.default_pond_status ?? prev.default_pond_status,
              auto_assign_pond_number: s.auto_assign_pond_number ?? prev.auto_assign_pond_number
            }));
          }

          if (s.target_harvest_age || s.harvest_ready_percentage || s.prediction_refresh) {
            setHarvestSettings((prev) => ({
              ...prev,
              target_harvest_age: s.target_harvest_age ?? prev.target_harvest_age,
              harvest_ready_percentage: s.harvest_ready_percentage ?? prev.harvest_ready_percentage,
              prediction_refresh: s.prediction_refresh ?? prev.prediction_refresh
            }));
          }

          if (
            s.receive_disease_alerts ||
            s.receive_harvest_alerts ||
            s.receive_feeding_alerts ||
            s.receive_caretaker_activity_alerts ||
            s.receive_email_notifications
          ) {
            setNotificationSettings((prev) => ({
              ...prev,
              receive_disease_alerts: s.receive_disease_alerts ?? prev.receive_disease_alerts,
              receive_harvest_alerts: s.receive_harvest_alerts ?? prev.receive_harvest_alerts,
              receive_feeding_alerts: s.receive_feeding_alerts ?? prev.receive_feeding_alerts,
              receive_caretaker_activity_alerts: s.receive_caretaker_activity_alerts ?? prev.receive_caretaker_activity_alerts,
              receive_email_notifications: s.receive_email_notifications ?? prev.receive_email_notifications
            }));
          }

          if (s.theme || s.language || s.date_format || s.time_format) {
            const currentTheme = s.theme || systemPreferences.theme;
            setSystemPreferences((prev) => ({
              ...prev,
              theme: currentTheme,
              language: s.language ?? prev.language,
              date_format: s.date_format ?? prev.date_format,
              time_format: s.time_format ?? prev.time_format
            }));
            applyTheme(currentTheme);
          }

          if (s.last_backup || s.automatic_backup || s.backup_frequency) {
            setBackupSettings((prev) => ({
              ...prev,
              last_backup: s.last_backup ?? prev.last_backup,
              automatic_backup: s.automatic_backup ?? prev.automatic_backup,
              backup_frequency: s.backup_frequency ?? prev.backup_frequency
            }));
          }
        }
      } catch (err) {
        console.warn('Settings fetch warning:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper to apply theme
  const applyTheme = (themeName) => {
    const isDark = themeName === 'Dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shrim_theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('shrim_theme', 'light');
    }
  };

  // Profile picture upload simulation / handler
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile((prev) => ({ ...prev, avatar_path: reader.result }));
        Swal.fire({
          icon: 'success',
          title: 'Profile Picture Updated',
          text: 'New profile photo preview generated. Click "Save Changes" to retain your updates.',
          timer: 1800,
          showConfirmButton: false
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Profile
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/profile.php', {
        action: 'update_profile',
        user_id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        position: profile.position,
        avatar_path: profile.avatar_path
      });

      if (res.data && res.data.success) {
        const stored = localStorage.getItem('shrim_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.full_name = profile.full_name;
          parsed.email = profile.email;
          localStorage.setItem('shrim_user', JSON.stringify(parsed));
        }

        setIsEditingProfile(false);

        Swal.fire({
          icon: 'success',
          title: 'Profile Updated',
          text: 'Administrator profile information has been successfully updated.',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(res.data?.message || 'Failed to update profile');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.response?.data?.message || err.message || 'An error occurred while saving profile.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Update Password
  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();

    if (!security.current_password) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter your current password.' });
      return;
    }
    if (!security.new_password || security.new_password.length < 6) {
      Swal.fire({ icon: 'warning', title: 'Invalid Password', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (security.new_password !== security.confirm_password) {
      Swal.fire({ icon: 'error', title: 'Password Mismatch', text: 'New password and confirm password do not match.' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/profile.php', {
        action: 'update_password',
        user_id: profile.id,
        current_password: security.current_password,
        new_password: security.new_password
      });

      if (res.data && res.data.success) {
        setSecurity({ current_password: '', new_password: '', confirm_password: '' });
        Swal.fire({
          icon: 'success',
          title: 'Password Updated',
          text: 'Your security password has been changed successfully.',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(res.data?.message || 'Failed to update password.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Security Error',
        text: err.response?.data?.message || err.message || 'Current password may be incorrect.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle 2FA
  const handleToggle2FA = async (enabled) => {
    setProfile((prev) => ({ ...prev, two_factor_enabled: enabled }));
    try {
      await api.post('/profile.php', {
        action: 'toggle_2fa',
        user_id: profile.id,
        two_factor_enabled: enabled ? 1 : 0
      });
      Swal.fire({
        icon: enabled ? 'success' : 'info',
        title: enabled ? '2FA Enabled' : '2FA Disabled',
        text: enabled ? 'Two-Factor Authentication is now ON.' : 'Two-Factor Authentication is turned OFF.',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('2FA error:', err);
    }
  };

  // Logout all devices
  const handleLogoutAllDevices = () => {
    Swal.fire({
      title: 'Logout All Devices?',
      text: 'This will terminate active sessions across all devices for this administrator account.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e04848',
      cancelButtonColor: '#627591',
      confirmButtonText: 'Yes, Logout All Devices'
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        Swal.fire({
          icon: 'success',
          title: 'Logged Out',
          text: 'All sessions terminated. Redirecting...',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  // Save Settings Helper (Pond, Harvest, Notifications, Preferences, Backup)
  const saveSettingsGroup = async (settingsObj, successMsg) => {
    setSaving(true);
    try {
      const res = await api.post('/settings.php', { settings: settingsObj });
      if (res.data && res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Settings Saved',
          text: successMsg || 'System settings have been updated.',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(res.data?.message || 'Failed to save settings.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error Saving Settings',
        text: err.response?.data?.message || err.message || 'Unable to update system preferences.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Theme preference handler
  const handleThemeChange = (newTheme) => {
    setSystemPreferences((prev) => ({ ...prev, theme: newTheme }));
    applyTheme(newTheme);
    saveSettingsGroup({ ...systemPreferences, theme: newTheme }, `Theme switched to ${newTheme} Mode.`);
  };

  // Backup Now handler
  const handleBackupNow = () => {
    Swal.fire({
      title: 'Generate System Backup?',
      text: 'A full SQL database dump of shrim_predict_db will be downloaded to your machine.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Download Backup Now',
      confirmButtonColor: '#0B2C5F'
    }).then((result) => {
      if (result.isConfirmed) {
        window.open('/api/backup.php?action=download', '_blank');
        const nowFormatted = new Date().toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        setBackupSettings((prev) => ({ ...prev, last_backup: nowFormatted }));
        Swal.fire({
          icon: 'success',
          title: 'Backup Download Started',
          text: 'Database backup dump initiated successfully.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };

  // Restore Backup handler
  const handleRestoreBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Swal.fire({
        title: 'Restore Database Backup?',
        text: `Restoring "${file.name}" will overwrite current database records. Are you sure you want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF7A00',
        cancelButtonColor: '#627591',
        confirmButtonText: 'Yes, Restore Backup'
      }).then(async (res) => {
        if (res.isConfirmed) {
          const formData = new FormData();
          formData.append('sql_file', file);
          formData.append('action', 'restore');

          try {
            setSaving(true);
            const response = await api.post('/backup.php', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data && response.data.success) {
              setBackupSettings((prev) => ({ ...prev, last_backup: response.data.last_backup }));
              Swal.fire({
                icon: 'success',
                title: 'Database Restored!',
                text: 'System records have been restored cleanly from the backup file.',
                confirmButtonColor: '#0B2C5F'
              });
              fetchInitialData();
            } else {
              throw new Error(response.data?.message || 'Restore failed');
            }
          } catch (err) {
            Swal.fire({
              icon: 'error',
              title: 'Restore Failed',
              text: err.response?.data?.message || err.message || 'Error processing database restore.'
            });
          } finally {
            setSaving(false);
          }
        }
      });
    };
    input.click();
  };

  // Section List with Search Keywords
  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      icon: FaUser,
      desc: 'Pamahalaan ang impormasyon ng administrator.',
      keywords: 'profile, picture, admin, email, phone, position, last login, full name, profile picture'
    },
    {
      id: 'security',
      label: 'Security',
      icon: FaLock,
      desc: 'Palitan ang password at pamahalaan ang account security.',
      keywords: 'security, password, current password, new password, confirm password, 2fa, two-factor, logout, authentication'
    },
    {
      id: 'pond',
      label: 'Pond Settings',
      icon: FaWater,
      desc: 'Default pond configuration (hal. max ponds, auto numbering).',
      keywords: 'pond, maximum number of ponds, 30, default pond status, healthy, auto assign pond number'
    },
    {
      id: 'harvest',
      label: 'Harvest Settings',
      icon: FaFish,
      desc: 'Itakda ang target harvest age at readiness threshold na ginagamit ng system.',
      keywords: 'harvest, target harvest age, 120 days, harvest ready percentage, 95%, prediction refresh, upcoming harvest, ready to harvest'
    },
    {
      id: 'notification',
      label: 'Notification Settings',
      icon: FaBell,
      desc: 'Piliin kung aling alerts ang matatanggap ng admin.',
      keywords: 'notification, disease alerts, harvest alerts, feeding alerts, caretaker activity alerts, email notifications'
    },
    {
      id: 'preference',
      label: 'System Preferences',
      icon: FaSlidersH,
      desc: 'Theme, language, at date/time format.',
      keywords: 'preferences, theme, light, dark, language, english, date format, time format'
    },
    {
      id: 'backup',
      label: 'Backup & Restore',
      icon: FaDatabase,
      desc: 'Gumawa o mag-restore ng backup ng system data.',
      keywords: 'backup, restore, last backup, automatic backup, backup frequency, weekly, backup now, restore backup'
    },
    {
      id: 'archived_caretakers',
      label: 'Archived Caretakers',
      icon: FaUserCheck,
      desc: 'Preserved record repository of resigned or inactive caretakers.',
      keywords: 'archived caretakers, resigned caretakers, former caretakers, caretaker history, performance logs, resign'
    },
    {
      id: 'about',
      label: 'About System',
      icon: FaInfoCircle,
      desc: 'Impormasyon tungkol sa system at development team.',
      keywords: 'about, shrimpredict, version 1.0, team shrimpredict, batangas state university, 2026'
    }
  ];

  // Filter tabs based on search
  const filteredTabs = tabs.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.label.toLowerCase().includes(query) ||
      t.desc.toLowerCase().includes(query) ||
      t.keywords.toLowerCase().includes(query)
    );
  });

  // Switch tab if current active tab is filtered out during search
  useEffect(() => {
    if (searchQuery.trim() && filteredTabs.length > 0) {
      if (!filteredTabs.some((t) => t.id === activeTab)) {
        setActiveTab(filteredTabs[0].id);
      }
    }
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5" style={{ minHeight: '65vh' }}>
        <div className="spinner-grow text-primary" role="status" style={{ width: '3.5rem', height: '3.5rem' }}>
          <span className="visually-hidden">Loading Settings...</span>
        </div>
        <p className="mt-3 text-muted fw-semibold fs-6">Loading System Preferences & Administrator Account...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-0 px-md-3 pb-5">
      {/* Main Settings Body */}
      <div className="row g-4">
        {/* Left Navigation Sidebar / Tabs */}
        <div className="col-12 col-lg-4 col-xl-3">
          <div className="settings-card bg-white p-3 rounded-4 border border-slate-200 shadow-xs sticky-top" style={{ top: 20, zIndex: 10 }}>
            {/* Settings Menu Header + Integrated Search Bar */}
            <div className="px-1 pb-3 mb-2 border-bottom">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-uppercase fw-bold text-muted extra-small tracking-wider">SETTINGS MENU</span>
                <span className="badge bg-primary bg-opacity-10 text-primary extra-small rounded-pill fw-semibold">
                  {filteredTabs.length} Tabs
                </span>
              </div>

              {/* Integrated Search Settings Bar */}
              <div className="position-relative mt-2">
                <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 14, fontSize: '0.85rem' }} />
                <input
                  type="text"
                  className="form-control form-control-sm ps-5 pe-4 py-2.5 rounded-3 border-slate-200 shadow-xs"
                  placeholder="Search Settings..."
                  style={{ fontSize: '0.86rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link position-absolute top-50 translate-middle-y text-muted text-decoration-none p-0"
                    style={{ right: 10, fontSize: '0.85rem' }}
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="nav flex-column nav-pills gap-1.5 mt-2">
              {filteredTabs.length === 0 ? (
                <div className="p-3 text-center text-muted small">No settings matching "{searchQuery}"</div>
              ) : (
                filteredTabs.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`settings-nav-item nav-link text-start d-flex align-items-center gap-3 py-3 px-3 ${
                        isActive ? 'active' : 'text-dark'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="settings-nav-icon p-2 rounded-3 d-flex align-items-center justify-content-center"
                        style={{ width: 36, height: 36 }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="text-truncate">
                        <div className="fw-semibold fs-6 lh-1">{t.label}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Tab Content Panel */}
        <div className="col-12 col-lg-8 col-xl-9">
          {/* PROFILE SECTION */}
          {activeTab === 'profile' && (
            <div className="settings-card bg-white shadow-sm border border-slate-200 rounded-4 overflow-hidden">
              <div className="settings-card-header p-4 border-bottom bg-slate-50 d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="settings-icon-badge p-3 rounded-4 bg-primary bg-opacity-10 text-primary">
                    <FaUser size={20} />
                  </div>
                  <div>
                    <h4 className="fw-bold mb-0 text-dark">👤 Admin Profile</h4>
                    <small className="text-muted">Impormasyon at detalye ng administrator account.</small>
                  </div>
                </div>
                <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3.5 py-1.5 extra-small fw-bold">
                  Active Administrator
                </span>
              </div>

              <div className="card-body p-4 p-md-4">
                {/* Profile Picture Header Banner */}
                <div className="d-flex flex-column flex-sm-row align-items-center gap-4 p-4 p-md-4.5 rounded-4 bg-light border border-slate-200 mb-4.5">
                  <div className="position-relative flex-shrink-0">
                    {profile.avatar_path && (
                      <img
                        src={profile.avatar_path}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.avatar-initial-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        className="avatar-halo rounded-circle object-fit-cover border border-3 border-white shadow-md"
                        style={{ width: 96, height: 96 }}
                      />
                    )}
                    <div
                      className="avatar-initial-fallback avatar-halo rounded-circle text-white align-items-center justify-content-center border border-3 border-white fw-bold fs-2 shadow-md"
                      style={{
                        width: 96,
                        height: 96,
                        background: 'linear-gradient(135deg, #0b2c5f 0%, #1e40af 100%)',
                        display: profile.avatar_path ? 'none' : 'flex'
                      }}
                    >
                      {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 p-2 border border-2 border-white shadow"
                      title="Upload Photo"
                    >
                      <FaCamera size={13} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="d-none"
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div className="text-center text-sm-start flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-2 mb-1.5">
                      <h5 className="fw-bold mb-0 text-dark fs-5">{profile.full_name}</h5>
                      <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold">
                        {profile.position}
                      </span>
                    </div>
                    <p className="text-secondary mb-2 small fw-medium">{profile.email}</p>
                    <small className="text-muted d-block extra-small">
                      Allowed formats: JPG, PNG or GIF. Click the camera icon on the avatar to change photo.
                    </small>
                  </div>
                </div>

                {/* READ-ONLY VIEW MODE CARDS */}
                {!isEditingProfile ? (
                  <div className="profile-view-section">
                    <div
                      className="d-flex align-items-center justify-content-between border-top border-slate-200"
                      style={{ marginTop: 28, marginBottom: 28, paddingTop: 20 }}
                    >
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2 fs-6">
                        <FaCheckCircle className="text-success" size={16} /> Account Profile Details Overview
                      </h6>
                      <span className="badge bg-light text-muted border px-3 py-1.5 extra-small fw-semibold">
                        Read-only account summary
                      </span>
                    </div>

                    <div className="row g-4">
                      {/* Full Name Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-4 px-4.5 rounded-4 bg-light border border-slate-200 transition-all hover-shadow-xs">
                          <div className="text-muted extra-small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2">
                            <FaUser className="text-primary flex-shrink-0" size={13} />
                            <span className="tracking-wider ms-1">System Administrator (Full Name)</span>
                          </div>
                          <div className="fw-bold text-dark fs-6 pt-1">{profile.full_name}</div>
                        </div>
                      </div>

                      {/* Email Address Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-4 px-4.5 rounded-4 bg-light border border-slate-200 transition-all hover-shadow-xs">
                          <div className="text-muted extra-small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2">
                            <FaEnvelope className="text-primary flex-shrink-0" size={13} />
                            <span className="tracking-wider ms-1">Email Address</span>
                          </div>
                          <div className="fw-bold text-dark fs-6 pt-1">{profile.email}</div>
                        </div>
                      </div>

                      {/* Phone Number Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-4 px-4.5 rounded-4 bg-light border border-slate-200 transition-all hover-shadow-xs">
                          <div className="text-muted extra-small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2">
                            <FaPhone className="text-primary flex-shrink-0" size={13} />
                            <span className="tracking-wider ms-1">Contact Phone Number</span>
                          </div>
                          <div className="fw-bold text-dark fs-6 pt-1">{profile.phone || '09123456789'}</div>
                        </div>
                      </div>

                      {/* Position / Role Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-4 px-4.5 rounded-4 bg-light border border-slate-200 transition-all hover-shadow-xs">
                          <div className="text-muted extra-small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2">
                            <FaUserShield className="text-primary flex-shrink-0" size={13} />
                            <span className="tracking-wider ms-1">Position / System Role</span>
                          </div>
                          <div className="fw-bold text-dark fs-6 pt-1">{profile.position}</div>
                        </div>
                      </div>

                      {/* Last Login Card */}
                      <div className="col-12">
                        <div className="p-4 px-4.5 rounded-4 bg-light border border-slate-200 transition-all hover-shadow-xs">
                          <div className="text-muted extra-small fw-bold text-uppercase mb-2.5 d-flex align-items-center gap-2">
                            <FaClock className="text-primary flex-shrink-0" size={13} />
                            <span className="tracking-wider ms-1">Last Login Timestamp</span>
                          </div>
                          <div className="fw-bold text-dark fs-6 pt-1">{profile.last_login}</div>
                        </div>
                      </div>
                    </div>

                    {/* 🌟 EDIT PROFILE BUTTON IN LOWER RIGHT PART */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-4.5 pt-4 border-top">
                      <div className="text-muted extra-small d-flex align-items-center gap-2">
                        <FaShieldAlt className="text-success" size={14} />
                        <span>Administrator Account Info Verified & Secured</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary px-4 py-2.5 rounded-3 d-flex align-items-center gap-2 shadow-sm fw-semibold ms-auto"
                        onClick={handleStartEditProfile}
                      >
                        <FaEdit size={15} /> Edit Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE CARDS FORM */
                  <form onSubmit={handleSaveProfile} className="profile-edit-section">
                    <div
                      className="d-flex align-items-center justify-content-between bg-primary bg-opacity-10 rounded-4 border border-primary border-opacity-25 shadow-xs"
                      style={{ marginTop: 28, marginBottom: 32, padding: '14px 20px' }}
                    >
                      <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2 fs-6">
                        <FaEdit size={16} /> Edit Administrator Profile Details
                      </h6>
                      <small className="text-muted extra-small ms-2">Modify account fields below and click Save Changes.</small>
                    </div>

                    <div className="row g-4">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold text-dark small mb-2">Full Name</label>
                        <input
                          type="text"
                          className="form-control p-3 rounded-3 border-secondary border-opacity-25 shadow-xs"
                          value={profile.full_name}
                          onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold text-dark small mb-2">Email Address</label>
                        <input
                          type="email"
                          className="form-control p-3 rounded-3 border-secondary border-opacity-25 shadow-xs"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          required
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold text-dark small mb-2">Contact Phone Number</label>
                        <input
                          type="text"
                          className="form-control p-3 rounded-3 border-secondary border-opacity-25 shadow-xs"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold text-dark small mb-2">Position / Role</label>
                        <input
                          type="text"
                          className="form-control p-3 rounded-3 border-secondary border-opacity-25 shadow-xs"
                          value={profile.position}
                          onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-bold text-dark small mb-2">Last Login Timestamp (Read-Only)</label>
                        <input
                          type="text"
                          className="form-control p-3 rounded-3 bg-light text-muted border-secondary border-opacity-25"
                          value={profile.last_login}
                          disabled
                        />
                      </div>
                    </div>

                    {/* Action Buttons: Cancel and Save Changes (Lower Right Part) */}
                    <div className="d-flex align-items-center justify-content-end gap-3 mt-4.5 pt-4 border-top">
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-4 py-2.5 rounded-3 d-flex align-items-center gap-2 fw-semibold"
                        onClick={handleCancelEditProfile}
                      >
                        <FaTimes size={14} /> Cancel
                      </button>

                      <button
                        type="submit"
                        className="btn btn-settings-primary px-4.5 py-2.5 rounded-3 d-flex align-items-center gap-2 fw-semibold shadow-sm"
                        disabled={saving}
                      >
                        <FaSave size={14} /> {saving ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* SECURITY SECTION */}
          {activeTab === 'security' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-danger bg-opacity-10 text-danger">
                  <FaLock size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">🔐 Account Security</h4>
                  <small className="text-muted">Palitan ang password at pamahalaan ang account security.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleUpdatePassword}>
                  <h6 className="fw-bold text-dark mb-3">Change Administrator Password</h6>
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-semibold text-dark">Current Password</label>
                      <input
                        type="password"
                        className="form-control py-2.5 rounded-3"
                        placeholder="Enter current password"
                        value={security.current_password}
                        onChange={(e) => setSecurity({ ...security, current_password: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">New Password</label>
                      <input
                        type="password"
                        className="form-control py-2.5 rounded-3"
                        placeholder="Min 6 characters"
                        value={security.new_password}
                        onChange={(e) => setSecurity({ ...security, new_password: e.target.value })}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Confirm Password</label>
                      <input
                        type="password"
                        className="form-control py-2.5 rounded-3"
                        placeholder="Re-enter new password"
                        value={security.confirm_password}
                        onChange={(e) => setSecurity({ ...security, confirm_password: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-end">
                    <button
                      type="submit"
                      className="btn btn-settings-primary px-4 py-2.5 rounded-3 d-flex align-items-center gap-2 ms-auto"
                      disabled={saving}
                    >
                      <FaShieldAlt size={14} /> {saving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>

                <hr className="my-4" />

                {/* Two-Factor Authentication */}
                <div className="setting-row-card d-flex align-items-center justify-content-between p-4 mb-4 settings-switch">
                  <div>
                    <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                      <FaShieldAlt className="text-primary" /> Two-Factor Authentication (2FA)
                    </h6>
                    <small className="text-muted">Add an additional security layer during administrator login.</small>
                  </div>
                  <div className="form-check form-switch fs-4 mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      checked={profile.two_factor_enabled}
                      onChange={(e) => handleToggle2FA(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Logout All Devices */}
                <div className="d-flex align-items-center justify-content-between p-4 rounded-4 border border-danger border-opacity-25 bg-danger bg-opacity-10">
                  <div>
                    <h6 className="fw-bold text-danger mb-1 d-flex align-items-center gap-2">
                      <FaSignOutAlt /> Logout All Devices
                    </h6>
                    <small className="text-danger opacity-75">Sign out from all active web sessions across mobile and desktop browsers.</small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-4 py-2.5 rounded-3 shadow-sm fw-semibold"
                    onClick={handleLogoutAllDevices}
                  >
                    Logout All Devices
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* POND SETTINGS SECTION */}
          {activeTab === 'pond' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-info bg-opacity-10 text-info">
                  <FaWater size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">🏞 Pond Settings</h4>
                  <small className="text-muted">Default pond configuration (hal. max ponds, auto numbering).</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSettingsGroup(pondSettings, 'Pond settings saved successfully!');
                  }}
                >
                  <div className="row g-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Maximum Number of Ponds</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        className="form-control py-2.5 rounded-3"
                        value={pondSettings.max_ponds}
                        onChange={(e) => setPondSettings({ ...pondSettings, max_ponds: e.target.value })}
                      />
                      <small className="text-muted">Default system pond limit (e.g. 30 ponds).</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Default Pond Status</label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={pondSettings.default_pond_status}
                        onChange={(e) => setPondSettings({ ...pondSettings, default_pond_status: e.target.value })}
                      >
                        <option value="Healthy">Healthy</option>
                        <option value="Warning">Warning</option>
                        <option value="Critical">Critical</option>
                      </select>
                      <small className="text-muted">Initial status assigned when creating a new pond.</small>
                    </div>

                    <div className="col-12">
                      <div className="setting-row-card d-flex align-items-center justify-content-between p-4 settings-switch">
                        <div>
                          <strong className="d-block text-dark mb-1">Auto Assign Pond Number</strong>
                          <small className="text-muted">Automatically generate sequential IDs for new pond additions (ON / OFF).</small>
                        </div>
                        <div className="form-check form-switch fs-4 mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={pondSettings.auto_assign_pond_number === 'ON'}
                            onChange={(e) =>
                              setPondSettings({
                                ...pondSettings,
                                auto_assign_pond_number: e.target.checked ? 'ON' : 'OFF'
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top text-end">
                    <button type="submit" className="btn btn-settings-primary px-4 py-2.5 rounded-3" disabled={saving}>
                      <FaSave size={14} className="me-2" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* HARVEST SETTINGS SECTION */}
          {activeTab === 'harvest' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-warning bg-opacity-10 text-warning">
                  <FaFish size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">🦐 Harvest Settings</h4>
                  <small className="text-muted">Itakda ang target harvest age at readiness threshold na ginagamit ng system.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSettingsGroup(harvestSettings, 'Harvest settings updated successfully!');
                  }}
                >
                  {/* Note / Guidance Alert Banner */}
                  <div className="harvest-rule-box p-4 mb-4 d-flex gap-3 align-items-start">
                    <FaExclamationTriangle className="text-warning flex-shrink-0 mt-1" size={22} />
                    <div>
                      <strong className="d-block text-dark mb-1 fs-6">Harvest Readiness Rule Guidance</strong>
                      <p className="mb-0 text-dark small">
                        <strong>📌 Note:</strong> Kapag umabot ng <strong>95%</strong>, magiging <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill">Upcoming Harvest</span>. Kapag <strong>100%</strong>, magiging <span className="badge bg-success px-2.5 py-1 rounded-pill">Ready to Harvest</span>.
                      </p>
                    </div>
                  </div>

                  <div className="row g-4">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Target Harvest Age (Days)</label>
                      <div className="input-group">
                        <input
                          type="number"
                          min="30"
                          max="300"
                          className="form-control py-2.5 rounded-start-3"
                          value={harvestSettings.target_harvest_age}
                          onChange={(e) => setHarvestSettings({ ...harvestSettings, target_harvest_age: e.target.value })}
                        />
                        <span className="input-group-text bg-light text-muted">Days</span>
                      </div>
                      <small className="text-muted">Standard culture cycle period (e.g. 120 Days).</small>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Harvest Ready Percentage (%)</label>
                      <div className="input-group">
                        <input
                          type="number"
                          min="50"
                          max="100"
                          className="form-control py-2.5 rounded-start-3"
                          value={harvestSettings.harvest_ready_percentage}
                          onChange={(e) => setHarvestSettings({ ...harvestSettings, harvest_ready_percentage: e.target.value })}
                        />
                        <span className="input-group-text bg-light text-muted">%</span>
                      </div>
                      <small className="text-muted">Readiness threshold percentage (e.g. 95%).</small>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold text-dark">Prediction Refresh Frequency</label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={harvestSettings.prediction_refresh}
                        onChange={(e) => setHarvestSettings({ ...harvestSettings, prediction_refresh: e.target.value })}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Manual">Manual</option>
                      </select>
                      <small className="text-muted">How often harvest biomass & readiness predictions update.</small>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top text-end">
                    <button type="submit" className="btn btn-settings-primary px-4 py-2.5 rounded-3" disabled={saving}>
                      <FaSave size={14} className="me-2" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* NOTIFICATION SETTINGS SECTION */}
          {activeTab === 'notification' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-primary bg-opacity-10 text-primary">
                  <FaBell size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">🔔 Notification Settings</h4>
                  <small className="text-muted">Piliin kung aling alerts ang matatanggap ng admin.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSettingsGroup(notificationSettings, 'Notification preferences saved successfully!');
                  }}
                >
                  <div className="d-flex flex-column gap-3 settings-switch">
                    {/* Disease Alerts */}
                    <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                      <div>
                        <strong className="d-block text-dark mb-1">Receive Disease Alerts</strong>
                        <small className="text-muted">Get immediate alerts when caretaker scans detect disease risk.</small>
                      </div>
                      <div className="form-check form-switch fs-4 mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={notificationSettings.receive_disease_alerts === 'ON'}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              receive_disease_alerts: e.target.checked ? 'ON' : 'OFF'
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Harvest Alerts */}
                    <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                      <div>
                        <strong className="d-block text-dark mb-1">Receive Harvest Alerts</strong>
                        <small className="text-muted">Receive notifications when ponds hit 95% or 100% harvest readiness.</small>
                      </div>
                      <div className="form-check form-switch fs-4 mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={notificationSettings.receive_harvest_alerts === 'ON'}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              receive_harvest_alerts: e.target.checked ? 'ON' : 'OFF'
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Feeding Alerts */}
                    <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                      <div>
                        <strong className="d-block text-dark mb-1">Receive Feeding Alerts</strong>
                        <small className="text-muted">Notify admin when feeding schedules or daily feed logs are submitted.</small>
                      </div>
                      <div className="form-check form-switch fs-4 mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={notificationSettings.receive_feeding_alerts === 'ON'}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              receive_feeding_alerts: e.target.checked ? 'ON' : 'OFF'
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Caretaker Activity Alerts */}
                    <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                      <div>
                        <strong className="d-block text-dark mb-1">Receive Caretaker Activity Alerts</strong>
                        <small className="text-muted">Alert when caretakers log water quality, water maintenance, or login activity.</small>
                      </div>
                      <div className="form-check form-switch fs-4 mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={notificationSettings.receive_caretaker_activity_alerts === 'ON'}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              receive_caretaker_activity_alerts: e.target.checked ? 'ON' : 'OFF'
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Email Notifications */}
                    <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                      <div>
                        <strong className="d-block text-dark mb-1">Receive Email Notifications</strong>
                        <small className="text-muted">Send urgent system summaries directly to administrator email address.</small>
                      </div>
                      <div className="form-check form-switch fs-4 mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={notificationSettings.receive_email_notifications === 'ON'}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              receive_email_notifications: e.target.checked ? 'ON' : 'OFF'
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top text-end">
                    <button type="submit" className="btn btn-settings-primary px-4 py-2.5 rounded-3" disabled={saving}>
                      <FaSave size={14} className="me-2" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SYSTEM PREFERENCES SECTION */}
          {activeTab === 'preference' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-secondary bg-opacity-10 text-secondary">
                  <FaSlidersH size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">📄 System Preferences</h4>
                  <small className="text-muted">Theme, language, at date/time format.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSettingsGroup(systemPreferences, 'System preferences updated successfully!');
                  }}
                >
                  <div className="row g-4">
                    {/* Theme Mode Toggle Selector */}
                    <div className="col-12">
                      <label className="form-label fw-semibold text-dark">Display Theme Mode</label>
                      <div className="setting-row-card d-flex align-items-center justify-content-between p-4">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className={`p-3 rounded-circle d-flex align-items-center justify-content-center ${
                              systemPreferences.theme === 'Dark'
                                ? 'bg-dark text-warning'
                                : 'bg-warning bg-opacity-10 text-warning'
                            }`}
                            style={{ width: 48, height: 48 }}
                          >
                            {systemPreferences.theme === 'Dark' ? <FaMoon size={22} /> : <FaSun size={22} />}
                          </div>
                          <div>
                            <strong className="d-block text-dark mb-0 fs-6">
                              {systemPreferences.theme} Mode
                            </strong>
                            <small className="text-muted">
                              {systemPreferences.theme === 'Dark'
                                ? 'Dark theme is active. Reduces eye strain and optimizes low-light visibility.'
                                : 'Clean standard Light theme is active.'}
                            </small>
                          </div>
                        </div>

                        <div className="btn-group" role="group">
                          <button
                            type="button"
                            className={`btn btn-sm px-3.5 py-2 fw-semibold ${
                              systemPreferences.theme === 'Light' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
                            }`}
                            onClick={() => handleThemeChange('Light')}
                          >
                            <FaSun className="me-1.5" /> Light
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm px-3.5 py-2 fw-semibold ${
                              systemPreferences.theme === 'Dark' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
                            }`}
                            onClick={() => handleThemeChange('Dark')}
                          >
                            <FaMoon className="me-1.5" /> Dark
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Language */}
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1.5">
                        <FaGlobe className="text-primary" /> Language
                      </label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={systemPreferences.language}
                        onChange={(e) => setSystemPreferences({ ...systemPreferences, language: e.target.value })}
                      >
                        <option value="English">English</option>
                        <option value="Tagalog / Filipino">Tagalog / Filipino</option>
                      </select>
                    </div>

                    {/* Date Format */}
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1.5">
                        <FaCalendarAlt className="text-primary" /> Date Format
                      </label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={systemPreferences.date_format}
                        onChange={(e) => setSystemPreferences({ ...systemPreferences, date_format: e.target.value })}
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>

                    {/* Time Format */}
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1.5">
                        <FaClock className="text-primary" /> Time Format
                      </label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={systemPreferences.time_format}
                        onChange={(e) => setSystemPreferences({ ...systemPreferences, time_format: e.target.value })}
                      >
                        <option value="12 Hours">12 Hours (AM/PM)</option>
                        <option value="24 Hours">24 Hours (Military)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top text-end">
                    <button type="submit" className="btn btn-settings-primary px-4 py-2.5 rounded-3" disabled={saving}>
                      <FaSave size={14} className="me-2" /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* BACKUP & RESTORE SECTION */}
          {activeTab === 'backup' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-success bg-opacity-10 text-success">
                  <FaDatabase size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">💾 Backup & Restore</h4>
                  <small className="text-muted">Gumawa o mag-restore ng backup ng system data.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveSettingsGroup(backupSettings, 'Backup configurations saved successfully!');
                  }}
                >
                  <div className="row g-4">
                    {/* Last Backup Display */}
                    <div className="col-12">
                      <div className="p-4 rounded-4 bg-light border d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                        <div>
                          <strong className="d-block text-dark mb-1">Last Backup Timestamp</strong>
                          <span className="fs-5 fw-bold text-primary">{backupSettings.last_backup}</span>
                        </div>
                        <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill fw-semibold fs-6">
                          <FaCheckCircle className="me-1.5" /> Backup Verified
                        </span>
                      </div>
                    </div>

                    {/* Automatic Backup */}
                    <div className="col-12 col-md-6">
                      <div className="setting-row-card d-flex align-items-center justify-content-between p-4 h-100 settings-switch">
                        <div>
                          <strong className="d-block text-dark mb-1">Automatic Backup</strong>
                          <small className="text-muted">Enable scheduled database snapshots.</small>
                        </div>
                        <div className="form-check form-switch fs-4 mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={backupSettings.automatic_backup === 'ON'}
                            onChange={(e) =>
                              setBackupSettings({
                                ...backupSettings,
                                automatic_backup: e.target.checked ? 'ON' : 'OFF'
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Backup Frequency */}
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold text-dark">Backup Frequency</label>
                      <select
                        className="form-select py-2.5 rounded-3"
                        value={backupSettings.backup_frequency}
                        onChange={(e) => setBackupSettings({ ...backupSettings, backup_frequency: e.target.value })}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                      <small className="text-muted">How often automatic backups occur.</small>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top text-end">
                    <button type="submit" className="btn btn-settings-primary px-4 py-2.5 rounded-3" disabled={saving}>
                      <FaSave size={14} className="me-2" /> {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>

                <hr className="my-4" />

                {/* Backup & Restore Action Buttons */}
                <h6 className="fw-bold text-dark mb-3">Database Actions</h6>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-primary bg-opacity-10 d-flex flex-column gap-2">
                      <strong className="text-dark fs-6">Export Database Snapshot</strong>
                      <p className="small text-muted mb-2">Download complete SQL data dump of shrim_predict_db directly to your disk.</p>
                      <button
                        type="button"
                        className="btn btn-settings-primary rounded-3 py-2.5 d-flex align-items-center justify-content-center gap-2"
                        onClick={handleBackupNow}
                      >
                        <FaDownload size={14} /> Backup Now
                      </button>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-warning bg-opacity-10 d-flex flex-column gap-2">
                      <strong className="text-dark fs-6">Restore Database Backup</strong>
                      <p className="small text-muted mb-2">Upload a previously generated .sql file to restore tables and system records.</p>
                      <button
                        type="button"
                        className="btn btn-warning text-dark rounded-3 py-2.5 d-flex align-items-center justify-content-center gap-2 shadow-sm fw-bold"
                        onClick={handleRestoreBackup}
                        disabled={saving}
                      >
                        <FaUpload size={14} /> Restore Backup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ARCHIVED CARETAKERS SECTION */}
          {activeTab === 'archived_caretakers' && (
            <div className="settings-card bg-white shadow-sm border border-slate-200 rounded-4 overflow-hidden mb-4">
              <div className="settings-card-header p-4 border-bottom bg-slate-50 d-flex align-items-center justify-content-between flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="settings-icon-badge p-3 rounded-4 bg-warning bg-opacity-10 text-warning">
                    <FaUserCheck size={20} />
                  </div>
                  <div>
                    <h4 className="fw-bold mb-0 text-dark">📁 Archived Caretakers Directory</h4>
                    <small className="text-muted">Preserved record archives of resigned, inactive, or former farm caretakers.</small>
                  </div>
                </div>
                <span className="badge bg-warning bg-opacity-10 text-warning rounded-pill px-3.5 py-1.5 extra-small fw-bold">
                  {archivedCaretakers.length} Archived Accounts
                </span>
              </div>

              <div className="card-body p-4">
                {/* Search Bar */}
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                  <div className="position-relative flex-grow-1" style={{ maxWidth: 380 }}>
                    <FaSearch className="position-absolute top-50 translate-middle-y text-muted" style={{ left: 14 }} />
                    <input
                      type="text"
                      className="form-control ps-5 rounded-3 py-2 border-slate-200"
                      placeholder="Search by name, employee ID, or reason..."
                      value={archivedSearch}
                      onChange={(e) => setArchivedSearch(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 px-3 py-2 d-flex align-items-center gap-1.5" onClick={fetchArchivedCaretakers}>
                    <FaHistory /> Refresh Repository
                  </button>
                </div>

                {/* Table View (Matching user's requested layout format) */}
                <div className="table-responsive border rounded-4 bg-white">
                  {loadingArchived ? (
                    <div className="text-center py-5 text-muted">
                      <div className="spinner-border text-warning" role="status"></div>
                      <p className="mt-2 mb-0">Loading Archived Caretakers Directory...</p>
                    </div>
                  ) : archivedCaretakers.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <FaUserCheck size={36} className="text-warning mb-2 opacity-50" />
                      <h6 className="fw-bold mb-1">No Archived Caretakers Found</h6>
                      <p className="small mb-0">Resigned or archived caretaker records will appear here.</p>
                    </div>
                  ) : (
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ padding: '12px 16px' }}>Name</th>
                          <th style={{ padding: '12px 16px' }}>Employee ID</th>
                          <th style={{ padding: '12px 16px' }}>Date Hired</th>
                          <th style={{ padding: '12px 16px' }}>Date Archived</th>
                          <th style={{ padding: '12px 16px' }}>Reason</th>
                          <th style={{ padding: '12px 16px' }} className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedCaretakers
                          .filter((c) => {
                            if (!archivedSearch.trim()) return true;
                            const q = archivedSearch.toLowerCase();
                            return (
                              c.full_name.toLowerCase().includes(q) ||
                              (c.employee_id && c.employee_id.toLowerCase().includes(q)) ||
                              (c.archive_reason && c.archive_reason.toLowerCase().includes(q))
                            );
                          })
                          .map((caretaker) => (
                            <tr key={caretaker.id}>
                              <td style={{ padding: '14px 16px' }}>
                                <div className="d-flex align-items-center gap-2.5">
                                  <div
                                    className="rounded-circle bg-warning bg-opacity-10 text-warning fw-bold d-flex align-items-center justify-content-center border border-warning border-opacity-25"
                                    style={{ width: 38, height: 38, fontSize: '0.9rem' }}
                                  >
                                    {caretaker.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <strong className="text-dark d-block leading-tight">{caretaker.full_name}</strong>
                                    <small className="text-muted extra-small">{caretaker.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2.5 py-1 rounded-pill font-mono extra-small fw-semibold">
                                  {caretaker.employee_id}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }} className="small text-muted">
                                {caretaker.date_hired_formatted}
                              </td>
                              <td style={{ padding: '14px 16px' }} className="small text-dark fw-semibold">
                                {caretaker.date_archived_formatted}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-semibold">
                                  {caretaker.archive_reason}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px' }} className="text-end">
                                <div className="d-flex align-items-center justify-content-end gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary rounded-3 px-2.5 py-1 extra-small fw-semibold d-flex align-items-center gap-1"
                                    onClick={() => openArchivedDetails(caretaker.id)}
                                  >
                                    <FaEye size={12} /> View Details
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success rounded-3 px-2.5 py-1 extra-small fw-semibold d-flex align-items-center gap-1"
                                    onClick={() => handleRestoreCaretaker(caretaker)}
                                  >
                                    <FaUserCheck size={12} /> Restore
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger rounded-3 p-1.5 extra-small"
                                    title="Delete Permanently"
                                    onClick={() => handleDeletePermanently(caretaker)}
                                  >
                                    <FaTrashAlt size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABOUT SYSTEM SECTION */}
          {activeTab === 'about' && (
            <div className="settings-card bg-white">
              <div className="settings-card-header p-4 d-flex align-items-center gap-3">
                <div className="p-3 rounded-4 bg-primary bg-opacity-10 text-primary">
                  <FaInfoCircle size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">ℹ About System</h4>
                  <small className="text-muted">Impormasyon tungkol sa system at development team.</small>
                </div>
              </div>
              <div className="card-body p-4">
                <div className="p-4 rounded-4 bg-light border text-center mb-4">
                  <div
                    className="mx-auto rounded-4 bg-primary text-white d-flex align-items-center justify-content-center mb-3 shadow-lg"
                    style={{ width: 78, height: 78, fontSize: '2rem', fontWeight: 800 }}
                  >
                    🦐
                  </div>
                  <h3 className="fw-bold text-primary mb-1">ShrimpPredict</h3>
                  <span className="badge bg-primary px-3.5 py-1.5 rounded-pill fs-6 fw-normal mb-2">
                    Version 1.0
                  </span>
                  <p className="text-muted max-w-md mx-auto small">
                    Smart AI-Powered Shrimp Disease Risk Prediction & Pond Monitoring System.
                  </p>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="setting-row-card p-3.5">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Developed By</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-2">
                        <FaUser className="text-primary" /> Team ShrimpPredict
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="setting-row-card p-3.5">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Educational Institution</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-2">
                        <FaDesktop className="text-primary" /> Batangas State University
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="setting-row-card p-3.5">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Academic Year</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-2">
                        <FaCalendarAlt className="text-primary" /> 2026
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="setting-row-card p-3.5">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">System Operational Status</small>
                      <strong className="fs-6 text-success d-flex align-items-center gap-2">
                        <FaCheckCircle /> Active & Operational
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📁 FULL ARCHIVED CARETAKER DETAILS MODAL */}
      {(selectedArchivedDetails || loadingDetails) && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header bg-dark text-white p-4 border-bottom border-secondary">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center shadow-sm"
                    style={{ width: 52, height: 52, fontSize: '1.4rem' }}
                  >
                    {selectedArchivedDetails?.personal_info?.full_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-1 d-flex align-items-center gap-2">
                      {selectedArchivedDetails?.personal_info?.full_name || 'Loading Caretaker Profile...'}
                      <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill extra-small font-mono fw-bold">
                        {selectedArchivedDetails?.personal_info?.employee_id || 'CT-001'}
                      </span>
                    </h5>
                    <div className="d-flex align-items-center gap-2 extra-small text-slate-300">
                      <span className="badge bg-danger bg-opacity-75 text-white rounded-pill px-2 py-0.5">
                        {selectedArchivedDetails?.personal_info?.employment_status || 'Archived / Resigned'}
                      </span>
                      <span>• Date Archived: {selectedArchivedDetails?.personal_info?.date_archived}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedArchivedDetails(null)}
                />
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-light">
                {loadingDetails ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="mt-2 text-muted">Retrieving archived profile logs & performance history...</p>
                  </div>
                ) : selectedArchivedDetails ? (
                  <div className="d-flex flex-column gap-4">
                    {/* 1. Personal Information Card */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                      <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                        <FaUser /> Personal Information
                      </h6>
                      <div className="row g-3">
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Full Name</small>
                          <strong className="text-dark fs-6">{selectedArchivedDetails.personal_info.full_name}</strong>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Contact Number</small>
                          <span className="text-dark fw-semibold">{selectedArchivedDetails.personal_info.contact_number}</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Email Address</small>
                          <span className="text-dark fw-semibold">{selectedArchivedDetails.personal_info.email}</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Home Address</small>
                          <span className="text-dark">{selectedArchivedDetails.personal_info.address}</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Employee ID</small>
                          <span className="badge bg-secondary bg-opacity-10 text-secondary border font-mono fw-bold">
                            {selectedArchivedDetails.personal_info.employee_id}
                          </span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Date Hired</small>
                          <span className="text-dark fw-semibold">{selectedArchivedDetails.personal_info.date_hired}</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Date Archived</small>
                          <span className="text-dark fw-semibold">{selectedArchivedDetails.personal_info.date_archived}</span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Employment Status</small>
                          <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2.5 py-1 rounded-pill fw-semibold">
                            {selectedArchivedDetails.personal_info.employment_status}
                          </span>
                        </div>
                        <div className="col-12 col-sm-6 col-md-4">
                          <small className="text-muted extra-small fw-bold text-uppercase d-block mb-1">Reason for Archiving</small>
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 rounded-pill fw-bold">
                            {selectedArchivedDetails.personal_info.archive_reason}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Assigned Ponds Card */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                      <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                        <FaWater /> Historically Assigned Ponds
                      </h6>
                      <div className="d-flex flex-wrap gap-2">
                        {selectedArchivedDetails.assigned_ponds.map((p) => (
                          <span key={p.id} className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill fs-6 fw-semibold d-flex align-items-center gap-1.5">
                            <FaWater /> {p.pond_name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 3. Performance History Grid */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                      <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                        <FaStar /> Performance History & Analytics
                      </h6>
                      <div className="row g-3">
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Total Working Days</small>
                            <h4 className="fw-extrabold text-dark mb-0">{selectedArchivedDetails.performance.total_working_days} Days</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Total Feeding Records</small>
                            <h4 className="fw-extrabold text-primary mb-0">{selectedArchivedDetails.performance.total_feeding_records} Logs</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Total Disease Scans</small>
                            <h4 className="fw-extrabold text-info mb-0">{selectedArchivedDetails.performance.total_disease_scans} Scans</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Avg. Feeding Accuracy</small>
                            <h4 className="fw-extrabold text-success mb-0">{selectedArchivedDetails.performance.avg_feeding_accuracy}</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Successful Reports</small>
                            <h4 className="fw-extrabold text-success mb-0">{selectedArchivedDetails.performance.successful_reports_submitted} Submitted</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Missed Reports</small>
                            <h4 className="fw-extrabold text-dark mb-0">{selectedArchivedDetails.performance.missed_reports}</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">Late Reports</small>
                            <h4 className="fw-extrabold text-warning mb-0">{selectedArchivedDetails.performance.late_reports}</h4>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-md-3">
                          <div className="p-3 rounded-4 bg-light border">
                            <small className="text-muted extra-small fw-semibold d-block mb-1">AI Detection Accuracy</small>
                            <h4 className="fw-extrabold text-primary mb-0">{selectedArchivedDetails.performance.ai_detection_accuracy}</h4>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Preserved Activity History Logs */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                      <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                        <FaClipboardList /> Preserved Activity History & Full Caretaker Logs
                      </h6>
                      <div className="row g-2 mb-3">
                        <div className="col-auto">
                          <span className="badge bg-light text-dark border px-3 py-2 rounded-pill small">
                            <FaUtensils className="me-1 text-primary" /> Feeding Logs: <strong>{selectedArchivedDetails.activity_history.feeding_logs_count}</strong>
                          </span>
                        </div>
                        <div className="col-auto">
                          <span className="badge bg-light text-dark border px-3 py-2 rounded-pill small">
                            <FaBug className="me-1 text-danger" /> Disease Scans: <strong>{selectedArchivedDetails.activity_history.disease_scans_count}</strong>
                          </span>
                        </div>
                        <div className="col-auto">
                          <span className="badge bg-light text-dark border px-3 py-2 rounded-pill small">
                            <FaWater className="me-1 text-info" /> Water Quality Records: <strong>{selectedArchivedDetails.activity_history.water_quality_records_count}</strong>
                          </span>
                        </div>
                        <div className="col-auto">
                          <span className="badge bg-light text-dark border px-3 py-2 rounded-pill small">
                            <FaBell className="me-1 text-warning" /> Reports Submitted: <strong>{selectedArchivedDetails.activity_history.reports_submitted_count}</strong>
                          </span>
                        </div>
                      </div>

                      {/* A. PRESERVED FEEDING LOGS */}
                      {selectedArchivedDetails.activity_history.recent_feeding_logs?.length > 0 && (
                        <div className="mt-3 mb-4">
                          <small className="fw-bold text-primary text-uppercase extra-small mb-2 d-flex align-items-center gap-1">
                            <FaUtensils /> Preserved Feeding Logs History
                          </small>
                          <div className="table-responsive rounded-3 border" style={{ maxHeight: 240, overflowY: 'auto' }}>
                            <table className="table table-sm align-middle text-start small mb-0">
                              <thead className="table-light sticky-top">
                                <tr>
                                  <th className="ps-3">Time / Session</th>
                                  <th>Pond</th>
                                  <th>Feed Type</th>
                                  <th>Amount (kg)</th>
                                  <th>Vitamins</th>
                                  <th>Date</th>
                                  <th className="pe-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedArchivedDetails.activity_history.recent_feeding_logs.map((f) => (
                                  <tr key={f.id}>
                                    <td className="ps-3 fw-bold text-primary">{f.feeding_time || '06:00 AM'}</td>
                                    <td>
                                      <span className="badge bg-light text-primary border border-primary border-opacity-25 px-2 py-0.5 fw-semibold">{f.pond_name || 'Pond A1'}</span>
                                    </td>
                                    <td className="fw-semibold text-dark">{f.feed_type || 'Tateh - Starter'}</td>
                                    <td className="fw-bold text-success">{f.amount_kg} kg</td>
                                    <td>
                                      {f.vitamin_name && f.vitamin_name !== 'None' ? (
                                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">+ {f.vitamin_name}</span>
                                      ) : (
                                        <span className="text-muted extra-small">None</span>
                                      )}
                                    </td>
                                    <td className="text-muted extra-small">{f.record_date}</td>
                                    <td className="pe-3 text-secondary extra-small">{f.notes || 'Normal feeding session'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* B. PRESERVED DISEASE SCANS */}
                      {selectedArchivedDetails.activity_history.recent_disease_scans?.length > 0 && (
                        <div className="mb-4">
                          <small className="fw-bold text-danger text-uppercase extra-small mb-2 d-flex align-items-center gap-1">
                            <FaBug /> Preserved Disease Risk Scans
                          </small>
                          <div className="table-responsive rounded-3 border" style={{ maxHeight: 240, overflowY: 'auto' }}>
                            <table className="table table-sm align-middle text-start small mb-0">
                              <thead className="table-light sticky-top">
                                <tr>
                                  <th className="ps-3">Pond</th>
                                  <th>Disease Detected</th>
                                  <th>Confidence</th>
                                  <th>Risk Level</th>
                                  <th>Date & Time</th>
                                  <th className="pe-3">Recommendation</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedArchivedDetails.activity_history.recent_disease_scans.map((d) => (
                                  <tr key={d.id}>
                                    <td className="ps-3">
                                      <span className="badge bg-light text-primary border border-primary border-opacity-25 px-2 py-0.5 fw-semibold">{d.pond_name || 'Pond A1'}</span>
                                    </td>
                                    <td className="fw-bold text-dark">{d.disease_name}</td>
                                    <td className="fw-semibold">{Number(d.confidence_score || 0).toFixed(2)}%</td>
                                    <td>
                                      <span className={`badge ${d.risk_level === 'High' ? 'bg-danger' : d.risk_level === 'Medium' ? 'bg-warning text-dark' : 'bg-success'} rounded-pill extra-small`}>
                                        {d.risk_level || 'Low'}
                                      </span>
                                    </td>
                                    <td className="text-muted extra-small">{d.created_at}</td>
                                    <td className="pe-3 text-secondary extra-small" style={{ maxWidth: 220 }}>{d.recommendation || 'Monitor closely.'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* C. PRESERVED WATER QUALITY RECORDS */}
                      {selectedArchivedDetails.activity_history.water_quality_records?.length > 0 && (
                        <div className="mb-4">
                          <small className="fw-bold text-info text-uppercase extra-small mb-2 d-flex align-items-center gap-1">
                            <FaWater /> Preserved Water Quality & Pond Conditions
                          </small>
                          <div className="table-responsive rounded-3 border">
                            <table className="table table-sm align-middle text-start small mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th className="ps-3">Pond</th>
                                  <th>Temperature</th>
                                  <th>pH Level</th>
                                  <th>Salinity</th>
                                  <th>Dissolved Oxygen</th>
                                  <th className="pe-3">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedArchivedDetails.activity_history.water_quality_records.map((w) => (
                                  <tr key={w.id}>
                                    <td className="ps-3 fw-bold text-dark">{w.pond_name}</td>
                                    <td>{w.temperature ? `${w.temperature}°C` : '29.5°C'}</td>
                                    <td>{w.ph_level || '7.6'}</td>
                                    <td>{w.salinity ? `${w.salinity} ppt` : '18.0 ppt'}</td>
                                    <td>{w.dissolved_oxygen ? `${w.dissolved_oxygen} mg/L` : '6.5 mg/L'}</td>
                                    <td className="pe-3">
                                      <span className={`badge ${w.status === 'Healthy' ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' : 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25'} rounded-pill extra-small`}>
                                        {w.status || 'Healthy'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* D. PRESERVED SUBMITTED REPORTS */}
                      {selectedArchivedDetails.activity_history.recent_reports?.length > 0 && (
                        <div className="mt-2">
                          <small className="fw-bold text-dark text-uppercase extra-small mb-2 d-block">Submitted Problem Reports History</small>
                          <div className="table-responsive border rounded-3">
                            <table className="table table-sm align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th>Report Title</th>
                                  <th>Pond</th>
                                  <th>Type</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedArchivedDetails.activity_history.recent_reports.map((rep) => (
                                  <tr key={rep.id}>
                                    <td className="fw-semibold text-dark">{rep.title}</td>
                                    <td>{rep.pond_name}</td>
                                    <td>{rep.problem_type}</td>
                                    <td>
                                      <span className={`badge ${rep.status === 'Done' ? 'bg-success' : 'bg-warning text-dark'} rounded-pill extra-small`}>
                                        {rep.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Login History Card */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                      <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                        <FaClock /> Login & Activity History
                      </h6>
                      <div className="row g-3">
                        <div className="col-12 col-md-4">
                          <small className="text-muted extra-small fw-semibold d-block mb-1">Last Login</small>
                          <strong className="text-dark">{selectedArchivedDetails.login_history.last_login}</strong>
                        </div>
                        <div className="col-12 col-md-4">
                          <small className="text-muted extra-small fw-semibold d-block mb-1">Last Active Session</small>
                          <strong className="text-dark">{selectedArchivedDetails.login_history.last_active}</strong>
                        </div>
                        <div className="col-12 col-md-4">
                          <small className="text-muted extra-small fw-semibold d-block mb-1">Total System Logins</small>
                          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-bold">
                            {selectedArchivedDetails.login_history.total_logins} Logins
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Modal Footer Actions */}
              <div className="modal-footer bg-white p-3 border-top d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  {selectedArchivedDetails && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold"
                        onClick={() => handleRestoreCaretaker(selectedArchivedDetails)}
                      >
                        <FaUserCheck /> Restore Caretaker Account
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger px-3 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold"
                        onClick={() => handleDeletePermanently(selectedArchivedDetails)}
                      >
                        <FaTrashAlt /> Delete Permanently
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2 rounded-3"
                  onClick={() => setSelectedArchivedDetails(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
