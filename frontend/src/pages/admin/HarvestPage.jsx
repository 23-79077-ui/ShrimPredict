import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  FaCalendarAlt,
  FaChartLine,
  FaExclamationTriangle,
  FaSeedling,
  FaWeightHanging,
  FaFileCsv,
  FaSync,
  FaWater
} from 'react-icons/fa';
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

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
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
        label: 'Feed Consumed (kg)',
        data: predictions.map((item) => Number(item.total_feed_consumed_kg || 0)),
        backgroundColor: '#0B2C5F',
        borderRadius: 6,
      },
      {
        label: 'Adjusted Harvest Est. (kg)',
        data: predictions.map((item) => Number(item.adjusted_harvest_kg || 0)),
        backgroundColor: '#EA580C',
        borderRadius: 6,
      },
    ],
  }), [predictions]);

  const progressData = useMemo(() => ({
    labels: predictions.map((item) => item.pond_name || `Pond ${item.pond_id}`),
    datasets: [
      {
        label: 'Feed Progress Toward Historical Baseline (%)',
        data: predictions.map((item) => Number(item.feed_progress_percentage || 0)),
        borderColor: '#EA580C',
        backgroundColor: 'rgba(234, 88, 12, 0.12)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#0B2C5F',
        pointBorderColor: '#FFFFFF',
        pointRadius: 4,
      },
    ],
  }), [predictions]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (predictions.length === 0) return;
    const headers = ['Pond,Caretaker,Total Feed (kg),ABW (g),Baseline Est (kg),Adjusted Est (kg),Est Tons,Progress (%),Readiness,Status\n'];
    const rows = predictions.map(
      (p) =>
        `"${p.pond_name || `Pond ${p.pond_id}`}","${p.caretaker_names || 'N/A'}",${p.total_feed_consumed_kg || 0},${p.average_weight || 0},${p.baseline_harvest_kg || 0},${p.adjusted_harvest_kg || 0},${p.predicted_harvest_tons || 0},${p.feed_progress_percentage || 0},"${p.readiness_status || ''}","${p.data_completeness_status || ''}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShrimpPredict_Harvest_Model_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 🌟 1. HERO BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
            style={{
              width: 50,
              height: 50,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #1E3A8A 100%)',
              color: '#FFFFFF',
              fontSize: '1.3rem',
              border: '2px solid rgba(234, 88, 12, 0.3)'
            }}
          >
            <FaWeightHanging />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Harvest Projections &amp; Biomass Intelligence
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
              >
                ● Feed-to-Yield Predictive Engine
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              Historical feed consumption modeling, expected commercial yield weight, and harvest schedule optimization.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadData}
          >
            <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> Refresh Data
          </button>

          <button
            type="button"
            className="btn btn-sm btn-tri-orange px-4 py-2 shadow-xs"
            style={{ height: 40, fontSize: '0.82rem' }}
            onClick={handleExportCSV}
          >
            <FaFileCsv size={13} className="me-1.5" /> Export Harvest CSV
          </button>
        </div>
      </div>

      {/* 🌟 2. 4 TRI-COLOR OPERATIONAL KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Predicted Harvest */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Predicted Yield Mass</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaWeightHanging size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(summary.adjusted_harvest_kg)}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Commercial Yield</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  {formatTons(summary.predicted_harvest_tons)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Feed Consumed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Total Feed Consumed</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaSeedling size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(summary.total_feed_consumed_kg)}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{ width: '88%', background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Caretaker Field Logs</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  Cumulative Cycle
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Average Feed Progress */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Historical Progress</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaChartLine size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatPct(summary.average_feed_progress_percentage)}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, summary.average_feed_progress_percentage || 0))}%`,
                    background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Target Completion</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  15,000 kg Benchmark
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Historical Baseline */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Per-Basin Benchmark</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaCalendarAlt size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(feedReferenceKg)}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Standard Target</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  ~{baselineHarvestTons} Tons Target
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 Filter Toolbar */}
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search harvest prediction, pond, caretaker..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onRefresh={() => {
          setSelectedCaretaker('all');
          setSelectedPond('all');
          loadData();
        }}
        loading={loading}
        tabs={[{ id: 'all', label: 'All Predictions', count: predictions.length }]}
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

      {/* Operational Disclaimer Alert */}
      <div
        className="p-3 mb-4 rounded-4 d-flex align-items-start gap-3 shadow-xs"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(234, 88, 12, 0.25)',
          borderLeft: '4px solid #EA580C'
        }}
      >
        <div className="rounded-circle p-2 flex-shrink-0" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
          <FaExclamationTriangle size={15} />
        </div>
        <div>
          <strong style={{ color: '#0B2C5F', fontSize: '0.9rem' }}>
            {data?.method || 'Caretaker Historical Feed-to-Harvest Baseline Model'}
          </strong>
          <div className="text-muted extra-small mt-0.5">
            Historical baseline: caretakers reported that {formatKg(feedReferenceKg)} feed per pond usually yields around {formatTons(baselineHarvestTons)} harvest.
            {' '}{data?.disclaimer || 'Harvest readiness is an operational estimate and must be confirmed by farm management.'}
          </div>
        </div>
      </div>

      {/* 🌟 3. CHARTS ROW */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-7">
          <div className="tri-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Feed-To-Harvest Estimate By Basin</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Correlation comparison between feed ration mass dispensed vs projected biomass output (kg).
                </p>
              </div>
              <span className="badge rounded-pill extra-small px-3 py-1 fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                Comparative Bar
              </span>
            </div>
            <div style={{ minHeight: 280 }}>
              <Bar
                data={feedVsHarvestData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { family: "'Poppins', sans-serif", weight: '600', size: 11 } } } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(11, 44, 95, 0.06)' } }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="tri-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Historical Feed Progress Trend</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Progress curve against the 15,000 kg standard production threshold.
                </p>
              </div>
              <span className="badge rounded-pill extra-small px-3 py-1 fw-bold" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
                Trajectory
              </span>
            </div>
            <div style={{ minHeight: 280 }}>
              <Line
                data={progressData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { family: "'Poppins', sans-serif", weight: '600', size: 11 } } } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { max: 100, grid: { color: 'rgba(11, 44, 95, 0.06)' } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 4. PREDICTION TABLE */}
      <div className="tri-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight d-flex align-items-center gap-2">
              <FaWater style={{ color: '#0B2C5F' }} /> Pond Harvest Readiness &amp; Sampling
            </h5>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              Showing {predictions.length} active pond predictions calculated by the telemetry model.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border" style={{ color: '#0B2C5F' }} role="status" />
            <p className="mt-2 mb-0 extra-small fw-semibold">Loading harvest telemetry...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table tri-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Production Basin</th>
                  <th>Caretaker</th>
                  <th>Feed Consumed</th>
                  <th>ABW (Sampling)</th>
                  <th>Baseline Yield</th>
                  <th>Adjusted Est.</th>
                  <th>Tons Target</th>
                  <th>Cycle Progress</th>
                  <th>Readiness</th>
                  <th>Data Integrity</th>
                  <th>Last Calculated</th>
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
                      <tr>
                        <td colSpan="11" className="text-muted text-center py-5">
                          No pond harvest predictions match the search query or filters.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((item) => (
                    <tr key={item.pond_id}>
                      <td>
                        <strong style={{ color: '#0B2C5F' }}>{item.pond_name || `Pond ${item.pond_id}`}</strong>
                        <div className="text-muted extra-small">{item.pond_condition_summary}</div>
                      </td>
                      <td className="small">{item.caretaker_names || 'Caretaker account'}</td>
                      <td>
                        <span className="fw-bold" style={{ color: '#0B2C5F' }}>{formatKg(item.total_feed_consumed_kg)}</span>
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill extra-small px-2.5 py-1 fw-bold"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        >
                          {Number(item.average_weight || 0) > 0 ? `${Number(item.average_weight).toFixed(1)} g` : '—'}
                        </span>
                      </td>
                      <td className="small">{formatKg(item.baseline_harvest_kg)}</td>
                      <td>
                        <strong style={{ color: '#EA580C' }}>{formatKg(item.adjusted_harvest_kg)}</strong>
                        <div className="text-muted extra-small">
                          Ref: {formatTons(item.target_harvest_tons || baselineHarvestTons)}
                        </div>
                      </td>
                      <td>
                        <span className="badge rounded-pill extra-small px-2.5 py-1 fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                          {formatTons(item.predicted_harvest_tons)}
                        </span>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="d-flex justify-content-between extra-small mb-1 font-mono">
                          <span className="fw-bold" style={{ color: '#EA580C' }}>{formatPct(item.feed_progress_percentage)}</span>
                          <span className="text-muted">{formatKg(item.remaining_feed_kg)} left</span>
                        </div>
                        <div className="tri-progress-track" style={{ height: 6 }}>
                          <div
                            className="tri-progress-bar"
                            style={{
                              width: `${Math.min(100, item.feed_progress_visual_percentage || 0)}%`,
                              background: 'linear-gradient(90deg, #EA580C, #F97316)'
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge rounded-pill extra-small px-2.5 py-1 fw-bold"
                          style={{
                            backgroundColor: String(item.readiness_status || '').toLowerCase().includes('ready') ? '#F0FDF4' : 'rgba(11, 44, 95, 0.08)',
                            color: String(item.readiness_status || '').toLowerCase().includes('ready') ? '#16A34A' : '#0B2C5F',
                            border: '1px solid rgba(11, 44, 95, 0.12)'
                          }}
                        >
                          {item.readiness_status}
                        </span>
                      </td>
                      <td className="extra-small text-muted">{item.data_completeness_status}</td>
                      <td className="extra-small text-muted font-mono">{item.calculated_at}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
