import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api, { safeArray } from '../../services/api';
import {
  FaUtensils,
  FaWater,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaClock,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaStethoscope,
  FaCamera,
  FaSeedling,
  FaSync,
  FaLock,
  FaShieldAlt,
  FaChevronRight,
  FaFileAlt,
  FaHistory,
  FaTasks
} from 'react-icons/fa';
import { getEffectiveTheme } from '../../utils/theme';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';
import WaterQualityHistoryModal from '../../components/WaterQualityHistoryModal';

const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

const normalizeFeedingTime = (value = '') => {
  if (!value) return '';
  const s = String(value).toUpperCase().replace(/\s+/g, ' ').trim();
  if (s.includes('6:00 PM') || s.includes('6:00PM') || s.includes('6 PM') || s.startsWith('18:00') || s.startsWith('18:')) return '6:00 PM';
  if (s.includes('6:00 AM') || s.includes('6:00AM') || s.includes('6 AM') || (s.startsWith('6:') && !s.includes('PM')) || s.startsWith('06:00') || s.startsWith('06:')) return '6:00 AM';
  if (s.includes('9:00 AM') || s.includes('9:00AM') || s.includes('9 AM') || s.startsWith('9:') || s.startsWith('09:00') || s.startsWith('09:')) return '9:00 AM';
  if (s.includes('12:00 PM') || s.includes('12:00PM') || s.includes('12 PM') || s.startsWith('12:00') || s.startsWith('12:')) return '12:00 PM';
  if (s.includes('3:00 PM') || s.includes('3:00PM') || s.includes('3 PM') || s.startsWith('15:00') || s.startsWith('15:') || (s.startsWith('3:') && !s.includes('AM'))) return '3:00 PM';
  return s.replace(/^0(\d:)/, '$1');
};

export const getLocalDateString = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = parseLocalDate(stockingDateStr);
  const t = targetDateStr ? parseLocalDate(targetDateStr) : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 ? diffDays : null;
}

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      const cleaned = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/shrim_predict_api)?/i, '');
      return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    }
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) {
    return cleanPath.replace(/^\/shrim_predict_api/, '');
  }
  return cleanPath;
};

