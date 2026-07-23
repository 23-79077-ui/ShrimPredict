import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FaChartLine,
  FaCircle,
  FaCloud,
  FaDatabase,
  FaWater,
  FaShieldAlt,
  FaWaveSquare,
  FaSwimmer,
  FaBullseye,
} from 'react-icons/fa';

const heroCards = [
  { title: 'AI Disease Detection', icon: <FaBullseye /> },
  { title: 'Water Quality Monitoring', icon: <FaWater /> },
  { title: 'Smart Analytics', icon: <FaChartLine /> },
];

const stats = [
  { label: 'Total Ponds', value: '24', detail: '+12% this month', icon: <FaCircle /> },
  { label: 'Healthy Ponds', value: '18', detail: '+9% this month', icon: <FaShieldAlt /> },
  { label: 'Disease Alerts', value: '3', detail: '-25% last month', icon: <FaSwimmer /> },
  { label: 'Feed Consumption', value: '128 kg', detail: '+15% last month', icon: <FaWater /> },
  { label: 'Upcoming Harvest', value: '5', detail: 'Within 30 days', icon: <FaDatabase /> },
];

const features = [
  { title: 'AI Disease Detection', description: 'Detect white spot disease early using powerful image analytics.', icon: <FaBullseye /> },
  { title: 'Pond Monitoring', description: 'Track water quality and pond health in real time.', icon: <FaWater /> },
  { title: 'Smart Feeding', description: 'Optimize feed schedules using predictive insights.', icon: <FaChartLine /> },
  { title: 'Harvest Prediction', description: 'Predict the best harvest window for higher yields.', icon: <FaWaveSquare /> },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header py-4">
        <div className="container d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <Link to="/" className="brand">
            <span className="brand-icon">SP</span>
            ShrimPredict
          </Link>

          <nav className="landing-nav d-none d-lg-flex align-items-center gap-4 flex-wrap">
            <a href="#home" className="nav-link active">Home</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#contact" className="nav-link">Contact</a>
          </nav>

          <Link to="/login?type=admin" className="btn btn-primary btn-sm me-2">Admin Login</Link>
          <Link to="/login?type=caretaker" className="btn btn-outline-primary btn-sm">Caretaker Login</Link>
        </div>
      </header>

      <main>
        <section id="home" className="hero-section rounded-5 overflow-hidden mb-5">
          <div className="hero-overlay" />
          <div className="container hero-content py-5">
            <div className="row align-items-center gy-5">
              <div className="col-xl-5 col-lg-6 text-white">
                <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
                  <div className="eyebrow mb-3">Shrimp Farm Intelligence</div>
                  <h1 className="hero-title mb-4">Smart Shrimp Farm Management</h1>
                  <p className="hero-copy mb-4">Manage ponds, detect disease earlier, optimize feeding, and forecast harvest with a premium SaaS experience built for modern aquaculture teams.</p>
                  <div className="d-flex flex-wrap gap-3 mb-5">
                    <Link to="/login" className="btn btn-primary btn-lg">Get Started</Link>
                    <a href="#features" className="btn btn-outline-light btn-lg">Learn More</a>
                  </div>
                </motion.div>

                <div className="hero-feature-cards row gy-3">
                  {heroCards.map((card) => (
                    <div key={card.title} className="col-sm-6 col-xl-12">
                      <div className="hero-small-card p-4">
                        <div className="d-flex align-items-center gap-3 mb-3">
                          <div className="small-card-icon">{card.icon}</div>
                          <p className="mb-0 fw-semibold">{card.title}</p>
                        </div>
                        <p className="text-muted small mb-0">Designed for faster, smarter pond work.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-xl-7 col-lg-6">
                <motion.div className="hero-visual position-relative" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
                  <div className="hero-image" />
                  <div className="hero-glow" />

                  <div className="floating-widget widget-chart widget-line" style={{ top: '14%', right: '10%' }}>
                    <div className="widget-label">Production Score</div>
                    <div className="widget-value">92%</div>
                    <div className="widget-chart-line" />
                  </div>

                  <div className="floating-widget widget-chart widget-bar" style={{ bottom: '18%', left: '8%' }}>
                    <div className="widget-label">Feed Efficiency</div>
                    <div className="widget-value">78%</div>
                    <div className="widget-chart-bars" />
                  </div>

                  <div className="floating-widget widget-progress" style={{ top: '22%', left: '8%' }}>
                    <div className="widget-label">Water Health</div>
                    <div className="progress-ring">
                      <span>85%</span>
                    </div>
                  </div>

                  <div className="floating-widget widget-stats row g-2" style={{ bottom: '16%', right: '12%' }}>
                    <div className="col-6">
                      <div className="stat-pill">Ponds</div>
                    </div>
                    <div className="col-6">
                      <div className="stat-pill">Alerts</div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <section className="stats-section py-5">
          <div className="container">
            <div className="stats-grid row g-4">
              {stats.map((stat) => (
                <div key={stat.label} className="col-sm-6 col-lg-4 col-xl-2">
                  <div className="stat-card p-4 h-100">
                    <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                      <div>
                        <h3>{stat.value}</h3>
                        <p className="text-muted small mb-0">{stat.label}</p>
                      </div>
                      <div className="stat-icon-alt">{stat.icon}</div>
                    </div>
                    <p className="text-muted small mb-0">{stat.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="why-section py-5">
          <div className="container">
            <div className="text-center mb-5">
              <div className="eyebrow mb-2">Why Choose ShrimPredict</div>
              <h2 className="section-heading mb-3">A premium platform for shrimp farms and aquaculture teams</h2>
              <p className="section-copy mx-auto">From disease detection to harvest forecasting, ShrimPredict gives operators enterprise-grade clarity with a minimal, modern interface.</p>
            </div>

            <div className="feature-grid row g-4">
              {features.map((item) => (
                <div key={item.title} className="col-md-6 col-lg-3">
                  <div className="feature-card p-4 h-100">
                    <div className="feature-icon mb-3">{item.icon}</div>
                    <h5 className="mb-3">{item.title}</h5>
                    <p className="text-muted mb-0">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <div className="wave-divider"></div>
      <footer className="footer-dark py-5">
        <div className="container d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
          <div>
            <div className="brand text-white mb-2">ShrimPredict</div>
            <p className="text-white-60 mb-0">Premium shrimp farm management software for enterprises and capstone projects.</p>
          </div>
          <div className="d-flex align-items-center gap-4 flex-wrap text-white-60">
            <a href="#home" className="footer-link">Home</a>
            <a href="#features" className="footer-link">Features</a>
            <a href="#contact" className="footer-link">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
