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
  FaCheck,
  FaLaptop,
  FaMobileAlt,
  FaAt,
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
    <div
      className="min-vh-100 w-100 d-flex align-items-center justify-content-center py-4 py-md-5 px-3 position-relative overflow-hidden"
      style={{
        backgroundColor: '#040710',
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(14, 165, 233, 0.16) 0%, transparent 50%),
          radial-gradient(circle at 85% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 50%),
          linear-gradient(90deg, #0A1326 0%, #0A1326 50%, #040710 50%, #040710 100%)
        `,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div className="container-fluid" style={{ maxWidth: '1180px' }}>
        {/* Back to Home Pill Button (Top Left) */}
        <div className="mb-4">
          <Link
            to="/"
            className="btn rounded-pill px-3.5 py-2 d-inline-flex align-items-center gap-2 fw-medium text-white text-decoration-none transition-all"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              backdropFilter: 'blur(12px)',
              fontSize: '0.88rem',
            }}
          >
            <FaArrowLeft size={13} /> Back to Home
          </Link>
        </div>

        <div className="row g-4 lg-g-5 align-items-center">
          {/* 🌟 LEFT PANEL: BRANDING & ROLE CAPABILITIES */}
          <div className="col-lg-6 pe-lg-4 text-white">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Center Logo with Soft Back Glow */}
              <div className="d-flex justify-content-center align-items-center w-100 mb-3.5">
                <img
                  src="/shrimp_predict_logo.png"
                  alt="ShrimPredict Official Logo"
                  className="mx-auto d-block"
                  style={{
                    height: '165px',
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 25px rgba(14, 165, 233, 0.45))',
                  }}
                />
              </div>

              {/* Title & Subtitle */}
              <div className="text-center mb-4">
                <h1 className="fw-bold mb-2 lh-sm text-white" style={{ fontSize: 'clamp(1.4rem, 2.2vw, 2.0rem)' }}>
                  <span style={{ color: '#FF7B38' }}>ShrimpPredict:</span> Shrimp Feed Monitoring and Disease Detection System
                </h1>
                <p className="fw-semibold mb-0" style={{ color: '#38BDF8', fontSize: '1.05rem', letterSpacing: '0.2px' }}>
                  Utilizing Image Processing
                </p>
              </div>

              {/* ROLE-BASED SYSTEM CAPABILITIES BADGE */}
              <div className="mb-3">
                <div className="extra-small fw-bold text-uppercase tracking-wider mb-3 d-flex align-items-center gap-2" style={{ color: '#94A3B8', letterSpacing: '1px' }}>
                  <span className="p-1 rounded-circle" style={{ backgroundColor: '#38BDF8' }}></span> ROLE-BASED SYSTEM CAPABILITIES
                </div>

                {/* Card 1: For Farm Owners */}
                <div
                  className="p-3.5 p-md-4 rounded-4 mb-3 position-relative overflow-hidden transition-all"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.70)',
                    border: '1.5px solid rgba(56, 189, 248, 0.45)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div className="d-flex align-items-center gap-2.5 mb-2.5">
                    <div className="p-2 rounded-3 text-info d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', width: 34, height: 34 }}>
                      <FaLaptop size={16} />
                    </div>
                    <h6 className="fw-bold text-white mb-0" style={{ fontSize: '0.96rem' }}>
                      For Farm Owners (Web Portal)
                    </h6>
                  </div>
                  <ul className="list-unstyled mb-0" style={{ color: '#CBD5E1', fontSize: '0.875rem' }}>
                    <li className="d-flex align-items-start gap-2 mb-1.5">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#38BDF8', fontSize: '12px' }} />
                      <span>Centralized dashboard covering nursery and grow-out ponds.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1.5">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#38BDF8', fontSize: '12px' }} />
                      <span>Predictive analytics for harvest planning and feeding deviation.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#38BDF8', fontSize: '12px' }} />
                      <span>Caretaker credential management and farm-wide biosecurity control.</span>
                    </li>
                  </ul>
                </div>

                {/* Card 2: For Pond Caretakers */}
                <div
                  className="p-3.5 p-md-4 rounded-4 position-relative overflow-hidden transition-all"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.70)',
                    border: '1.5px solid rgba(245, 158, 11, 0.45)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div className="d-flex align-items-center gap-2.5 mb-2.5">
                    <div className="p-2 rounded-3 text-warning d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', width: 34, height: 34 }}>
                      <FaMobileAlt size={16} />
                    </div>
                    <h6 className="fw-bold text-white mb-0" style={{ fontSize: '0.96rem' }}>
                      For Pond Caretakers (Mobile View)
                    </h6>
                  </div>
                  <ul className="list-unstyled mb-0" style={{ color: '#CBD5E1', fontSize: '0.875rem' }}>
                    <li className="d-flex align-items-start gap-2 mb-1.5">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#F59E0B', fontSize: '12px' }} />
                      <span>Sunlight-readable, step-by-step camera diagnostic scanner.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2 mb-1.5">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#F59E0B', fontSize: '12px' }} />
                      <span>Quick-entry forms for daily feed logs and water quality.</span>
                    </li>
                    <li className="d-flex align-items-start gap-2">
                      <FaCheck className="mt-1 flex-shrink-0" style={{ color: '#F59E0B', fontSize: '12px' }} />
                      <span>Immediate task updates, scheduled feeding reminders, and alerts.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ⚡ RIGHT PANEL: GLOWING LOGIN FORM CARD */}
          <div className="col-lg-6 ps-lg-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto"
              style={{ maxWidth: '500px' }}
            >
              <div
                className="p-4 p-md-5 rounded-4 position-relative overflow-hidden"
                style={{
                  backgroundColor: '#0F172A',
                  border: '1.5px solid #0EA5E9',
                  boxShadow: '0 0 35px rgba(14, 165, 233, 0.45), 0 15px 50px rgba(0, 0, 0, 0.6)',
                  borderRadius: '24px',
                }}
              >
                {/* 🎛️ ROLE TOGGLE PILL SWITCHER BAR */}
                <div
                  className="p-1 rounded-pill d-flex mb-4"
                  style={{
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-2.5 px-3 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                      activeTab === 'admin'
                        ? 'text-white shadow-sm'
                        : 'text-secondary border-0'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'admin' ? '#0EA5E9' : 'transparent',
                      color: activeTab === 'admin' ? '#FFFFFF' : '#94A3B8',
                      fontSize: '0.88rem',
                    }}
                    onClick={() => handleTabChange('admin')}
                  >
                    <FaUserShield size={14} /> Admin Access
                  </button>
                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-2.5 px-3 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                      activeTab === 'caretaker'
                        ? 'text-white shadow-sm'
                        : 'text-secondary border-0'
                    }`}
                    style={{
                      backgroundColor: activeTab === 'caretaker' ? '#0EA5E9' : 'transparent',
                      color: activeTab === 'caretaker' ? '#FFFFFF' : '#94A3B8',
                      fontSize: '0.88rem',
                    }}
                    onClick={() => handleTabChange('caretaker')}
                  >
                    <FaUserCog size={14} /> Caretaker Access
                  </button>
                </div>

                {/* FORM TITLE & SUBTITLE */}
                <div className="text-center mb-4">
                  <h3 className="fw-bold text-white mb-2" style={{ fontSize: '1.45rem' }}>
                    {activeTab === 'admin' ? 'Farm Owner & Admin Portal' : 'Pond Caretaker Portal'}
                  </h3>
                  <p className="mb-0" style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: '1.5' }}>
                    {activeTab === 'admin'
                      ? 'Sign in to access pond management dashboards, harvest forecasts, and biosecurity settings.'
                      : 'Sign in to log daily feed records, perform AI disease scans, and view pond status.'}
                  </p>
                </div>

                {/* LOGIN FORM */}
                <form onSubmit={handleSubmit}>
                  {/* Email / Username Field */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold mb-1.5" style={{ color: '#CBD5E1' }}>
                      {activeTab === 'admin' ? 'Email Address' : 'Caretaker Username / Email'}
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-end-0 rounded-start-3"
                        style={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          color: '#94A3B8',
                        }}
                      >
                        <FaAt size={14} />
                      </span>
                      <input
                        type="email"
                        className="form-control border-start-0 rounded-end-3 py-2.5 text-white"
                        style={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          fontSize: '0.9rem',
                        }}
                        placeholder={activeTab === 'admin' ? 'admin@shrimpredict.com' : 'caretaker@shrimpredict.com'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="mb-4">
                    <label className="form-label small fw-semibold mb-1.5" style={{ color: '#CBD5E1' }}>
                      Password
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text border-end-0 rounded-start-3"
                        style={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          color: '#94A3B8',
                        }}
                      >
                        <FaLock size={13} />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control border-start-0 border-end-0 py-2.5 text-white"
                        style={{
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          fontSize: '0.9rem',
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
                          backgroundColor: '#1E293B',
                          borderColor: '#334155',
                          color: '#94A3B8',
                        }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* SIGN IN BUTTON */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn w-100 py-3 rounded-3 fw-bold text-white shadow-lg d-flex align-items-center justify-content-center gap-2 mb-3.5"
                    style={{
                      backgroundColor: '#0EA5E9',
                      border: 'none',
                      fontSize: '1rem',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(14, 165, 233, 0.45)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Authenticating...
                      </>
                    ) : (
                      `Sign In as ${activeTab === 'admin' ? 'Farm Owner / Admin' : 'Caretaker'}`
                    )}
                  </button>

                  {/* DEMO AUTO-FILL CREDENTIALS LINK */}
                  <div className="text-center">
                    <span style={{ color: '#94A3B8', fontSize: '0.83rem' }}>Testing system functions?</span>{' '}
                    <button
                      type="button"
                      onClick={() => handleTabChange(activeTab)}
                      className="btn btn-link p-0 fw-semibold text-decoration-none ms-1"
                      style={{ color: '#38BDF8', fontSize: '0.83rem' }}
                    >
                      Auto-fill demo credentials
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

