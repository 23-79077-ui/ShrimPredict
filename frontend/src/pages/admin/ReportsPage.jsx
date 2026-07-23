import { useEffect, useState } from 'react';
import api, { safeArray, safeObject } from '../../services/api';

export default function ReportsPage() {
  const [reports, setReports] = useState({ disease: [], feeding: [], harvest: [] });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/reports.php');
        const data = safeObject(res.data, { disease: [], feeding: [], harvest: [] });
        setReports({
          disease: safeArray(data.disease),
          feeding: safeArray(data.feeding),
          harvest: safeArray(data.harvest),
        });
      } catch (error) {
        setReports({ disease: [], feeding: [], harvest: [] });
      }
    };
    load();
  }, []);

  return (
    <div>
      <div className="row g-3">
        {['disease', 'feeding', 'harvest'].map((type) => (
          <div key={type} className="col-md-4">
            <div className="info-card admin-compact-card h-100">
              <div className="card-body">
                <h5 className="card-title text-capitalize">{type} Reports</h5>
                <ul className="admin-list mb-0">
                  {reports[type].slice(0, 5).map((item) => (
                    <li key={item.id} className="admin-list-item px-0">
                      {item.disease_name || item.feed_type || item.recommendation || 'Report item'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
