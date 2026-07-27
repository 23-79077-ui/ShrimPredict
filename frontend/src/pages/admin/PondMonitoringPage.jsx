import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  FaBug,
  FaCalendarAlt,
  FaChartPie,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileCsv,
  FaFilter,
  FaFlask,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaRulerVertical,
  FaSearch,
  FaSync,
  FaThermometerHalf,
  FaTimesCircle,
  FaUser,
  FaUtensils,
  FaVial,
  FaWater,
  FaWeightHanging,
  FaWind,
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const emptySummary = {
  total_ponds: 0,
  healthy_ponds: 0,
  warning_ponds: 0,
  critical_ponds: 0,
  average_feed_today: 0,
  average_pond_age: 0,
  disease_alerts: 0,
  pie_chart: { healthy_pct: 0, warning_pct: 0, critical_pct: 0 },
};

const statusClass = {
  Healthy: 'success',
  Warning: 'warning',
  Critical: 'danger',
};

function valueOrDash(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}${suffix}`;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function isDiseaseAlert(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized && normalized !== 'healthy' && normalized !== 'none' && normalized !== 'no disease detected';
}

function MetricCard({ title, value, detail, icon, tone = 'primary' }) {
  return (
    <div className={`metric-card p-3 h-100 border-start border-4 border-${tone}`}>
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div>
          <p className="small text-muted fw-semibold mb-1">{title}</p>
          <h3 className={`fw-bold text-${tone === 'warning' ? 'dark' : tone} mb-1`}>{value}</h3>
          <small className="text-muted">{detail}</small>
        </div>
        <div className={`metric-icon bg-${tone} bg-opacity-10 text-${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

function WaterMetric({ icon, label, value, tone = 'primary' }) {
  return (
    <div className="col-6 col-lg">
      <div className="p-3 rounded-3 bg-light border h-100">
        <div className={`text-${tone} mb-2`}>{icon}</div>
        <small className="text-muted text-uppercase fw-bold d-block">{label}</small>
        <strong className="text-dark">{value}</strong>
      </div>
    </div>
  );
}

export default function PondMonitoringPage() {
  const [ponds, setPonds] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPond, setSelectedPond] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');
  const [caretakerFilter, setCaretakerFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(true);

  const loadPondData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ponds.php');
      if (!res.data?.success || !Array.isArray(res.data.ponds)) {
        throw new Error(res.data?.message || 'Invalid pond monitoring response.');
      }
      setPonds(res.data.ponds);
      setSummary({ ...emptySummary, ...(res.data.summary || {}) });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to fetch pond records.');
      setPonds([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPondData();
  }, []);

  const uniqueCaretakers = useMemo(
    () => Array.from(new Set(ponds.map((p) => p.assigned_caretaker_name).filter(Boolean))).sort(),
    [ponds]
  );

  const filteredPonds = useMemo(() => ponds.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = [p.pond_name, p.location, p.assigned_caretaker_name].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (diseaseFilter === 'Clear' && isDiseaseAlert(p.disease_detection)) return false;
    if (diseaseFilter === 'Alert' && !isDiseaseAlert(p.disease_detection)) return false;
    if (caretakerFilter !== 'All' && p.assigned_caretaker_name !== caretakerFilter) return false;
    return true;
  }), [ponds, searchQuery, statusFilter, diseaseFilter, caretakerFilter]);

  const pieData = {
    labels: ['Healthy', 'Warning', 'Critical'],
    datasets: [{
      data: [
        summary.pie_chart?.healthy_pct || 0,
        summary.pie_chart?.warning_pct || 0,
        summary.pie_chart?.critical_pct || 0,
      ],
      backgroundColor: ['#1FB567', '#FF7A00', '#E04848'],
      borderColor: '#ffffff',
      borderWidth: 3,
    }],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } },
    },
    cutout: '64%',
  };

  const handleExportCSV = () => {
    if (!filteredPonds.length) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No pond records match the current filters.' });
      return;
    }

    const headers = [
      'Pond Name', 'Location', 'Status', 'Assigned Caretaker', 'Area (sqm)', 'Stocking Date',
      'Age (Days)', 'Growth (%)', 'Feed Today (kg)', 'Total Feed (kg)', 'Disease Detection',
      'Confidence (%)', 'Harvest Readiness (%)', 'Expected Harvest Date', 'Temperature',
      'pH Level', 'Salinity', 'Dissolved Oxygen', 'Water Level', 'Latest Feed Date',
    ];
    const rows = filteredPonds.map((p) => [
      p.pond_name, p.location, p.status, p.assigned_caretaker_name, p.area_sqm, p.stocking_date,
      p.current_age_days, p.growth_percentage, p.feed_today_kg, p.total_feed_kg, p.disease_detection,
      p.disease_confidence, p.harvest_readiness, p.expected_harvest_date, p.temperature,
      p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level, p.latest_feed_date,
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`));

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShrimPredict_Pond_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setDiseaseFilter('All');
    setCaretakerFilter('All');
  };

  return (
    <div className="pb-4">
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
          <div className="position-relative flex-grow-1" style={{ maxWidth: 560 }}>
            <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 16 }} />
            <input
              className="form-control ps-5"
              placeholder="Search pond, location, or caretaker"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="d-flex flex-wrap gap-2 admin-actions">
            <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => setShowFilters((show) => !show)}>
              <FaFilter /> Filters
            </button>
            <button className="btn btn-outline-success d-flex align-items-center gap-2" onClick={handleExportCSV}>
              <FaFileCsv /> Export CSV
            </button>
            <button className="btn btn-primary d-flex align-items-center gap-2" onClick={loadPondData} disabled={loading}>
              <FaSync /> Refresh
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="row g-3 mt-3 pt-3 border-top">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Pond Status</label>
              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Warning">Warning</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-muted">Disease Detection</label>
              <select className="form-select" value={diseaseFilter} onChange={(event) => setDiseaseFilter(event.target.value)}>
                <option value="All">All detections</option>
                <option value="Clear">Clear only</option>
                <option value="Alert">Alerts only</option>
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-muted">Assigned Caretaker</label>
              <select className="form-select" value={caretakerFilter} onChange={(event) => setCaretakerFilter(event.target.value)}>
                <option value="All">All caretakers</option>
                {uniqueCaretakers.map((caretaker) => <option key={caretaker} value={caretaker}>{caretaker}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              <button className="btn btn-light border w-100" onClick={clearFilters}>Clear</button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4">
          <FaTimesCircle /> {error}
        </div>
      )}

      <div className="row g-3 mb-4">
        {/* Total Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Total Ponds</span>
              <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary">
                <FaLayerGroup size={14} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.total_ponds}</h3>
            <small className="text-muted extra-small">Monitored Ponds</small>
          </div>
        </div>

        {/* Healthy Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-success">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Healthy Ponds</span>
              <span className="badge bg-success bg-opacity-10 text-success rounded-pill">🟢 Safe</span>
            </div>
            <h3 className="fw-bold text-success mb-0">{summary.healthy_ponds}</h3>
            <small className="text-muted extra-small">Optimal Water</small>
          </div>
        </div>

        {/* Warning Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-warning">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Warning</span>
              <span className="badge bg-warning bg-opacity-10 text-warning rounded-pill">🟡 Watch</span>
            </div>
            <h3 className="fw-bold text-warning mb-0">{summary.warning_ponds}</h3>
            <small className="text-muted extra-small">Sub-optimal Water</small>
          </div>
        </div>

        {/* Critical Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-danger">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Critical</span>
              <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill">🔴 Alert</span>
            </div>
            <h3 className="fw-bold text-danger mb-0">{summary.critical_ponds}</h3>
            <small className="text-muted extra-small">Action Required</small>
          </div>
        </div>

        {/* Avg Feed Today */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Avg Feed Today</span>
              <div className="p-2 rounded-circle bg-info bg-opacity-10 text-info">
                <FaUtensils size={14} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.average_feed_today} <span className="fs-6 text-muted font-normal">kg</span></h3>
            <small className="text-muted extra-small">Daily Consumption</small>
          </div>
        </div>

        {/* Avg Pond Age */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold">Avg Pond Age</span>
              <div className="p-2 rounded-circle bg-secondary bg-opacity-10 text-secondary">
                <FaCalendarAlt size={14} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.average_pond_age} <span className="fs-6 text-muted font-normal">Days</span></h3>
            <small className="text-muted extra-small">Culture Days (DOC)</small>
          </div>
        </div>
      </div>

      {/* 🌊 POND MONITORING TABLE CARD (FULL WIDTH COL-12 WITH STICKY HEADER & MAX 10 ROWS VISIBLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border border-primary border-opacity-20 shadow-sm rounded-4 bg-white position-relative overflow-hidden">
            <div className="position-absolute top-0 start-0 end-0 bg-primary" style={{ height: 4 }} />
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <FaWater className="text-primary" /> Pond Monitoring
                  </h5>
                  <p className="small text-muted mb-0">Showing {filteredPonds.length} of {ponds.length} database records.</p>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="mt-2 mb-0">Loading pond records...</p>
                </div>
              ) : filteredPonds.length === 0 ? (
                <div className="text-center py-5 bg-light rounded-4 border">
                  <FaWater className="fs-2 text-muted mb-2" />
                  <h6 className="fw-bold">No ponds found</h6>
                  <p className="small text-muted mb-0">No database records match the current filters.</p>
                </div>
              ) : (
                /* 📜 Scrollable container displaying ~10 rows before vertical scroll bar appears */
                <div className="table-responsive border rounded-3 shadow-xs" style={{ maxHeight: 540, overflowY: 'auto' }}>
                  <table className="table align-middle mb-0">
                    <thead className="table-light sticky-top shadow-xs" style={{ top: 0, zIndex: 5 }}>
                      <tr>
                        <th className="ps-3 py-3 text-secondary text-uppercase extra-small fw-bold">Pond</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Status</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Caretaker</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Water Quality</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Feed Consumption</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Disease Alert</th>
                        <th className="pe-3 py-3 text-secondary text-uppercase extra-small fw-bold text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPonds.map((pond) => {
                        const tone = statusClass[pond.status] || 'secondary';
                        return (
                          <tr key={pond.id}>
                            <td className="ps-3">
                              <div className="fw-bold text-dark">{pond.pond_name}</div>
                              <small className="text-muted"><FaMapMarkerAlt className="me-1 text-primary" />{valueOrDash(pond.location)}</small>
                            </td>
                            <td>
                              <span className={`badge bg-${tone} ${tone === 'warning' ? 'text-dark' : ''} px-2.5 py-1.5 fw-bold`}>
                                {pond.status || '-'}
                              </span>
                            </td>
                            <td className="fw-medium text-dark">{valueOrDash(pond.assigned_caretaker_name)}</td>
                            <td>
                              <small className="d-block text-secondary">Temp: <strong className="text-dark">{valueOrDash(pond.temperature, ' °C')}</strong></small>
                              <small className="d-block text-secondary">pH: <strong className="text-dark">{valueOrDash(pond.ph_level)}</strong></small>
                              <small className="d-block text-secondary">DO: <strong className="text-dark">{valueOrDash(pond.dissolved_oxygen, ' mg/L')}</strong></small>
                            </td>
                            <td>
                              <small className="d-block text-secondary">Today: <strong className="text-dark">{formatNumber(pond.feed_today_kg)} kg</strong></small>
                              <small className="d-block text-secondary">Total: <strong className="text-dark">{formatNumber(pond.total_feed_kg)} kg</strong></small>
                            </td>
                            <td>
                              {isDiseaseAlert(pond.disease_detection) ? (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 fw-bold">
                                  {pond.disease_detection}
                                </span>
                              ) : (
                                <span className="badge bg-success bg-opacity-10 text-success px-2.5 py-1.5 fw-bold">Clear</span>
                              )}
                            </td>
                            <td className="pe-3 text-end">
                              <button
                                className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold shadow-xs"
                                onClick={() => setSelectedPond(pond)}
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📊 HEALTH DISTRIBUTION CARD (PLACED DIRECTLY BELOW POND MONITORING TABLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border border-info border-opacity-25 shadow-sm rounded-4 bg-white position-relative overflow-hidden">
            <div className="position-absolute top-0 start-0 end-0 bg-info" style={{ height: 4 }} />
            <div className="card-body p-4">
              <div className="row align-items-center gy-4">
                <div className="col-lg-5 text-center text-lg-start">
                  <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2 justify-content-center justify-content-lg-start">
                    <FaChartPie className="text-info" /> Health Distribution
                  </h5>
                  <p className="small text-muted mb-4">Computed overall health status breakdown across all monitored ponds.</p>
                  <div className="d-flex flex-column gap-2.5">
                    <div className="p-3 rounded-4 bg-success bg-opacity-10 border border-success border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-success d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-success"></span> Healthy Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-success d-block">{summary.pie_chart?.healthy_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.healthy_ponds || 0} Ponds</small>
                      </div>
                    </div>

                    <div className="p-3 rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-warning-emphasis d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-warning"></span> Warning Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-warning-emphasis d-block">{summary.pie_chart?.warning_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.warning_ponds || 0} Ponds</small>
                      </div>
                    </div>

                    <div className="p-3 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-danger d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-danger"></span> Critical Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-danger d-block">{summary.pie_chart?.critical_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.critical_ponds || 0} Ponds</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-7 d-flex justify-content-center align-items-center">
                  <div
                    className="p-4 rounded-4 border border-info border-opacity-25 bg-light bg-opacity-50 shadow-xs w-100 d-flex flex-column align-items-center justify-content-center position-relative"
                    style={{
                      background: 'linear-gradient(135deg, rgba(13, 202, 240, 0.04) 0%, rgba(255, 255, 255, 0.95) 100%)',
                      maxWidth: 420,
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between w-100 mb-3 border-bottom pb-2">
                      <span className="extra-small fw-bold text-uppercase text-secondary tracking-wider d-flex align-items-center gap-1.5">
                        <FaChartPie className="text-info" /> Visual Distribution Breakdown
                      </span>
                      <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill extra-small fw-bold">
                        {summary.total_ponds || 0} Total Ponds
                      </span>
                    </div>

                    <div style={{ height: 250, width: '100%', maxWidth: 350 }}>
                      <Doughnut data={pieData} options={pieOptions} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedPond && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content border-0 shadow rounded-4 overflow-hidden">
              <div className="modal-header p-4 bg-primary text-white border-0">
                <div>
                  <h4 className="fw-bold text-white mb-1">{selectedPond.pond_name}</h4>
                  <div className="small text-white text-opacity-75">
                    {valueOrDash(selectedPond.location)} | Caretaker: {valueOrDash(selectedPond.assigned_caretaker_name)}
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPond(null)} />
              </div>
              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3"><MetricCard title="Status" value={selectedPond.status || '-'} detail="Database/API status" icon={<FaWater />} tone={statusClass[selectedPond.status] || 'secondary'} /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Area" value={valueOrDash(selectedPond.area_sqm, ' sqm')} detail="Pond size" icon={<FaRulerVertical />} tone="info" /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Stocking Date" value={valueOrDash(selectedPond.stocking_date)} detail={`${valueOrDash(selectedPond.current_age_days, ' DOC')}`} icon={<FaCalendarAlt />} tone="secondary" /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Harvest Readiness" value={valueOrDash(formatNumber(selectedPond.harvest_readiness), '%')} detail={selectedPond.harvest_readiness_status || '-'} icon={<FaWeightHanging />} tone="warning" /></div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <div className={`p-4 rounded-4 border h-100 ${isDiseaseAlert(selectedPond.disease_detection) ? 'bg-danger bg-opacity-10 border-danger border-opacity-25' : 'bg-success bg-opacity-10 border-success border-opacity-25'}`}>
                      <h6 className={`fw-bold ${isDiseaseAlert(selectedPond.disease_detection) ? 'text-danger' : 'text-success'} d-flex align-items-center gap-2`}>
                        <FaBug /> Disease Detection
                      </h6>
                      <h5 className="fw-bold text-dark">{isDiseaseAlert(selectedPond.disease_detection) ? selectedPond.disease_detection : 'Clear'}</h5>
                      <p className="small text-muted mb-0">Confidence: {formatNumber(selectedPond.disease_confidence)}%</p>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-light h-100">
                      <h6 className="fw-bold text-dark d-flex align-items-center gap-2"><FaUtensils /> Feeding</h6>
                      <div className="d-flex justify-content-between"><span>Today</span><strong>{formatNumber(selectedPond.feed_today_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>Total</span><strong>{formatNumber(selectedPond.total_feed_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>Latest Feed Date</span><strong>{valueOrDash(selectedPond.latest_feed_date)}</strong></div>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-muted text-uppercase mb-3">Water Quality Parameters</h6>
                <div className="row g-3 text-center">
                  <WaterMetric icon={<FaThermometerHalf size={20} />} label="Temperature" value={valueOrDash(selectedPond.temperature, ' C')} tone="danger" />
                  <WaterMetric icon={<FaVial size={20} />} label="pH" value={valueOrDash(selectedPond.ph_level)} />
                  <WaterMetric icon={<FaFlask size={20} />} label="Salinity" value={valueOrDash(selectedPond.salinity, ' ppt')} tone="info" />
                  <WaterMetric icon={<FaWind size={20} />} label="Dissolved Oxygen" value={valueOrDash(selectedPond.dissolved_oxygen, ' mg/L')} tone="success" />
                  <WaterMetric icon={<FaRulerVertical size={20} />} label="Water Level" value={valueOrDash(selectedPond.water_level, ' m')} tone="secondary" />
                </div>
              </div>
              <div className="modal-footer bg-light border-0">
                <button className="btn btn-secondary px-4" onClick={() => setSelectedPond(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
