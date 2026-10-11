import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { useLanguage } from '../../context/LanguageContext';
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
  FaBolt,
  FaFlask,
  FaLightbulb,
  FaHashtag,
  FaCalendarAlt,
  FaWrench,
  FaExclamationCircle
} from 'react-icons/fa';

// Severity Metadata Helper for clear visual distinction
const getSeverityMeta = (severity) => {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return {
        label: 'Critical Severity',
        color: '#EF4444',
        accentBg: '#FEF2F2',
        border: '#FCA5A5',
        badgeBg: '#FEE2E2',
        badgeText: '#991B1B',
        indicator: '#DC2626',
        cardBorder: '#EF4444',
        icon: FaExclamationTriangle,
      };
    case 'high':
      return {
        label: 'High Severity',
        color: '#F97316',
        accentBg: '#FFF7ED',
        border: '#FDBA74',
        badgeBg: '#FFEDD5',
        badgeText: '#C2410C',
        indicator: '#EA580C',
        cardBorder: '#F97316',
        icon: FaExclamationCircle,
      };
    case 'medium':
      return {
        label: 'Medium Severity',
        color: '#EAB308',
        accentBg: '#FEFCE8',
        border: '#FDE047',
        badgeBg: '#FEF9C3',
        badgeText: '#854D0E',
        indicator: '#CA8A04',
        cardBorder: '#EAB308',
        icon: FaClock,
      };
    case 'low':
    default:
      return {
        label: 'Low Severity',
        color: '#10B981',
        accentBg: '#ECFDF5',
        border: '#A7F3D0',
        badgeBg: '#D1FAE5',
        badgeText: '#065F46',
        indicator: '#059669',
        cardBorder: '#10B981',
        icon: FaCheckCircle,
      };
  }
};

// Category / Problem Type Helper for distinct badges and icons
const getProblemTypeMeta = (type) => {
  const tStr = (type || '').toLowerCase();
  if (tStr.includes('equipment') || tStr.includes('pump') || tStr.includes('motor') || tStr.includes('aerator')) {
    return {
      icon: FaTools,
      bg: '#EEF2FF',
      text: '#4338CA',
      border: '#C7D2FE',
    };
  }
  if (tStr.includes('water') || tStr.includes('oxygen') || tStr.includes('ph') || tStr.includes('salinity') || tStr.includes('quality')) {
    return {
      icon: FaFlask,
      bg: '#ECFEFF',
      text: '#0E7490',
      border: '#A5F3FC',
    };
  }
  if (tStr.includes('electric') || tStr.includes('power') || tStr.includes('kuryente') || tStr.includes('generator')) {
    return {
      icon: FaBolt,
      bg: '#FFFBEB',
      text: '#B45309',
      border: '#FDE68A',
    };
  }
  if (tStr.includes('pond') || tStr.includes('dyke') || tStr.includes('net') || tStr.includes('gate') || tStr.includes('structure')) {
    return {
      icon: FaWrench,
      bg: '#F3E8FF',
      text: '#7E22CE',
      border: '#E9D5FF',
    };
  }
  return {
    icon: FaExclamationTriangle,
    bg: '#F1F5F9',
    text: '#334155',
    border: '#CBD5E1',
  };
};

