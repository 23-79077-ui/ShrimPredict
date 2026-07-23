import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { FaBullseye, FaWater, FaChartLine, FaSeedling } from 'react-icons/fa';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('type') === 'caretaker' ? 'caretaker' : 'admin';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [adminEmail, setAdminEmail] = useState('admin@shrimpredict.com');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [caretakerEmail, setCaretakerEmail] = useState('');
  const [caretakerPassword, setCaretakerPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login(adminEmail, adminPassword);
      if (result.user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/caretaker/dashboard');
      Swal.fire({ icon: 'success', title: 'Welcome back!', text: 'You have successfully logged in.' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Login failed', text: error.message || 'Please check your credentials.' });
    }
  };

  const handleCaretakerSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login(caretakerEmail, caretakerPassword);
      if (result.user.role === 'caretaker') navigate('/caretaker/dashboard');
      else navigate('/admin/dashboard');
      Swal.fire({ icon: 'success', title: 'Welcome back!', text: 'You have successfully logged in.' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Login failed', text: error.message || 'Please check your credentials.' });
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-page-card row g-0 overflow-hidden">
        <div className="col-lg-6 login-hero-side p-5 p-xl-6">
          <div className="brand mb-4">
            <span className="brand-icon">SP</span>
            ShrimPredict
          </div>
          <div className="eyebrow mb-3">Smart Farm Insights</div>
          <h1 className="hero-title mb-4">Smart Technology for Smarter Shrimp Farming</h1>
          <p className="hero-copy mb-5">ShrimPredict helps you monitor ponds, detect diseases, optimize feeding, and predict harvest with AI-powered insights for healthier and more productive farms.</p>

          <div className="login-features row g-3">
            <div className="col-12 feature-item d-flex gap-3 align-items-start">
              <div className="login-feature-icon"><FaBullseye /></div>
              <div>
                <h6 className="mb-1">AI Disease Detection</h6>
                <p className="text-muted small mb-0">Detect white spot disease early with image analytics.</p>
              </div>
            </div>
            <div className="col-12 feature-item d-flex gap-3 align-items-start">
              <div className="login-feature-icon"><FaWater /></div>
              <div>
                <h6 className="mb-1">Water Quality Monitoring</h6>
                <p className="text-muted small mb-0">Real-time tracking of pond health and water parameters.</p>
              </div>
            </div>
            <div className="col-12 feature-item d-flex gap-3 align-items-start">
              <div className="login-feature-icon"><FaChartLine /></div>
              <div>
                <h6 className="mb-1">Smart Analytics</h6>
                <p className="text-muted small mb-0">Optimize feed, forecast harvest, and monitor growth trends.</p>
              </div>
            </div>
          </div>

          {activeTab === 'admin' && (
            <div className="login-panel-note mt-5 p-4 rounded-4">
              <p className="mb-2"><strong>Quick access:</strong></p>
              <p className="mb-1"><strong>Email:</strong> admin@shrimpredict.com</p>
              <p className="mb-0"><strong>Password:</strong> admin123</p>
            </div>
          )}
        </div>

        <div className="col-lg-6 login-form-side p-5 p-xl-6">
          <div className="login-form-card h-100 d-flex flex-column justify-content-center">
            {/* Login Tabs */}
            <div className="login-tabs d-flex mb-4 rounded-3 overflow-hidden border">
              <button
                className={`login-tab flex-fill py-3 text-center fw-bold ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <FaSeedling className="me-2" />Admin Login
              </button>
              <button
                className={`login-tab flex-fill py-3 text-center fw-bold ${activeTab === 'caretaker' ? 'active' : ''}`}
                onClick={() => setActiveTab('caretaker')}
              >
                <FaWater className="me-2" />Caretaker Login
              </button>
            </div>

            {/* Admin Login Form */}
            {activeTab === 'admin' && (
              <form onSubmit={handleAdminSubmit}>
                <div className="text-center mb-4">
                  <h2 className="fw-bold mb-2">Admin Access</h2>
                  <p className="text-muted mb-0">Sign in to manage the system</p>
                </div>
                <div className="mb-4">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
                </div>
                <div className="mb-4">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary w-100 btn-lg">Login as Admin</button>
              </form>
            )}

            {/* Caretaker Login Form */}
            {activeTab === 'caretaker' && (
              <form onSubmit={handleCaretakerSubmit}>
                <div className="text-center mb-4">
                  <h2 className="fw-bold mb-2">Caretaker Access</h2>
                  <p className="text-muted mb-0">Sign in to manage assigned ponds</p>
                </div>
                <div className="mb-4">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" value={caretakerEmail} onChange={(e) => setCaretakerEmail(e.target.value)} required />
                </div>
                <div className="mb-4">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" value={caretakerPassword} onChange={(e) => setCaretakerPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-success w-100 btn-lg">Login as Caretaker</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
