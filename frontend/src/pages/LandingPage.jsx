import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
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
} from 'react-icons/fa';

const problemSolutions = [
  {
    title: 'The Problem',
    description: 'Shrimp farming heavily relies on manual monitoring, where subtle behavioral changes and deadly infections like White Spot Disease (WSD) go unnoticed until massive mortality (up to 80–100%) occurs. Meanwhile, existing smart aquaculture tools are too expensive and complex for small- to medium-scale farms.',
    icon: <FaExclamationTriangle className="text-warning fs-3" />,
    badge: 'Aquaculture Challenge',
    accent: 'warning',
  },
  {
    title: 'The Solution',
    description: 'ShrimPredict provides an affordable, AI-powered web and mobile platform that uses standard smartphone cameras to track feed consumption and detect early signs of WSD via OpenCV and CNN. It delivers instant disease alerts and harvest predictions, empowering farmers to act fast and minimize crop loss.',
    icon: <FaCheckCircle className="text-primary fs-3" />,
    badge: 'ShrimPredict AI Platform',
    accent: 'primary',
  },
];

const features = [
  {
    title: 'CNN-Based White Spot Disease (WSD) Detection',
    description: 'Employs deep learning models to inspect shrimp images for visual markers such as shell spots and discoloration, enabling early isolation before widespread contagion.',
    icon: <FaMicroscope className="text-primary fs-3" />,
    badge: 'Computer Vision AI',
    accent: 'primary',
  },
  {
    title: 'Automated Feed Consumption & Behavior Tracking',
    description: 'Analyzes feeding metrics and frequency to identify early declines in appetite, providing vital insights into shrimp health and pond balance.',
    icon: <FaUtensils className="text-warning fs-3" />,
    badge: 'Feed Intelligence',
    accent: 'warning',
  },
  {
    title: 'Harvest Readiness Prediction',
    description: 'Computes estimated harvest readiness windows by processing cumulative feeding patterns, culture days, and historical farm logs.',
    icon: <FaChartLine className="text-primary fs-3" />,
    badge: 'Yield Forecasting',
    accent: 'primary',
  },
  {
    title: 'Farm Health Dashboard & Analytics',
    description: 'Provides farm administrators with a centralized web dashboard featuring real-time overview charts, automated detection histories, and exportable PDF reports.',
    icon: <FaClipboardList className="text-warning fs-3" />,
    badge: 'Central Analytics',
    accent: 'warning',
  },
  {
    title: 'Digital Water Quality & Operation Logs',
    description: 'Offers mobile-friendly data entry for reference parameters—including dissolved oxygen (DO), temperature, pH, salinity, vitamins, and maintenance tasks.',
    icon: <FaVial className="text-primary fs-3" />,
    badge: 'Digital Logbook',
    accent: 'primary',
  },
  {
    title: 'Instant Automated Disease Alerts',
    description: 'Dispatches immediate notifications across web and mobile interfaces upon detecting abnormal indicators, prompting rapid on-site biosecurity measures.',
    icon: <FaBell className="text-warning fs-3" />,
    badge: 'Real-Time Alerts',
    accent: 'warning',
  },
];

