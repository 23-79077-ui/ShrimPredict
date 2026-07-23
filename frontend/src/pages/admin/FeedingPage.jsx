import { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { FaSeedling, FaWarehouse, FaClock, FaChartLine } from 'react-icons/fa';
import api, { safeArray } from '../../services/api';

export default function FeedingPage() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/feeding_records.php');
        setRecords(safeArray(res.data));
      } catch (error) {
        setRecords([]);
      }
    };
    load();
  }, []);

  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ label: 'Feed (kg)', data: [0, 0, 0, 0, 0, 0, 0], borderColor: '#0B2C5F', backgroundColor: 'rgba(11,44,95,0.14)', tension: 0.35 }],
  };

  const recentWeek = records.reduce((acc, record) => {
    const date = record.record_date || record.created_at;
    if (!date) return acc;
    const day = new Date(date).getDay();
    const adjusted = (day + 6) % 7;
    if (!Number.isNaN(adjusted)) {
      acc[adjusted] += Number(record.amount_kg) || 0;
    }
    return acc;
  }, Array(7).fill(0));

  weeklyData.datasets[0].data = recentWeek;

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlySeries = Array(12).fill(0);

  records.forEach((record) => {
    const date = record.record_date || record.created_at;
    if (!date) return;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return;
    const monthIndex = parsed.getMonth();
    monthlySeries[monthIndex] += Number(record.amount_kg) || 0;
  });

  const monthlyData = {
    labels: monthLabels,
    datasets: [{ label: 'Monthly Feed Usage', data: monthlySeries, backgroundColor: '#FF7A00' }],
  };

  const weeklyTotal = recentWeek.reduce((sum, value) => sum + value, 0);
  const latestRecord = records[0];
  const lastLoggedLabel = latestRecord
    ? `${latestRecord.pond_name || latestRecord.pond_id} • ${latestRecord.amount_kg} kg`
    : 'No recent logs';

  return (
    <div>
      <div className="dashboard-header mb-4">
        <div>
          <h1 className="mb-1">Feeding Consumption</h1>
          <p className="text-muted mb-0">Track feed usage, inventory levels, and upcoming schedules.</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaSeedling className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Weekly Feed</p>
                <h4 className="mb-0">{weeklyTotal.toFixed(1)} kg</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Optimized for current shrimp growth cycles.</p>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaWarehouse className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Feed Entries</p>
                <h4 className="mb-0">{records.length}</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Ready for the next 10 days.</p>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaClock className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Last Logged</p>
                <h4 className="mb-0">{lastLoggedLabel}</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Next feeding window for Pond 5.</p>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Weekly Feed Usage</h5>
              <Line data={weeklyData} />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Monthly Trend</h5>
              <Bar data={monthlyData} />
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title">Feeding History</h5>
              <p className="text-muted mb-0">Recent feed deliveries and pond consumption.</p>
            </div>
            <button className="btn btn-outline-primary btn-sm">Export CSV</button>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pond</th>
                  <th>Feed Type</th>
                  <th>Amount</th>
                  <th>Recorder</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.record_date}</td>
                    <td>{record.pond_name || record.pond_id}</td>
                    <td>{record.feed_type}</td>
                    <td>{record.amount_kg} kg</td>
                    <td>{record.recorded_by_name || record.recorded_by || 'Caretaker'}</td>
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
