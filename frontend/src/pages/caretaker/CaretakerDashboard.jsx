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
  FaChevronRight,
} from 'react-icons/fa';

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
  const [loading, setLoading] = useState(true);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [selectedDiseasePondFilter, setSelectedDiseasePondFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortOption, setSortOption] = useState('latest');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [feedRes, diseaseRes, alertsRes] = await Promise.allSettled([
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
      ]);

      if (feedRes.status === 'fulfilled') setRecords(safeArray(feedRes.value.data));
      if (diseaseRes.status === 'fulfilled') setDiseaseScans(safeArray(diseaseRes.value.data));
      if (alertsRes.status === 'fulfilled') setAlerts(safeArray(alertsRes.value.data));
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
    return () => window.removeEventListener('shrim-feed-updated', handleUpdate);
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
    <div className="caretaker-dashboard-page">
      <div className="card border-0 shadow-sm rounded-4 bg-white mb-4 overflow-hidden">
        <div className="card-body p-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3" style={{ padding: '1.25rem 1.5rem' }}>
          <div className="d-flex flex-wrap align-items-center gap-2.5">
            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3.5 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.82rem' }}>
              <FaCalendarAlt size={12} /> {todayStr}
            </span>
            <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3.5 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.82rem' }}>
              <FaWater size={12} /> {currentScope}
            </span>
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3.5 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.82rem' }}>
              <FaUtensils size={12} /> {completedFeedingSlots}/5 feedings logged today
            </span>
          </div>

          <div className="d-flex align-items-center gap-2 ms-lg-auto">
            <span className="text-muted extra-small fw-bold text-nowrap d-flex align-items-center gap-1">
              <FaFilter size={11} className="text-primary" /> Filter Pond:
            </span>
            <select
              className="form-select form-select-sm rounded-pill fw-bold border-primary border-opacity-25 bg-primary bg-opacity-10 text-primary px-3.5 py-2 shadow-xs cursor-pointer"
              style={{ width: 'auto', minWidth: 170, fontSize: '0.83rem' }}
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
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div
            className="card border border-primary border-opacity-25 shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(13, 110, 253, 0.03) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-primary" style={{ height: 4 }} />
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Assigned Ponds</span>
              <div className="rounded-3 p-2.5 bg-primary bg-opacity-10 text-primary fs-5">
                <FaWater />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{assignedPonds.length}</h3>
            <span className="text-muted extra-small">
              {selectedPondFilter === 'all' ? 'All assigned ponds active' : `Focused: ${assignedPonds.find(p => String(p.id) === selectedPondFilter)?.pond_name || 'Selected pond'}`}
            </span>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="card border border-success border-opacity-25 shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(25, 135, 84, 0.03) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-success" style={{ height: 4 }} />
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Today's Logs</span>
              <div className="rounded-3 p-2.5 bg-success bg-opacity-10 text-success fs-5">
                <FaUtensils />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{filteredTodayRecords.length}</h3>
            <span className="text-muted extra-small">{currentScope}</span>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="card border border-info border-opacity-25 shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(13, 202, 240, 0.03) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-info" style={{ height: 4 }} />
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Total Feed Today</span>
              <div className="rounded-3 p-2.5 bg-info bg-opacity-10 text-info fs-5">
                <FaCheckCircle />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{totalAmountToday.toFixed(1)} <small className="fs-6 text-muted fw-normal">kg</small></h3>
            <span className="text-muted extra-small">{currentScope}</span>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="card border border-warning border-opacity-50 shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(255, 193, 7, 0.03) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-warning" style={{ height: 4 }} />
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Feeding Schedule</span>
              <div className="rounded-3 p-2.5 bg-warning bg-opacity-10 text-warning fs-5">
                <FaClock />
              </div>
            </div>
            <div className="caretaker-progress-line mb-2">
              <h3 className="fw-extrabold text-dark d-inline me-2 mb-0">{feedingCompletion}%</h3>
              <span className="text-muted extra-small">{completedFeedingSlots}/5 complete</span>
            </div>
            <div className="caretaker-progress-track mb-2" aria-hidden="true">
              <span style={{ width: `${feedingCompletion}%` }} />
            </div>
            <span className="text-muted extra-small">Daily target progress</span>
          </div>
        </div>
      </div>

      {/* 🌟 1. ASSIGNED PONDS LIVE OVERVIEW & INSTANT ACTION HUB (SWAPPED ABOVE RECORDS) */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold text-dark mb-1">Assigned Ponds Live Overview & Quick Action Hub</h5>
            <small className="text-muted">Instant pond status monitoring and one-touch caretaker actions</small>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill extra-small fw-bold border border-primary border-opacity-25">
            {assignedPonds.length} Active Pond(s)
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
                  className="card border border-primary border-opacity-25 shadow-xs rounded-4 p-4 h-100 d-flex flex-column justify-content-between transition-all hover-shadow overflow-hidden"
                  style={{ background: 'linear-gradient(180deg, rgba(13, 110, 253, 0.02) 0%, #ffffff 100%)', minHeight: 190 }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                          <FaWater size={15} />
                        </div>
                        <h6 className="fw-bold text-dark mb-0 fs-6">{pond.pond_name}</h6>
                      </div>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-1.5 extra-small fw-bold">
                        🟢 Active
                      </span>
                    </div>

                    <div className="my-3 py-1">
                      <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-2">
                        <span className="fw-semibold">Today's Feeding Progress</span>
                        <span className="fw-bold text-dark">{pondCompletedCount}/5 ({pondPct}%)</span>
                      </div>
                      <div className="progress rounded-pill bg-light" style={{ height: 8 }}>
                        <div
                          className="progress-bar bg-success rounded-pill"
                          role="progressbar"
                          style={{ width: `${pondPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-1.5 mt-auto pt-3 border-top border-light flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary rounded-pill px-2.5 py-1.5 extra-small fw-bold flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1 shadow-xs text-nowrap"
                      onClick={() => navigate('/caretaker/my-pond')}
                    >
                      <FaPlus size={10} /> Log Feed
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info rounded-pill px-2 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1 text-nowrap"
                      onClick={() => navigate('/caretaker/disease-scan')}
                      title="Disease Scan"
                    >
                      <FaStethoscope size={10} /> Scan
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning rounded-pill px-2 py-1.5 extra-small fw-bold d-inline-flex align-items-center justify-content-center gap-1 text-nowrap"
                      onClick={() => navigate('/caretaker/reports')}
                      title="Report Issue"
                    >
                      <FaExclamationTriangle size={10} /> Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 2. TODAY'S FEEDING RECORDS PANEL (SWAPPED BELOW ACTION HUB) */}
      <div className="card caretaker-panel-card mb-4">
        <div className="card-body">
          <div className="caretaker-panel-header">
            <div>
              <h5 className="fw-bold mb-1 text-dark">Today's Feeding Records</h5>
              <small className="text-muted">
                {selectedPondFilter === 'all'
                  ? `Showing all assigned ponds (${todayStr})`
                  : `Filtered by ${selectedPondObj?.pond_name || 'Selected Pond'} (${todayStr})`}
              </small>
            </div>
            <div className="caretaker-panel-tools d-flex align-items-center gap-2">
              <div
                className="input-group bg-white border border-secondary border-opacity-25 rounded-pill shadow-xs overflow-hidden d-flex align-items-center px-3"
                style={{ width: 200, height: 36 }}
              >
                <span className="text-muted extra-small me-2 d-flex align-items-center"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-medium text-dark"
                  placeholder="Search log..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ height: '100%' }}
                />
              </div>

              <select
                className="form-select form-select-sm rounded-pill fw-bold border-primary border-opacity-25 bg-primary bg-opacity-10 text-primary px-3 py-1 shadow-xs cursor-pointer"
                style={{ height: 36, width: 'auto', minWidth: 150, fontSize: '0.82rem' }}
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                aria-label="Sort feeding logs"
              >
                <option value="latest" className="bg-white text-dark">Latest First</option>
                <option value="oldest" className="bg-white text-dark">Oldest First</option>
                <option value="amount-high" className="bg-white text-dark">Amount (High to Low)</option>
                <option value="amount-low" className="bg-white text-dark">Amount (Low to High)</option>
                <option value="pond" className="bg-white text-dark">Pond Name</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="caretaker-empty-state">Loading today's feeding logs...</div>
          ) : sortedSearchedTodayRecords.length > 0 ? (
            <div
              className="table-responsive border rounded-3 shadow-xs position-relative"
              style={{
                maxHeight: '460px',
                overflowY: 'auto',
              }}
            >
              <table className="table caretaker-record-table align-middle mb-0">
                <thead
                  className="table-light sticky-top shadow-xs"
                  style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc' }}
                >
                  <tr>
                    <th className="ps-3 py-3 text-secondary text-uppercase extra-small fw-bold">Time Slot</th>
                    <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Pond</th>
                    <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Product / Feed Type</th>
                    <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Amount</th>
                    <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Vitamin</th>
                    <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSearchedTodayRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="ps-3">
                        <span className="caretaker-time-badge">{r.feeding_time || '-'}</span>
                      </td>
                      <td>
                        <strong>{r.pond_name || `Pond ${r.pond_id}`}</strong>
                      </td>
                      <td>{r.feed_type || r.product_code || 'Tateh'}</td>
                      <td>
                        <span className="fw-bold text-primary">{r.amount_kg} kg</span>
                      </td>
                      <td>
                        {r.vitamin_name && r.vitamin_name !== 'None' ? (
                          <span className="badge bg-info bg-opacity-10 text-dark fw-semibold">{r.vitamin_name}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted font-mono">
                          {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.record_date}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="caretaker-empty-state">
              <p className="text-muted mb-2">
                {searchFilter
                  ? `No matching feeding logs found for "${searchFilter}".`
                  : selectedPondFilter === 'all'
                  ? "No feeding records logged for today yet."
                  : `No feeding records logged for ${selectedPondObj?.pond_name || 'this pond'} today.`}
              </p>
              <button className="btn btn-sm btn-primary rounded-pill px-4" onClick={() => navigate('/caretaker/my-pond')}>
                Log Today's First Feeding
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 SIDE-BY-SIDE DISEASE SCAN & SYSTEM ALERTS (THEMED BORDERS & VISIBLE SELECT) */}
      <div className="row g-3">
        {/* Left Card: Disease Scan */}
        <div className="col-md-6">
          <div
            className="card border border-info border-opacity-25 shadow-sm rounded-4 position-relative overflow-hidden h-100 transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(13, 202, 240, 0.02) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-info" style={{ height: 4 }} />
            <div className="card-body p-4 d-flex flex-column h-100 justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap" style={{ minHeight: 34 }}>
                <h5 className="fw-bold text-dark mb-0 text-nowrap">Disease Scan</h5>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <select
                    className="form-select form-select-sm rounded-pill fw-bold border-info border-opacity-25 bg-info bg-opacity-10 text-info px-3 py-1 shadow-xs cursor-pointer"
                    style={{ width: 'auto', minWidth: 140, height: 34, fontSize: '0.81rem' }}
                    value={selectedDiseasePondFilter}
                    onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                    aria-label="Filter disease scans by assigned pond"
                  >
                    <option value="all" className="bg-white text-dark">All Assigned Ponds</option>
                    {assignedPonds.map((pond) => (
                      <option key={pond.id} value={pond.pond_name} className="bg-white text-dark">
                        {pond.pond_name}
                      </option>
                    ))}
                  </select>
                  <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2 rounded-pill extra-small fw-bold text-nowrap">
                    {filteredDiseaseScans.length} record(s)
                  </span>
                </div>
              </div>

              {latestDisease ? (
                <div className="caretaker-insight-card flex-grow-1 d-flex align-items-center p-3.5 rounded-4 bg-light border border-slate-200" style={{ minHeight: 120 }}>
                  {latestDisease.image_path && (
                    <img src={resolveImageUrl(latestDisease.image_path)} alt="Latest disease scan" className="rounded-3 me-3 flex-shrink-0" style={{ width: 64, height: 64, objectFit: 'cover' }} />
                  )}
                  <div>
                    <div className="fw-bold text-dark mb-1 fs-6">{latestDisease.disease_name}</div>
                    <small className="text-muted">
                      Risk: <span className={`badge ${latestDisease.risk_level === 'High' ? 'bg-danger' : 'bg-success'}`}>{latestDisease.risk_level}</span> | Confidence: {latestDisease.confidence_score}%
                    </small>
                  </div>
                </div>
              ) : (
                <div className="caretaker-empty-state flex-grow-1 d-flex align-items-center justify-content-center p-4 rounded-4 border border-dashed border-info border-opacity-25 bg-info bg-opacity-10" style={{ minHeight: 120 }}>
                  <span className="text-info extra-small fw-bold">No disease scans recorded yet.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: System Alerts */}
        <div className="col-md-6">
          <div
            className="card border border-danger border-opacity-25 shadow-sm rounded-4 position-relative overflow-hidden h-100 transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(220, 53, 69, 0.02) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-danger" style={{ height: 4 }} />
            <div className="card-body p-4 d-flex flex-column h-100 justify-content-between">
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2" style={{ minHeight: 34 }}>
                <h5 className="fw-bold text-dark mb-0 text-nowrap">System Alerts</h5>
                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-2 rounded-pill extra-small fw-bold text-nowrap ms-auto">
                  {alerts.length} active
                </span>
              </div>

              {latestAlert ? (
                <div className="caretaker-alert-card flex-grow-1 d-flex flex-column justify-content-center p-3.5 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-25" style={{ minHeight: 120 }}>
                  <div className="fw-bold d-flex align-items-center gap-2 text-danger mb-1 fs-6">
                    <FaExclamationTriangle /> {latestAlert.title}
                  </div>
                  <small className="text-muted">{latestAlert.message}</small>
                </div>
              ) : (
                <div className="caretaker-empty-state flex-grow-1 d-flex align-items-center justify-content-center p-4 rounded-4 border border-dashed border-danger border-opacity-25 bg-danger bg-opacity-10" style={{ minHeight: 120 }}>
                  <span className="text-danger extra-small fw-bold">No active alerts for your ponds.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
