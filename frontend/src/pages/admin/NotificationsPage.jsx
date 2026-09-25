import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Swal from 'sweetalert2';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import {
  FaBell,
  FaCheckDouble,
  FaFilter,
  FaEllipsisV,
  FaArchive,
  FaTrashAlt,
  FaUtensils,
  FaVirus,
  FaWater,
  FaUserCheck,
  FaCalendarAlt,
  FaUndo,
  FaSync,
  FaTrashRestore,
  FaExternalLinkAlt,
} from 'react-icons/fa';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, active: 0, archived: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [currentTab, setCurrentTab] = useState('active'); // 'active' | 'unread' | 'archived' | 'deleted'
  const [dateFilterType, setDateFilterType] = useState('all'); // 'all' | 'today' | 'yesterday' | 'last7' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const dropdownRef = useRef(null);

  // Helper to compute target YYYY-MM-DD date based on filter
  const getFilterDateString = useCallback(() => {
    const today = new Date();
    if (dateFilterType === 'today') {
      return today.toISOString().split('T')[0];
    }
    if (dateFilterType === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return yest.toISOString().split('T')[0];
    }
    if (dateFilterType === 'custom' && customDate) {
      return customDate;
    }
    return '';
  }, [dateFilterType, customDate]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentTab === 'unread') {
        params.status = 'active';
        params.unread_only = '1';
      } else if (currentTab === 'archived') {
        params.status = 'archived';
      } else if (currentTab === 'deleted') {
        params.status = 'deleted';
      } else {
        params.status = 'active';
      }

      const dateStr = getFilterDateString();
      if (dateStr) {
        params.date = dateStr;
      }

      const response = await api.get('/notifications.php', { params });
      if (response.data && response.data.success) {
        let fetched = Array.isArray(response.data.notifications) ? response.data.notifications : [];

        // Client-side date filter fallback if dateFilterType is 'last7'
        if (dateFilterType === 'last7') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          fetched = fetched.filter((n) => new Date(n.created_at || Date.now()) >= sevenDaysAgo);
        }

        setNotifications(fetched);
        if (response.data.counts) {
          setCounts(response.data.counts);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTab, dateFilterType, getFilterDateString]);

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click Notification Handler: Marks read and redirects directly to exact report page with query parameters
  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await api.post('/notifications.php', { action: 'mark_read', id: notif.id });
      }
    } catch (e) {
      console.error('Error marking read:', e);
    }

    const actionType = (notif.action_type || '').toLowerCase();
    const title = (notif.title || '').toLowerCase();
    const msg = (notif.message || '').toLowerCase();
    const targetId = notif.target_id || notif.report_id || '';
    const pondName = notif.pond_name || '';
    const caretakerName = notif.caretaker_name || '';

    // Extract key issue phrase from notification title or message
    let issueKey = notif.title || '';
    if (issueKey.includes(':')) {
      issueKey = issueKey.split(':')[1].trim();
    }

    const queryParams = [];
    if (targetId) queryParams.push(`id=${targetId}`);
    if (pondName) queryParams.push(`pond=${encodeURIComponent(pondName)}`);
    if (issueKey) queryParams.push(`issue=${encodeURIComponent(issueKey.slice(0, 35))}`);
    if (caretakerName) queryParams.push(`caretaker=${encodeURIComponent(caretakerName)}`);

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

    if (actionType === 'disease_scan' || title.includes('disease') || msg.includes('scanned for disease') || msg.includes('wssv')) {
      navigate('/admin/disease-reports' + queryString);
    } else if (actionType === 'feeding' || title.includes('feed') || msg.includes('feed')) {
      navigate('/admin/feeding' + queryString);
    } else if (actionType === 'water_quality' || (title.includes('pond') && !title.includes('report')) || (msg.includes('pond') && !msg.includes('report'))) {
      navigate('/admin/ponds' + queryString);
    } else {
      // General Maintenance / Reports -> /admin/reports?id=XX&pond=YY&issue=ZZ
      navigate('/admin/reports' + queryString);
    }
  };

  // Action Handlers
  const handleMarkAllRead = async () => {
    try {
      const response = await api.post('/notifications.php', { action: 'mark_all_read' });
      if (response.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Marked all as read',
          text: 'All active notifications have been marked as read.',
          timer: 1800,
          showConfirmButton: false,
        });
        loadNotifications();
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Action failed', text: 'Unable to mark notifications as read.' });
    }
  };

  const handleMarkReadToggle = async (notif) => {
    const nextAction = notif.is_read ? 'mark_unread' : 'mark_read';
    setOpenDropdownId(null);
    try {
      await api.post('/notifications.php', { action: nextAction, id: notif.id });
      loadNotifications();
    } catch (error) {
      console.error('Error toggling read state:', error);
    }
  };

  const handleArchive = async (notif) => {
    setOpenDropdownId(null);
    try {
      const response = await api.post('/notifications.php', { action: 'archive', id: notif.id });
      if (response.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Archived',
          text: 'Notification moved to Archive.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadNotifications();
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Archive failed', text: 'Unable to archive notification.' });
    }
  };

  const handleRestore = async (notif) => {
    setOpenDropdownId(null);
    try {
      await api.post('/notifications.php', { action: 'restore', id: notif.id });
      Swal.fire({
        icon: 'success',
        title: 'Restored',
        text: 'Notification restored to active notifications list.',
        timer: 1500,
        showConfirmButton: false,
      });
      loadNotifications();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Restore failed', text: 'Unable to restore notification.' });
    }
  };

  const handleDelete = async (notif) => {
    setOpenDropdownId(null);
    const result = await Swal.fire({
      title: 'Move to Deleted History?',
      text: 'This notification will be moved to Deleted History. You can restore it anytime.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.post('/notifications.php', { action: 'delete', id: notif.id });
        Swal.fire({
          icon: 'success',
          title: 'Moved to Deleted History',
          text: 'Notification moved to Deleted History.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadNotifications();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Delete failed', text: 'Unable to delete notification.' });
      }
    }
  };

  const handlePermanentDelete = async (notif) => {
    setOpenDropdownId(null);
    const result = await Swal.fire({
      title: 'Permanently Delete?',
      text: 'This action cannot be undone! This notification will be permanently removed from database.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Permanently Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.post('/notifications.php', { action: 'permanent_delete', id: notif.id });
        Swal.fire({
          icon: 'success',
          title: 'Permanently Deleted',
          text: 'Notification deleted permanently.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadNotifications();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Action failed', text: 'Unable to permanently delete notification.' });
      }
    }
  };

  // Icon mapper by action_type
  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'feeding':
        return <FaUtensils className="text-warning" />;
      case 'disease_scan':
        return <FaVirus className="text-danger" />;
      case 'water_quality':
        return <FaWater className="text-info" />;
      case 'user_activity':
        return <FaUserCheck className="text-primary" />;
      default:
        return <FaBell className="text-primary" />;
    }
  };

  return (
    <div className="pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 🌟 HERO BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
            style={{
              width: 50,
              height: 50,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #1E3A8A 100%)',
              color: '#FFFFFF',
              fontSize: '1.3rem',
              border: '2px solid rgba(234, 88, 12, 0.3)'
            }}
          >
            <FaBell />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Operational Notifications &amp; System Dispatch
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
              >
                ● Live Incident Stream
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              Real-time feed alerts, water telemetry variances, and caretaker biometric reports.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
          style={{ fontSize: '0.82rem', height: 40 }}
          onClick={loadNotifications}
        >
          <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> Refresh Dispatch
        </button>
      </div>

      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search notification title, message, pond, caretaker..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onRefresh={loadNotifications}
        loading={loading}
        extraActions={
          <button
            type="button"
            className="btn btn-sm btn-tri-navy px-3.5 py-2 shadow-xs"
            onClick={handleMarkAllRead}
            disabled={counts.unread === 0}
          >
            <FaCheckDouble size={13} /> Mark All as Read
          </button>
        }
        tabs={[
          { id: 'active', label: 'Active', count: counts.active },
          { id: 'unread', label: 'Unread', count: counts.unread },
          { id: 'archived', label: 'Archived', count: counts.archived },
          { id: 'deleted', label: 'Deleted History', count: counts.deleted || 0 }
        ]}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        metaRight={
          <>
            System Dispatch: <strong>Real-time Caretaker Reports & Alerts</strong>
          </>
        }
        filterFields={[
          {
            label: 'Evaluation Date',
            icon: <FaCalendarAlt className="me-1 text-primary" />,
            type: 'date',
            value: customDate,
            onChange: (val) => {
              setCustomDate(val);
              setDateFilterType('custom');
            },
            colClass: 'col-12 col-md-4'
          },
          {
            label: 'Date Range Quick Selector',
            type: 'select',
            value: dateFilterType,
            onChange: (val) => {
              setDateFilterType(val);
              if (val !== 'custom') setCustomDate('');
            },
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: 'All Dates' },
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'last7', label: 'Last 7 Days' },
              { value: 'custom', label: 'Custom Date…' }
            ]
          }
        ]}
        onResetFilters={() => {
          setSearchQuery('');
          setCurrentTab('active');
          setDateFilterType('all');
          setCustomDate('');
        }}
      />

      {/* Notifications List Container */}
      <div className="tri-card p-4" ref={dropdownRef}>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading notifications…
            </div>
          ) : (() => {
            const displayNotifs = notifications.filter((n) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                (n.title || '').toLowerCase().includes(q) ||
                (n.message || '').toLowerCase().includes(q) ||
                (n.pond_name || '').toLowerCase().includes(q) ||
                (n.caretaker_name || '').toLowerCase().includes(q)
              );
            });

            if (displayNotifs.length === 0) {
              return (
                <div className="text-center py-5">
                  <FaBell className="text-muted opacity-50 display-4 mb-2" />
                  <h6 className="fw-semibold text-muted">No notifications found</h6>
                  <p className="small text-muted mb-0">No entries match your search query or selected filter.</p>
                </div>
              );
            }

            return (
              <div className="list-group list-group-flush">
                {displayNotifs.map((notif) => (
                <div
                  key={notif.id}
                  className={`list-group-item p-3.5 d-flex align-items-start justify-content-between gap-3 border-bottom transition-all ${
                    !notif.is_read && currentTab !== 'deleted' ? 'bg-light border-start border-primary border-4' : ''
                  }`}
                >
                  <div
                    className="d-flex align-items-start gap-3 flex-grow-1 cursor-pointer"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    {/* Action Icon */}
                    <div
                      className="rounded-circle p-2 bg-white shadow-sm d-flex align-items-center justify-content-center"
                      style={{ width: 44, height: 44, minWidth: 44 }}
                    >
                      {getActionIcon(notif.action_type)}
                    </div>

                    {/* Content Body */}
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <h6 className="fw-bold mb-0 text-dark">{notif.title}</h6>

                        {notif.caretaker_name && (
                          <span className="badge bg-primary bg-opacity-10 text-primary fw-normal">
                            {notif.caretaker_name}
                          </span>
                        )}

                        {notif.pond_name && (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary fw-normal">
                            {notif.pond_name}
                          </span>
                        )}

                        {!notif.is_read && currentTab !== 'deleted' && (
                          <span className="badge bg-danger rounded-pill small ms-1">New</span>
                        )}

                        {currentTab === 'deleted' && (
                          <span className="badge bg-danger bg-opacity-10 text-danger fw-normal ms-1">Deleted</span>
                        )}
                      </div>

                      <p className="text-dark mb-1.5 small">{notif.message}</p>

                      <div className="d-flex align-items-center gap-3">
                        <span className="text-muted extra-small" style={{ fontSize: '0.8rem' }}>
                          {new Date(notif.created_at || Date.now()).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {currentTab !== 'deleted' && (
                          <button
                            className="btn btn-link btn-sm text-decoration-none p-0 text-primary fw-semibold extra-small d-flex align-items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notif);
                            }}
                          >
                            <FaExternalLinkAlt size={10} /> View Report Details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Three Vertical Dots Menu */}
                  {currentTab === 'deleted' ? (
                    /* Direct Restore & Delete Buttons for Deleted History Tab */
                    <div className="d-flex gap-2 align-items-center">
                      <button
                        className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                        onClick={() => handleRestore(notif)}
                        title="Restore Notification"
                      >
                        <FaTrashRestore /> Restore
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm p-1 px-2"
                        onClick={() => handlePermanentDelete(notif)}
                        title="Permanently Delete"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  ) : (
                    /* Context 3-Dots Dropdown Menu for Active / Archived */
                    <div className="position-relative">
                      <button
                        className="btn btn-link text-muted p-1 rounded-circle border-0 shadow-none hover-bg-light"
                        title="Actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === notif.id ? null : notif.id);
                        }}
                      >
                        <FaEllipsisV style={{ fontSize: '1.1rem' }} />
                      </button>

                      {/* Dropdown Menu Popup */}
                      {openDropdownId === notif.id && (
                        <div
                          className="dropdown-menu show shadow-lg border-0 position-absolute end-0 mt-1 py-1"
                          style={{ zIndex: 1050, minWidth: '170px' }}
                        >
                          <button
                            className="dropdown-item d-flex align-items-center gap-2 small py-2 text-primary fw-semibold"
                            onClick={() => handleNotificationClick(notif)}
                          >
                            <FaExternalLinkAlt /> Go to Reports
                          </button>

                          <button
                            className="dropdown-item d-flex align-items-center gap-2 small py-2"
                            onClick={() => handleMarkReadToggle(notif)}
                          >
                            <FaCheckDouble className="text-secondary" />
                            {notif.is_read ? 'Mark as Unread' : 'Mark as Read'}
                          </button>

                          {currentTab !== 'archived' ? (
                            <button
                              className="dropdown-item d-flex align-items-center gap-2 small py-2 text-warning"
                              onClick={() => handleArchive(notif)}
                            >
                              <FaArchive /> Archive
                            </button>
                          ) : (
                            <button
                              className="dropdown-item d-flex align-items-center gap-2 small py-2 text-success"
                              onClick={() => handleRestore(notif)}
                            >
                              <FaUndo /> Restore Active
                            </button>
                          )}

                          <div className="dropdown-divider my-1"></div>

                          <button
                            className="dropdown-item d-flex align-items-center gap-2 small py-2 text-danger"
                            onClick={() => handleDelete(notif)}
                          >
                            <FaTrashAlt /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
        </div>
      </div>
    </div>
  );
}
