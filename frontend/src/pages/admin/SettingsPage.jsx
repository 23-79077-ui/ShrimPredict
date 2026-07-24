import { useState, useEffect } from 'react';
import { FaMoon, FaSun, FaCog, FaBell, FaSlidersH } from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('shrim_theme') === 'dark';
  });

  const [diseaseNotif, setDiseaseNotif] = useState(true);
  const [feedReminders, setFeedReminders] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shrim_theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('shrim_theme', 'light');
    }
  }, [darkMode]);

  const handleToggleDarkMode = (e) => {
    const isChecked = e.target.checked;
    setDarkMode(isChecked);
    Swal.fire({
      icon: 'success',
      title: isChecked ? 'Dark Mode Enabled' : 'Light Mode Enabled',
      text: isChecked ? 'Admin console theme set to Dark Mode.' : 'Admin console theme set to Light Mode.',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header Card */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <FaCog className="text-primary" /> Admin Settings & Preferences
          </h4>
          <p className="text-muted mb-0">Configure your display themes, notification preferences, and system rules.</p>
        </div>
      </div>

      {/* Theme & Display Preferences (Dark Mode Switch) */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
            <FaSlidersH className="text-primary" /> Display Theme Preferences
          </h5>

          <div className="d-flex align-items-center justify-content-between p-3.5 rounded-3 border bg-light">
            <div className="d-flex align-items-center gap-3">
              <div
                className={`p-3 rounded-circle d-flex align-items-center justify-content-center ${
                  darkMode ? 'bg-dark text-warning' : 'bg-warning bg-opacity-10 text-warning'
                }`}
                style={{ width: 48, height: 48 }}
              >
                {darkMode ? <FaMoon size={22} /> : <FaSun size={22} />}
              </div>
              <div>
                <strong className="d-block text-dark fs-6 mb-1">Dark Mode</strong>
                <span className="text-muted small">
                  {darkMode
                    ? 'Dark theme is active. Reduces eye strain and optimizes display for dark environments.'
                    : 'Standard clean light theme is active.'}
                </span>
              </div>
            </div>

            {/* Toggle Switch (Shutterstock / iOS style) */}
            <div className="form-check form-switch fs-4 mb-0">
              <input
                className="form-check-input custom-theme-switch"
                type="checkbox"
                role="switch"
                id="darkModeSwitch"
                checked={darkMode}
                onChange={handleToggleDarkMode}
                style={{ cursor: 'pointer', width: '3em', height: '1.6em' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Rules */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
            <FaBell className="text-primary" /> Notification Settings
          </h5>

          <div className="d-flex flex-column gap-3">
            <div className="d-flex align-items-center justify-content-between p-3 rounded-3 border">
              <div>
                <strong className="d-block text-dark mb-1">Disease Notifications</strong>
                <small className="text-muted">Send admin alerts when new disease risk is detected by caretakers.</small>
              </div>
              <div className="form-check form-switch fs-5 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={diseaseNotif}
                  onChange={(e) => setDiseaseNotif(e.target.checked)}
                />
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between p-3 rounded-3 border">
              <div>
                <strong className="d-block text-dark mb-1">Feeding Reminders</strong>
                <small className="text-muted">Notify caretakers before scheduled feeding windows.</small>
              </div>
              <div className="form-check form-switch fs-5 mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={feedReminders}
                  onChange={(e) => setFeedReminders(e.target.checked)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
