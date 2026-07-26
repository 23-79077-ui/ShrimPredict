import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';
import { FaUtensils, FaWater, FaCheckCircle, FaExclamationTriangle, FaPlus, FaClock } from 'react-icons/fa';

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
      <section className="caretaker-dashboard-hero">
        <div>
          <span className="caretaker-dashboard-kicker">Daily Pond Operations</span>
          <h3>Welcome back, {user?.full_name || 'Caretaker'}</h3>
          <p>Monitor today's feeding logs, schedule completion, disease scans, and active pond alerts.</p>
          <div className="caretaker-hero-meta">
            <span>{todayStr}</span>
            <span>{currentScope}</span>
            <span>{completedFeedingSlots}/5 feedings logged</span>
          </div>
        </div>
        <div className="caretaker-dashboard-actions">
          <button className="btn btn-light" onClick={() => navigate('/caretaker/feeding-history')}>
            <FaClock /> History
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/caretaker/my-pond')}>
            <FaPlus /> Log Feeding
          </button>
        </div>
      </section>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-blue h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Assigned Ponds</span>
                <span className="caretaker-stat-icon"><FaWater /></span>
              </div>
              <h3>{assignedPonds.length}</h3>
              <small className="text-muted">Tap a pond to focus the dashboard.</small>
              <div className="caretaker-pond-chips">
                <button type="button" className={selectedPondFilter === 'all' ? 'active' : ''} onClick={() => setSelectedPondFilter('all')}>
                  All
                </button>
                {assignedPonds.map((pond) => (
                  <button
                    type="button"
                    key={pond.id}
                    className={selectedPondFilter === String(pond.id) ? 'active' : ''}
                    onClick={() => setSelectedPondFilter(String(pond.id))}
                  >
                    {pond.pond_name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-green h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Today's Logs</span>
                <span className="caretaker-stat-icon"><FaUtensils /></span>
              </div>
              <h3>{filteredTodayRecords.length}</h3>
              <small className="text-muted">{currentScope}</small>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-cyan h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Total Feed Today</span>
                <span className="caretaker-stat-icon"><FaCheckCircle /></span>
              </div>
              <h3>{totalAmountToday.toFixed(1)} kg</h3>
              <small className="text-muted">{currentScope}</small>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-amber h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Feeding Schedule</span>
                <span className="caretaker-stat-icon"><FaClock /></span>
              </div>
              <div className="caretaker-progress-line">
                <strong>{feedingCompletion}%</strong>
                <span>{completedFeedingSlots}/5 complete</span>
              </div>
              <div className="caretaker-progress-track" aria-hidden="true">
                <span style={{ width: `${feedingCompletion}%` }} />
              </div>
              <div className="feeding-schedule-grid mt-3">
                {feedingTimes.map((time) => {
                  const isLogged = loggedFeedingSlots.has(normalizeFeedingTime(time));
                  return (
                    <span key={time} className={`feeding-slot ${isLogged ? 'logged' : 'pending'}`}>
                      <strong>{time}</strong>
                      <small>{isLogged ? 'Logged' : 'Pending'}</small>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card caretaker-panel-card mb-4">
        <div className="card-body">
          <div className="caretaker-panel-header">
            <div>
              <h5>Today's Feeding Records</h5>
              <small className="text-muted">
                {selectedPondFilter === 'all'
                  ? `Showing all assigned ponds (${todayStr})`
                  : `Filtered by ${selectedPondObj?.pond_name || 'Selected Pond'} (${todayStr})`}
              </small>
            </div>
            <div className="caretaker-panel-tools">
              <label className="small fw-semibold text-muted mb-0">Pond</label>
              <select
                className="form-select form-select-sm fw-semibold"
                value={selectedPondFilter}
                onChange={(e) => setSelectedPondFilter(e.target.value)}
              >
                <option value="all">All Assigned Ponds</option>
                {assignedPonds.map((pond) => (
                  <option key={pond.id} value={String(pond.id)}>
                    {pond.pond_name}
                  </option>
                ))}
              </select>
              <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/caretaker/my-pond')}>
                <FaPlus /> Add Log
              </button>
            </div>
          </div>

          {loading ? (
            <div className="caretaker-empty-state">Loading today's feeding logs...</div>
          ) : filteredTodayRecords.length > 0 ? (
            <div className="table-responsive">
              <table className="table caretaker-record-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Time Slot</th>
                    <th>Pond</th>
                    <th>Product / Feed Type</th>
                    <th>Amount</th>
                    <th>Vitamin</th>
                    <th>Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTodayRecords.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="caretaker-time-badge">{r.feeding_time || '-'}</span>
                      </td>
                      <td>
                        <strong>{r.pond_name || `Pond ${r.pond_id}`}</strong>
                      </td>
                      <td>{r.feed_type || r.product_code || 'Tateh'}</td>
                      <td>
                        <span className="fw-bold">{r.amount_kg} kg</span>
                      </td>
                      <td>
                        {r.vitamin_name && r.vitamin_name !== 'None' ? (
                          <span className="badge bg-info bg-opacity-10 text-dark fw-semibold">{r.vitamin_name}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted">
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
                {selectedPondFilter === 'all'
                  ? "No feeding records logged for today yet."
                  : `No feeding records logged for ${selectedPondObj?.pond_name || 'this pond'} today.`}
              </p>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/caretaker/my-pond')}>
                Log Today's First Feeding
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card caretaker-panel-card h-100">
            <div className="card-body">
              <div className="caretaker-panel-title">
                <h5>Latest Disease Scan</h5>
                <div className="caretaker-scan-filter">
                  <select
                    className="form-select form-select-sm fw-semibold"
                    value={selectedDiseasePondFilter}
                    onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                    aria-label="Filter disease scans by assigned pond"
                  >
                    <option value="all">All Assigned Ponds</option>
                    {assignedPonds.map((pond) => (
                      <option key={pond.id} value={pond.pond_name}>
                        {pond.pond_name}
                      </option>
                    ))}
                  </select>
                  <span>{filteredDiseaseScans.length} record(s)</span>
                </div>
              </div>
              {latestDisease ? (
                <div className="caretaker-insight-card">
                  {latestDisease.image_path && (
                    <img src={resolveImageUrl(latestDisease.image_path)} alt="Latest disease scan" />
                  )}
                  <div>
                    <div className="fw-bold">{latestDisease.disease_name}</div>
                    <small className="text-muted">
                      Risk: <span className={`badge ${latestDisease.risk_level === 'High' ? 'bg-danger' : 'bg-success'}`}>{latestDisease.risk_level}</span> | Confidence: {latestDisease.confidence_score}%
                    </small>
                  </div>
                </div>
              ) : (
                <div className="caretaker-empty-state compact">No disease scans recorded yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card caretaker-panel-card h-100">
            <div className="card-body">
              <div className="caretaker-panel-title">
                <h5>Latest System Alerts</h5>
                <span>{alerts.length} active</span>
              </div>
              {latestAlert ? (
                <div className="caretaker-alert-card">
                  <div className="fw-bold d-flex align-items-center gap-2">
                    <FaExclamationTriangle /> {latestAlert.title}
                  </div>
                  <small className="text-muted">{latestAlert.message}</small>
                </div>
              ) : (
                <div className="caretaker-empty-state compact">No active alerts for your ponds.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
