import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';
import { FaUtensils, FaWater, FaCheckCircle, FaExclamationTriangle, FaPlus, FaClock } from 'react-icons/fa';

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
        api.get('/disease_reports.php'),
        api.get('/alerts.php'),
      ]);

      if (feedRes.status === 'fulfilled') {
        setRecords(safeArray(feedRes.value.data));
      }
      if (diseaseRes.status === 'fulfilled') {
        setDiseaseScans(safeArray(diseaseRes.value.data));
      }
      if (alertsRes.status === 'fulfilled') {
        setAlerts(safeArray(alertsRes.value.data));
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
    return () => window.removeEventListener('shrim-feed-updated', handleUpdate);
  }, [loadData]);

  // Filter records for today and by selected pond
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.record_date === todayStr);
  const filteredTodayRecords = todayRecords.filter((r) => {
    if (selectedPondFilter === 'all') return true;
    return String(r.pond_id) === String(selectedPondFilter);
  });
  const totalAmountToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  const selectedPondObj = assignedPonds.find((p) => String(p.id) === String(selectedPondFilter));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3 className="fw-bold mb-1">Caretaker Dashboard</h3>
          <p className="text-muted mb-0">Welcome back, {user?.full_name || 'Caretaker'}! Here is your daily pond feeding overview.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => navigate('/caretaker/my-pond')}>
          <FaPlus /> Log Feeding
        </button>
      </div>

      {/* Summary Cards Row */}
      <div className="row g-3 mb-4">
        {/* Assigned Ponds */}
        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-bold">Assigned Ponds</span>
                <span className="badge bg-primary bg-opacity-10 text-primary p-2"><FaWater /></span>
              </div>
              <h3 className="fw-bold mb-1">{assignedPonds.length}</h3>
              <div className="d-flex flex-wrap gap-1 mt-2">
                {assignedPonds.map((pond) => (
                  <span
                    key={pond.id}
                    className={`badge ${selectedPondFilter === String(pond.id) ? 'bg-primary text-white' : 'bg-light text-dark border'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedPondFilter(String(pond.id))}
                  >
                    {pond.pond_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Feeding Count */}
        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-bold">Today's Feeding Logs</span>
                <span className="badge bg-success bg-opacity-10 text-success p-2"><FaUtensils /></span>
              </div>
              <h3 className="fw-bold mb-1">{filteredTodayRecords.length} entries</h3>
              <small className="text-muted">
                {selectedPondFilter === 'all' ? 'All assigned ponds' : selectedPondObj?.pond_name || 'Selected pond'}
              </small>
            </div>
          </div>
        </div>

        {/* Today's Total Feed Weight */}
        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-bold">Total Feed Today</span>
                <span className="badge bg-info bg-opacity-10 text-info p-2"><FaCheckCircle /></span>
              </div>
              <h3 className="fw-bold mb-1">{totalAmountToday.toFixed(1)} kg</h3>
              <small className="text-muted">
                {selectedPondFilter === 'all' ? 'All assigned ponds' : selectedPondObj?.pond_name || 'Selected pond'}
              </small>
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div className="col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted small fw-bold">Feeding Schedule</span>
                <span className="badge bg-warning bg-opacity-10 text-warning p-2"><FaClock /></span>
              </div>
              <h6 className="fw-bold mb-1 text-primary">5 Times Daily</h6>
              <small className="text-muted">6:00 AM • 9:00 AM • 12:00 PM • 3:00 PM • 6:00 PM</small>
            </div>
          </div>
        </div>
      </div>

      {/* Main Today's Feeding Section */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-0">Today's Feeding Records</h5>
              <small className="text-muted">
                {selectedPondFilter === 'all' ? `Showing all assigned ponds (${todayStr})` : `Filtered by ${selectedPondObj?.pond_name || 'Selected Pond'} (${todayStr})`}
              </small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="small fw-semibold text-muted mb-0">Filter Pond:</label>
              <select
                className="form-select form-select-sm w-auto fw-semibold border-primary bg-primary bg-opacity-10"
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
                + Add Log
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted">Loading today's feeding logs…</div>
          ) : filteredTodayRecords.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
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
                        <span className="badge bg-primary bg-opacity-10 text-primary fw-bold">
                          {r.feeding_time || '—'}
                        </span>
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
                        <small className="text-muted">{r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.record_date}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center bg-light rounded-3">
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

      {/* Disease Scans & Alerts Grid */}
      <div className="row g-3">
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Latest Disease Scan</h5>
              {diseaseScans.length > 0 ? (
                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3">
                  {diseaseScans[0].image_path && (
                    <img src={diseaseScans[0].image_path} alt="Scan" className="rounded" style={{ width: 50, height: 50, objectFit: 'cover' }} />
                  )}
                  <div>
                    <div className="fw-bold">{diseaseScans[0].disease_name}</div>
                    <small className="text-muted">Risk: <span className={`badge ${diseaseScans[0].risk_level === 'High' ? 'bg-danger' : 'bg-success'}`}>{diseaseScans[0].risk_level}</span> • Confidence: {diseaseScans[0].confidence_score}%</small>
                  </div>
                </div>
              ) : (
                <p className="text-muted mb-0">No disease scans recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Latest System Alerts</h5>
              {alerts.length > 0 ? (
                <div className="p-3 bg-light rounded-3">
                  <div className="fw-bold text-danger d-flex align-items-center gap-2">
                    <FaExclamationTriangle /> {alerts[0].title}
                  </div>
                  <small className="text-muted">{alerts[0].message}</small>
                </div>
              ) : (
                <p className="text-muted mb-0">No active alerts for your ponds.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

