import { useState, useEffect, useRef } from 'react';
import {
  FaUser,
  FaLock,
  FaWater,
  FaBell,
  FaSlidersH,
  FaInfoCircle,
  FaSearch,
  FaCamera,
  FaSave,
  FaTrash,
  FaShieldAlt,
  FaCheckCircle,
  FaSun,
  FaMoon,
  FaClock,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaUserCheck,
  FaToggleOn,
  FaToggleOff,
  FaUtensils,
  FaExclamationTriangle,
  FaDesktop,
  FaEdit,
  FaTimes,
  FaKey,
  FaEye,
  FaEyeSlash,
  FaSignOutAlt
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { applyAppTheme } from '../../main';

export default function CaretakerSettingsPage() {
  const { user: authUser, updateUser, logout } = useAuth();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState(null);

  // Caretaker Profile State
  const [profile, setProfile] = useState({
    id: authUser?.id || 0,
    full_name: authUser?.full_name || 'Caretaker Operator',
    email: authUser?.email || 'caretaker@shrimpredict.com',
    phone: authUser?.phone || '09171234567',
    position: authUser?.position || 'Pond Caretaker',
    avatar_path: authUser?.avatar_path || '',
    last_login: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  });

  // Password / Security State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [security, setSecurity] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Pond Preferences State
  const [pondPreferences, setPondPreferences] = useState({
    target_feed_kg: '45.0',
    default_feeding_slot: '6:00 AM',
    auto_refresh_logs: 'ON',
    feeding_unit: 'Kilograms (kg)'
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    disease_alerts: 'ON',
    feeding_reminders: 'ON',
    inventory_notices: 'ON',
    sound_alerts: 'ON'
  });

  // Display & System Preferences State
  const [displayPreferences, setDisplayPreferences] = useState({
    theme: localStorage.getItem('shrim_theme') === 'dark' ? 'Dark' : 'Light',
    language: 'English',
    date_format: 'YYYY-MM-DD',
    time_format: '12 Hours (AM/PM)'
  });

  // Fetch initial profile & settings from backend MySQL database
  useEffect(() => {
    fetchCaretakerSettings();
  }, [authUser?.id]);

  const fetchCaretakerSettings = async () => {
    setLoading(true);
    try {
      if (authUser?.id) {
        // Fetch profile
        try {
          const profRes = await api.get('/profile.php', { params: { user_id: authUser.id } });
          if (profRes.data?.success && profRes.data.profile) {
            const p = profRes.data.profile;
            setProfile((prev) => ({
              ...prev,
              id: p.id || prev.id,
              full_name: p.full_name || prev.full_name,
              email: p.email || prev.email,
              phone: p.phone || prev.phone,
              position: p.position || prev.position,
              avatar_path: p.avatar_path || prev.avatar_path,
              last_login: p.last_login || prev.last_login
            }));
          }
        } catch (err) {
          console.warn('Profile load warning:', err);
        }

        // Fetch settings
        try {
          const setRes = await api.get('/settings.php');
          if (setRes.data?.success && setRes.data.settings) {
            const s = setRes.data.settings;
            if (s.caretaker_target_feed) setPondPreferences((prev) => ({ ...prev, target_feed_kg: s.caretaker_target_feed }));
            if (s.caretaker_default_slot) setPondPreferences((prev) => ({ ...prev, default_feeding_slot: s.caretaker_default_slot }));
            if (s.caretaker_auto_refresh) setPondPreferences((prev) => ({ ...prev, auto_refresh_logs: s.caretaker_auto_refresh }));
            if (s.caretaker_disease_alerts) setNotificationSettings((prev) => ({ ...prev, disease_alerts: s.caretaker_disease_alerts }));
            if (s.caretaker_feeding_reminders) setNotificationSettings((prev) => ({ ...prev, feeding_reminders: s.caretaker_feeding_reminders }));
            if (s.caretaker_language) setDisplayPreferences((prev) => ({ ...prev, language: s.caretaker_language }));
          }
        } catch (err) {
          console.warn('Settings load warning:', err);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Avatar Image Handler
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: 'Invalid File', text: 'Please choose a valid image file (JPG, PNG, GIF).' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'File Too Large', text: 'Please upload an image below 2 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, avatar_path: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setProfile((prev) => ({ ...prev, avatar_path: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Profile Handler
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        action: 'update_profile',
        user_id: profile.id || authUser?.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        position: profile.position || 'Pond Caretaker',
        avatar_path: profile.avatar_path
      };

      const res = await api.post('/profile.php', payload);
      if (!res.data?.success) throw new Error(res.data?.message || 'Unable to update profile.');

      const nextUser = res.data.user || profile;
      updateUser?.({
        ...nextUser,
        assigned_ponds: authUser?.assigned_ponds || [],
        pond_id: authUser?.pond_id
      });

      setIsEditingProfile(false);
      Swal.fire({
        icon: 'success',
        title: 'Profile Updated',
        text: 'Your caretaker profile information has been saved in the database.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  // Update Password Handler
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
        user_id: profile.id || authUser?.id,
        current_password: security.current_password,
        new_password: security.new_password
      });

      if (res.data?.success) {
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

  // Save Settings Helper
  const handleSaveGenericSettings = async (settingsObject, successMessage) => {
    setSaving(true);
    try {
      const res = await api.post('/settings.php', { settings: settingsObject });
      if (!res.data?.success) throw new Error(res.data?.message || 'Unable to save settings.');

      Swal.fire({
        icon: 'success',
        title: 'Settings Saved',
        text: successMessage,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  // Menu Tabs Configuration
  const navTabs = [
    { id: 'profile', label: 'Operator Profile', icon: FaUser, desc: 'Personal profile & contact details' },
    { id: 'security', label: 'Account Security', icon: FaLock, desc: 'Password & credential management' },
    { id: 'pond_preferences', label: 'Basin Feeding Defaults', icon: FaWater, desc: 'Daily target & feeding slot defaults' },
    { id: 'notifications', label: 'Alert & Reminder Toggles', icon: FaBell, desc: 'Disease alerts & schedule notices' },
    { id: 'display', label: 'Display & Appearance', icon: FaSlidersH, desc: 'Theme, language & date preferences' },
    { id: 'about', label: 'System Information', icon: FaInfoCircle, desc: 'System build info & operating manual' }
  ];

  const filteredTabs = navTabs.filter(
    (t) =>
      t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTabInfo = navTabs.find((t) => t.id === activeTab) || navTabs[0];
  const ActiveTabIcon = activeTabInfo.icon;

  const initials = (profile.full_name || authUser?.full_name || 'Caretaker')
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="caretaker-settings-hub pb-5">
      {/* 🌟 HERO CONTROL STRIP */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill fw-bold extra-small"
              style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}
            >
              ● OPERATOR PREFERENCES
            </span>
            <span className="text-muted extra-small">
              Caretaker Profile, Security, Feeding Preferences & Alerts
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 mt-1 tracking-tight text-dark" style={{ fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Account & System Settings
          </h2>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-1.5 extra-small fw-bold border border-success border-opacity-25">
            <FaUserCheck className="me-1" /> Active Caretaker Session
          </span>
        </div>
      </div>

      <div className="row g-4">
        {/* LEFT SETTINGS MENU SIDEBAR */}
        <div className="col-12 col-lg-4 col-xl-3">
          <div className="settings-card bg-white p-3 rounded-4 border border-slate-200 shadow-xs sticky-top" style={{ top: 20, zIndex: 10 }}>
            {/* Header + Integrated Search */}
            <div className="px-1 pb-3 mb-2 border-bottom">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-uppercase fw-bold text-muted extra-small tracking-wider">SETTINGS MENU</span>
                <span className="badge bg-primary bg-opacity-10 text-primary extra-small rounded-pill fw-semibold">
                  {filteredTabs.length} Tabs
                </span>
              </div>

              <div className="position-relative mt-2">
                <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 14, fontSize: '0.82rem' }} />
                <input
                  type="text"
                  className="form-control form-control-sm ps-5 pe-4 py-2.5 rounded-3 border-slate-200 shadow-xs"
                  placeholder="Search Settings..."
                  style={{ fontSize: '0.84rem' }}
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

            {/* Nav Items List */}
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
                      className={`settings-nav-item nav-link text-start d-flex align-items-center gap-3 py-2.5 px-3 border-0 transition-all ${
                        isActive ? 'active' : 'text-dark'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="settings-nav-icon p-2 rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: isActive ? 'rgba(11, 44, 95, 0.12)' : 'rgba(11, 44, 95, 0.05)',
                          color: isActive ? '#0B2C5F' : '#64748B'
                        }}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="text-truncate flex-grow-1">
                        <div className="fw-bold fs-6 lh-1 mb-1">{t.label}</div>
                        <div className="text-muted extra-small text-truncate">{t.desc}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT AREA */}
        <div className="col-12 col-lg-8 col-xl-9">
          <div className="settings-card bg-white shadow-sm border border-slate-200 rounded-4 overflow-hidden">
            
            {/* HEADER BANNER */}
            <div className="settings-card-header p-4 border-bottom bg-slate-50 d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="settings-icon-badge p-3 rounded-4 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center">
                  <ActiveTabIcon size={20} />
                </div>
                <div>
                  <h4 className="fw-bold mb-0 text-dark">{activeTabInfo.label}</h4>
                  <small className="text-muted">{activeTabInfo.desc}</small>
                </div>
              </div>
              <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3.5 py-1.5 extra-small fw-bold border border-success border-opacity-25">
                <FaUserCheck className="me-1" /> Active Caretaker
              </span>
            </div>

            <div className="card-body p-4 p-md-4">
              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                  Loading preferences from database...
                </div>
              ) : (
                <>
                  {/* TAB 1: OPERATOR PROFILE */}
                  {activeTab === 'profile' && (
                    <div>
                      {/* Profile Picture Header Banner */}
                      <div className="settings-banner-box d-flex flex-column flex-sm-row align-items-center gap-4 mb-4">
                        <div className="position-relative flex-shrink-0">
                          {profile.avatar_path ? (
                            <img
                              src={profile.avatar_path}
                              alt="Avatar"
                              className="avatar-halo avatar-halo-gold rounded-circle object-fit-cover border border-3 border-white shadow-md"
                              style={{ width: 96, height: 96 }}
                            />
                          ) : (
                            <div
                              className="avatar-halo avatar-halo-gold rounded-circle text-white d-flex align-items-center justify-content-center border border-3 border-white fw-bold fs-2 shadow-md"
                              style={{
                                width: 96,
                                height: 96,
                                background: 'linear-gradient(135deg, #0B2C5F 0%, #1E40AF 100%)'
                              }}
                            >
                              {initials}
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="d-none"
                            accept="image/*"
                            onChange={handleAvatarChange}
                          />
                          <button
                            type="button"
                            className="btn btn-warning btn-sm rounded-circle position-absolute bottom-0 end-0 p-2 border border-2 border-white shadow text-dark fw-bold"
                            onClick={() => fileInputRef.current?.click()}
                            title="Upload Photo"
                          >
                            <FaCamera size={13} />
                          </button>
                        </div>

                        <div className="text-center text-sm-start flex-grow-1">
                          <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-2 mb-1">
                            <h5 className="fw-extrabold mb-0 fs-5 text-dark">{profile.full_name}</h5>
                            <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-pill fw-semibold extra-small">
                              {profile.position}
                            </span>
                          </div>
                          <p className="text-muted small mb-3">{profile.email}</p>
                          <div className="d-flex gap-2 justify-content-center justify-content-sm-start">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-semibold"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FaCamera className="me-1.5" /> Upload Photo
                            </button>
                            {profile.avatar_path && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1.5 fw-semibold"
                                style={{ fontSize: '0.8rem' }}
                                onClick={removeAvatar}
                              >
                                <FaTrash className="me-1.5" /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Header Bar for View / Edit Mode */}
                      <div className="d-flex justify-content-between align-items-center mb-3.5 flex-wrap gap-2">
                        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                          <FaCheckCircle className="text-success" /> Caretaker Account Overview
                        </h6>
                        {!isEditingProfile ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-pill px-3.5 py-1.5 fw-semibold d-flex align-items-center gap-1.5"
                            style={{ fontSize: '0.82rem' }}
                            onClick={() => {
                              setTempProfile({ ...profile });
                              setIsEditingProfile(true);
                            }}
                          >
                            <FaEdit size={12} /> Edit Profile Details
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary rounded-pill px-3.5 py-1.5 fw-semibold d-flex align-items-center gap-1.5"
                            style={{ fontSize: '0.82rem' }}
                            onClick={() => {
                              if (tempProfile) setProfile(tempProfile);
                              setIsEditingProfile(false);
                            }}
                          >
                            <FaTimes size={12} /> Cancel Edit
                          </button>
                        )}
                      </div>

                      {/* View Mode or Edit Mode */}
                      {!isEditingProfile ? (
                        <div className="row g-3">
                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Full Name
                              </span>
                              <div className="fw-bold text-dark fs-6">{profile.full_name}</div>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Email Address
                              </span>
                              <div className="fw-bold text-dark fs-6">{profile.email}</div>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Phone Number
                              </span>
                              <div className="fw-bold text-dark fs-6">{profile.phone || '09171234567'}</div>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Position / System Role
                              </span>
                              <div className="fw-bold text-dark fs-6">{profile.position}</div>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Assigned Basins
                              </span>
                              <div className="fw-bold text-dark fs-6">
                                {authUser?.assigned_ponds?.length
                                  ? `${authUser.assigned_ponds.length} Basins Assigned`
                                  : 'Active Pond Assigned'}
                              </div>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="settings-info-card">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Last Login Timestamp
                              </span>
                              <div className="fw-bold text-dark fs-6">{profile.last_login}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleSaveProfile}>
                          <div className="row g-3 mb-4">
                            <div className="col-12 col-md-6">
                              <label className="form-label fw-bold text-dark small mb-1.5">Full Name</label>
                              <input
                                className="form-control p-2.5 rounded-3 border shadow-xs"
                                value={profile.full_name}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                required
                              />
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label fw-bold text-dark small mb-1.5">Email Address</label>
                              <input
                                type="email"
                                className="form-control p-2.5 rounded-3 border shadow-xs"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                required
                              />
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label fw-bold text-dark small mb-1.5">Phone Number</label>
                              <input
                                className="form-control p-2.5 rounded-3 border shadow-xs"
                                value={profile.phone}
                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                placeholder="09XXXXXXXXX"
                              />
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label fw-bold text-dark small mb-1.5">Position / Role</label>
                              <input
                                className="form-control p-2.5 rounded-3 border shadow-xs"
                                value={profile.position}
                                onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                            <button
                              type="button"
                              className="btn btn-outline-secondary rounded-pill px-4"
                              onClick={() => {
                                if (tempProfile) setProfile(tempProfile);
                                setIsEditingProfile(false);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="btn btn-primary rounded-pill px-4 d-flex align-items-center gap-1.5 shadow-sm"
                              disabled={saving}
                            >
                              <FaSave size={13} /> {saving ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ACCOUNT SECURITY */}
                  {activeTab === 'security' && (
                    <div>
                      <div className="settings-info-card mb-4">
                        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                          <FaKey className="text-warning" /> Change Account Password
                        </h6>
                        <form onSubmit={handleUpdatePassword}>
                          <div className="row g-3 mb-3">
                            <div className="col-12">
                              <label className="form-label small fw-semibold text-dark">Current Password</label>
                              <div className="input-group">
                                <input
                                  type={showCurrentPassword ? 'text' : 'password'}
                                  className="form-control p-2.5"
                                  placeholder="Enter current password"
                                  value={security.current_password}
                                  onChange={(e) => setSecurity({ ...security, current_password: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                  {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                              </div>
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold text-dark">New Password</label>
                              <div className="input-group">
                                <input
                                  type={showNewPassword ? 'text' : 'password'}
                                  className="form-control p-2.5"
                                  placeholder="Min 6 characters"
                                  value={security.new_password}
                                  onChange={(e) => setSecurity({ ...security, new_password: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                              </div>
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold text-dark">Confirm New Password</label>
                              <div className="input-group">
                                <input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  className="form-control p-2.5"
                                  placeholder="Re-enter new password"
                                  value={security.confirm_password}
                                  onChange={(e) => setSecurity({ ...security, confirm_password: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="text-end">
                            <button
                              type="submit"
                              className="btn btn-primary rounded-pill px-4 d-inline-flex align-items-center gap-1.5 shadow-sm"
                              disabled={saving}
                            >
                              <FaSave size={13} /> {saving ? 'Updating...' : 'Update Password'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Session Security Card */}
                      <div className="settings-info-card">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                          <div>
                            <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                              <FaShieldAlt className="text-primary" /> Active Operator Session
                            </h6>
                            <p className="text-muted extra-small mb-0">
                              Logged in as <strong>{profile.full_name}</strong>. End session to require re-authentication.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3.5 py-2 fw-bold d-flex align-items-center gap-1.5"
                            onClick={() => {
                              Swal.fire({
                                title: 'Logout Session?',
                                text: 'You will need to login again to monitor basins.',
                                icon: 'question',
                                showCancelButton: true,
                                confirmButtonText: 'Yes, Logout',
                                confirmButtonColor: '#DC2626'
                              }).then((res) => {
                                if (res.isConfirmed) logout();
                              });
                            }}
                          >
                            <FaSignOutAlt size={12} /> Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BASIN FEEDING DEFAULTS */}
                  {activeTab === 'pond_preferences' && (
                    <div>
                      <div className="settings-info-card mb-4">
                        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                          <FaWater className="text-primary" /> Daily Feeding Configuration
                        </h6>

                        <div className="row g-3 mb-4">
                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark">Default Target Feed per Basin (kg)</label>
                            <div className="input-group">
                              <span className="input-group-text bg-light"><FaUtensils /></span>
                              <input
                                type="number"
                                step="0.1"
                                className="form-control p-2.5"
                                value={pondPreferences.target_feed_kg}
                                onChange={(e) => setPondPreferences({ ...pondPreferences, target_feed_kg: e.target.value })}
                              />
                              <span className="input-group-text bg-light">kg</span>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark">Preferred First Daily Feeding Slot</label>
                            <select
                              className="form-select p-2.5"
                              value={pondPreferences.default_feeding_slot}
                              onChange={(e) => setPondPreferences({ ...pondPreferences, default_feeding_slot: e.target.value })}
                            >
                              <option value="6:00 AM">6:00 AM (Morning Ration)</option>
                              <option value="9:00 AM">9:00 AM (Mid-Morning Ration)</option>
                              <option value="12:00 PM">12:00 PM (Noon Ration)</option>
                              <option value="3:00 PM">3:00 PM (Afternoon Ration)</option>
                              <option value="6:00 PM">6:00 PM (Evening Ration)</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark">Auto-Refresh Feeding History Logs</label>
                            <select
                              className="form-select p-2.5"
                              value={pondPreferences.auto_refresh_logs}
                              onChange={(e) => setPondPreferences({ ...pondPreferences, auto_refresh_logs: e.target.value })}
                            >
                              <option value="ON">ON (Auto sync live logs every 30s)</option>
                              <option value="OFF">OFF (Manual refresh only)</option>
                            </select>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark">Unit of Measure</label>
                            <input
                              className="form-control p-2.5 bg-light text-muted"
                              value={pondPreferences.feeding_unit}
                              disabled
                            />
                          </div>
                        </div>

                        <div className="text-end pt-3 border-top">
                          <button
                            type="button"
                            className="btn btn-primary rounded-pill px-4 d-inline-flex align-items-center gap-1.5 shadow-sm"
                            onClick={() =>
                              handleSaveGenericSettings(
                                {
                                  caretaker_target_feed: pondPreferences.target_feed_kg,
                                  caretaker_default_slot: pondPreferences.default_feeding_slot,
                                  caretaker_auto_refresh: pondPreferences.auto_refresh_logs
                                },
                                'Pond feeding preferences saved to database.'
                              )
                            }
                            disabled={saving}
                          >
                            <FaSave size={13} /> {saving ? 'Saving...' : 'Save Feeding Defaults'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: NOTIFICATIONS */}
                  {activeTab === 'notifications' && (
                    <div>
                      <div className="settings-info-card mb-4">
                        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                          <FaBell className="text-primary" /> Alert & Reminder Toggles
                        </h6>

                        <div className="d-flex flex-column gap-3 mb-4">
                          <div className="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold text-dark">Disease Risk Alerts</div>
                              <small className="text-muted">Receive notices when a scan detects high disease risk in assigned ponds.</small>
                            </div>
                            <button
                              type="button"
                              className="btn border-0 p-0 fs-3"
                              onClick={() =>
                                setNotificationSettings((prev) => ({
                                  ...prev,
                                  disease_alerts: prev.disease_alerts === 'ON' ? 'OFF' : 'ON'
                                }))
                              }
                            >
                              {notificationSettings.disease_alerts === 'ON' ? (
                                <FaToggleOn className="text-success" />
                              ) : (
                                <FaToggleOff className="text-muted opacity-50" />
                              )}
                            </button>
                          </div>

                          <div className="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold text-dark">Daily Feeding Reminders</div>
                              <small className="text-muted">Get notifications when a daily feeding slot (6 AM, 12 PM, 6 PM) is approaching.</small>
                            </div>
                            <button
                              type="button"
                              className="btn border-0 p-0 fs-3"
                              onClick={() =>
                                setNotificationSettings((prev) => ({
                                  ...prev,
                                  feeding_reminders: prev.feeding_reminders === 'ON' ? 'OFF' : 'ON'
                                }))
                              }
                            >
                              {notificationSettings.feeding_reminders === 'ON' ? (
                                <FaToggleOn className="text-success" />
                              ) : (
                                <FaToggleOff className="text-muted opacity-50" />
                              )}
                            </button>
                          </div>

                          <div className="p-3 bg-white border rounded-3 d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold text-dark">Audio Alert Sounds</div>
                              <small className="text-muted">Play a gentle sound notification when new alerts or logs arrive.</small>
                            </div>
                            <button
                              type="button"
                              className="btn border-0 p-0 fs-3"
                              onClick={() =>
                                setNotificationSettings((prev) => ({
                                  ...prev,
                                  sound_alerts: prev.sound_alerts === 'ON' ? 'OFF' : 'ON'
                                }))
                              }
                            >
                              {notificationSettings.sound_alerts === 'ON' ? (
                                <FaToggleOn className="text-success" />
                              ) : (
                                <FaToggleOff className="text-muted opacity-50" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-end pt-3 border-top">
                          <button
                            type="button"
                            className="btn btn-primary rounded-pill px-4 d-inline-flex align-items-center gap-1.5 shadow-sm"
                            onClick={() =>
                              handleSaveGenericSettings(
                                {
                                  caretaker_disease_alerts: notificationSettings.disease_alerts,
                                  caretaker_feeding_reminders: notificationSettings.feeding_reminders,
                                  caretaker_sound_alerts: notificationSettings.sound_alerts
                                },
                                'Notification preferences updated.'
                              )
                            }
                            disabled={saving}
                          >
                            <FaSave size={13} /> {saving ? 'Saving...' : 'Save Notification Preferences'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: DISPLAY & APPEARANCE */}
                  {activeTab === 'display' && (
                    <div>
                      <div className="settings-info-card mb-4">
                        <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                          <FaSlidersH className="text-primary" /> Display & Localization
                        </h6>

                        <div className="row g-3 mb-4">
                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark mb-2">App Appearance Theme</label>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className={`btn flex-grow-1 rounded-3 p-3 border d-flex align-items-center justify-content-center gap-2 fw-semibold ${
                                  displayPreferences.theme === 'Light'
                                    ? 'btn-primary shadow-xs'
                                    : 'btn-outline-secondary'
                                }`}
                                onClick={() => {
                                  setDisplayPreferences({ ...displayPreferences, theme: 'Light' });
                                  applyAppTheme('light');
                                }}
                              >
                                <FaSun /> Light Theme
                              </button>
                              <button
                                type="button"
                                className={`btn flex-grow-1 rounded-3 p-3 border d-flex align-items-center justify-content-center gap-2 fw-semibold ${
                                  displayPreferences.theme === 'Dark'
                                    ? 'btn-dark shadow-xs'
                                    : 'btn-outline-secondary'
                                }`}
                                onClick={() => {
                                  setDisplayPreferences({ ...displayPreferences, theme: 'Dark' });
                                  applyAppTheme('dark');
                                }}
                              >
                                <FaMoon /> Dark Theme
                              </button>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <label className="form-label small fw-semibold text-dark mb-2">System Language</label>
                            <select
                              className="form-select p-3"
                              value={displayPreferences.language}
                              onChange={(e) => setDisplayPreferences({ ...displayPreferences, language: e.target.value })}
                            >
                              <option value="English">English (Default)</option>
                              <option value="Tagalog">Tagalog / Filipino</option>
                            </select>
                          </div>
                        </div>

                        <div className="text-end pt-3 border-top">
                          <button
                            type="button"
                            className="btn btn-primary rounded-pill px-4 d-inline-flex align-items-center gap-1.5 shadow-sm"
                            onClick={() =>
                              handleSaveGenericSettings(
                                {
                                  caretaker_theme: displayPreferences.theme,
                                  caretaker_language: displayPreferences.language
                                },
                                'Display preferences updated.'
                              )
                            }
                            disabled={saving}
                          >
                            <FaSave size={13} /> {saving ? 'Saving...' : 'Save Appearance Preferences'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: ABOUT SYSTEM */}
                  {activeTab === 'about' && (
                    <div>
                      <div className="settings-info-card">
                        <div className="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom">
                          <div
                            className="rounded-3 p-3 bg-primary text-white fs-3 d-flex align-items-center justify-content-center"
                            style={{ width: 56, height: 56 }}
                          >
                            <FaInfoCircle />
                          </div>
                          <div>
                            <h5 className="fw-extrabold text-dark mb-0.5">ShrimPredict Caretaker Console</h5>
                            <span className="text-muted extra-small">Version 1.0.0 (Stable Production Build)</span>
                          </div>
                        </div>

                        <div className="row g-3">
                          <div className="col-12 col-md-6">
                            <div className="p-3 bg-white border rounded-3">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Database Connection
                              </span>
                              <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 extra-small fw-bold border border-success border-opacity-25">
                                ● Connected to XAMPP MySQL
                              </span>
                            </div>
                          </div>

                          <div className="col-12 col-md-6">
                            <div className="p-3 bg-white border rounded-3">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                System Role
                              </span>
                              <span className="fw-bold text-dark">Pond Field Caretaker</span>
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="p-3 bg-white border rounded-3">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Caretaker Operating Protocol & Guidelines
                              </span>
                              <p className="text-secondary small mb-0" style={{ lineHeight: 1.6 }}>
                                Log daily feedings accurately under <strong>My Pond</strong> or <strong>Feeding History</strong>. For disease detection, navigate to <strong>Disease Scan</strong> and upload a clear shrimp image. System notifications automatically sync with the MySQL database.
                              </p>
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="p-3 bg-white border rounded-3">
                              <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                                Project Research Context
                              </span>
                              <p className="text-secondary extra-small mb-0" style={{ lineHeight: 1.6 }}>
                                ShrimPredict: Shrimp Feed Monitoring and Disease Detection System Utilizing Image Processing. Developed for O & B Aqua Farm in collaboration with Batangas State University.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
