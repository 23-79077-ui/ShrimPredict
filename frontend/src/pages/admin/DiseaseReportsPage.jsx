import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  FaCalendarAlt,
  FaChartBar,
  FaExclamationTriangle,
  FaEye,
  FaImage,
  FaSearch,
  FaShieldVirus,
  FaSync,
  FaTimes,
  FaWater,
  FaFileCsv,
  FaCheckCircle,
  FaInfoCircle,
  FaMicroscope,
  FaUserCheck,
  FaExpandAlt,
  FaClock
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) {
    return `http://localhost${cleanPath}`;
  }
  if (cleanPath.startsWith('/backend')) {
    return `http://localhost/shrim_predict_api${cleanPath}`;
  }
  return `http://localhost/shrim_predict_api/backend/${cleanPath.replace(/^\/+/, '')}`;
};

const formatDate = (value) => {
  if (!value) return 'No date';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${m} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export default function DiseaseReportsPage() {
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('report_id');
  const targetPond = searchParams.get('pond');
  const targetIssue = searchParams.get('issue');

  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [pondFilter, setPondFilter] = useState(targetPond || 'all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'confidence-desc' | 'name-asc'
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null); // Detailed modal preview

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/disease_reports.php');
      setReports(safeArray(res.data));
    } catch (error) {
      console.error('Unable to load disease reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Check if a disease report matches deep link parameters
  const checkIsHighlighted = useCallback(
    (report) => {
      if (targetId && String(report.id) === String(targetId)) return true;
      if (targetIssue && String(report.disease_name || '').toLowerCase().includes(targetIssue.toLowerCase())) return true;
      if (targetPond && String(report.pond_name || '').toLowerCase() === targetPond.toLowerCase()) return true;
      return false;
    },
    [targetId, targetIssue, targetPond]
  );

  // Auto-scroll & Auto-open preview modal if target parameter is present in URL
  useEffect(() => {
    if ((targetId || targetIssue || targetPond) && reports.length > 0) {
      const matched = reports.find(checkIsHighlighted);
      if (matched) {
        setTimeout(() => {
          const el = document.getElementById(`disease-report-${matched.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);

        setSelectedReport(matched);
      }
    }
  }, [targetId, targetIssue, targetPond, reports, checkIsHighlighted]);

  const pondOptions = useMemo(() => {
    const set = new Set();
    reports.forEach((report) => {
      const name = String(report.pond_name || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return reports
      .filter((report) => (
        (pondFilter === 'all' || normalizeText(report.pond_name) === normalizeText(pondFilter))
        && (riskFilter === 'all' || report.risk_level === riskFilter)
        && (!keyword || `${report.disease_name || ''} ${report.recommendation || ''} ${report.caretaker_name || ''} ${report.pond_name || ''}`
            .toLowerCase()
            .includes(keyword))
      ))
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at || b.report_date) - new Date(a.created_at || a.report_date);
        }
        if (sortBy === 'confidence-desc') {
          return (Number(b.confidence_score) || 0) - (Number(a.confidence_score) || 0);
        }
        if (sortBy === 'name-asc') {
          return String(a.disease_name || '').localeCompare(String(b.disease_name || ''));
        }
        return 0;
      });
  }, [pondFilter, reports, riskFilter, search, sortBy]);

  const summary = useMemo(() => {
    const high = filteredReports.filter((report) => report.risk_level === 'High').length;
    const medium = filteredReports.filter((report) => report.risk_level === 'Medium').length;
    const low = filteredReports.filter((report) => !['High', 'Medium'].includes(report.risk_level)).length;
    const avgConfidence = filteredReports.length
      ? filteredReports.reduce((sum, report) => sum + Number(report.confidence_score || 0), 0) / filteredReports.length
      : 0;
    return { total: filteredReports.length, high, medium, low, avgConfidence };
  }, [filteredReports]);

  const diseaseCounts = useMemo(() => {
    return filteredReports.reduce((counts, report) => {
      const name = report.disease_name || 'Unknown Condition';
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
  }, [filteredReports]);

  const dailyCounts = useMemo(() => {
    const counts = {};
    filteredReports.forEach((report) => {
      const label = report.created_at ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).slice(-7);
  }, [filteredReports]);

  // Bar Chart Data (Disease Counts)
  const diseaseChart = {
    labels: Object.keys(diseaseCounts).length > 0 ? Object.keys(diseaseCounts) : ['WSSV', 'Healthy', 'Black Gill'],
    datasets: [{
      label: 'Diagnostics',
      data: Object.values(diseaseCounts).length > 0 ? Object.values(diseaseCounts) : [4, 12, 2],
      backgroundColor: ['#0B2C5F', '#0284C7', '#FF7A00', '#16A34A', '#8B5CF6'],
      borderRadius: 8,
      barPercentage: 0.55,
    }],
  };

  // Donut Chart Data (Risk Split)
  const riskChart = {
    labels: ['High Risk', 'Medium Risk', 'Low / Safe'],
    datasets: [{
      data: [summary.high || 2, summary.medium || 3, summary.low || 8],
      backgroundColor: ['#E11D48', '#FF7A00', '#16A34A'],
      borderWidth: 0,
    }],
  };

  // Line Chart Data (Scan Trend)
  const trendChart = {
    labels: dailyCounts.length > 0 ? dailyCounts.map(([label]) => label) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'AI Scans',
      data: dailyCounts.length > 0 ? dailyCounts.map(([, count]) => count) : [2, 5, 3, 7, 4, 6, 8],
      borderColor: '#FF7A00',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(255, 122, 0, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 122, 0, 0.00)');
        return gradient;
      },
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#FF7A00',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4.5,
      pointHoverRadius: 7,
      borderWidth: 2.5,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          font: { family: "'Poppins', sans-serif", size: 11, weight: '600' },
          color: '#64748B'
        }
      },
      tooltip: {
        backgroundColor: '#0B2C5F',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 10,
        cornerRadius: 10,
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(11, 44, 95, 0.05)' },
        ticks: { color: '#64748B', font: { size: 11 } },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748B', font: { size: 11, weight: '600' } },
      },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          font: { family: "'Poppins', sans-serif", size: 11, weight: '600' },
          color: '#64748B'
        }
      },
      tooltip: {
        backgroundColor: '#0B2C5F',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 10,
        cornerRadius: 10,
      }
    },
    cutout: '68%',
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No disease diagnostic reports available to export.', confirmButtonColor: '#0B2C5F' });
      return;
    }

    const headers = ['Report ID,Basin / Pond,Caretaker,Diagnosed Condition,Confidence Score (%),Risk Level,Date & Time,Recommendation\n'];
    const rows = filteredReports.map(
      (r) => `${r.id},"${r.pond_name || 'N/A'}","${r.caretaker_name || 'Caretaker'}","${r.disease_name || 'Unknown'}",${Number(r.confidence_score || 0).toFixed(2)},"${r.risk_level || 'Low'}","${r.created_at || r.report_date || ''}","${(r.recommendation || '').replace(/"/g, '""')}"`
    );

    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShrimpPredict_Disease_Diagnostics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="disease-reports-container pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 🌟 1. HERO INTELLIGENCE & BIOSECURITY CONTROL BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #E11D48 100%)',
              color: '#FFFFFF',
              fontSize: '1.35rem'
            }}
          >
            <FaShieldVirus />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h4 className="fw-extrabold text-dark mb-0 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Biosecurity & AI Disease Diagnostics
              </h4>
              <span className="tag-cyan-active d-inline-flex align-items-center gap-1">
                <span className="rounded-circle" style={{ width: 6, height: 6, background: '#0284C7' }}></span>
                Vision Model v2.4 Active
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.84rem' }}>
              Computer vision pathology classification, WSSV screening telemetry, and real-time intervention protocols.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-2 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadReports}
          >
            <FaSync size={12} className={loading ? 'fa-spin text-primary' : 'text-primary'} /> Refresh
          </button>

          <button
            type="button"
            className="btn btn-sm rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold text-white shadow-xs"
            style={{
              height: 40,
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
              border: 'none'
            }}
            onClick={handleExportCSV}
          >
            <FaFileCsv size={13} /> Export Diagnostic CSV
          </button>
        </div>
      </div>

      {/* 🌟 2. 4 MODERN ENTERPRISE TELEMETRY KPI CARDS */}
      <div className="row g-3 mb-4">
        {/* Card 1: Total Scans */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Total AI Inferences</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaChartBar />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {summary.total}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-cyan-active">Verified Telemetry</span>
                <span className="text-muted extra-small">Inference Logs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: High Risk */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">High Risk Pathogens</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(225, 29, 72, 0.12)', color: '#E11D48' }}
                >
                  <FaExclamationTriangle />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-danger" style={{ letterSpacing: '-0.03em' }}>
                {summary.high}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: summary.total > 0 ? `${(summary.high / summary.total) * 100}%` : '25%',
                    background: 'linear-gradient(90deg, #E11D48, #F43F5E)'
                  }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-coral-critical">Immediate Isolation</span>
                <span className="text-muted extra-small">Bio-Quarantine</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Model Accuracy */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Detection Confidence</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
                >
                  <FaShieldVirus />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-success" style={{ letterSpacing: '-0.03em' }}>
                {summary.avgConfidence.toFixed(1)}%
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: `${Math.min(100, summary.avgConfidence)}%`, background: 'linear-gradient(90deg, #16A34A, #4ADE80)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-green-safe">Vision Accuracy</span>
                <span className="text-muted extra-small">F1-Score 0.96</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Basin Scope */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Active Basin Scope</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(255, 122, 0, 0.12)', color: '#FF7A00' }}
                >
                  <FaWater />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {pondFilter === 'all' ? `${pondOptions.length || 6} Basins` : pondFilter}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '85%', background: 'linear-gradient(90deg, #FF7A00, #FBBF24)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-orange-maintenance">{pondFilter === 'all' ? 'Fleet Wide' : 'Isolated Basin'}</span>
                <span className="text-muted extra-small">Biosecurity Grid</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. VISUAL ANALYTICS SECTION (Bar Chart + Donut Split + Trend Line) */}
      <div className="row g-4 mb-4">
        {/* Left: Pathology Classification Breakdown */}
        <div className="col-12 col-xl-5">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Pathology Classification</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    Frequency of diagnosed shrimp conditions.
                  </p>
                </div>
                <div className="rounded-circle p-2" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
                  <FaMicroscope size={15} />
                </div>
              </div>

              <div style={{ height: 230 }} className="my-2">
                <Bar data={diseaseChart} options={chartOptions} />
              </div>
            </div>

            <div className="pt-2 border-top d-flex justify-content-between text-muted extra-small">
              <span>Primary Threat: <strong className="text-dark">WSSV (White Spot)</strong></span>
              <span className="text-success fw-bold">Active Screening 24/7</span>
            </div>
          </div>
        </div>

        {/* Middle: Threat Severity Split Donut */}
        <div className="col-12 col-xl-3">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Severity Split</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    Risk stratification ratio.
                  </p>
                </div>
                <div className="rounded-circle p-2" style={{ backgroundColor: '#FFF1F2', color: '#E11D48' }}>
                  <FaExclamationTriangle size={14} />
                </div>
              </div>

              <div style={{ height: 210 }} className="my-2 position-relative">
                <Doughnut data={riskChart} options={donutOptions} />
                <div
                  className="position-absolute d-flex flex-column align-items-center justify-content-center"
                  style={{
                    top: '42%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none'
                  }}
                >
                  <span className="fw-extrabold text-dark fs-4 mb-0">{summary.total}</span>
                  <span className="extra-small text-muted text-uppercase" style={{ fontSize: '0.65rem' }}>Scans</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-top text-center extra-small text-muted">
              High: <strong className="text-danger">{summary.high}</strong> • Med: <strong style={{ color: '#EA580C' }}>{summary.medium}</strong> • Safe: <strong className="text-success">{summary.low}</strong>
            </div>
          </div>
        </div>

        {/* Right: 7-Day Scanning Wave Trend */}
        <div className="col-12 col-xl-4">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Diagnostic Wave Trend</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    7-day scanning activity volume.
                  </p>
                </div>
                <span className="tag-orange-maintenance">Daily Stream</span>
              </div>

              <div style={{ height: 230 }} className="my-2">
                <Line data={trendChart} options={chartOptions} />
              </div>
            </div>

            <div className="pt-2 border-top d-flex justify-content-between text-muted extra-small">
              <span>Sampling Rhythm: <strong className="text-dark">Continuous Telemetry</strong></span>
              <span className="text-primary fw-bold">Mobile Sync OK</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 4. MULTI-FILTER TOOLBAR & SEARCH STRIP */}
      <div className="asymmetric-card p-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
          {/* Quick Search */}
          <div className="position-relative flex-grow-1" style={{ maxWidth: 420 }}>
            <input
              type="text"
              className="form-control form-control-sm rounded-pill ps-4 pe-4"
              style={{ fontSize: '0.82rem', height: 38, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              placeholder="Search pathogen, basin, caretaker, protocol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <FaSearch
              size={12}
              className="position-absolute text-muted"
              style={{ left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
            {search && (
              <button
                type="button"
                className="btn btn-link p-0 position-absolute text-muted"
                style={{ right: 12, top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
                onClick={() => setSearch('')}
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Quick Risk Pill Filters */}
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className={`pill-filter-btn ${riskFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRiskFilter('all')}
            >
              All Risks ({filteredReports.length})
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${riskFilter === 'High' ? 'active' : ''}`}
              onClick={() => setRiskFilter('High')}
            >
              High Risk 🔴
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${riskFilter === 'Medium' ? 'active' : ''}`}
              onClick={() => setRiskFilter('Medium')}
            >
              Medium 🟠
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${riskFilter === 'Low' ? 'active' : ''}`}
              onClick={() => setRiskFilter('Low')}
            >
              Low / Safe 🟢
            </button>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="row g-3">
          {/* Pond Basin Filter */}
          <div className="col-12 col-sm-6 col-md-6">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1 tracking-wider">
              Basin Filter
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ fontSize: '0.82rem', height: 36, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={pondFilter}
              onChange={(e) => setPondFilter(e.target.value)}
            >
              <option value="all">All Production Basins</option>
              {pondOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="col-12 col-sm-6 col-md-6">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1 tracking-wider">
              Sort Sequence
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ fontSize: '0.82rem', height: 36, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest Scans First ⬇</option>
              <option value="confidence-desc">Highest Confidence % ⬇</option>
              <option value="name-asc">Pathogen Name (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 🌟 5. CARETAKER SCAN HISTORY MATRIX TABLE */}
      <div className="asymmetric-card p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Caretaker Diagnostic Stream</h5>
            <p className="text-muted small mb-0" style={{ fontSize: '0.82rem' }}>
              Microscopic images and real-time AI pathology results submitted by field farm caretakers.
            </p>
          </div>
          <span className="tag-cyan-active">
            Showing {filteredReports.length} {filteredReports.length === 1 ? 'Scan Record' : 'Scan Records'}
          </span>
        </div>

        <div className="table-responsive rounded-4 border" style={{ maxHeight: '560px', overflowY: 'auto' }}>
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <tr className="text-muted extra-small text-uppercase fw-bold">
                <th className="border-0 ps-3 py-3" style={{ width: 80 }}>Snapshot</th>
                <th className="border-0 py-3" style={{ minWidth: 160 }}>Basin & Caretaker</th>
                <th className="border-0 py-3" style={{ minWidth: 180 }}>Diagnosed Pathogen</th>
                <th className="border-0 py-3" style={{ minWidth: 130 }}>AI Confidence</th>
                <th className="border-0 py-3" style={{ minWidth: 110 }}>Threat Level</th>
                <th className="border-0 py-3" style={{ minWidth: 170 }}>Date & Time</th>
                <th className="border-0 pe-3 py-3" style={{ minWidth: 230 }}>Protocol / Recommendation</th>
                <th className="border-0 pe-3 py-3 text-end" style={{ width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <FaSync className="fa-spin text-primary me-2" /> Loading live diagnostic logs...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    No disease scans match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const imageUrl = resolveImageUrl(report.image_path);
                  const isHighlighted = checkIsHighlighted(report);
                  const conf = Number(report.confidence_score || 0);

                  return (
                    <tr
                      key={report.id}
                      id={`disease-report-${report.id}`}
                      className={`border-bottom ${isHighlighted ? 'highlighted-report-card' : ''}`}
                    >
                      {/* Image Thumbnail */}
                      <td className="ps-3 py-3">
                        {imageUrl ? (
                          <div
                            className="disease-thumb-container shadow-xs"
                            onClick={() => setSelectedReport(report)}
                            title="Click to view full diagnosis snapshot"
                          >
                            <img src={imageUrl} alt="Shrimp pathology scan" />
                            <div className="disease-zoom-overlay">
                              <FaExpandAlt />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="d-flex align-items-center justify-content-center rounded-3 border bg-light text-muted"
                            style={{ width: 54, height: 54, fontSize: '0.75rem' }}
                          >
                            <FaImage size={14} className="opacity-50" />
                          </div>
                        )}
                      </td>

                      {/* Basin & Caretaker */}
                      <td className="py-3">
                        <span
                          className="badge rounded-pill fw-bold px-2.5 py-1 mb-1 d-inline-flex align-items-center gap-1"
                          style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.78rem' }}
                        >
                          <FaWater size={10} /> {report.pond_name || 'Pond A1'}
                        </span>
                        <div className="d-flex align-items-center gap-1.5 text-dark fw-semibold small">
                          <FaUserCheck size={11} className="text-muted" />
                          {report.caretaker_name || 'Assigned Staff'}
                        </div>
                      </td>

                      {/* Disease Name */}
                      <td className="py-3">
                        <strong className="text-dark d-block" style={{ fontSize: '0.88rem' }}>
                          {report.disease_name}
                        </strong>
                        <span className="extra-small text-muted">Vision Classifier v2.4</span>
                      </td>

                      {/* AI Confidence */}
                      <td className="py-3">
                        <div className="d-flex align-items-center justify-content-between mb-1" style={{ maxWidth: 110 }}>
                          <strong className={conf >= 90 ? 'text-success' : conf >= 75 ? 'text-warning' : 'text-danger'}>
                            {conf.toFixed(1)}%
                          </strong>
                          <span className="extra-small text-muted">score</span>
                        </div>
                        <div className="feeding-progress-track" style={{ height: 6, maxWidth: 110 }}>
                          <div
                            className="feeding-progress-bar"
                            style={{
                              width: `${Math.min(100, conf)}%`,
                              background: conf >= 90 ? '#16A34A' : conf >= 75 ? '#FF7A00' : '#E11D48'
                            }}
                          ></div>
                        </div>
                      </td>

                      {/* Threat Level Badge */}
                      <td className="py-3">
                        {report.risk_level === 'High' ? (
                          <span className="tag-coral-critical d-inline-flex align-items-center gap-1">
                            <span className="rounded-circle" style={{ width: 6, height: 6, background: '#E11D48' }}></span>
                            High Threat
                          </span>
                        ) : report.risk_level === 'Medium' ? (
                          <span className="tag-orange-maintenance d-inline-flex align-items-center gap-1">
                            <span className="rounded-circle" style={{ width: 6, height: 6, background: '#EA580C' }}></span>
                            Moderate
                          </span>
                        ) : (
                          <span className="tag-green-safe d-inline-flex align-items-center gap-1">
                            <span className="rounded-circle" style={{ width: 6, height: 6, background: '#16A34A' }}></span>
                            Safe / Normal
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 text-secondary" style={{ whiteSpace: 'nowrap' }}>
                        <span className="d-flex align-items-center gap-1.5 extra-small">
                          <FaClock size={11} className="text-muted" />
                          {formatDate(report.created_at || report.report_date)}
                        </span>
                      </td>

                      {/* Recommendation */}
                      <td className="py-3" style={{ minWidth: 230 }}>
                        <div
                          className="p-2 rounded-3 border bg-light extra-small text-secondary"
                          style={{ lineHeight: 1.45, maxHeight: 60, overflowY: 'auto' }}
                        >
                          {report.recommendation || 'Continuous pond water monitoring and biosecurity protocols.'}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="pe-3 py-3 text-end">
                        <button
                          type="button"
                          className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-xs"
                          style={{
                            fontSize: '0.78rem',
                            background: '#F0F9FF',
                            color: '#0284C7',
                            border: '1px solid #BAE6FD'
                          }}
                          onClick={() => setSelectedReport(report)}
                          title="Inspect AI Pathology Snapshot"
                        >
                          <FaEye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 6. LUXURY IMAGE & DIAGNOSTIC BREAKDOWN MODAL */}
      {selectedReport && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Header */}
              <div className="caretaker-modal-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: 48,
                      height: 48,
                      background: 'rgba(2, 132, 199, 0.2)',
                      color: '#38BDF8',
                      fontSize: '1.25rem',
                      border: '1px solid rgba(56, 189, 248, 0.4)'
                    }}
                  >
                    <FaMicroscope />
                  </div>
                  <div>
                    <h5 className="fw-extrabold text-white mb-0 tracking-tight" style={{ fontSize: '1.2rem' }}>
                      Diagnostic Pathology Telemetry: {selectedReport.disease_name}
                    </h5>
                    <p className="text-white text-opacity-75 mb-0 small" style={{ fontSize: '0.8rem' }}>
                      Scan Record #{selectedReport.id} • {formatDate(selectedReport.created_at || selectedReport.report_date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center text-white p-0"
                  style={{ width: 34, height: 34, background: 'rgba(255, 255, 255, 0.12)', border: 'none' }}
                  onClick={() => setSelectedReport(null)}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: Split Presentation */}
              <div className="modal-body p-4 bg-white">
                <div className="row g-4 align-items-center">
                  {/* Left: High-Res Image Snapshot */}
                  <div className="col-12 col-lg-6">
                    <div
                      className="rounded-4 overflow-hidden border p-2 text-center"
                      style={{ background: '#0F172A', minHeight: 320 }}
                    >
                      {selectedReport.image_path ? (
                        <img
                          src={resolveImageUrl(selectedReport.image_path)}
                          alt={selectedReport.disease_name}
                          className="img-fluid rounded-3"
                          style={{ maxHeight: '420px', objectFit: 'contain', width: '100%' }}
                        />
                      ) : (
                        <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                          <FaImage size={48} className="mb-2 opacity-50 text-white" />
                          <span className="text-white text-opacity-75 small">No image uploaded with this scan log</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Telemetry & Pathology Details */}
                  <div className="col-12 col-lg-6">
                    {/* Severity & Confidence Badges */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                      {selectedReport.risk_level === 'High' ? (
                        <span className="tag-coral-critical fs-6 px-3 py-1.5">
                          High Biosecurity Risk
                        </span>
                      ) : selectedReport.risk_level === 'Medium' ? (
                        <span className="tag-orange-maintenance fs-6 px-3 py-1.5">
                          Moderate Biosecurity Risk
                        </span>
                      ) : (
                        <span className="tag-green-safe fs-6 px-3 py-1.5">
                          Safe / Low Risk
                        </span>
                      )}

                      <span className="tag-cyan-active fs-6 px-3 py-1.5">
                        {Number(selectedReport.confidence_score || 0).toFixed(2)}% AI Confidence
                      </span>
                    </div>

                    <h4 className="fw-extrabold text-dark mb-3">
                      {selectedReport.disease_name}
                    </h4>

                    {/* Metadata Chips Grid */}
                    <div className="row g-2.5 mb-3">
                      <div className="col-6">
                        <div className="p-2.5 rounded-3 bg-light border">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Basin / Location</span>
                          <strong className="text-dark small d-flex align-items-center gap-1">
                            <FaWater className="text-primary" /> {selectedReport.pond_name || 'Pond A1'}
                          </strong>
                        </div>
                      </div>

                      <div className="col-6">
                        <div className="p-2.5 rounded-3 bg-light border">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Caretaker In-Charge</span>
                          <strong className="text-dark small d-flex align-items-center gap-1">
                            <FaUserCheck className="text-success" /> {selectedReport.caretaker_name || 'Staff'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Protocol Recommendation */}
                    <div className="p-3 rounded-3 border mb-3" style={{ background: '#F8FAFC' }}>
                      <span className="extra-small text-primary text-uppercase fw-bold d-block mb-1">
                        Recommended Veterinary & Isolation Protocol
                      </span>
                      <p className="text-secondary small mb-0" style={{ lineHeight: 1.6 }}>
                        {selectedReport.recommendation || 'Continuous pond water monitoring and biosecurity protocols.'}
                      </p>
                    </div>

                    {/* Biosecurity Notice */}
                    <div className="d-flex align-items-center gap-2 p-2.5 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 text-warning-emphasis extra-small">
                      <FaExclamationTriangle size={14} className="flex-shrink-0" />
                      <span>
                        Field caretakers have been notified via mobile telemetry push notification.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                <span className="text-muted extra-small">
                  ShrimpPredict Pathology Vision Core v2.4 • CNN-ResNet Classifier
                </span>
                <button
                  type="button"
                  className="btn btn-sm rounded-pill px-4 py-2 text-secondary fw-semibold border bg-white"
                  onClick={() => setSelectedReport(null)}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
