import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import Swal from 'sweetalert2';
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTools,
  FaClock,
  FaTrashAlt,
  FaFilter,
  FaSync,
  FaUserTie,
  FaWater,
  FaCommentDots,
  FaImage,
  FaVideo,
  FaTimes,
  FaCamera,
  FaSearchPlus,
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

export default function AdminReportsPage() {
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id') || searchParams.get('report_id');
  const targetPond = searchParams.get('pond');
  const targetIssue = searchParams.get('issue');
  const targetCaretaker = searchParams.get('caretaker');

  const [reports, setReports] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, in_progress: 0, done: 0 });
  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [currentTab, setCurrentTab] = useState('all'); // 'all' | 'Pending' | 'In Progress' | 'Done'
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'Critical' | 'High' | 'Medium' | 'Low'
  const [caretakerFilter, setCaretakerFilter] = useState('all');

  // Full-screen Image Modal Preview State
  const [previewImage, setPreviewImage] = useState(null);

  // Load Caretakers list for filter
  useEffect(() => {
    const loadCaretakers = async () => {
      try {
        const res = await api.get('/users.php');
        const list = Array.isArray(res.data?.users || res.data) ? (res.data.users || res.data) : [];
        setCaretakers(list.filter((u) => u.role === 'caretaker'));
      } catch (e) {
        setCaretakers([]);
      }
    };
    loadCaretakers();
  }, []);

  // Fetch Maintenance Reports from API
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentTab !== 'all') params.status = currentTab;
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (caretakerFilter !== 'all') params.user_id = caretakerFilter;

      const res = await api.get('/maintenance_reports.php', { params });
      if (res.data?.success) {
        setReports(Array.isArray(res.data.reports) ? res.data.reports : []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (error) {
      console.error('Error fetching maintenance reports:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTab, severityFilter, caretakerFilter]);

  useEffect(() => {
    loadReports();
    const handleUpdate = () => loadReports();
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadReports]);

  // Helper function to check if a report matches deep link parameters
  const checkIsHighlighted = useCallback(
    (report) => {
      if (targetId && String(report.id) === String(targetId)) return true;
      if (targetIssue && String(report.specific_issue || '').toLowerCase().includes(targetIssue.toLowerCase())) return true;
      if (targetPond && String(report.pond_name || '').toLowerCase() === targetPond.toLowerCase()) return true;
      return false;
    },
    [targetId, targetIssue, targetPond]
  );

  // Auto-scroll to highlighted target report card
  useEffect(() => {
    if ((targetId || targetIssue || targetPond) && reports.length > 0) {
      const matched = reports.find(checkIsHighlighted);
      if (matched) {
        setTimeout(() => {
          const el = document.getElementById(`maintenance-report-${matched.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
      }
    }
  }, [targetId, targetIssue, targetPond, reports, checkIsHighlighted]);

  // Admin Action: Update Report Status (Mark as Done, Set In Progress, etc.)
  const handleUpdateStatus = async (report, newStatus) => {
    let adminNotes = report.admin_notes || '';

    if (newStatus === 'Done') {
      const { value: noteText, isConfirmed } = await Swal.fire({
        title: 'Mark as Done & Resolved?',
        text: `You are marking "${report.specific_issue}" for ${report.pond_name} as Done.`,
        input: 'textarea',
        inputLabel: 'Resolution Notes / Actions Taken (Optional):',
        inputPlaceholder: 'e.g. Filter replaced by maintenance team at 10:30 AM',
        showCancelButton: true,
        confirmButtonColor: '#1FB567',
        confirmButtonText: 'Yes, Mark as Done',
      });

      if (!isConfirmed) return;
      adminNotes = noteText || 'Issue resolved and verified by admin.';
    }

    try {
      const res = await api.post('/maintenance_reports.php', {
        action: 'update_status',
        id: report.id,
        status: newStatus,
        admin_notes: adminNotes,
        resolved_by: 'Admin',
      });

      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: `Status Updated to ${newStatus}`,
          text: `Report for ${report.pond_name} has been updated.`,
          timer: 1500,
          showConfirmButton: false,
        });
        loadReports();
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Action Failed', text: 'Unable to update status.' });
    }
  };

  // Delete Report
  const handleDeleteReport = async (report) => {
    const result = await Swal.fire({
      title: 'Delete Maintenance Report?',
      text: 'This action will permanently delete this report entry.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.post('/maintenance_reports.php', { action: 'delete', id: report.id });
        Swal.fire({ icon: 'success', title: 'Deleted', text: 'Report deleted.', timer: 1500, showConfirmButton: false });
        loadReports();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: 'Unable to delete report.' });
      }
    }
  };

  const severityBadges = {
    Low: 'bg-success text-white',
    Medium: 'bg-warning text-dark fw-semibold',
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
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <FaExclamationTriangle className="text-warning" /> Caretaker Maintenance & Incident Reports
          </h3>
          <p className="text-muted mb-0">
            Review incoming caretaker requests, attached photos and videos, and update maintenance statuses.
          </p>
        </div>

        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={loadReports}>
          <FaSync /> Refresh Reports
        </button>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Total Reports</small>
                <h4 className="fw-bold mb-0 text-dark">{counts.total}</h4>
              </div>
              <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-circle">
                <FaExclamationTriangle size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Pending Review</small>
                <h4 className="fw-bold mb-0 text-warning">{counts.pending}</h4>
              </div>
              <div className="p-3 bg-warning bg-opacity-10 text-warning rounded-circle">
                <FaClock size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted text-uppercase fw-semibold">In Progress</small>
                <h4 className="fw-bold mb-0 text-info">{counts.in_progress}</h4>
              </div>
              <div className="p-3 bg-info bg-opacity-10 text-info rounded-circle">
                <FaTools size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm p-3 bg-white">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="text-muted text-uppercase fw-semibold">Done / Resolved</small>
                <h4 className="fw-bold mb-0 text-success">{counts.done}</h4>
              </div>
              <div className="p-3 bg-success bg-opacity-10 text-success rounded-circle">
                <FaCheckCircle size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters Controls */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            {/* Status Tabs */}
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'all' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('all')}
                >
                  All ({counts.total})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'Pending' ? 'active bg-warning text-dark' : ''}`}
                  onClick={() => setCurrentTab('Pending')}
                >
                  Pending ({counts.pending})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'In Progress' ? 'active bg-info text-dark' : ''}`}
                  onClick={() => setCurrentTab('In Progress')}
                >
                  In Progress ({counts.in_progress})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'Done' ? 'active bg-success' : ''}`}
                  onClick={() => setCurrentTab('Done')}
                >
                  Done / Resolved ({counts.done})
                </button>
              </li>
            </ul>

            {/* Severity & Caretaker Filter */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="text-muted small fw-semibold d-flex align-items-center gap-1">
                <FaFilter /> Filters:
              </span>

              {/* Severity filter */}
              <select
                className="form-select form-select-sm w-auto"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="Critical">Critical Only</option>
                <option value="High">High Only</option>
                <option value="Medium">Medium Only</option>
                <option value="Low">Low Only</option>
              </select>

              {/* Caretaker filter */}
              <div className="d-flex align-items-center gap-1">
                <FaUserTie className="text-muted" />
                <select
                  className="form-select form-select-sm w-auto"
                  value={caretakerFilter}
                  onChange={(e) => setCaretakerFilter(e.target.value)}
                >
                  <option value="all">All Caretakers</option>
                  {caretakers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Reports Cards / List */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">Loading maintenance reports…</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-5">
              <FaExclamationTriangle className="text-muted opacity-25 display-4 mb-2" />
              <h6 className="fw-semibold text-muted">No maintenance reports found</h6>
              <p className="small text-muted mb-0">No caretaker issue entries match the selected filters.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {reports.map((report) => {
                const resolvedPhotoUrl = resolveMediaUrl(report.photo_url);
                const resolvedVideoUrl = resolveMediaUrl(report.video_url);
                const isHighlighted = checkIsHighlighted(report);

                return (
                  <div
                    key={report.id}
                    id={`maintenance-report-${report.id}`}
                    className={`list-group-item p-4 border-bottom ${
                      isHighlighted ? 'highlighted-report-card' : ''
                    }`}
                  >
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <span className={`badge ${severityBadges[report.severity_level] || 'bg-secondary'}`}>
                            {report.severity_level} Severity
                          </span>
                          <span className="badge bg-secondary bg-opacity-10 text-dark font-monospace">
                            {report.problem_type}
                          </span>
                          <span className="badge bg-primary bg-opacity-10 text-primary fw-bold">
                            <FaWater className="me-1" /> {report.pond_name}
                          </span>
                          <span className="badge bg-light text-dark border">
                            <FaUserTie className="me-1 text-primary" /> {report.caretaker_name}
                          </span>
                        </div>
                        <h5 className="fw-bold text-dark mb-1">{report.specific_issue}</h5>
                      </div>

                      {/* Status Badge & Interactive Admin Action Choices */}
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={`badge ${statusBadges[report.status] || 'bg-secondary'} fs-6 py-1.5 px-3`}>
                          {report.status}
                        </span>

                        {/* Admin Action Buttons */}
                        {report.status !== 'Done' && (
                          <button
                            className="btn btn-success btn-sm fw-semibold d-flex align-items-center gap-1"
                            onClick={() => handleUpdateStatus(report, 'Done')}
                            title="Mark as Done"
                          >
                            <FaCheckCircle /> Mark as Done
                          </button>
                        )}

                        {report.status === 'Pending' && (
                          <button
                            className="btn btn-outline-info btn-sm fw-semibold d-flex align-items-center gap-1"
                            onClick={() => handleUpdateStatus(report, 'In Progress')}
                            title="Set In Progress"
                          >
                            <FaTools /> In Progress
                          </button>
                        )}

                        {report.status === 'Done' && (
                          <button
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                            onClick={() => handleUpdateStatus(report, 'Pending')}
                            title="Reopen Report"
                          >
                            <FaClock /> Reopen
                          </button>
                        )}

                        <button
                          className="btn btn-outline-danger btn-sm p-1 px-2"
                          onClick={() => handleDeleteReport(report)}
                          title="Delete Report"
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </div>

                    {/* Description & Suggested Action */}
                    <div className="bg-light p-3 rounded-3 border mb-3">
                      <p className="text-dark mb-2">{report.description}</p>
                      {report.suggested_action && (
                        <div className="small text-muted">
                          <strong className="text-dark">Caretaker Suggested Action:</strong> "{report.suggested_action}"
                        </div>
                      )}
                    </div>

                    {/* ELEGANT ATTACHED MEDIA GALLERY GRID */}
                    {(resolvedPhotoUrl || resolvedVideoUrl) && (
                      <div className="bg-light bg-opacity-75 p-3 rounded-3 border mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold text-dark mb-0 small d-flex align-items-center gap-1.5">
                            <FaCamera className="text-primary" /> Attached Media Evidence
                          </h6>
                          <span className="text-muted extra-small" style={{ fontSize: '0.78rem' }}>
                            Field Media Attachments
                          </span>
                        </div>

                        <div className="row g-3 align-items-stretch">
                          {/* Attached Image Card */}
                          {resolvedPhotoUrl && (
                            <div className={resolvedVideoUrl ? 'col-md-5' : 'col-md-6'}>
                              <div className="bg-white p-2.5 rounded-3 border shadow-sm h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                  <span className="badge bg-primary bg-opacity-10 text-primary fw-semibold px-2 py-1 small d-flex align-items-center gap-1">
                                    <FaImage /> Photo Evidence
                                  </span>
                                  <span className="text-muted extra-small">Click to expand</span>
                                </div>

                                <div
                                  className="position-relative rounded-2 overflow-hidden bg-dark d-flex align-items-center justify-content-center border"
                                  style={{ height: 160, cursor: 'pointer' }}
                                  onClick={() => setPreviewImage(resolvedPhotoUrl)}
                                >
                                  <img
                                    src={resolvedPhotoUrl}
                                    alt="Report Photo Attachment"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      console.warn('Image failed to load:', resolvedPhotoUrl);
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <div className="position-absolute bottom-0 w-100 bg-dark bg-opacity-75 text-white text-center py-1.5 small font-semibold">
                                    <FaSearchPlus className="me-1" /> View Full Image
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attached Playable Video Card */}
                          {resolvedVideoUrl && (
                            <div className={resolvedPhotoUrl ? 'col-md-7' : 'col-md-8'}>
                              <div className="bg-white p-2.5 rounded-3 border shadow-sm h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                  <span className="badge bg-danger bg-opacity-10 text-danger fw-semibold px-2 py-1 small d-flex align-items-center gap-1">
                                    <FaVideo /> Video Attachment (Playable)
                                  </span>
                                  <span className="text-muted extra-small">HD Video Recording</span>
                                </div>

                                <div className="rounded-2 overflow-hidden bg-black shadow-sm" style={{ minHeight: 160 }}>
                                  <video
                                    src={resolvedVideoUrl}
                                    controls
                                    playsInline
                                    style={{ width: '100%', maxHeight: 180, borderRadius: 4, display: 'block' }}
                                    preload="metadata"
                                  >
                                    Your browser does not support playing HTML5 video.
                                  </video>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resolution Notes if Done / In Progress */}
                    {report.admin_notes && (
                      <div className="alert alert-success border-0 py-2 px-3 small mb-2 d-flex align-items-center gap-2">
                        <FaCommentDots className="text-success" />
                        <div>
                          <strong>Admin Notes ({report.resolved_by || 'Admin'}):</strong> {report.admin_notes}
                          {report.resolved_at && (
                            <span className="ms-2 text-muted">({new Date(report.resolved_at).toLocaleString()})</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-muted extra-small" style={{ fontSize: '0.8rem' }}>
                      Reported on:{' '}
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

      {/* Full-screen Photo Preview Modal */}
      {previewImage && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 1060 }}
          onClick={() => setPreviewImage(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-transparent border-0 text-white text-center">
              <div className="d-flex justify-content-end mb-2">
                <button
                  className="btn btn-light rounded-circle p-2"
                  onClick={() => setPreviewImage(null)}
                  title="Close Preview"
                >
                  <FaTimes size={20} />
                </button>
              </div>
              <img
                src={previewImage}
                alt="Full Attachment Preview"
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
