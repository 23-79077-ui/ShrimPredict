import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaChartLine,
  FaWater,
  FaShieldAlt,
  FaBullseye,
  FaArrowRight,
  FaCheckCircle,
  FaCamera,
  FaRobot,
  FaExclamationTriangle,
  FaMicroscope,
  FaUserShield,
  FaUserCog,
  FaInfoCircle,
  FaEnvelope,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaPlay,
  FaClipboardList,
  FaUtensils,
  FaBell,
  FaVial,
} from 'react-icons/fa';

const stats = [
  { label: 'Dataset Trained', value: '1,802', detail: 'Real shrimp photos evaluated', icon: <FaMicroscope /> },
  { label: 'AI Accuracy', value: '99.45%', detail: 'Zero false positive rate', icon: <FaShieldAlt /> },
  { label: 'Active Ponds Monitored', value: '24 Ponds', detail: 'Real-time caretaker sync', icon: <FaWater /> },
  { label: 'Disease Response Time', value: '< 1.5 sec', detail: 'Instant image processing', icon: <FaBullseye /> },
];

const problemSolutions = [
  {
    title: 'White Spot Disease (WSD) Outbreak Prevention',
    challenge: 'WSD can cause 80% to 100% mortality in shrimp populations within days if left unmonitored.',
    solution: 'Rapid visual screening via mobile capture, analyzed by CNN models to identify lesions early and trigger isolation protocols.',
    icon: <FaExclamationTriangle className="text-danger fs-2" />,
    badge: 'Disease Prevention',
    borderColor: 'border-danger',
    accentBg: 'bg-danger-soft',
  },
  {
    title: 'Feed Ration Optimization',
    challenge: 'Overfeeding deteriorates pond water quality, while underfeeding stunts growth and lowers survival rates.',
    solution: 'Digital logging of feeding frequency, amounts, and tray behaviors to evaluate feed conversion and minimize waste.',
    icon: <FaUtensils className="text-warning fs-2" />,
    badge: 'Feed Efficiency',
    borderColor: 'border-warning',
    accentBg: 'bg-warning-soft',
  },
];

const features = [
  {
    title: 'Image-Based WSD Detection',
    description: 'Capture shrimp photos directly at pond trays for automated visual analysis using OpenCV and convolutional neural networks.',
    icon: <FaMicroscope className="text-primary fs-3" />,
    badge: 'Computer Vision',
  },
  {
    title: 'Digital Feed & Behavior Logs',
    description: 'Eliminate manual, paper-based records with structured digital entries for feeding times, quantities, and consumption rates.',
    icon: <FaClipboardList className="text-info fs-3" />,
    badge: 'Digital Logbook',
  },
  {
    title: 'Harvest Yield Prediction',
    description: 'Data-driven forecast models estimate optimal harvest windows and harvest volume based on feeding trends and culture days.',
    icon: <FaChartLine className="text-success fs-3" />,
    badge: 'Yield Forecasting',
  },
  {
    title: 'Water Quality & Supplement Records',
    description: 'Dedicated digital log sheets to track temperature, dissolved oxygen, pH, salinity, and vitamin treatments for historical reference.',
    icon: <FaVial className="text-primary fs-3" />,
    badge: 'Water & Health Log',
  },
  {
    title: 'Automated Threat Alerts',
    description: 'Push notifications immediately inform the farm owner whenever abnormal feeding patterns or disease symptoms are detected.',
    icon: <FaBell className="text-warning fs-3" />,
    badge: 'Real-Time Alerts',
  },
];

