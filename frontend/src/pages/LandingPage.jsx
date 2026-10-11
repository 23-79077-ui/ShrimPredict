import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  applyAppTheme,
  getEffectiveTheme,
  getThemePreference,
  resetThemeToAuto,
  setManualTheme
} from '../utils/theme';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import {
  FaClock,
  FaChartLine,
  FaWater,
  FaShieldAlt,
  FaBullseye,
  FaArrowRight,
  FaCamera,
  FaRobot,
  FaExclamationTriangle,
  FaCheckCircle,
  FaMicroscope,
  FaEnvelope,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaClipboardList,
  FaUtensils,
  FaBell,
  FaVial,
  FaInfoCircle,
  FaSun,
  FaMoon,
  FaBars,
  FaTimes,
} from 'react-icons/fa';

const problemSolutions = [
  {
    title: 'The Problem',
    description: 'Shrimp farming heavily relies on manual monitoring, where subtle behavioral changes and deadly infections like White Spot Disease (WSD) go unnoticed until massive mortality (up to 80–100%) occurs. Meanwhile, existing smart aquaculture tools are too expensive and complex for small- to medium-scale farms.',
    icon: <FaExclamationTriangle style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Aquaculture Challenge',
  },
  {
    title: 'The Solution',
    description: 'ShrimPredict provides an affordable, AI-powered web and mobile platform that uses standard smartphone cameras to track feed consumption and detect early signs of WSD via OpenCV and CNN. It delivers instant disease alerts and harvest predictions, empowering farmers to act fast and minimize crop loss.',
    icon: <FaCheckCircle style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'ShrimPredict AI Platform',
  },
];

const features = [
  {
    title: 'CNN-Based White Spot Disease (WSD) Detection',
    description: 'Employs deep learning models to inspect shrimp images for visual markers such as shell spots and discoloration, enabling early isolation before widespread contagion.',
    icon: <FaMicroscope style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Computer Vision AI',
  },
  {
    title: 'Automated Feed Consumption & Behavior Tracking',
    description: 'Analyzes feeding metrics and frequency to identify early declines in appetite, providing vital insights into shrimp health and pond balance.',
    icon: <FaUtensils style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Feed Intelligence',
  },
  {
    title: 'Harvest Readiness Prediction',
    description: 'Computes estimated harvest readiness windows by processing cumulative feeding patterns, culture days, and historical farm logs.',
    icon: <FaChartLine style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Yield Forecasting',
  },
  {
    title: 'Farm Health Dashboard & Analytics',
    description: 'Provides farm administrators with a centralized web dashboard featuring real-time overview charts, automated detection histories, and exportable PDF reports.',
    icon: <FaClipboardList style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Central Analytics',
  },
  {
    title: 'Digital Water Quality & Operation Logs',
    description: 'Offers mobile-friendly data entry for reference parameters—including dissolved oxygen (DO), temperature, pH, salinity, vitamins, and maintenance tasks.',
    icon: <FaVial style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Digital Logbook',
  },
  {
    title: 'Instant Automated Disease Alerts',
    description: 'Dispatches immediate notifications across web and mobile interfaces upon detecting abnormal indicators, prompting rapid on-site biosecurity measures.',
    icon: <FaBell style={{ color: '#FC563C' }} className="fs-3" />,
    badge: 'Real-Time Alerts',
  },
];

