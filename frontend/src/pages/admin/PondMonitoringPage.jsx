import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FaTemperatureHigh, FaTint, FaWater, FaArrowUp, FaChartLine } from 'react-icons/fa';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import api from '../../services/api';
import Swal from 'sweetalert2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function PondMonitoringPage() {
  const [ponds, setPonds] = useState([]);
  const [form, setForm] = useState({ pond_name: '', location: '', temperature: '', ph_level: '', salinity: '', dissolved_oxygen: '', water_level: '', status: 'Healthy' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const qualityChart = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Temperature',
        data: [27, 28, 28.5, 28, 27.8, 28.2, 27.9],
        borderColor: '#0B2C5F',
        backgroundColor: 'rgba(11,44,95,0.12)',
        tension: 0.35,
      },
      {
        label: 'Dissolved O₂',
        data: [6.2, 6.4, 6.5, 6.3, 6.6, 6.5, 6.4],
        borderColor: '#FF7A00',
        backgroundColor: 'rgba(255,122,0,0.12)',
        tension: 0.35,
      },
    ],
  };

  const loadPonds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ponds.php');
      const responseData = res?.data;
      const pondArray = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData?.ponds)
        ? responseData.ponds
        : [];
      setPonds(pondArray);
    } catch (err) {
      setError(err.message || 'Unable to load pond data.');
      setPonds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPonds(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ponds.php', form);
      Swal.fire({ icon: 'success', title: 'Pond saved' });
      setForm({ pond_name: '', location: '', temperature: '', ph_level: '', salinity: '', dissolved_oxygen: '', water_level: '', status: 'Healthy' });
      loadPonds();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
    }
  };

  return (
    <div>
      <div className="dashboard-header mb-4">
        <div>
          <h1 className="mb-1">Pond Monitoring</h1>
          <p className="text-muted mb-0">Water quality metrics, pond status, and recent records in one view.</p>
        </div>
      </div>

      <div className="chart-card mb-4">
        <div className="card-body">
          <h5 className="card-title mb-4">Pond Overview</h5>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="metric-card p-3">
                <p className="text-muted small mb-1">Temperature</p>
                <div className="d-flex align-items-center gap-2">
                  <FaTemperatureHigh />
                  <strong>28°C</strong>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card p-3">
                <p className="text-muted small mb-1">pH Level</p>
                <div className="d-flex align-items-center gap-2">
                  <FaTint />
                  <strong>7.8</strong>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card p-3">
                <p className="text-muted small mb-1">Dissolved Oxygen</p>
                <div className="d-flex align-items-center gap-2">
                  <FaWater />
                  <strong>6.4 mg/L</strong>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card p-3">
                <p className="text-muted small mb-1">Water Level</p>
                <div className="d-flex align-items-center gap-2">
                  <FaArrowUp />
                  <strong>120 cm</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="chart-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Quality Trend</h5>
                  <p className="text-muted mb-0">Temperature and oxygen level changes over time.</p>
                </div>
                <span className="badge badge-soft">Updated</span>
              </div>
              <Line data={qualityChart} />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="status-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Current Pond Status</h5>
              <div className="d-flex align-items-center justify-content-between mb-4">
                <span className="badge badge-success">Healthy</span>
                <small className="text-muted">Monitored 3 mins ago</small>
              </div>
              <p className="text-muted">All water quality parameters are within the optimal range. Continue feeding schedule and weekly checks.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title">Recent Pond Records</h5>
              <p className="text-muted mb-0">Latest entries for all monitored ponds.</p>
            </div>
            <button className="btn btn-outline-primary btn-sm">View full log</button>
          </div>
          <div className="table-responsive">
            {loading ? (
              <div className="text-center py-5 text-muted">Loading pond records…</div>
            ) : error ? (
              <div className="text-center py-5 text-danger">{error}</div>
            ) : ponds.length === 0 ? (
              <div className="text-center py-5 text-muted">No pond data available yet.</div>
            ) : (
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Pond</th>
                    <th>Temp</th>
                    <th>pH</th>
                    <th>DO</th>
                    <th>Salinity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ponds.map((pond) => (
                    <tr key={pond.id || pond.pond_name || Math.random()}>
                      <td>{pond.pond_name || '—'}</td>
                      <td>{pond.temperature ? `${pond.temperature}°C` : '—'}</td>
                      <td>{pond.ph_level ?? '—'}</td>
                      <td>{pond.dissolved_oxygen ? `${pond.dissolved_oxygen} mg/L` : '—'}</td>
                      <td>{pond.salinity ? `${pond.salinity} ppt` : '—'}</td>
                      <td>
                        <span className={`badge ${pond.status === 'Healthy' ? 'badge-success' : pond.status === 'Warning' ? 'badge-warning' : 'badge-danger'}`}>
                          {pond.status || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
