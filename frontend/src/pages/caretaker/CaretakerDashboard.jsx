import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  FaSync,
  FaLock,
  FaShieldAlt,
  FaChevronRight,
  FaFileAlt
} from 'react-icons/fa';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';

const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

const normalizeFeedingTime = (value = '') => String(value).trim().replace(/^0(\d:)/, '$1').toUpperCase();

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) {
    return `http://localhost${cleanPath}`;
  }
  if (cleanPath.startsWith('/backend')) {
    return `http://localhost/shrim_predict_api${cleanPath}`;
  }
  return `http://localhost/shrim_predict_api/backend/${cleanPath.replace(/^\/+/, '')}`;
};

export default function CaretakerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assignedPonds = user?.assigned_ponds?.length
    ? user.assigned_ponds
    : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : []);

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

  const [loading, setLoading] = useState(true);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [selectedDiseasePondFilter, setSelectedDiseasePondFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortOption, setSortOption] = useState('latest');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const todayDateStr = new Date().toISOString().split('T')[0];
      const [feedRes, diseaseRes, alertsRes, wqRes] = await Promise.allSettled([
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
            date: todayDateStr,
          },
        }),
      ]);

      if (feedRes.status === 'fulfilled') setRecords(safeArray(feedRes.value.data));
      if (diseaseRes.status === 'fulfilled') setDiseaseScans(safeArray(diseaseRes.value.data));
      if (alertsRes.status === 'fulfilled') setAlerts(safeArray(alertsRes.value.data));
      if (wqRes.status === 'fulfilled' && wqRes.value.data?.success) {
        setWaterQualityChecklist(wqRes.value.data);
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

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.record_date === todayStr);
  const filteredTodayRecords = todayRecords.filter((r) => {
    if (selectedPondFilter === 'all') return true;
    return String(r.pond_id) === String(selectedPondFilter);
  });

  const searchedTodayRecords = filteredTodayRecords.filter((r) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      (r.feeding_time || '').toLowerCase().includes(term) ||
      (r.pond_name || '').toLowerCase().includes(term) ||
      (r.feed_type || r.product_code || '').toLowerCase().includes(term) ||
      (r.vitamin_name || '').toLowerCase().includes(term)
    );
  });

  const sortedSearchedTodayRecords = [...searchedTodayRecords].sort((a, b) => {
    if (sortOption === 'oldest') {
      return (a.id || 0) - (b.id || 0);
    }
    if (sortOption === 'amount-high') {
      return (parseFloat(b.amount_kg) || 0) - (parseFloat(a.amount_kg) || 0);
    }
    if (sortOption === 'amount-low') {
      return (parseFloat(a.amount_kg) || 0) - (parseFloat(b.amount_kg) || 0);
    }
    if (sortOption === 'pond') {
      return (a.pond_name || '').localeCompare(b.pond_name || '');
    }
    return (b.id || 0) - (a.id || 0);
  });

  const totalAmountToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
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
      {/* 🌟 HERO CONTROL STRIP: STATUS BADGE, TITLE & SLEEK PILL FILTERS */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill fw-bold extra-small"
              style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
            >
              ● CARETAKER CONSOLE
            </span>
            <span className="text-muted extra-small">
              {assignedPonds.length} Assigned Basins • Telemetry Verification
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 mt-1 tracking-tight text-dark" style={{ fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Field Operations Hub
          </h2>
        </div>

        {/* Compact Pill-Shaped Filter Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Pond Selector Pill */}
          <div className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border shadow-xs">
            <FaWater style={{ color: '#0284C7', fontSize: '0.8rem' }} />
            <select
              className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark p-0 ps-1 cursor-pointer"
              style={{ width: 'auto', minWidth: 155, fontSize: '0.82rem', outline: 'none' }}
              value={selectedPondFilter}
              onChange={(e) => setSelectedPondFilter(e.target.value)}
            >
              <option value="all">All Assigned Ponds ({assignedPonds.length})</option>
              {assignedPonds.map((pond) => (
                <option key={pond.id} value={String(pond.id)}>
                  {pond.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Indicator Pill */}
          <div className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border shadow-xs text-muted extra-small">
            <FaCalendarAlt size={12} style={{ color: '#FF7A00' }} />
            <span className="fw-bold text-dark">{todayStr}</span>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ height: 36, fontSize: '0.8rem' }}
            onClick={loadData}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} style={{ color: '#0284C7' }} /> Sync
          </button>

          {/* Launch OCR Quick Action */}
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3.5 py-1.5 d-flex align-items-center gap-2 fw-bold text-white shadow-xs"
            style={{
              height: 36,
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
              border: 'none',
            }}
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
            <FaCamera size={12} /> Scan Water Quality
          </button>
        </div>
      </div>

      {/* 🌟 DAILY WATER QUALITY VERIFICATION PROTOCOL CARD */}
      <div className="asymmetric-card mb-4 overflow-hidden border-0 shadow-sm">
        <div
          className="p-3.5 p-md-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 text-white"
          style={{
            background: waterQualityChecklist.is_all_completed
              ? 'linear-gradient(135deg, #064E3B 0%, #059669 100%)'
              : 'linear-gradient(135deg, #071733 0%, #0B2C5F 60%, #1E3A8A 100%)',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
              style={{
                width: 46,
                height: 46,
                background: waterQualityChecklist.is_all_completed ? '#10B981' : '#FF7A00',
                color: '#FFFFFF',
                fontSize: '1.25rem',
              }}
            >
              {waterQualityChecklist.is_all_completed ? <FaCheckCircle /> : <FaCamera />}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2.5 flex-wrap">
                <h6 className="fw-bold mb-0 text-white" style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>
                  Daily Water Quality Verification Protocol
                </h6>
                <span
                  className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                  style={{
                    background: waterQualityChecklist.is_all_completed
                      ? 'rgba(16, 185, 129, 0.22)'
                      : 'rgba(255, 255, 255, 0.14)',
                    border: waterQualityChecklist.is_all_completed
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.22)',
                    color: waterQualityChecklist.is_all_completed ? '#A7F3D0' : '#FEF3C7',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                  }}
                >
                  <span
                    className="rounded-circle"
                    style={{
                      width: 6,
                      height: 6,
                      backgroundColor: waterQualityChecklist.is_all_completed ? '#10B981' : '#F59E0B',
                    }}
                  />
                  {waterQualityChecklist.verified_count} / {assignedPonds.length} Ponds Verified Today
                </span>
              </div>
              <p className="text-white text-opacity-80 extra-small mb-0 mt-1" style={{ maxWidth: 640 }}>
                {waterQualityChecklist.is_all_completed
                  ? 'All assigned ponds verified for today. Monitoring and feeding records are fully unlocked.'
                  : 'Mandatory O&B Aqua Farm Protocol: Verify DO, Temp, pH, and Salinity via Dual-Mode OCR before logging feeding records.'}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 ms-md-auto flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3.5 py-2 fw-bold text-white shadow-xs d-flex align-items-center gap-1.5 transition-all hover-scale"
              style={{
                background: waterQualityChecklist.is_all_completed
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '0.82rem',
              }}
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
              <FaCamera size={13} /> {waterQualityChecklist.is_all_completed ? 'Re-scan Readings' : 'Verify Readings (OCR)'}
            </button>
          </div>
        </div>

        {/* Assigned Ponds Checklist Strip */}
        <div className="p-3.5 p-md-4 border-top" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="row g-3">
            {assignedPonds.map((pond) => {
              const checkItem = waterQualityChecklist.checklist?.find((c) => c.pond_id === pond.id);
              const isVerified = Boolean(checkItem?.is_verified_today);
              const readings = checkItem?.latest_readings;

              return (
                <div key={pond.id} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="p-3 rounded-3 bg-white border d-flex flex-column justify-content-between h-100 transition-all hover-shadow"
                    style={{
                      borderLeft: isVerified ? '4px solid #10B981' : '4px solid #F59E0B',
                      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {/* Top Row: Pond Name + Proportionate Status Badge */}
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 26,
                            height: 26,
                            backgroundColor: isVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: isVerified ? '#059669' : '#D97706',
                            fontSize: '0.72rem',
                          }}
                        >
                          <FaWater />
                        </div>
                        <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
                          {pond.pond_name}
                        </strong>
                      </div>

                      {/* Proportionate, subtle status badge */}
                      {isVerified ? (
                        <span
                          className="d-inline-flex align-items-center gap-1 px-2.5 py-0.5 rounded-pill"
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#059669',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <FaCheckCircle size={8} />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span
                          className="d-inline-flex align-items-center gap-1.5 px-2.5 py-0.5 rounded-pill"
                          style={{
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#B45309',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            className="rounded-circle"
                            style={{ width: 6, height: 6, backgroundColor: '#F59E0B' }}
                          />
                          <span>Needs Test</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Metrics or Lock Notice + Action Button */}
                    <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top border-light-subtle">
                      <div className="extra-small text-truncate">
                        {isVerified ? (
                          <span className="text-secondary" style={{ fontSize: '0.74rem' }}>
                            DO: <strong className="text-dark">{readings?.dissolved_oxygen ?? '—'}</strong> • Temp: <strong className="text-dark">{readings?.temperature ?? '—'}</strong>°C • pH: <strong className="text-dark">{readings?.ph_level ?? '—'}</strong>
                          </span>
                        ) : (
                          <span className="text-danger fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '0.74rem' }}>
                            <FaLock size={9} className="text-danger opacity-75" />
                            <span>Monitoring & Feeding Locked</span>
                          </span>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        {!isVerified ? (
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1.5 shadow-xs transition-all hover-scale"
                            style={{
                              background: 'linear-gradient(135deg, #0B2C5F 0%, #1E3A8A 100%)',
                              color: '#FFFFFF',
                              fontSize: '0.72rem',
                              border: 'none',
                            }}
                            onClick={() => {
                              setOcrTargetPondId(String(pond.id));
                              setIsOcrModalOpen(true);
                            }}
                          >
                            <FaCamera size={9} />
                            <span>Scan</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill px-2.5 py-1 text-secondary d-inline-flex align-items-center gap-1 extra-small transition-all"
                            style={{ fontSize: '0.7rem' }}
                            onClick={() => {
                              setOcrTargetPondId(String(pond.id));
                              setIsOcrModalOpen(true);
                            }}
                            title="Re-scan / Update Today's Readings"
                          >
                            <FaSync size={8} />
                            <span>Re-test</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🌟 KPI TELEMETRY CARDS (SPACIOUS LUXURY AQUACULTURE TELEMETRY STYLE) */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* KPI 1: Assigned Ponds */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Ponds</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaWater size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {assignedPonds.length}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 130 }}>
                  {selectedPondFilter === 'all' ? 'All basins active' : `Focused: ${selectedPondObj?.pond_name || 'Active'}`}
                </span>
                <span className="tag-cyan-active">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Today's Feeding Logs */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Today's Logs</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
                >
                  <FaUtensils size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {filteredTodayRecords.length}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (filteredTodayRecords.length / Math.max(1, assignedPonds.length * 4)) * 100))}%`,
                    background: 'linear-gradient(90deg, #16A34A, #4ADE80)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {currentScope}
                </span>
                <span className="tag-green-safe">Logged</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Feed Today */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Total Feed Today</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(255, 122, 0, 0.12)', color: '#FF7A00' }}
                >
                  <FaCheckCircle size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {totalAmountToday.toFixed(1)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(12, (totalAmountToday / Math.max(1, assignedPonds.length * 35)) * 100))}%`,
                    background: 'linear-gradient(90deg, #FF7A00, #FBBF24)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small">Distributed feed</span>
                <span className="tag-orange-maintenance">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Feeding Schedule Progress */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feeding Schedule</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0EA5E9' }}
                >
                  <FaClock size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {feedingCompletion}%
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.max(5, feedingCompletion)}%`,
                    background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small font-mono fw-semibold">{completedFeedingSlots}/5 Slots Logged</span>
                <span className="tag-cyan-active">{feedingCompletion === 100 ? 'Complete' : 'In Progress'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ASSIGNED PONDS LIVE OVERVIEW & QUICK ACTION HUB */}
      <div className="asymmetric-card p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Assigned Ponds Live Overview & Quick Actions</h5>
            <small className="text-muted">Instant pond status monitoring and one-touch caretaker actions</small>
          </div>
          <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
            {assignedPonds.length} Active Basins
          </span>
        </div>

        <div className="row g-3">
          {assignedPonds.map((pond) => {
            const pondLogs = todayRecords.filter((r) => String(r.pond_id) === String(pond.id));
            const pondSlots = new Set(pondLogs.map((r) => normalizeFeedingTime(r.feeding_time)).filter(Boolean));
            const pondCompletedCount = feedingTimes.filter((time) => pondSlots.has(normalizeFeedingTime(time))).length;
            const pondPct = Math.round((pondCompletedCount / feedingTimes.length) * 100);

            return (
              <div key={pond.id} className="col-12 col-md-6 col-xl-4">
                <div
                  className="card border border-light shadow-xs rounded-4 p-3.5 h-100 d-flex flex-column justify-content-between transition-all hover-shadow overflow-hidden bg-white"
                  style={{ minHeight: 190 }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: 38, height: 38, background: 'rgba(2, 132, 199, 0.08)', color: '#0284C7' }}
                        >
                          <FaWater size={16} />
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0 fs-6">{pond.pond_name}</h6>
                          <small className="text-muted extra-small">Production Basin</small>
                        </div>
                      </div>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2.5 py-1 extra-small fw-bold">
                        ● Nominal
                      </span>
                    </div>

                    <div className="my-2 py-1">
                      <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-1.5">
                        <span className="fw-semibold">Today's Feeding Progress</span>
                        <span className="fw-bold text-dark font-mono">{pondCompletedCount}/5 ({pondPct}%)</span>
                      </div>
                      <div className="progress rounded-pill bg-light" style={{ height: 8 }}>
                        <div
                          className="progress-bar rounded-pill"
                          role="progressbar"
                          style={{
                            width: `${pondPct}%`,
                            background: 'linear-gradient(90deg, #16A34A 0%, #22C55E 100%)'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-1.5 mt-3 pt-3 border-top flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1 text-white shadow-xs"
                      style={{ background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)', border: 'none' }}
                      onClick={() => navigate('/caretaker/my-pond')}
                    >
                      <FaPlus size={10} /> Log Feed
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light border rounded-pill px-2.5 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1 text-dark"
                      onClick={() => navigate('/caretaker/disease-scan')}
                      title="AI Disease Scan"
                    >
                      <FaStethoscope size={11} style={{ color: '#0284C7' }} /> Scan
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light border rounded-pill px-2.5 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1 text-dark"
                      onClick={() => navigate('/caretaker/reports')}
                      title="Report Pond Concern"
                    >
                      <FaExclamationTriangle size={11} style={{ color: '#EA580C' }} /> Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 TODAY'S FEEDING RECORDS PANEL */}
      <div className="asymmetric-card p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Today's Feeding Records</h5>
            <small className="text-muted">
              {selectedPondFilter === 'all'
                ? `Showing all assigned basins for ${todayStr}`
                : `Filtered by ${selectedPondObj?.pond_name || 'Selected Basin'} (${todayStr})`}
            </small>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Search Input Pill */}
            <div
              className="d-flex align-items-center px-3 py-1 rounded-pill bg-white border shadow-xs"
              style={{ height: 36, width: 220 }}
            >
              <FaSearch className="text-muted extra-small me-2" />
              <input
                type="text"
                className="form-control form-control-sm border-0 bg-transparent p-0 extra-small fw-medium text-dark"
                placeholder="Search logs, vitamins..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            {/* Sort Pill */}
            <div className="d-flex align-items-center px-3 py-1.5 rounded-pill bg-white border shadow-xs" style={{ height: 36 }}>
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark p-0 cursor-pointer"
                style={{ width: 'auto', minWidth: 140, fontSize: '0.82rem', outline: 'none' }}
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount-high">Amount (High to Low)</option>
                <option value="amount-low">Amount (Low to High)</option>
                <option value="pond">Pond Name</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted small">
            <FaSync className="fa-spin mb-2" size={20} style={{ color: '#0284C7' }} />
            <p className="mb-0">Loading today's feeding logs...</p>
          </div>
        ) : sortedSearchedTodayRecords.length > 0 ? (
          <div
            className="table-responsive rounded-3 border"
            style={{ maxHeight: '460px', overflowY: 'auto' }}
          >
            <table className="table align-middle mb-0" style={{ fontSize: '0.86rem' }}>
              <thead
                className="table-light sticky-top shadow-xs"
                style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#F8FAFC' }}
              >
                <tr>
                  <th className="ps-3 py-3 text-secondary text-uppercase extra-small fw-bold">Time Slot</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Basin</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Product / Feed Type</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Amount</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Vitamin / Additive</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Logged At</th>
                </tr>
              </thead>
              <tbody>
                {sortedSearchedTodayRecords.map((r) => (
                  <tr key={r.id} className="hover-bg-light transition-all">
                    <td className="ps-3">
                      <span className="badge bg-light border text-dark fw-bold rounded-pill px-2.5 py-1 extra-small">
                        {r.feeding_time || '-'}
                      </span>
                    </td>
                    <td>
                      <strong className="text-dark">{r.pond_name || `Pond ${r.pond_id}`}</strong>
                    </td>
                    <td>
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 extra-small fw-semibold">
                        {r.feed_type || r.product_code || 'Tateh'}
                      </span>
                    </td>
                    <td>
                      <strong className="text-dark" style={{ color: '#0B2C5F' }}>{r.amount_kg} kg</strong>
                    </td>
                    <td>
                      {r.vitamin_name && r.vitamin_name !== 'None' ? (
                        <span className="badge bg-info bg-opacity-15 text-dark fw-semibold rounded-pill px-2.5 py-1 extra-small">
                          {r.vitamin_name}
                        </span>
                      ) : (
                        <span className="text-muted extra-small">None</span>
                      )}
                    </td>
                    <td>
                      <span className="text-muted extra-small font-mono">
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.record_date}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 text-center bg-light rounded-4 border">
            <p className="text-muted mb-3 small">
              {searchFilter
                ? `No matching feeding logs found for "${searchFilter}".`
                : selectedPondFilter === 'all'
                ? "No feeding records logged for today yet."
                : `No feeding records logged for ${selectedPondObj?.pond_name || 'this pond'} today.`}
            </p>
            <button
              type="button"
              className="btn btn-sm rounded-pill px-4 py-2 fw-bold text-white shadow-xs"
              style={{ background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)', border: 'none' }}
              onClick={() => navigate('/caretaker/my-pond')}
            >
              Log Today's First Feeding
            </button>
          </div>
        )}
      </div>

      {/* 🌟 SIDE-BY-SIDE DISEASE SCAN & SYSTEM ALERTS */}
      <div className="row g-3">
        {/* Left Card: Disease Scan */}
        <div className="col-md-6">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32, background: 'rgba(2, 132, 199, 0.1)', color: '#0284C7' }}
                  >
                    <FaStethoscope size={13} />
                  </div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Disease Scan Telemetry</h5>
                </div>

                <div className="d-flex align-items-center gap-2 ms-auto">
                  <select
                    className="form-select form-select-sm rounded-pill border bg-white text-dark px-3 py-1 shadow-xs cursor-pointer extra-small fw-semibold"
                    style={{ width: 'auto', minWidth: 140, height: 34 }}
                    value={selectedDiseasePondFilter}
                    onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                  >
                    <option value="all">All Assigned Basins</option>
                    {assignedPonds.map((pond) => (
                      <option key={pond.id} value={pond.pond_name}>
                        {pond.pond_name}
                      </option>
                    ))}
                  </select>
                  <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                    {filteredDiseaseScans.length} Scans
                  </span>
                </div>
              </div>

              {latestDisease ? (
                <div className="d-flex align-items-center p-3 rounded-4 bg-light border" style={{ minHeight: 110 }}>
                  {latestDisease.image_path && (
                    <img
                      src={resolveImageUrl(latestDisease.image_path)}
                      alt="Latest disease scan"
                      className="rounded-3 me-3 flex-shrink-0 border"
                      style={{ width: 64, height: 64, objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <div className="fw-bold text-dark mb-1 fs-6">{latestDisease.disease_name}</div>
                    <div className="d-flex align-items-center gap-2 flex-wrap extra-small text-muted">
                      <span>Risk:</span>
                      <span className={`badge rounded-pill ${latestDisease.risk_level === 'High' ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                        {latestDisease.risk_level || 'Safe'}
                      </span>
                      <span>•</span>
                      <span>Confidence: <strong>{latestDisease.confidence_score}%</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 rounded-4 bg-light border text-muted small">
                  <FaStethoscope size={22} className="mb-2 opacity-30 text-info" />
                  <p className="mb-0 fw-semibold">No disease scans recorded yet</p>
                  <small className="extra-small text-muted">AI image inference is nominal.</small>
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-light border rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1"
                onClick={() => navigate('/caretaker/disease-scan')}
              >
                Scan Shrimp Health <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: System Alerts */}
        <div className="col-md-6">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32, background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                  >
                    <FaExclamationTriangle size={13} />
                  </div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">System Incident Alerts</h5>
                </div>
                <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  {alerts.length} Active
                </span>
              </div>

              {latestAlert ? (
                <div className="d-flex flex-column justify-content-center p-3 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-25" style={{ minHeight: 110 }}>
                  <div className="fw-bold d-flex align-items-center gap-2 text-danger mb-1 fs-6">
                    <FaExclamationTriangle size={13} /> {latestAlert.title}
                  </div>
                  <small className="text-muted" style={{ lineHeight: 1.45 }}>{latestAlert.message}</small>
                </div>
              ) : (
                <div className="text-center py-4 rounded-4 bg-light border text-muted small">
                  <FaShieldAlt size={22} className="mb-2 opacity-30 text-success" />
                  <p className="mb-0 fw-semibold">No active alerts for your ponds</p>
                  <small className="extra-small text-muted">All ponds and telemetry parameters are stable.</small>
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-light border rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1"
                onClick={() => navigate('/caretaker/reports')}
              >
                Submit Incident Report <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 DUAL-MODE OCR WATER QUALITY MODAL */}
      <WaterQualityOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        assignedPonds={assignedPonds}
        initialPondId={ocrTargetPondId || (assignedPonds[0]?.id ? String(assignedPonds[0].id) : '')}
        caretakerName={user?.full_name || 'Caretaker'}
        caretakerId={user?.id}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
