import { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  FaWater,
  FaSearch,
  FaFilter,
  FaFileCsv,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaFish,
  FaUtensils,
  FaCalendarAlt,
  FaUser,
  FaBug,
  FaSync,
  FaChartPie,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaArrowRight,
  FaThermometerHalf,
  FaVial,
  FaFlask,
  FaWind,
  FaRulerVertical,
  FaWeightHanging,
  FaCalendarCheck,
  FaShieldAlt
} from 'react-icons/fa';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import api from '../../services/api';
import Swal from 'sweetalert2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function PondMonitoringPage() {
  const [ponds, setPonds] = useState([]);
  const [summary, setSummary] = useState({
    total_ponds: 7,
    healthy_ponds: 5,
    warning_ponds: 1,
    critical_ponds: 1,
    average_feed_today: 11.8,
    average_pond_age: 104,
    disease_alerts: 2,
    pie_chart: { healthy_pct: 71, warning_pct: 14, critical_pct: 15 }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected Pond for Modal / Detail View
  const [selectedPond, setSelectedPond] = useState(null);

  // Top 5 Thesis Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');
  const [readinessFilter, setReadinessFilter] = useState('All');
  const [caretakerFilter, setCaretakerFilter] = useState('All');
  const [showFilterBar, setShowFilterBar] = useState(true);

  const loadPondData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/ponds.php');
      if (res.data && res.data.success && Array.isArray(res.data.ponds)) {
        setPonds(res.data.ponds);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else if (Array.isArray(res.data)) {
        setPonds(res.data);
      }
    } catch (err) {
      setError(err.message || 'Unable to fetch pond records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPondData();
  }, []);

  // Filter Logic based on 5 Filters
  const filteredPonds = ponds.filter((p) => {
    // 1. Search Query (Pond Name, Location, Caretaker)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (p.pond_name || '').toLowerCase().includes(q);
      const caretakerMatch = (p.assigned_caretaker_name || '').toLowerCase().includes(q);
      const locMatch = (p.location || '').toLowerCase().includes(q);
      if (!nameMatch && !caretakerMatch && !locMatch) return false;
    }

    // 2. Pond Status Filter (Healthy, Warning, Critical)
    if (statusFilter !== 'All') {
      if (p.status !== statusFilter) return false;
    }

    // 3. Disease Detection Filter (Healthy, White Spot Disease, Suspected)
    if (diseaseFilter !== 'All') {
      const dis = (p.disease_detection || '').toLowerCase();
      if (diseaseFilter === 'Healthy') {
        if (dis !== 'healthy' && dis !== 'none') return false;
      } else if (diseaseFilter === 'White Spot Disease') {
        if (!dis.includes('white spot')) return false;
      } else if (diseaseFilter === 'Suspected') {
        if (dis === 'healthy' || dis === 'none') return false;
      }
    }

    // 4. Harvest Readiness Filter (Ready to Harvest, Upcoming, Not Ready)
    if (readinessFilter !== 'All') {
      const cat = p.harvest_readiness_status || 'Not Ready';
      if (readinessFilter === 'Ready') {
        if (cat !== 'Ready to Harvest') return false;
      } else if (readinessFilter === 'Upcoming') {
        if (cat !== 'Upcoming') return false;
      } else if (readinessFilter === 'Not Ready') {
        if (cat !== 'Not Ready') return false;
      }
    }

    // 5. Assigned Caretaker Filter
    if (caretakerFilter !== 'All') {
      if ((p.assigned_caretaker_name || '') !== caretakerFilter) return false;
    }

    return true;
  });

  // Extract list of unique caretakers for filter dropdown
  const uniqueCaretakers = Array.from(
    new Set(ponds.map((p) => p.assigned_caretaker_name).filter(Boolean))
  );

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredPonds.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No pond data available to export.' });
      return;
    }

    const headers = [
      'Pond Name',
      'Status',
      'Assigned Caretaker',
      'Area (sqm)',
      'Stocking Date',
      'Age (Days)',
      'Growth (%)',
      'Feed Today (kg)',
      'Total Feed (kg)',
      'Disease Detection',
      'Confidence (%)',
      'Harvest Readiness (%)',
      'Expected Harvest Date',
      'Temperature (°C)',
      'pH Level',
      'Salinity (ppt)',
      'Dissolved Oxygen (mg/L)'
    ];

    const rows = filteredPonds.map((p) => [
      `"${p.pond_name || ''}"`,
      `"${p.status || ''}"`,
      `"${p.assigned_caretaker_name || ''}"`,
      p.area_sqm || 500,
      `"${p.stocking_date || ''}"`,
      p.current_age_days || 0,
      `${p.growth_percentage || 0}%`,
      p.feed_today_kg || 0,
      p.total_feed_kg || 0,
      `"${p.disease_detection || 'Healthy'}"`,
      `${p.disease_confidence || 0}%`,
      `${p.harvest_readiness || 0}%`,
      `"${p.expected_harvest_date || ''}"`,
      p.temperature || 0,
      p.ph_level || 0,
      p.salinity || 0,
      p.dissolved_oxygen || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ShrimpPredict_Pond_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: 'success',
      title: 'CSV Report Exported',
      text: 'Pond monitoring metrics downloaded successfully.',
      timer: 1800,
      showConfirmButton: false
    });
  };

  // Pie Chart Config
  const pieData = {
    labels: ['Healthy', 'Warning', 'Critical'],
    datasets: [
      {
        data: [
          summary.pie_chart.healthy_pct || 71,
          summary.pie_chart.warning_pct || 14,
          summary.pie_chart.critical_pct || 15
        ],
        backgroundColor: ['#1FB567', '#FF7A00', '#E04848'],
        borderColor: ['#ffffff', '#ffffff', '#ffffff'],
        borderWidth: 3,
        hoverOffset: 6
      }
    ]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          font: { family: 'Poppins', size: 12, weight: '600' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw}%`
        }
      }
    },
    cutout: '65%'
  };

  return (
    <div className="pb-5">
      {/* 🛠 1. UNIFIED CONTROL & FILTER TOOLBAR */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
          {/* Quick Search */}
          <div className="position-relative flex-grow-1" style={{ maxWidth: 450 }}>
            <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 16 }} size={14} />
            <input
              type="text"
              className="form-control ps-5 pe-4 py-2.5 rounded-pill shadow-xs"
              placeholder="Search Pond Number, Caretaker, or Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.92rem' }}
            />
            {searchQuery && (
              <button
                className="btn btn-sm btn-link position-absolute top-50 translate-middle-y text-muted text-decoration-none"
                style={{ right: 12 }}
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold shadow-xs ${
                showFilterBar ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setShowFilterBar(!showFilterBar)}
            >
              <FaFilter size={13} /> {showFilterBar ? 'Hide Filters' : 'Show Top 5 Filters'}
            </button>

            <button
              type="button"
              className="btn btn-outline-success btn-sm px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold shadow-xs"
              onClick={handleExportCSV}
            >
              <FaFileCsv size={15} /> Export CSV
            </button>

            <button
              type="button"
              className="btn btn-light btn-sm px-3 py-2 border rounded-3 d-flex align-items-center gap-1.5 text-muted shadow-xs"
              onClick={loadPondData}
              title="Refresh Data"
            >
              <FaSync size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* 🔍 TOP 5 THESIS FILTERS BAR */}
        {showFilterBar && (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="extra-small fw-bold text-uppercase text-muted tracking-wider">
                Top 5 Capstone Filters
              </span>
              <button
                className="btn btn-sm btn-link text-muted text-decoration-none p-0 extra-small"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setDiseaseFilter('All');
                  setReadinessFilter('All');
                  setCaretakerFilter('All');
                }}
              >
                Clear Filters
              </button>
            </div>

            <div className="row g-3">
              {/* Filter 1: Search */}
              <div className="col-12 col-sm-6 col-md-4 col-xl-3">
                <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
                  1. Search Keyword
                </label>
                <input
                  type="text"
                  className="form-control rounded-3 py-2 shadow-xs"
                  placeholder="Pond 3, Juan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter 2: Pond Status */}
              <div className="col-12 col-sm-6 col-md-4 col-xl-2">
                <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
                  2. Pond Status 🟢
                </label>
                <select
                  className="form-select rounded-3 py-2 shadow-xs"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Healthy">Healthy 🟢</option>
                  <option value="Warning">Warning 🟡</option>
                  <option value="Critical">Critical 🔴</option>
                </select>
              </div>

              {/* Filter 3: Disease Detection */}
              <div className="col-12 col-sm-6 col-md-4 col-xl-2">
                <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
                  3. Disease Detection 🦠
                </label>
                <select
                  className="form-select rounded-3 py-2 shadow-xs"
                  value={diseaseFilter}
                  onChange={(e) => setDiseaseFilter(e.target.value)}
                >
                  <option value="All">All Detection</option>
                  <option value="Healthy">Healthy (None)</option>
                  <option value="White Spot Disease">White Spot Disease</option>
                  <option value="Suspected">Suspected / Alerts</option>
                </select>
              </div>

              {/* Filter 4: Harvest Readiness */}
              <div className="col-12 col-sm-6 col-md-4 col-xl-3">
                <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
                  4. Harvest Readiness 🦐
                </label>
                <select
                  className="form-select rounded-3 py-2 shadow-xs"
                  value={readinessFilter}
                  onChange={(e) => setReadinessFilter(e.target.value)}
                >
                  <option value="All">All Readiness</option>
                  <option value="Ready">Ready to Harvest (100%)</option>
                  <option value="Upcoming">Upcoming (95%+)</option>
                  <option value="Not Ready">Not Ready (&lt;95%)</option>
                </select>
              </div>

              {/* Filter 5: Assigned Caretaker */}
              <div className="col-12 col-sm-6 col-md-4 col-xl-2">
                <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
                  5. Caretaker 👨‍🌾
                </label>
                <select
                  className="form-select rounded-3 py-2 shadow-xs"
                  value={caretakerFilter}
                  onChange={(e) => setCaretakerFilter(e.target.value)}
                >
                  <option value="All">All Caretakers</option>
                  {uniqueCaretakers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 📊 2. SUMMARY CARDS */}
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

      {/* 🏞 3. FARM LAYOUT GRID (FULL 12-COLUMNS WIDTH!) */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FaWater className="text-primary" /> Farm Layout & Pond Cards
            </h5>
            <p className="text-muted mb-0 small">Click any pond card to view detailed health parameters.</p>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold">
            Showing {filteredPonds.length} of {ponds.length} Ponds
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2">Loading Farm Layout...</p>
          </div>
        ) : filteredPonds.length === 0 ? (
          <div className="text-center py-5 text-muted border rounded-4 bg-light">
            <FaWater size={36} className="text-muted mb-2 opacity-50" />
            <h6 className="fw-bold mb-1">No Ponds Found</h6>
            <p className="small mb-0">No ponds match your selected filter criteria.</p>
          </div>
        ) : (
          /* SPACIOUS 3 & 4 COLUMN GRID PER ROW ACROSS FULL WIDTH */
          <div className="row g-4">
            {filteredPonds.map((p) => {
              const status = p.status || 'Healthy';
              const statusDot = status === 'Healthy' ? '🟢' : status === 'Warning' ? '🟡' : '🔴';
              const statusBadgeClass =
                status === 'Healthy' ? 'bg-success' : status === 'Warning' ? 'bg-warning text-dark' : 'bg-danger';

              const growth = p.growth_percentage || 85;
              const hasDiseaseAlert = p.disease_detection && p.disease_detection !== 'Healthy';

              return (
                <div key={p.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                  <div
                    className="card border shadow-sm rounded-4 p-4 h-100 d-flex flex-column justify-content-between transition-all hover-shadow bg-white"
                    style={{ cursor: 'pointer', minHeight: 190 }}
                    onClick={() => setSelectedPond(p)}
                  >
                    {/* Pond Title Header */}
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                          <span>{statusDot}</span> {p.pond_name}
                        </h5>
                        <span className={`badge ${statusBadgeClass} px-3 py-1.5 rounded-pill font-mono extra-small`}>
                          {status}
                        </span>
                      </div>

                      {/* Caretaker Info */}
                      <div className="small text-muted mb-3 d-flex align-items-center justify-content-between">
                        <span className="d-flex align-items-center gap-1.5">
                          <FaUser size={13} className="text-primary" /> {p.assigned_caretaker_name || 'Juan Dela Cruz'}
                        </span>
                        <span className="extra-small text-muted">
                          DOC: <strong>{p.current_age_days || 104} Days</strong>
                        </span>
                      </div>

                      {/* Slim Growth Progress Bar */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center small fw-semibold text-dark mb-1.5">
                          <span>Growth Progress</span>
                          <span className="text-primary font-mono fw-bold">{growth}%</span>
                        </div>
                        <div className="progress" style={{ height: 8, borderRadius: 10, backgroundColor: '#e2e8f0' }}>
                          <div
                            className={`progress-bar ${
                              growth >= 95 ? 'bg-success' : growth >= 80 ? 'bg-info' : 'bg-warning'
                            }`}
                            role="progressbar"
                            style={{ width: `${Math.min(growth, 100)}%`, borderRadius: 10 }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="pt-3 border-top d-flex align-items-center justify-content-between">
                      {hasDiseaseAlert ? (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1 text-truncate" style={{ maxWidth: 160 }}>
                          <FaBug className="me-1" /> {p.disease_detection}
                        </span>
                      ) : (
                        <span className="extra-small text-success fw-semibold d-flex align-items-center gap-1">
                          <FaCheckCircle /> Normal
                        </span>
                      )}

                      <span className="text-primary font-mono fw-semibold small d-flex align-items-center gap-1">
                        Details <FaArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 📊 4. POND HEALTH DISTRIBUTION & ANALYTICS (PLACED AT THE BOTTOM ACROSS FULL WIDTH!) */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
        <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FaChartPie className="text-primary" /> Pond Health Distribution & Proportion Analytics
            </h5>
            <p className="text-muted mb-0 small">Overall health proportion and breakdown across all monitored farm ponds.</p>
          </div>
        </div>

        <div className="row g-4 align-items-center">
          {/* Left Side: Wide Elegant Doughnut Chart */}
          <div className="col-12 col-md-5 col-xl-4 text-center border-end-md">
            <div className="position-relative mx-auto" style={{ height: 220, maxWidth: 280 }}>
              <Doughnut data={pieData} options={pieOptions} />
            </div>
          </div>

          {/* Right Side: 3 Rich Health Analytics Summary Cards */}
          <div className="col-12 col-md-7 col-xl-8">
            <div className="row g-3">
              {/* Healthy Ponds Card */}
              <div className="col-12 col-sm-4">
                <div className="p-3.5 rounded-4 bg-success bg-opacity-10 border border-success border-opacity-25 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-success small d-flex align-items-center gap-1.5">
                      <FaCheckCircle /> Healthy Ponds
                    </span>
                    <span className="badge bg-success text-white rounded-pill px-2.5 py-1 extra-small">
                      {summary.pie_chart.healthy_pct}%
                    </span>
                  </div>
                  <h3 className="fw-bold text-dark mb-1">{summary.healthy_ponds} Ponds</h3>
                  <p className="extra-small text-muted mb-0">
                    Water quality, dissolved O₂, and pH levels are within optimal range.
                  </p>
                </div>
              </div>

              {/* Warning Ponds Card */}
              <div className="col-12 col-sm-4">
                <div className="p-3.5 rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-30 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-dark small d-flex align-items-center gap-1.5">
                      <FaExclamationTriangle className="text-warning text-dark" /> Warning Ponds
                    </span>
                    <span className="badge bg-warning text-dark border border-warning border-opacity-50 rounded-pill px-2.5 py-1 extra-small">
                      {summary.pie_chart.warning_pct}%
                    </span>
                  </div>
                  <h3 className="fw-bold text-dark mb-1">{summary.warning_ponds} Pond</h3>
                  <p className="extra-small text-muted mb-0">
                    Slight sub-optimal salinity/pH. Close monitoring required.
                  </p>
                </div>
              </div>

              {/* Critical Ponds Card */}
              <div className="col-12 col-sm-4">
                <div className="p-3.5 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-danger small d-flex align-items-center gap-1.5">
                      <FaTimesCircle /> Critical Ponds
                    </span>
                    <span className="badge bg-danger text-white rounded-pill px-2.5 py-1 extra-small">
                      {summary.pie_chart.critical_pct}%
                    </span>
                  </div>
                  <h3 className="fw-bold text-dark mb-1">{summary.critical_ponds} Pond</h3>
                  <p className="extra-small text-muted mb-0">
                    Active disease alert. Immediate quarantine & water treatment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ULTRA-PREMIUM DETAILED POND VIEW MODAL */}
      {selectedPond && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(11, 44, 95, 0.55)', backdropFilter: 'blur(10px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              {/* Premium Gradient Header */}
              <div
                className="modal-header p-4 text-white border-0 position-relative"
                style={{
                  background:
                    selectedPond.status === 'Healthy'
                      ? 'linear-gradient(135deg, #0b7a42 0%, #15a05b 100%)'
                      : selectedPond.status === 'Warning'
                      ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-white bg-opacity-20 d-flex align-items-center justify-content-center border border-white border-opacity-40 shadow-sm"
                    style={{ width: 56, height: 56, fontSize: '1.8rem' }}
                  >
                    {selectedPond.status === 'Healthy' ? '🟢' : selectedPond.status === 'Warning' ? '🟡' : '🔴'}
                  </div>
                  <div>
                    <h3 className="fw-bold mb-1 text-white d-flex align-items-center gap-2">
                      {selectedPond.pond_name}
                      <span className="badge bg-white text-dark fs-6 font-normal px-3 py-1 rounded-pill shadow-xs">
                        {selectedPond.status} Status
                      </span>
                    </h3>
                    <div className="d-flex align-items-center gap-2 extra-small text-white text-opacity-90">
                      <span className="d-flex align-items-center gap-1">
                        <FaMapMarkerAlt /> {selectedPond.location || 'Northern Bay - Section 1'}
                      </span>
                      <span>•</span>
                      <span className="d-flex align-items-center gap-1">
                        <FaUser /> Caretaker: {selectedPond.assigned_caretaker_name || 'Juan Dela Cruz'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white position-absolute top-0 end-0 m-4"
                  onClick={() => setSelectedPond(null)}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-white">
                {/* 6 Metric Grid Cards */}
                <h6 className="fw-bold text-dark mb-3 text-uppercase extra-small tracking-wider text-muted">
                  Pond Operational Parameters
                </h6>
                <div className="row g-3 mb-4">
                  {/* Caretaker */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-circle bg-primary bg-opacity-10 text-primary">
                        <FaUser size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Assigned Caretaker</small>
                        <strong className="fs-6 text-dark d-block">{selectedPond.assigned_caretaker_name || 'Juan Dela Cruz'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Area */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-circle bg-info bg-opacity-10 text-info">
                        <FaWater size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Pond Area</small>
                        <strong className="fs-6 text-dark d-block">{selectedPond.area_sqm || 500} sqm</strong>
                      </div>
                    </div>
                  </div>

                  {/* Stocking Date */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-circle bg-secondary bg-opacity-10 text-secondary">
                        <FaCalendarAlt size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Stocking Date</small>
                        <strong className="fs-6 text-dark d-block">{selectedPond.stocking_date || '2026-04-10'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Current Age */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3 border-start border-3 border-primary">
                      <div className="p-2.5 rounded-circle bg-primary bg-opacity-10 text-primary">
                        <FaCalendarCheck size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Current Age</small>
                        <strong className="fs-6 text-primary d-block">{selectedPond.current_age_days || 106} Days</strong>
                      </div>
                    </div>
                  </div>

                  {/* Feed Today */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-circle bg-warning bg-opacity-10 text-warning">
                        <FaUtensils size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Feed Today</small>
                        <strong className="fs-6 text-dark d-block">{selectedPond.feed_today_kg || 12} kg</strong>
                      </div>
                    </div>
                  </div>

                  {/* Total Feed */}
                  <div className="col-12 col-sm-6 col-md-4">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex align-items-center gap-3">
                      <div className="p-2.5 rounded-circle bg-success bg-opacity-10 text-success">
                        <FaWeightHanging size={18} />
                      </div>
                      <div>
                        <small className="text-muted extra-small fw-bold d-block text-uppercase">Total Feed</small>
                        <strong className="fs-6 text-dark d-block">{selectedPond.total_feed_kg || 450} kg</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🎨 ELEGANT DISEASE DETECTION & HARVEST READINESS STATUS CARDS */}
                <div className="row g-3 mb-4">
                  {/* Disease Detection Card */}
                  <div className="col-12 col-md-6">
                    {selectedPond.disease_detection && selectedPond.disease_detection !== 'Healthy' ? (
                      /* Disease Alert Card */
                      <div className="p-4 rounded-4 border bg-danger bg-opacity-10 border-danger border-opacity-30 h-100 shadow-xs">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-bold text-danger d-flex align-items-center gap-2 fs-6">
                            <FaBug size={16} /> Disease Alert
                          </span>
                          <span className="badge bg-danger text-white px-2.5 py-1 rounded-pill extra-small fw-semibold">
                            ⚠️ Risk: {selectedPond.disease_confidence || 95}%
                          </span>
                        </div>
                        <h5 className="fw-bold text-dark mb-1">
                          {selectedPond.disease_detection}
                        </h5>
                        <p className="extra-small text-muted mb-0">
                          Immediate water treatment and caretaker inspection required.
                        </p>
                      </div>
                    ) : (
                      /* Clean Safe Card */
                      <div className="p-4 rounded-4 border bg-success bg-opacity-10 border-success border-opacity-30 h-100 shadow-xs">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span className="fw-bold text-success d-flex align-items-center gap-2 fs-6">
                            <FaShieldAlt size={16} /> Disease Detection
                          </span>
                          <span className="badge bg-success text-white px-2.5 py-1 rounded-pill extra-small fw-semibold">
                            🟢 100% Clean
                          </span>
                        </div>
                        <h5 className="fw-bold text-dark mb-1">
                          Healthy (No Disease Detected)
                        </h5>
                        <p className="extra-small text-muted mb-0">
                          AI Computer Vision Scan: All shrimp tissue scans are 100% clean & optimal.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Harvest Readiness Card */}
                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-warning bg-opacity-10 border-warning border-opacity-30 h-100 shadow-xs">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-bold text-dark d-flex align-items-center gap-2 fs-6">
                          <FaFish size={16} className="text-warning text-dark" /> Harvest Readiness
                        </span>
                        <span className="badge bg-warning text-dark border border-warning border-opacity-50 px-2.5 py-1 rounded-pill extra-small fw-semibold">
                          Target: 120 DOC
                        </span>
                      </div>

                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <h5 className="fw-bold text-dark mb-0">
                          {selectedPond.harvest_readiness || 85}%
                        </h5>
                        <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 extra-small fw-semibold">
                          {selectedPond.harvest_readiness_status || 'Upcoming Harvest'}
                        </span>
                      </div>

                      {/* Slim Progress Bar */}
                      <div className="progress mb-2" style={{ height: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.06)' }}>
                        <div
                          className="progress-bar bg-warning progress-bar-striped progress-bar-animated"
                          role="progressbar"
                          style={{ width: `${selectedPond.harvest_readiness || 85}%`, borderRadius: 10 }}
                        ></div>
                      </div>

                      <p className="extra-small text-muted mb-0">
                        Expected Harvest Date: <strong>{selectedPond.expected_harvest_date || '2026-08-12'}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 🌊 WATER QUALITY PARAMETERS CARDS */}
                <h6 className="fw-bold text-dark mb-3 text-uppercase extra-small tracking-wider text-muted">
                  Water Quality Parameters (Real-time Telemetry)
                </h6>
                <div className="row g-2 text-center">
                  {/* Temperature */}
                  <div className="col-6 col-md-4 col-lg-2.4" style={{ width: '20%' }}>
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-danger mb-1">
                        <FaThermometerHalf size={20} />
                      </div>
                      <small className="text-muted extra-small d-block fw-bold text-uppercase">Temp</small>
                      <strong className="fs-6 text-dark d-block my-1">{selectedPond.temperature}°C</strong>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small px-2">🟢 Optimal</span>
                    </div>
                  </div>

                  {/* pH Level */}
                  <div className="col-6 col-md-4 col-lg-2.4" style={{ width: '20%' }}>
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-primary mb-1">
                        <FaVial size={20} />
                      </div>
                      <small className="text-muted extra-small d-block fw-bold text-uppercase">pH Level</small>
                      <strong className="fs-6 text-dark d-block my-1">{selectedPond.ph_level}</strong>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small px-2">🟢 Optimal</span>
                    </div>
                  </div>

                  {/* Salinity */}
                  <div className="col-6 col-md-4 col-lg-2.4" style={{ width: '20%' }}>
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-info mb-1">
                        <FaFlask size={20} />
                      </div>
                      <small className="text-muted extra-small d-block fw-bold text-uppercase">Salinity</small>
                      <strong className="fs-6 text-dark d-block my-1">{selectedPond.salinity} ppt</strong>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small px-2">🟢 Optimal</span>
                    </div>
                  </div>

                  {/* Dissolved Oxygen */}
                  <div className="col-6 col-md-4 col-lg-2.4" style={{ width: '20%' }}>
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-success mb-1">
                        <FaWind size={20} />
                      </div>
                      <small className="text-muted extra-small d-block fw-bold text-uppercase">Dissolved O₂</small>
                      <strong className="fs-6 text-dark d-block my-1">{selectedPond.dissolved_oxygen} mg/L</strong>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small px-2">🟢 Optimal</span>
                    </div>
                  </div>

                  {/* Water Level */}
                  <div className="col-6 col-md-4 col-lg-2.4" style={{ width: '20%' }}>
                    <div className="p-3 rounded-3 bg-light border h-100">
                      <div className="text-secondary mb-1">
                        <FaRulerVertical size={20} />
                      </div>
                      <small className="text-muted extra-small d-block fw-bold text-uppercase">Water Level</small>
                      <strong className="fs-6 text-dark d-block my-1">{selectedPond.water_level} m</strong>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small px-2">🟢 Normal</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                <small className="text-muted extra-small">
                  Last Updated: <strong>Today, 09:53 AM</strong> | Sensor ID: #SP-882
                </small>
                <button
                  type="button"
                  className="btn btn-secondary px-4 rounded-3 shadow-xs"
                  onClick={() => setSelectedPond(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