const steps = [
  {
    step: '01',
    badge: 'STEP ONE',
    title: 'Field Image Capture',
    description: 'Pond caretakers photograph sampled shrimp from feeding trays using an Android device.',
    icon: <FaCamera className="fs-3 text-primary" />,
    accent: 'primary',
  },
  {
    step: '02',
    badge: 'STEP TWO',
    title: 'AI-Driven Processing',
    description: 'The backend runs image enhancement and CNN classification to identify symptomatic white spots and shell abnormalities.',
    icon: <FaRobot className="fs-3 text-info" />,
    accent: 'info',
  },
  {
    step: '03',
    badge: 'STEP THREE',
    title: 'Instant Diagnosis & Alerting',
    description: 'Caretakers receive immediate on-screen results while the system flags potential infections to the farm owner.',
    icon: <FaCheckCircle className="fs-3 text-success" />,
    accent: 'success',
  },
  {
    step: '04',
    badge: 'STEP FOUR',
    title: 'Data Analytics & Production Planning',
    description: 'The system aggregates feed intake and pond logs to project harvest readiness and generate exportable reports.',
    icon: <FaChartLine className="fs-3 text-warning" />,
    accent: 'warning',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoState, setDemoState] = useState({
    image: null,
    analyzing: false,
    result: null,
  });

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'problem-solution', 'features', 'how-it-works', 'contact'];
      const scrollPosition = window.scrollY + 140;

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
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const runSampleDemo = (type) => {
    setDemoState({ image: null, analyzing: true, result: null });
    setTimeout(() => {
      if (type === 'healthy') {
        setDemoState({
          image: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=500&auto=format&fit=crop&q=60',
          analyzing: false,
          result: {
            disease: 'Healthy Shrimp',
            confidence: 85.0,
            risk: 'Low Risk',
            color: 'success',
            notes: 'No WSD lesions or abnormal spot contrast detected. Shell texture uniform and clear.',
          },
        });
      } else {
        setDemoState({
          image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=60',
          analyzing: false,
          result: {
            disease: 'White Spot Disease (WSD)',
            confidence: 82.0,
            risk: 'High Risk',
            color: 'danger',
            notes: 'Dense white spot lesions detected on carapace via CNN classification. Immediate pond isolation recommended.',
          },
        });
      }
    }, 1000);
  };

  return (
    <div className="landing-page-wrapper bg-light min-vh-100 d-flex flex-column">
      {/* Header Navigation */}
      <header className="landing-header sticky-top">
        <div className="container d-flex align-items-center justify-content-between gap-3">
          <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none text-dark fw-bold fs-4">
            <span className="fw-extrabold text-dark tracking-tight fs-3">ShrimPredict</span>
          </Link>

          <nav className="landing-nav d-none d-lg-flex align-items-center">
            <button
              onClick={() => scrollToSection('home')}
              className={`nav-pill-btn ${activeNav === 'home' ? 'active' : ''}`}
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('problem-solution')}
              className={`nav-pill-btn ${activeNav === 'problem-solution' ? 'active' : ''}`}
            >
              Problem &amp; Solution
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className={`nav-pill-btn ${activeNav === 'features' ? 'active' : ''}`}
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className={`nav-pill-btn ${activeNav === 'how-it-works' ? 'active' : ''}`}
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className={`nav-pill-btn ${activeNav === 'contact' ? 'active' : ''}`}
            >
              Contact
            </button>
          </nav>

          <div className="d-flex align-items-center gap-2.5">
            <button
              onClick={() => navigate('/login?type=admin')}
              className="btn btn-outline-primary rounded-pill px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 shadow-xs transition-all hover-lift"
              style={{ fontSize: '0.88rem' }}
            >
              <FaUserShield className="text-primary" /> Admin Login
            </button>
            <button
              onClick={() => navigate('/login?type=caretaker')}
              className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 shadow-md text-white transition-all hover-lift"
              style={{ fontSize: '0.88rem', backgroundColor: '#0b2c5f', borderColor: '#0b2c5f' }}
            >
              <FaUserCog /> Caretaker Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow-1">
        {/* Home / Hero Section */}
        <section id="home" className="hero-section-enhanced py-5 position-relative overflow-hidden">
          <div className="hero-bg-glow"></div>
          <div className="hero-bg-glow-left"></div>

          <div className="container py-lg-5 position-relative z-1">
            <div className="row align-items-center gy-5">
              {/* Left Column: Thesis Title & Hero Copy */}
              <div className="col-lg-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                  <div className="hero-thesis-badge mb-3">
                    <FaRobot className="text-warning fs-6" />
                    <span>THESIS SYSTEM • AI AQUACULTURE INTELLIGENCE</span>
                  </div>

                  {/* THESIS TITLE */}
                  <h1 className="display-5 fw-extrabold text-white mb-3 lh-sm">
                    <span className="text-warning">ShrimPredict:</span> Shrimp Feed Monitoring and Disease Detection System{' '}
                    <span className="d-block fs-3 fw-bold text-gradient-cyan mt-2">
                      Utilizing Image Processing
                    </span>
                  </h1>

                  <p className="hero-copy lead text-white-90 mb-4 fw-normal" style={{ maxWidth: '580px', color: 'rgba(255, 255, 255, 0.88)' }}>
                    Empowering shrimp caretakers and farm operators with real-time digital feed monitoring, automated harvest yield predictions, and instant AI-powered White Spot Disease (WSD) diagnosis via image processing.
                  </p>

                  <div className="d-flex flex-wrap gap-3 mb-4">
                    <button
                      onClick={() => navigate('/login')}
                      className="btn btn-warning btn-lg text-dark fw-extrabold d-flex align-items-center gap-2 px-4 py-3 shadow rounded-3"
                    >
                      Get Started Now <FaArrowRight />
                    </button>
                    <button
                      onClick={() => setShowDemoModal(true)}
                      className="btn btn-outline-light btn-lg text-white fw-bold d-flex align-items-center gap-2 px-4 py-3 rounded-3"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <FaPlay className="text-warning" /> Try AI Scanner Demo
                    </button>
                  </div>

                  {/* Quick Highlight Pills */}
                  <div className="d-flex flex-wrap align-items-center gap-3 text-white small fw-medium">
                    <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 px-3 py-1.5 rounded-pill border border-white border-opacity-10">
                      <FaCheckCircle className="text-success fs-6" /> <span className="fw-semibold">1,802 Dataset Trained</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 px-3 py-1.5 rounded-pill border border-white border-opacity-10">
                      <FaCheckCircle className="text-info fs-6" /> <span className="fw-semibold">99.45% Accuracy</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 bg-white bg-opacity-10 px-3 py-1.5 rounded-pill border border-white border-opacity-10">
                      <FaCheckCircle className="text-warning fs-6" /> <span className="fw-semibold">Zero False Positive</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Hero Visual Showcase with Large Glowing Logo */}
              <div className="col-lg-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="position-relative d-flex flex-column align-items-center justify-content-center p-4 p-md-5 rounded-4 border border-white border-opacity-10 shadow-lg"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(255, 107, 53, 0.22) 0%, rgba(6, 182, 212, 0.15) 50%, rgba(7, 23, 51, 0.6) 85%)',
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
                      background: 'radial-gradient(circle, rgba(255, 107, 53, 0.3) 0%, rgba(6, 182, 212, 0.2) 60%, transparent 80%)',
                      filter: 'blur(40px)',
                    }}
                  ></div>

                  {/* Large Centered Intense Glowing Logo */}
                  <div className="position-relative z-1 my-3 text-center">
                    <img
                      src="/shrimp_predict_logo.png"
                      alt="ShrimPredict Official Logo"
                      style={{
                        maxHeight: '350px',
                        width: 'auto',
                        objectFit: 'contain',
                      }}
                      className="logo-glow-intense img-fluid"
                    />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="bg-white py-4 border-top border-bottom shadow-xs">
          <div className="container">
            <div className="row g-4 text-center">
              {stats.map((stat, idx) => (
                <div key={idx} className="col-6 col-md-3">
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="stat-box-modern h-100"
                  >
                    <div className="icon-circle-gradient mx-auto mb-2.5">{stat.icon}</div>
                    <div className="display-6 fw-extrabold text-dark tracking-tight mb-0">{stat.value}</div>
                    <div className="fw-bold text-dark small">{stat.label}</div>
                    <div className="text-muted tiny fw-medium mt-0.5">{stat.detail}</div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem & Solution Overview Section */}
        <section id="problem-solution" className="py-5 bg-white border-bottom">
          <div className="container py-lg-4">
            <div className="text-center mx-auto mb-5" style={{ maxWidth: '720px' }}>
              <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-2 d-inline-flex align-items-center gap-1.5">
                <FaInfoCircle /> Problem &amp; Solution Overview
              </span>
              <h2 className="display-6 fw-bold text-dark mb-3">Solving Critical Aquaculture Challenges</h2>
              <p className="lead text-secondary fs-6">
                Addressing high mortality rates from disease outbreaks and feed management inefficiencies in commercial shrimp farming.
              </p>
            </div>

            <div className="row g-4">
              {problemSolutions.map((item, idx) => (
                <div key={idx} className="col-md-6">
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="card h-100 border-0 shadow-sm rounded-4 p-4 bg-white hover-shadow"
                    style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', border: '1px solid #e2e8f0' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className="p-3 bg-light rounded-3 shadow-xs">{item.icon}</div>
                        <h5 className="fw-bold text-dark mb-0 fs-5">{item.title}</h5>
                      </div>
                      <span className="badge bg-primary text-white extra-small px-3 py-1.5 rounded-pill fw-bold">
                        {item.badge}
                      </span>
                    </div>

                    <div className="mb-3 p-3 bg-danger bg-opacity-10 rounded-3 border border-danger border-opacity-20">
                      <div className="fw-bold text-danger extra-small text-uppercase mb-1">
                        ⚠️ Challenge
                      </div>
                      <p className="text-dark small mb-0">{item.challenge}</p>
                    </div>

                    <div className="p-3 bg-success bg-opacity-10 rounded-3 border border-success border-opacity-20">
                      <div className="fw-bold text-success extra-small text-uppercase mb-1">
                        💡 ShrimPredict Solution
                      </div>
                      <p className="text-dark small mb-0">{item.solution}</p>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core System Features Section */}
        <section id="features" className="py-5 bg-light border-top border-bottom">
          <div className="container py-lg-4">
            <div className="text-center mx-auto mb-5" style={{ maxWidth: '700px' }}>
              <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-2">
                Core System Features
              </span>
              <h2 className="display-6 fw-bold text-dark mb-3">Comprehensive Aquaculture Intelligence</h2>
              <p className="lead text-secondary fs-6">
                Designed for field caretakers and commercial farm administrators to monitor health, feeding, and yields.
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {features.map((item, idx) => (
                <div key={idx} className="col-md-6 col-lg-4">
                  <motion.div
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="feature-card-ultra h-100 p-4 bg-white shadow-xs"
                  >
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="p-2.5 bg-light rounded-3">{item.icon}</div>
                      <span className="badge bg-light text-dark border extra-small fw-semibold">{item.badge}</span>
                    </div>
                    <h5 className="fw-bold text-dark mb-2 fs-6">{item.title}</h5>
                    <p className="text-muted extra-small mb-0">{item.description}</p>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How ShrimPredict Works Section */}
        <section id="how-it-works" className="py-5 bg-white border-top">
          <div className="container py-lg-4">
            <div className="text-center mx-auto mb-5" style={{ maxWidth: '700px' }}>
              <span className="badge bg-warning bg-opacity-10 text-warning-emphasis px-3 py-2 rounded-pill fw-bold text-uppercase mb-2 border border-warning border-opacity-25">
                4-Step Workflow
              </span>
              <h2 className="display-6 fw-bold text-dark mb-3">How ShrimPredict Works</h2>
              <p className="lead text-secondary fs-6">From pond-side photo capture to executive production analytics.</p>
            </div>

            <div className="row g-4 justify-content-center align-items-stretch">
              {steps.map((s, idx) => (
                <div key={idx} className="col-md-6 col-lg-3">
                  <motion.div
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.25 }}
                    className={`card h-100 border border-${s.accent} border-opacity-25 shadow-xs rounded-4 p-4 text-center bg-white position-relative overflow-hidden`}
                  >
                    {/* Top Accent Bar */}
                    <div className={`position-absolute top-0 start-0 end-0 bg-${s.accent}`} style={{ height: 4 }} />

                    <div className="card-body d-flex flex-column align-items-center p-2">
                      <div className="d-flex align-items-center justify-content-between w-100 mb-3">
                        <span className={`badge bg-${s.accent} bg-opacity-10 text-${s.accent} border border-${s.accent} border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-bold`}>
                          {s.badge}
                        </span>
                        <span className={`display-6 fw-extrabold text-${s.accent} opacity-25 font-mono`}>
                          {s.step}
                        </span>
                      </div>

                      <div className={`p-4 rounded-circle bg-${s.accent} bg-opacity-10 mb-3 d-flex align-items-center justify-content-center shadow-xs`} style={{ width: 68, height: 68 }}>
                        {s.icon}
                      </div>

                      <h5 className="fw-bold text-dark mb-2 fs-6">{s.title}</h5>
                      <p className="text-muted extra-small mb-0">{s.description}</p>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact & Partner Section */}
        <section id="contact" className="py-5 bg-light border-top">
          <div className="container py-lg-4">
            <div className="mx-auto" style={{ maxWidth: '900px' }}>
              <div className="text-center mb-4">
                <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-2">
                  <FaEnvelope /> Contact &amp; Partner Location
                </span>
                <h2 className="display-6 fw-bold text-dark mb-2">O&amp;B Aqua Farm &amp; System Support</h2>
                <p className="text-muted extra-small mb-0">
                  Official contact details for O&amp;B Aqua Farm commercial grow-out operations, wholesale seafood inquiries, and ShrimPredict AI platform support.
                </p>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-xs rounded-4 p-4 bg-white text-center">
                    <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                      <FaMapMarkerAlt />
                    </div>
                    <h6 className="fw-bold text-dark mb-1">Physical Address</h6>
                    <span className="text-muted extra-small d-block">
                      O&amp;B Aqua Farm, Sitio Carbonan Rd, Brgy. Balitoc, Calatagan, 4215 Batangas, Philippines
                    </span>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-xs rounded-4 p-4 bg-white text-center">
                    <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                      <FaPhoneAlt />
                    </div>
                    <h6 className="fw-bold text-dark mb-1">Management Line</h6>
                    <a href="tel:+639622316169" className="text-primary fw-bold text-decoration-none small">+63 962 231 6169</a>
                    <small className="text-muted extra-small d-block mt-1">Available for farm wholesale inquiries</small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card h-100 border-0 shadow-xs rounded-4 p-4 bg-white text-center">
                    <div className="bg-info bg-opacity-10 p-3 rounded-circle text-info fs-4 mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                      <FaEnvelope />
                    </div>
                    <h6 className="fw-bold text-dark mb-1">Support Email</h6>
                    <span className="text-muted small d-block">support@shrimp-predict.com</span>
                    <small className="text-muted extra-small d-block mt-1">AI platform technical support</small>
                  </div>
                </div>
              </div>

              {/* Commercial Partner Advisory */}
              <div className="p-4 bg-warning bg-opacity-10 border border-warning border-opacity-30 rounded-4 text-dark shadow-xs">
                <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-2 fs-6">
                  <FaInfoCircle className="text-warning fs-5" /> Commercial Visitor &amp; Wholesale Advisory
                </div>
                <p className="mb-0 text-muted extra-small">
                  O&amp;B Aqua Farm operates strictly as a commercial grow-out aquaculture facility. For wholesale fresh Pacific White Shrimp (<em>Penaeus vannamei</em>) purchases direct from the farm gate, please call management (+63 962 231 6169) prior to visiting to confirm harvest schedules.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-5 text-white" style={{ background: 'linear-gradient(135deg, #071733 0%, #0b2c5f 50%, #0e3d7d 100%)' }}>
          <div className="container text-center py-4">
            <h2 className="display-6 fw-bold mb-3 text-white">Ready to Protect Your Shrimp Ponds?</h2>
            <p className="lead text-white-90 mb-4 mx-auto style-copy" style={{ maxWidth: '600px', color: 'rgba(255,255,255,0.85)' }}>
              Empower caretakers with instant feed logging and computer vision AI to prevent disease outbreaks and maximize harvest yields.
            </p>
            <div className="d-flex justify-content-center gap-3">
              <button
                onClick={() => navigate('/login?type=caretaker')}
                className="btn btn-warning text-dark btn-lg fw-bold px-4 py-3 rounded-3 shadow"
              >
                Caretaker Portal
              </button>
              <button
                onClick={() => navigate('/login?type=admin')}
                className="btn btn-outline-light btn-lg text-white fw-bold px-4 py-3 rounded-3"
              >
                Admin Dashboard
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* AI Scanner Demo Modal */}
      <AnimatePresence>
        {showDemoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal fade show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="modal-content rounded-4 border-0 shadow-lg overflow-hidden"
              >
                <div className="modal-header bg-primary text-white p-4 border-0">
                  <div className="d-flex align-items-center gap-2">
                    <FaMicroscope className="fs-4 text-warning" />
                    <h5 className="modal-title fw-bold text-white mb-0">Live AI Image Processing Simulator</h5>
                  </div>
                  <button
                    onClick={() => setShowDemoModal(false)}
                    className="btn-close btn-close-white"
                  ></button>
                </div>

                <div className="modal-body p-4">
                  <p className="text-muted extra-small mb-4">
                    Test our image processing classifier model live. Select a sample shrimp image below to evaluate spot contrast ratio and WSD probability:
                  </p>

                  <div className="row g-3 mb-4">
                    <div className="col-6">
                      <button
                        onClick={() => runSampleDemo('healthy')}
                        className="btn btn-outline-success w-100 p-3 text-start rounded-3 d-flex align-items-center gap-3"
                      >
                        <FaCheckCircle className="fs-3 text-success" />
                        <div>
                          <div className="fw-bold text-dark">Test Healthy Shrimp</div>
                          <span className="tiny text-muted">Clean shell texture</span>
                        </div>
                      </button>
                    </div>

                    <div className="col-6">
                      <button
                        onClick={() => runSampleDemo('wssv')}
                        className="btn btn-outline-danger w-100 p-3 text-start rounded-3 d-flex align-items-center gap-3"
                      >
                        <FaExclamationTriangle className="fs-3 text-danger" />
                        <div>
                          <div className="fw-bold text-dark">Test WSD Infected</div>
                          <span className="tiny text-muted">Dense white spot lesions</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {demoState.analyzing && (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary mb-2" role="status"></div>
                      <div className="fw-semibold text-primary">Running HSV Spatial &amp; Feature Analysis...</div>
                    </div>
                  )}

                  {demoState.result && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-3 bg-${demoState.result.color}-soft border border-${demoState.result.color}`}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge bg-${demoState.result.color} text-white fs-6 px-3 py-2`}>
                            {demoState.result.disease}
                          </span>
                        </div>
                        <span className={`fw-bold text-${demoState.result.color}`}>
                          {demoState.result.risk}
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="d-flex justify-content-between text-dark small mb-1">
                          <span>Confidence Score</span>
                          <span className="fw-bold">{demoState.result.confidence}%</span>
                        </div>
                        <div className="progress" style={{ height: '10px' }}>
                          <div
                            className={`progress-bar bg-${demoState.result.color}`}
                            style={{ width: `${demoState.result.confidence}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="small text-dark">
                        <strong>AI Observation:</strong> {demoState.result.notes}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="modal-footer bg-light p-3 border-0">
                  <button
                    onClick={() => setShowDemoModal(false)}
                    className="btn btn-secondary px-4 rounded-3 text-white"
                  >
                    Close Demo
                  </button>
                  <button
                    onClick={() => {
                      setShowDemoModal(false);
                      navigate('/login');
                    }}
                    className="btn btn-primary px-4 rounded-3 fw-bold text-white"
                  >
                    Go to Portal Login <FaArrowRight />
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-dark text-white py-4 mt-auto border-top border-secondary border-opacity-25">
        <div className="container text-center">
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap mb-2">
            <div className="d-inline-flex align-items-center gap-2">
              <img src="/shrimp_predict_logo.png" alt="ShrimPredict Logo" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} className="logo-glow-orange" />
              <span className="fw-bold text-white fs-5">ShrimPredict</span>
            </div>
            <span className="text-white-50 d-none d-md-inline">|</span>
            <span className="text-white-75 extra-small">O&amp;B Aqua Farm, Sitio Carbonan Rd, Brgy. Balitoc, Calatagan, 4215 Batangas</span>
            <span className="text-white-50 d-none d-md-inline">|</span>
            <span className="text-white-75 extra-small">📞 +63 962 231 6169</span>
          </div>
          <p className="text-white-50 tiny mb-0">
            © 2026 ShrimPredict: Shrimp Feed Monitoring and Disease Detection System Utilizing Image Processing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