const steps = [
  {
    step: '01',
    badge: 'STEP ONE',
    title: 'Capture & Upload',
    description: 'Pond caretakers use an Android mobile device to photograph shrimp from feeding trays or ponds and input routine feeding quantities.',
    icon: <FaCamera className="fs-4 text-primary" />,
    accent: 'primary',
  },
  {
    step: '02',
    badge: 'STEP TWO',
    title: 'Cloud Preprocessing & Feature Extraction',
    description: 'Images are preprocessed via OpenCV to filter noise, enhance image contrast, and isolate morphological features.',
    icon: <FaMicroscope className="fs-4 text-warning" />,
    accent: 'warning',
  },
  {
    step: '03',
    badge: 'STEP THREE',
    title: 'CNN Image Analysis',
    description: 'The trained Convolutional Neural Network inspects the preprocessed imagery to classify health status and identify visual indicators of White Spot Disease.',
    icon: <FaRobot className="fs-4 text-primary" />,
    accent: 'primary',
  },
  {
    step: '04',
    badge: 'STEP FOUR',
    title: 'Data Analytics & Yield Modeling',
    description: 'The platform cross-references recent feeding behavior and historical culture metrics to update growth tracking and harvest timing models.',
    icon: <FaChartLine className="fs-4 text-warning" />,
    accent: 'warning',
  },
  {
    step: '05',
    badge: 'STEP FIVE',
    title: 'Real-Time Notification & Reporting',
    description: 'Processed findings, risk alerts, and performance summaries are instantly published to both the caretaker\'s mobile view and the farm owner\'s web dashboard for swift operational decisions.',
    icon: <FaBell className="fs-4 text-primary" />,
    accent: 'primary',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const isManualScroll = useRef(false);

  // Track active section on scroll
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
    <div className="landing-page-wrapper bg-light min-vh-100 d-flex flex-column">
      {/* Header Navigation */}
      <header className="landing-header sticky-top">
        <div className="container d-flex align-items-center justify-content-between py-2.5">
          <Link to="/" className="brand d-flex align-items-center gap-2.5 text-decoration-none">
            <img
              src="/shrimp_predict_logo.png"
              alt="ShrimpPredict Official Logo"
              style={{
                height: '42px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <div className="d-flex flex-column justify-content-center">
              <span className="fw-extrabold tracking-tight d-block" style={{ fontSize: '1.28rem', letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0F172A' }}>
                Shrimp<span style={{ color: '#FF7B38' }}>Predict</span>
              </span>
              <span className="d-block" style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, marginTop: '2px', color: '#64748B' }}>
                O &amp; B AQUAFARM
              </span>
            </div>
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
              {/* Left Column: Title & Hero Copy */}
              <div className="col-lg-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
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

                  <div className="d-flex flex-wrap gap-3 mb-2">
                    <button
                      onClick={() => navigate('/login')}
                      className="btn btn-warning btn-lg text-dark fw-extrabold d-flex align-items-center gap-2 px-4 py-3 shadow rounded-3"
                    >
                      Get Started Now <FaArrowRight />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Hero Visual Showcase with Animated Slowmo Heartbeat Logo */}
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

                  {/* Large Centered Glowing Logo with Slowmo Pulse (Zoom In / Zoom Out Heartbeat) */}
                  <div className="position-relative z-1 my-3 text-center">
                    <motion.img
                      src="/shrimp_predict_logo.png"
                      alt="ShrimPredict Official Logo"
                      animate={{
                        scale: [1, 1.07, 1],
                      }}
                      transition={{
                        duration: 3.8,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
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



        {/* Problem & Solution Overview Section */}
        <section id="problem-solution" className="py-5 bg-white border-bottom">
          <div className="container py-lg-4">
            <div className="text-center mx-auto mb-4" style={{ maxWidth: '720px' }}>
              <h2 className="display-6 fw-extrabold text-dark mb-2">Problem &amp; Solution</h2>
              <p className="lead text-secondary small mb-0" style={{ fontSize: '0.95rem' }}>
                Transforming manual aquaculture risks into intelligent, data-driven farm protection.
              </p>
            </div>

            <div className="row g-4 justify-content-center">
              {problemSolutions.map((item, idx) => (
                <div key={idx} className="col-md-6">
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25 }}
                    className={`card h-100 border border-${item.accent} border-opacity-25 shadow-sm rounded-4 p-4 bg-white position-relative overflow-hidden transition-all`}
                  >
                    {/* Top Accent Line */}
                    <div className={`position-absolute top-0 start-0 end-0 bg-${item.accent}`} style={{ height: 4 }} />

                    <div className="d-flex align-items-center justify-content-between mb-3.5 border-bottom pb-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className={`p-3 bg-${item.accent} bg-opacity-10 rounded-3 shadow-xs d-inline-flex align-items-center justify-content-center`}>
                          {item.icon}
                        </div>
                        <h4 className="fw-bold text-dark mb-0 fs-5">{item.title}</h4>
                      </div>
                      <span className={`badge bg-${item.accent} bg-opacity-10 text-${item.accent} border border-${item.accent} border-opacity-25 extra-small px-3 py-1.5 rounded-pill fw-bold`}>
                        {item.badge}
                      </span>
                    </div>

                    <p className="text-secondary small mb-0 lh-relaxed" style={{ fontSize: '0.92rem', lineHeight: '1.7' }}>
                      {item.description}
                    </p>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* System Core Features Section */}
        <section id="features" className="py-4 py-lg-4.5 bg-white">
          <div className="container py-lg-2">
            <div className="text-center mx-auto mb-3.5" style={{ maxWidth: '750px' }}>
              <h2 className="display-6 fw-extrabold text-dark mb-1.5">System Core Features</h2>
              <p className="lead text-secondary small mb-0" style={{ fontSize: '0.92rem' }}>
                An integrated aquaculture intelligence platform uniting deep-learning disease detection, digital feeding logs, and predictive harvest analytics.
              </p>
            </div>

            <div className="row g-3 justify-content-center">
              {features.map((item, idx) => (
                <div key={idx} className="col-md-6 col-lg-4">
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.2 }}
                    className={`card h-100 border border-${item.accent} border-opacity-30 shadow-xs rounded-3 p-3 bg-white position-relative overflow-hidden transition-all`}
                  >
                    {/* Top Glowing Accent Line */}
                    <div className={`position-absolute top-0 start-0 end-0 bg-${item.accent}`} style={{ height: 3 }} />

                    <div className="card-body d-flex flex-column p-0 justify-content-between">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-2.5">
                          <div
                            className={`p-2 bg-${item.accent} bg-opacity-10 rounded-2 d-inline-flex align-items-center justify-content-center shadow-xs`}
                          >
                            {item.icon}
                          </div>
                          <span
                            className={`badge bg-${item.accent} bg-opacity-10 text-${item.accent === 'warning' ? 'dark' : item.accent} border border-${item.accent} border-opacity-25 tiny fw-bold px-2 py-1 rounded-pill`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <h6 className="fw-bold text-dark mb-1.5 fs-6 lh-sm">{item.title}</h6>
                        <p className="text-secondary tiny mb-0 lh-relaxed" style={{ fontSize: '0.83rem' }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How ShrimPredict Works Section */}
        <section id="how-it-works" className="py-5 bg-white border-top">
          <div className="container-fluid px-lg-4 py-lg-4">
            <div className="text-center mx-auto mb-4" style={{ maxWidth: '750px' }}>
              <h2 className="display-6 fw-extrabold text-dark mb-2">How ShrimPredict Works</h2>
              <p className="lead text-secondary small mb-0" style={{ fontSize: '0.95rem' }}>
                From pond-side photo capture to AI classification, predictive yield modeling, and real-time dashboard alerts.
              </p>
            </div>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-2.5 justify-content-center align-items-stretch">
              {steps.map((s, idx) => (
                <div key={idx} className="col">
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.2 }}
                    className={`card h-100 border border-${s.accent} border-opacity-25 shadow-xs rounded-3 p-3 bg-white position-relative overflow-hidden transition-all`}
                  >
                    {/* Top Glowing Accent Line */}
                    <div className={`position-absolute top-0 start-0 end-0 bg-${s.accent}`} style={{ height: 3 }} />

                    <div className="card-body d-flex flex-column p-0">
                      <div className="d-flex align-items-center justify-content-between w-100 mb-2.5">
                        <span className={`badge bg-${s.accent} bg-opacity-10 text-${s.accent === 'warning' ? 'dark' : s.accent} border border-${s.accent} border-opacity-25 px-2 py-1 rounded-pill tiny fw-bold`}>
                          {s.badge}
                        </span>
                        <span className={`fs-5 fw-extrabold text-${s.accent} opacity-35 font-mono lh-1`}>
                          {s.step}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-2 mb-2">
                        <div className={`p-2 rounded-2 bg-${s.accent} bg-opacity-10 d-inline-flex align-items-center justify-content-center shadow-xs`}>
                          {s.icon}
                        </div>
                        <h6 className="fw-bold text-dark mb-0 extra-small lh-sm">{s.title}</h6>
                      </div>

                      <p className="text-secondary tiny mb-0 lh-relaxed" style={{ fontSize: '0.81rem' }}>
                        {s.description}
                      </p>
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

      {/* Footer */}
      <footer className="bg-dark text-white py-4 mt-auto border-top border-secondary border-opacity-25">
        <div className="container text-center">
          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap mb-2">
            <div className="d-inline-flex align-items-center gap-2.5">
              <img src="/shrimp_predict_logo.png" alt="ShrimpPredict Official Logo" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} className="logo-glow-orange" />
              <div className="text-start">
                <span className="fw-extrabold tracking-tight d-block text-white" style={{ fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  Shrimp<span style={{ color: '#FF7B38' }}>Predict</span>
                </span>
                <span className="d-block text-white-50" style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, marginTop: '2px' }}>
                  O &amp; B AQUAFARM
                </span>
              </div>
            </div>
            <span className="text-white-50 d-none d-md-inline">|</span>
            <span className="text-white-75 extra-small">O&amp;B Aqua Farm, Sitio Carbonan Rd, Brgy. Balitoc, Calatagan, 4215 Batangas</span>
            <span className="text-white-50 d-none d-md-inline">|</span>
            <span className="text-white-75 extra-small">+63 962 231 6169</span>
          </div>
          <p className="text-white-50 tiny mb-0">
            © 2026 ShrimPredict: Shrimp Feed Monitoring and Disease Detection System Utilizing Image Processing. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
