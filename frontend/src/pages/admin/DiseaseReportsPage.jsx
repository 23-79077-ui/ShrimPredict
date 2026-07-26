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
} from 'chart.js';
import {
  FaCalendarAlt,
  FaChartBar,
  FaExclamationTriangle,
  FaEye,
  FaFilter,
  FaImage,
  FaSearch,
  FaShieldVirus,
  FaSync,
  FaTimes,
  FaUserTie,
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

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

const riskBadgeClass = (risk) => {
  if (risk === 'High') return 'badge-danger';
  if (risk === 'Medium') return 'badge-warning';
  return 'badge-success';
};

const formatDate = (value) => {
  if (!value) return 'No date';
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export default function DiseaseReportsPage() {
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('report_id');
  const targetPond = searchParams.get('pond');
  const targetIssue = searchParams.get('issue');
  const targetCaretaker = searchParams.get('caretaker');

  const [reports, setReports] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [caretakerFilter, setCaretakerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const loadCaretakers = async () => {
      try {
        const res = await api.get('/users.php');
        const list = Array.isArray(res.data?.users || res.data) ? (res.data.users || res.data) : [];
        setCaretakers(list.filter((user) => user.role === 'caretaker'));
      } catch (error) {
        setCaretakers([]);
      }
    };
    loadCaretakers();
  }, []);

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

        if (matched.image_path) {
          setPreviewImage(resolveImageUrl(matched.image_path));
        }
      }
    }
  }, [targetId, targetIssue, targetPond, reports, checkIsHighlighted]);

  const caretakerOptions = useMemo(() => {
    const options = caretakers.map((caretaker) => ({
      value: String(caretaker.id),
      label: caretaker.full_name,
      id: String(caretaker.id),
      name: caretaker.full_name,
    }));
    const knownNames = new Set(options.map((option) => normalizeText(option.name)));

    reports.forEach((report) => {
      const reportName = String(report.caretaker_name || '').trim();
      const normalizedName = normalizeText(reportName);
      if (reportName && !knownNames.has(normalizedName)) {
        knownNames.add(normalizedName);
        options.push({
          value: `name:${reportName}`,
          label: reportName,
          id: '',
          name: reportName,
        });
      }
    });

    return options;
  }, [caretakers, reports]);

  const filteredReports = useMemo(() => {
    const selectedCaretaker = caretakerOptions.find((caretaker) => caretaker.value === caretakerFilter);
    const selectedCaretakerId = String(selectedCaretaker?.id || '');
    const selectedCaretakerName = normalizeText(selectedCaretaker?.name);
    const keyword = search.trim().toLowerCase();

    return reports.filter((report) => (
      (caretakerFilter === 'all'
        || (selectedCaretakerId && String(report.user_id || '') === selectedCaretakerId)
        || (selectedCaretakerName && normalizeText(report.caretaker_name) === selectedCaretakerName))
      && (riskFilter === 'all' || report.risk_level === riskFilter)
      && (statusFilter === 'all' || report.status === statusFilter)
      && (!keyword || `${report.disease_name || ''} ${report.recommendation || ''} ${report.caretaker_name || ''} ${report.pond_name || ''}`
          .toLowerCase()
          .includes(keyword))
    ));
  }, [caretakerFilter, caretakerOptions, reports, riskFilter, search, statusFilter]);

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
      const name = report.disease_name || 'Unknown';
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

  const diseaseChart = {
    labels: Object.keys(diseaseCounts),
    datasets: [{
      label: 'Scans',
      data: Object.values(diseaseCounts),
      backgroundColor: '#0B2C5F',
      borderRadius: 8,
    }],
  };

  const riskChart = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [summary.high, summary.medium, summary.low],
      backgroundColor: ['#E04848', '#FF7A00', '#1FB567'],
      borderWidth: 0,
    }],
  };

  const trendChart = {
    labels: dailyCounts.map(([label]) => label),
    datasets: [{
      label: 'Disease scans',
      data: dailyCounts.map(([, count]) => count),
      borderColor: '#FF7A00',
      backgroundColor: 'rgba(255,122,0,0.14)',
      tension: 0.35,
      fill: true,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-1.5 rounded-pill fw-semibold extra-small">
            <FaShieldVirus className="me-1" /> WSSV & Disease Risk Scanning Intelligence
          </span>
        </div>
        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 rounded-pill px-3" onClick={loadReports}>
          <FaSync /> Refresh
        </button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="metric-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small fw-semibold mb-1">Total Scans</p>
                <h3 className="mb-0">{summary.total}</h3>
              </div>
              <span className="metric-icon"><FaChartBar /></span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small fw-semibold mb-1">High Risk</p>
                <h3 className="mb-0 text-danger">{summary.high}</h3>
              </div>
              <span className="metric-icon"><FaExclamationTriangle /></span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small fw-semibold mb-1">Avg Confidence</p>
                <h3 className="mb-0">{summary.avgConfidence.toFixed(1)}%</h3>
              </div>
              <span className="metric-icon"><FaShieldVirus /></span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <p className="text-muted small fw-semibold mb-1">Caretaker Filter</p>
                <h4 className="mb-0">{caretakerFilter === 'all' ? 'All' : caretakerOptions.find((c) => c.value === caretakerFilter)?.label || 'Selected'}</h4>
              </div>
              <span className="metric-icon"><FaUserTie /></span>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small fw-semibold d-flex align-items-center gap-1">
              <FaFilter /> Filters:
            </span>
            <select className="form-select form-select-sm w-auto" value={caretakerFilter} onChange={(e) => setCaretakerFilter(e.target.value)}>
              <option value="all">All Caretakers</option>
              {caretakerOptions.map((caretaker) => (
                <option key={caretaker.value} value={caretaker.value}>{caretaker.label}</option>
              ))}
            </select>
            <select className="form-select form-select-sm w-auto" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">All Risks</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select className="form-select form-select-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Resolved">Resolved</option>
            </select>
            <div className="input-group input-group-sm ms-lg-auto" style={{ maxWidth: 320 }}>
              <span className="input-group-text bg-white"><FaSearch /></span>
              <input
                className="form-control"
                placeholder="Search disease, pond, caretaker"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-5">
          <div className="chart-card h-100">
            <div className="card-body" style={{ height: 320 }}>
              <h5 className="card-title mb-3">Disease Counts</h5>
              <Bar data={diseaseChart} options={chartOptions} />
            </div>
          </div>
        </div>
        <div className="col-xl-3">
          <div className="chart-card h-100">
            <div className="card-body" style={{ height: 320 }}>
              <h5 className="card-title mb-3">Risk Split</h5>
              <Doughnut data={riskChart} options={chartOptions} />
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="chart-card h-100">
            <div className="card-body" style={{ height: 320 }}>
              <h5 className="card-title mb-3">Scan Trend</h5>
              <Line data={trendChart} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <div>
              <h5 className="card-title mb-1">Caretaker Scan History</h5>
              <p className="text-muted mb-0">Images and AI results submitted from caretaker disease scans.</p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Caretaker</th>
                  <th>Disease</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Date</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="7" className="text-center text-muted py-4">Loading disease reports...</td></tr>
                )}
                {!loading && filteredReports.length === 0 && (
                  <tr><td colSpan="7" className="text-center text-muted py-4">No disease scans match the selected filters.</td></tr>
                )}
                {!loading && filteredReports.map((report) => {
                  const imageUrl = resolveImageUrl(report.image_path);
                  const isHighlighted = checkIsHighlighted(report);
                  return (
                    <tr
                      key={report.id}
                      id={`disease-report-${report.id}`}
                      className={isHighlighted ? 'highlighted-report-card' : ''}
                    >
                      <td>
                        {imageUrl ? (
                          <button
                            type="button"
                            className="btn p-0 border-0 bg-transparent"
                            onClick={() => setPreviewImage(imageUrl)}
                            title="View scan image"
                          >
                            <img src={imageUrl} alt="Disease scan" className="disease-report-thumb" />
                          </button>
                        ) : (
                          <span className="badge bg-light text-muted border"><FaImage className="me-1" /> No image</span>
                        )}
                      </td>
                      <td>
                        <div className="fw-semibold">{report.caretaker_name || 'Caretaker'}</div>
                        <small className="text-muted">{report.pond_name || 'Assigned Pond'}</small>
                      </td>
                      <td className="fw-semibold">{report.disease_name}</td>
                      <td>{Number(report.confidence_score || 0).toFixed(2)}%</td>
                      <td><span className={`badge ${riskBadgeClass(report.risk_level)}`}>{report.risk_level || 'Low'}</span></td>
                      <td>
                        <span className="d-flex align-items-center gap-2 text-muted small">
                          <FaCalendarAlt /> {formatDate(report.created_at)}
                        </span>
                      </td>
                      <td style={{ minWidth: 260 }}>
                        <div className="d-flex align-items-start gap-2">
                          <FaEye className="text-primary mt-1" />
                          <span>{report.recommendation || 'Monitor closely.'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {previewImage && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.84)', zIndex: 1060 }}
          onClick={() => setPreviewImage(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content bg-transparent border-0 text-white text-center">
              <div className="d-flex justify-content-end mb-2">
                <button className="btn btn-light rounded-circle p-2" onClick={() => setPreviewImage(null)} title="Close Preview">
                  <FaTimes size={20} />
                </button>
              </div>
              <img
                src={previewImage}
                alt="Disease scan preview"
                className="img-fluid rounded shadow-lg"
                style={{ maxHeight: '80vh', objectFit: 'contain', margin: '0 auto' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
