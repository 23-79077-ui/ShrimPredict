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
      {/* 1. EXECUTIVE HERO OPERATIONS BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="hero-icon-badge shadow-xs">
            <FaWater />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                {t('hero.caretakerDashboard', 'Daily Farm Dashboard')}
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)' }}
              >
                {t('hero.caretakerDashboardBadge', '● Live Pond Updates')}
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              {t('hero.caretakerDashboardSub', 'O&B Aquafarm • Daily Pond Overview, Feeding Logs & Water Quality Checks')}
            </p>
          </div>
        </div>

        {/* Compact Pill-Shaped Filter Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Pond Selector Pill */}
          <div
            className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-xs"
            style={{ border: '1px solid rgba(252, 86, 60, 0.15)', height: 38 }}
          >
            <FaWater style={{ color: '#FC563C', fontSize: '0.82rem' }} />
            <select
              className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 cursor-pointer"
              style={{ width: 'auto', minWidth: 155, fontSize: '0.82rem', outline: 'none', color: '#FC563C' }}
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

          {/* Interactive Date Selector Pill */}
          <div
            className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-white shadow-xs"
            style={{ border: '1px solid rgba(252, 86, 60, 0.15)', height: 38 }}
          >
            <FaCalendarAlt size={12} style={{ color: '#FC563C' }} />
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-transparent fw-semibold p-0"
              style={{ width: 115, fontSize: '0.82rem', outline: 'none', color: '#FC563C' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Select date to inspect feeding records & DOC"
            />
          </div>

          {/* Quick Return to Today Button */}
          {selectedDate !== todayStr && (
            <button
              type="button"
              className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs"
              style={{ height: 38, fontSize: '0.8rem' }}
              onClick={() => setSelectedDate(todayStr)}
              title="Return to today's real date"
            >
              {t('Reset to Today')}
            </button>
          )}

          {/* DOC Presets Quick Jump Dropdown */}
          {availableDates.length > 0 && (
            <div
              className="d-none d-md-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(252, 86, 60, 0.15)', height: 38 }}
            >
              <span className="extra-small fw-bold text-uppercase tracking-wider" style={{ color: '#FC563C', fontSize: '0.68rem' }}>DOC:</span>
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 cursor-pointer"
                style={{ width: 'auto', minWidth: 150, fontSize: '0.8rem', outline: 'none', color: '#FC563C' }}
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

          {/* Sync Button */}
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs"
            style={{ height: 38, fontSize: '0.8rem' }}
            onClick={loadData}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} style={{ color: '#FC563C' }} /> {t('Sync')}
          </button>
        </div>
      </div>

      {/* OPERATIONAL TELEMETRY & PERFORMANCE BOX (Dedicated Box Above Caretaker Activities) */}
      <div className="tri-card p-4 p-md-4.5 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3.5 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2.5">
            <span
              className="badge rounded-pill px-3 py-1.5 fw-bold text-white extra-small shadow-xs"
              style={{ background: '#FC563C', letterSpacing: '0.06em' }}
            >
              OPERATIONS
            </span>
            <div>
              <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
                Today's Farm Overview
              </h5>
              <span className="text-muted extra-small">Daily farm tasks, feeding progress, and water readings summary</span>
            </div>
          </div>
          <span className="badge bg-white rounded-pill px-3 py-1.5 extra-small shadow-xs" style={{ color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
            ● Daily Farm Status
          </span>
        </div>

        <div className="row g-3 g-xl-4">
          {/* Card 1: Assigned Ponds */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Ponds</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaWater size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {assignedPonds.length}
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div className="tri-progress-bar" style={{ width: '100%', background: '#FC563C' }} />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small text-truncate" style={{ maxWidth: 130 }}>
                    {selectedPondFilter === 'all' ? 'All ponds active' : `Focused: ${selectedPondObj?.pond_name || 'Active'}`}
                  </span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Feeding Logs */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Today's Logs</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaUtensils size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {filteredTodayRecords.length}
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.min(100, Math.max(10, (filteredTodayRecords.length / Math.max(1, assignedPonds.length * 4)) * 100))}%`,
                      background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                    {currentScope}
                  </span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                    Logged
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Total Feed */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185, borderColor: 'rgba(252, 86, 60, 0.15)' }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">
                    Total Feed ({selectedDate === todayStr ? 'Today' : selectedDate})
                  </span>
                  <div className="tri-kpi-icon tri-kpi-icon-orange">
                    <FaCheckCircle size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {totalAmountToday.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
                </h2>
                <div className="extra-small text-muted fw-semibold">
                  Total grams: <strong className="font-mono" style={{ color: '#FC563C' }}>{Math.round(totalGramsToday).toLocaleString()} g</strong>
                </div>
              </div>
              <div>
                <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.1)' }}>
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.min(100, Math.max(12, (totalAmountToday / Math.max(1, assignedPonds.length * 35)) * 100))}%`,
                      background: 'linear-gradient(90deg, #FC563C 0%, #6E7575 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small">Distributed across 5 slots</span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: isDark ? 'rgba(252, 86, 60, 0.18)' : '#FFF5F2', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.25)' }}>
                    5 Feedings
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Feeding Schedule Progress */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feeding Schedule</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaClock size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {feedingCompletion}%
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.max(5, feedingCompletion)}%`,
                      background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small font-mono fw-semibold">{completedFeedingSlots}/5 Slots Logged</span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                    {feedingCompletion === 100 ? 'Complete' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARETAKER OPERATIONS & ACTIVITY CENTER (GRAND BOX WITH TOGGLEABLE SECTIONS) */}
      <div className="tri-card mb-4 mb-xl-5 overflow-hidden">
        {/* Grand Header & Tab Switcher Bar */}
        <div
          className="p-3.5 p-md-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3"
          style={{
            background: isDark ? 'linear-gradient(135deg, #172A39 0%, #203A4F 100%)' : '#FFFFFF',
            borderBottom: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '2px solid #E2E8F0',
            color: isDark ? '#FFFFFF' : '#0F172A'
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
              style={{
                width: 44,
                height: 44,
                background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(252, 86, 60, 0.1)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.22)' : '1.5px solid rgba(252, 86, 60, 0.25)',
                color: '#FC563C',
                fontSize: '1.2rem',
              }}
            >
              <FaTasks />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2.5 flex-wrap">
                <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F', fontSize: '1.15rem' }}>
                  {t('Caretaker Field Operations & Activity Center')}
                </h5>
                <span
                  className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(252, 86, 60, 0.08)',
                    color: isDark ? '#FFFFFF' : '#FC563C',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(252, 86, 60, 0.16)'
                  }}
                >
                  Daily Farm Activities &amp; Tasks
                </span>
              </div>
              <p className="extra-small mb-0 mt-0.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : '#64748B' }}>
                Check water quality before stocking, track daily pond feeding, view shrimp health scans, and see alerts.
              </p>
            </div>
          </div>

          {/* Toggleable Tabs Segmented Control */}
          <div className="d-flex align-items-center gap-2 flex-wrap ms-lg-auto">
            <button
              type="button"
              className={`btn btn-sm ${activeActivityTab === 'waterQuality' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline'} d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold`}
              style={{ fontSize: '0.82rem', transition: 'all 0.2s ease' }}
              onClick={() => setActiveActivityTab('waterQuality')}
            >
              <FaCamera size={12} />
              <span>Scan Water Quality</span>
              <span
                className="badge rounded-pill ms-1"
                style={{
                  backgroundColor: activeActivityTab === 'waterQuality' ? 'rgba(255,255,255,0.28)' : 'rgba(252, 86, 60, 0.12)',
                  color: activeActivityTab === 'waterQuality' ? '#FFFFFF' : '#FC563C',
                  fontSize: '0.7rem'
                }}
              >
                {waterQualityChecklist.verified_count}/{assignedPonds.length}
              </span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeActivityTab === 'ponds' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline'} d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold`}
              style={{ fontSize: '0.82rem', transition: 'all 0.2s ease' }}
              onClick={() => setActiveActivityTab('ponds')}
            >
              <FaWater size={12} />
              <span>Assigned Ponds Live Overview</span>
              <span
                className="badge rounded-pill ms-1"
                style={{
                  backgroundColor: activeActivityTab === 'ponds' ? 'rgba(255,255,255,0.28)' : 'rgba(252, 86, 60, 0.12)',
                  color: activeActivityTab === 'ponds' ? '#FFFFFF' : '#FC563C',
                  fontSize: '0.7rem'
                }}
              >
                {assignedPonds.length}
              </span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeActivityTab === 'disease' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline'} d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold`}
              style={{ fontSize: '0.82rem', transition: 'all 0.2s ease' }}
              onClick={() => setActiveActivityTab('disease')}
            >
              <FaStethoscope size={12} />
              <span>Shrimp Health &amp; Scans</span>
              <span
                className="badge rounded-pill ms-1"
                style={{
                  backgroundColor: activeActivityTab === 'disease' ? 'rgba(255,255,255,0.28)' : 'rgba(252, 86, 60, 0.12)',
                  color: activeActivityTab === 'disease' ? '#FFFFFF' : '#FC563C',
                  fontSize: '0.7rem'
                }}
              >
                {filteredDiseaseScans.length}
              </span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeActivityTab === 'alerts' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline'} d-inline-flex align-items-center gap-2 px-3 py-2 fw-bold`}
              style={{ fontSize: '0.82rem', transition: 'all 0.2s ease' }}
              onClick={() => setActiveActivityTab('alerts')}
            >
              <FaExclamationTriangle size={12} />
              <span>System Incident Alerts</span>
              <span
                className="badge rounded-pill ms-1"
                style={{
                  backgroundColor: activeActivityTab === 'alerts' ? 'rgba(255,255,255,0.28)' : (alerts.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.1)'),
                  color: activeActivityTab === 'alerts' ? '#FFFFFF' : (alerts.length > 0 ? '#EF4444' : '#64748B'),
                  fontSize: '0.7rem'
                }}
              >
                {alerts.length}
              </span>
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
                        className="p-4 rounded-4 caretaker-prestock-pond-card d-flex flex-column justify-content-between h-100 transition-all hover-shadow"
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1',
                          borderLeft: isVerified ? '4px solid #16A34A' : '4px solid #FC563C',
                          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
                          minHeight: 225,
                          overflow: 'hidden',
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
                                  backgroundColor: isVerified ? (isDark ? 'rgba(22, 163, 74, 0.2)' : '#DCFCE7') : (isDark ? 'rgba(252, 86, 60, 0.15)' : '#FFF5F2'),
                                  color: isVerified ? '#16A34A' : '#FC563C',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <FaWater />
                              </div>
                              <div>
                                <strong className="d-block" style={{ color: isDark ? '#F1F5F9' : '#0B2C5F', fontSize: '1rem', lineHeight: 1.2 }}>
                                  {pond.pond_name}
                                </strong>
                                <span className="text-muted extra-small">Pond</span>
                              </div>
                            </div>

                            {/* Status badge */}
                            {isVerified ? (
                              <span
                                className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                                style={{
                                  backgroundColor: isDark ? 'rgba(22, 163, 74, 0.18)' : '#DCFCE7',
                                  border: '1.5px solid #86EFAC',
                                  color: '#15803D',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <FaCheckCircle size={11} style={{ color: '#16A34A' }} />
                                <span>Verified</span>
                              </span>
                            ) : (
                              <span
                                className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                                style={{
                                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
                                  border: '1.5px solid #FCA5A5',
                                  color: '#B91C1C',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span
                                  className="rounded-circle"
                                  style={{ width: 6, height: 6, backgroundColor: '#EF4444' }}
                                />
                                <span>Needs Test</span>
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
                                  className="badge rounded-pill px-3 py-1.5 extra-small fw-bold"
                                  style={{
                                    backgroundColor: isNursery ? '#ECFDF5' : '#EFF6FF',
                                    color: isNursery ? '#047857' : '#1D4ED8',
                                    border: isNursery ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {isNursery ? `Day ${doc} Nursery (DOC #${doc})` : `Day ${doc} Grow-out (DOC #${doc})`}
                                </span>
                              </div>
                            );
                          })()}

                          {/* Tier 3: Telemetry Cluster Strip */}
                          <div
                            className={`p-3 rounded-3 mb-3.5 caretaker-telemetry-cluster ${isVerified ? 'verified' : 'unverified'}`}
                            style={{
                              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                              border: isVerified
                                ? (isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1')
                                : (isDark ? '1px dashed rgba(252, 86, 60, 0.35)' : '1.5px dashed #FDA4AF'),
                            }}
                          >
                            {isVerified ? (
                              <div className="d-flex align-items-center justify-content-between text-center px-1">
                                <div>
                                  <span className="extra-small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: isDark ? '#94A3B8' : '#475569' }}>DO</span>
                                  <strong style={{ color: '#0B2C5F', fontSize: '0.96rem' }}>{readings?.dissolved_oxygen ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.64rem' }}> mg/L</small>
                                </div>
                                <div style={{ width: 1, height: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: isDark ? '#94A3B8' : '#475569' }}>Temp</span>
                                  <strong style={{ color: '#0B2C5F', fontSize: '0.96rem' }}>{readings?.temperature ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.64rem' }}> °C</small>
                                </div>
                                <div style={{ width: 1, height: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: isDark ? '#94A3B8' : '#475569' }}>pH</span>
                                  <strong style={{ color: '#0B2C5F', fontSize: '0.96rem' }}>{readings?.ph_level ?? '—'}</strong>
                                </div>
                                <div style={{ width: 1, height: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1' }} />
                                <div>
                                  <span className="extra-small d-block fw-bold text-uppercase" style={{ fontSize: '0.68rem', color: isDark ? '#94A3B8' : '#475569' }}>Salinity</span>
                                  <strong style={{ color: '#0B2C5F', fontSize: '0.96rem' }}>{readings?.salinity ?? '—'}</strong>
                                  <small className="text-muted" style={{ fontSize: '0.64rem' }}> ppt</small>
                                </div>
                              </div>
                            ) : (
                              <div className="d-flex align-items-center gap-2 extra-small py-0.5 px-1">
                                <FaLock size={12} style={{ color: '#EF4444', flexShrink: 0 }} />
                                <span style={{ color: '#B91C1C', fontWeight: 700, fontSize: '0.78rem' }}>
                                  Water test scan needed before adding shrimp
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tier 4: Action Buttons Footer */}
                        <div className="d-flex align-items-center justify-content-between gap-2 pt-3 mt-1 border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-3 py-1.5 extra-small fw-bold shadow-xs d-inline-flex align-items-center gap-1.5"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => {
                              setHistoryTargetPond(pond);
                              setIsHistoryModalOpen(true);
                            }}
                            title="View Water Quality Log History and past date records"
                          >
                            <FaHistory size={11} style={{ color: '#FC563C' }} />
                            <span>History</span>
                          </button>

                          {!isVerified ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-tri-orange px-3.5 py-1.5 extra-small fw-bold shadow-xs d-inline-flex align-items-center gap-1.5"
                              style={{ fontSize: '0.78rem' }}
                              onClick={() => {
                                setEditingWqRecord(null);
                                setOcrTargetPondId(String(pond.id));
                                setOcrTargetDate(todayStr);
                                setIsOcrModalOpen(true);
                              }}
                            >
                              <FaCamera size={12} />
                              <span>Scan Readings</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-tri-navy px-3.5 py-1.5 extra-small fw-bold shadow-xs d-inline-flex align-items-center gap-1.5"
                              style={{ fontSize: '0.78rem' }}
                              onClick={() => {
                                setEditingWqRecord(checkItem?.today_record || null);
                                setOcrTargetPondId(String(pond.id));
                                setOcrTargetDate(todayStr);
                                setIsOcrModalOpen(true);
                              }}
                              title="Re-scan / Update Today's Readings"
                            >
                              <FaSync size={11} />
                              <span>Re-test (OCR)</span>
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
                    <div
                      className="card shadow-xs rounded-4 p-3.5 p-md-4 h-100 d-flex flex-column justify-content-between transition-all hover-shadow overflow-hidden bg-white"
                      style={{ border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1' }}
                    >
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center gap-2.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 38, height: 38, background: 'rgba(252, 86, 60, 0.06)', color: '#FC563C' }}
                            >
                              <FaWater size={16} />
                            </div>
                            <div>
                              <h6 className="fw-bold mb-0 fs-6" style={{ color: '#FC563C' }}>{pond.pond_name}</h6>
                              <div className="d-flex align-items-center gap-1.5 flex-wrap extra-small text-muted">
                                <span>Pond</span>
                                {pond.stocking_date && (() => {
                                  const doc = computeDoc(pond.stocking_date, selectedDate);
                                  return doc ? <span>• <strong style={{ color: '#FC563C' }}>DOC #{doc}</strong></span> : null;
                                })()}
                              </div>
                            </div>
                          </div>
                          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.14)' }}>
                            ● Healthy / Normal
                          </span>
                        </div>

                        {/* Today's Feeding Progress */}
                        <div className="my-2 py-1">
                          <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-1.5">
                            <span className="fw-semibold">Today's Feeding Progress</span>
                            <span className="fw-bold font-mono" style={{ color: '#FC563C' }}>{pondCompletedCount}/5 ({pondPct}%)</span>
                          </div>
                          <div className="progress rounded-pill mb-3" style={{ height: 7, backgroundColor: 'rgba(252, 86, 60, 0.06)' }}>
                            <div
                              className="progress-bar rounded-pill"
                              role="progressbar"
                              style={{
                                width: `${pondPct}%`,
                                background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)',
                              }}
                            />
                          </div>

                          {/* Embedded Today's Feeding Records */}
                          <div
                            className="p-2.5 rounded-3"
                            style={{
                              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                              border: isDark ? '1px solid rgba(56, 189, 248, 0.15)' : '1px solid #E2E8F0',
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="extra-small fw-bold text-uppercase" style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: '0.68rem', letterSpacing: '0.03em' }}>
                                Today's Logged Feeds ({pondLogs.length})
                              </span>
                              {pondLogs.length > 0 && (
                                <span className="extra-small font-mono fw-bold" style={{ color: '#FC563C' }}>
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
                                      border: '1px solid #E2E8F0',
                                      fontSize: '0.74rem',
                                    }}
                                  >
                                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                      <span
                                        className="badge rounded-pill px-2 py-0.5 extra-small fw-bold"
                                        style={{ backgroundColor: '#FFF5F2', border: '1px solid #FECDD3', color: '#FC563C', fontSize: '0.68rem' }}
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
                                        <span className="badge rounded-pill px-1.5 py-0.5 extra-small" style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', fontSize: '0.65rem' }}>
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
                      <div className="row g-2 mt-3 pt-3 border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.07)' }}>
                        <div className="col-6">
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-navy w-100 py-1.5 extra-small shadow-xs text-nowrap"
                            style={{ fontSize: '0.74rem' }}
                            onClick={() => navigate('/caretaker/my-pond')}
                          >
                            <FaPlus size={9} /> Log Feed
                          </button>
                        </div>
                        <div className="col-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline w-100 py-1.5 extra-small shadow-xs text-nowrap"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => navigate('/caretaker/disease-scan')}
                            title="Disease Scan"
                          >
                            <FaStethoscope size={10} style={{ color: '#FC563C' }} /> Scan
                          </button>
                        </div>
                        <div className="col-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline-orange w-100 py-1.5 extra-small shadow-xs text-nowrap"
                            style={{ fontSize: '0.72rem' }}
                            onClick={() => navigate('/caretaker/reports')}
                            title="Report Pond Concern"
                          >
                            <FaExclamationTriangle size={10} style={{ color: '#FC563C' }} /> Report
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
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 34, height: 34, background: 'rgba(252, 86, 60, 0.07)', color: '#FC563C' }}
                >
                  <FaStethoscope size={14} />
                </div>
                <h6 className="fw-bold mb-0 tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F', fontSize: '1.05rem' }}>Shrimp Health &amp; Disease Scans</h6>
              </div>

              <div className="d-flex align-items-center gap-2 ms-auto">
                <select
                  className="form-select form-select-sm rounded-pill bg-white px-3 py-1 shadow-xs cursor-pointer extra-small fw-semibold"
                  style={{ width: 'auto', minWidth: 140, height: 36, border: '1px solid rgba(252, 86, 60, 0.15)', color: '#FC563C' }}
                  value={selectedDiseasePondFilter}
                  onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                >
                  <option value="all">All Assigned Ponds</option>
                  {assignedPonds.map((pond) => (
                    <option key={pond.id} value={pond.pond_name}>
                      {pond.pond_name}
                    </option>
                  ))}
                </select>
                <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {filteredDiseaseScans.length} Scans
                </span>
              </div>
            </div>

            {latestDisease ? (
              <div className="d-flex align-items-center p-3 rounded-4 bg-white mb-3" style={{ minHeight: 110, border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1' }}>
                {latestDisease.image_path && (
                  <img
                    src={resolveImageUrl(latestDisease.image_path)}
                    alt="Latest disease scan"
                    className="rounded-3 me-3 flex-shrink-0"
                    style={{ width: 64, height: 64, objectFit: 'cover', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #CBD5E1' }}
                  />
                )}
                <div>
                  <div className="fw-bold mb-1 fs-6" style={{ color: '#FC563C' }}>{latestDisease.disease_name}</div>
                  <div className="d-flex align-items-center gap-2 flex-wrap extra-small text-muted">
                    <span>Risk:</span>
                    <span className="badge rounded-pill" style={{ backgroundColor: latestDisease.risk_level === 'High' ? '#FC563C' : '#FC563C', color: '#FFFFFF' }}>
                      {latestDisease.risk_level || 'Safe'}
                    </span>
                    <span>•</span>
                    <span>Confidence: <strong style={{ color: '#FC563C' }}>{latestDisease.confidence_score}%</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 rounded-4 bg-white text-muted small mb-3" style={{ border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1' }}>
                <FaStethoscope size={22} className="mb-2 opacity-40" style={{ color: '#FC563C' }} />
                <p className="mb-0 fw-semibold" style={{ color: '#FC563C' }}>No disease scans recorded yet</p>
                <small className="extra-small text-muted">All scans look healthy and normal.</small>
              </div>
            )}

            <div className="pt-2 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-tri-orange px-3.5 py-1.5 extra-small fw-bold shadow-xs"
                onClick={() => navigate('/caretaker/disease-scan')}
              >
                Scan Shrimp Health <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: System Incident Alerts */}
        {activeActivityTab === 'alerts' && (
          <div className="p-3.5 p-md-4">
            <div className="d-flex align-items-center justify-content-between mb-3.5 gap-2">
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 34, height: 34, background: 'rgba(252, 86, 60, 0.12)', color: '#FC563C' }}
                >
                  <FaExclamationTriangle size={14} />
                </div>
                <h6 className="fw-bold mb-0 tracking-tight" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F', fontSize: '1.05rem' }}>System Incident Alerts</h6>
              </div>
              <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.12)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.25)' }}>
                {alerts.length} Active
              </span>
            </div>

            {latestAlert ? (
              <div className="d-flex flex-column justify-content-center p-3 rounded-4 caretaker-alert-box mb-3" style={{ minHeight: 110, border: isDark ? '1px solid rgba(252, 86, 60, 0.3)' : '1.5px solid #FECDD3' }}>
                <div className="fw-bold d-flex align-items-center gap-2 mb-1 fs-6" style={{ color: '#FC563C' }}>
                  <FaExclamationTriangle size={13} /> {latestAlert.title}
                </div>
                <small className="text-muted" style={{ lineHeight: 1.45 }}>{latestAlert.message}</small>
              </div>
            ) : (
              <div className="text-center py-4 rounded-4 caretaker-prestock-pond-card text-muted small mb-3" style={{ border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1.5px solid #CBD5E1' }}>
                <FaShieldAlt size={22} className="mb-2 opacity-40" style={{ color: '#FC563C' }} />
                <p className="mb-0 fw-semibold" style={{ color: '#FC563C' }}>No active alerts for your ponds</p>
                <small className="extra-small text-muted">All ponds and water readings are in safe range.</small>
              </div>
            )}

            <div className="pt-2 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-tri-outline-orange px-3.5 py-1.5 extra-small fw-bold shadow-xs"
                onClick={() => navigate('/caretaker/reports')}
              >
                Submit Incident Report <FaChevronRight size={10} />
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
