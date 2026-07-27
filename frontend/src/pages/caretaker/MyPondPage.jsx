import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaPlus,
  FaWater,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
const productCodes = ['Starter', 'Grower'];
const vitaminOptions = ['None', 'Sanolife PRO-2', 'Sano Top-S'];
const feedingTrayCount = 4;
const emptyForm = {
  feedingTime: '6:00 AM',
  amountKg: '',
  productCode: 'Starter',
  vitaminName: 'None',
  notes: '',
};

function getWeekKey(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((date - start) / 86400000) + 1;
  const week = Math.ceil((day + start.getDay()) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getSamplingStorageKey(userId, pondId, dateValue) {
  const samplingDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  return `shrim-sampling-${userId || 'guest'}-${pondId}-${getWeekKey(samplingDate)}`;
}

function formatKg(value) {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeTime(value) {
  return String(value || '').trim().toUpperCase();
}

export default function MyPondPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const suppressAutoTrayPromptRef = useRef(false);
  const trayPromptOpenRef = useRef(false);
  const assignedPonds = useMemo(() => (
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : [])
  ), [user?.assigned_ponds, user?.pond_id]);

  const [selectedPondId, setSelectedPondId] = useState('');
  const [formState, setFormState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [weeklySampling, setWeeklySampling] = useState(null);
  const [trayMonitoringBySlot, setTrayMonitoringBySlot] = useState({});

  const defaultDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [recordDate, setRecordDate] = useState(defaultDateStr);
  const todayDateStr = recordDate || defaultDateStr;

  useEffect(() => {
    if (!assignedPonds.length) {
      setSelectedPondId('');
      return;
    }

    const currentPondExists = assignedPonds.some((pond) => String(pond.id) === String(selectedPondId));
    if (!currentPondExists) {
      setSelectedPondId(String(assignedPonds[0].id));
    }
  }, [assignedPonds, selectedPondId]);

  const selectedPond = assignedPonds.find((pond) => String(pond.id) === String(selectedPondId)) || assignedPonds[0] || null;
  const currentForm = formState[selectedPondId] || emptyForm;
  const samplingKey = selectedPondId ? getSamplingStorageKey(user?.id, selectedPondId, todayDateStr) : '';

  useEffect(() => {
    if (!samplingKey) {
      setWeeklySampling(null);
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(samplingKey) || 'null');
      setWeeklySampling(stored?.shrimpWeightGrams ? stored : null);
    } catch (e) {
      setWeeklySampling(null);
    }
  }, [samplingKey]);

  // Fetch today's feeding logs for the active pond
  const fetchTodayLogs = useCallback(async (pondId) => {
    if (!pondId) return;
    try {
      const res = await api.get('/feeding_records.php', {
        params: {
          pond_id: pondId,
          date: todayDateStr,
        },
      });
      if (Array.isArray(res.data)) {
        setTodayLogs(res.data);
      } else {
        setTodayLogs([]);
      }
    } catch (e) {
      console.error('Error fetching today feeding logs:', e);
      setTodayLogs([]);
    }
  }, [todayDateStr]);

  useEffect(() => {
    if (!selectedPondId) return;
    setTrayMonitoringBySlot({});
    fetchTodayLogs(selectedPondId);

    const handleUpdate = () => fetchTodayLogs(selectedPondId);
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedPondId, todayDateStr, fetchTodayLogs]);

  // Extract list of feeding_time strings logged today for the active pond
  const loggedTimesForPond = useMemo(() => {
    return todayLogs.map((log) => log.feeding_time);
  }, [todayLogs]);

  const previousFeedingLogForSelectedSlot = useMemo(() => {
    const selectedIndex = feedingTimes.findIndex((time) => normalizeTime(time) === normalizeTime(currentForm.feedingTime));
    if (selectedIndex <= 0) return null;

    for (let index = selectedIndex - 1; index >= 0; index -= 1) {
      const previousTime = feedingTimes[index];
      const matchingLog = todayLogs.find((log) => normalizeTime(log.feeding_time) === normalizeTime(previousTime));
      if (matchingLog) return matchingLog;
    }

    return null;
  }, [currentForm.feedingTime, todayLogs]);

  const selectedSlotRequiresMonitoring = Boolean(
    previousFeedingLogForSelectedSlot
      && !loggedTimesForPond.some((logged) => normalizeTime(logged) === normalizeTime(currentForm.feedingTime))
  );

  const trayMonitoringKey = selectedPondId && currentForm.feedingTime
    ? `${selectedPondId}-${todayDateStr}-${normalizeTime(currentForm.feedingTime)}`
    : '';

  const feedingPlan = useMemo(() => {
    const amountKg = parseFloat(currentForm.amountKg);
    const shrimpWeightGrams = parseFloat(weeklySampling?.shrimpWeightGrams);
    if (!amountKg || amountKg <= 0 || !shrimpWeightGrams || shrimpWeightGrams <= 0) {
      return null;
    }

    const trayFeedGrams = amountKg * shrimpWeightGrams;
    const totalTrayFeedGrams = trayFeedGrams * feedingTrayCount;
    const broadcastFeedKg = Math.max(0, amountKg - (totalTrayFeedGrams / 1000));

    return {
      amountKg,
      shrimpWeightGrams,
      trayCount: feedingTrayCount,
      trayFeedGrams,
      totalTrayFeedGrams,
      broadcastFeedKg,
    };
  }, [currentForm.amountKg, weeklySampling]);

  // Auto-select first un-logged feeding time slot when changing pond or after log submission
  useEffect(() => {
    if (!selectedPondId) return;
    const availableSlot = feedingTimes.find((time) => !loggedTimesForPond.includes(time));
    if (availableSlot) {
      setFormState((prev) => ({
        ...prev,
        [selectedPondId]: {
          ...(prev[selectedPondId] || emptyForm),
          feedingTime: availableSlot,
        },
      }));
    }
  }, [selectedPondId, loggedTimesForPond]);

  const handleChange = (field, value) => {
    if (!selectedPondId) return;

    setFormState((prev) => ({
      ...prev,
      [selectedPondId]: {
        ...(prev[selectedPondId] || emptyForm),
        [field]: value,
      },
    }));
  };

  const requestWeeklySampling = async () => {
    const { value, isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Weekly shrimp sampling',
      text: `Enter the average shrimp weight in grams for ${selectedPond?.pond_name || 'this pond'} before logging feed.`,
      input: 'number',
      inputPlaceholder: 'Example: 3',
      inputAttributes: {
        min: '0.1',
        step: '0.1',
      },
      showCancelButton: true,
      confirmButtonText: 'Use sample weight',
      inputValidator: (inputValue) => {
        const grams = Number(inputValue);
        if (!grams || grams <= 0) return 'Please enter a valid shrimp weight in grams.';
        return null;
      },
    });

    if (!isConfirmed) return null;

    const nextSampling = {
      shrimpWeightGrams: Number(value),
      pondId: selectedPondId,
      pondName: selectedPond?.pond_name || '',
      week: getWeekKey(),
      sampledAt: new Date().toISOString(),
    };
    localStorage.setItem(samplingKey, JSON.stringify(nextSampling));
    setWeeklySampling(nextSampling);
    return nextSampling;
  };

  const requestTrayMonitoring = async () => {
    if (!selectedSlotRequiresMonitoring) return 'first_feeding';
    if (trayMonitoringKey && trayMonitoringBySlot[trayMonitoringKey]) {
      return trayMonitoringBySlot[trayMonitoringKey];
    }

    const previousAmount = Number(previousFeedingLogForSelectedSlot?.amount_kg || 0);
    const previousTime = previousFeedingLogForSelectedSlot?.feeding_time || 'previous feeding';
    const nextAmount = previousAmount > 0 ? previousAmount + 2 : 0;
    const { value, isConfirmed } = await Swal.fire({
      title: 'Feeding tray monitoring',
      html: `
        <div style="text-align:left; color:#334155;">
          <div style="border:1px solid #dbeafe; background:#eff6ff; border-radius:12px; padding:12px 14px; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:700; color:#1d4ed8; text-transform:uppercase;">Previous feeding</div>
            <div style="font-size:15px; margin-top:4px;">
              <strong>${previousTime}</strong> was <strong>${formatKg(previousAmount)} kg</strong>.
              Choose the tray result before logging <strong>${currentForm.feedingTime}</strong>.
            </div>
          </div>

          <label style="display:block; border:1px solid #bbf7d0; background:#f0fdf4; border-radius:12px; padding:12px 14px; margin-bottom:10px; cursor:pointer;">
            <input type="radio" name="tray-monitoring-choice" value="all_consumed" checked style="margin-right:8px;">
            <strong style="color:#15803d;">All 4 trays consumed</strong>
            <span style="display:block; margin-left:24px; font-size:13px; color:#475569;">
              Add 2 kg. Next feed becomes <strong>${formatKg(nextAmount)} kg</strong>.
            </span>
          </label>

          <label style="display:block; border:1px solid #fed7aa; background:#fff7ed; border-radius:12px; padding:12px 14px; margin-bottom:10px; cursor:pointer;">
            <input type="radio" name="tray-monitoring-choice" value="partial_leftover" style="margin-right:8px;">
            <strong style="color:#c2410c;">Some trays were not consumed</strong>
            <span style="display:block; margin-left:24px; font-size:13px; color:#475569;">
              Maintain the previous feed at <strong>${formatKg(previousAmount)} kg</strong>.
            </span>
          </label>

          <label style="display:block; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; padding:12px 14px; cursor:pointer;">
            <input type="radio" name="tray-monitoring-choice" value="heavy_leftover" style="margin-right:8px;">
            <strong style="color:#b91c1c;">Many trays were not consumed</strong>
            <span style="display:block; margin-left:24px; font-size:13px; color:#475569;">
              Maintain the previous feed at <strong>${formatKg(previousAmount)} kg</strong>.
            </span>
          </label>
        </div>
      `,
      width: 560,
      showCancelButton: true,
      confirmButtonText: 'Apply feed amount',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        const selected = document.querySelector('input[name="tray-monitoring-choice"]:checked');
        if (!selected) {
          Swal.showValidationMessage('Please choose a tray monitoring result.');
          return false;
        }
        return selected.value;
      },
    });

    if (!isConfirmed) return null;

    let monitoringResult = { status: value };
    if (value === 'all_consumed' && previousAmount > 0) {
      const nextAmount = previousAmount + 2;
      handleChange('amountKg', String(nextAmount));
      await Swal.fire({
        icon: 'info',
        title: 'Feed amount updated',
        text: `All 4 trays were consumed, so ${currentForm.feedingTime} feed is now ${formatKg(nextAmount)} kg (${formatKg(previousAmount)} kg + 2 kg).`,
        confirmButtonText: 'Continue',
      });
      monitoringResult = { status: value, suggestedAmountKg: nextAmount };
    }

    if (value !== 'all_consumed' && previousAmount > 0) {
      handleChange('amountKg', String(previousAmount));
      await Swal.fire({
        icon: 'info',
        title: 'Feed amount maintained',
        text: `Some feeding trays were not fully consumed, so ${currentForm.feedingTime} feed stays at ${formatKg(previousAmount)} kg.`,
        confirmButtonText: 'Continue',
      });
      monitoringResult = { status: value, suggestedAmountKg: previousAmount };
    }

    if (trayMonitoringKey) {
      setTrayMonitoringBySlot((prev) => ({
        ...prev,
        [trayMonitoringKey]: monitoringResult,
      }));
    }

    return monitoringResult;
  };

  useEffect(() => {
    if (!selectedSlotRequiresMonitoring || !trayMonitoringKey || trayMonitoringBySlot[trayMonitoringKey]) return;
    if (suppressAutoTrayPromptRef.current || submitting || trayPromptOpenRef.current) return;

    trayPromptOpenRef.current = true;
    requestTrayMonitoring().finally(() => {
      trayPromptOpenRef.current = false;
    });
  }, [selectedSlotRequiresMonitoring, trayMonitoringKey, trayMonitoringBySlot, submitting]);

  const handleSubmit = async () => {
    if (!selectedPond) return;

    const form = formState[selectedPondId] || emptyForm;
    let amount = parseFloat(form.amountKg);

    if (loggedTimesForPond.includes(form.feedingTime)) {
      Swal.fire({ icon: 'warning', title: 'Time Slot Already Logged', text: `Feeding record for ${form.feedingTime} has already been logged today for ${selectedPond.pond_name}.` });
      return;
    }

    const sampling = weeklySampling?.shrimpWeightGrams ? weeklySampling : await requestWeeklySampling();
    if (!sampling) return;

    const trayMonitoring = await requestTrayMonitoring();
    if (!trayMonitoring) return;

    if (trayMonitoring?.suggestedAmountKg) {
      amount = trayMonitoring.suggestedAmountKg;
    }

    if (!amount || amount <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid amount', text: 'Please enter a valid feeding amount in kilograms.' });
      return;
    }

    const shrimpWeightGrams = Number(sampling.shrimpWeightGrams);
    const trayFeedGrams = amount * shrimpWeightGrams;
    const totalTrayFeedGrams = trayFeedGrams * feedingTrayCount;
    const broadcastFeedKg = Math.max(0, amount - (totalTrayFeedGrams / 1000));
    const trayNotes = [
      `Weekly sample: ${shrimpWeightGrams}g average shrimp`,
      `Tray allocation: ${formatKg(trayFeedGrams)}g per tray x ${feedingTrayCount} trays = ${formatKg(totalTrayFeedGrams)}g`,
      `Broadcast feed: ${formatKg(broadcastFeedKg)}kg`,
      `Tray monitoring: ${trayMonitoring?.status || trayMonitoring}`,
    ].join(' | ');

    setSubmitting(true);
    try {
      const payload = {
        pond_id: Number(selectedPond.id),
        amount_kg: amount,
        feeding_time: form.feedingTime || '6:00 AM',
        product_code: form.productCode || 'Starter',
        vitamin_name: form.vitaminName || 'None',
        has_vitamin: form.vitaminName && form.vitaminName !== 'None' ? 1 : 0,
        shrimp_weight_grams: shrimpWeightGrams,
        tray_count: feedingTrayCount,
        tray_feed_grams: Number(trayFeedGrams.toFixed(2)),
        total_tray_feed_grams: Number(totalTrayFeedGrams.toFixed(2)),
        broadcast_feed_kg: Number(broadcastFeedKg.toFixed(3)),
        tray_monitoring_status: trayMonitoring?.status || trayMonitoring,
        notes: [form.notes, trayNotes].filter(Boolean).join(' | '),
        record_date: todayDateStr,
        recorded_by: user?.full_name || 'Caretaker',
        recorded_by_name: user?.full_name || 'Caretaker',
        user_id: Number(user?.id || 0),
      };

      const response = await api.post('/feeding_records.php', payload);
      const responseData = response?.data && typeof response.data === 'object' ? response.data : {};
      if (!responseData.success && responseData.message) throw new Error(responseData.message);
      if (!responseData.success) throw new Error('Unable to save feeding record.');

      suppressAutoTrayPromptRef.current = true;

      if (typeof window !== 'undefined') {
        localStorage.setItem('shrim-feed-updated', String(Date.now()));
        localStorage.setItem('shrim-notification-updated', String(Date.now()));
        window.dispatchEvent(new Event('shrim-feed-updated'));
        window.dispatchEvent(new Event('shrim-notification-updated'));
      }

      await Swal.fire({
        icon: 'success',
        title: 'Feeding Logged!',
        html: `
          <div style="text-align:left">
            <p><strong>${formatKg(amount)} kg</strong> saved for ${selectedPond.pond_name} at ${form.feedingTime}.</p>
            <p class="mb-1">Tray feed: <strong>${formatKg(trayFeedGrams)}g</strong> per tray x ${feedingTrayCount} = <strong>${formatKg(totalTrayFeedGrams)}g</strong></p>
            <p class="mb-0">Broadcast to pond: <strong>${formatKg(broadcastFeedKg)} kg</strong></p>
          </div>
        `,
      });

      setFormState((prev) => ({
        ...prev,
        [selectedPond.id]: { ...emptyForm, amountKg: '', notes: '' },
      }));

      navigate('/caretaker/dashboard', { replace: true });
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unable to save feeding record.';
      console.error('Feeding save error', error);
      Swal.fire({ icon: 'error', title: 'Save failed', text: backendMessage });
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignedPonds.length) {
    return (
      <div className="caretaker-mypond-page">
        <div className="caretaker-empty-state">
          <p className="text-muted mb-0">No ponds assigned to you yet. Please contact your admin.</p>
        </div>
      </div>
    );
  }

  const allSlotsCompleted = feedingTimes.every((time) => loggedTimesForPond.includes(time));

  return (
    <div className="caretaker-mypond-page">
      {/* Hero Workspace Header */}
      <section className="caretaker-dashboard-hero caretaker-mypond-hero mb-4">
        <div>
          <span className="caretaker-dashboard-kicker">Pond Feeding Workspace</span>
          <h3>{selectedPond?.pond_name || 'My Pond'}</h3>
          <p>Select an assigned pond tab below to log real feeding records and manage daily schedules.</p>
          <div className="caretaker-hero-meta">
            <span>{assignedPonds.length} assigned pond(s)</span>
            <span>Tateh {currentForm.productCode}</span>
            <span>{currentForm.feedingTime}</span>
          </div>
        </div>
      </section>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <h6 className="fw-bold mb-1">Demo feeding date</h6>
            <p className="small text-muted mb-0">Change this to demo another day or next week without deleting feeding history.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input
              type="date"
              className="form-control"
              value={todayDateStr}
              onChange={(event) => setRecordDate(event.target.value || defaultDateStr)}
              style={{ minWidth: 180 }}
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setRecordDate(defaultDateStr)}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* 3 Pond Selector Tabs (Pond A1, Pond A2, Pond A3) */}
      <div className="caretaker-pond-tabs mb-4">
        {assignedPonds.map((pond) => (
          <button
            type="button"
            key={pond.id}
            className={String(pond.id) === String(selectedPondId) ? 'active' : ''}
            onClick={() => setSelectedPondId(String(pond.id))}
          >
            <FaWater className="me-1.5" />
            {pond.pond_name}
          </button>
        ))}
      </div>

      {/* Main Feeding Form Panel Card */}
      <div className="card caretaker-panel-card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="caretaker-panel-header d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1">Log Feeding Entry</h5>
              <p className="text-muted small mb-0">
                Save a real feeding record for <strong className="text-primary">{selectedPond?.pond_name || 'this pond'}</strong>.
              </p>
            </div>
            <div className="caretaker-history-total d-flex align-items-center gap-2 bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill extra-small fw-semibold">
              <FaClipboardList />
              <span>{loggedTimesForPond.length} of 5 scheduled times completed today</span>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-4">
              <div className="p-3 rounded-4 bg-light border h-100">
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="small fw-bold text-dark">Weekly shrimp sample</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={requestWeeklySampling}
                    disabled={!selectedPondId || allSlotsCompleted}
                  >
                    {weeklySampling?.shrimpWeightGrams ? 'Update' : 'Set'}
                  </button>
                </div>
                <h4 className="fw-bold text-primary mb-1">
                  {weeklySampling?.shrimpWeightGrams ? `${weeklySampling.shrimpWeightGrams}g` : '-'}
                </h4>
                <p className="extra-small text-muted mb-0">
                  Required once per week before feeding logs. Example: 3g average shrimp.
                </p>
              </div>
            </div>

            <div className="col-12 col-lg-8">
              <div className="p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-25 h-100">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <div>
                    <span className="small fw-bold text-primary">Feeding tray computation</span>
                    <p className="extra-small text-muted mb-0">4 trays are reserved first; remaining feed is broadcast to the pond.</p>
                  </div>
                  <span className="badge bg-white text-primary border">Tray count: {feedingTrayCount}</span>
                </div>
                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <small className="text-muted d-block">Per tray</small>
                    <strong>{feedingPlan ? `${formatKg(feedingPlan.trayFeedGrams)}g` : '-'}</strong>
                  </div>
                  <div className="col-6 col-md-3">
                    <small className="text-muted d-block">All trays</small>
                    <strong>{feedingPlan ? `${formatKg(feedingPlan.totalTrayFeedGrams)}g` : '-'}</strong>
                  </div>
                  <div className="col-6 col-md-3">
                    <small className="text-muted d-block">Broadcast</small>
                    <strong>{feedingPlan ? `${formatKg(feedingPlan.broadcastFeedKg)}kg` : '-'}</strong>
                  </div>
                  <div className="col-6 col-md-3">
                    <small className="text-muted d-block">Formula</small>
                    <strong>{feedingPlan ? `${formatKg(feedingPlan.amountKg)} x ${feedingPlan.shrimpWeightGrams}g` : '-'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time Slot Buttons with Cross-Out / Disabled Logic for Completed Daily Slots */}
          <div className="caretaker-feeding-time-grid mb-4">
            {feedingTimes.map((time) => {
              const isLoggedToday = loggedTimesForPond.includes(time);
              const isSelected = currentForm.feedingTime === time;

              return (
                <button
                  type="button"
                  key={time}
                  disabled={isLoggedToday}
                  className={`btn-time-slot ${isSelected ? 'active' : ''} ${isLoggedToday ? 'logged-crossed-out' : ''}`}
                  style={
                    isLoggedToday
                      ? {
                          textDecoration: 'line-through',
                          opacity: 0.65,
                          cursor: 'not-allowed',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          borderColor: '#cbd5e1',
                          pointerEvents: 'none',
                        }
                      : {}
                  }
                  onClick={() => !isLoggedToday && handleChange('feedingTime', time)}
                  title={isLoggedToday ? `${time} already logged today` : `Select ${time}`}
                >
                  {isLoggedToday ? (
                    <FaCheckCircle className="text-success me-1 fs-6" />
                  ) : (
                    <FaClock className="me-1 opacity-75" />
                  )}
                  <span className={isLoggedToday ? 'text-decoration-line-through text-muted fw-bold' : 'fw-bold'}>
                    {time}
                  </span>
                </button>
              );
            })}
          </div>

          {allSlotsCompleted && (
            <div className="alert alert-success d-flex align-items-center gap-2 p-3 mb-4 rounded-3">
              <FaCheckCircle className="fs-5 text-success flex-shrink-0" />
              <div>
                <strong className="d-block">All Daily Feeding Slots Logged!</strong>
                <span className="small">All 5 scheduled daily feeding times for {selectedPond?.pond_name} have been recorded for today.</span>
              </div>
            </div>
          )}

          {/* 3-Column Responsive Grid Form (Amount kg, Product Code, Vitamins) - Selected Pond Removed */}
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Amount (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="form-control form-control-lg fs-6"
                value={currentForm.amountKg}
                onChange={(event) => handleChange('amountKg', event.target.value)}
                placeholder="Enter amount in kilograms"
                disabled={allSlotsCompleted}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Product Code</label>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.productCode}
                onChange={(event) => handleChange('productCode', event.target.value)}
                disabled={allSlotsCompleted}
              >
                {productCodes.map((code) => (
                  <option key={code} value={code}>
                    {code} (Tateh)
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small">Starter or Grower only.</small>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Vitamins</label>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.vitaminName || 'None'}
                onChange={(event) => handleChange('vitaminName', event.target.value)}
                disabled={allSlotsCompleted}
              >
                {vitaminOptions.map((vit) => (
                  <option key={vit} value={vit}>
                    {vit === 'None' ? 'None (No Vitamin)' : vit}
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small">Sanolife PRO-2 or Sano Top-S.</small>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold text-dark">Notes (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={currentForm.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              placeholder="Add a note if needed"
              disabled={allSlotsCompleted}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg w-100 py-3 fw-bold caretaker-log-button d-flex align-items-center justify-content-center gap-2"
            disabled={submitting || allSlotsCompleted}
            onClick={handleSubmit}
          >
            {submitting ? (
              'Saving...'
            ) : (
              <>
                <FaPlus /> Log Feeding for {selectedPond?.pond_name || 'Selected Pond'} ({currentForm.feedingTime})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
