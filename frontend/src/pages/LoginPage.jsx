import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import {
  FaArrowLeft,
  FaEnvelope,
  FaLock,
  FaUserShield,
  FaUserCog,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaWater,
  FaMicroscope,
  FaChartLine,
  FaRobot,
} from 'react-icons/fa';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('type') === 'caretaker' ? 'caretaker' : 'admin';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [email, setEmail] = useState(
    defaultTab === 'admin' ? 'admin@shrimpredict.com' : 'caretaker@shrimpredict.com'
  );
  const [password, setPassword] = useState('admin123');
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
      setEmail('caretaker@shrimpredict.com');
      setPassword('caretaker123');
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
        title: 'Welcome Back!',
        text: `Logged in successfully as ${result.user.role.toUpperCase()}.`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: error.message || 'Please check your email and password.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper min-vh-100 d-flex align-items-center justify-content-center py-5 px-3 bg-light">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card border-0 shadow-lg rounded-4 overflow-hidden max-w-1000 w-100"
        style={{ maxWidth: '1020px' }}
      >
        <div className="row g-0">
          {/* Hero Left Panel (Deep Navy Ocean Theme matching Landing Page) */}
          <div
            className="col-lg-6 p-4 p-md-5 d-flex flex-column justify-content-between text-white"
            style={{ background: 'linear-gradient(135deg, #0B2C5F 0%, #10356C 50%, #143F74 100%)' }}
          >
            <div>
              {/* Back to Home Button */}
              <Link
                to="/"
                className="btn btn-sm btn-outline-light rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 fw-semibold mb-4 text-white text-decoration-none"
              >
                <FaArrowLeft /> Back to Home
              </Link>

              {/* Brand Logo */}
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="bg-primary text-white rounded-3 px-2 py-1 fw-bold fs-5 border border-light">SP</span>
                <span className="fs-4 fw-bold text-white">ShrimPredict</span>
              </div>

              <span className="badge bg-warning text-dark px-3 py-2 rounded-pill fw-bold text-uppercase mb-3 d-inline-flex align-items-center gap-2">
                <FaRobot /> AI Aquaculture SaaS
              </span>

              <h2 className="display-6 fw-extrabold text-white mb-3">
                Smart Farm Control & Disease Intelligence
              </h2>

              <p className="text-white-80 leading-relaxed mb-4">
                Sign in to manage pond parameters, run caretaker WSSV disease scans, and view real-time aquaculture analytics.
              </p>

              {/* Feature Benchmarks */}
              <div className="d-flex flex-column gap-3 mb-4">
                <div className="d-flex align-items-start gap-3 p-2 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                  <div className="p-2 rounded-3 bg-white text-primary fs-5 mt-1"><FaMicroscope /></div>
                  <div>
                    <h6 className="fw-bold text-white mb-1">99.45% WSSV Accuracy</h6>
                    <span className="text-white-75 small">Trained on 1,802 real shrimp dataset images</span>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-3 p-2 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                  <div className="p-2 rounded-3 bg-white text-primary fs-5 mt-1"><FaWater /></div>
                  <div>
                    <h6 className="fw-bold text-white mb-1">Real-time Pond Health</h6>
                    <span className="text-white-75 small">Track pH, temp, and daily mortality logs</span>
                  </div>
                </div>

                <div className="d-flex align-items-start gap-3 p-2 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                  <div className="p-2 rounded-3 bg-white text-primary fs-5 mt-1"><FaChartLine /></div>
                  <div>
                    <h6 className="fw-bold text-white mb-1">Automated Alerting</h6>
                    <span className="text-white-75 small">Instant notifications for caretaker disease reports</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Credentials Note */}
            <div className="p-3 rounded-3 border border-white-20 text-white small mt-3" style={{ background: 'rgba(255, 255, 255, 0.12)' }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <FaCheckCircle className="text-warning" />
                <span className="fw-bold text-white">Quick Demo Login Credentials</span>
              </div>
              <div className="text-white-90 small">
                • <strong>Admin:</strong> admin@shrimpredict.com | pass: admin123<br />
                • <strong>Caretaker:</strong> caretaker@shrimpredict.com | pass: caretaker123
              </div>
            </div>
          </div>

          {/* Form Right Panel */}
          <div className="col-lg-6 p-4 p-md-5 bg-white d-flex flex-column justify-content-center">
            {/* Mobile Return to Home Link */}
            <div className="d-lg-none mb-3">
              <Link to="/" className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 d-inline-flex align-items-center gap-2 small">
                <FaArrowLeft /> Back to Home
              </Link>
            </div>

            {/* Role Tab Switcher */}
            <div className="d-flex p-1 bg-light rounded-3 border mb-4">
              <button
                type="button"
                className={`btn flex-fill rounded-3 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                  activeTab === 'admin' ? 'btn-primary shadow-sm text-white' : 'btn-link text-secondary text-decoration-none'
                }`}
                onClick={() => handleTabChange('admin')}
              >
                <FaUserShield /> Admin Access
              </button>
              <button
                type="button"
                className={`btn flex-fill rounded-3 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                  activeTab === 'caretaker' ? 'btn-primary shadow-sm text-white' : 'btn-link text-secondary text-decoration-none'
                }`}
                onClick={() => handleTabChange('caretaker')}
              >
                <FaUserCog /> Caretaker Access
              </button>
            </div>

            <div className="mb-4">
              <h3 className="fw-bold text-dark mb-1">
                {activeTab === 'admin' ? 'System Admin Sign In' : 'Pond Caretaker Sign In'}
              </h3>
              <p className="text-muted small">
                {activeTab === 'admin'
                  ? 'Access master pond controls, disease logs, and farm reports.'
                  : 'Submit camera disease scans and monitor assigned pond parameters.'}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-muted small fw-semibold">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0 rounded-start-3">
                    <FaEnvelope />
                  </span>
                  <input
                    type="email"
                    className="form-control border-start-0 rounded-end-3 py-2"
                    placeholder="name@shrimpredict.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-muted small fw-semibold">Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0 rounded-start-3">
                    <FaLock />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control border-start-0 border-end-0 py-2"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-group-text bg-light text-muted border-start-0 rounded-end-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-100 py-3 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mb-3"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    Authenticating...
                  </>
                ) : (
                  `Sign In as ${activeTab === 'admin' ? 'Admin' : 'Caretaker'}`
                )}
              </button>

              {/* Demo Auto-Fill Helper */}
              <div className="text-center">
                <span className="text-muted tiny">Want to test quickly?</span>{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange(activeTab)}
                  className="btn btn-link p-0 tiny fw-semibold text-primary text-decoration-none"
                >
                  Auto-fill demo credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
