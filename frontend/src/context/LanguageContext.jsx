import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { getLanguage, setLanguage as setLangUtil, toggleLanguage as toggleLangUtil, t as translateUtil } from '../utils/i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => getLanguage());

  useEffect(() => {
    // Sync initial lang attribute on document
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
    }

    const handleLanguageChange = (e) => {
      if (e.detail?.language) {
        setLanguageState(e.detail.language);
      }
    };

    window.addEventListener('shrim-language-changed', handleLanguageChange);
    return () => window.removeEventListener('shrim-language-changed', handleLanguageChange);
  }, [language]);

  /**
   * Displays an interactive confirmation pop-up before changing language.
   * If confirmed, applies change and returns true.
   * If cancelled, leaves language untouched and returns false.
   */
  const confirmAndSetLanguage = useCallback(async (targetLang) => {
    const currentLang = getLanguage();
    if (targetLang === currentLang) return false;

    const isSwitchingToFil = targetLang === 'fil';

    const US_FLAG_SVG = `<svg width="34" height="34" viewBox="0 0 32 32" style="border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.15); border: 2px solid #FFFFFF; flex-shrink: 0; display: inline-block; vertical-align: middle;"><clipPath id="swal-us-clip"><circle cx="16" cy="16" r="16"/></clipPath><g clip-path="url(#swal-us-clip)"><path fill="#B22234" d="M0 0h32v32H0z"/><path stroke="#FFFFFF" stroke-width="2.46" d="M0 3.7h32M0 8.6h32M0 13.5h32M0 18.5h32M0 23.4h32M0 28.3h32"/><path fill="#3C3B6E" d="M0 0h16v17.2H0z"/><circle cx="3.5" cy="3.5" r="1" fill="#FFF"/><circle cx="8" cy="3.5" r="1" fill="#FFF"/><circle cx="12.5" cy="3.5" r="1" fill="#FFF"/><circle cx="5.7" cy="7.2" r="1" fill="#FFF"/><circle cx="10.2" cy="7.2" r="1" fill="#FFF"/><circle cx="3.5" cy="11" r="1" fill="#FFF"/><circle cx="8" cy="11" r="1" fill="#FFF"/><circle cx="12.5" cy="11" r="1" fill="#FFF"/><circle cx="5.7" cy="14.5" r="1" fill="#FFF"/><circle cx="10.2" cy="14.5" r="1" fill="#FFF"/></g></svg>`;
    const PH_FLAG_SVG = `<svg width="34" height="34" viewBox="0 0 32 32" style="border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.15); border: 2px solid #FFFFFF; flex-shrink: 0; display: inline-block; vertical-align: middle;"><clipPath id="swal-ph-clip"><circle cx="16" cy="16" r="16"/></clipPath><g clip-path="url(#swal-ph-clip)"><path fill="#0038A8" d="M0 0h32v16H0z"/><path fill="#CE1126" d="M0 16h32v16H0z"/><path fill="#FFFFFF" d="M0 0l16 16L0 32z"/><circle cx="5.8" cy="16" r="3.2" fill="#FCD116"/><circle cx="2.2" cy="4.5" r="1.1" fill="#FCD116"/><circle cx="2.2" cy="27.5" r="1.1" fill="#FCD116"/><circle cx="13.2" cy="16" r="1.1" fill="#FCD116"/></g></svg>`;

    const result = await Swal.fire({
      title: isSwitchingToFil ? 'Palitan ang Wika sa Filipino?' : 'Switch Language to English?',
      html: `
        <div class="shrim-lang-modal-content">
          <div class="shrim-lang-transition-card">
            <div class="shrim-lang-flag-pill">
              ${isSwitchingToFil ? US_FLAG_SVG : PH_FLAG_SVG}
              <div class="shrim-lang-pill-text">
                <span class="shrim-lang-pill-sub">${isSwitchingToFil ? 'Kasalukuyan' : 'Current'}</span>
                <span class="shrim-lang-pill-name">${isSwitchingToFil ? 'English' : 'Filipino'}</span>
              </div>
            </div>

            <div class="shrim-lang-arrow-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FC563C" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>

            <div class="shrim-lang-flag-pill active">
              ${isSwitchingToFil ? PH_FLAG_SVG : US_FLAG_SVG}
              <div class="shrim-lang-pill-text">
                <span class="shrim-lang-pill-sub">${isSwitchingToFil ? 'Lilipat sa' : 'Switching to'}</span>
                <span class="shrim-lang-pill-name">${isSwitchingToFil ? 'Filipino' : 'English'}</span>
              </div>
            </div>
          </div>

          <p class="shrim-lang-description">
            ${isSwitchingToFil
              ? 'Ia-update ang buong nabigasyon, talaan ng pakain, telemetry ng palaisdaan, at mga alerto sa wikang Filipino / Tagalog.'
              : 'All navigation menus, feeding records, pond telemetry, and biosecurity alerts will be updated to English.'}
          </p>

          <div class="shrim-lang-feature-box">
            <div class="shrim-lang-feature-item">
              <span class="shrim-feature-check">✓</span>
              <span>${isSwitchingToFil ? 'Agad na magkakabisa nang hindi nagre-reload ng pahina' : 'Instant real-time update without reloading the page'}</span>
            </div>
            <div class="shrim-lang-feature-item">
              <span class="shrim-feature-check">✓</span>
              <span>${isSwitchingToFil ? 'Naka-sync sa lahat ng dashboard at ulat ng palaisdaan' : 'Synchronized across all farm dashboards and reports'}</span>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: isSwitchingToFil ? 'Oo, Ilapat ang Wika' : 'Yes, Switch to English',
      cancelButtonText: isSwitchingToFil ? 'Kanselahin (Cancel)' : 'Cancel / Manatili',
      confirmButtonColor: '#FC563C',
      cancelButtonColor: '#64748B',
      reverseButtons: true,
      focusCancel: false,
      customClass: {
        popup: 'shrim-swal-popup shrim-swal-lang-modal',
        title: 'shrim-swal-title',
        actions: 'shrim-swal-actions',
        confirmButton: 'btn-swal-confirm-lang',
        cancelButton: 'btn-swal-cancel-lang',
      },
      buttonsStyling: false,
    });

    if (result.isConfirmed) {
      const updated = setLangUtil(targetLang);
      setLanguageState(updated);

      const Toast = Swal.mixin({
        toast: true,
        position: 'center',
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
        customClass: {
          popup: 'shrim-swal-toast',
          title: 'shrim-swal-toast-title',
        },
      });

      Toast.fire({
        icon: 'success',
        title: targetLang === 'fil' ? 'Nailapat na ang wikang Filipino!' : 'System language switched to English!',
      });

      return true;
    }

    return false;
  }, []);

  const confirmAndToggleLanguage = useCallback(async () => {
    const current = getLanguage();
    const next = current === 'en' ? 'fil' : 'en';
    return confirmAndSetLanguage(next);
  }, [confirmAndSetLanguage]);

  const setLanguage = useCallback((lang, options = {}) => {
    if (options.skipPrompt) {
      const updated = setLangUtil(lang);
      setLanguageState(updated);
      return Promise.resolve(true);
    }
    return confirmAndSetLanguage(lang);
  }, [confirmAndSetLanguage]);

  const toggleLanguage = useCallback((options = {}) => {
    if (options.skipPrompt) {
      const updated = toggleLangUtil();
      setLanguageState(updated);
      return Promise.resolve(true);
    }
    return confirmAndToggleLanguage();
  }, [confirmAndToggleLanguage]);

  const t = useCallback((key, fallback) => {
    return translateUtil(key, fallback);
  }, [language]);

  const value = {
    language,
    isFilipino: language === 'fil',
    setLanguage,
    toggleLanguage,
    confirmAndSetLanguage,
    confirmAndToggleLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    const currentLang = getLanguage();
    return {
      language: currentLang,
      isFilipino: currentLang === 'fil',
      setLanguage: setLangUtil,
      toggleLanguage: toggleLangUtil,
      confirmAndSetLanguage: (target) => Promise.resolve(setLangUtil(target)),
      confirmAndToggleLanguage: () => Promise.resolve(toggleLangUtil()),
      t: translateUtil,
    };
  }
  return context;
}