// Helper to resolve media URLs to absolute Apache XAMPP server address
const resolveMediaUrl = (url) => {
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

export default function AdminReportsPage() {
  const { t } = useLanguage();
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
        confirmButtonColor: '#FC563C',
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
          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 admin-badge-critical">
            <span className="rounded-circle bg-danger" style={{ width: 6, height: 6 }} />
            {t('Critical Severity')}
          </span>
        );
      case 'High':
        return (
          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 admin-badge-high">
            <span className="rounded-circle" style={{ width: 6, height: 6, backgroundColor: '#FC563C' }} />
            {t('High Severity')}
          </span>
        );
      case 'Medium':
        return (
          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 admin-badge-medium">
            <span className="rounded-circle bg-warning" style={{ width: 6, height: 6 }} />
            {t('Medium Severity')}
          </span>
        );
      default:
        return (
          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 admin-badge-low">
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }} />
            {t('Low Severity')}
          </span>
        );
    }
  };

  // Tri-Color Curated Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5 admin-status-pending" style={{ fontSize: '0.8rem' }}>
            <FaClock size={11} /> {t('Pending Review')}
          </span>
        );
      case 'In Progress':
        return (
          <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5 admin-status-progress" style={{ fontSize: '0.8rem' }}>
            <FaTools size={11} /> {t('In Progress')}
          </span>
        );
      case 'Done':
        return (
          <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5 admin-status-done" style={{ fontSize: '0.8rem' }}>
            <FaCheckCircle size={11} /> {t('Resolved')}
          </span>
        );
      default:
        return (
          <span className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5 admin-status-default" style={{ fontSize: '0.8rem' }}>
            {t(status || 'Unknown')}
          </span>
        );
    }
  };

  return (
    <div>
      {/* 1. HERO HEADER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="hero-icon-badge shadow-xs">
            <FaTools size={20} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                {t('Equipment & Maintenance Reports')}
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)' }}
              >
                {t('Caretaker Farm Reports')}
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              {t('Review caretaker reports, attached photos, and track farm maintenance.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
          style={{ fontSize: '0.82rem', height: 40 }}
          onClick={loadReports}
        >
          <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> {t('Refresh')}
        </button>
      </div>

      {/* 2. 4 TRI-COLOR OPERATIONAL KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Total Reports */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Total Filed Reports')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaExclamationTriangle size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.total}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div className="tri-progress-bar tri-progress-bar-navy" style={{ width: '100%' }} />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('Caretaker Entries')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {t('Total Filed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: counts.pending > 0 ? 'rgba(252, 86, 60, 0.28)' : 'rgba(252, 86, 60, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Pending Review')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaClock size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {counts.pending}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.1)' }}>
                <div
                  className="tri-progress-bar tri-progress-bar-orange"
                  style={{
                    width: counts.total > 0 ? `${Math.max(15, (counts.pending / counts.total) * 100)}%` : '20%'
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('Awaiting Action')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 admin-badge-high">
                  {t('Review Needed')}
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
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('In Progress')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaTools size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#2563EB', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
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
                <span className="text-muted extra-small">{t('Active Repairs')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {t('Assigned')}
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
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Resolved / Done')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaCheckCircle size={16} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#059669', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
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
                <span className="text-muted extra-small">{t('Finished Repairs')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 admin-badge-low">
                  {t('Verified')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAINTENANCE REPORTS FEED CARD WITH INTEGRATED FILTER TOOLBAR */}
      <div className="tri-card p-4 admin-feed-wrapper">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 d-flex align-items-center gap-2">
              <FaTools className="text-primary" /> {t('Farm Maintenance & Issues List')}
            </h5>
            <p className="extra-small text-muted mb-0 mt-0.5">
              {t('List of equipment breakdowns, pond repairs, and caretaker notes')}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge rounded-pill admin-incident-count-badge px-3 py-1.5 extra-small fw-bold">
              {reports.length} {t('Reports Logged')}
            </span>
          </div>
        </div>

        {/* Integrated Filter Toolbar with Distinct Border */}
        <AdminFilterToolbar
          className="admin-reports-search-box admin-filter-card"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('Search maintenance issue, pond, caretaker...')}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onRefresh={loadReports}
          loading={loading}
          tabs={[
            { id: 'all', label: t('All Reports'), count: counts.total },
            { id: 'Pending', label: t('Pending Review'), count: counts.pending },
            { id: 'In Progress', label: t('In Progress'), count: counts.in_progress },
            { id: 'Done', label: t('Resolved / Done'), count: counts.done }
          ]}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
          metaRight={
            <>
              {t('Farm Guide:')} <strong className="text-dark">{t('Maintenance & Incident Steps')}</strong>
            </>
          }
          filterFields={[
            {
              label: t('Severity Level'),
              type: 'select',
              value: severityFilter,
              onChange: setSeverityFilter,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Severities') },
                { value: 'Critical', label: t('Critical Only') },
                { value: 'High', label: t('High Only') },
                { value: 'Medium', label: t('Medium Only') },
                { value: 'Low', label: t('Low Only') }
              ]
            },
            {
              label: t('Assigned Caretaker'),
              type: 'select',
              value: caretakerFilter,
              onChange: setCaretakerFilter,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Caretakers') },
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

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border text-primary spinner-border-sm me-2" role="status" />
            {t('Loading maintenance reports…')}
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
              <div className="text-center py-5 admin-empty-state-box rounded-4 border">
                <FaExclamationTriangle className="text-muted opacity-50 fs-2 mb-2" />
                <h6 className="fw-bold text-dark">{t('No maintenance reports found')}</h6>
                <p className="extra-small text-muted mb-0">{t('No caretaker issue entries match the selected filters.')}</p>
              </div>
            );
          }

          return (
            <div className="admin-scrollable-cards-4items" style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '6px' }}>
              <div className="d-flex flex-column gap-3.5">
                {filteredReportsList.map((report) => {
                const resolvedPhotoUrl = resolveMediaUrl(report.photo_url);
                const resolvedVideoUrl = resolveMediaUrl(report.video_url);
                const isHighlighted = checkIsHighlighted(report);
                const isPending = report.status === 'Pending';
                const isDone = report.status === 'Done';

                const sevMeta = getSeverityMeta(report.severity_level);
                const probMeta = getProblemTypeMeta(report.problem_type);
                const ProbIcon = probMeta.icon;
                const SevIcon = sevMeta.icon;

                // Status border accent color: distinct by severity when unresolved, emerald when done
                const leftAccentColor = isDone ? '#10B981' : sevMeta.color;

                return (
                  <div
                    key={report.id}
                    id={`maintenance-report-${report.id}`}
                    className={`rounded-4 p-4 border transition-all admin-incident-card ${isHighlighted ? 'highlighted-report-card' : ''}`}
                    style={{
                      borderLeft: `6px solid ${leftAccentColor}`,
                    }}
                  >
                    {/* Top Row: Badges, Title, Status & Actions */}
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
                      <div>
                        {/* Meta Tags with Clear Severity & Category Differentiation */}
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                          {/* Enhanced Severity Badge with matching color and icon */}
                          <span
                            className="badge rounded-pill px-3 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
                            style={{
                              backgroundColor: sevMeta.badgeBg,
                              color: sevMeta.badgeText,
                              border: `1px solid ${sevMeta.border}`,
                            }}
                          >
                            <span
                              className="rounded-circle"
                              style={{
                                width: 7,
                                height: 7,
                                backgroundColor: sevMeta.indicator,
                                boxShadow: report.severity_level === 'Critical' && !isDone ? `0 0 6px ${sevMeta.indicator}` : 'none',
                              }}
                            />
                            <SevIcon size={10} />
                            {t(sevMeta.label)}
                          </span>

                          {/* Problem Type Badge with Distinct Category Icon */}
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
                            style={{
                              backgroundColor: probMeta.bg,
                              color: probMeta.text,
                              border: `1px solid ${probMeta.border}`,
                            }}
                          >
                            <ProbIcon size={11} />
                            {t(report.problem_type || 'General')}
                          </span>

                          {/* Pond Location Badge */}
                          <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold admin-pond-badge d-inline-flex align-items-center gap-1">
                            <FaWater size={10} /> {report.pond_name}
                          </span>

                          {/* Caretaker Info Pill */}
                          <div className="d-inline-flex align-items-center gap-1.5 admin-caretaker-pill rounded-pill px-2.5 py-0.5">
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                              style={{ width: 18, height: 18, fontSize: '0.62rem', background: '#FC563C' }}
                            >
                              {(report.caretaker_name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <span className="extra-small fw-semibold admin-caretaker-pill-text">{report.caretaker_name}</span>
                          </div>
                        </div>

                        {/* Incident Title: Crisp, bold, high-contrast dark text */}
                        <h5 className="fw-extrabold mb-1 mt-2 text-dark fs-5 d-flex align-items-center gap-2 flex-wrap">
                          <span>{report.specific_issue}</span>
                          {report.severity_level === 'Critical' && !isDone && (
                            <span className="badge bg-danger text-white rounded-pill extra-small px-2.5 py-0.5 fw-bold text-uppercase shadow-2xs" style={{ fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                              {t('Critical Alert')}
                            </span>
                          )}
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
                            title={t('Mark this maintenance issue as Resolved')}
                          >
                            <FaCheckCircle size={11} className="me-1" /> {t('Mark Done')}
                          </button>
                        )}

                        {report.status === 'Pending' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs extra-small fw-bold"
                            onClick={() => handleUpdateStatus(report, 'In Progress')}
                            title={t('Set status to In Progress')}
                          >
                            <FaTools size={11} className="me-1" /> {t('In Progress')}
                          </button>
                        )}

                        {report.status === 'Done' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs extra-small fw-bold"
                            onClick={() => handleUpdateStatus(report, 'Pending')}
                            title={t('Reopen Report')}
                          >
                            <FaClock size={11} className="me-1" /> {t('Reopen')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-action-squircle action-delete"
                          onClick={() => handleDeleteReport(report)}
                          title={t('Delete Report')}
                        >
                          <FaTrashAlt size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Description & Suggested Action Box: Crisp modern card */}
                    <div className="p-3.5 rounded-3 mb-3 admin-incident-desc-box border shadow-2xs">
                      <div className="d-flex align-items-center gap-2 mb-1.5">
                        <FaCommentDots className="text-muted" size={13} />
                        <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Issue Description & Notes')}</span>
                      </div>
                      <p className="admin-incident-desc-text mb-0 fw-medium" style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>
                        {report.description}
                      </p>
                      {report.suggested_action && (
                        <div className="mt-3 pt-2.5 border-top d-flex align-items-center gap-2.5 extra-small admin-incident-suggested-row flex-wrap">
                          <span className="badge admin-suggested-action-badge px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1">
                            <FaLightbulb size={11} /> {t('Suggested Action')}
                          </span>
                          <span className="admin-suggested-action-text fw-semibold">
                            "{report.suggested_action}"
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Attached Media Evidence Gallery */}
                    {(resolvedPhotoUrl || resolvedVideoUrl) && (
                      <div className="p-3.5 rounded-3 mb-3 admin-media-gallery-box">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold text-dark mb-0 extra-small text-uppercase tracking-wider d-flex align-items-center gap-1.5">
                            <FaCamera className="text-primary" /> {t('Attached Photos & Videos')}
                          </h6>
                          <span className="text-muted extra-small">{t('Pond Notes & Photos')}</span>
                        </div>

                        <div className="row g-2.5 align-items-stretch">
                          {/* Attached Photo Evidence */}
                          {resolvedPhotoUrl && (
                            <div className={resolvedVideoUrl ? 'col-md-5' : 'col-md-6'}>
                              <div className="admin-media-card p-2 rounded-3 border shadow-xs h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                  <span
                                    className="badge px-2 py-0.5 extra-small fw-semibold d-flex align-items-center gap-1"
                                    style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C' }}
                                  >
                                    <FaImage size={10} /> {t('Photo Evidence')}
                                  </span>
                                  <span className="text-muted extra-small">{t('Click to zoom')}</span>
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
                                    <FaSearchPlus className="me-1" size={10} /> {t('View Full Image')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attached Playable Video Evidence */}
                          {resolvedVideoUrl && (
                            <div className={resolvedPhotoUrl ? 'col-md-7' : 'col-md-8'}>
                              <div className="admin-media-card p-2 rounded-3 border shadow-xs h-100 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center justify-content-between mb-1.5">
                                  <span className="badge px-2 py-0.5 extra-small fw-semibold d-flex align-items-center gap-1 admin-video-badge">
                                    <FaVideo size={10} /> {t('Video Recording')}
                                  </span>
                                  <span className="text-muted extra-small">{t('Playable HD')}</span>
                                </div>

                                <div className="rounded-2 overflow-hidden bg-black shadow-xs" style={{ minHeight: 150 }}>
                                  <video
                                    src={resolvedVideoUrl}
                                    controls
                                    playsInline
                                    style={{ width: '100%', maxHeight: 165, borderRadius: 4, display: 'block' }}
                                    preload="metadata"
                                  >
                                    {t('Your browser does not support playing HTML5 video.')}
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
                      <div className="p-3 rounded-3 mb-3 d-flex align-items-start gap-2 admin-resolution-box" style={{ fontSize: '0.84rem' }}>
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-success flex-shrink-0 mt-0.5"
                          style={{ width: 24, height: 24, backgroundColor: 'rgba(4, 120, 87, 0.12)' }}
                        >
                          <FaCommentDots size={12} />
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                            <strong className="text-success">{t('Admin Resolution Notes')} ({report.resolved_by || 'Admin'}):</strong>
                            {report.resolved_at && (
                              <span className="extra-small text-muted">
                                {new Date(report.resolved_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                          <p className="admin-resolution-notes-text mb-0 mt-0.5 extra-small">{report.admin_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Footer: Date Stamp */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap pt-2.5 mt-2.5 border-top text-muted extra-small admin-incident-footer">
                      <span className="fw-bold d-inline-flex align-items-center gap-1 text-dark">
                        <FaHashtag size={11} className="text-muted" /> {t('Report ID #')}{report.id}
                      </span>
                      <span className="d-inline-flex align-items-center gap-1.5">
                        <FaCalendarAlt size={11} className="text-muted" />
                        {t('Filed on:')}{' '}
                        <strong className="text-dark ms-0.5">
                          {new Date(report.created_at || Date.now()).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>

      {/* Full-screen Photo Preview Modal */}
      {previewImage && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(252, 86, 60, 0.75)', backdropFilter: 'blur(6px)', zIndex: 1060 }}
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
