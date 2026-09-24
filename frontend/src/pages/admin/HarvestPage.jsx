import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { FaCalendarAlt, FaChartLine, FaExclamationTriangle, FaSeedling, FaWeightHanging } from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';

const formatKg = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
const formatTons = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons`;
const formatPct = (value = 0) => `${Number(value || 0).toFixed(2)}%`;

export default function HarvestPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
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
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search harvest prediction, pond, caretaker..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onRefresh={() => {
          setSelectedCaretaker('all');
          setSelectedPond('all');
        }}
        loading={loading}
        tabs={[
          { id: 'all', label: 'All Predictions', count: predictions.length }
        ]}
        activeTab="all"
        metaRight={
          <>
            Harvest Model: <strong>Feed-to-Harvest Baseline Intelligence</strong>
          </>
        }
        filterFields={[
          {
            label: 'Production Basin',
            type: 'select',
            value: selectedPond,
            onChange: setSelectedPond,
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: 'All Ponds' },
              ...pondsList.map((p) => ({ value: p.id, label: p.pond_name }))
            ]
          },
          {
            label: 'Assigned Caretaker',
            type: 'select',
            value: selectedCaretaker,
            onChange: setSelectedCaretaker,
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: 'All Caretakers' },
              ...caretakers.map((c) => ({ value: c.id, label: c.full_name || `Caretaker ${c.id}` }))
            ]
          }
        ]}
        onResetFilters={() => {
          setSearchQuery('');
          setSelectedPond('all');
          setSelectedCaretaker('all');
        }}
      />

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
          <div className="card stat-card-cyan shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Predicted Harvest</span>
              <div className="rounded-3 p-2.5 bg-primary bg-opacity-10 text-primary fs-5">
                <FaWeightHanging />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{formatKg(summary.adjusted_harvest_kg)}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Current estimate: {formatTons(summary.predicted_harvest_tons)}</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card-green shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Total Feed Consumed</span>
              <div className="rounded-3 p-2.5 bg-success bg-opacity-10 text-success fs-5">
                <FaSeedling />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{formatKg(summary.total_feed_consumed_kg)}</h3>
            <span className="text-muted extra-small d-block pb-0.5">From caretaker feeding logs</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card-orange shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Average Feed Progress</span>
              <div className="rounded-3 p-2.5 bg-warning bg-opacity-10 text-warning fs-5">
                <FaChartLine />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{formatPct(summary.average_feed_progress_percentage)}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Historical {formatKg(feedReferenceKg)} feed baseline</span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card stat-card-purple shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Historical Baseline</span>
              <div className="rounded-3 p-2.5 bg-info bg-opacity-10 text-info fs-5">
                <FaCalendarAlt />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{formatKg(feedReferenceKg)}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Reference target amount</span>
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
                    <th>ABW (Sampling)</th>
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
                  {(() => {
                    const filtered = predictions.filter((item) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        String(item.pond_name || '').toLowerCase().includes(q) ||
                        String(item.caretaker_names || '').toLowerCase().includes(q) ||
                        String(item.readiness_status || '').toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr><td colSpan="11" className="text-muted text-center py-4">No pond harvest predictions match the search query or filters.</td></tr>
                      );
                    }

                    return filtered.map((item) => (
                    <tr key={item.pond_id}>
                      <td>
                        <strong>{item.pond_name || `Pond ${item.pond_id}`}</strong>
                        <div className="text-muted small">{item.pond_condition_summary}</div>
                      </td>
                      <td>{item.caretaker_names || 'Caretaker account'}</td>
                      <td>{formatKg(item.total_feed_consumed_kg)}</td>
                      <td>
                        <span className="badge bg-success bg-opacity-10 text-success fw-bold px-2.5 py-1">
                          {Number(item.average_weight || 0) > 0 ? `${Number(item.average_weight).toFixed(1)} g` : '—'}
                        </span>
                      </td>
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
                  ));
                })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
