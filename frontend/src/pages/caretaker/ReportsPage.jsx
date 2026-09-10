import { useState, useEffect, useCallback } from 'react';
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
  'Water Quality': [
    'Low Dissolved Oxygen',
    'High Ammonia Level',
    'Turbid / Murky Water',
    'Unstable pH Level',
    'Algae Bloom Observed',
  ],
  'Equipment': [
    'Pump Not Working',
    'Aerator Motor Failure',
    'Automatic Feeder Jammed',
    'DO Sensor Malfunction',
    'Power Generator Cut',
  ],
  'Structural': [
    'Leaking Drainage Pipe',
    'Pond Liner Tear',
    'Dike Erosion / Collapse',
    'Broken Net Fence',
    'Gate Valve Stuck',
  ],
  'Disease / Sick Shrimp': [
    'Dead Shrimp Observed',
    'White Spot Disease Signs',
    'Lethargic / Slow Swimming',
    'Red Body Discoloration',
    'Empty Stomach / Reduced Feeding',
  ],
  'Feed Issue': [
    'Feed Moldy / Wet',
    'Feed Supply Running Low',
    'Uneaten Feed Floating',
    'Incorrect Feed Pellets Delivered',
  ],
  'Maintenance': [
    'Needs Filter Replacement',
    'Sludge Accumulation',
    'Pond Boundary Weeding Required',
    'Aerator Belt Replacement',
  ],
  'Others': [
    'Unexpected Odor From Water',
    'Predator Birds Near Pond',
    'General Inspection Requested',
  ],
};

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

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

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

  const loadMyReports = useCallback(async () => {
    if (!user?.id) return;
    setLoadingReports(true);
    try {
      const res = await api.get(`/maintenance_reports.php?user_id=${user.id}`);
      if (res.data?.success) setMyReports(Array.isArray(res.data.reports) ? res.data.reports : []);
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
      Swal.fire({ icon: 'warning', title: 'Select Pond', text: 'Please select an assigned pond.' });
      return;
    }
    if (!form.description.trim()) {
      Swal.fire({ icon: 'warning', title: 'Description Required', text: 'Please enter a description of the issue.' });
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
          title: 'Report Submitted!',
          text: 'Your maintenance and issue report with attached media has been sent to Admin.',
          timer: 2000,
          showConfirmButton: false,
        });

        setForm((prev) => ({ ...prev, specificIssue: '', description: '', suggestedAction: '', photoUrl: '', videoUrl: '' }));
        setImageFile(null);
        setImagePreview('');
        setVideoFile(null);
        setVideoPreview('');

        if (typeof window !== 'undefined') {
          localStorage.setItem('shrim-notification-updated', String(Date.now()));
          window.dispatchEvent(new Event('shrim-notification-updated'));
        }
        setActiveTab('history');
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Submission Failed', text: error.response?.data?.message || 'Unable to submit report. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPond = ponds.find((pond) => String(pond.id) === String(form.pondId));
  const pendingReports = myReports.filter((report) => report.status === 'Pending').length;
  const inProgressReports = myReports.filter((report) => report.status === 'In Progress').length;
  const doneReports = myReports.filter((report) => report.status === 'Done' || report.status === 'Resolved').length;
  const severityBadges = { Low: 'bg-success text-white', Medium: 'bg-warning text-dark', High: 'bg-danger text-white', Critical: 'bg-danger text-white fw-bold' };
  const statusBadges = { Pending: 'bg-warning text-dark', 'In Progress': 'bg-info text-dark', Done: 'bg-success text-white', Dismissed: 'bg-secondary text-white' };

  return (
    <div className="caretaker-reports-hub">
      {/* 🌟 HERO CONTROL STRIP: BREADCRUMB, STATUS BADGE & ACTION TABS */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill fw-bold extra-small"
              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              ● INCIDENT REPORTING
            </span>
            <span className="text-muted extra-small">
              Direct Admin Dispatch • Media Proof & Equipment Logging
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 mt-1 tracking-tight text-dark" style={{ fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Pond Issue & Incident Reports
          </h2>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold d-flex align-items-center gap-2 transition-all shadow-xs ${
              activeTab === 'submit'
                ? 'btn-dark text-white'
                : 'btn-white bg-white text-dark border'
            }`}
            style={{
              height: 36,
              fontSize: '0.8rem',
              backgroundColor: activeTab === 'submit' ? '#0B2C5F' : '#FFFFFF',
              borderColor: activeTab === 'submit' ? '#0B2C5F' : '#E2E8F0',
            }}
            onClick={() => setActiveTab('submit')}
          >
            <FaPaperPlane size={11} /> Generate Report
          </button>

          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3.5 py-1.5 fw-bold d-flex align-items-center gap-2 transition-all shadow-xs ${
              activeTab === 'history'
                ? 'btn-dark text-white'
                : 'btn-white bg-white text-dark border'
            }`}
            style={{
              height: 36,
              fontSize: '0.8rem',
              backgroundColor: activeTab === 'history' ? '#0B2C5F' : '#FFFFFF',
              borderColor: activeTab === 'history' ? '#0B2C5F' : '#E2E8F0',
            }}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory size={11} /> History
            {myReports.length > 0 && (
              <span className={`badge rounded-pill extra-small ms-1 ${activeTab === 'history' ? 'bg-white text-dark' : 'bg-secondary bg-opacity-25 text-dark'}`}>
                {myReports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 🌟 SUMMARY KPI CARDS (SPACIOUS LUXURY AQUACULTURE TELEMETRY STYLE) */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Assigned Ponds */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Basins</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaWater size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {ponds.length}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                />
              </div>
              <div className="d-flex align-items-center justify-content-between extra-small text-muted">
                <span>Available for dispatch</span>
                <span className="tag-cyan-active">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Reports */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Pending Action</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#D97706' }}
                >
                  <FaClock size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-warning" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {pendingReports}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (pendingReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                  }}
                />
              </div>
              <div className="d-flex align-items-center justify-content-between extra-small text-muted">
                <span>Awaiting admin review</span>
                <span className="tag-orange-maintenance">Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: In Progress Reports */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">In Progress</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0EA5E9' }}
                >
                  <FaTools size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-info" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {inProgressReports}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (inProgressReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
                  }}
                />
              </div>
              <div className="d-flex align-items-center justify-content-between extra-small text-muted">
                <span>Active maintenance</span>
                <span className="tag-cyan-active">Handling</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Resolved Reports */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Resolved</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
                >
                  <FaCheckCircle size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-success" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {doneReports}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (doneReports / Math.max(1, myReports.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #16A34A, #4ADE80)',
                  }}
                />
              </div>
              <div className="d-flex align-items-center justify-content-between extra-small text-muted">
                <span>Completed incidents</span>
                <span className="tag-green-safe">Resolved</span>
              </div>
            </div>
          </div>
        </div>
      </div>


      {activeTab === 'submit' && (
        <div className="asymmetric-card p-4">
          <div>
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold text-dark mb-1 tracking-tight">Submit Pond Incident Report</h5>
                <small className="text-muted">Fill in pond location, problem type, specific issue, and detailed description.</small>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill extra-small fw-semibold d-flex align-items-center gap-1.5">
                <FaFileAlt /><span>Admin notification ready</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark">Pond Number / Location</label>
                  {loadingPonds ? (
                    <div className="caretaker-muted-box">Loading ponds...</div>
                  ) : ponds.length === 0 ? (
                    <div className="alert alert-warning py-2 mb-0">No pond is assigned to your caretaker account.</div>
                  ) : (
                    <select className="form-select fw-semibold" value={form.pondId} onChange={(e) => setForm({ ...form, pondId: e.target.value })} required>
                      {ponds.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.pond_name || `Pond #${p.id}`} {p.location ? `(${p.location})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark">Logged Date & Time</label>
                  <input type="text" className="form-control bg-light" value={new Date().toLocaleString()} disabled />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold text-dark">Problem Type</label>
                <select className="form-select fw-semibold" value={form.problemType} onChange={(e) => setForm({ ...form, problemType: e.target.value })}>
                  <option value="Water Quality">Water Quality</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Structural">Structural</option>
                  <option value="Disease / Sick Shrimp">Disease / Sick Shrimp</option>
                  <option value="Feed Issue">Feed Issue</option>
                  <option value="Maintenance">General Pond Maintenance</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold text-dark">Specific Issue Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Example: Pump not working or select from suggestions below"
                  value={form.specificIssue}
                  onChange={(e) => setForm({ ...form, specificIssue: e.target.value })}
                />
                
                {/* Dynamic Quick Suggestions based on Problem Type */}
                <div className="caretaker-quick-tags mt-2 d-flex align-items-center flex-wrap gap-1.5">
                  <span className="text-muted extra-small fw-bold me-1 d-flex align-items-center gap-1">
                    <FaTag size={11} /> Quick suggestions for {form.problemType}:
                  </span>
                  {(quickSuggestionsByProblemType[form.problemType] || quickSuggestionsByProblemType['Equipment']).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="btn btn-xs btn-outline-primary rounded-pill extra-small py-1 px-3 fw-semibold shadow-xs"
                      onClick={() => applyQuickSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold text-dark">Detailed Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Describe what you observed in the pond in detail."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1.5">
                  Suggested Action <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small fw-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Example: Inspect pump wiring or replace filter"
                  value={form.suggestedAction}
                  onChange={(e) => setForm({ ...form, suggestedAction: e.target.value })}
                />
              </div>

              <div className="caretaker-media-grid mt-3">
                <div className="caretaker-media-box">
                  <label className="fw-semibold text-dark mb-1 d-block"><FaCamera className="me-1 text-primary" /> Attach Photo Evidence</label>
                  <input type="file" className="form-control" accept="image/*" onChange={handleImageChange} />
                  {uploadingImage && <div className="small text-primary mt-2"><FaSpinner className="fa-spin" /> Uploading image...</div>}
                  {imagePreview && (
                    <div className="caretaker-media-preview mt-2">
                      <img src={imagePreview} alt="Preview" />
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); setForm((prev) => ({ ...prev, photoUrl: '' })); }} title="Remove photo">
                        <FaTrash />
                      </button>
                    </div>
                  )}
                </div>

                <div className="caretaker-media-box">
                  <label className="fw-semibold text-dark mb-1 d-flex align-items-center justify-content-between">
                    <span><FaVideo className="me-1 text-danger" /> Attach Video</span>
                    <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small fw-normal">(optional)</span>
                  </label>
                  <input type="file" className="form-control" accept="video/*" onChange={handleVideoChange} />
                  {uploadingVideo && <div className="small text-danger mt-2"><FaSpinner className="fa-spin" /> Uploading video...</div>}
                  {videoPreview && (
                    <div className="caretaker-media-preview mt-2">
                      <video src={videoPreview} controls />
                      <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(''); setForm((prev) => ({ ...prev, videoUrl: '' })); }} title="Remove video">
                        <FaTrash />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="caretaker-submit-strip d-flex align-items-center justify-content-between p-3 mt-4 bg-light rounded-4 border">
                <span className="text-secondary small">
                  Reported by: <strong className="text-dark fw-bold">{user?.full_name || 'Caretaker'}</strong>
                </span>
                <button type="submit" className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold d-inline-flex align-items-center gap-2 shadow-sm" disabled={submitting || uploadingImage || uploadingVideo}>
                  {submitting ? <><FaSpinner className="fa-spin" /> Submitting...</> : <><FaPaperPlane /> Submit Report</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="asymmetric-card p-4">
          <div>
            <div className="caretaker-panel-header">
              <div>
                <h5>My Submitted History</h5>
                <small className="text-muted">Track admin action and review attached evidence.</small>
              </div>
              <div className="caretaker-history-total"><FaHistory /><span>{myReports.length} report(s)</span></div>
            </div>

            {loadingReports ? (
              <div className="caretaker-empty-state">Loading your submitted reports...</div>
            ) : myReports.length === 0 ? (
              <div className="caretaker-empty-state">
                <div>
                  <FaHistory className="display-6 opacity-25 mb-2" />
                  <h6>No reports submitted yet</h6>
                  <p className="small mb-0 text-muted">Use the submit tab to report pond issues to administration.</p>
                </div>
              </div>
            ) : (
              <div className="caretaker-report-list">
                {myReports.map((report) => {
                  const resPhoto = resolveMediaUrl(report.photo_url);
                  const resVideo = resolveMediaUrl(report.video_url);
                  const isHighlighted = String(report.id) === String(targetId);

                  return (
                    <article key={report.id} id={`caretaker-report-${report.id}`} className={`caretaker-report-card ${isHighlighted ? 'highlighted-report-card' : ''}`}>
                      <div className="caretaker-report-card-head">
                        <div>
                          <div className="caretaker-report-badges">
                            <span className={`badge ${severityBadges[report.severity_level] || 'bg-secondary'}`}>{report.severity_level} Severity</span>
                            <span className="badge bg-secondary bg-opacity-10 text-dark">{report.problem_type}</span>
                          </div>
                          <h6>{report.specific_issue}</h6>
                        </div>
                        <span className={`badge ${statusBadges[report.status] || 'bg-secondary'}`}>
                          {report.status === 'Done' ? <><FaCheckCircle className="me-1" /> Done</> : report.status === 'In Progress' ? <><FaTools className="me-1" /> In Progress</> : <><FaClock className="me-1" /> Pending</>}
                        </span>
                      </div>

                      <p>{report.description}</p>

                      {(resPhoto || resVideo) && (
                        <div className="caretaker-report-media">
                          {resPhoto && <img src={resPhoto} alt="Attached report" />}
                          {resVideo && <video src={resVideo} controls />}
                        </div>
                      )}

                      {report.suggested_action && <div className="caretaker-report-note"><strong>Suggested Action:</strong> {report.suggested_action}</div>}
                      {report.admin_notes && (
                        <div className="alert alert-success border-0 py-2 px-3 small mt-2 mb-1">
                          <strong>Admin Resolution Note:</strong> {report.admin_notes} {report.resolved_by && <span className="text-muted">({report.resolved_by})</span>}
                        </div>
                      )}
                      <div className="caretaker-report-meta">
                        Pond: <strong>{report.pond_name}</strong> | Submitted:{' '}
                        {new Date(report.created_at || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
