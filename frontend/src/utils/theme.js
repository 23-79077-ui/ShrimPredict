/**
 * ShrimPredict Theme Management Utility
 *
 * Requirements:
 * - Default / Auto mode: Automatically adjusts based on computer/laptop time:
 *     6:00 AM (06:00) to 6:00 PM (18:00) => Light mode
 *     6:00 PM (18:00) to 6:00 AM (06:00) => Dark mode
 * - Manual override: If the user changes the mode themselves, their choice
 *     ('light' | 'dark') is saved and takes precedence until reset to 'auto'.
 */

export const THEME_STORAGE_KEY = 'shrim_theme'; // 'light' | 'dark' (currently applied)
export const THEME_PREF_KEY = 'shrim_theme_preference'; // 'auto' | 'light' | 'dark'

/**
 * Returns 'light' or 'dark' based on the local computer / laptop time.
 * 6:00 AM (inclusive) to 6:00 PM (exclusive of 18:00:00) => 'light'
 * 6:00 PM (inclusive) to 6:00 AM (exclusive of 06:00:00) => 'dark'
 *
 * @param {Date} [date=new Date()]
 * @returns {'light'|'dark'}
 */
export const getTimeBasedTheme = (date = new Date()) => {
  const hour = date.getHours();
  return (hour >= 6 && hour < 18) ? 'light' : 'dark';
};

/**
 * Returns the user's saved preference: 'auto', 'light', or 'dark'.
 * Defaults to 'auto' if no manual choice was explicitly made.
 *
 * @returns {'auto'|'light'|'dark'}
 */
export const getThemePreference = () => {
  try {
    const pref = localStorage.getItem(THEME_PREF_KEY);
    if (pref === 'light' || pref === 'dark' || pref === 'auto') {
      return pref;
    }
  } catch (err) {
    console.warn('Unable to access localStorage for theme preference:', err);
  }
  return 'auto';
};

/**
 * Returns the effective theme ('light' or 'dark') to apply,
 * respecting user manual preference or falling back to local time.
 *
 * @returns {'light'|'dark'}
 */
export const getEffectiveTheme = () => {
  const pref = getThemePreference();
  if (pref === 'light' || pref === 'dark') {
    return pref;
  }
  return getTimeBasedTheme();
};

/**
 * Applies the given theme to document DOM, updates localStorage, and broadcasts an event.
 *
 * @param {'light'|'dark'} themeName - Theme to apply ('light' | 'dark')
 * @param {'auto'|'light'|'dark'|boolean|null} [preference=null]
 *        - If 'auto', saves 'auto' preference
 *        - If 'light' or 'dark', saves that preference
 *        - If boolean true: saves themeName as manual preference
 *        - If boolean false: saves 'auto' preference
 *        - If null/omitted: preserves existing preference
 */
export const applyAppTheme = (themeName, preference = null) => {
  const isDark = themeName === 'dark';
  const resolvedTheme = isDark ? 'dark' : 'light';

  try {
    if (preference === 'auto' || preference === false) {
      localStorage.setItem(THEME_PREF_KEY, 'auto');
    } else if (preference === 'light' || preference === 'dark') {
      localStorage.setItem(THEME_PREF_KEY, preference);
    } else if (preference === true) {
      localStorage.setItem(THEME_PREF_KEY, resolvedTheme);
    }

    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
  } catch (err) {
    console.warn('Unable to write theme to localStorage:', err);
  }

  // Set DOM attributes
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-bs-theme', resolvedTheme);

    if (document.body) {
      if (isDark) {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
      }
    }
  }

  const currentPref = getThemePreference();
  const isAuto = currentPref === 'auto';

  // Dispatch custom event across app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shrim-theme-changed', {
        detail: {
          theme: resolvedTheme,
          preference: currentPref,
          isAuto,
        },
      })
    );
  }

  return resolvedTheme;
};

/**
 * Sets manual user override for the theme.
 *
 * @param {'light'|'dark'} themeName
 */
export const setManualTheme = (themeName) => {
  return applyAppTheme(themeName, true);
};

/**
 * Resets the theme to the automatic time-based schedule (6am–6pm Light, 6pm–6am Dark).
 *
 * @returns {'light'|'dark'} The newly active theme
 */
export const resetThemeToAuto = () => {
  const autoTheme = getTimeBasedTheme();
  return applyAppTheme(autoTheme, 'auto');
};

/**
 * Checks if the automatic theme needs to be refreshed (e.g. crossing 6 AM / 6 PM).
 * Only updates if preference is 'auto'.
 *
 * @returns {boolean} Whether an update was applied
 */
export const checkAndUpdateAutoTheme = () => {
  if (getThemePreference() === 'auto') {
    const expected = getTimeBasedTheme();
    const currentApplied = typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme')
      : null;

    if (currentApplied !== expected) {
      applyAppTheme(expected, 'auto');
      return true;
    }
  }
  return false;
};

let watchersInitialized = false;

/**
 * Initializes the theme system on application startup.
 * Applies effective theme and binds periodic/focus watchers.
 */
export const initThemeSystem = () => {
  const effective = getEffectiveTheme();
  applyAppTheme(effective);

  if (watchersInitialized || typeof window === 'undefined') return;
  watchersInitialized = true;

  // Check every 30 seconds for 6:00 AM / 6:00 PM boundary changes
  setInterval(() => {
    checkAndUpdateAutoTheme();
  }, 30000);

  // Check when user returns to tab / wakes up laptop
  window.addEventListener('focus', checkAndUpdateAutoTheme);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndUpdateAutoTheme();
      }
    });
  }
};
