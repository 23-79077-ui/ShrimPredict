import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  applyAppTheme,
  getEffectiveTheme,
  getThemePreference,
  resetThemeToAuto,
  setManualTheme
} from '../utils/theme';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import Swal from 'sweetalert2';
import {
  FaArrowLeft,
  FaLock,
  FaUserShield,
  FaUserCog,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaLaptop,
  FaMobileAlt,
  FaAt,
  FaSun,
  FaMoon,
  FaClock,
} from 'react-icons/fa';

export default function LoginPage() {
  const { t, isFilipino } = useLanguage();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('type') === 'caretaker' ? 'caretaker' : 'admin';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [theme, setTheme] = useState(() => getEffectiveTheme());
  const [themePreference, setThemePreference] = useState(() => getThemePreference());
  const isDark = theme === 'dark';
  const isAuto = themePreference === 'auto';

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setManualTheme(nextTheme);
  };

  const handleResetToAuto = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    resetThemeToAuto();
  };

  useEffect(() => {
    const handleThemeEvent = (e) => {
      if (e.detail?.theme) setTheme(e.detail.theme);
      if (e.detail?.preference !== undefined) setThemePreference(e.detail.preference);
    };
    window.addEventListener('shrim-theme-changed', handleThemeEvent);
    return () => window.removeEventListener('shrim-theme-changed', handleThemeEvent);
  }, []);

  const [email, setEmail] = useState(
    defaultTab === 'admin' ? 'admin@shrimpredict.com' : 'cj@gmail.com'
  );
  const [password, setPassword] = useState(
    defaultTab === 'admin' ? 'admin123' : 'cj12345'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'admin') {
      setEmail('admin@shrimpredict.com');
      setPassword('admin123');
    } else {
      setEmail('cj@gmail.com');
      setPassword('cj12345');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/caretaker/dashboard');
      }
      Swal.fire({
        icon: 'success',
        title: t('login.welcomeBack', 'Welcome Back!'),
        text: `${t('login.loginSuccess', 'Logged in successfully as')} ${result.user.role === 'admin' ? (isFilipino ? 'ADMIN / MAY-ARI' : 'ADMIN') : (isFilipino ? 'TAGAPAG-ALAGA' : 'CARETAKER')}.`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('login.authFailed', 'Authentication Failed'),
        text: error.message || t('login.checkCredentials', 'Please check your email and password.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page-container min-vh-100 d-flex flex-column justify-content-center position-relative py-5"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0A141D 0%, #172A39 50%, #0F1C26 100%)'
          : 'linear-gradient(135deg, #F8F5F2 0%, #E9E4E0 50%, #D8D2CD 100%)',
        color: isDark ? '#FFFFFF' : '#172A39',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* FLOATING TOP NAVIGATION & THEME BAR */}
      <div
        className="position-fixed top-0 start-0 end-0 p-3 px-lg-4 d-flex justify-content-between align-items-center"
        style={{ zIndex: 1050 }}
      >
        <Link
          to="/"
          className="btn rounded-pill px-3.5 py-1.5 d-inline-flex align-items-center gap-2 fw-bold text-decoration-none shadow-sm transition-all"
          style={{
            backgroundColor: isDark ? '#172A39' : '#FFFFFF',
            border: isDark ? '1px solid rgba(233, 228, 224, 0.25)' : '1px solid #6E7575',
            color: isDark ? '#FFFFFF' : '#172A39',
            fontSize: '0.85rem',
          }}
        >
          <FaArrowLeft size={13} style={{ color: '#FC563C' }} /> {t('login.backToHome', 'Back to Home')}
        </Link>

        {/* PROMINENT LANGUAGE & LIGHT / DARK MODE TOGGLE PILLS */}
        <div className="d-flex align-items-center gap-2">
          <LanguageToggle isDark={isDark} />

          {!isAuto && (
            <button
              type="button"
              onClick={handleResetToAuto}
              className="btn btn-sm rounded-pill d-inline-flex align-items-center gap-1.5 shadow-sm px-3 py-1.5"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1EBE6',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D5CEC8',
                color: isDark ? '#E2E8F0' : '#475569',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              title={t('common.autoSchedule', 'Reset to Auto Schedule: 6 AM–6 PM Light, 6 PM–6 AM Dark')}
              aria-label="Reset to Auto Theme Schedule"
            >
              <FaClock size={12} style={{ color: '#FC563C' }} />
              <span>{t('common.auto', 'Auto')}</span>
            </button>
          )}

          <button
            type="button"
            className="btn rounded-pill px-3.5 py-1.5 d-inline-flex align-items-center gap-2 fw-bold shadow-sm transition-all position-relative"
            style={{
              backgroundColor: isDark ? '#172A39' : '#FFFFFF',
              border: isDark ? '1px solid rgba(233, 228, 224, 0.25)' : '1px solid #6E7575',
              color: isDark ? '#FFFFFF' : '#172A39',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            onClick={handleToggleTheme}
            title={
              isAuto
                ? `Theme: Auto (${isDark ? 'Dark mode 6 PM–6 AM' : 'Light mode 6 AM–6 PM'}) • Click to set ${isDark ? 'Light' : 'Dark'} mode`
                : `Theme: ${isDark ? 'Dark' : 'Light'} (Manual) • Click to switch to ${isDark ? 'Light' : 'Dark'} mode`
            }
            aria-label={
              isAuto
                ? `Theme is Auto. Click to switch to ${isDark ? 'Light' : 'Dark'} mode.`
                : `Switch to ${isDark ? 'Light' : 'Dark'} mode`
            }
          >
            {isDark ? (
              <>
                <FaSun size={14} className="text-warning" />
                <span>{t('common.lightMode', 'Light Mode')}</span>
              </>
            ) : (
              <>
                <FaMoon size={13} style={{ color: '#172A39' }} />
                <span>{t('common.darkMode', 'Dark Mode')}</span>
              </>
            )}
            {isAuto && (
              <span
                className="badge rounded-pill bg-danger-subtle text-danger px-1.5 py-0.5"
                style={{ fontSize: '0.68rem', letterSpacing: '0.02em', fontWeight: 700 }}
              >
                {t('common.auto', 'Auto')}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="container-fluid px-3 px-lg-5 my-auto" style={{ maxWidth: '1260px' }}>
        <div className="row g-4 g-lg-5 align-items-center">
          {/* LEFT PANEL: BRANDING & ROLE CAPABILITIES */}
          <div className="col-lg-6 login-left-panel pe-lg-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Center Logo with Soft Glow */}
              <div className="d-flex justify-content-center align-items-center w-100 mb-2">
                <img
                  src="/shrimp_predict_logo.png"
                  alt="ShrimpPredict Official Logo"
                  className="mx-auto d-block logo-glow-intense"
                  style={{
                    height: '130px',
                    width: 'auto',
                    objectFit: 'contain',
                  }}
                />
              </div>

              {/* Title & Subtitle */}
              <div className="text-center mb-3">
                <h2
                  className="fw-bold mb-1 lh-sm"
                  style={{
                    fontSize: 'clamp(1.2rem, 1.7vw, 1.45rem)',
                    color: isDark ? '#FFFFFF' : '#172A39',
                  }}
                >
                  Shrimp<span style={{ color: '#FC563C' }}>Predict</span>:{' '}
                  <span>{t('login.thesisTitle', 'Shrimp Feed Monitoring and Disease Detection System')}</span>
                </h2>
                <p className="fw-semibold mb-0" style={{ color: '#FC563C', fontSize: '0.92rem', letterSpacing: '0.3px' }}>
                  {t('login.thesisSubtitle', 'Utilizing Image Processing')}
                </p>
              </div>

              {/* ROLE-BASED SYSTEM CAPABILITIES BADGES */}
              <div>
                <div
                  className="extra-small fw-bold text-uppercase tracking-wider mb-2.5 d-flex align-items-center gap-2"
                  style={{
                    color: isDark ? '#FFFFFF' : '#172A39',
                    letterSpacing: '1px',
                    fontSize: '0.78rem',
                  }}
                >
                  <span className="p-1 rounded-circle" style={{ backgroundColor: '#FC563C' }}></span> {t('login.roleCapabilities', 'ROLE-BASED SYSTEM CAPABILITIES')}
                </div>

                {/* Card 1: For Farm Owners */}
                <div
                  className="p-3 rounded-3 position-relative overflow-hidden transition-all shadow-sm"
                  style={{
                    backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                    border: isDark ? '1.5px solid rgba(233, 228, 224, 0.22)' : '1.5px solid #6E7575',
                    marginBottom: '16px',
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div
                      className="p-1.5 rounded-2 d-flex align-items-center justify-content-center"
                      style={{
                        backgroundColor: isDark ? '#203A4F' : 'rgba(252, 86, 60, 0.1)',
                        color: '#FC563C',
                        width: 32,
                        height: 32,
                        border: isDark ? '1px solid rgba(233, 228, 224, 0.2)' : 'none',
                      }}
                    >
                      <FaLaptop size={15} />
                    </div>
                    <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: isDark ? '#FFFFFF' : '#172A39' }}>
                      {t('login.forOwners', 'For Farm Owners (Web Portal)')}
                    </h6>
                  </div>
                  <ul className="list-unstyled mb-0" style={{ color: isDark ? '#E2DFDC' : '#334155', fontSize: '0.84rem', lineHeight: '1.6' }}>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.ownerPoint1', 'Centralized dashboard covering nursery and grow-out ponds.')}</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.ownerPoint2', 'Predictive analytics for harvest planning and feeding deviation.')}</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.ownerPoint3', 'Caretaker credential management and farm-wide biosecurity control.')}</span>
                    </li>
                  </ul>
                </div>

                {/* Card 2: For Pond Caretakers */}
                <div
                  className="p-3 rounded-3 position-relative overflow-hidden transition-all shadow-sm"
                  style={{
                    backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                    border: isDark ? '1.5px solid rgba(233, 228, 224, 0.22)' : '1.5px solid #6E7575',
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div
                      className="p-1.5 rounded-2 d-flex align-items-center justify-content-center"
                      style={{
                        backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                        color: '#FC563C',
                        width: 32,
                        height: 32,
                        border: isDark ? '1px solid rgba(233, 228, 224, 0.2)' : '1px solid #6E7575',
                      }}
                    >
                      <FaMobileAlt size={15} />
                    </div>
                    <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: isDark ? '#FFFFFF' : '#172A39' }}>
                      {t('login.forCaretakers', 'For Pond Caretakers (Mobile View)')}
                    </h6>
                  </div>
                  <ul className="list-unstyled mb-0" style={{ color: isDark ? '#E2DFDC' : '#334155', fontSize: '0.84rem', lineHeight: '1.6' }}>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.caretakerPoint1', 'Sunlight-readable camera diagnostic scanner.')}</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.caretakerPoint2', 'Quick-entry forms for daily feed logs and water quality.')}</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#FC563C', fontSize: '12px' }} />
                      <span>{t('login.caretakerPoint3', 'Immediate task updates, scheduled feeding reminders, and alerts.')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT PANEL: GLOWING LOGIN FORM CARD */}
          <div className="col-lg-6 login-right-panel ps-lg-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-100 mx-auto"
              style={{ maxWidth: '460px' }}
            >
              <div
                className="p-4 rounded-4 position-relative overflow-hidden shadow-lg"
                style={{
                  backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                  border: isDark ? '1.5px solid rgba(233, 228, 224, 0.22)' : '1.5px solid #6E7575',
                  boxShadow: isDark
                    ? '0 20px 50px rgba(0, 0, 0, 0.5)'
                    : '0 16px 40px rgba(23, 42, 57, 0.08), 0 2px 8px rgba(23, 42, 57, 0.04)',
                  borderRadius: '20px',
                }}
              >
                {/* ROLE TOGGLE PILL SWITCHER BAR */}
                <div
                  className="p-1 rounded-pill d-flex mb-3 gap-1"
                  style={{
                    backgroundColor: isDark ? '#0A141D' : '#E9E4E0',
                    border: isDark ? '1px solid rgba(233, 228, 224, 0.2)' : '1px solid #6E7575',
                  }}
                >
                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-1.5 px-3 fw-bold d-flex align-items-center justify-content-center gap-1.5 transition-all ${
                      activeTab === 'admin'
                        ? 'text-white shadow-sm'
                        : 'border-0'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'admin' ? '#FC563C' : 'transparent',
                      color: activeTab === 'admin' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#475569'),
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap',
                      minHeight: '34px',
                      lineHeight: '1.2',
                      boxShadow: activeTab === 'admin' ? '0 2px 8px rgba(252, 86, 60, 0.35)' : 'none',
                    }}
                    onClick={() => handleTabChange('admin')}
                  >
                    <FaUserShield size={13} className="flex-shrink-0" />
                    <span>{t('login.tabAdmin', 'Admin')}</span>
                  </button>
                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-1.5 px-3 fw-bold d-flex align-items-center justify-content-center gap-1.5 transition-all ${
                      activeTab === 'caretaker'
                        ? 'text-white shadow-sm'
                        : 'border-0'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'caretaker' ? '#FC563C' : 'transparent',
                      color: activeTab === 'caretaker' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#475569'),
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap',
                      minHeight: '34px',
                      lineHeight: '1.2',
                      boxShadow: activeTab === 'caretaker' ? '0 2px 8px rgba(252, 86, 60, 0.35)' : 'none',
                    }}
                    onClick={() => handleTabChange('caretaker')}
                  >
                    <FaUserCog size={13} className="flex-shrink-0" />
                    <span>{t('login.tabCaretaker', 'Caretaker')}</span>
                  </button>
                </div>

                {/* FORM TITLE & SUBTITLE */}
                <div className="text-center mb-3">
                  <h4 className="fw-bold mb-1" style={{ fontSize: '1.25rem', color: isDark ? '#FFFFFF' : '#172A39' }}>
                    {activeTab === 'admin'
                      ? t('login.adminPortalTitle', 'Farm Owner & Admin Portal')
                      : t('login.caretakerPortalTitle', 'Pond Caretaker Portal')}
                  </h4>
                  <p className="mb-0 extra-small" style={{ color: isDark ? '#CBD5E1' : '#6E7575', fontSize: '0.82rem', lineHeight: '1.4' }}>
                    {activeTab === 'admin'
                      ? t('login.adminPortalSub', 'Sign in to access pond management dashboards, harvest forecasts, and biosecurity settings.')
                      : t('login.caretakerPortalSub', 'Sign in to log daily feed records, perform disease scans, and view pond status.')}
                  </p>
                </div>

                {/* LOGIN FORM */}
                <form onSubmit={handleSubmit}>
                  {/* Email / Username Field */}
                  <div className="mb-2.5">
                    <label className="form-label extra-small fw-semibold mb-1" style={{ color: isDark ? '#FFFFFF' : '#172A39', fontWeight: 600 }}>
                      {activeTab === 'admin' ? t('login.emailAddress', 'Email Address') : t('login.caretakerUserPlaceholder', 'Caretaker Username / Email')}
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-end-0 rounded-start-3"
                        style={{
                          backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                          borderColor: isDark ? 'rgba(233, 228, 224, 0.25)' : '#6E7575',
                          color: '#FC563C',
                        }}
                      >
                        <FaAt size={13} />
                      </span>
                      <input
                        type="email"
                        className="form-control border-start-0 rounded-end-3 py-2"
                        style={{
                          backgroundColor: isDark ? '#0F1C26' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(233, 228, 224, 0.25)' : '#6E7575',
                          color: isDark ? '#FFFFFF' : '#172A39',
                          fontSize: '0.85rem',
                        }}
                        placeholder={activeTab === 'admin' ? 'admin@shrimpredict.com' : 'cj@gmail.com'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="mb-3">
                    <label className="form-label extra-small fw-semibold mb-1" style={{ color: isDark ? '#FFFFFF' : '#172A39', fontWeight: 600 }}>
                      {t('login.password', 'Password')}
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-end-0 rounded-start-3"
                        style={{
                          backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                          borderColor: isDark ? 'rgba(233, 228, 224, 0.25)' : '#6E7575',
                          color: '#FC563C',
                        }}
                      >
                        <FaLock size={12} />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control border-start-0 border-end-0 py-2"
                        style={{
                          backgroundColor: isDark ? '#0F1C26' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(233, 228, 224, 0.25)' : '#6E7575',
                          color: isDark ? '#FFFFFF' : '#172A39',
                          fontSize: '0.85rem',
                        }}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="input-group-text border-start-0 rounded-end-3"
                        style={{
                          backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                          borderColor: isDark ? 'rgba(233, 228, 224, 0.25)' : '#6E7575',
                          color: '#FC563C',
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* SIGN IN BUTTON */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn w-100 py-2.5 rounded-3 fw-bold text-white shadow-md d-flex align-items-center justify-content-center gap-2 mb-2.5"
                    style={{
                      backgroundColor: '#FC563C',
                      border: 'none',
                      fontSize: '0.92rem',
                      borderRadius: '10px',
                      boxShadow: '0 4px 18px rgba(252, 86, 60, 0.35)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        {t('login.signingIn', 'Authenticating...')}
                      </>
                    ) : (
                      activeTab === 'admin'
                        ? t('login.signInAsAdmin', 'Sign In as Farm Owner / Admin')
                        : t('login.signInAsCaretaker', 'Sign In as Caretaker')
                    )}
                  </button>

                  {/* DEMO AUTO-FILL CREDENTIALS LINK */}
                  <div className="text-center">
                    <span style={{ color: isDark ? '#CBD5E1' : '#6E7575', fontSize: '0.8rem' }}>
                      {t('login.testingSystem', 'Testing system functions?')}
                    </span>{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange(activeTab)}
                      className="btn btn-link p-0 fw-semibold text-decoration-none ms-1"
                      style={{ color: '#FC563C', fontSize: '0.8rem' }}
                    >
                      {t('login.autoFillDemo', 'Auto-fill demo credentials')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
