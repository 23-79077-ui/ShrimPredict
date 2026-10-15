import { useEffect, useState } from 'react';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import {
  FaExclamationTriangle,
  FaExclamationCircle,
  FaCheckCircle,
  FaClock,
  FaSearch,
  FaFilter,
  FaFileCsv,
  FaSync,
  FaEye,
  FaTrashAlt,
  FaUser,
  FaWater,
  FaBug,
  FaFish,
  FaUtensils,
  FaCamera,
  FaUserTie,
  FaShieldAlt,
  FaLightbulb,
  FaUserCheck,
  FaArrowRight,
  FaChartLine,
  FaBell
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';
import { useLanguage } from '../../context/LanguageContext';

// Helper to format category icon & color
function getCategoryMeta(category) {
  switch (category) {
    case 'Disease':
      return { icon: <FaBug className="text-danger me-1.5" />, badgeClass: 'bg-danger bg-opacity-10 text-danger border-danger border-opacity-25' };
    case 'Harvest':
      return { icon: <FaFish className="text-warning text-dark me-1.5" />, badgeClass: 'bg-warning bg-opacity-10 text-dark border-warning border-opacity-50' };
    case 'Feeding':
      return { icon: <FaUtensils className="text-info me-1.5" />, badgeClass: 'bg-info bg-opacity-10 text-info border-info border-opacity-25' };
    case 'Image Upload':
      return { icon: <FaCamera className="text-purple me-1.5" style={{ color: '#8b5cf6' }} />, badgeClass: 'bg-purple bg-opacity-10 text-purple border-purple border-opacity-25' };
    case 'Caretaker Activity':
      return { icon: <FaUserTie className="text-secondary me-1.5" />, badgeClass: 'bg-secondary bg-opacity-10 text-secondary border-secondary border-opacity-25' };
    default:
      return { icon: <FaShieldAlt className="text-primary me-1.5" />, badgeClass: 'bg-primary bg-opacity-10 text-primary border-primary border-opacity-25' };
  }
}

// Helper to format severity badge cleanly
function getSeverityBadge(severity, t = (k) => k) {
  switch (severity) {
    case 'Critical':
      return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1.5 rounded-pill extra-small fw-bold">{t('Critical Alert')}</span>;
    case 'High':
      return <span className="badge bg-warning bg-opacity-15 text-dark border border-warning border-opacity-50 px-3 py-1.5 rounded-pill extra-small fw-bold">{t('High Risk')}</span>;
    case 'Medium':
      return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-30 px-3 py-1.5 rounded-pill extra-small fw-bold">{t('Warning')}</span>;
    default:
      return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-3 py-1.5 rounded-pill extra-small fw-bold">{t('Low Priority')}</span>;
  }
}

// Helper to format status badge
function getStatusBadge(status, t = (k) => k) {
  switch (status) {
    case 'Resolved':
      return (
        <span className="badge px-2.5 py-1.5 rounded-pill extra-small fw-bold admin-badge-resolved d-inline-flex align-items-center gap-1">
          <FaCheckCircle size={10} /> {t('Resolved')}
        </span>
      );
    case 'In Progress':
      return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2.5 py-1.5 rounded-pill extra-small fw-bold">{t('In Progress')}</span>;
    default:
      return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 rounded-pill extra-small fw-bold">{t('Pending Action')}</span>;
  }
}

export default function AlertsPage() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [summary, setSummary] = useState({
    critical_alerts: 2,
    warnings: 4,
    resolved: 2,
    pending: 4
  });

  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [pondFilter, setPondFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');

  // Modal States
  const [selectedAlert, setSelectedAlert] = useState(null); // View Details Modal
  const [assigningAlert, setAssigningAlert] = useState(null); // Assign Follow-up Modal
  const [followupForm, setFollowupForm] = useState({
    assigned_caretaker_name: '',
    follow_up_notes: ''
  });

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/alerts.php');
      const data = res.data;
      if (data && data.success) {
        setAlerts(safeArray(data.alerts));
        setCaretakers(safeArray(data.caretakers));
        setPonds(safeArray(data.ponds));
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  // Filter Logic
  const filteredAlerts = alerts.filter((a) => {
    // 1. Search Query (Title, Message, Pond, Caretaker)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (a.title || '').toLowerCase().includes(q);
      const msgMatch = (a.message || '').toLowerCase().includes(q);
      const pondMatch = (a.affected_pond_name || '').toLowerCase().includes(q);
      const caretakerMatch = (a.assigned_caretaker_name || '').toLowerCase().includes(q);
      if (!titleMatch && !msgMatch && !pondMatch && !caretakerMatch) return false;
    }

    // 2. Severity Filter
    if (severityFilter !== 'All') {
      if (a.severity !== severityFilter) return false;
    }

    // 3. Category / Alert Type Filter
    if (categoryFilter !== 'All') {
      if (a.category !== categoryFilter) return false;
    }

    // 4. Pond Filter
    if (pondFilter !== 'All') {
      if (a.affected_pond_name !== pondFilter) return false;
    }

    // 5. Status Filter
    if (statusFilter !== 'All') {
      if (a.status !== statusFilter) return false;
    }

    // 6. Date Filter
    if (dateFilter !== 'All') {
      const createdDate = new Date(a.created_at || Date.now());
      const now = new Date();
      if (dateFilter === 'Today') {
        if (createdDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'This Week') {
        const diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
      }
    }

    return true;
  });

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredAlerts.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No alert data available to export.' });
      return;
    }

    const headers = [
      'Alert Title',
      'Severity',
      'Category',
      'Affected Pond',
      'Assigned Caretaker',
      'Confidence (%)',
      'Status',
      'Date & Time',
      'Recommended Action',
      'Follow-up Notes'
    ];

    const rows = filteredAlerts.map((a) => [
      `"${a.title || ''}"`,
      `"${a.severity || ''}"`,
      `"${a.category || ''}"`,
      `"${a.affected_pond_name || ''}"`,
      `"${a.assigned_caretaker_name || ''}"`,
      a.confidence_pct || 0,
      `"${a.status || ''}"`,
      `"${a.formatted_date || ''}"`,
      `"${(a.recommended_action || '').replace(/"/g, '""')}"`,
      `"${(a.follow_up_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ShrimpPredict_Alerts_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: 'success',
      title: 'CSV Report Exported',
      text: 'Alerts Action Center records downloaded successfully.',
      timer: 1800,
      showConfirmButton: false
    });
  };

  // Mark Alert as Resolved
  const handleResolveAlert = (alert) => {
    if (alert.status === 'Resolved') return;

    Swal.fire({
      title: `Resolve Alert "${alert.title}"?`,
      text: `Mark this ${alert.severity} alert for ${alert.affected_pond_name} as Resolved?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#627591',
      confirmButtonText: 'Yes, Mark Resolved'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/alerts.php', {
            action: 'update_status',
            alert_id: alert.id,
            status: 'Resolved'
          });

          if (res.data && res.data.success) {
            Swal.fire({ icon: 'success', title: 'Alert Resolved', text: 'Alert status updated to Resolved.', timer: 1800, showConfirmButton: false });
            if (selectedAlert && selectedAlert.id === alert.id) {
              setSelectedAlert({ ...selectedAlert, status: 'Resolved' });
            }
            loadAlerts();
          }
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update alert status.' });
        }
      }
    });
  };

  // Open Assign Follow-up Modal
  const openAssignModal = (alert) => {
    setAssigningAlert(alert);
    setFollowupForm({
      assigned_caretaker_name: alert.assigned_caretaker_name || caretakers[0] || 'Maria Santos',
      follow_up_notes: alert.follow_up_notes || ''
    });
  };

  // Save Assign Follow-up
  const handleSaveFollowup = async (e) => {
    e.preventDefault();
    if (!assigningAlert) return;

    try {
      const res = await api.post('/alerts.php', {
        action: 'assign_followup',
        alert_id: assigningAlert.id,
        assigned_caretaker_name: followupForm.assigned_caretaker_name,
        follow_up_notes: followupForm.follow_up_notes
      });

      if (res.data && res.data.success) {
        Swal.fire({ icon: 'success', title: 'Follow-up Assigned', text: `Assigned to ${followupForm.assigned_caretaker_name}. Status changed to In Progress.`, timer: 1800, showConfirmButton: false });
        setAssigningAlert(null);
        loadAlerts();
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to assign follow-up.' });
    }
  };

  // Delete Alert Handler
  const handleDeleteAlert = (alert) => {
    Swal.fire({
      title: `Delete Alert "${alert.title}"?`,
      text: 'This action will permanently remove this alert record from the Action Center queue.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#627591',
      confirmButtonText: 'Yes, Delete'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/alerts.php', {
            action: 'delete_alert',
            alert_id: alert.id
          });

          if (res.data && res.data.success) {
            Swal.fire({ icon: 'success', title: 'Alert Deleted', text: 'Alert record removed.', timer: 1800, showConfirmButton: false });
            if (selectedAlert && selectedAlert.id === alert.id) {
              setSelectedAlert(null);
            }
            loadAlerts();
          }
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Delete Error', text: 'Failed to delete alert.' });
        }
      }
    });
  };

  return (
    <div className="pb-5">
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Alerts & Biosecurity Early Warning')}
          </h3>
          <span
            className="badge rounded-pill d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
            style={{
              backgroundColor: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <span className="pulse-dot-green" />
            {t('• Incident Triage')}
          </span>
        </div>

        {/* Action Controls: Refresh, Export CSV */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-2 shadow-2xs hover-shadow"
            onClick={loadAlerts}
            disabled={loading}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} /> {t('Refresh')}
          </button>

          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3.5 py-2 shadow-2xs hover-shadow"
            onClick={handleExportCSV}
          >
            <FaFileCsv size={12} className="text-secondary" /> {t('Export CSV')}
          </button>
        </div>
      </div>

      {/* 2. 4 TOP OPERATIONAL KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Critical Alerts */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Critical Alerts')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <FaExclamationTriangle size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: (summary.critical_alerts || 0) > 0 ? '#DC2626' : '#172A39', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {summary.critical_alerts || 0}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Immediate Intervention')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>
                  {t('Action Needed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Active Warnings')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FFF7ED', color: '#FC563C' }}>
                  <FaBell size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {summary.warnings || 0}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('High & Medium')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', fontWeight: 600 }}>
                  {t('Watch List')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Resolved Issues')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#ECFDF5', color: '#059669' }}>
                  <FaCheckCircle size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {summary.resolved || 0}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Addressed Incidents')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 600 }}>
                  {t('Closed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Pending Queue')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaClock size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {summary.pending || 0}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Awaiting Caretaker')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('Active Queue')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. UNIFIED CONTROL & FILTER TOOLBAR */}
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('Search Alert Title, Message, Pond, or Caretaker...')}
        showFilters={true}
        onExportCSV={handleExportCSV}
        onRefresh={loadAlerts}
        loading={loading}
        tabs={[
          { id: 'All', label: t('All Severities'), count: alerts.length },
          { id: 'Critical', label: t('Critical'), count: summary.critical_alerts || 0 },
          { id: 'High', label: t('High Risk') },
          { id: 'Medium', label: t('Warning'), count: summary.warnings || 0 },
          { id: 'Low', label: t('Low Priority') }
        ]}
        activeTab={severityFilter}
        onTabChange={setSeverityFilter}
        metaRight={
          <>
            {t('Action Center Queue:')} <strong>{t('Live Pond Alerts')}</strong>
          </>
        }
        filterFields={[
          {
            label: t('Alert Type'),
            type: 'select',
            value: categoryFilter,
            onChange: setCategoryFilter,
            colClass: 'col-12 col-md-3',
            options: [
              { value: 'All', label: t('All Alert Types') },
              { value: 'Disease', label: t('Disease Alert') },
              { value: 'Harvest', label: t('Harvest Alert') },
              { value: 'Feeding', label: t('Feeding Alert') },
              { value: 'Image Upload', label: t('Image Upload') },
              { value: 'Caretaker Activity', label: t('Caretaker Activity') },
              { value: 'Pond Status', label: t('Pond Status') }
            ]
          },
          {
            label: t('Pond Select'),
            type: 'select',
            value: pondFilter,
            onChange: setPondFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'All', label: t('All Ponds') },
              ...ponds.map((p) => {
                const name = typeof p === 'string' ? p : (p?.pond_name || p?.name || '');
                return { value: name, label: name };
              }).filter((item) => Boolean(item.value))
            ]
          },
          {
            label: t('Status'),
            type: 'select',
            value: statusFilter,
            onChange: setStatusFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'All', label: t('All Statuses') },
              { value: 'Pending', label: t('Pending') },
              { value: 'In Progress', label: t('In Progress') },
              { value: 'Resolved', label: t('Resolved') }
            ]
          },
          {
            label: t('Date Window'),
            type: 'select',
            value: dateFilter,
            onChange: setDateFilter,
            colClass: 'col-12 col-md-3',
            options: [
              { value: 'All', label: t('All Time') },
              { value: 'Today', label: t('Today') },
              { value: 'This Week', label: t('This Week') }
            ]
          }
        ]}
        onResetFilters={() => {
          setSearchQuery('');
          setSeverityFilter('All');
          setCategoryFilter('All');
          setPondFilter('All');
          setStatusFilter('All');
          setDateFilter('All');
        }}
      />

      {/* 3. ALERTS ACTION CENTER CARDS GRID (3-COLUMN ROW LAYOUT) */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FaExclamationTriangle style={{ color: '#FC563C' }} /> {t('Alerts Action Center')}
            </h5>
            <p className="text-secondary mb-0 small">{t('Real-time critical events requiring immediate caretaker action and monitoring.')}</p>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge rounded-pill px-3 py-1.5 extra-small border" style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
              {t('Showing')} {filteredAlerts.length} {t('of')} {alerts.length} {t('Alerts')}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2">{t('Loading Alerts Action Center...')}</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-5 text-muted border rounded-4 bg-light">
            <FaCheckCircle size={36} className="text-success mb-2 opacity-50" />
            <h6 className="fw-bold mb-1">{t('No Active Alerts Found')}</h6>
            <p className="small mb-0">{t('All farm alerts match your clean criteria.')}</p>
          </div>
        ) : (
          /* RESPONSIVE SPACIOUS GRID - CAPPED TO SHOW ~3-4 DATA CARDS WITH IN-PLACE SCROLLING */
          <div className="admin-scrollable-cards-4items" style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
            <div className="row g-4">
              {filteredAlerts.map((alert) => {
                const catMeta = getCategoryMeta(alert.category);
                const isResolved = alert.status === 'Resolved';

                return (
                  <div key={alert.id} className="col-12 col-md-6 col-lg-6 col-xxl-4">
                    <div
                      className={`alert-action-card p-4 h-100 d-flex flex-column justify-content-between ${
                        alert.severity === 'Critical' ? 'critical' : ''
                      }`}
                      style={{ minHeight: 320 }}
                    >
                      <div>
                        {/* Top Header Row: Severity Pill + Category Tag + Status Badge */}
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom border-light">
                          <div className="d-flex align-items-center gap-1.5 flex-wrap">
                            {getSeverityBadge(alert.severity, t)}
                          </div>
                          <div className="d-flex align-items-center gap-1.5 flex-wrap ms-auto">
                            <span className={`badge border ${catMeta.badgeClass} px-2.5 py-1 rounded-pill extra-small font-mono fw-semibold`}>
                              {catMeta.icon} {t(alert.category)}
                            </span>
                            {getStatusBadge(alert.status, t)}
                          </div>
                        </div>

                        {/* Alert Title & Pond Pill Row */}
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                          <h5 className="fw-bold text-dark mb-0 fs-6 flex-grow-1" style={{ lineHeight: 1.3 }}>{t(alert.title)}</h5>
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-semibold flex-shrink-0">
                            <FaWater className="me-1" size={10} /> {alert.affected_pond_name}
                          </span>
                        </div>

                        {/* Short Description */}
                        <p className="extra-small text-muted mb-3" style={{ lineHeight: 1.5 }}>
                          {t(alert.message)}
                        </p>

                        {/* Caretaker & Recommended Action Box (Clean Un-overlapped Spacing) */}
                        <div className="p-3 rounded-4 alert-action-inner-box mb-3">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 extra-small text-muted mb-2 pb-2 border-bottom">
                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                              <FaUser className="text-primary flex-shrink-0" size={12} />
                              <span className="me-1">{t('Caretaker:')}</span>
                              <strong className="text-dark fw-bold">{alert.assigned_caretaker_name}</strong>
                            </div>
                            <div className="d-flex align-items-center gap-1 extra-small text-muted ms-auto">
                              <FaClock size={11} className="text-secondary flex-shrink-0" />
                              <span>{t(alert.time_ago || 'Today')}</span>
                            </div>
                          </div>

                          {/* Action Protocol text */}
                          {alert.recommended_action && (
                            <div className="extra-small text-dark fw-semibold d-flex align-items-start gap-2 pt-1" style={{ lineHeight: 1.4 }}>
                              <FaLightbulb className="text-warning flex-shrink-0 mt-0.5" size={13} />
                              <span>{t(alert.recommended_action)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Action Buttons Row (Un-squeezed Clean Actions) */}
                      <div className="pt-3 border-top mt-auto">
                        <div className="d-flex align-items-center justify-content-between gap-1.5 flex-wrap">
                          {/* View Details */}
                          <button
                            type="button"
                            className="btn btn-sm btn-alert-details px-2 py-1.5 rounded-3 d-flex align-items-center justify-content-center gap-1 extra-small fw-semibold flex-grow-1"
                            onClick={() => setSelectedAlert(alert)}
                          >
                            <FaEye size={11} /> {t('Details')}
                          </button>

                          {/* Resolve Button */}
                          <button
                            type="button"
                            className={`btn btn-sm px-2 py-1.5 rounded-3 d-flex align-items-center justify-content-center gap-1 extra-small fw-bold flex-grow-1 ${
                              isResolved ? 'admin-btn-resolved-state' : 'btn-outline-success'
                            }`}
                            disabled={isResolved}
                            onClick={() => handleResolveAlert(alert)}
                          >
                            <FaCheckCircle size={11} /> {isResolved ? t('Resolved') : t('Resolve')}
                          </button>

                          {/* Assign Follow-up */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary px-2 py-1.5 rounded-3 d-flex align-items-center justify-content-center gap-1 extra-small fw-semibold flex-grow-1"
                            onClick={() => openAssignModal(alert)}
                          >
                            <FaUserCheck size={11} /> {t('Assign')}
                          </button>

                          {/* Delete Icon Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-1.5 rounded-3 flex-shrink-0 d-flex align-items-center justify-content-center"
                            style={{ width: 32, height: 32 }}
                            title={t('Delete Alert')}
                            onClick={() => handleDeleteAlert(alert)}
                          >
                            <FaTrashAlt size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ULTRA-PREMIUM VIEW ALERT DETAILS MODAL WITH CLEAN TOP-ROW ICON & SPACING */}
      {selectedAlert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(252, 86, 60, 0.55)', backdropFilter: 'blur(10px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              {/* Dynamic Premium Header based on Severity */}
              <div
                className="modal-header p-4 text-white border-0 position-relative"
                style={{
                  background:
                    selectedAlert.severity === 'Critical'
                      ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
                      : selectedAlert.severity === 'High'
                      ? 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #FC563C 0%, #1e40af 100%)'
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-white text-primary d-flex align-items-center justify-content-center shadow-md flex-shrink-0"
                    style={{ width: 56, height: 56, fontSize: '1.6rem' }}
                  >
                    {selectedAlert.category === 'Disease' ? (
                      <FaBug className="text-danger" />
                    ) : selectedAlert.category === 'Harvest' ? (
                      <FaFish className="text-warning" />
                    ) : selectedAlert.category === 'Feeding' ? (
                      <FaUtensils className="text-info" />
                    ) : selectedAlert.category === 'Caretaker Activity' ? (
                      <FaUserTie className="text-secondary" />
                    ) : (
                      <FaExclamationTriangle className="text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="fw-bold mb-1 text-white d-flex align-items-center gap-2">
                      {t(selectedAlert.title)}
                      <span className="badge bg-white text-dark fs-6 font-normal px-3 py-1 rounded-pill shadow-xs">
                        <FaWater className="me-1 text-primary" /> {selectedAlert.affected_pond_name}
                      </span>
                    </h3>
                    <p className="mb-0 text-white text-opacity-90 extra-small d-flex align-items-center gap-2">
                      <span>{t('Category:')} <strong>{t(selectedAlert.category)}</strong></span>
                      <span>•</span>
                      <span><FaClock /> {t('Created:')} {selectedAlert.formatted_date}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white position-absolute top-0 end-0 m-4"
                  onClick={() => setSelectedAlert(null)}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-white">
                {/* Status & Caretaker Grid (Top-to-Bottom Card Layout for 100% Clean Margins!) */}
                <div className="row g-3 mb-4">
                  {/* Card 1: CURRENT STATUS */}
                  <div className="col-12 col-md-4">
                    <div className="p-3.5 px-4 rounded-4 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Current Status')}</small>
                        <div className="rounded-circle bg-primary bg-opacity-10 text-primary p-2 d-flex align-items-center justify-content-center">
                          <FaShieldAlt size={14} />
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(selectedAlert.status, t)}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: ASSIGNED CARETAKER */}
                  <div className="col-12 col-md-4">
                    <div className="p-3.5 px-4 rounded-4 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Assigned Caretaker')}</small>
                        <div className="rounded-circle bg-info bg-opacity-10 text-info p-2 d-flex align-items-center justify-content-center">
                          <FaUser size={14} />
                        </div>
                      </div>
                      <h6 className="fw-bold text-dark mb-0">{selectedAlert.assigned_caretaker_name}</h6>
                    </div>
                  </div>

                  {/* Card 3: CONFIDENCE SCORE */}
                  <div className="col-12 col-md-4">
                    <div className="p-3.5 px-4 rounded-4 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Confidence Score')}</small>
                        <div className="rounded-circle bg-success bg-opacity-10 text-success p-2 d-flex align-items-center justify-content-center">
                          <FaChartLine size={14} />
                        </div>
                      </div>
                      <h6 className="fw-bold text-dark mb-0">
                        {selectedAlert.confidence_pct > 0 ? `${selectedAlert.confidence_pct}% ${t('Confidence')}` : 'N/A'}
                      </h6>
                    </div>
                  </div>
                </div>

                {/* Alert Event Description (Generous Padding & Line-Height!) */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <FaExclamationCircle className="text-primary" /> {t('Alert Event Description')}
                </h6>
                <div className="p-4 rounded-4 bg-light border border-secondary border-opacity-20 mb-4 shadow-xs">
                  <p className="text-dark mb-0 fs-6" style={{ lineHeight: 1.6 }}>{t(selectedAlert.message)}</p>
                </div>

                {/* Recommended Action Protocol (Generous Padding & Line-Height!) */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <FaLightbulb className="text-warning" /> {t('Recommended Actions / What to Do')}
                </h6>
                <div className="p-4 rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-40 mb-4 shadow-xs">
                  <p className="text-dark fw-semibold mb-0 fs-6" style={{ lineHeight: 1.6 }}>
                    {t(selectedAlert.recommended_action) || t('No specific action required.')}
                  </p>
                </div>

                {/* Caretaker Follow-up Log (Generous Padding & Line-Height!) */}
                {selectedAlert.follow_up_notes && (
                  <>
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <FaUserCheck className="text-info" /> {t('Caretaker Follow-up Log')}
                    </h6>
                    <div className="p-4 rounded-4 bg-info bg-opacity-10 border border-info border-opacity-30 mb-4 shadow-xs">
                      <p className="text-dark mb-0 fs-6" style={{ lineHeight: 1.6 }}>{t(selectedAlert.follow_up_notes)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                <div className="d-flex gap-2">
                  {selectedAlert.status !== 'Resolved' && (
                    <button
                      type="button"
                      className="btn btn-success px-4 py-2.5 rounded-3 shadow-xs d-flex align-items-center gap-2 fw-semibold"
                      onClick={() => handleResolveAlert(selectedAlert)}
                    >
                      <FaCheckCircle /> {t('Mark Resolved')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-primary px-4 py-2.5 rounded-3 shadow-xs d-flex align-items-center gap-2 fw-semibold"
                    onClick={() => {
                      const alertToAssign = selectedAlert;
                      setSelectedAlert(null);
                      openAssignModal(alertToAssign);
                    }}
                  >
                    <FaUserCheck /> {t('Reassign Follow-up')}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2.5 rounded-3 shadow-xs fw-semibold"
                  onClick={() => setSelectedAlert(null)}
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN FOLLOW-UP MODAL */}
      {assigningAlert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header p-4 bg-primary text-white border-0">
                <h4 className="fw-bold mb-0">{t('Assign Caretaker Follow-up')}</h4>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setAssigningAlert(null)}
                ></button>
              </div>

              <form onSubmit={handleSaveFollowup}>
                <div className="modal-body p-4 bg-white">
                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('Alert Target')}</label>
                    <input
                      type="text"
                      className="form-control py-2 rounded-3 bg-light"
                      value={`${t(assigningAlert.title)} (${assigningAlert.affected_pond_name})`}
                      disabled
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('Select Caretaker')}</label>
                    <select
                      className="form-select py-2.5 rounded-3"
                      value={followupForm.assigned_caretaker_name}
                      onChange={(e) => setFollowupForm({ ...followupForm, assigned_caretaker_name: e.target.value })}
                      required
                    >
                      {caretakers.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">{t('Follow-up Instructions / Notes')}</label>
                    <textarea
                      className="form-control rounded-3"
                      rows="4"
                      placeholder={t('e.g. Please inspect aeration paddlewheels and submit water sample report by 2:00 PM.')}
                      value={followupForm.follow_up_notes}
                      onChange={(e) => setFollowupForm({ ...followupForm, follow_up_notes: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer p-3 bg-light border-top">
                  <button
                    type="button"
                    className="btn-outline-secondary rounded-3"
                    onClick={() => setAssigningAlert(null)}
                  >
                    {t('Cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary px-4 rounded-3 shadow-sm">
                    {t('Save Assignment')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
