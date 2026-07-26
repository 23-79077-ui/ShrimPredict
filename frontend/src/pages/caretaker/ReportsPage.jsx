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

const quickIssues = [
  ['Pump Not Working', 'Equipment', 'High'],
  ['Low Dissolved Oxygen', 'Water Quality', 'High'],
  ['Needs Filter Replacement', 'Maintenance', 'Medium'],
  ['Leaking Drainage Pipe', 'Structural', 'Medium'],
  ['Dead Shrimp Observed', 'Disease / Sick Shrimp', 'Critical'],
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
    if (activeTab === 'history') loadMyReports();
  }, [activeTab, loadMyReports]);

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

  const applyQuickIssue = (issue, category, defaultSeverity) => {
    setForm((prev) => ({
      ...prev,
      specificIssue: issue,
      problemType: category || prev.problemType,
      severityLevel: defaultSeverity || prev.severityLevel,
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
  const doneReports = myReports.filter((report) => report.status === 'Done').length;
  const severityBadges = { Low: 'bg-success text-white', Medium: 'bg-warning text-dark', High: 'bg-danger text-white', Critical: 'bg-danger text-white fw-bold' };
  const statusBadges = { Pending: 'bg-warning text-dark', 'In Progress': 'bg-info text-dark', Done: 'bg-success text-white', Dismissed: 'bg-secondary text-white' };

  return (
    <div className="caretaker-reports-page">
      <section className="caretaker-dashboard-hero caretaker-reports-hero">
        <div>
          <span className="caretaker-dashboard-kicker">Maintenance Reporting</span>
          <h3>Pond Issue Reports</h3>
          <p>Send clear pond issues, equipment concerns, photos, and videos directly to the farm administrator.</p>
          <div className="caretaker-hero-meta">
            <span>{ponds.length} assigned pond(s)</span>
            <span>{myReports.length} submitted report(s)</span>
            <span>{selectedPond?.pond_name || 'Select a pond'}</span>
          </div>
        </div>
        <div className="caretaker-report-tabs">
          <button type="button" className={activeTab === 'submit' ? 'active' : ''} onClick={() => setActiveTab('submit')}>
            <FaPaperPlane /> Submit
          </button>
          <button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
            <FaHistory /> History
          </button>
        </div>
      </section>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-blue h-100">
            <div className="card-body">
              <div className="caretaker-stat-top"><span>Assigned Ponds</span><span className="caretaker-stat-icon"><FaWater /></span></div>
              <h3>{ponds.length}</h3>
              <small className="text-muted">Available for reporting</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-amber h-100">
            <div className="card-body">
              <div className="caretaker-stat-top"><span>Pending</span><span className="caretaker-stat-icon"><FaClock /></span></div>
              <h3>{pendingReports}</h3>
              <small className="text-muted">Awaiting admin action</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-cyan h-100">
            <div className="card-body">
              <div className="caretaker-stat-top"><span>In Progress</span><span className="caretaker-stat-icon"><FaTools /></span></div>
              <h3>{inProgressReports}</h3>
              <small className="text-muted">Being handled</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-stat-card accent-green h-100">
            <div className="card-body">
              <div className="caretaker-stat-top"><span>Resolved</span><span className="caretaker-stat-icon"><FaCheckCircle /></span></div>
              <h3>{doneReports}</h3>
              <small className="text-muted">Completed reports</small>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'submit' && (
        <div className="card caretaker-panel-card">
          <div className="card-body">
            <div className="caretaker-panel-header">
              <div>
                <h5>Submit New Report</h5>
                <small className="text-muted">Required fields are pond, severity, and detailed description.</small>
              </div>
              <div className="caretaker-history-total"><FaFileAlt /><span>Admin notification ready</span></div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="caretaker-report-form-grid">
                <div>
                  <label className="form-label fw-semibold">Pond Number / Location</label>
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

                <div>
                  <label className="form-label fw-semibold">Logged Date & Time</label>
                  <input type="text" className="form-control" value={new Date().toLocaleString()} disabled />
                </div>

                <div>
                  <label className="form-label fw-semibold">Problem Type</label>
                  <select className="form-select" value={form.problemType} onChange={(e) => setForm({ ...form, problemType: e.target.value })}>
                    <option value="Water Quality">Water Quality</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Structural">Structural</option>
                    <option value="Disease / Sick Shrimp">Disease / Sick Shrimp</option>
                    <option value="Feed Issue">Feed Issue</option>
                    <option value="Maintenance">General Pond Maintenance</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="form-label fw-semibold">Severity Level</label>
                  <div className="caretaker-severity-grid">
                    {['Low', 'Medium', 'High', 'Critical'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={form.severityLevel === level ? `active ${level.toLowerCase()}` : ''}
                        onClick={() => setForm({ ...form, severityLevel: level })}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label fw-semibold">Specific Issue Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Example: Pump not working"
                  value={form.specificIssue}
                  onChange={(e) => setForm({ ...form, specificIssue: e.target.value })}
                />
                <div className="caretaker-quick-tags">
                  <span><FaTag /> Quick suggestions</span>
                  {quickIssues.map(([issue, category, severity]) => (
                    <button key={issue} type="button" onClick={() => applyQuickIssue(issue, category, severity)}>{issue}</button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label fw-semibold">Detailed Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Describe what you observed in the pond."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div className="mt-3">
                <label className="form-label fw-semibold">Suggested Action</label>
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
                  <label><FaCamera /> Attach Photo</label>
                  <input type="file" className="form-control" accept="image/*" onChange={handleImageChange} />
                  {uploadingImage && <div className="small text-primary mt-2"><FaSpinner className="fa-spin" /> Uploading image...</div>}
                  {imagePreview && (
                    <div className="caretaker-media-preview">
                      <img src={imagePreview} alt="Preview" />
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); setForm((prev) => ({ ...prev, photoUrl: '' })); }} title="Remove photo">
                        <FaTrash />
                      </button>
                    </div>
                  )}
                </div>

                <div className="caretaker-media-box">
                  <label><FaVideo /> Attach Video</label>
                  <input type="file" className="form-control" accept="video/*" onChange={handleVideoChange} />
                  {uploadingVideo && <div className="small text-danger mt-2"><FaSpinner className="fa-spin" /> Uploading video...</div>}
                  {videoPreview && (
                    <div className="caretaker-media-preview">
                      <video src={videoPreview} controls />
                      <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(''); setForm((prev) => ({ ...prev, videoUrl: '' })); }} title="Remove video">
                        <FaTrash />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="caretaker-submit-strip">
                <span>Reported by: <strong>{user?.full_name || 'Caretaker'}</strong></span>
                <button type="submit" className="btn btn-primary" disabled={submitting || uploadingImage || uploadingVideo}>
                  {submitting ? <><FaSpinner className="fa-spin" /> Submitting...</> : <><FaPaperPlane /> Submit Report to Admin</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card caretaker-panel-card">
          <div className="card-body">
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
