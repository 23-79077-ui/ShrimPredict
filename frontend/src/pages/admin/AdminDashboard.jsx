import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { FaChartBar, FaVirus, FaWater, FaUtensils, FaSeedling, FaBell, FaChartLine } from 'react-icons/fa';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, reportsRes] = await Promise.all([
          api.get('/dashboard.php'),
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
    };

    fetchData();

    const handleFeedUpdated = () => {
      fetchData();
    };

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
  }, []);

  const cards = [
    { title: 'Total Ponds', value: stats.total_ponds || 0, icon: <FaWater /> },
    { title: 'Healthy Ponds', value: stats.healthy_ponds || 0, icon: <FaSeedling /> },
    { title: 'Disease Alerts', value: stats.disease_alerts || 0, icon: <FaVirus /> },
    { title: "Today's Feeding", value: `${stats.todays_feeding || 0} complete ponds`, icon: <FaUtensils /> },
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
            <p className="text-muted mb-0">{card.title === 'Disease Alerts' ? 'Monitor risk continuously' : 'Updated just now'}</p>
          </div>
        ))}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="chart-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Feed Consumption</h5>
                  <p className="text-muted mb-0">Weekly trends across all ponds.</p>
                </div>
                <Link to="/admin/feeding" className="btn btn-outline-primary btn-sm">Detailed view</Link>
              </div>
              <Line data={feedChart} />
            </div>
          </div>
          <div className="chart-card mt-4">
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
        </div>

        <div className="col-xl-4">
          <div className="activity-card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Recent Activity</h5>
                  <p className="text-muted mb-0">Latest farm events and system alerts.</p>
                </div>
                <FaBell className="text-muted" />
              </div>
              <ul className="list-unstyled mb-0">
                {activityItems.map((item) => (
                  <li key={item.id || item.title} className="mb-3">
                    <p className="mb-1"><strong>{item.title}</strong></p>
                    <small className="text-muted">{item.message}</small>
                  </li>
                ))}
              </ul>
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
              <h5 className="card-title">Recent Reports</h5>
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
                    <td>{new Date(report.report_date).toLocaleDateString()}</td>
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
