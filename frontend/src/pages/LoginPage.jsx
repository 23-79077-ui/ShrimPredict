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
  FaRobot,
  FaCheck,
  FaLaptop,
  FaMobileAlt,
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
        className="card border-0 shadow-lg rounded-4 overflow-hidden w-100"
        style={{ maxWidth: '1100px' }}
      >
        <div className="row g-0">
          {/* Left Panel: Deep Ocean & Shrimp Coral Aesthetic */}
          <div
            className="col-lg-6 p-4 p-md-5 d-flex flex-column justify-content-between text-white position-relative overflow-hidden"
            style={{
              background: 'radial-gradient(circle at 85% 15%, rgba(255, 107, 53, 0.22) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(6, 182, 212, 0.18) 0%, transparent 45%), linear-gradient(135deg, #071733 0%, #0b2c5f 55%, #0e3d7d 100%)',
            }}
          >
            <div className="position-relative z-1">
              {/* Back to Home Button */}
              <Link
                to="/"
                className="btn btn-sm rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 fw-semibold mb-4 text-white text-decoration-none border-white-30"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}
              >
                <FaArrowLeft /> Back to Home
              </Link>

              <div className="text-center mb-3">
                {/* Centered Large Intense Glowing Logo */}
                <div className="mb-2 d-flex justify-content-center">
                  <img
                    src="/shrimp_predict_logo.png"
                    alt="ShrimPredict Official Logo"
                    style={{
                      height: '170px',
                      width: 'auto',
                      objectFit: 'contain',
                    }}
                    className="logo-glow-intense"
                  />
                </div>
              </div>

              {/* THESIS TITLE */}
              <h2 className="display-6 fw-extrabold text-white mb-4 lh-sm fs-4 text-center">
                <span className="text-gradient-shrimp">ShrimPredict:</span> Shrimp Feed Monitoring and Disease Detection System{' '}
                <span className="d-block fs-6 fw-bold text-gradient-cyan mt-1">
                  Utilizing Image Processing
                </span>
              </h2>

              {/* ROLE-BASED CAPABILITIES */}
              <div className="mb-2">
                <div className="extra-small fw-bold text-uppercase tracking-wider text-shrimp-orange mb-3 d-flex align-items-center gap-2">
                  <span className="p-1 rounded-circle bg-shrimp-soft"></span> Role-Based System Capabilities
                </div>

                {/* For Farm Owners */}
                <div className="p-3 rounded-3 border border-white-10 mb-3" style={{ background: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(12px)' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-2 bg-primary bg-opacity-20 text-info fs-6">
                      <FaLaptop />
                    </div>
                    <h6 className="fw-bold text-white mb-0 extra-small">For Farm Owners (Web Portal)</h6>
                  </div>
                  <ul className="list-unstyled mb-0 tiny text-white-80">
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="text-shrimp-orange mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Centralized dashboard covering both nursery and grow-out ponds.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="text-shrimp-orange mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Predictive analytics for harvest planning and feeding deviation calculations.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="text-shrimp-orange mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Caretaker credential management and farm-wide biosecurity control.</span>
                    </li>
                  </ul>
                </div>

                {/* For Pond Caretakers */}
                <div className="p-3 rounded-3 border border-white-10" style={{ background: 'rgba(255, 255, 255, 0.06)', backdropFilter: 'blur(12px)' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-2 bg-warning bg-opacity-20 text-warning fs-6">
                      <FaMobileAlt />
                    </div>
                    <h6 className="fw-bold text-white mb-0 extra-small">For Pond Caretakers (Mobile View)</h6>
                  </div>
                  <ul className="list-unstyled mb-0 tiny text-white-80">
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="text-success mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Sunlight-readable, step-by-step camera diagnostic scanner.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1">
                      <FaCheck className="text-success mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Quick-entry forms for daily feed logs and water quality documentation.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="text-success mt-1 flex-shrink-0" style={{ fontSize: '10px' }} />
                      <span>Immediate task updates, scheduled feeding reminders, and alerts.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Sign In Form */}
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
                className={`btn flex-fill rounded-3 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                  activeTab === 'admin' ? 'btn-primary shadow-sm text-white' : 'btn-link text-secondary text-decoration-none'
                }`}
                onClick={() => handleTabChange('admin')}
              >
                <FaUserShield /> Admin Access
              </button>
              <button
                type="button"
                className={`btn flex-fill rounded-3 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                  activeTab === 'caretaker' ? 'btn-primary shadow-sm text-white' : 'btn-link text-secondary text-decoration-none'
                }`}
                onClick={() => handleTabChange('caretaker')}
              >
                <FaUserCog /> Caretaker Access
              </button>
            </div>

            <div className="mb-4 text-center">
              <h3 className="fw-bold text-dark mb-1 fs-4">
                {activeTab === 'admin' ? 'Farm Owner & Admin Portal' : 'Pond Caretaker Mobile Portal'}
              </h3>
              <p className="text-muted small mb-0">
                {activeTab === 'admin'
                  ? 'Sign in to access pond management dashboards, harvest forecasts, and biosecurity settings.'
                  : 'Sign in to record daily feeding logs, water parameters, and run camera disease scans.'}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-muted small fw-semibold mb-1">Email Address</label>
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
                <label className="form-label text-muted small fw-semibold mb-1">Password</label>
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
                  `Sign In as ${activeTab === 'admin' ? 'Farm Owner / Admin' : 'Pond Caretaker'}`
                )}
              </button>

              {/* Demo Auto-Fill Helper */}
              <div className="text-center">
                <span className="text-muted tiny">Testing system functions?</span>{' '}
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
