import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  FaTimes,
  FaKey,
  FaAt,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaExclamationCircle,
  FaUserShield,
  FaUserCog,
  FaArrowLeft,
  FaHistory,
  FaShieldAlt,
  FaCheck,
} from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = '',
  initialRole = 'admin',
  onSuccess,
  isDark = false,
}) {
  const { t } = useLanguage();

  // Step state: 1 = Email verification, 2 = Set new password, 3 = Success confirmation
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Focus state for unified input borders
  const [focusedField, setFocusedField] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatedTimestamp, setUpdatedTimestamp] = useState('');

  // Reset or initialize state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '');
      setStep(1);
      setVerifiedUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrorMessage('');
      setUpdatedTimestamp('');
      setFocusedField(null);
    }
  }, [isOpen, initialEmail]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  // Step 1: Verify Email
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const trimmed = email.trim();

    if (!trimmed) {
      setErrorMessage(t('forgotPass.enterEmailErr', 'Please enter your account email address.'));
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/forgot_password.php', {
        action: 'verify_email',
        email: trimmed,
      });

      if (response.data?.success && response.data?.user) {
        setVerifiedUser(response.data.user);
        setStep(2);
      } else {
        setErrorMessage(response.data?.message || t('forgotPass.accountNotFound', 'No account found with this email.'));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('forgotPass.verifyFailed', 'Unable to verify email address. Please try again.');
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 6) {
      setErrorMessage(t('forgotPass.minChars', 'Password must be at least 6 characters long.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t('forgotPass.passwordsMismatch', 'Passwords do not match. Please re-enter both fields.'));
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/forgot_password.php', {
        action: 'reset_password',
        email: verifiedUser?.email || email.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (response.data?.success) {
        const timeNow = response.data?.user?.changed_at || new Date().toLocaleString();
        setUpdatedTimestamp(timeNow);
        setStep(3);
      } else {
        setErrorMessage(response.data?.message || t('forgotPass.resetFailed', 'Failed to reset password. Please try again.'));
      }
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.error_type === 'SAME_AS_CURRENT') {
        setErrorMessage(t('forgotPass.sameAsCurrentErr', 'New password cannot be the same as your current password.'));
      } else if (respData?.error_type === 'SAME_AS_PREVIOUS') {
        setErrorMessage(t('forgotPass.sameAsPreviousErr', 'You recently used this password. Please choose a new, unique password.'));
      } else {
        setErrorMessage(respData?.message || err.message || t('forgotPass.resetFailed', 'Failed to reset password. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pass) => {
    if (!pass) return { label: '', percent: 0, color: '#94A3B8' };
    if (pass.length < 6) return { label: 'Too short', percent: 25, color: '#EF4444' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { label: 'Weak', percent: 45, color: '#F97316' };
    if (score === 2) return { label: 'Medium', percent: 75, color: '#EAB308' };
    return { label: 'Strong', percent: 100, color: '#10B981' };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  const handleFinish = () => {
    if (onSuccess && verifiedUser) {
      onSuccess(verifiedUser.email, newPassword, verifiedUser.role);
    }
    onClose();
  };

  // Reusable input wrapper style helper
  const getInputWrapperStyle = (fieldName) => {
    const isFocused = focusedField === fieldName;
    return {
      borderRadius: '10px',
      border: isFocused
        ? '1.5px solid #FC563C'
        : isDark
        ? '1.5px solid rgba(255, 255, 255, 0.14)'
        : '1.5px solid #CBD5E1',
      boxShadow: isFocused ? '0 0 0 3px rgba(252, 86, 60, 0.2)' : 'none',
      backgroundColor: isDark ? '#0F1C26' : '#FFFFFF',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      overflow: 'hidden',
    };
  };

  return (
    <AnimatePresence>
      <div
        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center px-3"
        style={{
          backgroundColor: 'rgba(10, 20, 29, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1100,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !loading) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="rounded-4 overflow-hidden position-relative w-100"
          style={{
            maxWidth: '470px',
            backgroundColor: isDark ? '#162736' : '#FFFFFF',
            border: isDark ? '1.5px solid rgba(255, 255, 255, 0.12)' : '1px solid #E2E8F0',
            boxShadow: isDark
              ? '0 25px 60px -10px rgba(0, 0, 0, 0.65), 0 0 30px rgba(252, 86, 60, 0.08)'
              : '0 25px 50px -10px rgba(15, 23, 42, 0.18)',
          }}
        >
          {/* ========================================================
              MODAL HEADER
             ======================================================== */}
          <div
            className="p-3.5 px-4 d-flex align-items-center justify-content-between border-bottom"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              backgroundColor: isDark ? '#11222E' : '#F8FAFC',
            }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                style={{
                  width: 42,
                  height: 42,
                  background: 'linear-gradient(135deg, rgba(252, 86, 60, 0.18) 0%, rgba(255, 107, 85, 0.08) 100%)',
                  color: '#FC563C',
                  border: '1px solid rgba(252, 86, 60, 0.3)',
                }}
              >
                <FaKey size={17} style={{ filter: 'drop-shadow(0 2px 4px rgba(252, 86, 60, 0.25))' }} />
              </div>
              <div className="min-w-0">
                <h5
                  className="fw-bold mb-0 lh-sm"
                  style={{
                    fontSize: '1.05rem',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t('forgotPass.modalTitle', 'Reset Account Password')}
                </h5>
                <p
                  className="mb-0 text-truncate"
                  style={{
                    fontSize: '0.76rem',
                    color: isDark ? '#94A3B8' : '#64748B',
                    marginTop: '2px',
                  }}
                >
                  {t('forgotPass.modalSubtitle', 'Account recovery for Admin & Caretaker portals')}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center p-0 transition-all flex-shrink-0 ms-2"
              style={{
                width: 32,
                height: 32,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EDF2F7',
                color: isDark ? '#CBD5E1' : '#64748B',
                border: 'none',
              }}
              onClick={onClose}
              disabled={loading}
              aria-label="Close dialog"
            >
              <FaTimes size={13} />
            </button>
          </div>

          {/* ========================================================
              STEP PROGRESS BAR (CLEAN & BALANCED)
             ======================================================== */}
          {step < 3 && (
            <div
              className="px-4 py-2.5 border-bottom d-flex align-items-center justify-content-between"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#F1F5F9',
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : '#F8FAFC',
                fontSize: '0.78rem',
              }}
            >
              {/* Step 1 Capsule */}
              <div
                className="d-flex align-items-center gap-2"
                style={{
                  color: step === 1 ? '#FC563C' : step > 1 ? '#10B981' : isDark ? '#64748B' : '#94A3B8',
                  fontWeight: step >= 1 ? 700 : 500,
                }}
              >
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    backgroundColor: step > 1 ? '#10B981' : '#FC563C',
                    color: '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {step > 1 ? <FaCheck size={10} /> : '1'}
                </span>
                <span>{t('forgotPass.step1Title', 'Verify Email')}</span>
              </div>

              {/* Connecting Bar */}
              <div
                className="flex-grow-1 mx-3 rounded-pill"
                style={{
                  height: 3,
                  backgroundColor: step >= 2 ? '#FC563C' : isDark ? '#334155' : '#E2E8F0',
                  transition: 'background-color 0.3s ease',
                }}
              />

              {/* Step 2 Capsule */}
              <div
                className="d-flex align-items-center gap-2"
                style={{
                  color: step >= 2 ? '#FC563C' : isDark ? '#64748B' : '#94A3B8',
                  fontWeight: step >= 2 ? 700 : 500,
                }}
              >
                <span
                  className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    backgroundColor: step >= 2 ? '#FC563C' : isDark ? '#334155' : '#E2E8F0',
                    color: step >= 2 ? '#FFFFFF' : isDark ? '#94A3B8' : '#64748B',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  2
                </span>
                <span>{t('forgotPass.step2Title', 'Set New Password')}</span>
              </div>
            </div>
          )}

          {/* ========================================================
              MODAL BODY
             ======================================================== */}
          <div className="p-4">
            {/* ERROR BANNER */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert-danger p-2.5 px-3 rounded-3 d-flex align-items-start gap-2 mb-3"
                style={{
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                  color: isDark ? '#FCA5A5' : '#DC2626',
                  fontSize: '0.81rem',
                  lineHeight: '1.45',
                }}
              >
                <FaExclamationCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div className="flex-grow-1">{errorMessage}</div>
              </motion.div>
            )}

            {/* ========================================================
                STEP 1: EMAIL VERIFICATION
               ======================================================== */}
            {step === 1 && (
              <form onSubmit={handleVerifyEmail}>
                <div className="mb-3">
                  <p
                    className="mb-3"
                    style={{
                      color: isDark ? '#CBD5E1' : '#475569',
                      lineHeight: '1.5',
                      fontSize: '0.84rem',
                    }}
                  >
                    {t(
                      'forgotPass.step1Desc',
                      'Enter the email address registered with your Admin or Caretaker account.'
                    )}
                  </p>

                  <label
                    className="form-label fw-semibold mb-1.5"
                    style={{
                      color: isDark ? '#F1F5F9' : '#1E293B',
                      fontSize: '0.82rem',
                    }}
                  >
                    {t('forgotPass.emailLabel', 'Registered Email Address')}
                  </label>

                  {/* UNIFIED INPUT BOX */}
                  <div
                    className="d-flex align-items-center"
                    style={getInputWrapperStyle('email')}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                        color: focusedField === 'email' ? '#FC563C' : isDark ? '#94A3B8' : '#64748B',
                      }}
                    >
                      <FaAt size={14} />
                    </div>
                    <input
                      type="email"
                      className="form-control border-0 shadow-none px-3"
                      style={{
                        backgroundColor: 'transparent',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontSize: '0.88rem',
                        height: 44,
                      }}
                      placeholder="e.g. admin@shrimpredict.com or cj@gmail.com"
                      value={email}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Microcopy pill */}
                  <div
                    className="d-flex align-items-center gap-2 mt-2 px-2.5 py-1.5 rounded-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(252, 86, 60, 0.07)' : '#FFF7ED',
                      border: isDark ? '1px solid rgba(252, 86, 60, 0.15)' : '1px solid #FFEDD5',
                      color: isDark ? '#CBD5E1' : '#7C2D12',
                      fontSize: '0.74rem',
                    }}
                  >
                    <FaShieldAlt size={12} style={{ color: '#FC563C', flexShrink: 0 }} />
                    <span>{t('forgotPass.securityNote', 'Works for all registered accounts with role identification')}</span>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="d-flex justify-content-end align-items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    className="btn px-3.5 fw-semibold d-inline-flex align-items-center justify-content-center transition-all"
                    style={{
                      height: 42,
                      borderRadius: '10px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
                      color: isDark ? '#E2E8F0' : '#475569',
                      fontSize: '0.84rem',
                    }}
                    onClick={onClose}
                    disabled={loading}
                  >
                    {t('forgotPass.cancelBtn', 'Cancel')}
                  </button>

                  <button
                    type="submit"
                    className="btn px-4 fw-bold text-white d-inline-flex align-items-center justify-content-center gap-2 transition-all"
                    style={{
                      height: 42,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #FC563C 0%, #FF684F 100%)',
                      border: 'none',
                      fontSize: '0.85rem',
                      boxShadow: '0 4px 14px rgba(252, 86, 60, 0.35)',
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        <span>{t('forgotPass.verifying', 'Verifying...')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('forgotPass.verifyBtn', 'Verify Email')}</span>
                        <FaKey size={12} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                STEP 2: SET NEW PASSWORD & CONFIRMATION
               ======================================================== */}
            {step === 2 && verifiedUser && (
              <form onSubmit={handleResetPassword}>
                {/* VERIFIED ACCOUNT CARD (CLEAN & NON-COLLIDING) */}
                <div
                  className="p-3 rounded-3 mb-3 d-flex align-items-center justify-content-between gap-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.09)' : '#F0FDF4',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #BBF7D0',
                  }}
                >
                  <div className="d-flex align-items-center gap-2.5 min-w-0" style={{ flex: 1 }}>
                    {/* Role Icon Avatar */}
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                      style={{
                        width: 38,
                        height: 38,
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        border: '2px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {verifiedUser.role === 'admin' ? <FaUserShield size={16} /> : <FaUserCog size={16} />}
                    </div>

                    {/* Account Details */}
                    <div className="min-w-0" style={{ flex: 1 }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className="fw-bold text-truncate"
                          style={{
                            color: isDark ? '#FFFFFF' : '#0F172A',
                            fontSize: '0.88rem',
                            maxWidth: '145px',
                          }}
                          title={verifiedUser.full_name}
                        >
                          {verifiedUser.full_name}
                        </span>
                        <span
                          className="rounded-pill d-inline-flex align-items-center"
                          style={{
                            backgroundColor: verifiedUser.role === 'admin' ? '#FC563C' : '#0B2C5F',
                            color: '#FFFFFF',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            letterSpacing: '0.02em',
                            lineHeight: 1.3,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {verifiedUser.role === 'admin'
                            ? t('forgotPass.roleAdmin', 'Admin / Owner')
                            : t('forgotPass.roleCaretaker', 'Caretaker')}
                        </span>
                      </div>

                      <div
                        className="text-truncate d-flex align-items-center gap-1"
                        style={{
                          fontSize: '0.74rem',
                          color: isDark ? '#A7F3D0' : '#059669',
                        }}
                      >
                        <FaCheckCircle size={10} style={{ flexShrink: 0 }} />
                        <span className="text-truncate">{verifiedUser.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Change Email Button */}
                  <button
                    type="button"
                    className="btn btn-sm p-0 fw-semibold text-decoration-none flex-shrink-0 d-inline-flex align-items-center gap-1 transition-all"
                    style={{
                      color: '#FC563C',
                      fontSize: '0.76rem',
                      background: 'none',
                      border: 'none',
                      padding: '4px 8px',
                    }}
                    onClick={() => {
                      setStep(1);
                      setErrorMessage('');
                    }}
                    title="Change email address"
                  >
                    <FaArrowLeft size={10} />
                    <span>{t('forgotPass.changeEmailBtn', 'Change Email')}</span>
                  </button>
                </div>

                {/* Last Changed Timestamp Reminder if applicable */}
                {verifiedUser.last_changed_formatted && (
                  <div
                    className="p-2.5 rounded-3 mb-3 d-flex align-items-center gap-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                      fontSize: '0.76rem',
                      color: isDark ? '#CBD5E1' : '#64748B',
                    }}
                  >
                    <FaHistory size={13} style={{ color: '#FC563C', flexShrink: 0 }} />
                    <span>
                      {t('forgotPass.lastChanged', 'Last updated on')}:{' '}
                      <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        {verifiedUser.last_changed_formatted}
                      </strong>
                    </span>
                  </div>
                )}

                {/* New Password Field */}
                <div className="mb-2.5">
                  <label
                    className="form-label fw-semibold mb-1.5"
                    style={{ color: isDark ? '#F1F5F9' : '#1E293B', fontSize: '0.82rem' }}
                  >
                    {t('forgotPass.newPasswordLabel', 'New Password')}
                  </label>

                  <div
                    className="d-flex align-items-center"
                    style={getInputWrapperStyle('newPassword')}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                        color: focusedField === 'newPassword' ? '#FC563C' : isDark ? '#94A3B8' : '#64748B',
                      }}
                    >
                      <FaLock size={13} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-control border-0 shadow-none px-3"
                      style={{
                        backgroundColor: 'transparent',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontSize: '0.88rem',
                        height: 44,
                      }}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onFocus={() => setFocusedField('newPassword')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-sm d-flex align-items-center justify-content-center flex-shrink-0 p-0 me-2"
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: isDark ? '#94A3B8' : '#64748B',
                      }}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>

                  {/* Strength Bar */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.72rem' }}>
                        <span style={{ color: isDark ? '#94A3B8' : '#64748B' }}>Password Strength:</span>
                        <span className="fw-bold" style={{ color: strength.color }}>
                          {strength.label}
                        </span>
                      </div>
                      <div
                        className="progress rounded-pill"
                        style={{ height: 4, backgroundColor: isDark ? '#334155' : '#E2E8F0' }}
                      >
                        <div
                          className="progress-bar rounded-pill transition-all"
                          style={{
                            width: `${strength.percent}%`,
                            backgroundColor: strength.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="mb-3">
                  <label
                    className="form-label fw-semibold mb-1.5"
                    style={{ color: isDark ? '#F1F5F9' : '#1E293B', fontSize: '0.82rem' }}
                  >
                    {t('forgotPass.confirmPasswordLabel', 'Confirm New Password')}
                  </label>

                  <div
                    className="d-flex align-items-center"
                    style={getInputWrapperStyle('confirmPassword')}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                        color: focusedField === 'confirmPassword' ? '#FC563C' : isDark ? '#94A3B8' : '#64748B',
                      }}
                    >
                      <FaLock size={13} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-control border-0 shadow-none px-3"
                      style={{
                        backgroundColor: 'transparent',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontSize: '0.88rem',
                        height: 44,
                      }}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-sm d-flex align-items-center justify-content-center flex-shrink-0 p-0 me-2"
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: isDark ? '#94A3B8' : '#64748B',
                      }}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>

                  {/* Match Indicator */}
                  {confirmPassword && (
                    <div className="mt-1.5" style={{ fontSize: '0.74rem' }}>
                      {passwordsMatch ? (
                        <span className="text-success fw-semibold d-inline-flex align-items-center gap-1">
                          <FaCheckCircle size={11} /> {t('forgotPass.passwordsMatch', 'Passwords match')}
                        </span>
                      ) : passwordsMismatch ? (
                        <span className="text-danger fw-semibold d-inline-flex align-items-center gap-1">
                          <FaExclamationCircle size={11} /> {t('forgotPass.passwordsMismatch', 'Passwords do not match')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ACTION BUTTONS */}
                <div
                  className="d-flex justify-content-end align-items-center gap-2.5 pt-3 border-top"
                  style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }}
                >
                  <button
                    type="button"
                    className="btn px-3.5 fw-semibold d-inline-flex align-items-center justify-content-center gap-1.5 transition-all"
                    style={{
                      height: 42,
                      borderRadius: '10px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
                      color: isDark ? '#E2E8F0' : '#475569',
                      fontSize: '0.84rem',
                    }}
                    onClick={() => {
                      setStep(1);
                      setErrorMessage('');
                    }}
                    disabled={loading}
                  >
                    <FaArrowLeft size={11} />
                    <span>{t('forgotPass.backBtn', 'Back')}</span>
                  </button>

                  <button
                    type="submit"
                    className="btn px-4 fw-bold text-white d-inline-flex align-items-center justify-content-center gap-2 transition-all"
                    style={{
                      height: 42,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #FC563C 0%, #FF684F 100%)',
                      border: 'none',
                      fontSize: '0.85rem',
                      boxShadow: '0 4px 14px rgba(252, 86, 60, 0.35)',
                    }}
                    disabled={loading || (confirmPassword && !passwordsMatch)}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        <span>{t('forgotPass.updating', 'Updating Password...')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('forgotPass.submitBtn', 'Reset & Update Password')}</span>
                        <FaCheckCircle size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================
                STEP 3: SUCCESS CONFIRMATION
               ======================================================== */}
            {step === 3 && (
              <div className="text-center py-3">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-md"
                  style={{
                    width: 64,
                    height: 64,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <FaCheckCircle size={30} />
                </motion.div>

                <h5 className="fw-bold mb-1" style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontSize: '1.15rem' }}>
                  {t('forgotPass.successTitle', 'Password Reset Complete!')}
                </h5>

                <p
                  className="mb-3 px-2"
                  style={{
                    fontSize: '0.84rem',
                    color: isDark ? '#94A3B8' : '#64748B',
                    lineHeight: '1.5',
                  }}
                >
                  {t(
                    'forgotPass.successDesc',
                    'Your account password has been updated. You can now log in with your new credentials.'
                  )}
                </p>

                {/* Timestamp Card */}
                {updatedTimestamp && (
                  <div
                    className="p-2.5 px-3 rounded-3 mb-4 d-inline-flex align-items-center gap-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                      border: isDark ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid #A7F3D0',
                      color: isDark ? '#A7F3D0' : '#047857',
                      fontSize: '0.78rem',
                    }}
                  >
                    <FaHistory size={12} />
                    <span>
                      Changed on: <strong>{updatedTimestamp}</strong>
                    </span>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    className="btn w-100 fw-bold text-white shadow-md d-flex align-items-center justify-content-center gap-2 transition-all"
                    style={{
                      height: 44,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #FC563C 0%, #FF684F 100%)',
                      border: 'none',
                      fontSize: '0.88rem',
                      boxShadow: '0 4px 16px rgba(252, 86, 60, 0.35)',
                    }}
                    onClick={handleFinish}
                  >
                    <span>{t('forgotPass.backToLogin', 'Proceed to Sign In')}</span>
                    <FaArrowLeft size={11} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