const steps = [
  {
    step: '01',
    badge: 'STEP ONE',
    title: 'Capture & Upload',
    description: 'Pond caretakers use an Android mobile device to photograph shrimp from feeding trays or ponds and input routine feeding quantities.',
    icon: <FaCamera style={{ color: '#FC563C' }} className="fs-4" />,
  },
  {
    step: '02',
    badge: 'STEP TWO',
    title: 'Cloud Preprocessing & Feature Extraction',
    description: 'Images are preprocessed via OpenCV to filter noise, enhance image contrast, and isolate morphological features.',
    icon: <FaMicroscope style={{ color: '#FC563C' }} className="fs-4" />,
  },
  {
    step: '03',
    badge: 'STEP THREE',
    title: 'CNN Image Analysis',
    description: 'The trained Convolutional Neural Network inspects the preprocessed imagery to classify health status and identify visual indicators of White Spot Disease.',
    icon: <FaRobot style={{ color: '#FC563C' }} className="fs-4" />,
  },
  {
    step: '04',
    badge: 'STEP FOUR',
    title: 'Data Analytics & Yield Modeling',
    description: 'The platform cross-references recent feeding behavior and historical culture metrics to update growth tracking and harvest timing models.',
    icon: <FaChartLine style={{ color: '#FC563C' }} className="fs-4" />,
  },
  {
    step: '05',
    badge: 'STEP FIVE',
    title: 'Real-Time Notification & Reporting',
    description: 'Processed findings, risk alerts, and performance summaries are instantly published to both the caretaker\\\'s mobile view and the farm owner\\\'s web dashboard for swift operational decisions.',
    icon: <FaBell style={{ color: '#FC563C' }} className="fs-4" />,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, isFilipino } = useLanguage();
  const [activeNav, setActiveNav] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const isManualScroll = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (isManualScroll.current) return;

      const sections = ['home', 'problem-solution', 'features', 'how-it-works', 'contact'];
      const headerEl = document.querySelector('.landing-header');
      const headerHeight = headerEl ? headerEl.offsetHeight : 80;
      const scrollPosition = window.scrollY + headerHeight + 40;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveNav(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setActiveNav(id);
    isManualScroll.current = true;

    const element = document.getElementById(id);
    if (element) {
      if (id === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const headerEl = document.querySelector('.landing-header');
        const headerHeight = headerEl ? headerEl.offsetHeight : 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - (headerHeight + 20);

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
    }

    setTimeout(() => {
      isManualScroll.current = false;
    }, 800);
  };

  return (
    <div
      className="landing-page-wrapper min-vh-100 d-flex flex-column"
      style={{
        backgroundColor: isDark ? '#172A39' : '#E9E4E0',
        color: isDark ? '#FFFFFF' : '#172A39',
        transition: 'background-color 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Header Navigation - Dynamically shifts visuals on light/dark mode */}
      <header
        className="landing-header sticky-top"
        style={{
          backgroundColor: isDark ? 'rgba(23, 42, 57, 0.96)' : 'rgba(233, 228, 224, 0.95)',
          borderBottom: isDark ? '1px solid rgba(110, 117, 117, 0.35)' : '1px solid #6E7575',
          backdropFilter: 'blur(20px)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        }}
      >
        <div
          className="landing-header-inner container-fluid px-3 px-sm-4 px-xl-5 d-flex align-items-center justify-content-between py-2"
          style={{ maxWidth: '1440px', margin: '0 auto' }}
        >
          {/* Brand - strictly preserved, never shrink or truncate */}
          <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none flex-shrink-0">
            <img
              src="/shrimp_predict_logo.png"
              alt="ShrimpPredict Official Logo"
              style={{
                height: '38px',
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <div className="d-flex flex-column justify-content-center flex-shrink-0" style={{ whiteSpace: 'nowrap' }}>
              <span
                className="fw-extrabold tracking-tight d-block"
                style={{
                  fontSize: '1.25rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  color: isDark ? '#FFFFFF' : '#172A39',
                  transition: 'color 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                Shrimp<span style={{ color: '#FC563C' }}>Predict</span>
              </span>
              <span
                className="d-block"
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  lineHeight: 1,
                  marginTop: '2px',
                  color: isDark ? '#CBD5E1' : '#6E7575',
                  transition: 'color 0.3s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                O &amp; B AQUAFARM
              </span>
            </div>
          </Link>

          {/* Desktop / Laptop Navigation Pills - fluid & responsive */}
          <nav
            className="landing-nav d-none d-lg-flex align-items-center"
            style={{
              backgroundColor: isDark ? '#172A39' : '#FFFFFF',
              border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
              transition: 'background-color 0.3s ease, border-color 0.3s ease',
            }}
          >
            {['home', 'problem-solution', 'features', 'how-it-works', 'contact'].map((id) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`nav-pill-btn ${activeNav === id ? 'active' : ''}`}
                style={{
                  background: activeNav === id ? '#FC563C' : 'transparent',
                  color: activeNav === id ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#172A39'),
                }}
              >
                {id === 'home'
                  ? t('nav.home', 'Home')
                  : id === 'problem-solution'
                  ? t('nav.problemSolution', 'Problem & Solution')
                  : id === 'features'
                  ? t('nav.features', 'Features')
                  : id === 'how-it-works'
                  ? t('nav.howItWorks', 'How It Works')
                  : t('nav.contact', 'Contact')}
              </button>
            ))}
          </nav>

          {/* Right Action Bar: Language Toggle, Theme Toggle & Sign In */}
          <div className="d-flex align-items-center gap-1.5 gap-sm-2 flex-shrink-0">
            <LanguageToggle isDark={isDark} />

            {!isAuto && (
              <button
                type="button"
                onClick={handleResetToAuto}
                className="btn btn-sm rounded-pill d-inline-flex align-items-center gap-1.5 shadow-xs px-2.5 py-1 flex-shrink-0"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1EBE6',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #D5CEC8',
                  color: isDark ? '#E2E8F0' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  height: 38,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
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
              className="btn rounded-pill position-relative d-flex align-items-center justify-content-center p-0 shadow-xs flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
                transition: 'all 0.2s ease',
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
              {isDark ? <FaSun size={14} className="text-warning" /> : <FaMoon size={13} style={{ color: '#172A39' }} />}
              {isAuto && (
                <span
                  className="position-absolute d-flex align-items-center justify-content-center rounded-circle"
                  style={{
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    backgroundColor: '#FC563C',
                    color: '#FFFFFF',
                    fontSize: 8,
                    fontWeight: 700,
                    boxShadow: '0 0 4px rgba(0,0,0,0.25)',
                  }}
                  title="Auto Day/Night Mode (6am–6pm Light, 6pm–6am Dark)"
                >
                  <FaClock size={8} />
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/login')}
              className="btn btn-sm rounded-pill px-3 py-1.5 fw-bold d-flex align-items-center gap-1.5 shadow-xs flex-shrink-0"
              style={{
                backgroundColor: '#FC563C',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.84rem',
                height: 38,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{t('nav.signIn', 'Sign In')}</span> <FaArrowRight size={10} />
            </button>

            {/* Mobile / Narrow Screen Menu Toggle (visible on < lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="btn btn-sm rounded-pill d-lg-none d-flex align-items-center justify-content-center p-0 flex-shrink-0 shadow-xs ms-1"
              style={{
                width: 38,
                height: 38,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
                color: isDark ? '#FFFFFF' : '#172A39',
                cursor: 'pointer',
              }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <FaTimes size={15} /> : <FaBars size={15} />}
            </button>
          </div>
        </div>

        {/* Mobile / Narrow Screen Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            className="d-lg-none border-top px-3 py-2.5 shadow-sm"
            style={{
              backgroundColor: isDark ? '#172A39' : '#FFFFFF',
              borderColor: isDark ? 'rgba(110, 117, 117, 0.35)' : 'rgba(110, 117, 117, 0.2)',
            }}
          >
            <div className="d-flex flex-column gap-1">
              {['home', 'problem-solution', 'features', 'how-it-works', 'contact'].map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    scrollToSection(id);
                    setMobileMenuOpen(false);
                  }}
                  className="btn text-start rounded-pill px-3 py-2 fw-bold transition-all"
                  style={{
                    background: activeNav === id ? '#FC563C' : 'transparent',
                    color: activeNav === id ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#172A39'),
                    fontSize: '0.86rem',
                    border: 'none',
                  }}
                >
                  {id === 'home'
                    ? t('nav.home', 'Home')
                    : id === 'problem-solution'
                    ? t('nav.problemSolution', 'Problem & Solution')
                    : id === 'features'
                    ? t('nav.features', 'Features')
                    : id === 'how-it-works'
                    ? t('nav.howItWorks', 'How It Works')
                    : t('nav.contact', 'Contact')}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow-1">
        {/* Home / Hero Section */}
        <section id="home" className="hero-section-enhanced py-5 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #172A39 0%, #203A4F 60%, #172A39 100%)' }}>
          <div className="hero-bg-glow" style={{ background: 'radial-gradient(circle, rgba(252, 86, 60, 0.22) 0%, transparent 70%)' }}></div>
          <div className="hero-bg-glow-left" style={{ background: 'radial-gradient(circle, rgba(23, 42, 57, 0.4) 0%, transparent 70%)' }}></div>

          <div className="container py-lg-5 position-relative z-1">
            <div className="row align-items-center gy-5">
              {/* Left Column: Title & Hero Copy */}
              <div className="col-lg-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                  {/* THESIS TITLE */}
                  <h1 className="display-5 fw-extrabold text-white mb-3 lh-sm">
                    Shrimp<span style={{ color: '#FC563C' }}>Predict</span>:{' '}
                    <span style={{ color: '#E2E8F0' }}>
                      {isFilipino ? 'Sistema ng Pagsubaybay sa Pakain at Pagsusuri ng Sakit ng Sugpo' : 'Shrimp Feed Monitoring and Disease Detection System'}
                    </span>{' '}
                    <span className="d-block fs-3 fw-bold mt-2" style={{ color: '#E9E4E0' }}>
                      {isFilipino ? 'Gamit ang Image Processing at AI' : 'Utilizing Image Processing'}
                    </span>
                  </h1>

                  <p className="hero-copy lead mb-4 fw-normal" style={{ maxWidth: '580px', color: '#E9E4E0' }}>
                    {isFilipino
                      ? 'Pinapalakas ang mga tagapag-alaga at may-ari ng palaisdaan gamit ang real-time na pagsubaybay sa pakain, awtomatikong pagtataya sa ani, at mabilisang pagsusuri ng White Spot Disease (WSD) gamit ang AI at image processing.'
                      : 'Empowering shrimp caretakers and farm operators with real-time digital feed monitoring, automated harvest yield predictions, and instant AI-powered White Spot Disease (WSD) diagnosis via image processing.'}
                  </p>

                  <div className="d-flex flex-wrap gap-3 mb-2">
                    <button
                      onClick={() => navigate('/login')}
                      className="btn btn-lg fw-extrabold d-flex align-items-center gap-2 px-4 py-3 shadow rounded-3 border-0"
                      style={{
                        backgroundColor: '#FC563C',
                        color: '#FFFFFF',
                        boxShadow: '0 4px 18px rgba(252, 86, 60, 0.4)',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {isFilipino ? 'Magsimula Ngayon' : 'Get Started Now'} <FaArrowRight />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Hero Visual Showcase */}
              <div className="col-lg-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="position-relative d-flex flex-column align-items-center justify-content-center p-4 p-md-5 rounded-4 shadow-lg"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(252, 86, 60, 0.16) 0%, rgba(23, 42, 57, 0.85) 75%)',
                    border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : 'none',
                    backdropFilter: 'blur(16px)',
                    minHeight: '440px',
                  }}
                >
                  {/* Glowing Pulsing Ambient Aura */}
                  <div
                    className="position-absolute rounded-circle pointer-events-none"
                    style={{
                      width: '320px',
                      height: '320px',
                      background: 'radial-gradient(circle, rgba(252, 86, 60, 0.25) 0%, transparent 80%)',
                      filter: 'blur(40px)',
                    }}
                  ></div>

                  {/* Large Centered Logo */}
                  <div className="position-relative z-1 my-3 text-center">
                    <motion.img
                      src="/shrimp_predict_logo.png"
                      alt="ShrimPredict Official Logo"
                      animate={{ scale: [1, 1.07, 1] }}
                      transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ maxHeight: '350px', width: 'auto', objectFit: 'contain' }}
                      className="logo-glow-intense img-fluid"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem & Solution Overview Section */}
        <section
          id="problem-solution"
          className="py-5"
          style={{
            backgroundColor: isDark ? '#12202C' : '#E9E4E0',
            borderBottom: isDark ? '1px solid rgba(110, 117, 117, 0.3)' : '1px solid #6E7575',
            transition: 'background-color 0.3s ease',
          }}
        >
          <div className="container py-lg-4">
            <div className="text-center mx-auto mb-4" style={{ maxWidth: '720px' }}>
              <h2 className="display-6 fw-extrabold mb-2" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>
                {t('nav.problemSolution', 'Problem & Solution')}
              </h2>
              <p className="lead small mb-0" style={{ fontSize: '0.95rem', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                {isFilipino
                  ? 'Pagbabago ng manwal na panganib tungo sa matalinong proteksyon ng palaisdaan gamit ang datos.'
                  : 'Transforming manual aquaculture risks into intelligent, data-driven farm protection.'}
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {problemSolutions.map((item, idx) => {
                const itemTitle = idx === 0 ? t('landing.problemTitle') : t('landing.solutionTitle');
                const itemDesc = idx === 0 ? t('landing.problemDesc') : t('landing.solutionDesc');
                const itemBadge = idx === 0 ? (isFilipino ? 'Hamon sa Akwakultura' : 'Aquaculture Challenge') : (isFilipino ? 'Plataporma ng ShrimPredict' : 'ShrimPredict AI Platform');

                return (
                  <div key={idx} className="col-md-6">
                    <motion.div
                      whileHover={{ y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="card h-100 shadow-sm rounded-4 p-4 position-relative overflow-hidden transition-all"
                      style={{
                        backgroundColor: isDark ? '#1B2F3F' : '#FFFFFF',
                        border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                      }}
                    >
                      {/* Top Accent Line */}
                      <div className="position-absolute top-0 start-0 end-0" style={{ height: 4, backgroundColor: '#FC563C' }} />

                      <div className="d-flex align-items-center justify-content-between mb-3.5 border-bottom pb-3" style={{ borderColor: isDark ? 'rgba(110, 117, 117, 0.3)' : '#E9E4E0' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="p-3 rounded-3 shadow-xs d-inline-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(252, 86, 60, 0.15)' }}>
                            {item.icon}
                          </div>
                          <h4 className="fw-bold mb-0 fs-5" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>{itemTitle}</h4>
                        </div>
                        <span
                          className="badge extra-small px-3 py-1.5 rounded-pill fw-bold"
                          style={{
                            backgroundColor: isDark ? '#12202C' : '#E9E4E0',
                            color: isDark ? '#E9E4E0' : '#172A39',
                            border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
                          }}
                        >
                          {itemBadge}
                        </span>
                      </div>

                      <p className="small mb-0 lh-relaxed" style={{ fontSize: '0.92rem', lineHeight: '1.7', color: isDark ? '#CBD5E1' : '#172A39' }}>
                        {itemDesc}
                      </p>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* System Core Features Section */}
        <section
          id="features"
          className="py-5"
          style={{
            backgroundColor: isDark ? '#172A39' : '#FFFFFF',
            borderBottom: isDark ? '1px solid rgba(110, 117, 117, 0.3)' : '1px solid #6E7575',
            transition: 'background-color 0.3s ease',
          }}
        >
          <div className="container py-lg-2">
            <div className="text-center mx-auto mb-4" style={{ maxWidth: '750px' }}>
              <h2 className="display-6 fw-extrabold mb-1.5" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>
                {isFilipino ? 'Mga Pangunahing Tampok ng Sistema' : 'System Core Features'}
              </h2>
              <p className="lead small mb-0" style={{ fontSize: '0.92rem', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                {isFilipino
                  ? 'Isang pinagsamang plataporma para sa malalimang pagsusuri ng sakit, digital na tala ng pakain, at pagtataya sa ani.'
                  : 'An integrated aquaculture intelligence platform uniting deep-learning disease detection, digital feeding logs, and predictive harvest analytics.'}
              </p>
            </div>

            <div className="row g-3 justify-content-center">
              {features.map((item, idx) => {
                const featTitles = [
                  t('landing.feat1Title'),
                  t('landing.feat2Title'),
                  t('landing.feat3Title'),
                  t('landing.feat4Title'),
                  t('landing.feat5Title'),
                  t('landing.feat6Title')
                ];
                const featDescs = [
                  t('landing.feat1Desc'),
                  t('landing.feat2Desc'),
                  t('landing.feat3Desc'),
                  t('landing.feat4Desc'),
                  t('landing.feat5Desc'),
                  t('landing.feat6Desc')
                ];
                const featBadges = [
                  isFilipino ? 'Computer Vision AI' : 'Computer Vision AI',
                  isFilipino ? 'Tala ng Pakain' : 'Feed Intelligence',
                  isFilipino ? 'Taya sa Ani' : 'Yield Forecasting',
                  isFilipino ? 'Sentral na Analytics' : 'Central Analytics',
                  isFilipino ? 'Digital Logbook' : 'Digital Logbook',
                  isFilipino ? 'Real-Time na Alerto' : 'Real-Time Alerts'
                ];

                return (
                  <div key={idx} className="col-md-6 col-lg-4">
                    <motion.div
                      whileHover={{ y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="card h-100 shadow-xs rounded-3 p-3 position-relative overflow-hidden transition-all"
                      style={{
                        backgroundColor: isDark ? '#203A4F' : '#FFFFFF',
                        border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                      }}
                    >
                      {/* Top Glowing Accent Line */}
                      <div className="position-absolute top-0 start-0 end-0" style={{ height: 3, backgroundColor: '#FC563C' }} />

                      <div className="card-body d-flex flex-column p-0 justify-content-between">
                        <div>
                          <div className="d-flex align-items-center justify-content-between mb-2.5">
                            <div className="p-2 rounded-2 d-inline-flex align-items-center justify-content-center shadow-xs" style={{ backgroundColor: 'rgba(252, 86, 60, 0.15)' }}>
                              {item.icon}
                            </div>
                            <span
                              className="badge tiny fw-bold px-2 py-1 rounded-pill"
                              style={{
                                backgroundColor: isDark ? '#172A39' : '#E9E4E0',
                                color: isDark ? '#E9E4E0' : '#172A39',
                                border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
                              }}
                            >
                              {featBadges[idx]}
                            </span>
                          </div>
                          <h6 className="fw-bold mb-1.5 fs-6 lh-sm" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>{featTitles[idx]}</h6>
                          <p className="tiny mb-0 lh-relaxed" style={{ fontSize: '0.83rem', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                            {featDescs[idx]}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How ShrimPredict Works Section */}
        <section
          id="how-it-works"
          className="py-5"
          style={{
            backgroundColor: isDark ? '#12202C' : '#E9E4E0',
            borderBottom: isDark ? '1px solid rgba(110, 117, 117, 0.3)' : '1px solid #6E7575',
            transition: 'background-color 0.3s ease',
          }}
        >
          <div className="container-fluid px-lg-4 py-lg-4">
            <div className="text-center mx-auto mb-4" style={{ maxWidth: '750px' }}>
              <h2 className="display-6 fw-extrabold mb-2" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>
                {isFilipino ? (
                  <span>Paano Gumagana ang Shrimp<span style={{ color: '#FC563C' }}>Predict</span></span>
                ) : (
                  <span>How Shrimp<span style={{ color: '#FC563C' }}>Predict</span> Works</span>
                )}
              </h2>
              <p className="lead small mb-0" style={{ fontSize: '0.95rem', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                {isFilipino
                  ? 'Mula sa pagkuha ng litrato sa tabi ng palaisdaan hanggang sa pagsusuri ng AI, pagtataya sa ani, at mga real-time na alerto sa dashboard.'
                  : 'From pond-side photo capture to AI classification, predictive yield modeling, and real-time dashboard alerts.'}
              </p>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-2.5 justify-content-center align-items-stretch">
              {steps.map((s, idx) => {
                const stepTitles = [
                  t('landing.step1Title'),
                  t('landing.step2Title'),
                  t('landing.step3Title'),
                  t('landing.step4Title'),
                  t('landing.step5Title')
                ];
                const stepDescs = [
                  t('landing.step1Desc'),
                  t('landing.step2Desc'),
                  t('landing.step3Desc'),
                  t('landing.step4Desc'),
                  t('landing.step5Desc')
                ];
                const stepBadges = [
                  isFilipino ? 'HAKBANG 1' : 'STEP ONE',
                  isFilipino ? 'HAKBANG 2' : 'STEP TWO',
                  isFilipino ? 'HAKBANG 3' : 'STEP THREE',
                  isFilipino ? 'HAKBANG 4' : 'STEP FOUR',
                  isFilipino ? 'HAKBANG 5' : 'STEP FIVE'
                ];

                return (
                  <div key={idx} className="col">
                    <motion.div
                      whileHover={{ y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="card h-100 shadow-xs rounded-3 p-3 position-relative overflow-hidden transition-all"
                      style={{
                        backgroundColor: isDark ? '#1B2F3F' : '#FFFFFF',
                        border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                      }}
                    >
                      {/* Top Glowing Accent Line */}
                      <div className="position-absolute top-0 start-0 end-0" style={{ height: 3, backgroundColor: '#FC563C' }} />

                      <div className="card-body d-flex flex-column p-0">
                        <div className="d-flex align-items-center justify-content-between w-100 mb-2.5">
                          <span
                            className="badge px-2 py-1 rounded-pill tiny fw-bold"
                            style={{
                              backgroundColor: isDark ? '#12202C' : '#E9E4E0',
                              color: isDark ? '#E9E4E0' : '#172A39',
                              border: isDark ? '1px solid rgba(110, 117, 117, 0.4)' : '1px solid #6E7575',
                            }}
                          >
                            {stepBadges[idx]}
                          </span>
                          <span className="fs-5 fw-extrabold font-mono lh-1" style={{ color: '#FC563C', opacity: isDark ? 0.85 : 0.5 }}>
                            {s.step}
                          </span>
                        </div>

                        <div className="d-flex align-items-center gap-2 mb-2">
                          <div className="p-2 rounded-2 d-inline-flex align-items-center justify-content-center shadow-xs" style={{ backgroundColor: 'rgba(252, 86, 60, 0.15)' }}>
                            {s.icon}
                          </div>
                          <h6 className="fw-bold mb-0 extra-small lh-sm" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>{stepTitles[idx]}</h6>
                        </div>

                        <p className="tiny mb-0 lh-relaxed" style={{ fontSize: '0.81rem', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                          {stepDescs[idx]}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contact & Partner Section */}
        <section
          id="contact"
          className="py-5"
          style={{
            backgroundColor: isDark ? '#172A39' : '#FFFFFF',
            borderBottom: isDark ? '1px solid rgba(110, 117, 117, 0.3)' : undefined,
            transition: 'background-color 0.3s ease',
          }}
        >
          <div className="container py-lg-4">
            <div className="mx-auto" style={{ maxWidth: '900px' }}>
              <div className="text-center mb-4">
                <h2 className="display-6 fw-bold mb-2" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>O&amp;B Aqua Farm &amp; System Support</h2>
                <p className="extra-small mb-0" style={{ color: isDark ? '#CBD5E1' : '#6E7575' }}>
                  Official contact details for O&amp;B Aqua Farm commercial grow-out operations, wholesale seafood inquiries, and ShrimPredict AI platform support.
                </p>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <div
                    className="card h-100 shadow-xs rounded-4 p-4 text-center"
                    style={{
                      backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                      border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                    }}
                  >
                    <div
                      className="p-3 rounded-circle fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center"
                      style={{
                        width: 56,
                        height: 56,
                        backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                        color: '#FC563C',
                        border: isDark ? '1px solid rgba(110, 117, 117, 0.5)' : '1px solid #6E7575',
                      }}
                    >
                      <FaMapMarkerAlt />
                    </div>
                    <h6 className="fw-bold mb-1" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>Physical Address</h6>
                    <span className="extra-small d-block" style={{ color: isDark ? '#CBD5E1' : '#6E7575' }}>
                      O&amp;B Aqua Farm, Sitio Carbonan Rd, Brgy. Balitoc, Calatagan, 4215 Batangas, Philippines
                    </span>
                  </div>
                </div>

                <div className="col-md-4">
                  <div
                    className="card h-100 shadow-xs rounded-4 p-4 text-center"
                    style={{
                      backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                      border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                    }}
                  >
                    <div
                      className="p-3 rounded-circle fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center"
                      style={{
                        width: 56,
                        height: 56,
                        backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                        color: '#FC563C',
                        border: isDark ? '1px solid rgba(110, 117, 117, 0.5)' : '1px solid #6E7575',
                      }}
                    >
                      <FaPhoneAlt />
                    </div>
                    <h6 className="fw-bold mb-1" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>Management Line</h6>
                    <a href="tel:+639622316169" className="fw-bold text-decoration-none small" style={{ color: '#FC563C' }}>+63 962 231 6169</a>
                    <small className="extra-small d-block mt-1" style={{ color: isDark ? '#CBD5E1' : '#6E7575' }}>Available for farm wholesale inquiries</small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div
                    className="card h-100 shadow-xs rounded-4 p-4 text-center"
                    style={{
                      backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                      border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                    }}
                  >
                    <div
                      className="p-3 rounded-circle fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center"
                      style={{
                        width: 56,
                        height: 56,
                        backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                        color: '#FC563C',
                        border: isDark ? '1px solid rgba(110, 117, 117, 0.5)' : '1px solid #6E7575',
                      }}
                    >
                      <FaEnvelope />
                    </div>
                    <h6 className="fw-bold mb-1" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>Support Email</h6>
                    <span className="small d-block" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>support@shrimp-predict.com</span>
                    <small className="extra-small d-block mt-1" style={{ color: isDark ? '#CBD5E1' : '#6E7575' }}>AI platform technical support</small>
                  </div>
                </div>
              </div>

              {/* Commercial Partner Advisory */}
              <div
                className="p-4 rounded-4 shadow-xs"
                style={{
                  backgroundColor: isDark ? '#203A4F' : '#E9E4E0',
                  border: isDark ? '1.5px solid rgba(110, 117, 117, 0.4)' : '1.5px solid #6E7575',
                }}
              >
                <div className="fw-bold mb-1 d-flex align-items-center gap-2 fs-6" style={{ color: isDark ? '#FFFFFF' : '#172A39' }}>
                  <FaInfoCircle className="fs-5" style={{ color: '#FC563C' }} /> Commercial Visitor &amp; Wholesale Advisory
                </div>
                <p className="mb-0 extra-small" style={{ color: isDark ? '#CBD5E1' : '#6E7575' }}>
                  O&amp;B Aqua Farm operates strictly as a commercial grow-out aquaculture facility. For wholesale fresh Pacific White Shrimp (<em>Penaeus vannamei</em>) purchases direct from the farm gate, please call management (+63 962 231 6169) prior to visiting to confirm harvest schedules.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section
          className="py-5 text-white"
          style={{
            background: 'linear-gradient(135deg, #172A39 0%, #203A4F 60%, #172A39 100%)',
            borderTop: isDark ? '1px solid rgba(110, 117, 117, 0.35)' : '1px solid #6E7575',
          }}
        >
          <div className="container text-center py-4">
            <h2 className="display-6 fw-bold mb-3 text-white">
              {isFilipino ? 'Handa Nang Protektahan ang Inyong mga Palaisdaan?' : 'Ready to Protect Your Shrimp Ponds?'}
            </h2>
            <p className="lead mb-4 mx-auto" style={{ maxWidth: '600px', color: '#E9E4E0' }}>
              {isFilipino
                ? 'Palakasin ang mga tagapag-alaga gamit ang mabilisang tala ng pakain at AI computer vision upang maiwasan ang sakit at mapataas ang ani.'
                : 'Empower caretakers with instant feed logging and computer vision AI to prevent disease outbreaks and maximize harvest yields.'}
            </p>
            <div className="d-flex justify-content-center gap-3">
              <button
                onClick={() => navigate('/login?type=caretaker')}
                className="btn btn-lg fw-bold px-4 py-3 rounded-3 shadow border-0"
                style={{
                  backgroundColor: '#FC563C',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 18px rgba(252, 86, 60, 0.4)',
                }}
              >
                {isFilipino ? 'Portal ng Tagapag-alaga' : 'Caretaker Portal'}
              </button>
              <button
                onClick={() => navigate('/login?type=admin')}
                className="btn btn-lg fw-bold px-4 py-3 rounded-3"
                style={{
                  backgroundColor: 'transparent',
                  color: '#E9E4E0',
                  border: '1.5px solid #E9E4E0',
                }}
              >
                {isFilipino ? 'Dashboard ng Admin' : 'Admin Dashboard'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="py-4 mt-auto"
        style={{
          backgroundColor: '#12202C',
          color: '#E9E4E0',
          borderTop: isDark ? '1px solid rgba(110, 117, 117, 0.35)' : '1px solid #6E7575',
        }}
      >
        <div className="container text-center">
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap mb-2">
            <div className="d-inline-flex align-items-center gap-2.5">
              <img src="/shrimp_predict_logo.png" alt="ShrimpPredict Official Logo" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} className="logo-glow-orange" />
              <div className="text-start">
                <span className="fw-extrabold tracking-tight d-block text-white" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  Shrimp<span style={{ color: '#FC563C' }}>Predict</span>
                </span>
                <span className="d-block" style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, marginTop: '2px', color: isDark ? '#CBD5E1' : '#6E7575' }}>
                  O &amp; B AQUAFARM
                </span>
              </div>
            </div>
            <span style={{ color: '#6E7575' }} className="d-none d-md-inline">|</span>
            <span className="extra-small" style={{ color: '#E9E4E0' }}>O&amp;B Aqua Farm, Sitio Carbonan Rd, Brgy. Balitoc, Calatagan, 4215 Batangas</span>
            <span style={{ color: '#6E7575' }} className="d-none d-md-inline">|</span>
            <span className="extra-small" style={{ color: '#E9E4E0' }}>+63 962 231 6169</span>
          </div>
          <p className="tiny mb-0" style={{ color: isDark ? '#A0AEC0' : '#6E7575' }}>
            © 2026 Shrimp<span style={{ color: '#FC563C' }}>Predict</span>: {isFilipino ? 'Sistema ng Pagsubaybay sa Pakain at Pagsusuri ng Sakit ng Sugpo Gamit ang Image Processing. Lahat ng karapatan ay nakalaan.' : 'Shrimp Feed Monitoring and Disease Detection System Utilizing Image Processing. All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
