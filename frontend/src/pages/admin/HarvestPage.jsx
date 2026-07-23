import { useEffect, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { FaSeedling, FaWeightHanging, FaCalendarAlt, FaRobot } from 'react-icons/fa';
import api, { safeArray } from '../../services/api';

export default function HarvestPage() {
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/harvest_predictions.php');
        setPredictions(safeArray(res.data));
      } catch (error) {
        setPredictions([]);
      }
    };
    load();
  }, []);

  const growthData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [{ label: 'Growth Curve', data: [120, 160, 210, 260, 310, 350], borderColor: '#0B2C5F', backgroundColor: 'rgba(11,44,95,0.12)', tension: 0.35 }],
  };

  const readinessData = {
    labels: ['Ready', 'Not Ready'],
    datasets: [{ data: [74, 26], backgroundColor: ['#1FB567', '#EAF4FF'] }],
  };

  return (
    <div>
      <div className="dashboard-header mb-4">
        <div>
          <h1 className="mb-1">Harvest Prediction</h1>
          <p className="text-muted mb-0">AI-driven estimates for weight, biomass, and harvest readiness.</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaWeightHanging className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Biomass</p>
                <h4 className="mb-0">1,420 kg</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Estimated total pond biomass.</p>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaSeedling className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Avg Shrimp Weight</p>
                <h4 className="mb-0">22 g</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Average live weight per shrimp.</p>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="metric-card">
            <div className="d-flex align-items-center gap-3 mb-3">
              <FaCalendarAlt className="text-primary" />
              <div>
                <p className="text-muted small mb-1">Harvest Date</p>
                <h4 className="mb-0">June 12, 2026</h4>
              </div>
            </div>
            <p className="text-muted mb-0">Projected harvest window.</p>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Growth Curve</h5>
              <Line data={growthData} />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="chart-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title">Harvest Readiness</h5>
                  <p className="text-muted mb-0">AI prediction confidence.</p>
                </div>
                <FaRobot className="text-muted" />
              </div>
              <Doughnut data={readinessData} />
            </div>
          </div>
        </div>
      </div>

      <div className="info-card">
        <div className="card-body">
          <h5 className="card-title mb-3">AI Recommendation</h5>
          <p className="text-muted mb-0">Adjust feed intake over the next two weeks and maintain stable dissolved oxygen levels to maximize harvest yield and shrimp survival.</p>
        </div>
      </div>

      <div className="table-card mt-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Prediction Results</h5>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Pond</th>
                  <th>Estimated Harvest</th>
                  <th>Avg Weight</th>
                  <th>Biomass</th>
                  <th>Forecast</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.pond_name || item.pond_id}</td>
                    <td>{item.estimated_harvest} kg</td>
                    <td>{item.average_weight} g</td>
                    <td>{item.biomass} kg</td>
                    <td>{item.recommendation}</td>
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
