import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import {
  FaExclamationTriangle,
  FaPaperPlane,
  FaHistory,
  FaWater,
  FaTools,
  FaCheckCircle,
  FaClock,
  FaSpinner,
  FaTag,
  FaCamera,
  FaVideo,
  FaTrash,
} from 'react-icons/fa';

// Helper to resolve media URLs to absolute Apache XAMPP server address
const resolveMediaUrl = (url) => {
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
  return `http://localhost/shrim_predict_api/${cleanPath.replace(/^\/+/, '')}`;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' | 'history'
  const [ponds, setPonds] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [loadingPonds, setLoadingPonds] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // File Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Form State
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

  // Load Caretaker Assigned Ponds
  useEffect(() => {
    const loadPonds = async () => {
      try {
        const res = await api.get('/ponds.php');
        const list = Array.isArray(res.data) ? res.data : (res.data?.ponds || []);
        setPonds(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, pondId: String(list[0].id) }));
        }
      } catch (e) {
        console.error('Error loading ponds:', e);
      } finally {
        setLoadingPonds(false);
      }
    };
    loadPonds();
  }, []);

  // Load My Submitted Reports
  const loadMyReports = useCallback(async () => {
    if (!user?.id) return;
    setLoadingReports(true);
    try {
      const res = await api.get(`/maintenance_reports.php?user_id=${user.id}`);
      if (res.data?.success) {
        setMyReports(Array.isArray(res.data.reports) ? res.data.reports : []);
      }
    } catch (e) {
      console.error('Error loading reports:', e);
    } finally {
      setLoadingReports(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadMyReports();
    }
  }, [activeTab, loadMyReports]);

  // Handle Image File selection & upload
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);
    setUploadingImage(true);

    try {
      const res = await api.post('/upload_report_media.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setForm((prev) => ({ ...prev, photoUrl: res.data.file_url }));
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      Swal.fire({ icon: 'error', title: 'Image Upload Error', text: 'Failed to upload photo.' });
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle Video File selection & upload
  const handleVideoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);
    setUploadingVideo(true);

    try {
      const res = await api.post('/upload_report_media.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setForm((prev) => ({ ...prev, videoUrl: res.data.file_url }));
      }
    } catch (err) {
      console.error('Video upload failed:', err);
      Swal.fire({ icon: 'error', title: 'Video Upload Error', text: 'Failed to upload video.' });
    } finally {
      setUploadingVideo(false);
    }
  };

  // Quick Issue Suggestion click
  const applyQuickIssue = (issue, category, defaultSeverity) => {
    setForm((prev) => ({
      ...prev,
      specificIssue: issue,
      problemType: category || prev.problemType,
      severityLevel: defaultSeverity || prev.severityLevel,
    }));
  };

  // Submit Handler
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
    const pondName = selectedPondObj ? (selectedPondObj.pond_name || (`Pond #${selectedPondObj.id}`)) : `Pond #${form.pondId}`;

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

        // Reset form & media files
        setForm((prev) => ({
          ...prev,
          specificIssue: '',
          description: '',
          suggestedAction: '',
          photoUrl: '',
          videoUrl: '',
        }));
        setImageFile(null);
        setImagePreview('');
        setVideoFile(null);
        setVideoPreview('');

        if (typeof window !== 'undefined') {
          localStorage.setItem('shrim-notification-updated', String(Date.now()));
          window.dispatchEvent(new Event('shrim-notification-updated'));
        }

        // Switch to history tab
        setActiveTab('history');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: error.response?.data?.message || 'Unable to submit report. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const severityBadges = {
    Low: 'bg-success text-white',
    Medium: 'bg-warning text-dark',
    High: 'bg-danger text-white',
    Critical: 'bg-danger text-white fw-bold',
  };

  const statusBadges = {
    Pending: 'bg-warning text-dark',
    'In Progress': 'bg-info text-dark',
    Done: 'bg-success text-white',
    Dismissed: 'bg-secondary text-white',
  };

  return (
    <div>
      {/* Header & Navigation Tabs */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <FaExclamationTriangle className="text-warning" /> Pond Issue & Maintenance Reports
          </h3>
          <p className="text-muted mb-0">
            Submit equipment, water quality, or maintenance requests directly to farm administration.
          </p>
        </div>

        <ul className="nav nav-pills gap-2">
          <li className="nav-item">
            <button
              className={`nav-link btn-sm fw-semibold d-flex align-items-center gap-2 ${
                activeTab === 'submit' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('submit')}
            >
              <FaPaperPlane /> Submit New Report
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link btn-sm fw-semibold d-flex align-items-center gap-2 ${
                activeTab === 'history' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('history')}
            >
              <FaHistory /> My Submitted History
            </button>
          </li>
        </ul>
      </div>

      {/* TAB 1: SUBMIT REPORT FORM */}
      {activeTab === 'submit' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Pond Selection */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1">
                    <FaWater className="text-primary" /> Pond Number / Location <span className="text-danger">*</span>
                  </label>
                  {loadingPonds ? (
                    <div className="text-muted small">Loading ponds…</div>
                  ) : (
                    <select
                      className="form-select fw-semibold"
                      value={form.pondId}
                      onChange={(e) => setForm({ ...form, pondId: e.target.value })}
                      required
                    >
                      {ponds.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.pond_name || (`Pond #${p.id}`)} {p.location ? `(${p.location})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Auto Date & Time */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark">
                    Logged Date & Time (Auto-filled)
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light text-muted"
                    value={new Date().toLocaleString()}
                    disabled
                  />
                </div>

                {/* Problem Type */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark">
                    Problem Type (Category) <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={form.problemType}
                    onChange={(e) => setForm({ ...form, problemType: e.target.value })}
                  >
                    <option value="Water Quality">Water Quality (Low Oxygen, pH, Smell)</option>
                    <option value="Equipment">Equipment (Aerator, Pump, Feeder)</option>
                    <option value="Structural">Structural (Leaking Pipe, Dikes, Fence)</option>
                    <option value="Disease / Sick Shrimp">Disease / Sick Shrimp Observed</option>
                    <option value="Feed Issue">Feed Issue (Supply shortage, Spoilage)</option>
                    <option value="Maintenance">General Pond Maintenance</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {/* Severity Level */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark d-block">
                    Severity Level <span className="text-danger">*</span>
                  </label>
                  <div className="btn-group w-100" role="group">
                    {['Low', 'Medium', 'High', 'Critical'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`btn btn-sm ${
                          form.severityLevel === level
                            ? level === 'Low'
                              ? 'btn-success'
                              : level === 'Medium'
                              ? 'btn-warning text-dark fw-bold'
                              : level === 'High'
                              ? 'btn-orange text-white bg-warning'
                              : 'btn-danger fw-bold'
                            : 'btn-outline-secondary'
                        }`}
                        onClick={() => setForm({ ...form, severityLevel: level })}
                      >
                        {level === 'Critical' ? '🚨 Critical' : level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Issue */}
                <div className="col-12">
                  <label className="form-label fw-semibold text-dark">Specific Issue Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Pump Not Working / Leaking Pipe / Low Dissolved Oxygen"
                    value={form.specificIssue}
                    onChange={(e) => setForm({ ...form, specificIssue: e.target.value })}
                  />

                  {/* Quick Preset Issue Tags */}
                  <div className="d-flex align-items-center gap-1.5 flex-wrap mt-2">
                    <span className="small text-muted me-1 d-flex align-items-center gap-1">
                      <FaTag /> Quick Suggestions:
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 rounded-pill small"
                      onClick={() => applyQuickIssue('Pump Not Working', 'Equipment', 'High')}
                    >
                      Pump Not Working
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 rounded-pill small"
                      onClick={() => applyQuickIssue('Low Dissolved Oxygen', 'Water Quality', 'High')}
                    >
                      Low Dissolved Oxygen
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 rounded-pill small"
                      onClick={() => applyQuickIssue('Needs Filter Replacement', 'Maintenance', 'Medium')}
                    >
                      Needs Filter Replacement
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 rounded-pill small"
                      onClick={() => applyQuickIssue('Leaking Drainage Pipe', 'Structural', 'Medium')}
                    >
                      Leaking Pipe
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 rounded-pill small"
                      onClick={() => applyQuickIssue('Dead Shrimp Observed', 'Disease / Sick Shrimp', 'Critical')}
                    >
                      Dead Shrimp Observed
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="col-12">
                  <label className="form-label fw-semibold text-dark">
                    Detailed Description <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Provide detailed explanation of the issue observed in the pond..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  ></textarea>
                </div>

                {/* Suggested Action */}
                <div className="col-12">
                  <label className="form-label fw-semibold text-dark">Suggested Action (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Palitan na ang filter pump / Inspect electrical box"
                    value={form.suggestedAction}
                    onChange={(e) => setForm({ ...form, suggestedAction: e.target.value })}
                  />
                </div>

                {/* OPTIONAL ATTACHMENTS: PHOTO & VIDEO UPLOADS */}
                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1">
                    <FaCamera className="text-primary" /> Attach Photo / Image (Optional)
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {uploadingImage && <div className="small text-primary mt-1"><FaSpinner className="fa-spin" /> Uploading image…</div>}

                  {imagePreview && (
                    <div className="mt-2 position-relative d-inline-block border rounded p-1">
                      <img src={imagePreview} alt="Preview" style={{ maxHeight: 120, borderRadius: 6 }} />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm p-1 position-absolute top-0 end-0 m-1 rounded-circle"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview('');
                          setForm((prev) => ({ ...prev, photoUrl: '' }));
                        }}
                        title="Remove Photo"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold text-dark d-flex align-items-center gap-1">
                    <FaVideo className="text-danger" /> Attach Video File (Optional)
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept="video/*"
                    onChange={handleVideoChange}
                  />
                  {uploadingVideo && <div className="small text-danger mt-1"><FaSpinner className="fa-spin" /> Uploading video…</div>}

                  {videoPreview && (
                    <div className="mt-2 position-relative border rounded p-1 bg-black" style={{ maxWidth: 220 }}>
                      <video src={videoPreview} controls style={{ width: '100%', maxHeight: 120, borderRadius: 4 }} />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm p-1 position-absolute top-0 end-0 m-1 rounded-circle"
                        onClick={() => {
                          setVideoFile(null);
                          setVideoPreview('');
                          setForm((prev) => ({ ...prev, videoUrl: '' }));
                        }}
                        title="Remove Video"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Row */}
                <div className="col-12 bg-light p-3 rounded-3 d-flex align-items-center justify-content-between mt-4">
                  <span className="small text-muted">
                    Reported by: <strong>{user?.full_name || 'Caretaker'}</strong>
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary fw-bold px-4 d-flex align-items-center gap-2"
                    disabled={submitting || uploadingImage || uploadingVideo}
                  >
                    {submitting ? (
                      <>
                        <FaSpinner className="fa-spin" /> Submitting Report…
                      </>
                    ) : (
                      <>
                        <FaPaperPlane /> Submit Report to Admin
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: MY SUBMITTED HISTORY */}
      {activeTab === 'history' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loadingReports ? (
              <div className="text-center py-5 text-muted">Loading your submitted reports…</div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <FaHistory className="display-5 opacity-25 mb-2" />
                <h6>No reports submitted yet</h6>
                <p className="small mb-0">Use the form tab above to report pond issues to administration.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {myReports.map((report) => {
                  const resPhoto = resolveMediaUrl(report.photo_url);
                  const resVideo = resolveMediaUrl(report.video_url);

                  return (
                    <div key={report.id} className="list-group-item p-4 border-bottom">
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                        <div>
                          <span className={`badge me-2 ${severityBadges[report.severity_level] || 'bg-secondary'}`}>
                            {report.severity_level} Severity
                          </span>
                          <span className="badge bg-secondary bg-opacity-10 text-dark me-2">
                            {report.problem_type}
                          </span>
                          <strong className="text-dark fs-6">{report.specific_issue}</strong>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge ${statusBadges[report.status] || 'bg-secondary'}`}>
                            {report.status === 'Done' ? <><FaCheckCircle className="me-1" /> Done</> : report.status === 'In Progress' ? <><FaTools className="me-1" /> In Progress</> : <><FaClock className="me-1" /> Pending</>}
                          </span>
                        </div>
                      </div>

                      <p className="text-dark mb-2 small">{report.description}</p>

                      {/* Attached Photo / Video preview in Caretaker History */}
                      {(resPhoto || resVideo) && (
                        <div className="d-flex gap-3 align-items-center mb-2 flex-wrap bg-light p-2 rounded">
                          {resPhoto && (
                            <div>
                              <small className="text-muted d-block mb-1">Attached Photo:</small>
                              <img src={resPhoto} alt="Attached" style={{ maxHeight: 90, borderRadius: 6 }} className="border shadow-sm" />
                            </div>
                          )}
                          {resVideo && (
                            <div>
                              <small className="text-muted d-block mb-1">Attached Video:</small>
                              <video src={resVideo} controls style={{ maxHeight: 90, borderRadius: 6, maxWidth: 180 }} className="bg-black border shadow-sm" />
                            </div>
                          )}
                        </div>
                      )}

                      {report.suggested_action && (
                        <div className="small text-muted mb-1">
                          <strong>Suggested Action:</strong> {report.suggested_action}
                        </div>
                      )}

                      {report.admin_notes && (
                        <div className="alert alert-success border-0 py-2 px-3 small mt-2 mb-1">
                          <strong>Admin Resolution Note:</strong> {report.admin_notes}{' '}
                          {report.resolved_by && <span className="text-muted">({report.resolved_by})</span>}
                        </div>
                      )}

                      <div className="text-muted extra-small mt-2" style={{ fontSize: '0.8rem' }}>
                        Pond: <strong>{report.pond_name}</strong> • Submitted:{' '}
                        {new Date(report.created_at || Date.now()).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
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
