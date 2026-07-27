import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import {
  FaBell,
  FaCheckDouble,
  FaFilter,
  FaEllipsisV,
  FaArchive,
  FaTrashAlt,
  FaTools,
  FaCheckCircle,
  FaCalendarAlt,
  FaUndo,
  FaSync,
  FaTrashRestore,
  FaInfoCircle,
} from 'react-icons/fa';

export default function CaretakerNotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, active: 0, archived: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);

  // Filters state
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
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = { user_id: user.id };
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

        // Client-side date filter fallback for last 7 days
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
      console.error('Error fetching caretaker notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentTab, dateFilterType, getFilterDateString]);

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener('shrim-notification-updated', handleUpdate);
    window.addEventListener('shrim-report-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('shrim-notification-updated', handleUpdate);
      window.removeEventListener('shrim-report-updated', handleUpdate);
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

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications.php', { action: 'mark_all_read' });
      Swal.fire({
        icon: 'success',
        title: 'All Marked as Read',
        text: 'All your notifications have been marked as read.',
        timer: 1500,
        showConfirmButton: false,
      });
      loadNotifications();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Action failed', text: 'Unable to mark notifications as read.' });
    }
  };

  const handleToggleReadStatus = async (notif) => {
    setOpenDropdownId(null);
    const action = notif.is_read ? 'mark_unread' : 'mark_read';
    try {
      await api.post('/notifications.php', { action, id: notif.id });
      loadNotifications();
    } catch (error) {
      console.error('Error toggling read status:', error);
    }
  };

  const handleArchiveNotification = async (notif) => {
    setOpenDropdownId(null);
    try {
      await api.post('/notifications.php', { action: 'archive', id: notif.id });
      Swal.fire({
        icon: 'success',
        title: 'Archived',
        text: 'Notification moved to archive.',
        timer: 1500,
        showConfirmButton: false,
      });
      loadNotifications();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Archive failed', text: 'Unable to archive notification.' });
    }
  };

  const handleRestoreNotification = async (notif) => {
    setOpenDropdownId(null);
    try {
      await api.post('/notifications.php', { action: 'restore', id: notif.id });
      Swal.fire({
        icon: 'success',
        title: 'Restored',
        text: 'Notification restored to active view.',
        timer: 1500,
        showConfirmButton: false,
      });
      loadNotifications();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Restore failed', text: 'Unable to restore notification.' });
    }
  };

  const handleDeleteNotification = async (notif) => {
    setOpenDropdownId(null);
    const result = await Swal.fire({
      title: 'Move to Trash?',
      text: 'Notification will be moved to deleted history.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.post('/notifications.php', { action: 'delete', id: notif.id });
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Notification moved to deleted history.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadNotifications();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Delete failed', text: 'Unable to delete notification.' });
      }
    }
  };

  // Icon mapper by action_type or title
  const getActionIcon = (notif) => {
    const title = (notif.title || '').toLowerCase();
    if (title.includes('done') || title.includes('resolved')) {
      return <FaCheckCircle className="text-success" />;
    }
    if (title.includes('progress') || title.includes('update')) {
      return <FaTools className="text-info" />;
    }
    return <FaBell className="text-primary" />;
  };

  return (
    <div className="caretaker-notifications-page">
      {/* Top Hero Banner */}
      <section className="caretaker-dashboard-hero mb-4">
        <div>
          <span className="caretaker-dashboard-kicker">Caretaker Console</span>
          <h3>Notifications</h3>
          <p>Admin responses and status updates for your submitted pond reports.</p>
        </div>
      </section>

      {/* Action Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold extra-small">
            <FaBell className="me-1" /> Real-time Admin Responses & Report Updates
          </span>
          {counts.unread > 0 && (
            <span className="badge bg-danger rounded-pill px-3 py-1.5 extra-small fw-bold">{counts.unread} Unread</span>
          )}
        </div>

        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1.5 rounded-pill px-3" onClick={loadNotifications}>
            <FaSync /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-2 rounded-pill px-3"
            onClick={handleMarkAllRead}
            disabled={counts.unread === 0}
          >
            <FaCheckDouble /> Mark All as Read
          </button>
        </div>
      </div>

      {/* Tabs and Filters Navigation */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            {/* View Tabs */}
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'active' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('active')}
                >
                  Active <span className="badge bg-light text-dark ms-1">{counts.active}</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'unread' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('unread')}
                >
                  Unread <span className="badge bg-danger ms-1">{counts.unread}</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'archived' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('archived')}
                >
                  <FaArchive className="me-1" /> Archived{' '}
                  <span className="badge bg-secondary ms-1">{counts.archived}</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm ${currentTab === 'deleted' ? 'active bg-danger' : ''}`}
                  onClick={() => setCurrentTab('deleted')}
                >
                  <FaTrashAlt className="me-1" /> Deleted History{' '}
                  <span className="badge bg-dark ms-1">{counts.deleted || 0}</span>
                </button>
              </li>
            </ul>

            {/* Date Filter Toolbar */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="text-muted small fw-semibold d-flex align-items-center gap-1">
                <FaFilter /> Filter Date:
              </span>
              <select
                className="form-select form-select-sm w-auto"
                value={dateFilterType}
                onChange={(e) => {
                  setDateFilterType(e.target.value);
                  if (e.target.value !== 'custom') setCustomDate('');
                }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="custom">Custom Date…</option>
              </select>

              {dateFilterType === 'custom' && (
                <div className="d-flex align-items-center gap-1">
                  <FaCalendarAlt className="text-muted" />
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="card border-0 shadow-sm" ref={dropdownRef}>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-5">
              <FaBell className="text-muted opacity-50 display-4 mb-2" />
              <h6 className="fw-semibold text-muted">No admin responses found</h6>
              <p className="small text-muted mb-0">
                {currentTab === 'deleted'
                  ? 'No deleted notifications in history.'
                  : currentTab === 'archived'
                  ? 'No archived notifications.'
                  : currentTab === 'unread'
                  ? 'All admin responses are marked as read.'
                  : 'No admin updates returned for your submitted reports yet.'}
              </p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`list-group-item p-3.5 d-flex align-items-start justify-content-between gap-3 border-bottom transition-all ${
                    !notif.is_read && currentTab !== 'deleted' ? 'bg-light border-start border-primary border-4' : ''
                  }`}
                >
                  <div className="d-flex align-items-start gap-3 flex-grow-1">
                    {/* Action Icon */}
                    <div
                      className="rounded-circle p-2 bg-white shadow-sm d-flex align-items-center justify-content-center"
                      style={{ width: 44, height: 44, minWidth: 44 }}
                    >
                      {getActionIcon(notif)}
                    </div>

                    {/* Content Details */}
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <h6 className={`mb-0 ${!notif.is_read ? 'fw-extrabold text-primary' : 'fw-bold text-dark'}`}>
                          {notif.title}
                        </h6>

                        {notif.pond_name && (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small px-2 py-0.5 rounded-pill">
                            {notif.pond_name}
                          </span>
                        )}
                      </div>

                      <p className="text-secondary small mb-2" style={{ lineHeight: 1.5 }}>
                        {notif.message}
                      </p>

                      <div className="d-flex align-items-center gap-3 extra-small text-muted">
                        <span>
                          {new Date(notif.created_at || Date.now()).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Dropdown */}
                  <div className="position-relative">
                    <button
                      className="btn btn-sm btn-link text-muted p-1 text-decoration-none shadow-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === notif.id ? null : notif.id);
                      }}
                    >
                      <FaEllipsisV />
                    </button>

                    {openDropdownId === notif.id && (
                      <div
                        className="position-absolute end-0 mt-1 bg-white border border-slate-200 rounded-3 shadow-lg p-1 z-3"
                        style={{ width: 170, zIndex: 100 }}
                      >
                        {currentTab === 'deleted' ? (
                          <button
                            className="dropdown-item text-success extra-small py-1.5 px-2 rounded d-flex align-items-center gap-2"
                            onClick={() => handleRestoreNotification(notif)}
                          >
                            <FaTrashRestore /> Restore
                          </button>
                        ) : (
                          <>
                            <button
                              className="dropdown-item extra-small py-1.5 px-2 rounded d-flex align-items-center gap-2"
                              onClick={() => handleToggleReadStatus(notif)}
                            >
                              <FaCheckDouble /> {notif.is_read ? 'Mark as Unread' : 'Mark as Read'}
                            </button>

                            {currentTab === 'archived' ? (
                              <button
                                className="dropdown-item text-primary extra-small py-1.5 px-2 rounded d-flex align-items-center gap-2"
                                onClick={() => handleRestoreNotification(notif)}
                              >
                                <FaUndo /> Restore to Active
                              </button>
                            ) : (
                              <button
                                className="dropdown-item text-secondary extra-small py-1.5 px-2 rounded d-flex align-items-center gap-2"
                                onClick={() => handleArchiveNotification(notif)}
                              >
                                <FaArchive /> Archive
                              </button>
                            )}

                            <hr className="my-1" />

                            <button
                              className="dropdown-item text-danger extra-small py-1.5 px-2 rounded d-flex align-items-center gap-2"
                              onClick={() => handleDeleteNotification(notif)}
                            >
                              <FaTrashAlt /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
