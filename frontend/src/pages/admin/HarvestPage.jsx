import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { FaCalendarAlt, FaChartLine, FaExclamationTriangle, FaSeedling, FaWeightHanging } from 'react-icons/fa';
import api, { safeArray } from '../../services/api';

const formatKg = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
const formatTons = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons`;
const formatPct = (value = 0) => `${Number(value || 0).toFixed(2)}%`;

export default function HarvestPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCaretaker, setSelectedCaretaker] = useState('all');
  const [selectedPond, setSelectedPond] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (selectedCaretaker !== 'all') params.caretaker_id = selectedCaretaker;
        if (selectedPond !== 'all') params.pond_id = selectedPond;
        const res = await api.get('/harvest_predictions.php', { params });
        setData(res.data || {});
      } catch (error) {
        setData({ predictions: [], summary: {} });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCaretaker, selectedPond]);

  const predictions = safeArray(data?.predictions);
  const caretakers = safeArray(data?.caretakers);
  const pondsList = safeArray(data?.ponds);
  const summary = data?.summary || {};
  const feedReferenceKg = data?.feed_reference_kg || summary.feed_reference_kg || 15000;
  const baselineHarvestTons = data?.target_harvest_tons || summary.target_harvest_tons_per_pond || 11;

  const feedVsHarvestData = useMemo(() => ({
    labels: predictions.map((item) => item.pond_name || `Pond ${item.pond_id}`),
    datasets: [
      {
        label: 'Total feed consumed (kg)',
        data: predictions.map((item) => Number(item.total_feed_consumed_kg || 0)),
        backgroundColor: '#0B2C5F',
      },
      {
        label: 'Adjusted harvest estimate (kg)',
        data: predictions.map((item) => Number(item.adjusted_harvest_kg || 0)),
        backgroundColor: '#1FB567',
      },
    ],
  }), [predictions]);

  const progressData = useMemo(() => ({
    labels: predictions.map((item) => item.pond_name || `Pond ${item.pond_id}`),
    datasets: [
      {
        label: 'Feed progress toward historical 15,000 kg baseline',
        data: predictions.map((item) => Number(item.feed_progress_percentage || 0)),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
        tension: 0.35,
      },
    ],
  }), [predictions]);

  return (
    <div>
      {/* FILTER TOOLBAR (Single Header handled by AdminLayout) */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 bg-white p-3 rounded-4 border shadow-xs">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold text-dark extra-small text-uppercase me-1">Filters:</span>
          <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1 extra-small fw-bold">
            Showing {predictions.length} Pond Prediction(s)
          </span>
        </div>

        <div className="d-flex align-items-center flex-wrap gap-3">
          {/* Per-Pond Filter */}
          <div className="d-flex align-items-center gap-2">
            <label className="form-label extra-small fw-bold text-muted mb-0" htmlFor="pondFilter">Pond:</label>
            <select
              id="pondFilter"
              className="form-select form-select-sm rounded-pill fw-bold border-primary text-primary bg-primary bg-opacity-10"
              style={{ width: 150 }}
              value={selectedPond}
              onChange={(event) => setSelectedPond(event.target.value)}
            >
              <option value="all">All Ponds</option>
              {pondsList.map((pond) => (
                <option key={pond.id} value={pond.id}>
                  {pond.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Caretaker Filter */}
          <div className="d-flex align-items-center gap-2">
            <label className="form-label extra-small fw-bold text-muted mb-0" htmlFor="caretakerFilter">Caretaker:</label>
            <select
              id="caretakerFilter"
              className="form-select form-select-sm rounded-pill fw-semibold border-secondary border-opacity-25"
              style={{ width: 170 }}
              value={selectedCaretaker}
              onChange={(event) => setSelectedCaretaker(event.target.value)}
            >
              <option value="all">All Caretakers</option>
              {caretakers.map((caretaker) => (
                <option key={caretaker.id} value={caretaker.id}>
                  {caretaker.full_name || `Caretaker ${caretaker.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="alert alert-warning d-flex align-items-start gap-2">
        <FaExclamationTriangle className="mt-1" />
        <div>
          <strong>{data?.method || 'Caretaker Historical Feed-to-Harvest Baseline'}</strong>
          <div className="small">
            Historical baseline: caretakers reported that {formatKg(feedReferenceKg)} feed per pond usually yields around {formatTons(baselineHarvestTons)} harvest.
            {' '}{data?.disclaimer || 'Harvest readiness is an operational estimate and must be confirmed by the farm administrator.'}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Predicted Harvest</span>
              <div className="rounded-3 p-2.5 bg-primary bg-opacity-10 text-primary fs-5">
                <FaWeightHanging />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{formatKg(summary.adjusted_harvest_kg)}</h3>
            <span className="text-muted extra-small">Current estimate: {formatTons(summary.predicted_harvest_tons)}</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Total Feed Consumed</span>
              <div className="rounded-3 p-2.5 bg-success bg-opacity-10 text-success fs-5">
                <FaSeedling />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{formatKg(summary.total_feed_consumed_kg)}</h3>
            <span className="text-muted extra-small">From caretaker feeding logs</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Average Feed Progress</span>
              <div className="rounded-3 p-2.5 bg-warning bg-opacity-10 text-warning fs-5">
                <FaChartLine />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{formatPct(summary.average_feed_progress_percentage)}</h3>
            <span className="text-muted extra-small">Historical {formatKg(feedReferenceKg)} feed baseline</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Historical Baseline</span>
              <div className="rounded-3 p-2.5 bg-info bg-opacity-10 text-info fs-5">
                <FaCalendarAlt />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{formatTons(baselineHarvestTons)}</h3>
            <span className="text-muted extra-small">Usual harvest at {formatKg(feedReferenceKg)} feed</span>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-7">
          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Feed-To-Harvest Estimate By Pond</h5>
              <Bar data={feedVsHarvestData} />
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <div className="chart-card">
            <div className="card-body">
              <h5 className="card-title mb-3">Feed Progress</h5>
              <Line data={progressData} />
            </div>
          </div>
        </div>
      </div>

      <div className="table-card mt-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Pond Prediction Results</h5>
          {loading ? (
            <div className="text-muted py-4">Loading harvest estimates...</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Pond</th>
                    <th>Caretaker</th>
                    <th>Total Feed</th>
                    <th>Baseline Estimate</th>
                    <th>Adjusted Estimate</th>
                    <th>Tons</th>
                    <th>Progress</th>
                    <th>Readiness</th>
                    <th>Data Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.length === 0 && (
                    <tr><td colSpan="10" className="text-muted">No pond feeding records found for this caretaker.</td></tr>
                  )}
                  {predictions.map((item) => (
                    <tr key={item.pond_id}>
                      <td>
                        <strong>{item.pond_name || `Pond ${item.pond_id}`}</strong>
                        <div className="text-muted small">{item.pond_condition_summary}</div>
                      </td>
                      <td>{item.caretaker_names || 'Caretaker account'}</td>
                      <td>{formatKg(item.total_feed_consumed_kg)}</td>
                      <td>{formatKg(item.baseline_harvest_kg)}</td>
                      <td>
                        {formatKg(item.adjusted_harvest_kg)}
                        <div className="text-muted small">
                          Baseline: {formatTons(item.target_harvest_tons || baselineHarvestTons)} at {formatKg(item.feed_reference_kg || feedReferenceKg)}
                        </div>
                      </td>
                      <td>{formatTons(item.predicted_harvest_tons)}</td>
                      <td style={{ minWidth: 150 }}>
                        <div className="d-flex justify-content-between small mb-1">
                          <span>{formatPct(item.feed_progress_percentage)}</span>
                          <span>{formatKg(item.remaining_feed_kg)} left</span>
                        </div>
                        <div className="progress" style={{ height: 8 }}>
                          <div className="progress-bar bg-warning" style={{ width: `${item.feed_progress_visual_percentage || 0}%` }} />
                        </div>
                      </td>
                      <td><span className="badge bg-primary">{item.readiness_status}</span></td>
                      <td>{item.data_completeness_status}</td>
                      <td>{item.calculated_at}</td>
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
