import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaPlus,
  FaWater,
  FaLock,
  FaUnlock,
  FaCamera,
  FaEye,
  FaSync,
  FaTimes,
  FaExclamationTriangle,
  FaThermometerHalf,
  FaFlask,
  FaVial,
  FaMicrochip,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';

const resolveImageUrl = (url) => {
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
  return `http://localhost/shrim_predict_api/backend/${cleanPath.replace(/^\/+/, '')}`;
};

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

  // Water Quality Inspection Protocol States
  const [waterQualityStatus, setWaterQualityStatus] = useState({}); // { [pondId]: { is_verified, record } }
  const [loadingWaterQuality, setLoadingWaterQuality] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [inspectProofModal, setInspectProofModal] = useState(null);

  const fetchWaterQualityStatus = useCallback(async (pondId) => {
    if (!pondId) return;
    try {
      setLoadingWaterQuality(true);
      const res = await api.get('/water_quality_records.php', {
        params: {
          pond_id: pondId,
          date: todayDateStr,
        },
      });
      setWaterQualityStatus((prev) => ({
        ...prev,
        [pondId]: res.data || { is_verified: false, record: null },
      }));
    } catch (e) {
      console.error('Error fetching water quality status:', e);
    } finally {
      setLoadingWaterQuality(false);
    }
  }, [todayDateStr]);

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

  // Current selected pond water quality status
  const currentPondWq = selectedPondId ? waterQualityStatus[selectedPondId] : null;
  const isPondWqVerified = Boolean(currentPondWq?.is_verified);
  const activeWqRecord = currentPondWq?.record;

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
    fetchWaterQualityStatus(selectedPondId);

    const handleUpdate = () => {
      fetchTodayLogs(selectedPondId);
      fetchWaterQualityStatus(selectedPondId);
    };

    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedPondId, todayDateStr, fetchTodayLogs, fetchWaterQualityStatus]);

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
      title: '🍽 Feeding Tray Monitoring',
      customClass: {
        popup: 'shrim-swal-popup',
        title: 'shrim-swal-title',
        confirmButton: 'btn btn-gold-glow px-4 py-2.5 rounded-3 fw-bold me-2 shadow-sm',
        cancelButton: 'btn btn-secondary px-4 py-2.5 rounded-3 fw-semibold',
      },
      buttonsStyling: false,
      html: `
        <div style="text-align:left;">
          <div class="tray-info-box previous-info mb-3">
            <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;" class="mb-1">
              PREVIOUS FEEDING LOG
            </div>
            <div style="font-size:14.5px; line-height:1.5;">
              <strong style="color:inherit">${previousTime}</strong> was <strong style="color:inherit">${formatKg(previousAmount)} kg</strong>.
              Choose the tray result before logging <strong style="color:inherit">${currentForm.feedingTime}</strong>.
            </div>
          </div>

          <label class="tray-option-card consumed-all">
            <div class="d-flex align-items-center gap-2 mb-1">
              <input type="radio" name="tray-monitoring-choice" value="all_consumed" checked style="accent-color:#16a34a; width:18px; height:18px;" />
              <strong style="font-size:15px; color:inherit">All 4 trays consumed</strong>
            </div>
            <span style="display:block; margin-left:26px; font-size:13px; opacity:0.9; color:inherit">
              Add 2 kg. Next feed becomes <strong style="color:inherit">${formatKg(nextAmount)} kg</strong>.
            </span>
          </label>

          <label class="tray-option-card consumed-some">
            <div class="d-flex align-items-center gap-2 mb-1">
              <input type="radio" name="tray-monitoring-choice" value="partial_leftover" style="accent-color:#ea580c; width:18px; height:18px;" />
              <strong style="font-size:15px; color:inherit">Some trays were not consumed</strong>
            </div>
            <span style="display:block; margin-left:26px; font-size:13px; opacity:0.9; color:inherit">
              Maintain the previous feed at <strong style="color:inherit">${formatKg(previousAmount)} kg</strong>.
            </span>
          </label>

          <label class="tray-option-card consumed-many">
            <div class="d-flex align-items-center gap-2 mb-1">
              <input type="radio" name="tray-monitoring-choice" value="heavy_leftover" style="accent-color:#dc2626; width:18px; height:18px;" />
              <strong style="font-size:15px; color:inherit">Many trays were not consumed</strong>
            </div>
            <span style="display:block; margin-left:26px; font-size:13px; opacity:0.9; color:inherit">
              Maintain the previous feed at <strong style="color:inherit">${formatKg(previousAmount)} kg</strong>.
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

    if (!isPondWqVerified) {
      Swal.fire({
        icon: 'warning',
        title: 'Water Quality Protocol Required',
        html: `Per O & B Aqua Farm SOP, you must verify today's water quality parameters (DO, Temp, pH, Salinity) for <strong>${selectedPond.pond_name}</strong> via Dual-Mode OCR before logging feeding records.`,
        showCancelButton: true,
        confirmButtonText: 'Launch OCR Scanner',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0B2C5F',
      }).then((res) => {
        if (res.isConfirmed) {
          setIsOcrModalOpen(true);
        }
      });
      return;
    }

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
    <div className="caretaker-mypond-hub">
      {/* 🌟 HERO CONTROL STRIP: STATUS BADGE, TITLE & DEMO DATE PILL */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill fw-bold extra-small"
              style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
            >
              ● BASIN CARE & FEEDING
            </span>
            <span className="text-muted extra-small">
              Real-time Tray Calculations • Dual-Mode Water Quality Gate
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 mt-1 tracking-tight text-dark" style={{ fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            {selectedPond?.pond_name || 'My Pond'} Operations
          </h2>
        </div>

        {/* Demo Feeding Date Pill */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-white border shadow-xs">
            <FaClock size={12} style={{ color: '#0284C7' }} />
            <span className="extra-small fw-semibold text-muted">Test Date:</span>
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-transparent p-0 extra-small fw-bold text-dark"
              value={todayDateStr}
              onChange={(event) => setRecordDate(event.target.value || defaultDateStr)}
              style={{ width: 125, outline: 'none' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-pill px-3 py-1.5 extra-small fw-semibold shadow-xs"
            onClick={() => setRecordDate(defaultDateStr)}
          >
            Reset to Today
          </button>
        </div>
      </div>

      {/* 🌟 POND SELECTOR PILL TABS */}
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        {assignedPonds.map((pond) => {
          const pondWq = waterQualityStatus[pond.id];
          const isVerified = Boolean(pondWq?.is_verified);
          const isSelected = String(pond.id) === String(selectedPondId);

          return (
            <button
              type="button"
              key={pond.id}
              className={`btn btn-sm rounded-pill px-3.5 py-2 fw-semibold d-inline-flex align-items-center gap-2 transition-all ${
                isSelected
                  ? 'btn-dark text-white shadow-sm'
                  : 'btn-white bg-white text-dark border'
              }`}
              style={{
                borderColor: isSelected ? '#0B2C5F' : 'rgba(226, 232, 240, 0.9)',
                backgroundColor: isSelected ? '#0B2C5F' : '#FFFFFF',
              }}
              onClick={() => setSelectedPondId(String(pond.id))}
            >
              <FaWater size={12} style={{ color: isSelected ? '#38BDF8' : '#0284C7' }} />
              <span>{pond.pond_name}</span>
              {isVerified ? (
                <span
                  className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded-pill"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(22, 163, 74, 0.12)',
                    color: isSelected ? '#FFFFFF' : '#16A34A',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                  }}
                >
                  <span className="rounded-circle" style={{ width: 5, height: 5, backgroundColor: isSelected ? '#FFFFFF' : '#16A34A' }} />
                  Verified
                </span>
              ) : (
                <span
                  className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded-pill"
                  style={{
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                    color: isSelected ? '#FDE68A' : '#D97706',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                  }}
                >
                  <span className="rounded-circle" style={{ width: 5, height: 5, backgroundColor: isSelected ? '#FDE68A' : '#F59E0B' }} />
                  Needs Test
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 🌟 WATER QUALITY GATE PROTOCOL CARD OR VERIFIED STATUS BANNER */}
      {!isPondWqVerified ? (
        <div
          className="asymmetric-card mb-4 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 55%, #991B1B 100%)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
          }}
        >
          <div className="card-body p-4 text-white">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3.5">
              <div className="d-flex align-items-start gap-3">
                <div
                  className="rounded-4 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                  style={{
                    width: 54,
                    height: 54,
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    color: '#FFFFFF',
                    fontSize: '1.4rem',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.45)',
                  }}
                >
                  <FaLock />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <h5 className="fw-extrabold mb-0 text-white tracking-tight">
                      Daily Water Quality Inspection Required
                    </h5>
                    <span className="badge bg-danger text-white rounded-pill px-2.5 py-1 extra-small fw-bold shadow-xs">
                      🔒 Monitoring & Feeding Locked
                    </span>
                  </div>
                  <p className="text-white text-opacity-85 small mb-0 mt-1" style={{ maxWidth: 640, lineHeight: 1.5 }}>
                    Per <strong>O & B Aqua Farm</strong> standard protocol, handheld parameter testing (Dissolved Oxygen, Temperature, pH, and Salinity) must be verified via <strong>Dual-Mode OCR</strong> for <strong>{selectedPond?.pond_name}</strong> before daily monitoring and feeding logs can be accessed.
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                <button
                  type="button"
                  className="btn btn-warning rounded-pill px-4 py-2.5 fw-extrabold shadow-sm d-flex align-items-center gap-2 text-dark"
                  style={{ fontSize: '0.88rem' }}
                  onClick={() => setIsOcrModalOpen(true)}
                >
                  <FaCamera size={14} /> Launch Dual-Mode OCR Scanner
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="asymmetric-card mb-4 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '1.5px solid #86EFAC',
          }}
        >
          <div className="card-body p-3.5 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 44, height: 44, background: '#16A34A', color: '#FFFFFF', fontSize: '1.25rem' }}
              >
                <FaCheckCircle />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h6 className="fw-bold mb-0 text-dark">
                    Today's Water Quality Verified for {selectedPond?.pond_name}
                  </h6>
                  <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill extra-small fw-bold">
                    ✓ Gate Unlocked
                  </span>
                </div>
                <div className="d-flex align-items-center gap-3 flex-wrap mt-1 text-secondary extra-small">
                  <span><strong>DO:</strong> {activeWqRecord?.dissolved_oxygen} mg/L</span>
                  <span>•</span>
                  <span><strong>Temp:</strong> {activeWqRecord?.temperature}°C</span>
                  <span>•</span>
                  <span><strong>pH:</strong> {activeWqRecord?.ph_level}</span>
                  <span>•</span>
                  <span><strong>Salinity:</strong> {activeWqRecord?.salinity} ppt</span>
                  <span>•</span>
                  <span className="badge bg-white text-dark border">
                    {activeWqRecord?.capture_mode === 'device_screen' ? 'LCD Meter Scan' : 'Logsheet Table Scan'}
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {activeWqRecord?.image_path && (
                <button
                  type="button"
                  className="btn btn-sm btn-white bg-white border text-dark fw-bold rounded-pill px-3 py-1.5 shadow-xs d-flex align-items-center gap-1.5"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setInspectProofModal(activeWqRecord)}
                >
                  <FaEye size={12} className="text-primary" /> View Photo Proof
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-outline-success bg-white fw-bold rounded-pill px-3 py-1.5 shadow-xs d-flex align-items-center gap-1.5"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setIsOcrModalOpen(true)}
              >
                <FaSync size={11} /> Re-scan / Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Feeding Form Panel Card */}
      <div className="asymmetric-card p-4 mb-4">
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h5 className="fw-extrabold text-dark mb-1 tracking-tight">Log Feeding Entry</h5>
            <p className="text-muted small mb-0">
              Save a verified feeding record for <strong className="text-primary">{selectedPond?.pond_name || 'this pond'}</strong>.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill extra-small fw-bold" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
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
                disabled={!isPondWqVerified || allSlotsCompleted}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Product Code</label>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.productCode}
                onChange={(event) => handleChange('productCode', event.target.value)}
                disabled={!isPondWqVerified || allSlotsCompleted}
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
                disabled={!isPondWqVerified || allSlotsCompleted}
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
              disabled={!isPondWqVerified || allSlotsCompleted}
            />
          </div>

          {!isPondWqVerified ? (
            <button
              type="button"
              className="btn btn-secondary btn-lg w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #334155 0%, #0F172A 100%)', border: 'none' }}
              onClick={() => setIsOcrModalOpen(true)}
            >
              <FaLock /> Verify Water Quality via OCR to Unlock Feeding for {selectedPond?.pond_name}
            </button>
          ) : (
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
          )}
        </div>
      </div>

      {/* 🌟 DUAL-MODE OCR WATER QUALITY MODAL */}
      <WaterQualityOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        assignedPonds={assignedPonds}
        initialPondId={selectedPondId}
        caretakerName={user?.full_name || 'Caretaker'}
        caretakerId={user?.id}
        onSuccess={(record) => {
          if (selectedPondId) {
            fetchWaterQualityStatus(selectedPondId);
          }
        }}
      />

      {/* 🌟 INSPECTION PHOTO PROOF MODAL */}
      {inspectProofModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 overflow-hidden bg-white shadow-xl">
              <div
                className="p-3.5 px-4 text-white d-flex justify-content-between align-items-center"
                style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 100%)' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <FaEye className="text-info" />
                  <h6 className="fw-bold mb-0 text-white">Water Quality Photo Proof</h6>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light rounded-circle p-1.5 d-flex align-items-center justify-content-center"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setInspectProofModal(null)}
                >
                  <FaTimes size={12} />
                </button>
              </div>

              <div className="modal-body p-3 text-center" style={{ background: '#0F172A' }}>
                <img
                  src={resolveImageUrl(inspectProofModal.image_path)}
                  alt="Inspection Proof"
                  className="img-fluid rounded-3"
                  style={{ maxHeight: 420, objectFit: 'contain', width: '100%' }}
                />
              </div>

              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="extra-small text-muted">
                  <span><strong>Basin:</strong> {selectedPond?.pond_name}</span>
                  <span className="ms-3"><strong>Mode:</strong> {inspectProofModal.capture_mode === 'device_screen' ? 'LCD Meter Scan' : 'Logsheet Table'}</span>
                  <span className="ms-3"><strong>Date:</strong> {inspectProofModal.recorded_at || inspectProofModal.record_date}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-3.5 py-1.5 extra-small fw-bold"
                  onClick={() => setInspectProofModal(null)}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
