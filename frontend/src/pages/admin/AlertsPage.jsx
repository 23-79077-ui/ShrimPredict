import { useEffect, useState } from 'react';
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
  FaChartLine
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

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
function getSeverityBadge(severity) {
  switch (severity) {
    case 'Critical':
      return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-1.5 rounded-pill extra-small fw-bold">🔴 Critical Alert</span>;
    case 'High':
      return <span className="badge bg-warning bg-opacity-15 text-dark border border-warning border-opacity-50 px-3 py-1.5 rounded-pill extra-small fw-bold">🟠 High Risk</span>;
    case 'Medium':
      return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-30 px-3 py-1.5 rounded-pill extra-small fw-bold">🟡 Warning</span>;
    default:
      return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-3 py-1.5 rounded-pill extra-small fw-bold">🔵 Low Priority</span>;
  }
}

// Helper to format status badge
function getStatusBadge(status) {
  switch (status) {
    case 'Resolved':
      return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-1.5 rounded-pill extra-small fw-bold">✅ Resolved</span>;
    case 'In Progress':
      return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2.5 py-1.5 rounded-pill extra-small fw-bold">🔄 In Progress</span>;
    default:
      return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 rounded-pill extra-small fw-bold">⏳ Pending Action</span>;
  }
}

export default function AlertsPage() {
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
      {/* 🛠 1. UNIFIED CONTROL & FILTER TOOLBAR (TOP SECTION) */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
          {/* Quick Search */}
          <div className="position-relative flex-grow-1" style={{ maxWidth: 450 }}>
            <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 16 }} size={14} />
            <input
              type="text"
              className="form-control ps-5 pe-4 py-2.5 rounded-pill shadow-xs"
              placeholder="Search Alert Title, Message, Pond, or Caretaker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.92rem' }}
            />
            {searchQuery && (
              <button
                className="btn btn-sm btn-link position-absolute top-50 translate-middle-y text-muted text-decoration-none"
                style={{ right: 12 }}
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-success btn-sm px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold shadow-xs"
              onClick={handleExportCSV}
            >
              <FaFileCsv size={15} /> Export CSV
            </button>

            <button
              type="button"
              className="btn btn-light btn-sm px-3 py-2 border rounded-3 d-flex align-items-center gap-1.5 text-muted shadow-xs"
              onClick={loadAlerts}
              title="Refresh Queue"
            >
              <FaSync size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* 5 Filter Dropdowns Grid */}
        <div className="row g-3">
          {/* Filter 1: Severity */}
          <div className="col-12 col-sm-6 col-md-4 col-xl-2">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Severity
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical 🔴</option>
              <option value="High">High Risk 🟠</option>
              <option value="Medium">Warning 🟡</option>
              <option value="Low">Low Priority 🔵</option>
            </select>
          </div>

          {/* Filter 2: Alert Type / Category */}
          <div className="col-12 col-sm-6 col-md-4 col-xl-2.4" style={{ width: '20%' }}>
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Alert Type
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Alert Types</option>
              <option value="Disease">Disease Alert 🦠</option>
              <option value="Harvest">Harvest Alert 🦐</option>
              <option value="Feeding">Feeding Alert 🥣</option>
              <option value="Image Upload">Image Upload 📷</option>
              <option value="Caretaker Activity">Caretaker Activity 👨‍🌾</option>
              <option value="Pond Status">Pond Status 🟢</option>
            </select>
          </div>

          {/* Filter 3: Pond */}
          <div className="col-12 col-sm-6 col-md-4 col-xl-2">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Pond
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={pondFilter}
              onChange={(e) => setPondFilter(e.target.value)}
            >
              <option value="All">All Ponds</option>
              {ponds.map((p) => (
                <option key={p.id} value={p.pond_name}>
                  {p.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Status */}
          <div className="col-12 col-sm-6 col-md-4 col-xl-2">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Status
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending ⏳</option>
              <option value="In Progress">In Progress 🔄</option>
              <option value="Resolved">Resolved ✅</option>
            </select>
          </div>

          {/* Filter 5: Date */}
          <div className="col-12 col-sm-6 col-md-4 col-xl-2">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Date
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📊 2. SUMMARY CARDS (MIDDLE SECTION) */}
      <div className="row g-3 mb-4">
        {/* Critical Alerts */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-danger">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Critical Alerts</span>
              <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill">🔴 Action Needed</span>
            </div>
            <h3 className="fw-bold text-danger mb-0">{summary.critical_alerts}</h3>
            <small className="text-muted extra-small">Immediate Intervention</small>
          </div>
        </div>

        {/* Warnings */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-warning">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Warnings</span>
              <span className="badge bg-warning bg-opacity-10 text-warning rounded-pill">🟠 Watch List</span>
            </div>
            <h3 className="fw-bold text-warning mb-0">{summary.warnings}</h3>
            <small className="text-muted extra-small">High & Medium Alerts</small>
          </div>
        </div>

        {/* Resolved */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-success">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Resolved</span>
              <span className="badge bg-success bg-opacity-10 text-success rounded-pill">✅ Closed</span>
            </div>
            <h3 className="fw-bold text-success mb-0">{summary.resolved}</h3>
            <small className="text-muted extra-small">Addressed Issues</small>
          </div>
        </div>

        {/* Pending */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-info">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Pending Queue</span>
              <span className="badge bg-info bg-opacity-10 text-info rounded-pill">⏳ Active Queue</span>
            </div>
            <h3 className="fw-bold text-info mb-0">{summary.pending}</h3>
            <small className="text-muted extra-small">Awaiting Caretaker Action</small>
          </div>
        </div>
      </div>

      {/* 🚨 3. ALERTS ACTION CENTER CARDS GRID (3-COLUMN ROW LAYOUT) */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <FaExclamationTriangle className="text-primary" /> Alerts Action Center
            </h5>
            <p className="text-muted mb-0 small">Real-time critical events requiring immediate caretaker action and monitoring.</p>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold">
            Showing {filteredAlerts.length} of {alerts.length} Alerts
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2">Loading Alerts Action Center...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-5 text-muted border rounded-4 bg-light">
            <FaCheckCircle size={36} className="text-success mb-2 opacity-50" />
            <h6 className="fw-bold mb-1">No Active Alerts Found</h6>
            <p className="small mb-0">All farm alerts match your clean criteria.</p>
          </div>
        ) : (
          /* ELEGANT 3-COLUMN GRID PER ROW ACROSS DESKTOP */
          <div className="row g-4">
            {filteredAlerts.map((alert) => {
              const catMeta = getCategoryMeta(alert.category);
              const isResolved = alert.status === 'Resolved';

              return (
                <div key={alert.id} className="col-12 col-md-6 col-xl-4">
                  <div
                    className={`card border shadow-sm rounded-4 p-4 h-100 d-flex flex-column justify-content-between transition-all hover-shadow bg-white ${
                      alert.severity === 'Critical' ? 'border-danger border-opacity-50' : ''
                    }`}
                    style={{ minHeight: 310 }}
                  >
                    <div>
                      {/* Top Header Row: Severity Pill + Category Tag + Status Badge */}
                      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-light">
                        <div className="d-flex align-items-center gap-1.5">
                          {getSeverityBadge(alert.severity)}
                        </div>
                        <div className="d-flex align-items-center gap-1.5">
                          <span className={`badge border ${catMeta.badgeClass} px-2.5 py-1 rounded-pill extra-small font-mono fw-semibold`}>
                            {catMeta.icon} {alert.category}
                          </span>
                          {getStatusBadge(alert.status)}
                        </div>
                      </div>

                      {/* Alert Title & Pond Pill Row */}
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h5 className="fw-bold text-dark mb-0 fs-6">{alert.title}</h5>
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill extra-small fw-semibold">
                          <FaWater className="me-1" size={10} /> {alert.affected_pond_name}
                        </span>
                      </div>

                      {/* Short Description */}
                      <p className="extra-small text-muted mb-3" style={{ lineHeight: 1.45 }}>
                        {alert.message}
                      </p>

                      {/* Caretaker & Recommended Action Box (Generous Inner Breathing Room) */}
                      <div className="p-3 rounded-4 bg-light bg-opacity-75 border mb-3">
                        <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-1.5 pb-1 border-bottom">
                          <span className="d-flex align-items-center gap-1.5">
                            <FaUser className="text-primary" size={11} /> Caretaker: <strong className="text-dark me-1">{alert.assigned_caretaker_name}</strong>
                          </span>
                          <span className="d-flex align-items-center gap-1 extra-small ms-2">
                            <FaClock size={10} /> {alert.time_ago || 'Today'}
                          </span>
                        </div>

                        {/* Action Protocol text */}
                        {alert.recommended_action && (
                          <div className="extra-small text-dark fw-semibold d-flex align-items-start gap-1.5 pt-1" style={{ lineHeight: 1.35 }}>
                            <FaLightbulb className="text-warning flex-shrink-0 mt-0.5" size={13} />
                            <span>{alert.recommended_action}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Buttons Row */}
                    <div className="pt-3 border-top">
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        {/* 👁 View Details */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1 extra-small fw-semibold flex-fill justify-content-center"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <FaEye size={11} /> Details
                        </button>

                        {/* ✅ Resolve Button */}
                        <button
                          type="button"
                          className={`btn btn-sm px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1 extra-small fw-semibold flex-fill justify-content-center ${
                            isResolved ? 'btn-light text-muted opacity-50 border' : 'btn-outline-success'
                          }`}
                          disabled={isResolved}
                          onClick={() => handleResolveAlert(alert)}
                        >
                          <FaCheckCircle size={11} /> {isResolved ? 'Resolved' : 'Resolve'}
                        </button>

                        {/* 👤 Assign Follow-up */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-2.5 py-1.5 rounded-3 d-flex align-items-center gap-1 extra-small fw-semibold flex-fill justify-content-center"
                          onClick={() => openAssignModal(alert)}
                        >
                          <FaUserCheck size={11} /> Assign
                        </button>

                        {/* 🗑 Delete Icon Button */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger p-1.5 rounded-3 flex-shrink-0"
                          title="Delete Alert"
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
        )}
      </div>

      {/* 👁 ULTRA-PREMIUM VIEW ALERT DETAILS MODAL WITH CLEAN TOP-ROW ICON & SPACING */}
      {selectedAlert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(11, 44, 95, 0.55)', backdropFilter: 'blur(10px)', zIndex: 1060 }}
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
                      : 'linear-gradient(135deg, #0b2c5f 0%, #1e40af 100%)'
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
                      {selectedAlert.title}
                      <span className="badge bg-white text-dark fs-6 font-normal px-3 py-1 rounded-pill shadow-xs">
                        <FaWater className="me-1 text-primary" /> {selectedAlert.affected_pond_name}
                      </span>
                    </h3>
                    <p className="mb-0 text-white text-opacity-90 extra-small d-flex align-items-center gap-2">
                      <span>Category: <strong>{selectedAlert.category}</strong></span>
                      <span>•</span>
                      <span><FaClock /> Created: {selectedAlert.formatted_date}</span>
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
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">Current Status</small>
                        <div className="rounded-circle bg-primary bg-opacity-10 text-primary p-2 d-flex align-items-center justify-content-center">
                          <FaShieldAlt size={14} />
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(selectedAlert.status)}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: ASSIGNED CARETAKER */}
                  <div className="col-12 col-md-4">
                    <div className="p-3.5 px-4 rounded-4 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Caretaker</small>
                        <div className="rounded-circle bg-info bg-opacity-10 text-info p-2 d-flex align-items-center justify-content-center">
                          <FaUser size={14} />
                        </div>
                      </div>
                      <h6 className="fw-bold text-dark mb-0">{selectedAlert.assigned_caretaker_name}</h6>
                    </div>
                  </div>

                  {/* Card 3: AI CONFIDENCE SCORE */}
                  <div className="col-12 col-md-4">
                    <div className="p-3.5 px-4 rounded-4 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted extra-small fw-bold text-uppercase tracking-wider">AI Confidence Score</small>
                        <div className="rounded-circle bg-success bg-opacity-10 text-success p-2 d-flex align-items-center justify-content-center">
                          <FaChartLine size={14} />
                        </div>
                      </div>
                      <h6 className="fw-bold text-dark mb-0">
                        {selectedAlert.confidence_pct > 0 ? `${selectedAlert.confidence_pct}% Confidence` : 'N/A'}
                      </h6>
                    </div>
                  </div>
                </div>

                {/* Alert Event Description (Generous Padding & Line-Height!) */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <FaExclamationCircle className="text-primary" /> Alert Event Description
                </h6>
                <div className="p-4 rounded-4 bg-light border border-secondary border-opacity-20 mb-4 shadow-xs">
                  <p className="text-dark mb-0 fs-6" style={{ lineHeight: 1.6 }}>{selectedAlert.message}</p>
                </div>

                {/* Recommended Action Protocol (Generous Padding & Line-Height!) */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <FaLightbulb className="text-warning" /> Recommended Action Protocol
                </h6>
                <div className="p-4 rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-40 mb-4 shadow-xs">
                  <p className="text-dark fw-semibold mb-0 fs-6" style={{ lineHeight: 1.6 }}>
                    {selectedAlert.recommended_action || 'No specific action protocol assigned.'}
                  </p>
                </div>

                {/* Caretaker Follow-up Log (Generous Padding & Line-Height!) */}
                {selectedAlert.follow_up_notes && (
                  <>
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <FaUserCheck className="text-info" /> Caretaker Follow-up Log
                    </h6>
                    <div className="p-4 rounded-4 bg-info bg-opacity-10 border border-info border-opacity-30 mb-4 shadow-xs">
                      <p className="text-dark mb-0 fs-6" style={{ lineHeight: 1.6 }}>{selectedAlert.follow_up_notes}</p>
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
                      <FaCheckCircle /> Mark Resolved
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
                    <FaUserCheck /> Reassign Follow-up
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2.5 rounded-3 shadow-xs fw-semibold"
                  onClick={() => setSelectedAlert(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 👤 ASSIGN FOLLOW-UP MODAL */}
      {assigningAlert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header p-4 bg-primary text-white border-0">
                <h4 className="fw-bold mb-0">Assign Caretaker Follow-up</h4>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setAssigningAlert(null)}
                ></button>
              </div>

              <form onSubmit={handleSaveFollowup}>
                <div className="modal-body p-4 bg-white">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Alert Target</label>
                    <input
                      type="text"
                      className="form-control py-2 rounded-3 bg-light"
                      value={`${assigningAlert.title} (${assigningAlert.affected_pond_name})`}
                      disabled
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Select Caretaker</label>
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
                    <label className="form-label fw-bold">Follow-up Instructions / Notes</label>
                    <textarea
                      className="form-control rounded-3"
                      rows="4"
                      placeholder="e.g. Please inspect aeration paddlewheels and submit water sample report by 2:00 PM."
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
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4 rounded-3 shadow-sm">
                    Save Assignment
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
