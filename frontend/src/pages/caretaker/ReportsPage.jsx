import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FaCamera,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFileAlt,
  FaHistory,
  FaPaperPlane,
  FaSpinner,
  FaTag,
  FaTools,
  FaTrash,
  FaVideo,
  FaWater,
  FaSearch,
  FaSync,
  FaFilter,
  FaUndo,
  FaUserCheck,
  FaTimes,
  FaEye,
  FaCheck,
  FaChevronDown,
  FaExclamationCircle,
  FaCommentDots,
  FaShieldAlt,
  FaLayerGroup
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) return `http://localhost${cleanPath}`;
  if (cleanPath.startsWith('/backend')) return `http://localhost/shrim_predict_api${cleanPath}`;
  return `http://localhost/shrim_predict_api/${cleanPath.replace(/^\/+/, '')}`;
};

const quickSuggestionsByProblemType = {
  'Equipment': [
    'Aerator Motor Failure',
    'Submersible Pump Not Working',
    'Automatic Feeder Jammed',
    'DO Sensor Reading Offline',
    'Power Backup / Generator Trip',
    'Aerator Belt Snapped',
  ],
  'Water Quality': [
    'Low Dissolved Oxygen (< 3.5 mg/L)',
    'High Ammonia Level Detected',
    'Turbid / Brown Murky Water',
    'Unstable pH Fluctuations',
    'Excessive Blue-Green Algae Bloom',
    'Water Salinity Abrupt Drop',
  ],
  'Disease / Sick Shrimp': [
    'Shrimp Mortalities Along Dike Edge',
    'White Spot Signs on Carapace',
    'Lethargic / Slow Surface Swimming',
    'Reddish Body Discoloration',
    'Empty Gut / Feed Rejection',
    'Soft Shell / Incomplete Molt',
  ],
  'Structural': [
    'Leaking Drainage Gate Valve',
    'Pond HDPE Liner Tear',
    'Dike Soil Erosion / Slumping',
    'Broken Predator Bird Netting',
    'Inlet Water Supply Pipe Crack',
  ],
  'Feed Issue': [
    'Feed Pellets Moist / Moldy',
    'Feed Storage Inventory Depleted',
    'Uneaten Feed Accumulation in Tray',
    'Wrong Formulation Pellets Delivered',
  ],
  'Maintenance': [
    'Inlet Filter Screen Clogged',
    'Pond Bottom Sludge Buildup',
    'Boundary Weed Clearing Needed',
    'Electrical Box Sealing Repair',
  ],
  'Others': [
    'Foul Odor Emanating from Basin',
    'Predator Birds Hovering Around Dike',
    'Routine Security & Basin Inspection',
  ],
};

const PROBLEM_TYPES = [
  { value: 'Equipment', label: 'Equipment & Machinery' },
  { value: 'Water Quality', label: 'Water Quality & Chemistry' },
  { value: 'Disease / Sick Shrimp', label: 'Shrimp Health & Disease' },
  { value: 'Structural', label: 'Structural & Pond Basin' },
  { value: 'Feed Issue', label: 'Feed & Nutrition Supply' },
  { value: 'Maintenance', label: 'General Maintenance' },
  { value: 'Others', label: 'Others / Unclassified' },
];

