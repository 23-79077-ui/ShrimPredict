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
  FaBullhorn,
  FaPaperPlane,
  FaTimes,
} from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';

export default function NotificationsPage() {
  const { t } = useLanguage();
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

  // Compose Live Alert State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [caretakersList, setCaretakersList] = useState([]);
  const [pondsList, setPondsList] = useState([]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [composeForm, setComposeForm] = useState({
    recipientType: 'all', // 'all' | 'single'
    caretakerId: '',
    pondName: 'Pond A1',
    alertType: 'harvest_ready',
    title: 'Ready for Harvest: Pond A1',
    message: 'Pond A1 has reached 15,000 kg feed target and 24.5g average body weight. You may now coordinate pond drainage and harvest preparation equipment.',
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [cRes, pRes] = await Promise.allSettled([
          api.get('/users.php?role=caretaker'),
          api.get('/ponds.php'),
        ]);
        if (cRes.status === 'fulfilled') {
          const list = Array.isArray(cRes.value.data)
            ? cRes.value.data
            : (Array.isArray(cRes.value.data?.users) ? cRes.value.data.users : []);
          setCaretakersList(list);
          if (list.length > 0) {
            setComposeForm((prev) => ({ ...prev, caretakerId: String(list[0].id) }));
          }
        }
        if (pRes.status === 'fulfilled') {
          const pList = Array.isArray(pRes.value.data?.ponds) ? pRes.value.data.ponds : [];
          setPondsList(pList);
        }
      } catch (e) {}
    };
    fetchMetadata();
  }, []);

  const applyPreset = (type) => {
    const pName = composeForm.pondName || 'Pond A1';
    if (type === 'harvest') {
      setComposeForm((prev) => ({
        ...prev,
        alertType: 'harvest_ready',
        title: `Ready for Harvest: ${pName}`,
        message: `${pName} has completed the 15,000 kg feeding target and reached harvest-ready shrimp weight (24.5g). Prepare harvest equipment, drainage pipes, and aerator standby.`,
      }));
    } else if (type === 'water') {
      setComposeForm((prev) => ({
        ...prev,
        alertType: 'urgent_action',
        title: `Urgent Water Parameter Check: ${pName}`,
        message: `Abnormal water parameter readings detected in ${pName}. Verify DO, temperature, and pH immediately and activate supplemental aeration.`,
      }));
    } else if (type === 'feed') {
      setComposeForm((prev) => ({
        ...prev,
        alertType: 'feeding_advisory',
        title: `Feeding Ration Advisory: ${pName}`,
        message: `4/4 feeding check trays were fully consumed on ${pName}. Add +2.00 kg feed on the next scheduled slot per farm SOP.`,
      }));
    }
  };

  const handleDispatchLiveAlert = async (e) => {
    e?.preventDefault();
    if (!composeForm.title.trim() || !composeForm.message.trim()) {
      Swal.fire({ icon: 'warning', title: t('Missing Information'), text: t('Please provide both title and message.') });
      return;
    }
    setSendingAlert(true);
    try {
      const selectedCt = caretakersList.find((c) => String(c.id) === String(composeForm.caretakerId));
      const res = await api.post('/notifications.php', {
        title: composeForm.title.trim(),
        message: composeForm.message.trim(),
        user_id: composeForm.recipientType === 'all' ? 'all' : (composeForm.caretakerId || null),
        caretaker_name: composeForm.recipientType === 'all' ? 'All Caretakers' : (selectedCt?.full_name || 'Caretaker'),
        action_type: composeForm.alertType,
        pond_name: composeForm.pondName || '',
        broadcast: composeForm.recipientType === 'all',
      });
      if (res.data?.success) {
        setShowComposeModal(false);
        loadNotifications();
        window.dispatchEvent(new Event('shrim-notification-updated'));
        Swal.fire({
          icon: 'success',
          title: t('Live Alert Dispatched!'),
          text: composeForm.recipientType === 'all'
            ? t('Alert successfully sent to ALL caretakers. They will receive a live notification with sound on their screens.')
            : `${t('Alert successfully sent to')} ${selectedCt?.full_name || 'Caretaker'}. ${t('They will receive a live notification with sound on their screen.')}`,
          confirmButtonColor: '#FC563C',
        });
      } else {
        throw new Error(res.data?.message || 'Failed to dispatch alert.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('Dispatch Failed'),
        text: err?.response?.data?.message || err.message || t('Unable to send alert. Please try again.'),
      });
    } finally {
      setSendingAlert(false);
    }
  };

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
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Operational Notifications & System Dispatch')}
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
            {t('• Live Feed')}
          </span>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm d-inline-flex align-items-center gap-1.5 px-3.5 py-2 shadow-xs hover-lift rounded-3 text-white"
            style={{ backgroundColor: '#FC563C', fontWeight: 600 }}
            onClick={() => setShowComposeModal(true)}
          >
            <FaBullhorn size={12} /> {t('Send Live Alert to Caretaker')}
          </button>
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-2 shadow-2xs hover-shadow"
            onClick={loadNotifications}
            disabled={loading}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} /> {t('Refresh')}
          </button>
        </div>
      </div>

      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('Search notification title, message, pond, caretaker...')}
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
            <FaCheckDouble size={13} /> {t('Mark All as Read')}
          </button>
        }
        tabs={[
          { id: 'active', label: t('Active'), count: counts.active },
          { id: 'unread', label: t('Unread'), count: counts.unread },
          { id: 'archived', label: t('Archived'), count: counts.archived },
          { id: 'deleted', label: t('Deleted History'), count: counts.deleted || 0 }
        ]}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        metaRight={
          <>
            {t('System Dispatch:')} <strong>{t('Real-time Caretaker Reports & Alerts')}</strong>
          </>
        }
        filterFields={[
          {
            label: t('Evaluation Date'),
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
            label: t('Date Range Quick Selector'),
            type: 'select',
            value: dateFilterType,
            onChange: (val) => {
              setDateFilterType(val);
              if (val !== 'custom') setCustomDate('');
            },
            colClass: 'col-12 col-md-4',
            options: [
              { value: 'all', label: t('All Dates') },
              { value: 'today', label: t('Today') },
              { value: 'yesterday', label: t('Yesterday') },
              { value: 'last7', label: t('Last 7 Days') },
              { value: 'custom', label: t('Custom Date…') }
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
      <div className="bg-white border rounded-4 p-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }} ref={dropdownRef}>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              {t('Loading notifications…')}
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
                  <h6 className="fw-semibold text-muted">{t('No notifications found')}</h6>
                  <p className="small text-muted mb-0">{t('No entries match your search query or selected filter.')}</p>
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
                        <h6 className="fw-bold mb-0 text-dark">{t(notif.title)}</h6>

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
                          <span className="badge bg-danger rounded-pill small ms-1">{t('New')}</span>
                        )}

                        {currentTab === 'deleted' && (
                          <span className="badge bg-danger bg-opacity-10 text-danger fw-normal ms-1">{t('Deleted')}</span>
                        )}
                      </div>

                      <p className="text-dark mb-1.5 small">{t(notif.message)}</p>

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
                            <FaExternalLinkAlt size={10} /> {t('View Report Details')}
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
                        title={t('Restore Notification')}
                      >
                        <FaTrashRestore /> {t('Restore')}
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm p-1 px-2"
                        onClick={() => handlePermanentDelete(notif)}
                        title={t('Permanently Delete')}
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  ) : (
                    /* Context 3-Dots Dropdown Menu for Active / Archived */
                    <div className="position-relative">
                      <button
                        className="btn btn-link text-muted p-1 rounded-circle border-0 shadow-none hover-bg-light"
                        title={t('Actions')}
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
                            <FaExternalLinkAlt /> {t('Go to Reports')}
                          </button>

                          <button
                            className="dropdown-item d-flex align-items-center gap-2 small py-2"
                            onClick={() => handleMarkReadToggle(notif)}
                          >
                            <FaCheckDouble className="text-secondary" />
                            {notif.is_read ? t('Mark as Unread') : t('Mark as Read')}
                          </button>

                          {currentTab !== 'archived' ? (
                            <button
                              className="dropdown-item d-flex align-items-center gap-2 small py-2 text-warning"
                              onClick={() => handleArchive(notif)}
                            >
                              <FaArchive /> {t('Archive')}
                            </button>
                          ) : (
                            <button
                              className="dropdown-item d-flex align-items-center gap-2 small py-2 text-success"
                              onClick={() => handleRestore(notif)}
                            >
                              <FaUndo /> {t('Restore Active')}
                            </button>
                          )}

                          <div className="dropdown-divider my-1"></div>

                          <button
                            className="dropdown-item d-flex align-items-center gap-2 small py-2 text-danger"
                            onClick={() => handleDelete(notif)}
                          >
                            <FaTrashAlt /> {t('Delete')}
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

      {/* Compose Live Alert Modal */}
      {showComposeModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 10550 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div
                className="modal-header px-4 py-3 border-0 text-white"
                style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)' }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 38, height: 38, backgroundColor: 'rgba(252, 86, 60, 0.2)', color: '#FC563C' }}
                  >
                    <FaBullhorn size={16} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-extrabold mb-0 text-white" style={{ fontSize: '1.15rem' }}>
                      {t('Send Live Notification to Caretaker')}
                    </h5>
                    <small className="text-white-50 extra-small">
                      {t('Dispatches an instant floating toast with chime sound directly to the caretaker screen')}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-70 hover-opacity-100"
                  onClick={() => setShowComposeModal(false)}
                />
              </div>

              {/* Modal Body */}
              <form onSubmit={handleDispatchLiveAlert}>
                <div className="modal-body p-4 bg-white">
                  {/* Quick Preset Templates */}
                  <div className="mb-3.5 p-3 rounded-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="extra-small fw-bold text-uppercase tracking-wider text-secondary">
                        ⚡ {t('Quick Fill Operational Presets:')}
                      </span>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-warning extra-small rounded-pill fw-bold d-inline-flex align-items-center gap-1"
                        style={{ backgroundColor: composeForm.alertType === 'harvest_ready' ? '#FEF3C7' : '#FFFFFF', color: '#D97706', borderColor: '#FCD34D' }}
                        onClick={() => applyPreset('harvest')}
                      >
                        🌾 {t('Ready for Harvest Alert')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger extra-small rounded-pill fw-bold d-inline-flex align-items-center gap-1"
                        style={{ backgroundColor: composeForm.alertType === 'urgent_action' ? '#FEE2E2' : '#FFFFFF', color: '#DC2626', borderColor: '#FCA5A5' }}
                        onClick={() => applyPreset('water')}
                      >
                        💧 {t('Urgent Water Parameter Check')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary extra-small rounded-pill fw-bold d-inline-flex align-items-center gap-1"
                        style={{ backgroundColor: composeForm.alertType === 'feeding_advisory' ? '#EFF6FF' : '#FFFFFF', color: '#2563EB', borderColor: '#BFDBFE' }}
                        onClick={() => applyPreset('feed')}
                      >
                        🍽️ {t('Feeding Adjustment SOP')}
                      </button>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    {/* Recipient Target */}
                    <div className="col-12 col-md-6">
                      <label className="form-label extra-small fw-bold text-uppercase tracking-wider text-secondary mb-1">
                        {t('Recipient Caretaker')} <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm rounded-3 py-2"
                        value={composeForm.recipientType === 'all' ? 'all' : composeForm.caretakerId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'all') {
                            setComposeForm((prev) => ({ ...prev, recipientType: 'all', caretakerId: '' }));
                          } else {
                            setComposeForm((prev) => ({ ...prev, recipientType: 'single', caretakerId: val }));
                          }
                        }}
                      >
                        <option value="all">📢 {t('All Assigned Caretakers (Broadcast to Everyone)')}</option>
                        {caretakersList.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            👤 {c.full_name} ({c.email || 'Caretaker'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Associated Pond */}
                    <div className="col-12 col-md-6">
                      <label className="form-label extra-small fw-bold text-uppercase tracking-wider text-secondary mb-1">
                        {t('Associated Pond (Optional)')}
                      </label>
                      <select
                        className="form-select form-select-sm rounded-3 py-2"
                        value={composeForm.pondName}
                        onChange={(e) => {
                          const p = e.target.value;
                          setComposeForm((prev) => ({
                            ...prev,
                            pondName: p,
                            title: prev.alertType === 'harvest_ready' ? `Ready for Harvest: ${p}` : prev.title,
                          }));
                        }}
                      >
                        <option value="">{t('None / Farm-wide General')}</option>
                        {pondsList.map((p) => (
                          <option key={p.id} value={p.pond_name}>
                            🏊 {p.pond_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    {/* Alert Type */}
                    <div className="col-12 col-md-6">
                      <label className="form-label extra-small fw-bold text-uppercase tracking-wider text-secondary mb-1">
                        {t('Alert Priority / Type')}
                      </label>
                      <select
                        className="form-select form-select-sm rounded-3 py-2"
                        value={composeForm.alertType}
                        onChange={(e) => setComposeForm((prev) => ({ ...prev, alertType: e.target.value }))}
                      >
                        <option value="harvest_ready">🌾 Harvest Ready (Ready for Harvest)</option>
                        <option value="urgent_action">🚨 Urgent Action Required</option>
                        <option value="feeding_advisory">🍽️ Feeding Advisory</option>
                        <option value="water_quality">💧 Water Quality Notice</option>
                        <option value="admin_announcement">📢 General Farm Announcement</option>
                      </select>
                    </div>

                    {/* Notification Title */}
                    <div className="col-12 col-md-6">
                      <label className="form-label extra-small fw-bold text-uppercase tracking-wider text-secondary mb-1">
                        {t('Notification Title')} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-3 py-2"
                        placeholder={t('e.g. Ready for Harvest: Pond A1')}
                        value={composeForm.title}
                        onChange={(e) => setComposeForm((prev) => ({ ...prev, title: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="mb-2">
                    <label className="form-label extra-small fw-bold text-uppercase tracking-wider text-secondary mb-1">
                      {t('Alert Message / Action Instructions')} <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control form-control-sm rounded-3 p-2.5"
                      rows="4"
                      placeholder={t('Enter the exact instructions or notice the caretaker will see on their screen...')}
                      value={composeForm.message}
                      onChange={(e) => setComposeForm((prev) => ({ ...prev, message: e.target.value }))}
                      required
                    />
                    <small className="text-muted extra-small mt-1 d-block">
                      💡 {t("The caretaker's device will play a chime sound and pop up a real-time floating card with this message.")}
                    </small>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer px-4 py-3 bg-light border-top d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-sm btn-light px-3.5 py-2 rounded-pill fw-semibold text-secondary"
                    onClick={() => setShowComposeModal(false)}
                    disabled={sendingAlert}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm text-white px-4 py-2 rounded-pill fw-bold shadow-xs hover-lift d-inline-flex align-items-center gap-1.5"
                    style={{ backgroundColor: '#FC563C' }}
                    disabled={sendingAlert}
                  >
                    {sendingAlert ? (
                      <>
                        <div className="spinner-border spinner-border-sm me-1" role="status" />
                        {t('Dispatching Live Alert...')}
                      </>
                    ) : (
                      <>
                        <FaPaperPlane size={11} />
                        {t('Dispatch Live Alert Now')}
                      </>
                    )}
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
