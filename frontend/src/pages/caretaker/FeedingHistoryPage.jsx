import { useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaFilter, FaLeaf, FaTint, FaUtensils, FaWater } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

export default function FeedingHistoryPage() {
  const { user } = useAuth();
  const assignedPonds = useMemo(() => (
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond' }] : [])
  ), [user?.assigned_ponds, user?.pond_id]);
  const assignedPondIds = useMemo(() => (
    Array.from(new Set([...(assignedPonds.map((pond) => pond.id) || []), user?.pond_id].filter(Boolean).map(Number)))
  ), [assignedPonds, user?.pond_id]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');

  useEffect(() => {
    const loadHistory = async () => {
      if (!assignedPondIds.length) {
        setRecords([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const params = {
          user_id: user?.id || 0,
          recorded_by_name: user?.full_name || '',
        };

        if (selectedPondFilter !== 'all') {
          params.pond_id = selectedPondFilter;
        }

        const res = await api.get('/feeding_records.php', { params });
        const filtered = safeArray(res.data).filter((record) => {
          const recordUserId = record.user_id ?? record.userId;
          const recordName = record.recorded_by_name ?? record.recordedByName;
          if (user?.id && Number(recordUserId) === Number(user.id)) return true;
          if (user?.full_name && recordName === user.full_name) return true;
          return assignedPondIds.includes(Number(record.pond_id));
        });

        setRecords(filtered);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Unable to load feeding history.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [assignedPondIds, selectedPondFilter, user?.id, user?.full_name]);

  const selectedPond = assignedPonds.find((pond) => String(pond.id) === String(selectedPondFilter));
  const currentScope = selectedPondFilter === 'all' ? 'All assigned ponds' : selectedPond?.pond_name || 'Selected pond';
  const totalFeedKg = records.reduce((sum, record) => sum + (parseFloat(record.amount_kg) || 0), 0);
  const pondsWithRecords = new Set(records.map((record) => String(record.pond_id || record.pond_name || '')).filter(Boolean)).size;
  const vitaminLogs = records.filter((record) => record.has_vitamin || (record.vitamin_name && record.vitamin_name !== 'None')).length;
  const latestRecord = records[0];

  return (
    <div className="caretaker-history-page">
      <section className="caretaker-dashboard-hero caretaker-history-hero">
        <div>
          <span className="caretaker-dashboard-kicker">Caretaker Feeding Records</span>
          <h3>Feeding History</h3>
          <p>Review feed consumption, vitamins, product type, and pond activity from your submitted feeding logs.</p>
          <div className="caretaker-hero-meta">
            <span>{currentScope}</span>
            <span>{records.length} log(s)</span>
            <span>{totalFeedKg.toFixed(1)} kg consumed</span>
          </div>
        </div>
        <div className="caretaker-history-filter">
          <label><FaFilter /> Pond Filter</label>
          <select
            className="form-select form-select-sm fw-semibold"
            value={selectedPondFilter}
            onChange={(event) => setSelectedPondFilter(event.target.value)}
          >
            <option value="all">All Assigned Ponds</option>
            {assignedPonds.map((pond) => (
              <option key={pond.id} value={pond.id}>
                {pond.pond_name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-cyan h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Total Feed Consumption</span>
                <span className="caretaker-stat-icon"><FaUtensils /></span>
              </div>
              <h3>{totalFeedKg.toFixed(1)} kg</h3>
              <small className="text-muted">{currentScope}</small>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-green h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Total Logs</span>
                <span className="caretaker-stat-icon"><FaCalendarAlt /></span>
              </div>
              <h3>{records.length}</h3>
              <small className="text-muted">Submitted caretaker records</small>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-blue h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Ponds With Logs</span>
                <span className="caretaker-stat-icon"><FaWater /></span>
              </div>
              <h3>{pondsWithRecords}</h3>
              <small className="text-muted">Within the selected filter</small>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-amber h-100">
            <div className="card-body">
              <div className="caretaker-stat-top">
                <span>Vitamin Logs</span>
                <span className="caretaker-stat-icon"><FaLeaf /></span>
              </div>
              <h3>{vitaminLogs}</h3>
              <small className="text-muted">{latestRecord?.record_date ? `Latest: ${latestRecord.record_date}` : 'No latest record yet'}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="card caretaker-panel-card">
        <div className="card-body">
          <div className="caretaker-panel-header">
            <div>
              <h5>Feeding Log Records</h5>
              <small className="text-muted">Filtered by {currentScope}</small>
            </div>
            <div className="caretaker-history-total">
              <FaTint />
              <span>{totalFeedKg.toFixed(1)} kg total feed</span>
            </div>
          </div>

          {loading ? (
            <div className="caretaker-empty-state">Loading feeding history...</div>
          ) : error ? (
            <div className="alert alert-danger mb-0">{error}</div>
          ) : records.length === 0 ? (
            <div className="caretaker-empty-state">No feeding records found for {currentScope} yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table caretaker-record-table caretaker-history-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pond</th>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Feed</th>
                    <th>Vitamin</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.record_date}</strong>
                      </td>
                      <td>{record.pond_name || `Pond ${record.pond_id}`}</td>
                      <td>
                        <span className="caretaker-time-badge">{record.feeding_time || '-'}</span>
                      </td>
                      <td>
                        <span className="fw-bold">{Number(record.amount_kg || 0).toFixed(2)} kg</span>
                      </td>
                      <td>{record.feed_type || record.product_code || 'Tateh'}</td>
                      <td>
                        {record.vitamin_name && record.vitamin_name !== 'None' ? (
                          <span className="badge bg-info bg-opacity-10 text-dark fw-semibold">{record.vitamin_name}</span>
                        ) : record.has_vitamin ? (
                          <span className="badge bg-success bg-opacity-10 text-success fw-semibold">Yes</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td className="text-muted">{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