const SEVERITY_LEVELS = [
  { value: 'Low', label: 'Low', desc: 'Routine observation', colorClass: 'low' },
  { value: 'Medium', label: 'Medium', desc: 'Attention in 24h', colorClass: 'medium' },
  { value: 'High', label: 'High', desc: 'Urgent risk', colorClass: 'high' },
  { value: 'Critical', label: 'Critical', desc: 'Immediate threat', colorClass: 'critical' },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('report_id');

  const [activeTab, setActiveTab] = useState(targetId ? 'history' : 'submit');
  const [ponds, setPonds] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [loadingPonds, setLoadingPonds] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // History Tab Filter States
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all' | 'Pending' | 'In Progress' | 'Done'
  const [historySeverityFilter, setHistorySeverityFilter] = useState('all'); // 'all' | 'Low' | 'Medium' | 'High' | 'Critical'
  const [historyPondFilter, setHistoryPondFilter] = useState('all');

  // Media Upload States
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Lightbox Media Preview Modal
  const [previewMediaUrl, setPreviewMediaUrl] = useState(null);

  const [form, setForm] = useState({
    pondId: '',
    problemType: 'Equipment',
    specificIssue: '',
    severityLevel: 'Medium',
    description: '',
    suggestedAction: '',
    photoUrl: '',
    videoUrl: '',
  });

  useEffect(() => {
    const loadPonds = async () => {
      if (!user?.id) {
        const assigned = Array.isArray(user?.assigned_ponds) ? user.assigned_ponds : [];
        setPonds(assigned);
        setForm((prev) => ({ ...prev, pondId: assigned.length > 0 ? String(assigned[0].id) : '' }));
        setLoadingPonds(false);
        return;
      }

      try {
        const res = await api.get('/caretaker_ponds.php', { params: { user_id: user.id } });
        const apiAssignedPonds = res.data?.success && Array.isArray(res.data.ponds) ? res.data.ponds : [];
        const loginAssignedPonds = Array.isArray(user?.assigned_ponds) ? user.assigned_ponds : [];
        const list = apiAssignedPonds.length > 0 ? apiAssignedPonds : loginAssignedPonds;
        setPonds(list);
        setForm((prev) => ({ ...prev, pondId: list.length > 0 ? String(list[0].id) : '' }));
      } catch (e) {
        console.error('Error loading ponds:', e);
        const assigned = Array.isArray(user?.assigned_ponds) ? user.assigned_ponds : [];
        setPonds(assigned);
        setForm((prev) => ({ ...prev, pondId: assigned.length > 0 ? String(assigned[0].id) : '' }));
      } finally {
        setLoadingPonds(false);
      }
    };
    loadPonds();
  }, [user]);

  const loadMyReports = useCallback(async (isManual = false) => {
    if (!user?.id) return;
    setLoadingReports(true);
    try {
      const res = await api.get(`/maintenance_reports.php?user_id=${user.id}`);
      if (res.data?.success) {
        setMyReports(Array.isArray(res.data.reports) ? res.data.reports : []);
        if (isManual) {
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1800,
            timerProgressBar: true,
          });
          Toast.fire({ icon: 'success', title: 'Incident reports synced' });
        }
      }
    } catch (e) {
      console.error('Error loading reports:', e);
    } finally {
      setLoadingReports(false);
    }
  }, [user]);

  useEffect(() => {
    loadMyReports();
    const handleUpdate = () => loadMyReports();
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('shrim-report-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('shrim-report-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadMyReports]);

  useEffect(() => {
    if (targetId && myReports.length > 0) {
      setActiveTab('history');
      setTimeout(() => {
        const el = document.getElementById(`caretaker-report-${targetId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [targetId, myReports]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);
    setUploadingImage(true);

    try {
      const res = await api.post('/upload_report_media.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.success) setForm((prev) => ({ ...prev, photoUrl: res.data.file_url }));
    } catch (err) {
      console.error('Image upload failed:', err);
      Swal.fire({ icon: 'error', title: 'Image Upload Error', text: 'Failed to upload photo.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);
    setUploadingVideo(true);

    try {
      const res = await api.post('/upload_report_media.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.success) setForm((prev) => ({ ...prev, videoUrl: res.data.file_url }));
    } catch (err) {
      console.error('Video upload failed:', err);
      Swal.fire({ icon: 'error', title: 'Video Upload Error', text: 'Failed to upload video.' });
    } finally {
      setUploadingVideo(false);
    }
  };

  const applyQuickSuggestion = (issue) => {
    setForm((prev) => ({
      ...prev,
      specificIssue: issue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pondId) {
      Swal.fire({ icon: 'warning', title: 'Select Basin', text: 'Please select an assigned shrimp pond.' });
      return;
    }
    if (!form.description.trim()) {
      Swal.fire({ icon: 'warning', title: 'Description Required', text: 'Please enter detailed observations of the incident.' });
      return;
    }

    const selectedPondObj = ponds.find((p) => String(p.id) === String(form.pondId));
    const pondName = selectedPondObj ? (selectedPondObj.pond_name || `Pond #${selectedPondObj.id}`) : `Pond #${form.pondId}`;

    setSubmitting(true);
    try {
      const response = await api.post('/maintenance_reports.php', {
        action: 'create',
        user_id: user?.id || null,
        caretaker_name: user?.full_name || 'Caretaker',
        pond_id: parseInt(form.pondId, 10),
        pond_name: pondName,
        problem_type: form.problemType,
        specific_issue: form.specificIssue || form.problemType,
        severity_level: form.severityLevel,
        description: form.description,
        suggested_action: form.suggestedAction,
        photo_url: form.photoUrl,
        video_url: form.videoUrl,
      });

      if (response.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Incident Report Logged!',
          text: `Report #${response.data?.report_id || ''} for ${pondName} has been transmitted to Administration.`,
          timer: 2200,
          showConfirmButton: false,
        });

        setForm((prev) => ({
          ...prev,
          specificIssue: '',
          description: '',
          suggestedAction: '',
          photoUrl: '',
          videoUrl: '',
          severityLevel: 'Medium',
        }));
        setImageFile(null);
        setImagePreview('');
        setVideoFile(null);
        setVideoPreview('');

        if (typeof window !== 'undefined') {
          localStorage.setItem('shrim-notification-updated', String(Date.now()));
          window.dispatchEvent(new Event('shrim-notification-updated'));
          window.dispatchEvent(new Event('shrim-report-updated'));
        }
        loadMyReports();
        setActiveTab('history');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.response?.data?.message || 'Unable to submit incident report. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Telemetry Metrics
  const pendingReports = myReports.filter((report) => report.status === 'Pending').length;
  const inProgressReports = myReports.filter((report) => report.status === 'In Progress').length;
  const doneReports = myReports.filter((report) => report.status === 'Done' || report.status === 'Resolved').length;

  // Filtered History Reports
  const filteredReports = useMemo(() => {
    return myReports.filter((report) => {
      // 1. Status Filter
      if (historyStatusFilter !== 'all') {
        if (historyStatusFilter === 'Done') {
          if (report.status !== 'Done' && report.status !== 'Resolved') return false;
        } else if (report.status !== historyStatusFilter) {
          return false;
        }
      }

      // 2. Severity Filter
      if (historySeverityFilter !== 'all' && report.severity_level !== historySeverityFilter) {
        return false;
      }

      // 3. Pond Filter
      if (historyPondFilter !== 'all' && String(report.pond_id) !== String(historyPondFilter)) {
        return false;
      }

      // 4. Search Filter
      if (historySearch) {
        const query = historySearch.toLowerCase();
        const matchTitle = String(report.specific_issue || '').toLowerCase().includes(query);
        const matchDesc = String(report.description || '').toLowerCase().includes(query);
        const matchPond = String(report.pond_name || '').toLowerCase().includes(query);
        const matchType = String(report.problem_type || '').toLowerCase().includes(query);
        const matchId = String(report.id || '').includes(query);
        if (!matchTitle && !matchDesc && !matchPond && !matchType && !matchId) return false;
      }

      return true;
    });
  }, [myReports, historyStatusFilter, historySeverityFilter, historyPondFilter, historySearch]);

  const isHistoryFiltered = historyStatusFilter !== 'all' || historySeverityFilter !== 'all' || historyPondFilter !== 'all' || Boolean(historySearch);

  const resetHistoryFilters = () => {
    setHistoryStatusFilter('all');
    setHistorySeverityFilter('all');
    setHistoryPondFilter('all');
    setHistorySearch('');
  };

  return (
    <div className="caretaker-reports-hub">
      {/* 🌟 HERO CONTROL STRIP (TRI-COLOR NAVY & SHRIMPY ORANGE) */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge badge-tri-navy rounded-pill px-2.5 py-0.5 extra-small">
              Caretaker Operations
            </span>
            <span className="badge badge-tri-orange rounded-pill px-2.5 py-0.5 extra-small">
              Incident &amp; Maintenance Dispatch
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Pond Issue &amp; Incident Reports
          </h2>
          <p className="text-muted extra-small mb-0 mt-0.5">
            Log field abnormalities, machinery downtime, and biological anomalies with photo/video evidence for rapid admin dispatch.
          </p>
        </div>

        {/* Action Controls Cluster & View Toggle Switch */}
        <div className="d-flex align-items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs hover-lift"
            onClick={() => loadMyReports(true)}
            disabled={loadingReports}
            title="Sync Incident Reports"
          >
            <FaSync size={11} className={loadingReports ? 'fa-spin' : ''} style={{ color: '#0B2C5F' }} />
            <span>Sync</span>
          </button>

          {/* Segmented Mode Switcher */}
          <div className="tri-segmented-switch">
            <button
              type="button"
              className={`tri-segmented-item ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit')}
            >
              <FaPaperPlane size={11} />
              <span>File Report</span>
            </button>
            <button
              type="button"
              className={`tri-segmented-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <FaHistory size={11} />
              <span>History</span>
              {myReports.length > 0 && (
                <span
                  className="badge rounded-pill extra-small px-1.5 py-0.5 ms-1"
                  style={{
                    backgroundColor: activeTab === 'history' ? '#FFFFFF' : '#E2E8F0',
                    color: activeTab === 'history' ? '#0B2C5F' : '#475569',
                    fontSize: '0.67rem',
                  }}
                >
                  {myReports.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🌟 4 TRI-COLOR TELEMETRY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Assigned Basins */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Basins</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaWater size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {ponds.length} <small className="fs-6 text-muted fw-normal">ponds</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Available for dispatch
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div className="tri-progress-bar" style={{ width: '100%', background: '#0B2C5F' }} />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Operational coverage</span>
                <span className="badge badge-tri-navy rounded-pill extra-small px-2 py-0.5">Monitored</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Review */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(234, 88, 12, 0.16)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Pending Action</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaClock size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {pendingReports} <small className="fs-6 text-muted fw-normal">open</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Awaiting admin review
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (pendingReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Awaiting triage</span>
                <span className="badge badge-tri-orange rounded-pill extra-small px-2 py-0.5">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: In Progress (Handling) */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">In Progress</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaTools size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {inProgressReports} <small className="fs-6 text-muted fw-normal">active</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Under active repair
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (inProgressReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #0B2C5F 0%, #38BDF8 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Technician assigned</span>
                <span className="badge badge-tri-navy rounded-pill extra-small px-2 py-0.5">Handling</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Resolved Incidents */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(234, 88, 12, 0.16)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Resolved</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaCheckCircle size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {doneReports} <small className="fs-6 text-muted fw-normal">resolved</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Completed corrective actions
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (doneReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #EA580C 0%, #10B981 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Archived solutions</span>
                <span className="badge badge-tri-orange rounded-pill extra-small px-2 py-0.5">Done</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 TAB 1: SUBMIT NEW INCIDENT REPORT */}
      {activeTab === 'submit' && (
        <div className="tri-card p-3.5 p-md-4 mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
            <div>
              <h5 className="fw-extrabold mb-0" style={{ color: '#0B2C5F', letterSpacing: '-0.02em' }}>
                Submit Field Incident &amp; Abnormality Report
              </h5>
              <small className="text-muted">
                Document basin anomalies, machine faults, or shrimp issues with visual evidence for farm management.
              </small>
            </div>
            <div className="badge badge-tri-navy px-3 py-1.5 rounded-pill extra-small fw-bold d-flex align-items-center gap-1.5">
              <FaShieldAlt /> <span>Direct Admin Notification</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* ROW 1: POND BASIN & TIMESTAMP */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label extra-small fw-bold text-dark mb-1">
                  Affected Pond Basin <span className="text-danger">*</span>
                </label>
                {loadingPonds ? (
                  <div className="p-2 rounded-3 bg-light text-muted small">Loading ponds...</div>
                ) : ponds.length === 0 ? (
                  <div className="alert alert-warning py-2 mb-0 extra-small">No assigned ponds found for your caretaker account.</div>
                ) : (
                  <div className="input-group">
                    <span className="input-group-text bg-white" style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}>
                      <FaWater size={13} style={{ color: '#0B2C5F' }} />
                    </span>
                    <select
                      className="form-select form-select-sm fw-bold"
                      value={form.pondId}
                      onChange={(e) => setForm({ ...form, pondId: e.target.value })}
                      required
                      style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}
                    >
                      {ponds.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.pond_name || `Pond #${p.id}`}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label extra-small fw-bold text-dark mb-1">
                  Incident Log Timestamp
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-white" style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}>
                    <FaClock size={13} style={{ color: '#EA580C' }} />
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-light fw-semibold text-muted font-mono"
                    value={new Date().toLocaleString()}
                    disabled
                    style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}
                  />
                </div>
              </div>
            </div>

            {/* ROW 2: PROBLEM CATEGORY & SEVERITY LEVEL */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label extra-small fw-bold text-dark mb-1">
                  Problem Classification <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm fw-bold"
                  value={form.problemType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setForm({ ...form, problemType: newType, specificIssue: '' });
                  }}
                  style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}
                >
                  {PROBLEM_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>

              {/* SEVERITY LEVEL SELECTOR */}
              <div className="col-md-6">
                <label className="form-label extra-small fw-bold text-dark mb-1">
                  Severity Level <span className="text-danger">*</span>
                </label>
                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                  {SEVERITY_LEVELS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`tri-severity-pill ${s.colorClass} ${form.severityLevel === s.value ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, severityLevel: s.value })}
                      title={s.desc}
                    >
                      <span className="rounded-circle" style={{ width: 6, height: 6, background: form.severityLevel === s.value ? '#FFFFFF' : 'currentColor' }} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 3: SPECIFIC ISSUE TITLE & DYNAMIC QUICK SUGGESTIONS */}
            <div className="mb-3">
              <label className="form-label extra-small fw-bold text-dark mb-1">
                Specific Issue Title <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control form-control-sm fw-semibold"
                placeholder="e.g. Aerator motor failure or select from quick suggestions below"
                value={form.specificIssue}
                onChange={(e) => setForm({ ...form, specificIssue: e.target.value })}
                required
                style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}
              />

              {/* Dynamic Quick Suggestions */}
              <div className="mt-2 d-flex align-items-center flex-wrap gap-1.5">
                <span className="extra-small fw-bold text-uppercase tracking-wider me-1 text-muted" style={{ fontSize: '0.69rem' }}>
                  <FaTag size={10} className="me-1 text-primary" /> Suggestions:
                </span>
                {(quickSuggestionsByProblemType[form.problemType] || quickSuggestionsByProblemType['Equipment']).map((suggestion) => {
                  const isSelected = form.specificIssue === suggestion;
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      className={`tri-suggestion-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => applyQuickSuggestion(suggestion)}
                    >
                      {isSelected && <FaCheck size={9} className="me-1 text-white" />}
                      <span>{suggestion}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 4: DETAILED DESCRIPTION */}
            <div className="mb-3">
              <label className="form-label extra-small fw-bold text-dark mb-1">
                Detailed Field Observations <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Describe exactly what happened: exact location in the basin, sounds, smell, color change, time of observation, and immediate actions taken."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                style={{ borderColor: 'rgba(11, 44, 95, 0.18)', fontSize: '0.86rem' }}
              />
            </div>

            {/* ROW 5: SUGGESTED ACTION (OPTIONAL) */}
            <div className="mb-3">
              <label className="form-label extra-small fw-bold text-dark mb-1 d-flex align-items-center gap-1.5">
                Suggested Caretaker Action <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small fw-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Needs immediate pump impeller replacement or water exchange"
                value={form.suggestedAction}
                onChange={(e) => setForm({ ...form, suggestedAction: e.target.value })}
                style={{ borderColor: 'rgba(11, 44, 95, 0.18)' }}
              />
            </div>

            {/* ROW 6: MEDIA ATTACHMENTS (PHOTO & VIDEO DROPZONES) */}
            <div className="row g-3 mt-1 mb-4">
              {/* Photo Evidence Box */}
              <div className="col-12 col-md-6">
                <div className="tri-media-uploadzone h-100 d-flex flex-column justify-content-between">
                  <div>
                    <label className="extra-small fw-bold text-dark mb-1.5 d-flex align-items-center gap-1.5">
                      <FaCamera style={{ color: '#0B2C5F' }} /> Attach Photo Evidence <span className="badge badge-tri-navy rounded-pill extra-small">JPEG / PNG</span>
                    </label>
                    <input
                      type="file"
                      className="form-control form-control-sm"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ fontSize: '0.78rem' }}
                    />
                    {uploadingImage && (
                      <div className="extra-small text-primary mt-2 d-flex align-items-center gap-1.5 fw-bold">
                        <FaSpinner className="fa-spin" /> Uploading image to farm server...
                      </div>
                    )}
                  </div>

                  {imagePreview && (
                    <div className="mt-2.5 position-relative d-inline-block rounded-3 overflow-hidden border shadow-xs" style={{ maxWidth: 200 }}>
                      <img src={imagePreview} alt="Evidence preview" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1 d-flex align-items-center justify-content-center shadow-xs"
                        style={{ width: 24, height: 24 }}
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview('');
                          setForm((prev) => ({ ...prev, photoUrl: '' }));
                        }}
                        title="Remove photo"
                      >
                        <FaTimes size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Evidence Box */}
              <div className="col-12 col-md-6">
                <div className="tri-media-uploadzone h-100 d-flex flex-column justify-content-between">
                  <div>
                    <label className="extra-small fw-bold text-dark mb-1.5 d-flex align-items-center justify-content-between">
                      <span className="d-flex align-items-center gap-1.5">
                        <FaVideo style={{ color: '#EA580C' }} /> Attach Video Evidence <span className="badge badge-tri-orange rounded-pill extra-small">MP4 / MOV</span>
                      </span>
                      <span className="text-muted extra-small">(optional)</span>
                    </label>
                    <input
                      type="file"
                      className="form-control form-control-sm"
                      accept="video/*"
                      onChange={handleVideoChange}
                      style={{ fontSize: '0.78rem' }}
                    />
                    {uploadingVideo && (
                      <div className="extra-small text-danger mt-2 d-flex align-items-center gap-1.5 fw-bold">
                        <FaSpinner className="fa-spin" /> Uploading video file...
                      </div>
                    )}
                  </div>

                  {videoPreview && (
                    <div className="mt-2.5 position-relative d-inline-block rounded-3 overflow-hidden border shadow-xs" style={{ maxWidth: 220 }}>
                      <video src={videoPreview} controls style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1 d-flex align-items-center justify-content-center shadow-xs"
                        style={{ width: 24, height: 24 }}
                        onClick={() => {
                          setVideoFile(null);
                          setVideoPreview('');
                          setForm((prev) => ({ ...prev, videoUrl: '' }));
                        }}
                        title="Remove video"
                      >
                        <FaTimes size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SUBMIT ACTION STRIP */}
            <div
              className="d-flex align-items-center justify-content-between p-3 rounded-4 flex-wrap gap-2 caretaker-submit-strip"
              style={{ background: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.08)' }}
            >
              <div className="d-flex align-items-center gap-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32, background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}
                >
                  <FaUserCheck size={14} />
                </div>
                <div>
                  <span className="extra-small text-muted d-block">Report Originator:</span>
                  <strong className="text-dark small">{user?.full_name || 'Caretaker'} (Verified)</strong>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-3.5 py-2 extra-small fw-bold"
                  onClick={() => {
                    setForm({
                      pondId: ponds[0]?.id ? String(ponds[0].id) : '',
                      problemType: 'Equipment',
                      specificIssue: '',
                      severityLevel: 'Medium',
                      description: '',
                      suggestedAction: '',
                      photoUrl: '',
                      videoUrl: '',
                    });
                    setImagePreview('');
                    setVideoPreview('');
                  }}
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  className="btn btn-tri-orange px-4 py-2 fw-bold shadow-sm hover-lift d-inline-flex align-items-center gap-2"
                  disabled={submitting || uploadingImage || uploadingVideo}
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="fa-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane size={12} /> Submit Incident Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 TAB 2: INCIDENT HISTORY & RESOLUTION TRACKING */}
      {activeTab === 'history' && (
        <div className="tri-card p-3.5 p-md-4 mb-4">
          {/* TOOLBAR CONTROLS */}
          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2.5" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
            <div>
              <h5 className="fw-extrabold mb-0" style={{ color: '#0B2C5F', letterSpacing: '-0.02em' }}>
                Incident Logs &amp; Corrective Resolution History
              </h5>
              <small className="text-muted">
                Showing {filteredReports.length} of {myReports.length} incident reports filed for your assigned ponds.
              </small>
            </div>

            {/* Search Input */}
            <div
              className="d-flex align-items-center bg-white rounded-pill px-3 shadow-xs"
              style={{ width: '100%', maxWidth: 280, minWidth: 170, height: 38, border: '1px solid rgba(11, 44, 95, 0.15)' }}
            >
              <FaSearch className="text-muted extra-small me-2" />
              <input
                type="text"
                className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-semibold text-dark"
                placeholder="Search issues, pond, notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ outline: 'none' }}
              />
              {historySearch && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-muted extra-small ms-1"
                  onClick={() => setHistorySearch('')}
                >
                  <FaTimes size={11} />
                </button>
              )}
            </div>
          </div>

          {/* FILTER PILLS STRIP */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            {/* Status Filter Pills */}
            <div className="d-flex align-items-center gap-1.5 flex-wrap">
              <span className="extra-small fw-bold text-uppercase tracking-wider text-muted me-1" style={{ fontSize: '0.7rem' }}>
                Status:
              </span>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                  historyStatusFilter === 'all' ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
                }`}
                onClick={() => setHistoryStatusFilter('all')}
              >
                All ({myReports.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                  historyStatusFilter === 'Pending' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline-orange'
                }`}
                onClick={() => setHistoryStatusFilter('Pending')}
              >
                ⏳ Pending ({pendingReports})
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                  historyStatusFilter === 'In Progress' ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
                }`}
                onClick={() => setHistoryStatusFilter('In Progress')}
              >
                🛠 In Progress ({inProgressReports})
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                  historyStatusFilter === 'Done' ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
                }`}
                onClick={() => setHistoryStatusFilter('Done')}
              >
                ✓ Resolved ({doneReports})
              </button>
            </div>

            {/* Basin & Severity Dropdowns */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Basin Filter */}
              <div
                className="d-flex align-items-center gap-1.5 px-3 py-1 rounded-pill bg-white shadow-xs"
                style={{ border: '1px solid rgba(11, 44, 95, 0.14)', height: 34 }}
              >
                <FaWater size={11} style={{ color: '#0B2C5F' }} />
                <select
                  className="form-select form-select-sm border-0 bg-transparent fw-bold p-0 extra-small shadow-none cursor-pointer"
                  style={{ width: 110, outline: 'none', color: '#0B2C5F' }}
                  value={historyPondFilter}
                  onChange={(e) => setHistoryPondFilter(e.target.value)}
                >
                  <option value="all">All Basins</option>
                  {ponds.map((p) => (
                    <option key={p.id} value={p.id}>{p.pond_name}</option>
                  ))}
                </select>
              </div>

              {/* Severity Filter */}
              <div
                className="d-flex align-items-center gap-1.5 px-3 py-1 rounded-pill bg-white shadow-xs"
                style={{ border: '1px solid rgba(11, 44, 95, 0.14)', height: 34 }}
              >
                <FaExclamationTriangle size={11} style={{ color: '#EA580C' }} />
                <select
                  className="form-select form-select-sm border-0 bg-transparent fw-bold p-0 extra-small shadow-none cursor-pointer"
                  style={{ width: 105, outline: 'none', color: '#0B2C5F' }}
                  value={historySeverityFilter}
                  onChange={(e) => setHistorySeverityFilter(e.target.value)}
                >
                  <option value="all">All Severity</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {isHistoryFiltered && (
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-2.5 py-1 extra-small shadow-xs hover-lift"
                  style={{ height: 34 }}
                  onClick={resetHistoryFilters}
                  title="Reset filters"
                >
                  <FaUndo size={10} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* LIST OF INCIDENT CARDS */}
          {loadingReports ? (
            <div className="py-5 text-center text-muted">
              <div className="spinner-border text-primary spinner-border-sm me-2" role="status" />
              <span className="fw-semibold small">Loading incident records from farm database...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-5 text-center text-muted">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                style={{ width: 56, height: 56, backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}
              >
                <FaHistory size={24} />
              </div>
              <h6 className="fw-bold text-dark mb-1">No incident reports found</h6>
              <p className="extra-small text-muted mb-3" style={{ maxWidth: 360, margin: '0 auto' }}>
                {isHistoryFiltered ? 'Try clearing your active filters to view all historical reports.' : 'You have not submitted any incident reports yet.'}
              </p>
              <div className="d-flex align-items-center justify-content-center gap-2">
                {isHistoryFiltered ? (
                  <button type="button" className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small" onClick={resetHistoryFilters}>
                    <FaUndo size={11} /> Clear Filters
                  </button>
                ) : (
                  <button type="button" className="btn btn-sm btn-tri-orange px-4 py-1.5 extra-small" onClick={() => setActiveTab('submit')}>
                    <FaPaperPlane size={11} /> File First Incident Report
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {filteredReports.map((report) => {
                const resPhoto = resolveMediaUrl(report.photo_url);
                const resVideo = resolveMediaUrl(report.video_url);
                const isTargetHighlighted = String(report.id) === String(targetId);
                const isDone = report.status === 'Done' || report.status === 'Resolved';
                const isInProgress = report.status === 'In Progress';
                const isPending = report.status === 'Pending';

                const sev = report.severity_level || 'Medium';

                return (
                  <article
                    key={report.id}
                    id={`caretaker-report-${report.id}`}
                    className={`tri-incident-card ${isTargetHighlighted ? 'highlighted' : ''}`}
                  >
                    {/* CARD HEADER */}
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
                      <div>
                        {/* BADGES ROW */}
                        <div className="d-flex align-items-center gap-1.5 flex-wrap mb-1.5">
                          {/* Severity Badge */}
                          <span
                            className="badge rounded-pill fw-bold extra-small px-2.5 py-1"
                            style={{
                              backgroundColor:
                                sev === 'Critical'
                                  ? 'rgba(185, 28, 28, 0.12)'
                                  : sev === 'High'
                                  ? 'rgba(225, 29, 72, 0.12)'
                                  : sev === 'Medium'
                                  ? '#FFF7ED'
                                  : 'rgba(16, 185, 129, 0.12)',
                              color:
                                sev === 'Critical'
                                  ? '#B91C1C'
                                  : sev === 'High'
                                  ? '#E11D48'
                                  : sev === 'Medium'
                                  ? '#EA580C'
                                  : '#059669',
                              border: `1px solid ${
                                sev === 'Critical'
                                  ? 'rgba(185, 28, 28, 0.3)'
                                  : sev === 'High'
                                  ? 'rgba(225, 29, 72, 0.3)'
                                  : sev === 'Medium'
                                  ? 'rgba(234, 88, 12, 0.28)'
                                  : 'rgba(16, 185, 129, 0.3)'
                              }`,
                            }}
                          >
                            ● {sev} Severity
                          </span>

                          {/* Problem Type Badge */}
                          <span className="badge badge-tri-navy rounded-pill px-2.5 py-1 extra-small">
                            {report.problem_type}
                          </span>

                          {/* Pond Basin Badge */}
                          <span
                            className="badge bg-white rounded-pill px-2.5 py-1 extra-small fw-bold"
                            style={{ border: '1px solid rgba(11, 44, 95, 0.15)', color: '#0B2C5F' }}
                          >
                            <FaWater size={10} className="me-1 text-primary" />
                            {report.pond_name || `Pond #${report.pond_id}`}
                          </span>

                          <span className="text-muted extra-small font-mono fw-semibold">
                            Report #{report.id}
                          </span>
                        </div>

                        {/* Specific Issue Title */}
                        <h6 className="fw-extrabold mb-0 text-dark" style={{ fontSize: '1.05rem', color: '#0B2C5F' }}>
                          {report.specific_issue}
                        </h6>
                      </div>

                      {/* Status Badge */}
                      <span
                        className="badge rounded-pill fw-bold px-3 py-1.5 extra-small d-inline-flex align-items-center gap-1.5"
                        style={{
                          backgroundColor: isDone
                            ? '#ECFDF5'
                            : isInProgress
                            ? 'rgba(11, 44, 95, 0.08)'
                            : '#FFF7ED',
                          color: isDone ? '#047857' : isInProgress ? '#0B2C5F' : '#EA580C',
                          border: `1px solid ${
                            isDone ? '#A7F3D0' : isInProgress ? 'rgba(11, 44, 95, 0.2)' : 'rgba(234, 88, 12, 0.28)'
                          }`,
                        }}
                      >
                        {isDone ? (
                          <>
                            <FaCheckCircle size={11} /> Resolved / Done
                          </>
                        ) : isInProgress ? (
                          <>
                            <FaTools size={11} /> In Progress
                          </>
                        ) : (
                          <>
                            <FaClock size={11} /> Awaiting Review
                          </>
                        )}
                      </span>
                    </div>

                    {/* Description Text */}
                    <p className="text-secondary small mb-2.5 fw-medium" style={{ lineHeight: 1.5, fontSize: '0.86rem' }}>
                      {report.description}
                    </p>

                    {/* Media Attachments Gallery */}
                    {(resPhoto || resVideo) && (
                      <div className="d-flex align-items-center gap-2 mb-2.5 flex-wrap">
                        {resPhoto && (
                          <div
                            className="position-relative rounded-3 overflow-hidden border shadow-xs cursor-pointer hover-lift"
                            style={{ width: 140, height: 95 }}
                            onClick={() => setPreviewMediaUrl(resPhoto)}
                            title="Click to zoom photo"
                          >
                            <img src={resPhoto} alt="Attached incident evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div
                              className="position-absolute bottom-0 start-0 w-100 p-1 text-center extra-small text-white fw-bold d-flex align-items-center justify-content-center gap-1"
                              style={{ background: 'rgba(11, 44, 95, 0.72)', fontSize: '0.68rem' }}
                            >
                              <FaEye size={10} /> Zoom Photo
                            </div>
                          </div>
                        )}

                        {resVideo && (
                          <div className="rounded-3 overflow-hidden border shadow-xs" style={{ width: 200, height: 110 }}>
                            <video src={resVideo} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Suggested Action Note */}
                    {report.suggested_action && (
                      <div
                        className="rounded-3 p-2.5 mb-2.5 extra-small"
                        style={{
                          background: '#F8FAFD',
                          borderLeft: '3px solid #EA580C',
                          color: '#1E293B',
                        }}
                      >
                        <strong style={{ color: '#EA580C' }}>Caretaker Suggested Action:</strong> {report.suggested_action}
                      </div>
                    )}

                    {/* Admin Resolution Callout Strip */}
                    {report.admin_notes && (
                      <div
                        className="rounded-3 p-2.5 mb-2.5 extra-small"
                        style={{
                          background: isDone ? '#ECFDF5' : '#F1F5F9',
                          border: `1px solid ${isDone ? '#A7F3D0' : '#CBD5E1'}`,
                          borderLeft: `4px solid ${isDone ? '#10B981' : '#0B2C5F'}`,
                        }}
                      >
                        <div className="d-flex align-items-center gap-1.5 mb-1 fw-bold" style={{ color: isDone ? '#047857' : '#0B2C5F' }}>
                          <FaCheckCircle /> <span>Management Resolution Note:</span>
                        </div>
                        <p className="mb-0 text-dark fw-medium" style={{ fontSize: '0.82rem' }}>
                          {report.admin_notes}
                        </p>
                        {report.resolved_by && (
                          <span className="text-muted extra-small d-block mt-1">
                            Actioned by: <strong>{report.resolved_by}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Timestamp & Caretaker */}
                    <div className="d-flex align-items-center justify-content-between pt-2 border-top extra-small text-muted" style={{ borderColor: 'rgba(11, 44, 95, 0.06)' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span>Pond: <strong className="text-dark">{report.pond_name || `Pond #${report.pond_id}`}</strong></span>
                        <span>•</span>
                        <span>Submitted by: <strong className="text-dark">{report.caretaker_name || user?.full_name || 'Caretaker'}</strong></span>
                      </div>
                      <div className="font-mono text-secondary">
                        {new Date(report.created_at || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 🌟 FULLSCREEN IMAGE PREVIEW LIGHTBOX MODAL */}
      {previewMediaUrl && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.88)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
          onClick={() => setPreviewMediaUrl(null)}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-transparent border-0 position-relative p-2 text-center">
              <button
                type="button"
                className="btn btn-sm btn-light rounded-circle position-absolute top-0 end-0 m-3 shadow-lg"
                style={{ width: 36, height: 36, zIndex: 10 }}
                onClick={() => setPreviewMediaUrl(null)}
              >
                <FaTimes size={14} />
              </button>
              <img
                src={previewMediaUrl}
                alt="Fullscreen incident evidence"
                className="img-fluid rounded-4 shadow-2xl border"
                style={{ maxHeight: '85vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
