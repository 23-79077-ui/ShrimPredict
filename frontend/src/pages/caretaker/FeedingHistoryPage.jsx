import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function FeedingHistoryPage() {
  const { user } = useAuth();
  const assignedPonds = user?.assigned_ponds?.length
    ? user.assigned_ponds
    : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond' }] : []);
  const assignedPondIds = Array.from(new Set([...(user?.assigned_ponds?.map((pond) => pond.id) || []), user?.pond_id].filter(Boolean)));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');

  useEffect(() => {
    const loadHistory = async () => {
      if (!assignedPondIds.length) {
        setLoading(false);
        return;
      }

      try {
        const params = {
          user_id: user?.id || 0,
          recorded_by_name: user?.full_name || '',
        };

        if (selectedPondFilter && selectedPondFilter !== 'all') {
          params.pond_id = selectedPondFilter;
        }

        const res = await api.get('/feeding_records.php', { params });
        const data = Array.isArray(res.data) ? res.data : [];
        const filtered = data.filter((record) => {
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="fw-bold mb-0">Feeding History</h3>
        <select
          className="form-select form-select-sm w-auto"
          value={selectedPondFilter}
          onChange={(e) => setSelectedPondFilter(e.target.value)}
        >
          <option value="all">All ponds</option>
          {assignedPonds.map((pond) => (
            <option key={pond.id} value={pond.id}>{pond.pond_name}</option>
          ))}
        </select>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">Loading feeding history…</div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-4 text-muted">No feeding records found for this pond yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pond</th>
                    <th>Time</th>
                    <th>Amount (kg)</th>
                    <th>Feed</th>
                    <th>Vitamin</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.record_date}</td>
                      <td>{record.pond_name || `Pond ${record.pond_id}`}</td>
                      <td>{record.feeding_time || '—'}</td>
                      <td>{record.amount_kg} kg</td>
                      <td>{record.feed_type}</td>
                      <td>
                        {record.vitamin_name && record.vitamin_name !== 'None' ? (
                          <span className="badge bg-info bg-opacity-10 text-dark fw-semibold">{record.vitamin_name}</span>
                        ) : record.has_vitamin ? (
                          'Yes'
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>{record.notes || '—'}</td>
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
