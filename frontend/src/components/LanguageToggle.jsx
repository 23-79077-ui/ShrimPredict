import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { FaGlobeAsia } from 'react-icons/fa';

export default function LanguageToggle({ className = '', style = {}, variant = 'pill', isDark = false }) {
  const { language, confirmAndToggleLanguage, confirmAndSetLanguage, isFilipino } = useLanguage();

  if (variant === 'segmented') {
    return (
      <div
        className={`d-inline-flex align-items-center p-1 rounded-pill border ${className}`}
        style={{
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(11, 44, 95, 0.06)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(11, 44, 95, 0.14)',
          ...style,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (isFilipino) {
              confirmAndSetLanguage('en');
            }
          }}
          className="btn btn-sm rounded-pill px-2.5 py-1 extra-small fw-bold border-0 transition-all"
          style={{
            backgroundColor: !isFilipino ? '#FC563C' : 'transparent',
            color: !isFilipino ? '#FFFFFF' : (isDark ? '#E2E8F0' : '#475569'),
            fontSize: '0.74rem',
            lineHeight: 1.2,
          }}
        >
          🇺🇸 EN
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isFilipino) {
              confirmAndSetLanguage('fil');
            }
          }}
          className="btn btn-sm rounded-pill px-2.5 py-1 extra-small fw-bold border-0 transition-all"
          style={{
            backgroundColor: isFilipino ? '#FC563C' : 'transparent',
            color: isFilipino ? '#FFFFFF' : (isDark ? '#E2E8F0' : '#475569'),
            fontSize: '0.74rem',
            lineHeight: 1.2,
          }}
        >
          🇵🇭 FIL
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => confirmAndToggleLanguage()}
      className={`btn btn-sm rounded-pill d-inline-flex align-items-center gap-1.5 shadow-xs px-2.5 py-1 lang-toggle-btn ${className}`}
      style={{
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(11, 44, 95, 0.18)',
        color: isDark ? '#FFFFFF' : '#172A39',
        fontSize: '0.76rem',
        fontWeight: 700,
        height: 38,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }}
      title={isFilipino ? 'Kasalukuyang wika: Filipino / Tagalog. I-click upang lumipat sa Ingles' : 'Current language: English. Click to switch to Filipino / Tagalog'}
      aria-label="Toggle Language / Palitan ang Wika"
    >
      <span style={{ fontSize: '0.85rem' }}>{isFilipino ? '🇵🇭' : '🇺🇸'}</span>
      <span className="font-mono">{isFilipino ? 'FIL' : 'EN'}</span>
    </button>
  );
}
