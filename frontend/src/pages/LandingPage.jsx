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
} from 'react-icons/fa';

const stats = [
  { label: 'Dataset Trained', value: '1,802', detail: 'Real shrimp photos', icon: <FaMicroscope /> },
  { label: 'AI Accuracy', value: '99.45%', detail: 'Zero false positive rate', icon: <FaShieldAlt /> },
  { label: 'Active Ponds', value: '24', detail: 'Real-time monitoring', icon: <FaWater /> },
  { label: 'Disease Response', value: '< 2 sec', detail: 'Instant diagnosis', icon: <FaBullseye /> },
];

const features = [
  {
    title: 'AI WSSV Disease Scan',
    description: 'Instant image analysis powered by deep feature extraction to catch White Spot Syndrome Virus early.',
    icon: <FaMicroscope className="text-primary fs-3" />,
    badge: 'AI Powered',
  },
  {
    title: 'Pond Water Health',
    description: 'Continuous water quality tracking to prevent environmental stress and maintain ideal pH and temp.',
    icon: <FaWater className="text-info fs-3" />,
    badge: 'Real-time',
  },
  {
    title: 'Smart Analytics & Logs',
    description: 'Track daily caretaker scans, mortality events, and feeding schedules with intuitive visual charts.',
    icon: <FaChartLine className="text-success fs-3" />,
    badge: 'Analytics',
  },
  {
    title: 'Harvest Prediction',
    description: 'Data-driven insights to determine the best harvest window for maximum biomass yield and revenue.',
    icon: <FaShieldAlt className="text-warning fs-3" />,
    badge: 'Yield Boost',
  },
];

