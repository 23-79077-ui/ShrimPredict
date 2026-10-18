import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
import { useLanguage } from '../../context/LanguageContext';
import { getEffectiveTheme } from '../../utils/theme';

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (cleanPath.startsWith('/shrim_predict_api')) return cleanPath.replace(/^\/shrim_predict_api/, '');
  return cleanPath;
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
    'Bad Smell Coming from Pond',
    'Predator Birds Hovering Around Dike',
    'Routine Pond & Dike Inspection',
  ],
};

const PROBLEM_TYPES = [
  { value: 'Equipment', label: 'Equipment & Machinery' },
  { value: 'Water Quality', label: 'Water Quality & Chemistry' },
  { value: 'Disease / Sick Shrimp', label: 'Shrimp Health & Disease' },
  { value: 'Structural', label: 'Pond Dike & Structure' },
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
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const scanReport = location.state?.scanReport;
  const scanReportPrefillHandled = useRef(false);
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('report_id');

  const [currentTheme, setCurrentTheme] = useState(() => getEffectiveTheme());
  useEffect(() => {
    const handleThemeChange = (e) => {
      const t = e?.detail?.theme || document.documentElement.getAttribute('data-theme') || getEffectiveTheme();
      setCurrentTheme(t);
    };
    window.addEventListener('shrim-theme-changed', handleThemeChange);
    window.addEventListener('themeChanged', handleThemeChange);
    return () => {
      window.removeEventListener('shrim-theme-changed', handleThemeChange);
      window.removeEventListener('themeChanged', handleThemeChange);
    };
  }, []);
  const isDark = currentTheme === 'dark';

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
        let list = res.data?.success && Array.isArray(res.data.ponds) ? res.data.ponds : [];
        if (list.length === 0) {
          const allRes = await api.get('/ponds.php');
          if (allRes.data?.success && Array.isArray(allRes.data.ponds)) {
            list = allRes.data.ponds;
          }
        }
        const loginAssigned = Array.isArray(user?.assigned_ponds) ? user.assigned_ponds : [];
        const finalList = list.length > 0 ? list : loginAssigned;
        setPonds(finalList);
        setForm((prev) => ({ ...prev, pondId: finalList.length > 0 ? String(finalList[0].id) : '' }));
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

  useEffect(() => {
    if (!scanReport || loadingPonds || scanReportPrefillHandled.current) return;
    scanReportPrefillHandled.current = true;

    const matchedPond = ponds.find((pond) => (
      String(pond.pond_name || pond.name || '').toLowerCase()
      === String(scanReport.pondName || '').toLowerCase()
    )) || ponds[0];
    const diagnosis = String(scanReport.diseaseName || 'Shrimp health assessment');
    const diagnosisNotes = String(scanReport.description || '').trim();
    const recommendation = String(scanReport.recommendation || '').trim();

    setActiveTab('submit');
    setForm((prev) => ({
      ...prev,
      pondId: matchedPond?.id ? String(matchedPond.id) : prev.pondId,
      problemType: 'Disease / Sick Shrimp',
      specificIssue: `${diagnosis} detected`,
      severityLevel: scanReport.status === 'Diseased' ? 'High' : 'Medium',
      description: [
        `Disease scan result: ${diagnosis}.`,
        diagnosisNotes,
      ].filter(Boolean).join('\n\n'),
      suggestedAction: recommendation,
    }));

    if (scanReport.imageFile instanceof File) {
      setImageFile(scanReport.imageFile);
      setImagePreview(URL.createObjectURL(scanReport.imageFile));

      const formData = new FormData();
      formData.append('file', scanReport.imageFile);
      setUploadingImage(true);
      api.post('/upload_report_media.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((res) => {
          if (res.data?.success) {
            setForm((prev) => ({ ...prev, photoUrl: res.data.file_url }));
          } else {
            throw new Error(res.data?.message || 'The scan photo could not be uploaded.');
          }
        })
        .catch((error) => {
          console.error('Disease scan photo upload failed:', error);
          Swal.fire({
            icon: 'error',
            title: 'Photo Upload Error',
            text: error.response?.data?.message || error.message || 'Failed to attach the scan photo.',
          });
        })
        .finally(() => setUploadingImage(false));
    }
  }, [loadingPonds, ponds, scanReport]);

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
    if (e && e.preventDefault) e.preventDefault();
    if (!form.pondId) {
      Swal.fire({ icon: 'warning', title: 'Select Pond', text: 'Please select an affected shrimp pond.' });
      return;
    }
    if (!form.description || !form.description.trim()) {
      Swal.fire({ icon: 'warning', title: 'Observations Required', text: 'Please enter detailed field observations of the incident.' });
      return;
    }

    const selectedPondObj = ponds.find((p) => String(p.id) === String(form.pondId));
    const pondName = selectedPondObj ? (selectedPondObj.pond_name || `Pond #${selectedPondObj.id}`) : `Pond #${form.pondId}`;
    const finalSpecificIssue = (form.specificIssue && form.specificIssue.trim())
      ? form.specificIssue.trim()
      : (form.description.trim().length > 35 ? form.description.trim().substring(0, 35) + '...' : form.description.trim());

    setSubmitting(true);
    try {
      const response = await api.post('/maintenance_reports.php', {
        action: 'create',
        user_id: user?.id || null,
        caretaker_name: user?.full_name || 'Caretaker',
        pond_id: parseInt(form.pondId, 10),
        pond_name: pondName,
        problem_type: form.problemType,
        specific_issue: finalSpecificIssue,
        severity_level: form.severityLevel,
        description: form.description.trim(),
        suggested_action: form.suggestedAction,
        photo_url: form.photoUrl,
        video_url: form.videoUrl,
      });

      if (response.data?.success) {
        const reportId = response.data?.id || response.data?.report_id || '';
        await Swal.fire({
          icon: 'success',
          title: 'Incident Report Submitted Successfully!',
          html: `
            <div class="text-start mt-2 p-3 bg-light rounded-3 border">
              <div class="fw-bold text-dark mb-1">
                Report ${reportId ? `#${reportId}` : ''} for <span class="text-primary">${pondName}</span>
              </div>
              <div class="extra-small text-muted mb-2">
                • <strong>Problem:</strong> ${finalSpecificIssue} (${form.problemType})<br/>
                • <strong>Severity:</strong> <span class="badge ${form.severityLevel === 'High' || form.severityLevel === 'Critical' ? 'bg-danger' : 'bg-warning text-dark'}">${form.severityLevel}</span>
              </div>
              <div class="extra-small text-success fw-bold d-flex align-items-center gap-1">
                ✓ System notification sent to Farm Management &amp; Admin.
              </div>
            </div>
          `,
          confirmButtonText: 'OK',
          confirmButtonColor: '#FC563C',
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
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Submission Error',
          text: response.data?.message || 'Failed to submit incident report.',
        });
      }
    } catch (error) {
      console.error('Submit incident report error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.response?.data?.message || error?.message || 'Unable to submit incident report. Please try again.',
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
      {/* 1. TITLE HEADER */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <div>
          <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
            <h3 className="fw-extrabold text-dark mb-0 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {t('hero.caretakerReports', 'Pond Issue & Incident Reports')}
            </h3>
            <span
              className="badge rounded-pill extra-small px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid #E2E8F0',
                color: isDark ? '#E2E8F0' : '#475569',
                maxWidth: '100%',
                whiteSpace: 'normal',
                textAlign: 'left'
              }}
            >
              <span className="pulse-dot-green flex-shrink-0"></span>
              <span>{t('hero.caretakerReportsBadge', 'Incident & Maintenance Dispatch')}</span>
            </span>
          </div>
          <p className="text-muted mb-0 small mt-0.5" style={{ maxWidth: 700, lineHeight: 1.4 }}>
            {t('hero.caretakerReportsSub', 'Log field abnormalities, machinery downtime, and biological anomalies with photo/video evidence.')}
          </p>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-understated-view shadow-2xs"
            onClick={() => loadMyReports(true)}
            disabled={loadingReports}
            title="Sync Incident Reports"
          >
            <FaSync size={11} className={loadingReports ? 'fa-spin' : ''} />
            <span>{t('Sync')}</span>
          </button>

          <div className="chart-range-pill-container d-flex align-items-center gap-1 p-1 rounded-3 border">
            <button
              type="button"
              className={`btn btn-sm py-1 px-3 rounded-2 extra-small fw-bold transition-all d-flex align-items-center gap-1.5 ${activeTab === 'submit' ? 'btn-chart-range-active shadow-xs' : 'btn-chart-range-inactive'}`}
              onClick={() => setActiveTab('submit')}
            >
              <FaPaperPlane size={11} />
              <span>File Report</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm py-1 px-3 rounded-2 extra-small fw-bold transition-all d-flex align-items-center gap-1.5 ${activeTab === 'history' ? 'btn-chart-range-active shadow-xs' : 'btn-chart-range-inactive'}`}
              onClick={() => setActiveTab('history')}
            >
              <FaHistory size={11} />
              <span>History</span>
              {myReports.length > 0 && (
                <span className="badge rounded-pill ms-1" style={{ backgroundColor: activeTab === 'history' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)', color: activeTab === 'history' ? '#FFFFFF' : 'inherit' }}>
                  {myReports.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* TAB 1: SUBMIT NEW INCIDENT REPORT */}
      {activeTab === 'submit' && (
        <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
          <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
            <div>
              <h5 className="fw-extrabold text-dark mb-0 tracking-tight">
                Submit Field Incident &amp; Abnormality Report
              </h5>
              <small className="text-muted">
                Report pond issues, broken equipment, or shrimp health problems with photos to the farm manager.
              </small>
            </div>
            <div className="badge rounded-pill extra-small px-3 py-1.5 fw-bold bg-white border text-secondary d-flex align-items-center gap-1.5 shadow-2xs">
              <FaShieldAlt /> <span>Direct Admin Notification</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* ROW 1: POND BASIN & TIMESTAMP */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label extra-small fw-bold text-dark mb-1">
                  Affected Pond <span className="text-danger">*</span>
                </label>
                {loadingPonds ? (
                  <div className="p-2 rounded-3 bg-light text-muted small">Loading ponds...</div>
                ) : ponds.length === 0 ? (
                  <div className="alert alert-warning py-2 mb-0 extra-small">No assigned ponds found for your caretaker account.</div>
                ) : (
                  <div className="input-group">
                    <span className="input-group-text bg-white" style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}>
                      <FaWater size={13} style={{ color: '#FC563C' }} />
                    </span>
                    <select
                      className="form-select form-select-sm fw-bold"
                      value={form.pondId}
                      onChange={(e) => setForm({ ...form, pondId: e.target.value })}
                      style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}
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
                  <span className="input-group-text bg-white" style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}>
                    <FaClock size={13} style={{ color: '#FC563C' }} />
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-sm bg-light fw-semibold text-muted font-mono"
                    value={new Date().toLocaleString()}
                    disabled
                    style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}
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
                  style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}
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
                style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}
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
                placeholder="Describe what happened: pond location, smell, water color, time observed, and what you did."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ borderColor: 'rgba(252, 86, 60, 0.18)', fontSize: '0.86rem' }}
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
                style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}
              />
            </div>

            {/* ROW 6: MEDIA ATTACHMENTS (PHOTO & VIDEO DROPZONES) */}
            <div className="row g-3 mt-1 mb-4">
              {/* Photo Evidence Box */}
              <div className="col-12 col-md-6">
                <div className="tri-media-uploadzone h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                      <div className="d-inline-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 28,
                            height: 28,
                            backgroundColor: isDark ? 'rgba(252, 86, 60, 0.2)' : 'rgba(252, 86, 60, 0.1)',
                            color: '#FC563C',
                          }}
                        >
                          <FaCamera size={13} />
                        </div>
                        <span className="fw-bold extra-small" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                          Attach Photo Evidence
                        </span>
                      </div>
                      <div className="d-inline-flex align-items-center gap-1.5 flex-shrink-0">
                        <span className="badge badge-tri-navy rounded-pill extra-small">JPEG / PNG</span>
                        <span className="text-muted extra-small">(optional)</span>
                      </div>
                    </div>
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
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
                      <div className="d-inline-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 28,
                            height: 28,
                            backgroundColor: isDark ? 'rgba(252, 86, 60, 0.2)' : 'rgba(252, 86, 60, 0.1)',
                            color: '#FC563C',
                          }}
                        >
                          <FaVideo size={13} />
                        </div>
                        <span className="fw-bold extra-small" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                          Attach Video Evidence
                        </span>
                      </div>
                      <div className="d-inline-flex align-items-center gap-1.5 flex-shrink-0">
                        <span className="badge badge-tri-orange rounded-pill extra-small">MP4 / MOV</span>
                        <span className="text-muted extra-small">(optional)</span>
                      </div>
                    </div>
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
              className="d-flex align-items-center justify-content-between p-3 rounded-4 flex-wrap gap-3 caretaker-submit-strip"
              style={{
                background: isDark ? '#253549' : '#FFFFFF',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1.5px solid #CBD5E1',
                boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(15,23,42,0.04)'
              }}
            >
              <div className="d-flex align-items-center gap-2.5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    background: isDark ? 'rgba(252, 86, 60, 0.2)' : 'rgba(252, 86, 60, 0.1)',
                    color: '#FC563C'
                  }}
                >
                  <FaUserCheck size={15} />
                </div>
                <div>
                  <span className="extra-small text-muted d-block" style={{ fontSize: '0.72rem' }}>Report Originator:</span>
                  <strong className="small" style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontSize: '0.86rem' }}>
                    {user?.full_name || 'Caretaker'} (Verified)
                  </strong>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 w-100 w-sm-auto justify-content-end flex-wrap flex-sm-nowrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3.5 py-2 extra-small fw-bold rounded-pill text-nowrap flex-fill flex-sm-grow-0"
                  style={{ minHeight: 40 }}
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
                  onClick={handleSubmit}
                  className="btn btn-tri-orange px-4 py-2 fw-bold shadow-sm hover-lift d-inline-flex align-items-center justify-content-center gap-2 rounded-pill text-nowrap flex-fill flex-sm-grow-0"
                  style={{
                    minHeight: 40,
                    whiteSpace: 'nowrap',
                    borderRadius: '9999px',
                  }}
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

      {/* TAB 2: INCIDENT HISTORY & RESOLUTION TRACKING */}
      {activeTab === 'history' && (
        <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
          {/* TOOLBAR CONTROLS */}
          <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2.5" style={{ borderColor: '#E2E8F0' }}>
            <div>
              <h5 className="fw-extrabold text-dark mb-0 tracking-tight">
                Incident Logs &amp; Corrective Resolution History
              </h5>
              <small className="text-muted">
                Showing {filteredReports.length} of {myReports.length} incident reports filed for your assigned ponds.
              </small>
            </div>

            {/* Search Input */}
            <div className="position-relative" style={{ width: '100%', maxWidth: 280, minWidth: 170 }}>
              <FaSearch className="position-absolute text-muted extra-small" style={{ top: 12, left: 12 }} />
              <input
                type="text"
                className="minimal-filter-control ps-4 pe-4 fw-medium text-dark"
                placeholder="Search issues, pond, notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ width: '100%', height: 38, fontSize: '0.82rem' }}
              />
              {historySearch && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-muted extra-small position-absolute"
                  style={{ top: 10, right: 12 }}
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
            <div
              className="d-flex align-items-center gap-1.5 p-1.5 rounded-3 border w-100 overflow-x-auto flex-nowrap custom-scrollbar"
              style={{
                backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                maxWidth: '100%',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <span className="extra-small fw-bold text-uppercase tracking-wider px-2 text-nowrap flex-shrink-0" style={{ fontSize: '0.7rem', color: isDark ? '#94A3B8' : '#64748B' }}>
                Status:
              </span>
              <button
                type="button"
                className="btn btn-sm py-1.5 px-3 rounded-2 extra-small fw-bold border-0 transition-all text-nowrap flex-shrink-0"
                style={{
                  backgroundColor: historyStatusFilter === 'all' ? '#FC563C' : 'transparent',
                  color: historyStatusFilter === 'all' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#64748B'),
                  boxShadow: historyStatusFilter === 'all' ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setHistoryStatusFilter('all')}
              >
                All ({myReports.length})
              </button>
              <button
                type="button"
                className="btn btn-sm py-1.5 px-3 rounded-2 extra-small fw-bold border-0 transition-all text-nowrap flex-shrink-0"
                style={{
                  backgroundColor: historyStatusFilter === 'Pending' ? '#FC563C' : 'transparent',
                  color: historyStatusFilter === 'Pending' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#64748B'),
                  boxShadow: historyStatusFilter === 'Pending' ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setHistoryStatusFilter('Pending')}
              >
                Pending ({pendingReports})
              </button>
              <button
                type="button"
                className="btn btn-sm py-1.5 px-3 rounded-2 extra-small fw-bold border-0 transition-all text-nowrap flex-shrink-0"
                style={{
                  backgroundColor: historyStatusFilter === 'In Progress' ? '#FC563C' : 'transparent',
                  color: historyStatusFilter === 'In Progress' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#64748B'),
                  boxShadow: historyStatusFilter === 'In Progress' ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setHistoryStatusFilter('In Progress')}
              >
                In Progress ({inProgressReports})
              </button>
              <button
                type="button"
                className="btn btn-sm py-1.5 px-3 rounded-2 extra-small fw-bold border-0 transition-all text-nowrap flex-shrink-0"
                style={{
                  backgroundColor: historyStatusFilter === 'Done' ? '#FC563C' : 'transparent',
                  color: historyStatusFilter === 'Done' ? '#FFFFFF' : (isDark ? '#CBD5E1' : '#64748B'),
                  boxShadow: historyStatusFilter === 'Done' ? '0 2px 6px rgba(252, 86, 60, 0.35)' : 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setHistoryStatusFilter('Done')}
              >
                Resolved ({doneReports})
              </button>
            </div>

            {/* Basin & Severity Dropdowns */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Basin Filter */}
              <select
                className="minimal-filter-control fw-semibold cursor-pointer"
                style={{ height: 38, minWidth: 120, fontSize: '0.8rem' }}
                value={historyPondFilter}
                onChange={(e) => setHistoryPondFilter(e.target.value)}
              >
                <option value="all">All Ponds</option>
                {ponds.map((p) => (
                  <option key={p.id} value={p.id}>{p.pond_name}</option>
                ))}
              </select>

              {/* Severity Filter */}
              <select
                className="minimal-filter-control fw-semibold cursor-pointer"
                style={{ height: 38, minWidth: 120, fontSize: '0.8rem' }}
                value={historySeverityFilter}
                onChange={(e) => setHistorySeverityFilter(e.target.value)}
              >
                <option value="all">All Severity</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

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
                style={{ width: 56, height: 56, backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C' }}
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
                    className={`tri-incident-card p-4 rounded-4 mb-3 ${isTargetHighlighted ? 'highlighted' : ''}`}
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #E2E8F0',
                      boxShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.3)' : '0 1px 4px rgba(15, 23, 42, 0.04)'
                    }}
                  >
                    {/* CARD HEADER */}
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3 flex-wrap">
                      <div>
                        {/* BADGES ROW */}
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
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
                                  ? (isDark ? 'rgba(252, 86, 60, 0.18)' : '#FFF1ED')
                                  : 'rgba(16, 185, 129, 0.12)',
                              color:
                                sev === 'Critical'
                                  ? '#B91C1C'
                                  : sev === 'High'
                                  ? '#E11D48'
                                  : sev === 'Medium'
                                  ? (isDark ? '#FF8A75' : '#C2410C')
                                  : '#059669',
                              border: `1px solid ${
                                sev === 'Critical'
                                  ? 'rgba(185, 28, 28, 0.3)'
                                  : sev === 'High'
                                  ? 'rgba(225, 29, 72, 0.3)'
                                  : sev === 'Medium'
                                  ? 'rgba(252, 86, 60, 0.3)'
                                  : 'rgba(16, 185, 129, 0.3)'
                              }`,
                            }}
                          >
                            ● {sev} Severity
                          </span>

                          {/* Problem Type Badge */}
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small"
                            style={{
                              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
                              color: isDark ? '#38BDF8' : '#0369A1',
                              border: isDark ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid #BAE6FD'
                            }}
                          >
                            {report.problem_type}
                          </span>

                          {/* Pond Basin Badge */}
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                            style={{
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid #E2E8F0',
                              color: isDark ? '#CBD5E1' : '#475569'
                            }}
                          >
                            <FaWater size={10} className="me-1 text-primary" />
                            {report.pond_name || `Pond #${report.pond_id}`}
                          </span>

                          <span className="text-muted extra-small font-mono fw-semibold">
                            Report #{report.id}
                          </span>
                        </div>

                        {/* Specific Issue Title */}
                        <h6 className="fw-extrabold mb-0 mt-1" style={{ fontSize: '1.1rem', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                          {report.specific_issue}
                        </h6>
                      </div>

                      {/* Status Badge */}
                      <span
                        className="badge rounded-pill fw-bold px-3 py-1.5 extra-small d-inline-flex align-items-center gap-1.5"
                        style={{
                          backgroundColor: isDone
                            ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#ECFDF5')
                            : isInProgress
                            ? (isDark ? 'rgba(252, 86, 60, 0.18)' : 'rgba(252, 86, 60, 0.08)')
                            : (isDark ? 'rgba(252, 86, 60, 0.14)' : '#FFF1ED'),
                          color: isDone ? (isDark ? '#34D399' : '#047857') : isInProgress ? '#FC563C' : (isDark ? '#FF8A75' : '#C2410C'),
                          border: `1px solid ${
                            isDone ? 'rgba(16, 185, 129, 0.4)' : isInProgress ? 'rgba(252, 86, 60, 0.35)' : 'rgba(252, 86, 60, 0.3)'
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

                    {/* Description Text Box */}
                    <div
                      className="p-3 rounded-3 mb-3"
                      style={{
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : '#F8FAFC',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1.5px solid #E2E8F0'
                      }}
                    >
                      <p className="mb-0 fw-medium" style={{ color: isDark ? '#F1F5F9' : '#1E293B', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        {report.description}
                      </p>
                    </div>

                    {/* Media Attachments Gallery */}
                    {(resPhoto || resVideo) && (
                      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                        {resPhoto && (
                          <div
                            className="position-relative rounded-3 overflow-hidden border shadow-xs cursor-pointer hover-lift"
                            style={{ width: 140, height: 95 }}
                            onClick={() => setPreviewMediaUrl(resPhoto)}
                            title="Click to zoom photo"
                          >
                            <img src={resPhoto} alt="Attached incident evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div
                              className="position-absolute bottom-0 start-0 w-100 p-1 text-center extra-small text-white fw-bold d-inline-flex align-items-center justify-content-center gap-1"
                              style={{ background: 'rgba(252, 86, 60, 0.72)', fontSize: '0.68rem' }}
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
                        className="rounded-3 p-3 mb-3 extra-small"
                        style={{
                          background: isDark ? '#172A39' : '#FFF5F2',
                          border: isDark ? '1px solid rgba(252, 86, 60, 0.3)' : '1px solid #FECDD3',
                          borderLeft: '4px solid #FC563C',
                          color: isDark ? '#F1F5F9' : '#1E293B',
                        }}
                      >
                        <strong style={{ color: '#FC563C' }}>Caretaker Suggested Action:</strong> {report.suggested_action}
                      </div>
                    )}

                    {/* Admin Resolution Callout Strip */}
                    {report.admin_notes && (
                      <div
                        className="rounded-3 p-3 mb-3 extra-small"
                        style={{
                          background: isDone ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : (isDark ? '#172A39' : '#F1F5F9'),
                          border: `1px solid ${isDone ? (isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0') : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1')}`,
                          borderLeft: `4px solid ${isDone ? '#10B981' : '#FC563C'}`,
                        }}
                      >
                        <div className="d-flex align-items-center gap-1.5 mb-1 fw-bold" style={{ color: isDone ? (isDark ? '#34D399' : '#047857') : '#FC563C' }}>
                          <FaCheckCircle /> <span>Management Resolution Note:</span>
                        </div>
                        <p className="mb-0 fw-medium" style={{ color: isDark ? '#F1F5F9' : '#0F172A', fontSize: '0.84rem' }}>
                          {report.admin_notes}
                        </p>
                        {report.resolved_by && (
                          <span className="text-muted extra-small d-block mt-1">
                            Actioned by: <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>{report.resolved_by}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Timestamp & Caretaker */}
                    <div className="d-flex align-items-center justify-content-between pt-3 mt-3 border-top extra-small flex-wrap gap-2" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(252, 86, 60, 0.08)', color: isDark ? '#94A3B8' : '#64748B' }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span>Pond: <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>{report.pond_name || `Pond #${report.pond_id}`}</strong></span>
                        <span>•</span>
                        <span>Submitted by: <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>{report.caretaker_name || user?.full_name || 'Caretaker'}</strong></span>
                      </div>
                      <div className="font-mono fw-semibold" style={{ color: isDark ? '#CBD5E1' : '#64748B' }}>
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

      {/* FULLSCREEN IMAGE PREVIEW LIGHTBOX MODAL */}
      {previewMediaUrl && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.88)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
          onClick={() => setPreviewMediaUrl(null)}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg scan-report-modal-dialog">
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
