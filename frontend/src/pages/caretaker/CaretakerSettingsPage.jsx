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
  FaEyeSlash
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { applyAppTheme } from '../../main';

export default function CaretakerSettingsPage() {
  const { user: authUser, updateUser } = useAuth();
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
  const [showPassword, setShowPassword] = useState(false);
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
    { id: 'profile', label: 'Profile', icon: <FaUser />, desc: 'Personal profile & contact info' },
    { id: 'pond_preferences', label: 'My Pond Preferences', icon: <FaWater />, desc: 'Feeding targets & slot settings' },
    { id: 'notifications', label: 'Notification Settings', icon: <FaBell />, desc: 'Alerts & schedule notices' },
    { id: 'display', label: 'Display & Preferences', icon: <FaSlidersH />, desc: 'Theme, language & date format' },
    { id: 'about', label: 'About System', icon: <FaInfoCircle />, desc: 'System info & operation manual' }
  ];

  const filteredTabs = navTabs.filter(
    (t) =>
      t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTabInfo = navTabs.find((t) => t.id === activeTab) || navTabs[0];

  const initials = (profile.full_name || authUser?.full_name || 'Caretaker')
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="caretaker-settings-container p-3 p-md-4">
      {/* Top Hero Banner (Matching Caretaker Console Standard Design) */}
      <section className="caretaker-dashboard-hero mb-4">
        <div>
          <span className="caretaker-dashboard-kicker">CARETAKER CONSOLE</span>
          <h3>Account Settings</h3>
          <p>Manage your caretaker profile, pond preferences, notification alerts, and security options.</p>
        </div>
      </section>

      <div className="row g-4">
        {/* LEFT SETTINGS MENU SIDEBAR */}
        <div className="col-12 col-md-5 col-lg-4 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden sticky-top" style={{ top: 20 }}>
            {/* Header */}
            <div className="px-3.5 py-3 border-bottom bg-light bg-opacity-50 d-flex align-items-center justify-content-between">
              <span className="fw-extrabold text-dark extra-small text-uppercase tracking-wider d-flex align-items-center gap-2">
                <FaSlidersH className="text-primary" /> Settings Menu
              </span>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 extra-small fw-bold">
                {navTabs.length} Tabs
              </span>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-bottom bg-white">
              <div className="input-group input-group-sm rounded-pill border border-secondary border-opacity-25 overflow-hidden px-2.5 bg-light">
                <span className="input-group-text bg-transparent border-0 text-muted p-0 me-2 d-flex align-items-center">
                  <FaSearch size={12} />
                </span>
                <input
                  type="text"
                  className="form-control border-0 bg-transparent p-0 extra-small shadow-none"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Navigation Items */}
            <div className="p-2">
              {filteredTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`btn w-100 text-start d-flex align-items-center px-2.5 py-2 rounded-3 mb-1 border-0 transition-all ${
                      isActive
                        ? 'bg-primary text-white shadow-sm fw-bold'
                        : 'text-dark bg-white hover-bg-light'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span
                      className={`d-inline-flex align-items-center justify-content-center me-2.5 flex-shrink-0 rounded-2 ${
                        isActive
                          ? 'bg-white text-primary shadow-xs'
                          : 'bg-primary bg-opacity-10 text-primary'
                      }`}
                      style={{ width: 32, height: 32 }}
                    >
                      {tab.icon}
                    </span>
                    <span className="extra-small fw-bold lh-sm flex-grow-1">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT AREA */}
        <div className="col-12 col-md-7 col-lg-8 col-xl-9">
          <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
            
            {/* HEADER BANNER */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-3 p-3 bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center">
                  <span className="fs-3">{activeTabInfo.icon}</span>
                </div>
                <div>
                  <h4 className="fw-extrabold text-dark mb-1">{activeTabInfo.label}</h4>
                  <p className="text-muted small mb-0">{activeTabInfo.desc}</p>
                </div>
              </div>
              <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-1.5 extra-small fw-semibold border border-success border-opacity-25">
                <FaUserCheck className="me-1" /> Active Caretaker
              </span>
            </div>

            {loading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                Loading settings from database...
              </div>
            ) : (
              <>
                {/* TAB 1: PROFILE */}
                {activeTab === 'profile' && (
                  <div>
                    {/* AVATAR HERO CARD */}
                    <div className="card border rounded-4 p-4 mb-4 bg-light">
                      <div className="d-flex align-items-center flex-wrap gap-4">
                        <div className="position-relative">
                          {profile.avatar_path ? (
                            <img
                              src={profile.avatar_path}
                              alt="Avatar"
                              className="rounded-circle shadow-sm border border-3 border-white object-fit-cover"
                              style={{ width: 90, height: 90 }}
                            />
                          ) : (
                            <div
                              className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center shadow-sm fs-2 border border-3 border-white"
                              style={{ width: 90, height: 90 }}
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
                            className="btn btn-sm btn-primary rounded-circle position-absolute bottom-0 end-0 p-1.5 shadow-sm"
                            onClick={() => fileInputRef.current?.click()}
                            title="Change Picture"
                          >
                            <FaCamera size={14} />
                          </button>
                        </div>

                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <h5 className="fw-extrabold text-dark mb-0">{profile.full_name}</h5>
                            <span className="badge bg-primary rounded-pill px-2.5 py-1 extra-small">
                              {profile.position}
                            </span>
                          </div>
                          <p className="text-muted small mb-2">{profile.email}</p>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rounded-pill px-3"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <FaCamera className="me-1.5" /> Upload Photo
                            </button>
                            {profile.avatar_path && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onClick={removeAvatar}
                              >
                                <FaTrash className="me-1.5" /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OVERVIEW CARDS */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <FaCheckCircle className="text-success" /> Caretaker Account Overview
                      </h6>
                      {!isEditingProfile ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary rounded-pill px-3"
                          onClick={() => {
                            setTempProfile({ ...profile });
                            setIsEditingProfile(true);
                          }}
                        >
                          <FaEdit className="me-1" /> Edit Profile Details
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                          onClick={() => {
                            if (tempProfile) setProfile(tempProfile);
                            setIsEditingProfile(false);
                          }}
                        >
                          <FaTimes className="me-1" /> Cancel Edit
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveProfile}>
                      <div className="row g-3 mb-4">
                        <div className="col-12 col-md-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                              Full Name
                            </span>
                            {isEditingProfile ? (
                              <input
                                className="form-control form-control-sm"
                                value={profile.full_name}
                                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                required
                              />
                            ) : (
                              <div className="fw-bold text-dark">{profile.full_name}</div>
                            )}
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                              Email Address
                            </span>
                            {isEditingProfile ? (
                              <input
                                type="email"
                                className="form-control form-control-sm"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                required
                              />
                            ) : (
                              <div className="fw-bold text-dark">{profile.email}</div>
                            )}
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                              Phone Number
                            </span>
                            {isEditingProfile ? (
                              <input
                                className="form-control form-control-sm"
                                value={profile.phone}
                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                placeholder="09XXXXXXXXX"
                              />
                            ) : (
                              <div className="fw-bold text-dark">{profile.phone || 'Not set'}</div>
                            )}
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                              Position / System Role
                            </span>
                            {isEditingProfile ? (
                              <input
                                className="form-control form-control-sm"
                                value={profile.position}
                                onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                              />
                            ) : (
                              <div className="fw-bold text-dark">{profile.position}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {isEditingProfile && (
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary rounded-pill px-4"
                            onClick={() => {
                              if (tempProfile) setProfile(tempProfile);
                              setIsEditingProfile(false);
                            }}
                          >
                            Cancel
                          </button>
                          <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>
                            <FaSave className="me-1.5" /> {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* TAB 2: POND PREFERENCES */}
                {activeTab === 'pond_preferences' && (
                  <div>
                    <div className="p-4 border rounded-4 bg-light mb-4">
                      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <FaWater className="text-primary" /> Feeding & Pond Defaults
                      </h6>

                      <div className="row g-3 mb-4">
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Default Daily Target Feed (kg)</label>
                          <div className="input-group">
                            <span className="input-group-text"><FaUtensils /></span>
                            <input
                              type="number"
                              step="0.1"
                              className="form-control"
                              value={pondPreferences.target_feed_kg}
                              onChange={(e) => setPondPreferences({ ...pondPreferences, target_feed_kg: e.target.value })}
                            />
                            <span className="input-group-text">kg</span>
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Preferred Default Feeding Slot</label>
                          <select
                            className="form-select"
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
                          <label className="form-label small fw-semibold">Auto-Refresh Feeding History Logs</label>
                          <select
                            className="form-select"
                            value={pondPreferences.auto_refresh_logs}
                            onChange={(e) => setPondPreferences({ ...pondPreferences, auto_refresh_logs: e.target.value })}
                          >
                            <option value="ON">ON (Auto sync live logs)</option>
                            <option value="OFF">OFF (Manual refresh only)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
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
                        <FaSave className="me-1.5" /> {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: NOTIFICATIONS */}
                {activeTab === 'notifications' && (
                  <div>
                    <div className="p-4 border rounded-4 bg-light mb-4">
                      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <FaBell className="text-primary" /> Alert & Reminder Toggles
                      </h6>

                      <div className="list-group list-group-flush border rounded-3 mb-4">
                        <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                          <div>
                            <div className="fw-bold text-dark">Disease Risk Alerts</div>
                            <small className="text-muted">Receive notices when a scan detects high disease risk in assigned ponds.</small>
                          </div>
                          <button
                            type="button"
                            className="btn border-0 p-0 fs-3 text-primary"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                disease_alerts: prev.disease_alerts === 'ON' ? 'OFF' : 'ON'
                              }))
                            }
                          >
                            {notificationSettings.disease_alerts === 'ON' ? <FaToggleOn className="text-success" /> : <FaToggleOff className="text-muted" />}
                          </button>
                        </div>

                        <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                          <div>
                            <div className="fw-bold text-dark">Daily Feeding Reminders</div>
                            <small className="text-muted">Get notifications when a daily feeding slot (6 AM, 12 PM, 6 PM) is approaching.</small>
                          </div>
                          <button
                            type="button"
                            className="btn border-0 p-0 fs-3 text-primary"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                feeding_reminders: prev.feeding_reminders === 'ON' ? 'OFF' : 'ON'
                              }))
                            }
                          >
                            {notificationSettings.feeding_reminders === 'ON' ? <FaToggleOn className="text-success" /> : <FaToggleOff className="text-muted" />}
                          </button>
                        </div>

                        <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                          <div>
                            <div className="fw-bold text-dark">Audio Alert Sounds</div>
                            <small className="text-muted">Play a gentle sound notification when new alerts or logs arrive.</small>
                          </div>
                          <button
                            type="button"
                            className="btn border-0 p-0 fs-3 text-primary"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                sound_alerts: prev.sound_alerts === 'ON' ? 'OFF' : 'ON'
                              }))
                            }
                          >
                            {notificationSettings.sound_alerts === 'ON' ? <FaToggleOn className="text-success" /> : <FaToggleOff className="text-muted" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
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
                        <FaSave className="me-1.5" /> {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 5: DISPLAY & PREFERENCES */}
                {activeTab === 'display' && (
                  <div>
                    <div className="p-4 border rounded-4 bg-light mb-4">
                      <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                        <FaSlidersH className="text-primary" /> Display & Localization
                      </h6>

                      <div className="row g-3 mb-4">
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">App Appearance Theme</label>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className={`btn flex-grow-1 rounded-3 p-3 border d-flex align-items-center justify-content-center gap-2 ${
                                displayPreferences.theme === 'Light' ? 'btn-primary' : 'btn-outline-secondary'
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
                              className={`btn flex-grow-1 rounded-3 p-3 border d-flex align-items-center justify-content-center gap-2 ${
                                displayPreferences.theme === 'Dark' ? 'btn-dark' : 'btn-outline-secondary'
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
                          <label className="form-label small fw-semibold">System Language</label>
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

                      <button
                        type="button"
                        className="btn btn-primary rounded-pill px-4"
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
                        <FaSave className="me-1.5" /> {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 6: ABOUT SYSTEM */}
                {activeTab === 'about' && (
                  <div>
                    <div className="p-4 border rounded-4 bg-light">
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="rounded-3 p-3 bg-primary text-white fs-3">
                          <FaInfoCircle />
                        </div>
                        <div>
                          <h5 className="fw-bold text-dark mb-0">ShrimPredict Caretaker Console</h5>
                          <span className="text-muted extra-small">Version 1.0.0 (Stable Production Build)</span>
                        </div>
                      </div>

                      <hr />

                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <div className="p-3 bg-white border rounded-3">
                            <span className="text-uppercase extra-small font-mono fw-bold text-muted d-block mb-1">
                              Database Connection
                            </span>
                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 extra-small fw-bold">
                              Connected to XAMPP MySQL
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
                              Caretaker Operating Guide
                            </span>
                            <p className="text-secondary small mb-0" style={{ lineHeight: 1.6 }}>
                              Log daily feedings accurately under <strong>My Pond</strong> or <strong>Feeding History</strong>. For disease detection, navigate to <strong>Disease Scan</strong> and upload a clear shrimp image. System notifications automatically sync with the MySQL database.
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
  );
}