const steps = [
  {
    step: '01',
    title: 'Snap or Upload Photo',
    description: 'Caretakers capture shrimp photos directly from pond side using camera or gallery upload.',
    icon: <FaCamera />,
  },
  {
    step: '02',
    title: 'AI Multi-Feature Scan',
    description: 'Our trained model inspects spot contrast, shell texture, and color HSV channels in under 2 seconds.',
    icon: <FaRobot />,
  },
  {
    step: '03',
    title: 'Actionable Insights',
    description: 'Receive immediate risk ratings, isolation steps, and automatic admin pond notifications.',
    icon: <FaCheckCircle />,
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

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(null);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactSuccess(null);

    try {
      const res = await fetch('http://localhost/shrim_predict_api/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setContactSuccess(data.message || 'Thank you! Your message has been saved in the database.');
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        alert(data.message || 'Error submitting message.');
      }
    } catch (err) {
      console.error('Contact submit error:', err);
      alert('Network error. Please ensure XAMPP MySQL and Apache are running.');
    } finally {
      setContactSubmitting(false);
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'about', 'features', 'how-it-works', 'contact'];
      const scrollPosition = window.scrollY + 120;

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
            notes: 'No WSSV lesions or abnormal spots detected. Shell texture clean and clear.',
          },
        });
      } else {
        setDemoState({
          image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=60',
          analyzing: false,
          result: {
            disease: 'White Spot Syndrome Virus (WSSV)',
            confidence: 82.0,
            risk: 'High Risk',
            color: 'danger',
            notes: 'Dense punctate white lesions detected on carapace. Immediate pond isolation advised.',
          },
        });
      }
    }, 1000);
  };

  return (
    <div className="landing-page-wrapper bg-light min-vh-100 d-flex flex-column">
      {/* Header Navigation */}
      <header className="landing-header sticky-top bg-white border-bottom shadow-sm py-3">
        <div className="container d-flex align-items-center justify-content-between gap-3">
          <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none text-dark fw-bold fs-4">
            <span className="brand-icon bg-primary text-white rounded-3 px-2 py-1 fs-5">SP</span>
            <span className="fw-extrabold text-dark">ShrimPredict</span>
          </Link>

          <nav className="landing-nav d-none d-lg-flex align-items-center gap-1 bg-light p-1 rounded-pill border">
            <button
              onClick={() => scrollToSection('home')}
              className={`nav-pill-btn ${activeNav === 'home' ? 'active' : ''}`}
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className={`nav-pill-btn ${activeNav === 'about' ? 'active' : ''}`}
            >
              About
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

          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => navigate('/login?type=admin')}
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3"
            >
              <FaUserShield /> Admin Login
            </button>
            <button
              onClick={() => navigate('/login?type=caretaker')}
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3 shadow-sm text-white"
            >
              <FaUserCog /> Caretaker Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow-1">
        {/* Home / Hero Section */}
        <section id="home" className="hero-section py-5 position-relative overflow-hidden">
          <div className="container py-lg-4">
            <div className="row align-items-center gy-5">
              <div className="col-lg-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <span className="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold text-uppercase mb-3 d-inline-flex align-items-center gap-2 shadow-sm">
                    <FaRobot /> AI-Powered Aquaculture Intelligence
                  </span>
                  
                  <h1 className="hero-title display-5 fw-extrabold text-white mb-3">
                    Smart Shrimp Farm Management & <span className="text-warning">WSSV Disease AI</span>
                  </h1>
                  
                  <p className="hero-copy lead text-white-80 mb-4 fw-normal">
                    Protect your shrimp ponds from White Spot Syndrome Virus (WSSV). Caretakers upload photos for instant multi-feature AI diagnosis, live water monitoring, and automated admin alerts.
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
                    >
                      <FaPlay className="text-warning" /> Try AI Scanner Demo
                    </button>
                  </div>
                  
                  <div className="d-flex flex-wrap align-items-center gap-4 text-white small fw-medium">
                    <div className="d-flex align-items-center gap-2">
                      <FaCheckCircle className="text-success fs-6" /> <span className="fw-semibold">1,802 Dataset Trained</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <FaCheckCircle className="text-info fs-6" /> <span className="fw-semibold">99.45% Accuracy</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <FaCheckCircle className="text-warning fs-6" /> <span className="fw-semibold">Zero False Positive</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="col-lg-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="position-relative"
                >
                  <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white p-3">
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center gap-3">
                          <div className="bg-primary text-white rounded-3 p-3 fs-4">
                            <FaMicroscope />
                          </div>
                          <div>
                            <h5 className="fw-bold text-dark mb-0">Caretaker Live Scan</h5>
                            <span className="text-secondary small">Pond A-1 • White Spot Disease Scan</span>
                          </div>
                        </div>
                        <span className="badge bg-success text-white px-3 py-2 rounded-pill fw-bold">
                          Active Monitor
                        </span>
                      </div>

                      {/* Mock AI Card Preview */}
                      <div className="p-3 bg-light rounded-3 mb-3 border">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-bold text-dark">AI Scan Diagnosis</span>
                          <span className="badge bg-success text-white">Healthy (Low Risk)</span>
                        </div>
                        <div className="progress mb-2" style={{ height: '10px' }}>
                          <div className="progress-bar bg-success" style={{ width: '85%' }}></div>
                        </div>
                        <div className="d-flex justify-content-between text-dark small fw-semibold">
                          <span>Healthy Confidence: 85.0%</span>
                          <span>WSSV Risk: Low</span>
                        </div>
                      </div>

                      <div className="row g-2 text-center">
                        <div className="col-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small fw-semibold">Water Temp</div>
                            <div className="fw-bold fs-5 text-dark">28.5 °C</div>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small fw-semibold">pH Level</div>
                            <div className="fw-bold fs-5 text-primary">7.8 pH</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="bg-white py-4 border-top border-bottom">
          <div className="container">
            <div className="row g-4 text-center">
              {stats.map((stat, idx) => (
                <div key={idx} className="col-6 col-md-3">
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 rounded-3 hover-shadow"
                  >
                    <div className="fs-3 text-primary mb-1">{stat.icon}</div>
                    <div className="display-6 fw-bold text-dark">{stat.value}</div>
                    <div className="fw-bold text-dark small">{stat.label}</div>
                    <div className="text-secondary tiny fw-medium">{stat.detail}</div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-5 bg-white">
          <div className="container py-lg-4">
            <div className="row align-items-center gy-4">
              <div className="col-lg-6">
                <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-3">
                  <FaInfoCircle /> About ShrimPredict
                </span>
                <h2 className="display-6 fw-bold text-dark mb-3">
                  Pioneering Early Disease Prevention in Aquaculture
                </h2>
                <p className="lead text-secondary mb-4">
                  White Spot Syndrome Virus (WSSV) is the single largest cause of mass mortality in shrimp farming worldwide. ShrimPredict combines computer vision, multi-feature spot extraction, and cloud farm tracking to protect harvests before outbreaks occur.
                </p>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3 border">
                      <h6 className="fw-bold text-dark mb-1">Caretaker Mobile Scanner</h6>
                      <p className="text-secondary small mb-0">Easy camera capture designed for field technicians and pond caretakers.</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3 border">
                      <h6 className="fw-bold text-dark mb-1">Admin Central Control</h6>
                      <p className="text-secondary small mb-0">Real-time pond status reports, mortality logs, and automated notifications.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card border-0 shadow-md rounded-4 p-4 bg-light">
                  <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                    <FaShieldAlt className="text-primary" /> Key Performance Benchmarks
                  </h5>
                  <ul className="list-group list-group-flush bg-transparent">
                    <li className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                      <span className="text-dark fw-medium">Dataset Size</span>
                      <strong className="text-primary">1,802 Images (776 Healthy / 1,026 WSSV)</strong>
                    </li>
                    <li className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                      <span className="text-dark fw-medium">Test Set Accuracy</span>
                      <strong className="text-success">99.45%</strong>
                    </li>
                    <li className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                      <span className="text-dark fw-medium">Precision (WSSV Detection)</span>
                      <strong className="text-success">100.00%</strong>
                    </li>
                    <li className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                      <span className="text-dark fw-medium">Recall Rate</span>
                      <strong className="text-primary">99.03%</strong>
                    </li>
                    <li className="list-group-item bg-transparent d-flex justify-content-between align-items-center">
                      <span className="text-dark fw-medium">Inference Speed</span>
                      <strong className="text-warning">&lt; 1.5 seconds per scan</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-5 bg-light border-top">
          <div className="container py-lg-4">
            <div className="text-center max-w-700 mx-auto mb-5">
              <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-2">
                Platform Capabilities
              </span>
              <h2 className="display-6 fw-bold text-dark mb-3">Designed for Aquaculture Success</h2>
              <p className="lead text-secondary">
                From mobile caretaker disease scans to administrative analytics, ShrimPredict covers every aspect of modern shrimp farming.
              </p>
            </div>

            <div className="row g-4">
              {features.map((item, idx) => (
                <div key={idx} className="col-md-6 col-lg-3">
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="card h-100 border-0 shadow-sm rounded-4 p-3 bg-white"
                  >
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>{item.icon}</div>
                        <span className="badge bg-light text-dark border small fw-semibold">{item.badge}</span>
                      </div>
                      <h5 className="fw-bold text-dark mb-2">{item.title}</h5>
                      <p className="text-secondary small mb-0">{item.description}</p>
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-5 bg-white border-top">
          <div className="container py-lg-4">
            <div className="text-center max-w-700 mx-auto mb-5">
              <span className="badge bg-warning-soft text-warning px-3 py-2 rounded-pill fw-bold text-uppercase mb-2">
                Simple Workflow
              </span>
              <h2 className="display-6 fw-bold text-dark mb-3">How Caretakers Use ShrimPredict</h2>
              <p className="lead text-secondary">Three simple steps to protect your ponds from disease outbreaks.</p>
            </div>

            <div className="row g-4 justify-content-center">
              {steps.map((s, idx) => (
                <div key={idx} className="col-md-4">
                  <div className="card border-0 shadow-sm rounded-4 p-4 text-center h-100 bg-light">
                    <div className="display-4 fw-extrabold text-primary opacity-25 mb-2">{s.step}</div>
                    <div className="fs-2 text-primary mb-3">{s.icon}</div>
                    <h5 className="fw-bold text-dark mb-2">{s.title}</h5>
                    <p className="text-secondary small mb-0">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-5 bg-light border-top">
          <div className="container py-lg-4">
            <div className="row gy-4">
              <div className="col-lg-5">
                <span className="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fw-bold text-uppercase mb-3">
                  <FaEnvelope /> Get In Touch
                </span>
                <h2 className="display-6 fw-bold text-dark mb-3">Contact ShrimPredict Support</h2>
                <p className="text-secondary mb-4">
                  Have questions about integrating ShrimPredict into your commercial shrimp farm or capstone project? Send us a message!
                </p>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-white p-3 rounded-3 border text-primary fs-5"><FaMapMarkerAlt /></div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Location</h6>
                      <span className="text-secondary small">Aquaculture Tech Center, Philippines</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-white p-3 rounded-3 border text-primary fs-5"><FaEnvelope /></div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Email</h6>
                      <span className="text-secondary small">support@shrimp-predict.com</span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="bg-white p-3 rounded-3 border text-primary fs-5"><FaPhoneAlt /></div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">Phone</h6>
                      <span className="text-secondary small">+63 (02) 8888-5555</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-7">
                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                  <h5 className="fw-bold text-dark mb-3">Send Us a Direct Message</h5>

                  {contactSuccess && (
                    <div className="alert alert-success d-flex align-items-center gap-2 rounded-3 mb-3">
                      <FaCheckCircle className="fs-5" />
                      <span>{contactSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleContactSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label text-dark small fw-bold">Your Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Juan Dela Cruz"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-dark small fw-bold">Email Address</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="juan@farm.com"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label text-dark small fw-bold">Subject</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Pond Setup / Inquiry"
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label text-dark small fw-bold">Message</label>
                        <textarea
                          className="form-control"
                          rows="4"
                          placeholder="How can we help your farm?"
                          value={contactForm.message}
                          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                          required
                        ></textarea>
                      </div>
                      <div className="col-12">
                        <button
                          type="submit"
                          disabled={contactSubmitting}
                          className="btn btn-primary px-4 py-2 rounded-3 fw-bold d-flex align-items-center gap-2 text-white shadow-sm"
                        >
                          {contactSubmitting ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Saving to Database...
                            </>
                          ) : (
                            'Send Message'
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-5 text-white" style={{ background: 'linear-gradient(135deg, #0B2C5F 0%, #10356C 50%, #143F74 100%)' }}>
          <div className="container text-center py-4">
            <h2 className="display-5 fw-bold mb-3 text-white">Ready to Protect Your Shrimp Farm?</h2>
            <p className="lead text-white-90 mb-4 max-w-600 mx-auto">
              Join operators and caretakers utilizing AI intelligence to prevent disease losses and boost harvest yields.
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
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
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
                    <h5 className="modal-title fw-bold text-white mb-0">Live AI Disease Scan Simulator</h5>
                  </div>
                  <button
                    onClick={() => setShowDemoModal(false)}
                    className="btn-close btn-close-white"
                  ></button>
                </div>

                <div className="modal-body p-4">
                  <p className="text-secondary small mb-4">
                    Test our AI classifier model live. Select a sample shrimp image below to evaluate spot contrast and WSSV probability:
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
                          <span className="tiny text-secondary">Clean shell texture</span>
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
                          <div className="fw-bold text-dark">Test WSSV Infected</div>
                          <span className="tiny text-secondary">Dense white spots</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {demoState.analyzing && (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary mb-2" role="status"></div>
                      <div className="fw-semibold text-primary">Running AI Gaussian & HSV Analysis...</div>
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
                    Go to Login Portal <FaArrowRight />
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-dark text-white py-4 mt-auto">
        <div className="container text-center">
          <div className="d-inline-flex align-items-center justify-content-center gap-2 flex-wrap">
            <span className="brand-icon bg-primary text-white rounded-2 px-2 py-1 fs-6 border border-light">SP</span>
            <span className="fw-bold text-white fs-5 ms-1">ShrimPredict</span>
            <span className="text-white-75 small ms-2">© 2026 Aquaculture Intelligence. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
