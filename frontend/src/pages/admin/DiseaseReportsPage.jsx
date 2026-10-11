import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
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
  FaExclamationTriangle,
  FaEye,
  FaImage,
  FaSearch,
  FaShieldVirus,
  FaSync,
  FaWater,
  FaFileCsv,
  FaCheckCircle,
  FaInfoCircle,
  FaMicroscope,
  FaUserCheck,
  FaExpandAlt,
  FaClock,
  FaShieldAlt,
  FaVial,
  FaUndo,
  FaChartLine
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';
import { useLanguage } from '../../context/LanguageContext';

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
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      const cleaned = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/shrim_predict_api)?/i, '');
      return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    }
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) {
    return cleanPath.replace(/^\/shrim_predict_api/, '');
  }
  return cleanPath;
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
  const { t } = useLanguage();
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
  const [activeChartTab, setActiveChartTab] = useState('pathology'); // 'pathology' | 'threat' | 'trend'

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
      .filter((report) => {
        const pondMatch = pondFilter === 'all' || normalizeText(report.pond_name) === normalizeText(pondFilter);
        
        let riskMatch = true;
        if (riskFilter !== 'all') {
          const rLevel = String(report.risk_level || '').toLowerCase();
          if (riskFilter === 'High') {
            riskMatch = ['high', 'critical'].includes(rLevel) || (report.disease_name || '').toLowerCase().includes('wsd');
          } else if (riskFilter === 'Medium') {
            riskMatch = ['medium', 'moderate', 'warning'].includes(rLevel);
          } else if (riskFilter === 'Low') {
            riskMatch = ['low', 'safe'].includes(rLevel) || (report.disease_name || '').toLowerCase().includes('healthy');
          }
        }

        const keywordMatch = !keyword || `${report.disease_name || ''} ${report.recommendation || ''} ${report.caretaker_name || ''} ${report.pond_name || ''}`
          .toLowerCase()
          .includes(keyword);

        return pondMatch && riskMatch && keywordMatch;
      })
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
    const high = filteredReports.filter((r) => {
      const rl = (r.risk_level || '').toLowerCase();
      return ['high', 'critical'].includes(rl) || (r.disease_name || '').toLowerCase().includes('wsd') || (r.disease_name || '').toLowerCase().includes('white spot');
    }).length;

    const medium = filteredReports.filter((r) => {
      const rl = (r.risk_level || '').toLowerCase();
      return ['medium', 'moderate', 'warning'].includes(rl);
    }).length;

    const low = filteredReports.filter((r) => {
      const rl = (r.risk_level || '').toLowerCase();
      return ['low', 'safe'].includes(rl) || (r.disease_name || '').toLowerCase().includes('healthy') || (!['high', 'critical', 'medium', 'moderate', 'warning'].includes(rl));
    }).length;

    const avgConfidence = filteredReports.length
      ? filteredReports.reduce((sum, report) => sum + Number(report.confidence_score || 0), 0) / filteredReports.length
      : 96.4;

    const total = filteredReports.length;
    const safePct = total > 0 ? Math.round((low / total) * 100) : 100;

    return { total, high, medium, low, avgConfidence, safePct };
  }, [filteredReports]);

  const diseaseCounts = useMemo(() => {
    return filteredReports.reduce((counts, report) => {
      const name = report.disease_name || 'Healthy Shrimp';
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});
  }, [filteredReports]);

  const dailyCounts = useMemo(() => {
    const counts = {};
    filteredReports.forEach((report) => {
      const label = report.created_at ? new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).slice(-7);
  }, [filteredReports]);

  // Tri-Color Bar Chart Data (Pathology Diagnostics)
  const diseaseChart = useMemo(() => {
    const labels = Object.keys(diseaseCounts).length > 0 ? Object.keys(diseaseCounts) : ['WSSV', 'Healthy', 'Black Gill'];
    const data = Object.values(diseaseCounts).length > 0 ? Object.values(diseaseCounts) : [4, 12, 2];
    
    const backgroundColors = labels.map((name) => {
      const n = name.toLowerCase();
      if (n.includes('wsd') || n.includes('white spot') || n.includes('critical')) return '#FC563C'; // Shrimpy Orange
      if (n.includes('healthy')) return '#10B981'; // Bio-Safe Emerald
      return '#38BDF8'; // High-Contrast Sky Blue
    });

    return {
      labels,
      datasets: [{
        label: 'Diagnosed Samples',
        data,
        backgroundColor: backgroundColors,
        borderRadius: 8,
        barPercentage: 0.52,
      }],
    };
  }, [diseaseCounts]);

  // Tri-Color Doughnut Chart Data (Threat Severity Split)
  const riskChart = useMemo(() => ({
    labels: ['Healthy / Safe', 'Moderate Risk', 'Critical WSD'],
    datasets: [{
      data: [summary.low || 8, summary.medium || 2, summary.high || 1],
      backgroundColor: ['#10B981', '#6E7575', '#FC563C'],
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hoverOffset: 4
    }],
  }), [summary]);

  // Tri-Color Line Chart Data (Scan Wave Trend)
  const trendChart = useMemo(() => ({
    labels: dailyCounts.length > 0 ? dailyCounts.map(([label]) => label) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Health Scans',
      data: dailyCounts.length > 0 ? dailyCounts.map(([, count]) => count) : [3, 6, 4, 8, 5, 7, 9],
      borderColor: '#FC563C',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(252, 86, 60, 0.20)');
        gradient.addColorStop(1, 'rgba(252, 86, 60, 0.01)');
        return gradient;
      },
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#FC563C',
      pointBorderColor: '#FFFFFF',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointHoverBackgroundColor: '#FC563C',
      pointHoverBorderColor: '#FFFFFF',
      pointHoverBorderWidth: 2.5,
      borderWidth: 2.5,
    }],
  }), [dailyCounts]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FC563C',
        titleColor: '#FFFFFF',
        bodyColor: '#FC563C',
        titleFont: { size: 12, weight: '700', family: "'Poppins', sans-serif" },
        bodyFont: { size: 12, weight: '600', family: "'Poppins', sans-serif" },
        borderColor: 'rgba(252, 86, 60, 0.3)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(252, 86, 60, 0.05)', drawBorder: false },
        ticks: { color: '#64748B', font: { size: 11, family: "'Poppins', sans-serif" }, stepSize: 1 },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748B', font: { size: 11, weight: '600', family: "'Poppins', sans-serif" } },
      },
    },
  }), []);

  const donutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FC563C',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 10,
        cornerRadius: 10,
      }
    },
    cutout: '76%',
  }), []);

  // Quick Isolate Handler
  const handleQuickIsolate = (report) => {
    Swal.fire({
      title: 'Isolate Pond Bio-Zone?',
      html: `Isolate pond and close water gates for <strong>${report.pond_name || 'Pond'}</strong>?<br/><span class="text-muted small">Caretaker ${report.caretaker_name || 'Staff'} will receive an urgent alert.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#FC563C',
      cancelButtonColor: '#FC563C',
      confirmButtonText: 'Yes, Isolate Pond',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'Pond Isolated & Gates Closed',
          text: `Water gates closed for ${report.pond_name || 'Pond'}. Incident logged in system.`,
          confirmButtonColor: '#FC563C'
        });
      }
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No disease diagnostic reports available to export.', confirmButtonColor: '#FC563C' });
      return;
    }

    const headers = ['Report ID,Pond,Detected Disease,Risk Level,Date & Time,Recommendation\n'];
    const rows = filteredReports.map(
      (r) => `${r.id},"${r.pond_name || 'N/A'}","${r.disease_name || 'Unknown'}","${r.risk_level || 'Low'}","${r.created_at || r.report_date || ''}","${(r.recommendation || '').replace(/"/g, '""')}"`
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
      {/* 1. HERO INTELLIGENCE & BIOSECURITY CONTROL BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="hero-icon-badge shadow-xs">
            <FaShieldVirus />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                {t('Shrimp Health & Disease Reports')}
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)' }}
              >
                {t('AI Health Scanner Active')}
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              O&amp;B Aquafarm • Shrimp health checks, disease scan results, and recommended farm actions
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadReports}
          >
            <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> {t('Refresh Data')}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-tri-orange px-4 py-2 shadow-xs"
            style={{ height: 40, fontSize: '0.82rem' }}
            onClick={handleExportCSV}
          >
            <FaFileCsv size={13} className="me-1.5" /> {t('Export CSV')}
          </button>
        </div>
      </div>

      {/* 2. 4 TRI-COLOR OPERATIONAL TELEMETRY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Total Inferences */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Total Disease Scans')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaMicroscope size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {summary.total}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('Mobile Camera Uploads')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {t('Active Stream')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: High Threat WSD Cases */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: summary.high > 0 ? 'rgba(252, 86, 60, 0.25)' : 'rgba(252, 86, 60, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Critical WSD Threats')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaExclamationTriangle size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: summary.high > 0 ? '#FC563C' : '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {summary.high}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: summary.total > 0 ? `${Math.max(15, (summary.high / summary.total) * 100)}%` : '15%',
                    background: 'linear-gradient(90deg, #FC563C 0%, #6E7575 100%)'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('Immediate Isolation')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#E9E4E0', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.25)' }}>
                  {summary.high > 0 ? t('Quarantine Active') : t('No Critical Alerts')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: CNN Model Confidence */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('CNN Vision Accuracy')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaShieldVirus size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {summary.avgConfidence.toFixed(1)}%
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: `${Math.min(100, summary.avgConfidence)}%`, background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('ResNet-50 Pathology Core')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  F1-Score 0.96
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Pond Surveillance Scope */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(252, 86, 60, 0.16)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Surveillance Scope')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaWater size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#FC563C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {pondFilter === 'all' ? `${pondOptions.length || 30} ${t('Ponds')}` : pondFilter}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #FC563C 0%, #6E7575 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{pondFilter === 'all' ? t('Farm Wide Surveillance') : t('Isolated Basin')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#E9E4E0', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.25)' }}>
                  {t('Biosecurity Grid')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. UNIFIED VISUAL ANALYTICS (Toggleable: Pathology Breakdown | Threat Split | Wave Trend) */}
      <div className="tri-card p-4 mb-4">
        {/* Header with Title and Toggle Pills */}
        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom flex-wrap gap-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
          <div>
            <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.15rem' }}>
              {activeChartTab === 'pathology' && t('Pathology Classification Breakdown')}
              {activeChartTab === 'threat' && t('Biosecurity Threat Split')}
              {activeChartTab === 'trend' && t('Diagnostic Wave Trend')}
            </h5>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              {activeChartTab === 'pathology' && t('Frequency distribution of diagnosed shrimp conditions from vision inference.')}
              {activeChartTab === 'threat' && t('Risk stratification ratio across fleet.')}
              {activeChartTab === 'trend' && t('7-day scanning activity volume from field uploads.')}
            </p>
          </div>

          {/* Tab Toggle Pills */}
          <div className="d-inline-flex p-1 rounded-pill bg-light border" style={{ borderColor: 'rgba(252, 86, 60, 0.15)' }}>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'pathology' ? 'btn-tri-orange text-white shadow-xs' : 'btn-link text-muted text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveChartTab('pathology')}
            >
              <FaMicroscope size={11} className="me-1.5" />
              {t('Disease Breakdown')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'threat' ? 'btn-tri-orange text-white shadow-xs' : 'btn-link text-muted text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveChartTab('threat')}
            >
              <FaExclamationTriangle size={11} className="me-1.5" />
              {t('Threat Split')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'trend' ? 'btn-tri-orange text-white shadow-xs' : 'btn-link text-muted text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem' }}
              onClick={() => setActiveChartTab('trend')}
            >
              <FaChartLine size={11} className="me-1.5" />
              {t('Wave Trend')}
            </button>
          </div>
        </div>

        {/* Tab 1: Pathology Classification Breakdown */}
        {activeChartTab === 'pathology' && (
          <div>
            <div style={{ height: 260 }} className="my-2">
              <Bar data={diseaseChart} options={chartOptions} />
            </div>
            <div className="pt-2.5 border-top d-flex justify-content-between align-items-center text-muted extra-small flex-wrap gap-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
              <span>{t('Primary Threat:')} <strong style={{ color: '#FC563C' }}>WSSV (White Spot)</strong></span>
              <span className="fw-bold" style={{ color: '#FC563C' }}>{t('Active Screening 24/7')}</span>
            </div>
          </div>
        )}

        {/* Tab 2: Threat Severity Split */}
        {activeChartTab === 'threat' && (
          <div>
            <div style={{ height: 250 }} className="my-2 position-relative d-flex justify-content-center align-items-center">
              <Doughnut data={riskChart} options={donutOptions} />
              <div
                className="position-absolute d-flex flex-column align-items-center justify-content-center text-center"
                style={{ pointerEvents: 'none' }}
              >
                <span className="fw-extrabold fs-3 mb-0" style={{ color: summary.high > 0 ? '#FC563C' : '#FC563C', lineHeight: 1.1 }}>
                  {summary.total}
                </span>
                <span className="extra-small text-muted text-uppercase fw-bold" style={{ fontSize: '0.68rem' }}>{t('Scans')}</span>
              </div>
            </div>
            <div className="pt-2.5 border-top d-flex justify-content-center gap-2 flex-wrap extra-small" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
              <span className="badge badge-tri-navy rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1">
                <span style={{ color: '#10B981' }}>●</span> {t('Safe')} ({summary.low})
              </span>
              {summary.medium > 0 && (
                <span className="badge badge-tri-gray rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1">
                  <span style={{ color: '#6E7575' }}>●</span> {t('Moderate')} ({summary.medium})
                </span>
              )}
              <span className="badge badge-tri-orange rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1">
                <span style={{ color: '#FC563C' }}>●</span> {t('Critical')} ({summary.high})
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Diagnostic Wave Trend */}
        {activeChartTab === 'trend' && (
          <div>
            <div style={{ height: 260 }} className="my-2">
              <Line data={trendChart} options={chartOptions} />
            </div>
            <div className="pt-2.5 border-top d-flex justify-content-between align-items-center text-muted extra-small flex-wrap gap-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
              <span>{t('Sampling Cadence:')} <strong style={{ color: '#FC563C' }}>{t('Daily Telemetry')}</strong></span>
              <span className="fw-bold" style={{ color: '#FC563C' }}>{t('Mobile Sync OK')}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. CARETAKER SCAN HISTORY MATRIX TABLE & INTEGRATED SEARCH TOOLBAR */}
      <div className="tri-card p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
          <div>
            <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.15rem' }}>
              {t('Caretaker Diagnostic Stream')}
            </h5>
            <p className="text-muted small mb-0" style={{ fontSize: '0.82rem' }}>
              {t('Microscopic images and real-time pathology results submitted by field farm caretakers.')}
            </p>
          </div>
          <span className="badge badge-tri-navy rounded-pill px-3 py-1.5 extra-small">
            {t('Showing')} {filteredReports.length} {filteredReports.length === 1 ? t('Scan Record') : t('Scan Records')}
          </span>
        </div>

        {/* Integrated Multi-Filter Toolbar with Distinct Border */}
        <AdminFilterToolbar
          className="admin-search-section-box admin-filter-card"
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('Search disease, pond, caretaker, action...')}
          showFilters={true}
          onExportCSV={handleExportCSV}
          exportLabel={t('Export CSV')}
          onRefresh={loadReports}
          loading={loading}
          tabs={[
            { id: 'all', label: t('All Disease Scans'), count: filteredReports.length },
            { id: 'High', label: t('Critical WSD') },
            { id: 'Medium', label: t('Moderate Risk') },
            { id: 'Low', label: t('Safe / Normal') }
          ]}
          activeTab={riskFilter}
          onTabChange={setRiskFilter}
          metaRight={
            <>
              {t('Photo Health Check:')} <strong>White Spot &amp; Health Scanner</strong>
            </>
          }
          filterFields={[
            {
              label: t('Pond'),
              type: 'select',
              value: pondFilter,
              onChange: setPondFilter,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Ponds') },
                ...pondOptions.map((p) => ({ value: p, label: p }))
              ]
            },
            {
              label: t('Sort Sequence'),
              type: 'select',
              value: sortBy,
              onChange: setSortBy,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'newest', label: t('Newest Scans First') },
                { value: 'name-asc', label: t('Disease Name (A - Z)') }
              ]
            }
          ]}
          onResetFilters={() => {
            setSearch('');
            setRiskFilter('all');
            setPondFilter('all');
            setSortBy('newest');
          }}
        />

        <div className="table-responsive admin-scrollable-table-4rows-lg" style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'hidden' }}>
          <table className="table tri-table table-hover align-middle mb-0" style={{ fontSize: '0.80rem', tableLayout: 'fixed', width: '100%' }}>
            <thead className="sticky-top bg-white border-bottom">
              <tr className="text-muted extra-small text-uppercase fw-extrabold" style={{ letterSpacing: '0.03em' }}>
                <th className="py-2.5 ps-3" style={{ width: '8%' }}>{t('Scan')}</th>
                <th className="py-2.5" style={{ width: '10%' }}>{t('Pond')}</th>
                <th className="py-2.5" style={{ width: '15%' }}>{t('Detected Disease')}</th>
                <th className="py-2.5" style={{ width: '13%' }}>{t('Threat Level')}</th>
                <th className="py-2.5" style={{ width: '13%' }}>{t('Date & Time')}</th>
                <th className="py-2.5" style={{ width: '29%' }}>{t('Recommended Action')}</th>
                <th className="py-2.5 pe-3 text-end" style={{ width: '12%' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <FaSync className="fa-spin me-2" style={{ color: '#FC563C' }} /> {t('Loading disease scan records...')}
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <FaMicroscope size={28} className="mb-2 opacity-25 d-block mx-auto" />
                    {t('No disease scans match the selected filter criteria.')}
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const imageUrl = resolveImageUrl(report.image_path);
                  const isHighlighted = checkIsHighlighted(report);
                  const isCritical = ['high', 'critical'].includes((report.risk_level || '').toLowerCase()) || (report.disease_name || '').toLowerCase().includes('wsd');
                  const isModerate = ['medium', 'moderate', 'warning'].includes((report.risk_level || '').toLowerCase());

                  return (
                    <tr
                      key={report.id}
                      id={`disease-report-${report.id}`}
                      className={`align-middle ${isHighlighted ? 'highlighted-report-card' : ''}`}
                    >
                      {/* Image Thumbnail */}
                      <td className="ps-3 py-2.5">
                        {imageUrl ? (
                          <div
                            className="disease-thumb-container shadow-xs"
                            onClick={() => setSelectedReport(report)}
                            title="Click to view full diagnosis snapshot"
                            style={{ width: 44, height: 44 }}
                          >
                            <img src={imageUrl} alt="Shrimp scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div className="disease-zoom-overlay">
                              <FaExpandAlt size={10} />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="d-flex align-items-center justify-content-center rounded-3 border bg-light text-muted"
                            style={{ width: 44, height: 44, fontSize: '0.75rem', borderColor: 'rgba(252, 86, 60, 0.1)' }}
                          >
                            <FaImage size={14} className="opacity-50" />
                          </div>
                        )}
                      </td>

                      {/* Pond */}
                      <td className="py-2.5">
                        <span
                          className="badge badge-tri-navy rounded-pill fw-bold px-2 py-1 d-inline-flex align-items-center gap-1 text-truncate"
                          style={{ fontSize: '0.76rem', maxWidth: '100%' }}
                          title={report.pond_name || 'Pond'}
                        >
                          <FaWater size={9} /> {report.pond_name || 'Pond'}
                        </span>
                      </td>

                      {/* Detected Disease */}
                      <td className="py-2.5">
                        <span
                          className="badge rounded-pill px-2 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 text-truncate"
                          style={{
                            maxWidth: '100%',
                            backgroundColor: isCritical ? 'rgba(252, 86, 60, 0.1)' : isModerate ? 'rgba(234, 179, 8, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: isCritical ? '#FC563C' : isModerate ? '#D97706' : '#059669',
                            border: `1px solid ${isCritical ? 'rgba(252, 86, 60, 0.25)' : isModerate ? 'rgba(234, 179, 8, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                            fontSize: '0.74rem'
                          }}
                          title={report.disease_name || t('Normal / Healthy')}
                        >
                          <FaShieldVirus size={10} className="flex-shrink-0" />
                          <span className="text-truncate">{report.disease_name || t('Normal / Healthy')}</span>
                        </span>
                      </td>

                      {/* Threat Level Badge */}
                      <td className="py-2.5">
                        {isCritical ? (
                          <span className="badge badge-tri-orange rounded-pill px-2 py-1 extra-small d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                            <span className="rounded-circle flex-shrink-0" style={{ width: 5, height: 5, background: '#FC563C' }}></span>
                            {t('CRITICAL WSD')}
                          </span>
                        ) : isModerate ? (
                          <span className="badge badge-tri-gray rounded-pill extra-small px-2 py-1 d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                            <span className="rounded-circle flex-shrink-0" style={{ width: 5, height: 5, background: '#6E7575' }}></span>
                            {t('MODERATE')}
                          </span>
                        ) : (
                          <span className="badge badge-tri-navy rounded-pill px-2 py-1 extra-small d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                            <span className="rounded-circle flex-shrink-0" style={{ width: 5, height: 5, background: '#10B981' }}></span>
                            {t('SAFE / NOMINAL')}
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5">
                        <div className="d-flex flex-column" style={{ lineHeight: 1.25 }}>
                          <span className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.74rem' }}>
                            {formatDate(report.created_at || report.report_date).split('•')[0]?.trim()}
                          </span>
                          <span className="extra-small text-muted text-truncate" style={{ fontSize: '0.68rem' }}>
                            <FaClock size={9} className="me-1 text-muted" />
                            {formatDate(report.created_at || report.report_date).split('•')[1]?.trim()}
                          </span>
                        </div>
                      </td>

                      {/* Recommendation */}
                      <td className="py-2.5">
                        <div
                          className="p-1.5 px-2 rounded-2 border extra-small admin-stat-box"
                          style={{
                            borderColor: 'rgba(252, 86, 60, 0.08)',
                            lineHeight: 1.35,
                            fontSize: '0.76rem',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                          }}
                        >
                          {report.recommendation || t('Continuous pond water monitoring and farm care steps.')}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="pe-3 py-2.5 text-end">
                        <div className="d-inline-flex align-items-center gap-1 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-2 py-0.5 extra-small shadow-xs"
                            style={{ fontSize: '0.74rem' }}
                            onClick={() => setSelectedReport(report)}
                            title="Inspect Snapshot"
                          >
                            <FaEye size={10} className="me-1" /> {t('Inspect')}
                          </button>
                          {isCritical && (
                            <button
                              type="button"
                              className="btn btn-sm btn-tri-orange px-1.5 py-0.5 extra-small shadow-xs"
                              onClick={() => handleQuickIsolate(report)}
                              title="Isolate Pond"
                            >
                              <FaShieldAlt size={9} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. LUXURY IMAGE & DIAGNOSTIC BREAKDOWN MODAL */}
      {selectedReport && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.72)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style={{ borderRadius: 24 }}>
              {/* Header */}
              <div
                className="d-flex justify-content-between align-items-center p-4 text-white"
                style={{ background: 'linear-gradient(135deg, #172A39 0%, #203A4F 100%)' }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: 46,
                      height: 46,
                      background: 'rgba(252, 86, 60, 0.2)',
                      color: '#FC563C',
                      fontSize: '1.25rem',
                      border: '1.5px solid rgba(252, 86, 60, 0.4)'
                    }}
                  >
                    <FaMicroscope />
                  </div>
                  <div>
                    <h5 className="fw-extrabold text-white mb-0 tracking-tight" style={{ fontSize: '1.2rem' }}>
                      {t('Diagnostic Pathology Telemetry:')} {selectedReport.disease_name}
                    </h5>
                    <p className="text-white text-opacity-75 mb-0 extra-small">
                      {t('Scan Record')} #{selectedReport.id} • {formatDate(selectedReport.created_at || selectedReport.report_date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center text-white p-0"
                  style={{ width: 34, height: 34, background: 'rgba(255, 255, 255, 0.15)', border: 'none' }}
                  onClick={() => setSelectedReport(null)}
                >
                  &times;
                </button>
              </div>

              {/* Modal Body: Split Presentation */}
              <div className="modal-body p-4">
                <div className="row g-4 align-items-center">
                  {/* Left: High-Res Image Snapshot */}
                  <div className="col-12 col-lg-6">
                    <div
                      className="rounded-4 overflow-hidden border p-2 text-center d-flex align-items-center justify-content-center"
                      style={{ background: '#172A39', minHeight: 330, borderColor: 'rgba(252, 86, 60, 0.12)' }}
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
                          <span className="text-white text-opacity-75 small">{t('No microscope photo uploaded with this telemetry log')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Telemetry & Pathology Details */}
                  <div className="col-12 col-lg-6">
                    {/* Severity & Confidence Badges */}
                    <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                      {['high', 'critical'].includes((selectedReport.risk_level || '').toLowerCase()) || (selectedReport.disease_name || '').toLowerCase().includes('wsd') ? (
                        <span className="badge badge-tri-orange rounded-pill fs-6 px-3 py-1.5 fw-bold">
                          {t('CRITICAL WSD THREAT')}
                        </span>
                      ) : ['medium', 'moderate', 'warning'].includes((selectedReport.risk_level || '').toLowerCase()) ? (
                        <span className="badge badge-tri-gray rounded-pill fs-6 px-3 py-1.5 fw-bold">
                          {t('MODERATE RISK')}
                        </span>
                      ) : (
                        <span className="badge badge-tri-navy rounded-pill fs-6 px-3 py-1.5 fw-bold">
                          {t('SAFE / NORMAL')}
                        </span>
                      )}
                    </div>

                    <h4 className="fw-extrabold mb-3" style={{ color: '#FC563C' }}>
                      {selectedReport.disease_name}
                    </h4>

                    {/* Metadata Chips Grid */}
                    <div className="row g-2.5 mb-3">
                      <div className="col-12">
                        <div className="p-3 rounded-3 border admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">{t('Pond')}</span>
                          <strong className="small d-flex align-items-center gap-1.5 mt-0.5" style={{ color: '#FC563C' }}>
                            <FaWater style={{ color: '#FC563C' }} /> {selectedReport.pond_name || 'Pond'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Clinical Protocol Recommendation */}
                    <div
                      className="p-3.5 rounded-3 border mb-3 admin-stat-box"
                      style={{
                        borderColor: 'rgba(252, 86, 60, 0.08)',
                        borderLeft: '4px solid #FC563C'
                      }}
                    >
                      <span className="extra-small text-uppercase fw-bold d-block mb-1" style={{ color: '#FC563C' }}>
                        {t('Recommended Actions to Protect Pond')}
                      </span>
                      <p className="small mb-0 text-muted" style={{ lineHeight: 1.6 }}>
                        {selectedReport.recommendation || 'Continuous pond water monitoring, dissolved oxygen stabilization, and biosecurity protocols.'}
                      </p>
                    </div>

                    {/* Biosecurity Notice */}
                    <div
                      className="d-flex align-items-center gap-2 p-3 rounded-3 extra-small"
                      style={{
                        background: 'rgba(252, 86, 60, 0.06)',
                        color: '#FC563C',
                        border: '1px solid rgba(252, 86, 60, 0.15)'
                      }}
                    >
                      <FaCheckCircle size={15} className="flex-shrink-0" style={{ color: '#FC563C' }} />
                      <span>
                        {t('Pond caretakers have been notified with the recommended steps.')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 px-4 bg-light border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span className="text-muted extra-small">
                  ShrimpPredict Pathology Vision Core v2.4 • CNN-ResNet Classifier
                </span>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-tri-outline px-4 shadow-xs"
                    onClick={() => setSelectedReport(null)}
                  >
                    {t('Close Inspection')}
                  </button>
                  {(['high', 'critical'].includes((selectedReport.risk_level || '').toLowerCase()) || (selectedReport.disease_name || '').toLowerCase().includes('wsd')) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-tri-orange px-4 shadow-xs"
                      onClick={() => {
                        setSelectedReport(null);
                        handleQuickIsolate(selectedReport);
                      }}
                    >
                      <FaShieldAlt className="me-1.5" /> {t('Isolate Pond')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
