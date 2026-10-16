import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaCheckCircle, FaClipboardList, FaClock, FaExclamationCircle, FaPlay, FaRedo, FaSpinner, FaTools, FaWater } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

const feedingSlots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

function getLocalDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeFeedingTime(value = '') {
  const time = String(value).toUpperCase().replace(/\s+/g, ' ').trim();
  if (time.includes('6:00 PM') || time.includes('6:00PM') || time.includes('6 PM') || time.startsWith('18:')) return '6:00 PM';
  if (time.includes('6:00 AM') || time.includes('6:00AM') || time.includes('6 AM') || time.startsWith('06:') || (time.startsWith('6:') && !time.includes('PM'))) return '6:00 AM';
  if (time.includes('9:00 AM') || time.includes('9:00AM') || time.includes('9 AM') || time.startsWith('09:') || time.startsWith('9:')) return '9:00 AM';
  if (time.includes('12:00 PM') || time.includes('12:00PM') || time.includes('12 PM') || time.startsWith('12:')) return '12:00 PM';
  if (time.includes('3:00 PM') || time.includes('3:00PM') || time.includes('3 PM') || time.startsWith('15:') || (time.startsWith('3:') && !time.includes('AM'))) return '3:00 PM';
  return time;
}

export default function MyTasksPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ponds, setPonds] = useState([]);
  const [feedingRecords, setFeedingRecords] = useState([]);
  const [waterChecklist, setWaterChecklist] = useState([]);
  const [scanActions, setScanActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoadError, setActionLoadError] = useState('');
  const [updatingActionId, setUpdatingActionId] = useState(null);

  const today = useMemo(() => getLocalDateString(), []);

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setLoadError(t('myTasks.loadError', 'Unable to identify the caretaker account.'));
      return;
    }

    setLoading(true);
    setLoadError('');
    const [pondsResult, feedsResult, waterResult, actionsResult] = await Promise.allSettled([
      api.get('/caretaker_ponds.php', { params: { user_id: user.id } }),
      api.get('/feeding_records.php', {
        params: { user_id: user.id, recorded_by_name: user.full_name || '' },
      }),
      api.get('/water_quality_records.php', { params: { caretaker_id: user.id } }),
      api.get('/shrimp_scan_actions.php', { params: { user_id: user.id } }),
    ]);

    const errors = [];
    let assignedPonds = user.assigned_ponds || [];

    if (pondsResult.status === 'fulfilled' && pondsResult.value.data?.success) {
      assignedPonds = safeArray(pondsResult.value.data.ponds);
    } else {
      errors.push(t('myTasks.pondError', 'Could not load assigned ponds.'));
    }

    if (feedsResult.status === 'fulfilled' && Array.isArray(feedsResult.value.data)) {
      setFeedingRecords(feedsResult.value.data);
    } else {
      setFeedingRecords([]);
      errors.push(t('myTasks.feedingError', 'Could not load today’s feeding records.'));
    }

    if (waterResult.status === 'fulfilled' && waterResult.value.data?.success) {
      setWaterChecklist(safeArray(waterResult.value.data.checklist));
    } else {
      setWaterChecklist([]);
      errors.push(t('myTasks.waterError', 'Could not load water-quality checklist.'));
    }

    if (actionsResult.status === 'fulfilled' && actionsResult.value.data?.success) {
      const actions = safeArray(actionsResult.value.data.actions);
      setScanActions(actions.filter((action) => (
        action.status !== 'Done' || String(action.scan_date || '') === today
      )));
      setActionLoadError('');
    } else {
      setScanActions([]);
      setActionLoadError(t('myTasks.actionError', 'Could not load admin-assigned actions.'));
    }

    if (assignedPonds.length === 0 && user.pond_id) {
      assignedPonds = [{ id: user.pond_id, pond_name: t('myTasks.assignedPond', 'Assigned Pond') }];
    }
    setPonds(assignedPonds);
    setLoadError(errors.join(' '));
    setLoading(false);
  }, [t, user]);

  useEffect(() => {
    loadTasks();
    const handleUpdate = () => loadTasks();
    const refreshAssignedActions = async () => {
      if (!user?.id) return;
      try {
        const response = await api.get('/shrimp_scan_actions.php', { params: { user_id: user.id } });
        if (!response.data?.success) {
          throw new Error(response.data?.message || t('myTasks.actionError', 'Could not load admin-assigned actions.'));
        }
        const actions = safeArray(response.data.actions);
        setScanActions(actions.filter((action) => (
          action.status !== 'Done' || String(action.scan_date || '') === today
        )));
        setActionLoadError('');
      } catch (error) {
        console.error('Unable to refresh caretaker scan actions:', error);
        setActionLoadError(t('myTasks.actionError', 'Could not load admin-assigned actions.'));
      }
    };
    const actionRefreshInterval = window.setInterval(refreshAssignedActions, 15000);
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    window.addEventListener('shrim-notification-updated', handleUpdate);
    return () => {
      window.clearInterval(actionRefreshInterval);
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
      window.removeEventListener('shrim-notification-updated', handleUpdate);
    };
  }, [loadTasks, t, today, user?.id]);

  const tasks = useMemo(() => {
    const pondIds = new Set(ponds.map((pond) => String(pond.id)));
    const todaysFeeds = feedingRecords.filter((record) => {
      const recordDate = String(record.record_date || record.created_at || '').slice(0, 10);
      return recordDate === today && pondIds.has(String(record.pond_id));
    });
    const waterByPond = new Map(waterChecklist.map((item) => [String(item.pond_id), item]));

    const waterTasks = ponds.map((pond) => {
      const checklistItem = waterByPond.get(String(pond.id));
      const isComplete = Boolean(checklistItem?.is_verified || checklistItem?.is_verified_today || checklistItem?.record);
      return {
        id: `water-${pond.id}`,
        type: 'water',
        pond,
        isComplete,
        route: '/caretaker/dashboard',
        title: t('myTasks.waterTitle', 'Complete the initial water-quality check'),
        detail: t('myTasks.waterDetail', 'Verify dissolved oxygen, temperature, pH, and salinity before stocking shrimp.'),
      };
    });

    const feedTasks = ponds.flatMap((pond) => {
      const pondFeeds = todaysFeeds.filter((record) => String(record.pond_id) === String(pond.id));
      const loggedSlots = new Set(pondFeeds.map((record) => normalizeFeedingTime(record.feeding_time)));
      return feedingSlots.map((slot) => ({
        id: `feed-${pond.id}-${slot}`,
        type: 'feeding',
        pond,
        slot,
        isComplete: loggedSlots.has(slot),
        route: '/caretaker/my-pond',
        title: t('myTasks.feedTitle', 'Log the scheduled feeding'),
        detail: `${t('myTasks.slot', 'Feeding slot')}: ${slot}`,
      }));
    });

    const adminActionTasks = scanActions.map((action) => ({
      id: `admin-action-${action.id}`,
      type: 'admin-action',
      action,
      pond: { id: action.pond_name, pond_name: action.pond_name },
      isComplete: action.status === 'Done',
      title: t('myTasks.adminActionTitle', 'Complete the admin-assigned action'),
      detail: action.decision,
    }));

    return [...adminActionTasks, ...waterTasks, ...feedTasks];
  }, [feedingRecords, ponds, scanActions, t, today, waterChecklist]);

  const completedCount = tasks.filter((task) => task.isComplete).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;
  const firstIncompleteIndex = tasks.findIndex((task) => !task.isComplete);

  const updateAdminAction = async (task, status) => {
    setUpdatingActionId(task.action.id);
    try {
      const response = await api.post('/shrimp_scan_actions.php', {
        action: 'update_status',
        id: task.action.id,
        user_id: user.id,
        status,
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || t('myTasks.actionUpdateError', 'Unable to update this action.'));
      }
      window.dispatchEvent(new Event('shrim-notification-updated'));
      Swal.fire({
        icon: 'success',
        title: status === 'Done'
          ? t('myTasks.actionDone', 'Action marked done')
          : t('myTasks.actionInProgress', 'Action marked in progress'),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('myTasks.actionUpdateError', 'Unable to update this action.'),
        text: error?.response?.data?.message || error.message,
      });
    } finally {
      setUpdatingActionId(null);
    }
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-3 caretaker-dashboard-hub">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <FaClipboardList style={{ color: '#FC563C' }} />
            <h3 className="fw-extrabold text-dark mb-0">{t('myTasks.title', 'My Tasks')}</h3>
          </div>
          <p className="text-muted small mb-0">
            {t('myTasks.subtitle', 'Follow the checklist in order. Completion updates from your saved pond records.')}
          </p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2" onClick={loadTasks} disabled={loading}>
          {loading ? <FaSpinner className="fa-spin" /> : <FaRedo />}
          {t('myTasks.refresh', 'Refresh tasks')}
        </button>
      </div>

      {loadError && (
        <div className="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <FaExclamationCircle className="mt-1 flex-shrink-0" />
          <div>{loadError} {t('myTasks.refreshHint', 'Some task statuses may be incomplete until the data loads successfully.')}</div>
        </div>
      )}
      {actionLoadError && (
        <div className="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <FaExclamationCircle className="mt-1 flex-shrink-0" />
          <div>{actionLoadError} {t('myTasks.refreshHint', 'Some task statuses may be incomplete until the data loads successfully.')}</div>
        </div>
      )}

      <section className="bg-white border rounded-4 p-3 p-md-4 mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h5 className="fw-bold text-dark mb-1">{t('myTasks.progress', 'Today’s progress')}</h5>
            <p className="small text-muted mb-0">
              {allComplete
                ? t('myTasks.allComplete', 'All listed tasks are complete. Great work!')
                : t('myTasks.progressCount', '{done} of {total} tasks complete')
                  .replace('{done}', String(completedCount))
                  .replace('{total}', String(tasks.length))}
            </p>
          </div>
          <span className={`badge rounded-pill px-3 py-2 ${allComplete ? 'bg-success' : 'bg-light text-dark border'}`}>
            {tasks.length ? `${Math.round((completedCount / tasks.length) * 100)}%` : '0%'}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={completedCount} aria-valuemin="0" aria-valuemax={tasks.length || 1} style={{ height: 9 }}>
          <div className="progress-bar" style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%`, backgroundColor: '#FC563C' }} />
        </div>
      </section>

      {loading ? (
        <div className="text-center text-muted py-5">
          <FaSpinner className="fa-spin me-2" />{t('myTasks.loading', 'Loading your tasks…')}
        </div>
      ) : ponds.length === 0 && tasks.length === 0 ? (
        <div className="bg-white border rounded-4 text-center p-5">
          <FaWater className="fs-2 mb-3" style={{ color: '#94A3B8' }} />
          <h5 className="fw-bold">{t('myTasks.noPondsTitle', 'No ponds assigned')}</h5>
          <p className="text-muted mb-0">{t('myTasks.noPonds', 'Ask your farm administrator to assign a pond to your caretaker account.')}</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {tasks.map((task, index) => {
            const isNext = index === firstIncompleteIndex;
            return (
              <article
                key={task.id}
                className={`bg-white border rounded-4 p-3 p-md-4 shadow-sm ${isNext ? 'border-2' : ''}`}
                style={isNext ? { borderColor: '#FC563C' } : undefined}
              >
                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 38,
                      height: 38,
                      backgroundColor: task.isComplete ? '#DCFCE7' : isNext ? '#FFF1ED' : '#F1F5F9',
                      color: task.isComplete ? '#15803D' : isNext ? '#FC563C' : '#64748B',
                    }}
                    aria-label={task.isComplete ? t('myTasks.completed', 'Completed') : t('myTasks.notCompleted', 'Not completed')}
                  >
                    {task.isComplete ? <FaCheck /> : task.type === 'admin-action' ? <FaTools /> : task.type === 'water' ? <FaWater /> : <FaClock />}
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <h6 className="fw-bold mb-0">{task.title}</h6>
                      {isNext && <span className="badge rounded-pill" style={{ backgroundColor: '#FFF1ED', color: '#C2410C' }}>{t('myTasks.next', 'NEXT')}</span>}
                      {task.type === 'admin-action' ? (
                        <span className={`badge ${
                          task.action.status === 'Done'
                            ? 'bg-success-subtle text-success'
                            : task.action.status === 'In Progress'
                              ? 'bg-primary-subtle text-primary'
                              : 'bg-warning-subtle text-warning-emphasis'
                        }`}>
                          {t(task.action.status)}
                        </span>
                      ) : task.isComplete && <span className="badge bg-success-subtle text-success">{t('myTasks.done', 'Done')}</span>}
                    </div>
                    <div className="small fw-semibold mb-1" style={{ color: '#FC563C' }}>
                      {task.type === 'admin-action' && `${t('myTasks.adminDecision', 'Admin decision')} · `}
                      {task.pond.pond_name || task.pond.name || `${t('myTasks.pond', 'Pond')} #${task.pond.id}`}
                      {task.slot ? ` · ${task.slot}` : ''}
                    </div>
                    <p className="small text-muted mb-0">{task.detail}</p>
                  </div>
                  {task.type === 'admin-action' ? (
                    <div className="d-flex flex-column flex-sm-row gap-2 flex-shrink-0">
                      {task.action.status !== 'In Progress' && !task.isComplete && (
                        <button
                          type="button"
                          className={isNext ? 'btn btn-tri-orange btn-sm fw-bold text-nowrap' : 'btn btn-outline-primary btn-sm fw-semibold text-nowrap'}
                          disabled={updatingActionId === task.action.id}
                          onClick={() => updateAdminAction(task, 'In Progress')}
                        >
                          {updatingActionId === task.action.id ? <FaSpinner className="fa-spin me-1" /> : <FaPlay className="me-1" />}
                          {t('myTasks.doingNow', 'Doing now')}
                        </button>
                      )}
                      {!task.isComplete && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm fw-bold text-nowrap"
                          disabled={updatingActionId === task.action.id}
                          onClick={() => updateAdminAction(task, 'Done')}
                        >
                          {updatingActionId === task.action.id
                            ? <FaSpinner className="fa-spin me-1" />
                            : <FaCheckCircle className="me-1" />}
                          {t('myTasks.markDone', 'Mark done')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={isNext ? 'btn btn-tri-orange btn-sm fw-bold text-nowrap' : 'btn btn-outline-secondary btn-sm fw-semibold text-nowrap'}
                      onClick={() => {
                        if (task.type === 'feeding' && !task.isComplete) {
                          navigate('/caretaker/my-pond', {
                            state: {
                              feedingTask: {
                                pondId: task.pond.id,
                                slot: task.slot,
                              },
                            },
                          });
                          return;
                        }
                        navigate(task.type === 'feeding' ? '/caretaker/feeding-history' : task.route);
                      }}
                    >
                      {task.isComplete ? t('myTasks.view', 'View') : t('myTasks.proceed', 'Proceed')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
