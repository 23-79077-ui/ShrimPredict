import { useEffect, useState } from 'react';
import api, { safeArray } from '../../services/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/alerts.php');
        setAlerts(safeArray(res.data));
      } catch (error) {
        setAlerts([]);
      }
    };
    load();
  }, []);

  return (
    <div>
      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title">Alert Queue</h5>
              <p className="text-muted mb-0">Recent farm warnings and system notices.</p>
            </div>
          </div>
          <ul className="admin-list mb-0">
            {alerts.map((alert) => (
              <li key={alert.id} className="admin-list-item">
                <div className="fw-semibold">{alert.title}</div>
                <div className="text-muted">{alert.message}</div>
                <span className={`badge mt-2 ${alert.severity === 'High' ? 'badge-danger' : 'badge-warning'}`}>{alert.severity}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