export default function CaretakerDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentTheme, setCurrentTheme] = useState(() => getEffectiveTheme());

  useEffect(() => {
    const handleThemeChange = (e) => {
      const t = e?.detail?.theme || document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(t);
    };
    window.addEventListener('shrim-theme-changed', handleThemeChange);
    return () => window.removeEventListener('shrim-theme-changed', handleThemeChange);
  }, []);

  const isDark = currentTheme === 'dark';

  const [assignedPonds, setAssignedPonds] = useState(
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : [])
  );

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [records, setRecords] = useState([]);
  const [diseaseScans, setDiseaseScans] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [waterQualityChecklist, setWaterQualityChecklist] = useState({
    total_assigned: 0,
    verified_count: 0,
    is_all_completed: false,
    checklist: [],
  });
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrTargetPondId, setOcrTargetPondId] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTargetPond, setHistoryTargetPond] = useState(null);
  const [editingWqRecord, setEditingWqRecord] = useState(null);
  const [ocrTargetDate, setOcrTargetDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [selectedDiseasePondFilter, setSelectedDiseasePondFilter] = useState('all');
  const [activeActivityTab, setActiveActivityTab] = useState('waterQuality'); // 'waterQuality' | 'ponds' | 'disease' | 'alerts'


  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [feedRes, diseaseRes, alertsRes, wqRes, pondsRes] = await Promise.allSettled([
        api.get('/feeding_records.php', {
          params: {
            user_id: user?.id || 0,
            recorded_by_name: user?.full_name || '',
          },
        }),
        api.get('/disease_reports.php', {
          params: {
            user_id: user?.id || 0,
            caretaker_name: user?.full_name || '',
          },
        }),
        api.get('/alerts.php'),
        api.get('/water_quality_records.php', {
          params: {
            caretaker_id: user?.id || 0,
          },
        }),
        api.get('/caretaker_ponds.php', {
          params: {
            user_id: user?.id || 0,
          },
        }),
      ]);

      if (feedRes.status === 'fulfilled') {
        const recs = safeArray(feedRes.value.data);
        setRecords(recs);
        // User Rule: Always remain on today's real date by default (never auto-jump to older date)
      }
      if (diseaseRes.status === 'fulfilled') setDiseaseScans(safeArray(diseaseRes.value.data));
      if (alertsRes.status === 'fulfilled') setAlerts(safeArray(alertsRes.value.data));
      if (wqRes.status === 'fulfilled' && wqRes.value.data?.success) {
        setWaterQualityChecklist(wqRes.value.data);
      }
      if (pondsRes.status === 'fulfilled' && pondsRes.value.data?.success && Array.isArray(pondsRes.value.data.ponds) && pondsRes.value.data.ponds.length > 0) {
        setAssignedPonds(pondsRes.value.data.ponds);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.full_name]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
    };
  }, [loadData]);

  const availableDates = useMemo(() => {
    const dateMap = new Map();
    records.forEach((r) => {
      const d = (r.record_date || r.created_at || '').slice(0, 10);
      if (!d) return;
      const existing = dateMap.get(d) || {
        date: d,
        count: 0,
        totalKg: 0,
        stockingDate: r.stocking_date || assignedPonds[0]?.stocking_date || '2026-08-10'
      };
      existing.count += 1;
      existing.totalKg += parseFloat(r.amount_kg) || 0;
      dateMap.set(d, existing);
    });
    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, assignedPonds]);

  const selectedDateRecords = records.filter((r) => (r.record_date || r.created_at || '').slice(0, 10) === selectedDate);
  const todayRecords = selectedDateRecords;
  const filteredTodayRecords = selectedDateRecords.filter((r) => {
    if (selectedPondFilter === 'all') return true;
    return String(r.pond_id) === String(selectedPondFilter);
  });


  const totalAmountToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  const totalGramsToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_grams) || ((parseFloat(r.amount_kg) || 0) * 1000) || 0), 0);
  const selectedPondObj = assignedPonds.find((p) => String(p.id) === String(selectedPondFilter));
  const loggedFeedingSlots = new Set(filteredTodayRecords.map((r) => normalizeFeedingTime(r.feeding_time)).filter(Boolean));
  const completedFeedingSlots = feedingTimes.filter((time) => loggedFeedingSlots.has(normalizeFeedingTime(time))).length;
  const feedingCompletion = Math.round((completedFeedingSlots / feedingTimes.length) * 100);
  const currentScope = selectedPondFilter === 'all' ? 'All assigned ponds' : selectedPondObj?.pond_name || 'Selected pond';
  const filteredDiseaseScans = diseaseScans.filter((scan) => {
    if (selectedDiseasePondFilter === 'all') return true;
    return String(scan.pond_name || '').trim().toLowerCase() === String(selectedDiseasePondFilter).trim().toLowerCase();
  });
  const latestDisease = filteredDiseaseScans[0];
  const latestAlert = alerts[0];


  return (
    <div className="caretaker-dashboard-hub">
      {/* 1. TITLE HEADER DIRECTLY BELOW NAVBAR */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('hero.caretakerDashboard', 'Daily Farm Dashboard')}
          </h3>
          <span
            className="badge rounded-pill d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <span className="pulse-dot-green" />
            {t('• Live')}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-sm d-inline-flex align-items-center gap-2 px-3.5 py-2 rounded-3 text-secondary shadow-2xs hover-shadow"
          style={{
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
            color: isDark ? '#E2E8F0' : '#475569',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
          onClick={loadData}
          disabled={loading}
          title="Refresh Dashboard"
        >
          <FaSync size={11} className={loading ? 'fa-spin' : ''} />
          <span>{t('Refresh')}</span>
        </button>
      </div>

      {/* 2. UNIFIED FILTER TOOLBAR ROW */}
      <div className="unified-filter-toolbar d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-4">
        {/* Pond Filter */}
        <div className="position-relative" style={{ minWidth: 200 }}>
          <select
            className="form-select form-select-sm minimal-filter-control px-2.5"
            value={selectedPondFilter}
            onChange={(e) => setSelectedPondFilter(e.target.value)}
          >
            <option value="all">{t('All Assigned Ponds')} ({assignedPonds.length})</option>
            {assignedPonds.map((pond) => (
              <option key={pond.id} value={String(pond.id)}>
                {pond.pond_name}
              </option>
            ))}
          </select>
        </div>

        {/* Minimalist Filter Controls Cluster */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Date Picker */}
          <div className="position-relative">
            <input
              type="date"
              className="form-control form-control-sm minimal-filter-control px-2.5"
              style={{ minWidth: 145 }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Select date to inspect feeding records & DOC"
            />
          </div>

          {/* Quick Return to Today Button */}
          {selectedDate !== todayStr && (
            <button
              type="button"
              className="btn btn-sm btn-link text-muted p-1 extra-small text-decoration-none"
              onClick={() => setSelectedDate(todayStr)}
              title="Return to today's date"
            >
              <FaTimes size={11} className="me-1" /> {t('Today')}
            </button>
          )}

          {/* DOC Presets Dropdown */}
          {availableDates.length > 0 && (
            <div className="position-relative d-none d-md-block">
              <select
                className="form-select form-select-sm minimal-filter-control px-2.5"
                style={{ minWidth: 180 }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                title="Quick jump to Culture Day (DOC)"
              >
                <option value={todayStr}>Today ({todayStr})</option>
                {availableDates.map((item) => {
                  const pondObj = assignedPonds[0];
                  const sDate = item.stockingDate || pondObj?.stocking_date;
                  const doc = computeDoc(sDate, item.date);
                  const isNursery = doc !== null && doc <= 19;
                  const dateFormatted = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const stageBadge = doc ? (isNursery ? `DOC #${doc} Nur` : `DOC #${doc} Grow`) : item.date;
                  return (
                    <option key={item.date} value={item.date}>
                      {dateFormatted} • {stageBadge} ({item.totalKg.toFixed(1)} kg)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Scan Water Quality Action */}
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-1.5 shadow-2xs hover-shadow"
            style={{ fontWeight: 600, color: '#FC563C' }}
            onClick={() => {
              const firstUnverified = waterQualityChecklist.checklist?.find((p) => !p.is_verified_today);
              setOcrTargetPondId(firstUnverified ? String(firstUnverified.pond_id) : (assignedPonds[0]?.id ? String(assignedPonds[0].id) : ''));
              setIsOcrModalOpen(true);
            }}
          >
            <FaCamera size={12} />
            <span>{t('Scan Water Quality')}</span>
          </button>
        </div>
      </div>

      {/* 3. FOUR KPI CARDS (Minimalist, soft shadow backdrops, clean rounded corners) */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: ASSIGNED PONDS */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('ASSIGNED PONDS')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaWater size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {assignedPonds.length}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {selectedPondFilter === 'all' ? t('All ponds active') : (selectedPondObj?.pond_name || t('Active'))}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('Active Fleet')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: TODAY'S LOGS */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t("TODAY'S LOGS")}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaUtensils size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {filteredTodayRecords.length}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium text-truncate" style={{ maxWidth: 140 }}>
                  {currentScope}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('Logged')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: TOTAL FEED TODAY */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('TOTAL FEED TODAY')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FFF5F3', color: '#FC563C' }}>
                  <FaCheckCircle size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {totalAmountToday.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {Math.round(totalGramsToday).toLocaleString()} g • 5 Slots
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FFF5F3', color: '#FC563C', fontWeight: 600 }}>
                  {t('Verified')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: FEEDING SCHEDULE */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('SCHEDULE PROGRESS')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaClock size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {feedingCompletion}%
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium font-mono">
                  {completedFeedingSlots}/5 Slots Logged
                </span>
                <span
                  className="badge rounded-pill px-2.5 py-1 extra-small"
                  style={{
                    backgroundColor: feedingCompletion === 100 ? '#ECFDF5' : '#FFFBEB',
                    color: feedingCompletion === 100 ? '#059669' : '#D97706',
                    fontWeight: 600
                  }}
                >
                  {feedingCompletion === 100 ? t('Complete') : t('In Progress')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CARETAKER OPERATIONS & ACTIVITY CENTER */}
      <div
        className="rounded-4 mb-4 mb-xl-5 overflow-hidden bg-white border"
        style={{
          borderColor: isDark ? '#334155' : '#E2E8F0',
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.04)'
        }}
      >
        {/* Header & Minimalist Tab Switcher Bar */}
        <div
          className="p-3.5 p-md-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 border-bottom"
          style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}
        >
          <div>
            <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
              {t('Field Operations & Daily Tasks')}
            </h5>
            <p className="text-muted mb-0 extra-small" style={{ fontSize: '0.78rem' }}>
              {t('Pre-stock water quality verification, assigned ponds live status, disease scans, and incidents.')}
            </p>
          </div>

          {/* Minimalist Status Filter Tabs matching Admin Dashboard */}
          <div className="d-flex align-items-center gap-1 p-1 rounded-pill bg-light border flex-wrap" style={{ borderColor: '#E2E8F0' }}>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                activeActivityTab === 'waterQuality' ? 'text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
              }`}
              style={activeActivityTab === 'waterQuality' ? { backgroundColor: '#172A39', borderColor: '#172A39' } : undefined}
              onClick={() => setActiveActivityTab('waterQuality')}
            >
              <FaCamera className="me-1" size={10} />
              {t('Water Quality')} ({waterQualityChecklist.verified_count}/{assignedPonds.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                activeActivityTab === 'ponds' ? 'text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
              }`}
              style={activeActivityTab === 'ponds' ? { backgroundColor: '#172A39', borderColor: '#172A39' } : undefined}
              onClick={() => setActiveActivityTab('ponds')}
            >
              <FaWater className="me-1" size={10} />
              {t('Ponds Live')} ({assignedPonds.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                activeActivityTab === 'disease' ? 'text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
              }`}
              style={activeActivityTab === 'disease' ? { backgroundColor: '#172A39', borderColor: '#172A39' } : undefined}
              onClick={() => setActiveActivityTab('disease')}
            >
              <FaStethoscope className="me-1" size={10} />
              {t('Health Scans')} ({filteredDiseaseScans.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                activeActivityTab === 'alerts' ? 'text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
              }`}
              style={activeActivityTab === 'alerts' ? { backgroundColor: '#172A39', borderColor: '#172A39' } : undefined}
              onClick={() => setActiveActivityTab('alerts')}
            >
              <FaExclamationTriangle className="me-1" size={10} />
              {t('Alerts')} ({alerts.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Water Quality Protocol Verification */}
        {activeActivityTab === 'waterQuality' && (
          <div>
            <div
              className="p-3.5 p-md-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 border-bottom"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E2E8F0'
              }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                  style={{
                    width: 38,
                    height: 38,
                    background: waterQualityChecklist.is_all_completed ? '#DCFCE7' : 'rgba(252, 86, 60, 0.1)',
                    color: waterQualityChecklist.is_all_completed ? '#16A34A' : '#FC563C',
                    fontSize: '1rem',
                  }}
                >
                  {waterQualityChecklist.is_all_completed ? <FaCheckCircle /> : <FaCamera />}
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2.5 flex-wrap">
                    <h6 className="fw-bold mb-0" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F', fontSize: '1rem' }}>
                      Water Quality Check (Before Adding Shrimp)
                    </h6>
                    <span
                      className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.14)' : (waterQualityChecklist.is_all_completed ? '#F0FDF4' : '#FFF5F2'),
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.25)' : (waterQualityChecklist.is_all_completed ? '1.5px solid #86EFAC' : '1.5px solid #FECDD3'),
                        color: isDark ? '#FFFFFF' : (waterQualityChecklist.is_all_completed ? '#16A34A' : '#E11D48'),
                        fontSize: '0.74rem',
                        fontWeight: 700,
                      }}
                    >
                      <span
                        className="rounded-circle"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: waterQualityChecklist.is_all_completed ? '#16A34A' : '#FC563C',
                        }}
                      />
                      {waterQualityChecklist.verified_count} / {assignedPonds.length} Ponds Checked (Initial)
                    </span>
                  </div>
                  <p className="extra-small mb-0 mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#64748B', maxWidth: 640 }}>
                    {waterQualityChecklist.is_all_completed
                      ? 'All assigned ponds have verified water readings on record. Daily monitoring and feeding logs are active.'
                      : 'O&B Aqua Farm Guide: Check DO, Temp, pH, and Salinity once with your meter or paper test before stocking shrimp.'}
                  </p>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 ms-md-auto flex-shrink-0">
                <button
                  type="button"
                  className="btn btn-sm btn-tri-orange px-3.5 py-2 shadow-xs fw-bold"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => {
                    const firstUnverified = waterQualityChecklist.checklist?.find((p) => !p.is_verified_today);
                    setOcrTargetPondId(
                      firstUnverified
                        ? String(firstUnverified.pond_id)
                        : assignedPonds[0]?.id
                          ? String(assignedPonds[0].id)
                          : ''
                    );
                    setIsOcrModalOpen(true);
                  }}
                >
                  <FaCamera size={13} /> Scan Water Quality
                </button>
              </div>
            </div>

            {/* Assigned Ponds Checklist Strip */}
            <div className="p-3.5 p-md-4 caretaker-prestock-strip">
              <div className="row g-3 g-xl-3.5">
                {assignedPonds.map((pond) => {
                  const checkItem = waterQualityChecklist.checklist?.find((c) => c.pond_id === pond.id);
                  const isVerified = Boolean(checkItem?.is_verified_today);
                  const readings = checkItem?.latest_readings;

                  return (
                    <div key={pond.id} className="col-12 col-md-6 col-lg-4">
                      <div
                        className="p-3.5 rounded-3 d-flex flex-column justify-content-between h-100 transition-all hover-shadow bg-white"
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                          borderLeft: isVerified ? '4px solid #10B981' : '4px solid #FC563C',
                          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
                          minHeight: 220,
                        }}
                      >
                        <div>
                          {/* Tier 1: Pond Name & Status Badge */}
                          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                            <div className="d-flex align-items-center gap-2.5">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: 34,
                                  height: 34,
                                  backgroundColor: isVerified ? '#ECFDF5' : '#FFF5F3',
                                  color: isVerified ? '#059669' : '#FC563C',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <FaWater />
                              </div>
                              <div>
                                <strong className="d-block text-dark fw-bold" style={{ fontSize: '1rem', lineHeight: 1.2 }}>
                                  {pond.pond_name}
                                </strong>
                                <span className="text-muted extra-small">Pond</span>
                              </div>
                            </div>

                            {/* Status badge */}
                            {isVerified ? (
                              <span
                                className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                                style={{
                                  backgroundColor: '#ECFDF5',
                                  border: '1px solid #A7F3D0',
                                  color: '#059669',
                                  fontSize: '0.72rem',
                                }}
                              >
                                <FaCheckCircle size={10} className="me-1" />
                                {t('Verified')}
                              </span>
                            ) : (
                              <span
                                className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                                style={{
                                  backgroundColor: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  color: '#DC2626',
                                  fontSize: '0.72rem',
                                }}
                              >
                                {t('Needs Test')}
                              </span>
                            )}
                          </div>

                          {/* Tier 2: Culture Stage / DOC Pill */}
                          {pond.stocking_date && (() => {
                            const doc = computeDoc(pond.stocking_date, selectedDate);
                            if (!doc) return null;
                            const isNursery = doc >= 1 && doc <= 19;
                            return (
                              <div className="mb-3">
                                <span
                                  className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                                  style={{
                                    backgroundColor: isNursery ? '#ECFDF5' : '#EFF6FF',
                                    color: isNursery ? '#047857' : '#1D4ED8',
                                    border: isNursery ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {isNursery ? `DOC #${doc} Nursery` : `DOC #${doc} Grow-out`}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Tier 3: Telemetry Cluster Strip */}
                          <div
                            className="p-2.5 rounded-3 mb-3"
                            style={{
                              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                              border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                            }}
                          >
                            {isVerified ? (
                              <div className="d-flex align-items-center justify-content-between text-center px-1">
                                <div>
                                  <span className="extra-small d-block fw-bold text-muted text-uppercase" style={{ fontSize: '0.66rem' }}>DO</span>
                                  <strong className="text-dark" style={{ fontSize: '0.92rem' }}>{readings?.dissolved_oxygen ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.62rem' }}> mg/L</small>
                                </div>
                                <div style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-muted text-uppercase" style={{ fontSize: '0.66rem' }}>Temp</span>
                                  <strong className="text-dark" style={{ fontSize: '0.92rem' }}>{readings?.temperature ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.62rem' }}> °C</small>
                                </div>
                                <div style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-muted text-uppercase" style={{ fontSize: '0.66rem' }}>pH</span>
                                  <strong className="text-dark" style={{ fontSize: '0.92rem' }}>{readings?.ph_level ?? '—'}</strong>
                                </div>
                                <div style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-muted text-uppercase" style={{ fontSize: '0.66rem' }}>Salinity</span>
                                  <strong className="text-dark" style={{ fontSize: '0.92rem' }}>{readings?.salinity ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.62rem' }}> ppt</small>
                                </div>
                              </div>
                            ) : (
                              <div className="d-flex align-items-center gap-2 extra-small py-0.5 px-1">
                                <FaLock size={11} className="text-danger flex-shrink-0" />
                                <span className="text-danger fw-bold" style={{ fontSize: '0.76rem' }}>
                                  {t('Initial water test required before adding shrimp')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tier 4: Action Buttons Footer */}
                        <div className="d-flex align-items-center justify-content-between gap-2 pt-2.5 mt-auto border-top" style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-understated-view px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5"
                            onClick={() => {
                              setHistoryTargetPond(pond);
                              setIsHistoryModalOpen(true);
                            }}
                            title="View Water Quality Log History"
                          >
                            <FaHistory size={11} className="text-secondary" />
                            <span>{t('History')}</span>
                          </button>

                          {!isVerified ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-understated-feed px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5"
                              onClick={() => {
                                setEditingWqRecord(null);
                                setOcrTargetPondId(String(pond.id));
                                setOcrTargetDate(todayStr);
                                setIsOcrModalOpen(true);
                              }}
                            >
                              <FaCamera size={11} />
                              <span>{t('Scan Readings')}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-understated-view px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5"
                              onClick={() => {
                                setEditingWqRecord(checkItem?.today_record || null);
                                setOcrTargetPondId(String(pond.id));
                                setOcrTargetDate(todayStr);
                                setIsOcrModalOpen(true);
                              }}
                              title="Re-scan / Update Today's Readings"
                            >
                              <FaSync size={11} />
                              <span>{t('Re-test (OCR)')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Assigned Ponds Live Overview & Quick Actions */}
        {activeActivityTab === 'ponds' && (
          <div className="p-3.5 p-md-4">
            <div className="d-flex align-items-center justify-content-between mb-3.5 flex-wrap gap-2">
              <div>
                <h6 className="fw-bold mb-0 tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F', fontSize: '1.05rem' }}>
                  Assigned Ponds Live Overview &amp; Quick Actions
                </h6>
                <small className="text-muted">Instant pond status monitoring, today's feeding logs, and one-touch caretaker actions</small>
              </div>
              <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                {assignedPonds.length} Active Ponds
              </span>
            </div>

            <div className="row g-3 g-xl-3.5">
              {assignedPonds.map((pond) => {
                const pondLogs = todayRecords.filter((r) => String(r.pond_id) === String(pond.id));
                const pondSlots = new Set(pondLogs.map((r) => normalizeFeedingTime(r.feeding_time)).filter(Boolean));
                const pondCompletedCount = feedingTimes.filter((time) => pondSlots.has(normalizeFeedingTime(time))).length;
                const pondPct = Math.round((pondCompletedCount / feedingTimes.length) * 100);

                return (
                  <div key={pond.id} className="col-12 col-md-6 col-xl-4">
                    <div className="compact-pond-card">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center gap-2.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 36, height: 36, backgroundColor: '#F1F5F9', color: '#172A39' }}
                            >
                              <FaWater size={15} />
                            </div>
                            <div>
                              <strong className="d-block text-dark fw-bold" style={{ fontSize: '1rem', lineHeight: 1.2 }}>{pond.pond_name}</strong>
                              <div className="d-flex align-items-center gap-1.5 flex-wrap extra-small text-muted">
                                <span>Pond</span>
                                {pond.stocking_date && (() => {
                                  const doc = computeDoc(pond.stocking_date, selectedDate);
                                  return doc ? <span>• <strong className="text-dark">DOC #{doc}</strong></span> : null;
                                })()}
                              </div>
                            </div>
                          </div>
                          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                            ● {t('Healthy')}
                          </span>
                        </div>

                        {/* Today's Feeding Progress */}
                        <div className="my-2 py-1">
                          <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-1.5">
                            <span className="fw-semibold">Today's Feeding Progress</span>
                            <span className="fw-bold font-mono text-dark">{pondCompletedCount}/5 ({pondPct}%)</span>
                          </div>
                          <div className="progress rounded-pill mb-3" style={{ height: 6, backgroundColor: '#E2E8F0' }}>
                            <div
                              className="progress-bar rounded-pill"
                              role="progressbar"
                              style={{
                                width: `${pondPct}%`,
                                backgroundColor: '#172A39',
                              }}
                            />
                          </div>

                          {/* Embedded Today's Feeding Records */}
                          <div
                            className="p-2.5 rounded-3"
                            style={{
                              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                              border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="extra-small fw-bold text-uppercase text-muted" style={{ fontSize: '0.68rem', letterSpacing: '0.03em' }}>
                                Today's Logged Feeds ({pondLogs.length})
                              </span>
                              {pondLogs.length > 0 && (
                                <span className="extra-small font-mono fw-bold text-dark">
                                  Total: {(pondLogs.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0)).toFixed(2)} kg
                                </span>
                              )}
                            </div>

                            {pondLogs.length > 0 ? (
                              <div className="d-flex flex-column gap-1.5" style={{ maxHeight: 155, overflowY: 'auto' }}>
                                {pondLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className="d-flex align-items-center justify-content-between p-2 rounded-2 bg-white"
                                    style={{
                                      border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                                      fontSize: '0.74rem',
                                    }}
                                  >
                                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                      <span
                                        className="badge rounded-pill px-2 py-0.5 extra-small fw-bold"
                                        style={{ backgroundColor: '#FFF5F3', border: '1px solid rgba(252, 86, 60, 0.25)', color: '#FC563C', fontSize: '0.68rem' }}
                                      >
                                        {log.feeding_time || 'Slot'}
                                      </span>
                                      <strong style={{ color: '#0F172A' }}>
                                        {parseFloat(log.amount_kg) > 0 ? `${parseFloat(log.amount_kg).toFixed(2)} kg` : '0 kg'}
                                      </strong>
                                      <span className="text-muted extra-small">({log.feed_type || log.product_code || 'Tateh'})</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1.5">
                                      {log.vitamin_name && log.vitamin_name !== 'None' && (
                                        <span className="badge rounded-pill px-1.5 py-0.5 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.65rem' }}>
                                          {log.vitamin_name}
                                        </span>
                                      )}
                                      <span className="text-muted extra-small font-mono">
                                        {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-2 text-muted extra-small">
                                No feeds logged for this pond today.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Guaranteed 3-Column Single-Row Buttons (50% / 25% / 25%) */}
                      <div className="row g-2 mt-3 pt-3 border-top" style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}>
                        <div className="col-6">
                          <button
                            type="button"
                            className="btn btn-sm btn-understated-feed w-100 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1.5"
                            onClick={() => navigate('/caretaker/my-pond')}
                          >
                            <FaPlus size={10} /> {t('Log Feed')}
                          </button>
                        </div>
                        <div className="col-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-understated-view w-100 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1"
                            onClick={() => navigate('/caretaker/disease-scan')}
                            title="Disease Scan"
                          >
                            <FaStethoscope size={10} /> {t('Scan')}
                          </button>
                        </div>
                        <div className="col-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-understated-view w-100 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1"
                            onClick={() => navigate('/caretaker/reports')}
                            title="Report Pond Concern"
                          >
                            <FaExclamationTriangle size={10} className="text-danger" /> {t('Report')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Disease Scan Telemetry */}
        {activeActivityTab === 'disease' && (
          <div className="p-3.5 p-md-4">
            <div className="d-flex align-items-center justify-content-between mb-3.5 gap-2 flex-wrap">
              <div>
                <h6 className="fw-bold mb-0 tracking-tight text-dark" style={{ fontSize: '1.05rem' }}>{t('Shrimp Health & Disease Scans')}</h6>
                <small className="text-muted">{t('Recent AI health diagnostics submitted for assigned ponds.')}</small>
              </div>

              <div className="d-flex align-items-center gap-2 ms-auto">
                <select
                  className="form-select form-select-sm minimal-filter-control px-2.5"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={selectedDiseasePondFilter}
                  onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                >
                  <option value="all">{t('All Assigned Ponds')}</option>
                  {assignedPonds.map((pond) => (
                    <option key={pond.id} value={pond.pond_name}>
                      {pond.pond_name}
                    </option>
                  ))}
                </select>
                <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {filteredDiseaseScans.length} Scans
                </span>
              </div>
            </div>

            {latestDisease ? (
              <div className="d-flex align-items-center p-3 rounded-3 bg-white mb-3" style={{ minHeight: 90, border: isDark ? '1px solid #334155' : '1px solid #E2E8F0' }}>
                {latestDisease.image_path && (
                  <img
                    src={resolveImageUrl(latestDisease.image_path)}
                    alt="Latest disease scan"
                    className="rounded-3 me-3 flex-shrink-0"
                    style={{ width: 60, height: 60, objectFit: 'cover', border: isDark ? '1px solid #334155' : '1px solid #E2E8F0' }}
                  />
                )}
                <div>
                  <div className="fw-bold mb-1 text-dark fs-6">{latestDisease.disease_name}</div>
                  <div className="d-flex align-items-center gap-2 flex-wrap extra-small text-muted">
                    <span>Risk:</span>
                    <span className="badge rounded-pill" style={{ backgroundColor: latestDisease.risk_level === 'High' ? '#DC2626' : '#10B981', color: '#FFFFFF' }}>
                      {latestDisease.risk_level || 'Safe'}
                    </span>
                    <span>•</span>
                    <span>Confidence: <strong className="text-dark">{latestDisease.confidence_score}%</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 rounded-3 bg-white text-muted small mb-3" style={{ border: isDark ? '1px solid #334155' : '1px solid #E2E8F0' }}>
                <FaStethoscope size={22} className="mb-2 opacity-40 text-secondary" />
                <p className="mb-0 fw-semibold text-dark">{t('No disease scans recorded yet')}</p>
                <small className="extra-small text-muted">{t('All scans look healthy and normal.')}</small>
              </div>
            )}

            <div className="pt-2 border-top d-flex justify-content-end" style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}>
              <button
                type="button"
                className="btn btn-sm btn-understated-feed px-3.5 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5"
                onClick={() => navigate('/caretaker/disease-scan')}
              >
                <span>{t('Scan Shrimp Health')}</span> <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: System Incident Alerts */}
        {activeActivityTab === 'alerts' && (
          <div className="p-3.5 p-md-4">
            <div className="d-flex align-items-center justify-content-between mb-3.5 gap-2">
              <div>
                <h6 className="fw-bold mb-0 tracking-tight text-dark" style={{ fontSize: '1.05rem' }}>{t('System Incident Alerts')}</h6>
                <small className="text-muted">{t('Live incidents and biosecurity warnings for assigned ponds.')}</small>
              </div>
              <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: alerts.length > 0 ? '#FEF2F2' : '#F1F5F9', color: alerts.length > 0 ? '#DC2626' : '#475569', border: alerts.length > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0', fontWeight: 600 }}>
                {alerts.length} Active
              </span>
            </div>

            {latestAlert ? (
              <div className="d-flex flex-column justify-content-center p-3 rounded-3 bg-white mb-3" style={{ minHeight: 90, border: '1px solid #FECACA' }}>
                <div className="fw-bold d-flex align-items-center gap-2 mb-1 text-danger fs-6">
                  <FaExclamationTriangle size={13} /> {latestAlert.title}
                </div>
                <small className="text-muted" style={{ lineHeight: 1.45 }}>{latestAlert.message}</small>
              </div>
            ) : (
              <div className="text-center py-4 rounded-3 bg-white text-muted small mb-3" style={{ border: isDark ? '1px solid #334155' : '1px solid #E2E8F0' }}>
                <FaShieldAlt size={22} className="mb-2 opacity-40 text-secondary" />
                <p className="mb-0 fw-semibold text-dark">{t('No active alerts for your ponds')}</p>
                <small className="extra-small text-muted">{t('All ponds and water readings are in safe range.')}</small>
              </div>
            )}

            <div className="pt-2 border-top d-flex justify-content-end" style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}>
              <button
                type="button"
                className="btn btn-sm btn-understated-view px-3.5 py-1.5 extra-small fw-bold text-danger d-inline-flex align-items-center gap-1.5"
                onClick={() => navigate('/caretaker/reports')}
              >
                <span>{t('Submit Incident Report')}</span> <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}
      </div>


      {/* DUAL-MODE OCR WATER QUALITY MODAL */}
      <WaterQualityOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => {
          setIsOcrModalOpen(false);
          setEditingWqRecord(null);
        }}
        assignedPonds={assignedPonds}
        initialPondId={ocrTargetPondId || (assignedPonds[0]?.id ? String(assignedPonds[0].id) : '')}
        initialDate={ocrTargetDate || todayStr}
        initialRecord={editingWqRecord}
        caretakerName={user?.full_name || 'Caretaker'}
        caretakerId={user?.id}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* WATER QUALITY LOG HISTORY & BACKFILL MODAL */}
      <WaterQualityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryTargetPond(null);
        }}
        pond={historyTargetPond}
        canEdit={true}
        onEditRecord={(record) => {
          setEditingWqRecord(record);
          setOcrTargetPondId(String(record.pond_id));
          setOcrTargetDate(record.record_date);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
        onAddRecord={(date) => {
          setEditingWqRecord(null);
          if (historyTargetPond) setOcrTargetPondId(String(historyTargetPond.id));
          setOcrTargetDate(date || todayStr);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
      />
    </div>
  );
}
