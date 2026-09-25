import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
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
        title: 'Mark as Resolved?',
        text: `Mark "${report.specific_issue}" for ${report.pond_name} as Done.`,
        input: 'textarea',
        inputLabel: 'Resolution Notes / Actions Taken (Optional):',
        inputPlaceholder: 'e.g. Aerator motor repaired and tested by maintenance team.',
        showCancelButton: true,
        confirmButtonColor: '#0B2C5F',
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
      confirmButtonColor: '#DC2626',
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

  // Tri-Color Curated Severity Badge
  const renderSeverityBadge = (severity) => {
    switch (severity) {
      case 'Critical':
        return (
          <span
            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
            style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
          >
            <span className="rounded-circle bg-danger" style={{ width: 6, height: 6 }} />
            Critical Severity
          </span>
        );
      case 'High':
        return (
          <span
            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
            style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.3)' }}
          >
            <span className="rounded-circle" style={{ width: 6, height: 6, backgroundColor: '#EA580C' }} />
            High Severity
          </span>
        );
      case 'Medium':
        return (
          <span
            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
            style={{ backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}
          >
            <span className="rounded-circle bg-warning" style={{ width: 6, height: 6 }} />
            Medium Severity
          </span>
        );
      default:
        return (
          <span
            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
            style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}
          >
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }} />
            Low Severity
          </span>
        );
    }
  };

  // Tri-Color Curated Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span
            className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
            style={{
              backgroundColor: '#FFF7ED',
              color: '#EA580C',
              border: '1px solid rgba(234, 88, 12, 0.3)',
              fontSize: '0.8rem'
            }}
          >
            <FaClock size={11} /> Pending Review
          </span>
        );
      case 'In Progress':
        return (
          <span
            className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
            style={{
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              fontSize: '0.8rem'
            }}
          >
            <FaTools size={11} /> In Progress
          </span>
        );
      case 'Done':
        return (
          <span
            className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0',
              fontSize: '0.8rem'
            }}
          >
            <FaCheckCircle size={11} /> Resolved
          </span>
        );
      default:
        return (
          <span
            className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
            style={{
              backgroundColor: '#F1F5F9',
              color: '#475569',
              border: '1px solid #CBD5E1',
              fontSize: '0.8rem'
            }}
          >
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <div>
      {/* 🌟 1. HERO HEADER */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-3 d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              background: 'linear-gradient(135deg, rgba(11, 44, 95, 0.08) 0%, rgba(30, 58, 138, 0.14) 100%)',
              color: '#0B2C5F',
              border: '1px solid rgba(11, 44, 95, 0.14)'
            }}
          >
            <FaTools size={20} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Equipment &amp; Maintenance Reports
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
              >
                ● Field Audit Stream
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              Review incoming caretaker requests, attached telemetry imagery, and track facility work orders.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
          style={{ fontSize: '0.82rem', height: 40 }}
          onClick={loadReports}
        >
          <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> Refresh Reports
        </button>
      </div>

      {/* 🌟 2. 4 TRI-COLOR OPERATIONAL KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Total Reports */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Total Filed Reports</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaExclamationTriangle size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.total}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div className="tri-progress-bar tri-progress-bar-navy" style={{ width: '100%' }} />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Caretaker Entries</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  Total Filed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: counts.pending > 0 ? 'rgba(234, 88, 12, 0.28)' : 'rgba(11, 44, 95, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Pending Review</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaClock size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: counts.pending > 0 ? '#EA580C' : '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.pending}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar tri-progress-bar-orange"
                  style={{
                    width: counts.total > 0 ? `${Math.max(15, (counts.pending / counts.total) * 100)}%` : '20%'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Awaiting Action</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  Review Needed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">In Progress</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaTools size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.in_progress}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar tri-progress-bar-navy"
                  style={{
                    width: counts.total > 0 ? `${Math.max(15, (counts.in_progress / counts.total) * 100)}%` : '15%'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Active Work Orders</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  Assigned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Done / Resolved */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Resolved / Done</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaCheckCircle size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.done}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: counts.total > 0 ? `${Math.max(15, (counts.done / counts.total) * 100)}%` : '30%',
                    background: 'linear-gradient(90deg, #10B981, #059669)'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Closed Requests</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. ADMIN FILTER TOOLBAR */}
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search maintenance issue, pond basin, caretaker..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onRefresh={loadReports}
        loading={loading}
        tabs={[
          { id: 'all', label: 'All Reports', count: counts.total },
          { id: 'Pending', label: 'Pending Review', count: counts.pending },
          { id: 'In Progress', label: 'In Progress', count: counts.in_progress },
          { id: 'Done', label: 'Resolved / Done', count: counts.done }
        ]}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        metaRight={
          <>
            Facility SOP: <strong className="text-dark">Maintenance &amp; Incident Protocols</strong>
          </>
        }
        filterFields={[
          {
            label: 'Severity Level',
            type: 'select',
            value: severityFilter,
            onChange: setSeverityFilter,
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: 'All Severities' },
              { value: 'Critical', label: 'Critical Only' },
              { value: 'High', label: 'High Only' },
              { value: 'Medium', label: 'Medium Only' },
              { value: 'Low', label: 'Low Only' }
            ]
          },
          {
            label: 'Assigned Caretaker',
            type: 'select',
            value: caretakerFilter,
            onChange: setCaretakerFilter,
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: 'All Caretakers' },
              ...caretakers.map((c) => ({ value: String(c.id), label: c.full_name }))
            ]
          }
        ]}
        onResetFilters={() => {
          setSearchQuery('');
          setCurrentTab('all');
          setSeverityFilter('all');
          setCaretakerFilter('all');
        }}
      />

      {/* 🌟 4. MAINTENANCE REPORTS FEED CARD */}
      <div className="tri-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 d-flex align-items-center gap-2">
              <FaTools className="text-primary" /> Maintenance Incident Stream
            </h5>
            <p className="extra-small text-muted mb-0 mt-0.5">
              Chronological log of equipment breakdowns, facility repairs, and caretaker work tickets
            </p>
          </div>
          <span className="badge rounded-pill bg-light text-secondary border px-3 py-1.5 extra-small fw-bold">
            {reports.length} Reports Logged
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border text-primary spinner-border-sm me-2" role="status" />
            Loading maintenance reports…
          </div>
        ) : (() => {
          const filteredReportsList = reports.filter((r) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              (r.specific_issue || '').toLowerCase().includes(q) ||
              (r.pond_name || '').toLowerCase().includes(q) ||
              (r.recorded_by_name || r.caretaker_name || '').toLowerCase().includes(q) ||
              (r.problem_type || '').toLowerCase().includes(q)
            );
          });

          if (filteredReportsList.length === 0) {
            return (
              <div className="text-center py-5 bg-light rounded-4 border">
                <FaExclamationTriangle className="text-muted opacity-50 fs-2 mb-2" />
                <h6 className="fw-bold text-dark">No maintenance reports found</h6>
                <p className="extra-small text-muted mb-0">No caretaker issue entries match the selected filters.</p>
              </div>
            );
          }

          return (
            <div className="d-flex flex-column gap-3.5">
              {filteredReportsList.map((report) => {
                const resolvedPhotoUrl = resolveMediaUrl(report.photo_url);
                const resolvedVideoUrl = resolveMediaUrl(report.video_url);
                const isHighlighted = checkIsHighlighted(report);
                const isPending = report.status === 'Pending';
                const isDone = report.status === 'Done';

                // Status border accent color
                const leftAccentColor = isPending ? '#EA580C' : isDone ? '#10B981' : '#0B2C5F';

                return (
                  <div
                    key={report.id}
                    id={`maintenance-report-${report.id}`}
                    className={`rounded-3 p-3.5 border transition-all ${isHighlighted ? 'highlighted-report-card' : ''}`}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderLeft: `4px solid ${leftAccentColor}`,
                      boxShadow: '0 1px 3px rgba(11, 44, 95, 0.04), 0 4px 12px -2px rgba(11, 44, 95, 0.03)'
                    }}
                  >
                    {/* Top Row: Badges, Title, Status & Actions */}
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2.5">
                      <div>
                        {/* Meta Tags */}
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1.5">
                          {renderSeverityBadge(report.severity_level)}
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small fw-semibold"
                            style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
                          >
                            {report.problem_type}
                          </span>
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                            style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
                          >
                            <FaWater className="me-1" /> {report.pond_name}
                          </span>
                          <div className="d-inline-flex align-items-center gap-1.5 bg-light border rounded-pill px-2 py-0.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                              style={{ width: 18, height: 18, fontSize: '0.62rem', background: '#0B2C5F' }}
                            >
                              {(report.caretaker_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <span className="extra-small text-dark fw-semibold">{report.caretaker_name}</span>
                          </div>
                        </div>

                        {/* Incident Title */}
                        <h5 className="fw-bold mb-0" style={{ color: '#0B2C5F', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                          {report.specific_issue}
                        </h5>
                      </div>

                      {/* Right Cluster: Status Badge & Tri-Color Action Buttons */}
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        {renderStatusBadge(report.status)}

                        {/* Actions */}
                        {report.status !== 'Done' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-navy px-3 py-1.5 shadow-xs extra-small fw-bold"
                            onClick={() => handleUpdateStatus(report, 'Done')}
                            title="Mark this maintenance issue as Resolved"
                          >
                            <FaCheckCircle size={11} className="me-1" /> Mark Done
                          </button>
                        )}

                        {report.status === 'Pending' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs extra-small fw-bold"
                            onClick={() => handleUpdateStatus(report, 'In Progress')}
                            title="Set status to In Progress"
                          >
                            <FaTools size={11} className="me-1" /> In Progress
                          </button>
                        )}

                        {report.status === 'Done' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs extra-small fw-bold"
                            onClick={() => handleUpdateStatus(report, 'Pending')}
                            title="Reopen Report"
                          >
                            <FaClock size={11} className="me-1" /> Reopen
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-action-squircle action-delete"
                          onClick={() => handleDeleteReport(report)}
                          title="Delete Report"
                        >
                          <FaTrashAlt size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Description & Suggested Action Box */}
                    <div
                      className="p-3 rounded-3 mb-2.5"
                      style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.07)' }}
                    >
                      <p className="text-dark mb-0" style={{ fontSize: '0.86rem', lineHeight: '1.55' }}>
                        {report.description}
                      </p>
                      {report.suggested_action && (
                        <div
                          className="mt-2 pt-2 border-top d-flex align-items-baseline gap-1.5 extra-small"
                          style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}
                        >
                          <span className="badge bg-light text-primary border extra-small fw-semibold">Suggested Action</span>
                          <span className="text-secondary fst-italic">"{report.suggested_action}"</span>
                        </div>
                      )}
                    </div>

                    {/* Attached Media Evidence Gallery */}
                    {(resolvedPhotoUrl || resolvedVideoUrl) && (
                      <div
                        className="p-3 rounded-3 mb-2.5"
                        style={{ backgroundColor: 'rgba(11, 44, 95, 0.02)', border: '1px solid rgba(11, 44, 95, 0.08)' }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold text-dark mb-0 extra-small text-uppercase tracking-wider d-flex align-items-center gap-1.5">
                            <FaCamera className="text-primary" /> Attached Media Evidence
                          </h6>
                          <span className="text-muted extra-small">Field Telemetry</span>
                        </div>

                        <div className="row g-2.5 align-items-stretch">
                          {/* Attached Photo Evidence */}
                          {resolvedPhotoUrl && (
                            <div className={resolvedVideoUrl ? 'col-md-5' : 'col-md-6'}>
                              <div className="bg-white p-2 rounded-3 border shadow-xs h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                  <span
                                    className="badge px-2 py-0.5 extra-small fw-semibold d-flex align-items-center gap-1"
                                    style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}
                                  >
                                    <FaImage size={10} /> Photo Evidence
                                  </span>
                                  <span className="text-muted extra-small">Click to zoom</span>
                                </div>

                                <div
                                  className="position-relative rounded-2 overflow-hidden bg-dark d-flex align-items-center justify-content-center border"
                                  style={{ height: 150, cursor: 'pointer' }}
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
                                  <div className="position-absolute bottom-0 w-100 bg-dark bg-opacity-75 text-white text-center py-1 extra-small fw-semibold">
                                    <FaSearchPlus className="me-1" size={10} /> View Full Image
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attached Playable Video Evidence */}
                          {resolvedVideoUrl && (
                            <div className={resolvedPhotoUrl ? 'col-md-7' : 'col-md-8'}>
                              <div className="bg-white p-2 rounded-3 border shadow-xs h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                  <span
                                    className="badge px-2 py-0.5 extra-small fw-semibold d-flex align-items-center gap-1"
                                    style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}
                                  >
                                    <FaVideo size={10} /> Video Recording
                                  </span>
                                  <span className="text-muted extra-small">Playable HD</span>
                                </div>

                                <div className="rounded-2 overflow-hidden bg-black shadow-xs" style={{ minHeight: 150 }}>
                                  <video
                                    src={resolvedVideoUrl}
                                    controls
                                    playsInline
                                    style={{ width: '100%', maxHeight: 165, borderRadius: 4, display: 'block' }}
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

                    {/* Resolution Notes Callout */}
                    {report.admin_notes && (
                      <div
                        className="p-2.5 rounded-3 mb-2 d-flex align-items-start gap-2"
                        style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', fontSize: '0.82rem' }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0 mt-0.5"
                          style={{ width: 22, height: 22, backgroundColor: 'rgba(4, 120, 87, 0.1)' }}
                        >
                          <FaCommentDots size={11} />
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                            <strong className="text-success">Admin Resolution Notes ({report.resolved_by || 'Admin'}):</strong>
                            {report.resolved_at && (
                              <span className="extra-small text-muted">
                                {new Date(report.resolved_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                          <p className="text-dark mb-0 mt-0.5 extra-small">{report.admin_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Footer: Date Stamp */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap pt-1 text-muted extra-small">
                      <span>Report ID #{report.id}</span>
                      <span>
                        Filed on:{' '}
                        {new Date(report.created_at || Date.now()).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Full-screen Photo Preview Modal */}
      {previewImage && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(11, 44, 95, 0.75)', backdropFilter: 'blur(6px)', zIndex: 1060 }}
          onClick={() => setPreviewImage(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content bg-transparent border-0 text-white text-center">
              <div className="d-flex justify-content-end mb-2">
                <button
                  type="button"
                  className="btn btn-light rounded-circle p-2 shadow"
                  onClick={() => setPreviewImage(null)}
                  title="Close Preview"
                >
                  <FaTimes size={18} />
                </button>
              </div>
              <img
                src={previewImage}
                alt="Full Attachment Preview"
                className="img-fluid rounded-4 shadow-lg border"
                style={{ maxHeight: '80vh', objectFit: 'contain', margin: '0 auto', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
