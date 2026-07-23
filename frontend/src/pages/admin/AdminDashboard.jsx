import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { safeArray } from '../../services/api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { FaChartBar, FaVirus, FaWater, FaUtensils, FaSeedling, FaBell, FaUserTie } from 'react-icons/fa';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export default function AdminDashboard() {
  const [caretakers, setCaretakers] = useState([]);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('all');
  const [stats, setStats] = useState({});
  const [reports, setReports] = useState([]);

  // Load all registered caretakers
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.get('/users.php');
        const userList = safeArray(res.data.users || res.data);
        const caretakerList = userList.filter((u) => u.role === 'caretaker');
        setCaretakers(caretakerList);
      } catch (e) {
        setCaretakers([]);
      }
    };
    loadUsers();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (selectedCaretakerId !== 'all') {
        params.user_id = selectedCaretakerId;
      }
      const [statsRes, reportsRes] = await Promise.all([
        api.get('/dashboard.php', { params }),
        api.get('/disease_reports.php'),
      ]);
      setStats(statsRes.data || {});
      const fetchedReports = reportsRes.data;
      setReports(Array.isArray(fetchedReports) ? fetchedReports.slice(0, 5) : []);
    } catch (error) {
      console.error(error);
      setStats({});
      setReports([]);
    }
  }, [selectedCaretakerId]);

  useEffect(() => {
    fetchData();

    const handleFeedUpdated = () => fetchData();
    const handleStorageUpdate = (event) => {
      if (event.key === 'shrim-feed-updated') {
        fetchData();
      }
    };

    window.addEventListener('shrim-feed-updated', handleFeedUpdated);
    window.addEventListener('storage', handleStorageUpdate);
    const intervalId = window.setInterval(handleFeedUpdated, 10000);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleFeedUpdated);
      window.removeEventListener('storage', handleStorageUpdate);
      window.clearInterval(intervalId);
    };
  }, [fetchData]);

  const selectedCaretakerObj = caretakers.find((c) => String(c.id) === String(selectedCaretakerId));

  const cards = [
    { title: 'Total Ponds', value: stats.total_ponds || 0, icon: <FaWater /> },
    { title: 'Healthy Ponds', value: stats.healthy_ponds || 0, icon: <FaSeedling /> },
    { title: 'Disease Alerts', value: stats.disease_alerts || 0, icon: <FaVirus /> },
    { title: "Today's Feeding", value: `${stats.todays_feeding || 0} ponds`, icon: <FaUtensils /> },
    { title: 'Upcoming Harvest', value: stats.upcoming_harvest || 0, icon: <FaChartBar /> },
  ];

  const feedChart = stats.feed_chart?.labels?.length
    ? {
        labels: stats.feed_chart.labels,
        datasets: [{ label: 'Feed Consumption (kg)', data: stats.feed_chart.data || [], borderColor: '#0B2C5F', backgroundColor: 'rgba(11,44,95,0.12)', tension: 0.35 }],
      }
    : {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ label: 'Feed Consumption', data: [0, 0, 0, 0, 0, 0, 0], borderColor: '#0B2C5F', backgroundColor: 'rgba(11,44,95,0.12)', tension: 0.35 }],
      };

  const diseaseChart = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{ label: 'Disease Reports', data: [2, 1, 3, 2, 4, 2], backgroundColor: '#FF7A00' }],
  };

  const activityItems = Array.isArray(stats.recent_activity) && stats.recent_activity.length > 0
    ? stats.recent_activity
    : [
        { title: 'No feeding activity yet', message: 'Caretaker feeding logs will appear here as soon as they are submitted.', time: '—' },
      ];

  return (
    <div>
      {/* Caretaker Filter Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 bg-white p-3 rounded-3 shadow-sm border">
        <div>
          <h4 className="fw-bold mb-1">Admin Dashboard</h4>
          <p className="text-muted mb-0">Overview of farm operations, caretaker logs, and pond status.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="fw-bold small text-muted mb-0 d-flex align-items-center gap-1">
            <FaUserTie className="text-primary" /> Filter Caretaker:
          </label>
          <select
            className="form-select fw-semibold border-primary bg-primary bg-opacity-10"
            style={{ minWidth: 230 }}
            value={selectedCaretakerId}
            onChange={(e) => setSelectedCaretakerId(e.target.value)}
          >
            <option value="all">All Registered Caretakers ({caretakers.length})</option>
            {caretakers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.full_name} ({c.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCaretakerObj && (
        <div className="alert alert-info border-0 shadow-sm d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <strong>Filtering by Caretaker:</strong> {selectedCaretakerObj.full_name} ({selectedCaretakerObj.email})
            {selectedCaretakerObj.assigned_ponds?.length > 0 && (
              <span className="ms-2">
                • Assigned Ponds: {selectedCaretakerObj.assigned_ponds.map((p) => p.pond_name).join(', ')}
              </span>
            )}
          </div>
          <button className="btn btn-sm btn-outline-dark" onClick={() => setSelectedCaretakerId('all')}>
            Show All Caretakers
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metric-grid mb-4">
        {cards.map((card) => (
          <div key={card.title} className="metric-card">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <p className="text-muted mb-1 text-uppercase small">{card.title}</p>
                <h3 className="mb-0">{card.value}</h3>
              </div>
              <div className="metric-icon">{card.icon}</div>
            </div>
            <p className="text-muted mb-0">
              {selectedCaretakerId === 'all' ? 'All farm caretakers' : selectedCaretakerObj?.full_name}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="chart-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Feed Consumption</h5>
                  <p className="text-muted mb-0">
                    {selectedCaretakerId === 'all'
                      ? 'Weekly trends across all ponds.'
                      : `Weekly feed consumption by ${selectedCaretakerObj?.full_name}.`}
                  </p>
                </div>
                <Link to="/admin/feeding" className="btn btn-outline-primary btn-sm">Detailed view</Link>
              </div>
              <Line data={feedChart} />
            </div>
          </div>

          {/* Caretaker Activity Records Table */}
          <div className="activity-card mt-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Caretaker Feeding Records</h5>
                  <p className="text-muted mb-0">
                    {selectedCaretakerId === 'all'
                      ? 'Recent feeding entries logged by all registered caretakers.'
                      : `Feeding records logged by ${selectedCaretakerObj?.full_name}.`}
                  </p>
                </div>
                <FaUtensils className="text-primary" />
              </div>

              {activityItems.length > 0 && activityItems[0].pond_name ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Caretaker</th>
                        <th>Pond</th>
                        <th>Time Slot</th>
                        <th>Feed Product</th>
                        <th>Amount</th>
                        <th>Vitamin</th>
                        <th>Logged Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityItems.map((item) => (
                        <tr key={item.id}>
                          <td><span className="badge bg-primary bg-opacity-10 text-primary fw-bold">{item.recorded_by}</span></td>
                          <td><strong>{item.pond_name}</strong></td>
                          <td><span className="badge bg-secondary bg-opacity-10 text-dark">{item.feeding_time}</span></td>
                          <td>{item.feed_type}</td>
                          <td><span className="fw-bold">{item.amount_kg} kg</span></td>
                          <td>
                            {item.vitamin_name && item.vitamin_name !== 'None' ? (
                              <span className="badge bg-info bg-opacity-10 text-dark">{item.vitamin_name}</span>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                          <td><small className="text-muted">{item.time}</small></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {activityItems.map((item) => (
                    <li key={item.id || item.title} className="mb-3">
                      <p className="mb-1"><strong>{item.title}</strong></p>
                      <small className="text-muted">{item.message}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="chart-card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Disease Reports</h5>
                  <p className="text-muted mb-0">Alert volume for the last 6 months.</p>
                </div>
                <span className="badge badge-warning">Priority</span>
              </div>
              <Bar data={diseaseChart} />
            </div>
          </div>

          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Harvest Readiness</h5>
              <Doughnut data={{ labels: ['Ready', 'Pending'], datasets: [{ data: [68, 32], backgroundColor: ['#1FB567', '#EAF4FF'] }] }} />
              <p className="text-muted mt-3 mb-0">Projected readiness for next 30 days.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title">Recent Disease Scans</h5>
              <p className="text-muted mb-0">Review the latest detection entries and recommendations.</p>
            </div>
            <Link to="/admin/reports" className="btn btn-outline-primary btn-sm">See all</Link>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Disease</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{report.disease_name}</td>
                    <td><span className="badge badge-danger">{report.risk_level}</span></td>
                    <td>{report.status}</td>
                    <td>{new Date(report.report_date || report.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

