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
  FaCalendarAlt,
  FaSeedling,
  FaFilter,
  FaBan,
  FaHistory,
  FaEdit,
  FaTrash
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';
import WaterQualityHistoryModal from '../../components/WaterQualityHistoryModal';
import PondCycleCalendar from '../../components/PondCycleCalendar';

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
  amountGrams: '',
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

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return 1;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = new Date((targetDateStr || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return 1;
  const diffTime = t - s;
  return Math.floor(diffTime / 86400000) + 1;
}

export default function MyPondPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const suppressAutoTrayPromptRef = useRef(false);
  const trayPromptOpenRef = useRef(false);

  const [dbPonds, setDbPonds] = useState([]);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [formState, setFormState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [weeklySampling, setWeeklySampling] = useState(null);
  const [trayMonitoringBySlot, setTrayMonitoringBySlot] = useState({});
  const [editingRecord, setEditingRecord] = useState(null);

  const defaultDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [recordDate, setRecordDate] = useState(defaultDateStr);
  const todayDateStr = recordDate || defaultDateStr;
  const isPastDate = todayDateStr !== defaultDateStr;

  // Filter ponds by culture stage relative to selected date: 'all' | 'nursery' | 'growout'
  const [stageFilter, setStageFilter] = useState('all');
  const [showCycleCalendar, setShowCycleCalendar] = useState(false);

  // Fetch updated ponds from backend to ensure stocking_date is present
  useEffect(() => {
    let isMounted = true;
    const loadPonds = async () => {
      try {
        if (user?.id) {
          const res = await api.get('/caretaker_ponds.php', { params: { user_id: user.id } });
          if (isMounted && res.data?.success && Array.isArray(res.data.ponds) && res.data.ponds.length > 0) {
            setDbPonds(res.data.ponds);
          }
        }
      } catch (e) {
        console.error('Error fetching caretaker ponds:', e);
      }
    };
    loadPonds();
    return () => { isMounted = false; };
  }, [user?.id]);

  const assignedPonds = useMemo(() => {
    if (dbPonds.length > 0) return dbPonds;
    if (user?.assigned_ponds?.length) return user.assigned_ponds;
    if (user?.pond_id) return [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }];
    return [];
  }, [dbPonds, user?.assigned_ponds, user?.pond_id]);

  // Water Quality Inspection Protocol States
  const [waterQualityStatus, setWaterQualityStatus] = useState({}); // { [pondId]: { is_verified, record } }
  const [loadingWaterQuality, setLoadingWaterQuality] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingWqRecord, setEditingWqRecord] = useState(null);
  const [ocrTargetDate, setOcrTargetDate] = useState('');
  const [inspectProofModal, setInspectProofModal] = useState(null);

  // Enrich assigned ponds with DOC and Stage (Nursery: Days 1–19, Grow-out: Day 20+) relative to recordDate
  const pondsWithStage = useMemo(() => {
    return assignedPonds.map((pond) => {
      const doc = computeDoc(pond.stocking_date, todayDateStr);
      const isNursery = doc >= 1 && doc <= 19;
      const isGrowout = doc >= 20;
      return {
        ...pond,
        doc,
        stage: isNursery ? 'nursery' : (isGrowout ? 'growout' : 'prestock'),
        recommendedFeed: isGrowout ? 'Grower' : 'Starter',
      };
    });
  }, [assignedPonds, todayDateStr]);

  const nurseryCount = useMemo(() => pondsWithStage.filter((p) => p.stage === 'nursery').length, [pondsWithStage]);
  const growoutCount = useMemo(() => pondsWithStage.filter((p) => p.stage === 'growout').length, [pondsWithStage]);

  const filteredPonds = useMemo(() => {
    if (stageFilter === 'nursery') return pondsWithStage.filter((p) => p.stage === 'nursery');
    if (stageFilter === 'growout') return pondsWithStage.filter((p) => p.stage === 'growout');
    return pondsWithStage;
  }, [pondsWithStage, stageFilter]);

  const fetchWaterQualityStatus = useCallback(async (pondId) => {
    if (!pondId) return;
    try {
      setLoadingWaterQuality(true);
      const res = await api.get('/water_quality_records.php', {
        params: {
          pond_id: pondId,
        },
      });

      const newData = res.data && typeof res.data === 'object'
        ? {
            ...res.data,
            is_verified: Boolean(res.data.is_verified ?? res.data.record),
            record: res.data.record || null,
          }
        : { is_verified: false, record: null };

      setWaterQualityStatus((prev) => ({
        ...prev,
        [pondId]: newData,
      }));
    } catch (e) {
      console.error('Error fetching water quality status:', e);
    } finally {
      setLoadingWaterQuality(false);
    }
  }, []);

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
  const selectedPondWithStage = pondsWithStage.find((pond) => String(pond.id) === String(selectedPondId)) || pondsWithStage[0] || null;

  const currentDoc = selectedPondWithStage?.doc ?? 1;
  const currentStage = selectedPondWithStage?.stage ?? 'nursery';
  const autoProductCode = currentDoc >= 20 ? 'Grower' : 'Starter';

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

    const handleUpdate = (event) => {
      const { pond_id, record } = event?.detail || {};

      if (pond_id && String(pond_id) === String(selectedPondId)) {
        setWaterQualityStatus((prev) => ({
          ...prev,
          [pond_id]: {
            ...(prev[pond_id] || {}),
            is_verified: true,
            record: record || prev[pond_id]?.record || null,
            data: record || prev[pond_id]?.data || null,
          },
        }));
      }

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

  const isNurseryStage = currentStage === 'nursery' || currentDoc <= 19;

  const selectedSlotRequiresMonitoring = Boolean(
    !isNurseryStage
      && previousFeedingLogForSelectedSlot
      && !loggedTimesForPond.some((logged) => normalizeTime(logged) === normalizeTime(currentForm.feedingTime))
  );

  const trayMonitoringKey = selectedPondId && currentForm.feedingTime
    ? `${selectedPondId}-${todayDateStr}-${normalizeTime(currentForm.feedingTime)}`
    : '';

  const feedingPlan = useMemo(() => {
    const rawGrams = parseFloat(currentForm.amountGrams);
    const amountKg = !isNaN(rawGrams) ? rawGrams / 1000 : parseFloat(currentForm.amountKg);
    if (isNaN(amountKg) || amountKg < 0) {
      return null;
    }

    if (isNurseryStage) {
      return {
        amountKg,
        amountGrams: amountKg * 1000,
        isNursery: true,
        trayCount: 0,
        trayFeedGrams: 0,
        totalTrayFeedGrams: 0,
        broadcastFeedKg: amountKg,
      };
    }

    const shrimpWeightGrams = parseFloat(weeklySampling?.shrimpWeightGrams);
    if (!amountKg || amountKg <= 0 || !shrimpWeightGrams || shrimpWeightGrams <= 0) {
      return null;
    }

    const trayFeedGrams = amountKg * shrimpWeightGrams;
    const totalTrayFeedGrams = trayFeedGrams * feedingTrayCount;
    const broadcastFeedKg = Math.max(0, amountKg - (totalTrayFeedGrams / 1000));

    return {
      amountKg,
      amountGrams: amountKg * 1000,
      isNursery: false,
      shrimpWeightGrams,
      trayCount: feedingTrayCount,
      trayFeedGrams,
      totalTrayFeedGrams,
      broadcastFeedKg,
    };
  }, [currentForm.amountKg, currentForm.amountGrams, weeklySampling, isNurseryStage]);

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

  // Farm Rule 1: Auto-switch feed between Starter (Days 1–19 Nursery) and Grower (Day 20+ Grow-out)
  useEffect(() => {
    if (!selectedPondId) return;
    setFormState((prev) => {
      const current = prev[selectedPondId] || emptyForm;
      if (current.productCode !== autoProductCode) {
        return {
          ...prev,
          [selectedPondId]: {
            ...current,
            productCode: autoProductCode,
          },
        };
      }
      return prev;
    });
  }, [selectedPondId, autoProductCode]);

  // Farm SOP: Vitamins are consumed consistently across both Nursery and Grow-out stages.
  const isFifthFeeding = useMemo(() => {
    const slotNormalized = normalizeTime(currentForm.feedingTime);
    return slotNormalized === '6:00 PM';
  }, [currentForm.feedingTime]);

  const handleChange = (field, value) => {
    if (!selectedPondId) return;

    setFormState((prev) => {
      const current = prev[selectedPondId] || emptyForm;
      const updated = { ...current, [field]: value };
      if (field === 'amountGrams') {
        const g = parseFloat(value);
        updated.amountKg = isNaN(g) ? '' : (g / 1000).toFixed(3);
      } else if (field === 'amountKg') {
        const kg = parseFloat(value);
        updated.amountGrams = isNaN(kg) ? '' : String(Math.round(kg * 1000));
      }
      return {
        ...prev,
        [selectedPondId]: updated,
      };
    });
  };

  const handleSelectSlot = (time) => {
    const matchingLog = todayLogs.find((log) => normalizeTime(log.feeding_time) === normalizeTime(time));
    if (matchingLog) {
      setEditingRecord(matchingLog);
      const gramsVal = matchingLog.amount_grams !== undefined && matchingLog.amount_grams !== null
        ? String(matchingLog.amount_grams)
        : String(Math.round((parseFloat(matchingLog.amount_kg) || 0) * 1000));
      setFormState((prev) => ({
        ...prev,
        [selectedPondId]: {
          amountGrams: gramsVal,
          amountKg: String(matchingLog.amount_kg || ''),
          feedingTime: matchingLog.feeding_time,
          productCode: matchingLog.product_code || autoProductCode,
          vitaminName: matchingLog.vitamin_name || 'None',
          notes: matchingLog.notes || '',
        },
      }));
    } else {
      setEditingRecord(null);
      handleChange('feedingTime', time);
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    const unloggedTime = feedingTimes.find((t) => !loggedTimesForPond.includes(t)) || '6:00 AM';
    setFormState((prev) => ({
      ...prev,
      [selectedPondId]: {
        ...emptyForm,
        feedingTime: unloggedTime,
      },
    }));
  };

  const handleDeleteRecord = async (record) => {
    if (!record?.id) return;
    const confirm = await Swal.fire({
      title: 'Delete Feeding Record?',
      text: `Are you sure you want to delete the ${record.feeding_time} feeding entry (${record.amount_kg}kg) for ${selectedPond?.pond_name} on ${todayDateStr}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await api.post('/feeding_records.php', {
        action: 'delete',
        id: record.id,
      });
      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Feeding record has been removed.',
          timer: 1500,
          showConfirmButton: false,
        });
        if (editingRecord?.id === record.id) {
          handleCancelEdit();
        }
        if (selectedPondId) {
          fetchTodayLogs(selectedPondId);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('shrim-feed-updated'));
        }
      } else {
        throw new Error(res.data?.message || 'Failed to delete record.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err.response?.data?.message || err.message || 'Could not delete feeding record.',
      });
    }
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
        cancelButton: 'btn btn-outline-light px-3 py-2 rounded-3 text-secondary',
      },
      buttonsStyling: false,
      html: `
        <div style="text-align:left; font-family: inherit;">
          <p class="text-secondary small mb-3">
            Two hours have elapsed since the <strong>${previousTime}</strong> feeding. Inspect all 4 feeding trays in <strong>${selectedPond?.pond_name || 'this pond'}</strong>:
          </p>
          <div class="tray-options d-flex flex-column gap-2 mb-3">
            <label class="p-2.5 rounded-3 border d-flex align-items-center gap-2 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="tray_status" value="empty" checked />
              <span><strong>Trays are completely empty:</strong> Shrimp consumed all feed rapidly. Increase next feeding by 2kg (${nextAmount ? `${nextAmount} kg` : 'recommended'}).</span>
            </label>
            <label class="p-2.5 rounded-3 border d-flex align-items-center gap-2 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="tray_status" value="normal" />
              <span><strong>Normal consumption:</strong> Normal trace amounts remain. Maintain planned schedule.</span>
            </label>
            <label class="p-2.5 rounded-3 border d-flex align-items-center gap-2 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="tray_status" value="leftover" />
              <span><strong>Substantial leftover:</strong> Satiation or water quality stress. Reduce feed and report.</span>
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirm Tray Inspection',
      cancelButtonText: 'Skip Inspection',
      preConfirm: () => {
        const checked = document.querySelector('input[name="tray_status"]:checked');
        return checked ? checked.value : 'normal';
      },
    });

    if (!isConfirmed) return null;

    let monitoringResult = value;
    if (value === 'empty' && nextAmount > 0) {
      monitoringResult = {
        status: 'empty',
        suggestedAmountKg: nextAmount,
      };
    } else {
      monitoringResult = {
        status: value,
      };
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
    if (isPastDate || editingRecord) return; // Skip automatic tray modal popup when backfilling past dates

    trayPromptOpenRef.current = true;
    requestTrayMonitoring().finally(() => {
      trayPromptOpenRef.current = false;
    });
  }, [selectedSlotRequiresMonitoring, trayMonitoringKey, trayMonitoringBySlot, submitting, isPastDate, editingRecord]);

  const handleSubmit = async () => {
    if (!selectedPond) return;

    // For live feeding, require pre-stocking baseline water quality verification if not done yet
    if (!isPastDate && !isPondWqVerified) {
      const choice = await Swal.fire({
        icon: 'info',
        title: 'Initial Water Quality Scan Required',
        html: `Pre-stocking water quality testing for <strong>${selectedPond.pond_name}</strong> has not been verified yet.<br/><br/>O&B Aqua Farm requires a one-time baseline water quality scan before initiating pond monitoring. Would you like to launch the OCR scanner now?`,
        showCancelButton: true,
        confirmButtonText: 'Launch OCR Scanner',
        cancelButtonText: 'Continue Anyway',
        confirmButtonColor: '#0B2C5F',
        cancelButtonColor: '#6B7280',
      });
      if (choice.isConfirmed) {
        setIsOcrModalOpen(true);
        return;
      }
    }

    const form = formState[selectedPondId] || emptyForm;
    const rawGrams = form.amountGrams !== undefined && form.amountGrams !== '' ? parseFloat(form.amountGrams) : (parseFloat(form.amountKg) * 1000);
    const grams = isNaN(rawGrams) ? 0 : rawGrams;
    let amount = parseFloat((grams / 1000).toFixed(3));

    if (isNaN(grams) || grams < 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Please enter a valid feeding amount in grams (0 or more).' });
      return;
    }

    // Only reject duplicate slot if NOT currently editing that slot
    const isEditingCurrentSlot = editingRecord && normalizeTime(editingRecord.feeding_time) === normalizeTime(form.feedingTime);
    if (!isEditingCurrentSlot && loggedTimesForPond.includes(form.feedingTime)) {
      Swal.fire({
        icon: 'warning',
        title: 'Time Slot Already Logged',
        text: `Feeding record for ${form.feedingTime} has already been logged on ${todayDateStr} for ${selectedPond.pond_name}. Click on the slot to edit it instead.`,
      });
      return;
    }

    let sampling = null;
    let trayMonitoring = null;

    if (isNurseryStage) {
      // Nursery stage (DOC 1-19): No sampling, no tray monitoring (100% broadcast)
      sampling = null;
      trayMonitoring = { status: 'Nursery (No Trays • 100% Broadcast)' };
    } else if (isPastDate || editingRecord) {
      // Fast historical backfill / edit mode: bypass modal prompt blockers
      sampling = weeklySampling?.shrimpWeightGrams ? weeklySampling : { shrimpWeightGrams: 3.0 };
      trayMonitoring = { status: editingRecord ? (editingRecord.tray_monitoring_status || 'Manual Entry') : 'Farm Log Backfill' };
    } else {
      sampling = weeklySampling?.shrimpWeightGrams ? weeklySampling : await requestWeeklySampling();
      if (!sampling) return;

      trayMonitoring = await requestTrayMonitoring();
      if (!trayMonitoring) return;

      if (trayMonitoring?.suggestedAmountKg) {
        amount = trayMonitoring.suggestedAmountKg;
      }
    }

    const shrimpWeightGrams = isNurseryStage ? null : Number(sampling?.shrimpWeightGrams || 3.0);
    const trayFeedGrams = isNurseryStage ? 0 : amount * (shrimpWeightGrams || 3.0);
    const totalTrayFeedGrams = isNurseryStage ? 0 : trayFeedGrams * feedingTrayCount;
    const broadcastFeedKg = isNurseryStage ? amount : Math.max(0, amount - (totalTrayFeedGrams / 1000));
    const trayNotes = isNurseryStage
      ? `Nursery Day ${currentDoc}: 100% Broadcast (${grams}g / ${formatKg(amount)}kg)`
      : [
          `Sample: ${shrimpWeightGrams}g avg shrimp`,
          `Trays (${feedingTrayCount}): ${formatKg(totalTrayFeedGrams)}g`,
          `Broadcast: ${formatKg(broadcastFeedKg)}kg`,
          `Tray check: ${trayMonitoring?.status || trayMonitoring}`,
        ].join(' | ');

    setSubmitting(true);
    try {
      const payload = {
        action: editingRecord ? 'update' : 'insert',
        record_id: editingRecord ? editingRecord.id : undefined,
        is_update: Boolean(editingRecord),
        pond_id: Number(selectedPond.id),
        amount_kg: amount,
        amount_grams: grams,
        feeding_time: form.feedingTime || '6:00 AM',
        product_code: form.productCode || autoProductCode,
        vitamin_name: form.vitaminName || 'None',
        has_vitamin: form.vitaminName && form.vitaminName !== 'None' ? 1 : 0,
        shrimp_weight_grams: shrimpWeightGrams,
        tray_count: isNurseryStage ? 0 : feedingTrayCount,
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
        title: editingRecord ? 'Feeding Log Updated!' : (isPastDate ? 'Historical Feeding Saved!' : 'Feeding Logged!'),
        html: `
          <div style="text-align:left">
            <p><strong>${grams} g (${formatKg(amount)} kg)</strong> of <strong>${payload.product_code}</strong> saved for ${selectedPond.pond_name} on <strong>${todayDateStr}</strong> (${form.feedingTime}).</p>
            ${isNurseryStage
              ? '<p class="mb-0 text-success"><strong>Nursery Mode:</strong> 100% Broadcast into basin (No trays required).</p>'
              : `<p class="mb-1">Tray feed: <strong>${formatKg(trayFeedGrams)}g</strong> per tray x ${feedingTrayCount} = <strong>${formatKg(totalTrayFeedGrams)}g</strong></p>
                 <p class="mb-0">Broadcast to pond: <strong>${formatKg(broadcastFeedKg)} kg</strong></p>`
            }
          </div>
        `,
      });

      const wasEditing = Boolean(editingRecord);
      setEditingRecord(null);

      // Reset form and pick next available unlogged slot
      const nextUnlogged = feedingTimes.find((t) => t !== form.feedingTime && !loggedTimesForPond.includes(t)) || '6:00 AM';
      setFormState((prev) => ({
        ...prev,
        [selectedPond.id]: { ...emptyForm, amountKg: '', notes: '', feedingTime: nextUnlogged },
      }));

      fetchTodayLogs(selectedPond.id);

      // If logging for today and not backfilling/editing, take them to dashboard.
      // If backfilling past dates, STAY on this date so they can keep backfilling!
      if (!isPastDate && !wasEditing) {
        navigate('/caretaker/dashboard', { replace: true });
      }
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

        {/* Date Filter & Cycle Calendar Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-white border shadow-xs">
            <FaCalendarAlt size={12} style={{ color: '#0284C7' }} />
            <span className="extra-small fw-semibold text-muted">Filter Date:</span>
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-transparent p-0 extra-small fw-bold text-dark"
              value={todayDateStr}
              onChange={(event) => setRecordDate(event.target.value || defaultDateStr)}
              style={{ width: 125, outline: 'none' }}
              title="Filter ponds by date to see which are in Nursery vs Grow-out"
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 extra-small fw-bold shadow-xs d-flex align-items-center gap-1.5"
            onClick={() => setShowCycleCalendar(true)}
            title="Open Cycle Calendar showing Nursery (Days 1-19) and Grow-out (Day 20+) highlights"
          >
            <FaCalendarAlt size={11} /> Pond Cycle Calendar
          </button>

          <button
            type="button"
            className="btn btn-sm btn-light border rounded-pill px-3 py-1.5 extra-small fw-semibold shadow-xs"
            onClick={() => setRecordDate(defaultDateStr)}
          >
            Reset to Today
          </button>
        </div>
      </div>

      {/* 🌟 STAGE FILTER TABS: All Ponds | Nursery Basins (Starter) | Grow-out Basins (Grower) */}
      <div className="p-3.5 rounded-4 bg-white border shadow-xs mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2.5">
          <div className="d-flex align-items-center gap-2">
            <FaFilter size={13} style={{ color: '#0B2C5F' }} />
            <span className="fw-extrabold text-uppercase extra-small" style={{ color: '#0B2C5F', letterSpacing: '0.4px', fontSize: '0.78rem' }}>
              ACTIVE FILTERS (Pond Stage on {new Date(todayDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}):
            </span>
          </div>

          <div className="text-end ms-auto">
            <span className="extra-small text-muted fw-bold text-uppercase d-block mb-0.5" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
              STAGE DEFINITIONS:
            </span>
            <span className="extra-small text-muted" style={{ fontSize: '0.76rem' }}>
              <strong>Nursery:</strong> Days 1–19 • <strong>Grow-out:</strong> Day 20+
            </span>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* All Ponds Filter Button */}
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all"
            style={{
              backgroundColor: stageFilter === 'all' ? '#1E293B' : '#F1F5F9',
              borderColor: '#E2E8F0',
              color: stageFilter === 'all' ? '#FFFFFF' : '#334155',
            }}
            onClick={() => setStageFilter('all')}
          >
            <span>All Ponds</span>
            <span
              className="badge rounded-circle px-2 py-1"
              style={{
                backgroundColor: stageFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#CBD5E1',
                color: stageFilter === 'all' ? '#FFFFFF' : '#1E293B',
                fontSize: '0.72rem',
                minWidth: '20px',
              }}
            >
              {assignedPonds.length}
            </span>
          </button>

          {/* Nursery Basins (Starter) Filter Button */}
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all"
            style={{
              backgroundColor: stageFilter === 'nursery' ? '#059669' : '#ECFDF5',
              color: stageFilter === 'nursery' ? '#FFFFFF' : '#065F46',
              border: '1px solid #A7F3D0',
            }}
            onClick={() => setStageFilter('nursery')}
          >
            <span>Nursery Basins (Starter)</span>
            <span
              className="badge rounded-circle px-2 py-1"
              style={{
                backgroundColor: stageFilter === 'nursery' ? '#FFFFFF' : '#059669',
                color: stageFilter === 'nursery' ? '#059669' : '#FFFFFF',
                fontSize: '0.72rem',
                minWidth: '20px',
              }}
            >
              {nurseryCount}
            </span>
          </button>

          {/* Grow-out Basins (Grower) Filter Button (WITHOUT FISH EMOJI) */}
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all"
            style={{
              backgroundColor: stageFilter === 'growout' ? '#2563EB' : '#EFF6FF',
              color: stageFilter === 'growout' ? '#FFFFFF' : '#1D4ED8',
              border: '1px solid #BFDBFE',
            }}
            onClick={() => setStageFilter('growout')}
          >
            <span>Grow-out Basins (Grower)</span>
            <span
              className="badge rounded-circle px-2 py-1"
              style={{
                backgroundColor: stageFilter === 'growout' ? '#FFFFFF' : '#2563EB',
                color: stageFilter === 'growout' ? '#2563EB' : '#FFFFFF',
                fontSize: '0.72rem',
                minWidth: '20px',
              }}
            >
              {growoutCount}
            </span>
          </button>
        </div>
      </div>

      {/* POND SELECTOR PILL TABS */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        {filteredPonds.length === 0 ? (
          <div className="alert alert-warning py-2 px-3 mb-0 rounded-pill small w-100">
            No ponds match the "{stageFilter === 'nursery' ? 'Nursery' : 'Grow-out'}" phase on {todayDateStr}.
            <button
              type="button"
              className="btn btn-link btn-sm p-0 ms-2 text-decoration-none fw-bold"
              onClick={() => setStageFilter('all')}
            >
              Show all ponds
            </button>
          </div>
        ) : (
          filteredPonds.map((pond) => {
            const pondWq = waterQualityStatus[pond.id];
            const isVerified = Boolean(pondWq?.is_verified);
            const isSelected = String(pond.id) === String(selectedPondId);
            const isNursery = pond.stage === 'nursery';

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

                {/* Culture Stage Badge */}
                <span
                  className="badge rounded-pill px-2 py-0.5"
                  style={{
                    backgroundColor: isSelected
                      ? (isNursery ? '#10B981' : '#3B82F6')
                      : (isNursery ? '#DCFCE7' : '#DBEAFE'),
                    color: isSelected
                      ? '#FFFFFF'
                      : (isNursery ? '#15803D' : '#1D4ED8'),
                    fontSize: '0.67rem',
                    fontWeight: 700,
                  }}
                >
                  {isNursery ? `Day ${pond.doc} • Nursery` : `Day ${pond.doc} • Grow-out`}
                </span>

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
          })
        )}
      </div>

      {/* ACTIVE BASIN CULTURE STAGE BANNER */}
      {selectedPond && (
        <div
          className="p-3 rounded-4 mb-4 border d-flex justify-content-between align-items-center flex-wrap gap-2"
          style={{
            backgroundColor: currentDoc >= 20 ? '#EFF6FF' : '#F0FDF4',
            borderColor: currentDoc >= 20 ? '#BFDBFE' : '#BBF7D0',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center"
              style={{
                width: 42,
                height: 42,
                backgroundColor: currentDoc >= 20 ? '#DBEAFE' : '#DCFCE7',
                color: currentDoc >= 20 ? '#1D4ED8' : '#15803D',
              }}
            >
              {currentDoc >= 20 ? <FaWater size={18} /> : <FaSeedling size={18} />}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <strong className="text-dark fs-6">{selectedPond.pond_name}</strong>
                <span
                  className="badge rounded-pill px-2.5 py-1 fw-extrabold"
                  style={{
                    backgroundColor: currentDoc >= 20 ? '#2563EB' : '#059669',
                    color: '#fff',
                    fontSize: '0.75rem',
                  }}
                >
                  Day {currentDoc} of Culture ({currentDoc >= 20 ? 'Grow-out Phase' : 'Nursery Phase'})
                </span>
                {selectedPond.stocking_date && (
                  <span className="extra-small text-muted">
                    Stocked on {selectedPond.stocking_date}
                  </span>
                )}
              </div>
              <p className="extra-small text-muted mb-0 mt-0.5">
                {currentDoc >= 20 ? (
                  <>
                    <strong className="text-primary">Grow-out Pond Active</strong>: Shrimp transferred on Day 20. Required feed formulation is <strong>Tateh - Grower</strong>.
                  </>
                ) : (
                  <>
                    <strong className="text-success">Nursery Pond Active</strong>: Days 1–19 culture window. Required feed formulation is <strong>Tateh - Starter</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5"
            onClick={() => setShowCycleCalendar(true)}
          >
            <FaCalendarAlt size={11} /> View Full Cycle Calendar
          </button>
        </div>
      )}

      {/* WATER QUALITY GATE PROTOCOL CARD OR VERIFIED STATUS BANNER */}
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
                      Pre-Stocking Water Quality Scan Required
                    </h5>
                    <span
                      className="badge rounded-pill px-2.5 py-1 extra-small fw-bold shadow-xs bg-warning text-dark"
                    >
                      ⚠️ Initial Baseline Pending
                    </span>
                  </div>
                  <p className="text-white text-opacity-85 small mb-0 mt-1" style={{ maxWidth: 640, lineHeight: 1.5 }}>
                    O&B Aqua Farm Protocol: An initial one-time water quality scan (DO, Temp, pH, Salinity) must be verified before stocking shrimp and logging daily feeding records for <strong>{selectedPond?.pond_name}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0 d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-light rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-1.5 extra-small"
                  onClick={() => setIsHistoryModalOpen(true)}
                  title="Browse historical logs and edit past dates"
                >
                  <FaHistory size={11} /> Past Logs &amp; History
                </button>
                <button
                  type="button"
                  className="btn btn-warning rounded-pill px-3.5 py-2 fw-extrabold shadow-sm d-flex align-items-center gap-2 text-dark"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => {
                    setEditingWqRecord(null);
                    setOcrTargetDate(todayDateStr);
                    setIsOcrModalOpen(true);
                  }}
                >
                  <FaCamera size={13} /> Verify Pre-Stocking WQ (OCR)
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
                    Pre-Stocking Water Quality Verified for {selectedPond?.pond_name}
                  </h6>
                  <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill extra-small fw-bold">
                    ✓ Verified (Baseline)
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

            <div className="d-flex align-items-center gap-2 flex-wrap">
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
                className="btn btn-sm btn-outline-secondary bg-white fw-bold rounded-pill px-3 py-1.5 shadow-xs d-flex align-items-center gap-1.5"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setIsHistoryModalOpen(true)}
                title="Browse and manage all historical logs for this pond"
              >
                <FaHistory size={11} className="text-info" /> History &amp; Past Logs
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-success bg-white fw-bold rounded-pill px-3 py-1.5 shadow-xs d-flex align-items-center gap-1.5"
                style={{ fontSize: '0.8rem' }}
                onClick={() => {
                  setEditingWqRecord(activeWqRecord || null);
                  setOcrTargetDate(todayDateStr);
                  setIsOcrModalOpen(true);
                }}
              >
                <FaEdit size={11} /> Edit / Re-scan ({todayDateStr})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAST DATE FEEDING BACKFILL MODE BANNER */}
      {isPastDate && (
        <div
          className="p-3 mb-4 rounded-4 border d-flex justify-content-between align-items-center flex-wrap gap-2 shadow-xs"
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            borderColor: '#93C5FD',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 42, height: 42, background: '#2563EB', color: '#FFFFFF', fontSize: '1.1rem' }}
            >
              <FaCalendarAlt />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold mb-0 text-dark">
                  Historical Feeding Backfill: {new Date(todayDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </h6>
                <span className="badge bg-primary text-white rounded-pill extra-small fw-bold">
                  Past Entry Unlocked
                </span>
              </div>
              <p className="extra-small text-muted mb-0 mt-0.5">
                You are entering real farm notebook feeding data for <strong>{selectedPond?.pond_name}</strong> on this date. Feeding inputs are unlocked.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 extra-small fw-bold"
            onClick={() => setRecordDate(defaultDateStr)}
          >
            Return to Today ({defaultDateStr})
          </button>
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
                  {isNurseryStage ? (
                    <span className="badge rounded-pill bg-success bg-opacity-10 text-success border border-success border-opacity-25 extra-small fw-bold">
                      Nursery • Day {currentDoc}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={requestWeeklySampling}
                      disabled={!selectedPondId || allSlotsCompleted}
                    >
                      {weeklySampling?.shrimpWeightGrams ? 'Update' : 'Set'}
                    </button>
                  )}
                </div>
                {isNurseryStage ? (
                  <>
                    <h5 className="fw-bold text-success mb-1">Not Required</h5>
                    <p className="extra-small text-muted mb-0">
                      Shrimp are in Nursery phase (DOC 1–19). Weekly weight sampling starts in Grow-out (Day 20+).
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="fw-bold text-primary mb-1">
                      {weeklySampling?.shrimpWeightGrams ? `${weeklySampling.shrimpWeightGrams}g` : '-'}
                    </h4>
                    <p className="extra-small text-muted mb-0">
                      Required once per week before feeding logs. Example: 3g average shrimp.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="col-12 col-lg-8">
              <div className="p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-25 h-100">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <div>
                    <span className="small fw-bold text-primary">
                      {isNurseryStage ? 'Nursery Feed Broadcasting (100% Broadcast)' : 'Feeding tray computation'}
                    </span>
                    <p className="extra-small text-muted mb-0">
                      {isNurseryStage
                        ? 'Nursery basins do not use feeding trays. All feed is broadcast directly into the pond.'
                        : '4 trays are reserved first; remaining feed is broadcast to the pond.'}
                    </p>
                  </div>
                  <span className="badge bg-white text-primary border">
                    {isNurseryStage ? 'Trays: None (Nursery)' : `Tray count: ${feedingTrayCount}`}
                  </span>
                </div>
                {isNurseryStage ? (
                  <div className="row g-2">
                    <div className="col-6 col-md-4">
                      <small className="text-muted d-block">Feed Mass (grams)</small>
                      <strong className="fs-6 text-dark">{currentForm.amountGrams ? `${currentForm.amountGrams} g` : '0 g'}</strong>
                    </div>
                    <div className="col-6 col-md-4">
                      <small className="text-muted d-block">Mass in Kilograms</small>
                      <strong className="fs-6 text-primary">{feedingPlan ? `${formatKg(feedingPlan.amountKg)} kg` : '0 kg'}</strong>
                    </div>
                    <div className="col-12 col-md-4">
                      <small className="text-muted d-block">Broadcast Mode</small>
                      <span className="badge bg-success bg-opacity-20 text-success fw-bold">100% Direct Broadcast</span>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>

          {/* Time Slot Buttons with Click-to-Edit and Clear Visual Indicators */}
          <div className="caretaker-feeding-time-grid mb-4">
            {feedingTimes.map((time) => {
              const matchingLog = todayLogs.find((log) => normalizeTime(log.feeding_time) === normalizeTime(time));
              const isLoggedToday = Boolean(matchingLog);
              const isSelected = currentForm.feedingTime === time;
              const isBeingEdited = editingRecord && normalizeTime(editingRecord.feeding_time) === normalizeTime(time);

              return (
                <button
                  type="button"
                  key={time}
                  className={`btn-time-slot ${isSelected ? 'active' : ''}`}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderColor: isBeingEdited ? '#F59E0B' : (isSelected ? '#0B2C5F' : (isLoggedToday ? '#10B981' : '#CBD5E1')),
                    backgroundColor: isBeingEdited ? '#FEF3C7' : (isSelected ? '#0B2C5F' : (isLoggedToday ? '#F0FDF4' : '#FFFFFF')),
                    color: isSelected ? '#FFFFFF' : (isBeingEdited ? '#92400E' : (isLoggedToday ? '#065F46' : '#1E293B')),
                  }}
                  onClick={() => handleSelectSlot(time)}
                  title={isLoggedToday ? `${time} is logged (${matchingLog.amount_kg}kg) - Click to edit or review` : `Select ${time}`}
                >
                  {isBeingEdited ? (
                    <FaEdit className="me-1 text-warning" />
                  ) : isLoggedToday ? (
                    <FaCheckCircle className="text-success me-1 fs-6" />
                  ) : (
                    <FaClock className="me-1 opacity-75" />
                  )}
                  <span className="fw-bold">{time}</span>
                  {isLoggedToday && (
                    <span
                      className="badge rounded-pill ms-1 extra-small"
                      style={{
                        fontSize: '0.67rem',
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#DCFCE7',
                        color: isSelected ? '#FFFFFF' : '#15803D',
                        fontWeight: 700,
                      }}
                    >
                      {parseFloat(matchingLog.amount_kg) === 0
                        ? '0g (No Feed)'
                        : `${matchingLog.amount_grams ?? Math.round(parseFloat(matchingLog.amount_kg) * 1000)}g (${matchingLog.amount_kg}kg)`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Edit Mode Notification Banner */}
          {editingRecord && (
            <div className="alert alert-warning d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 border-warning border-opacity-50 shadow-xs">
              <div className="d-flex align-items-center gap-2.5">
                <div className="rounded-circle bg-warning bg-opacity-20 text-warning d-flex align-items-center justify-content-center" style={{ width: 34, height: 34 }}>
                  <FaEdit size={14} className="text-dark" />
                </div>
                <div>
                  <strong className="text-dark d-block">Editing Feeding Record #{editingRecord.id} ({editingRecord.feeding_time})</strong>
                  <span className="small text-muted">
                    Modifying existing feeding record on {todayDateStr} for {selectedPond?.pond_name}. Adjust values below and click Update.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1.5 extra-small fw-bold d-flex align-items-center gap-1"
                onClick={handleCancelEdit}
              >
                <FaTimes size={11} /> Cancel Edit
              </button>
            </div>
          )}

          {allSlotsCompleted && !editingRecord && (
            <div className="alert alert-success d-flex align-items-center justify-content-between gap-2 p-3 mb-4 rounded-3">
              <div className="d-flex align-items-center gap-2">
                <FaCheckCircle className="fs-5 text-success flex-shrink-0" />
                <div>
                  <strong className="d-block">All 5 Daily Feeding Slots Logged!</strong>
                  <span className="small">All scheduled daily feeding times for {selectedPond?.pond_name} have been recorded for this date. Click any time slot above or the table below to edit a record.</span>
                </div>
              </div>
            </div>
          )}

          {/* 3-Column Responsive Grid Form (Amount grams, Product Code, Vitamins) */}
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">
                Amount (grams)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                className="form-control form-control-lg fs-6"
                value={currentForm.amountGrams ?? ''}
                onChange={(event) => handleChange('amountGrams', event.target.value)}
                placeholder="e.g. 500 (or 0 for no feed)"
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
              />
              <div className="d-flex justify-content-between align-items-center mt-1 extra-small">
                <span className="text-muted">Equivalent in Kilograms:</span>
                <strong className="text-primary font-mono">
                  {currentForm.amountGrams !== '' && !isNaN(parseFloat(currentForm.amountGrams))
                    ? `${(parseFloat(currentForm.amountGrams) / 1000).toFixed(3)} kg`
                    : (currentForm.amountKg ? `${parseFloat(currentForm.amountKg).toFixed(3)} kg` : '0.000 kg')}
                </strong>
              </div>
            </div>

            <div className="col-md-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold text-dark mb-0">Product Code</label>
                <span
                  className="badge rounded-pill extra-small px-2 py-0.5"
                  style={{
                    backgroundColor: currentDoc >= 20 ? '#EFF6FF' : '#F0FDF4',
                    color: currentDoc >= 20 ? '#1D4ED8' : '#15803D',
                    border: `1px solid ${currentDoc >= 20 ? '#BFDBFE' : '#BBF7D0'}`,
                    fontSize: '0.7rem',
                  }}
                >
                  {currentDoc >= 20 ? 'Day 20+ Grower (Auto)' : 'Days 1-19 Starter (Auto)'}
                </span>
              </div>
              <select
                className="form-select form-select-lg fs-6 fw-bold"
                value={currentForm.productCode || autoProductCode}
                onChange={(event) => handleChange('productCode', event.target.value)}
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
              >
                {productCodes.map((code) => (
                  <option key={code} value={code}>
                    {code} (Tateh Feed) {code === autoProductCode ? '— (Standard Formulation)' : ''}
                  </option>
                ))}
              </select>
              <small className="extra-small text-muted d-block mt-1">
                {currentDoc >= 20
                  ? '🌊 Day 20+ Grow-out phase: Feed automatically switched from Starter to Grower.'
                  : '🌱 Days 1–19 Nursery phase: Starter feed designated for nursery culture.'}
              </small>
            </div>

            <div className="col-md-4">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold text-dark mb-0">Vitamins / Additive</label>
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 extra-small px-2 py-0.5" style={{ fontSize: '0.7rem' }}>
                  ✓ Consumed (Nursery &amp; Grow-out)
                </span>
              </div>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.vitaminName || 'None'}
                onChange={(event) => handleChange('vitaminName', event.target.value)}
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
              >
                {vitaminOptions.map((vit) => (
                  <option key={vit} value={vit}>
                    {vit === 'None' ? 'None (No Vitamin)' : vit}
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small d-block mt-1">
                Sanolife PRO-2 or Sano Top-S (administered with feed).
              </small>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold text-dark">Notes (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={currentForm.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              placeholder="Add a note or observation if needed"
              disabled={submitting || (allSlotsCompleted && !editingRecord)}
            />
          </div>

          {editingRecord ? (
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-warning btn-lg flex-grow-1 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                disabled={submitting}
                onClick={handleSubmit}
              >
                <FaEdit /> {submitting ? 'Updating...' : `Update Feeding Record #${editingRecord.id} (${currentForm.feedingTime})`}
              </button>
              <button
                type="button"
                className="btn btn-light btn-lg px-4 border fw-semibold shadow-sm"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg w-100 py-3 fw-bold caretaker-log-button d-flex align-items-center justify-content-center gap-2"
              disabled={submitting || (allSlotsCompleted && !editingRecord)}
              onClick={handleSubmit}
            >
              {submitting ? (
                'Saving...'
              ) : (
                <>
                  <FaPlus /> {isPastDate ? `Save Backfilled Feeding (${todayDateStr} • ${currentForm.feedingTime})` : `Log Feeding for ${selectedPond?.pond_name || 'Selected Pond'} (${currentForm.feedingTime})`}
                </>
              )}
            </button>
          )}

          {/* 🌟 LOGGED FEEDS LIST FOR SELECTED DATE (With Edit & Delete) */}
          {todayLogs.length > 0 && (
            <div className="mt-4 pt-4 border-top">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="fw-extrabold text-dark mb-0 d-flex align-items-center gap-2">
                    <FaClipboardList className="text-primary" />
                    Logged Feeds for {new Date(todayDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="badge bg-primary rounded-pill extra-small ms-1">{todayLogs.length} of 5 Logged</span>
                  </h6>
                  <small className="text-muted">
                    Total feed: <strong>{todayLogs.reduce((acc, l) => acc + Number(l.amount_kg || 0), 0).toFixed(2)} kg</strong> on this date.
                  </small>
                </div>
              </div>

              <div className="table-responsive border rounded-3 bg-white shadow-xs">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="py-2.5 px-3 text-secondary text-uppercase extra-small fw-bold">Time Slot</th>
                      <th className="py-2.5 text-secondary text-uppercase extra-small fw-bold">Feed Amount</th>
                      <th className="py-2.5 text-secondary text-uppercase extra-small fw-bold">Product Code</th>
                      <th className="py-2.5 text-secondary text-uppercase extra-small fw-bold">Vitamins</th>
                      <th className="py-2.5 text-secondary text-uppercase extra-small fw-bold">Logged By</th>
                      <th className="py-2.5 pe-3 text-end text-secondary text-uppercase extra-small fw-bold" style={{ width: 140 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.map((log) => {
                      const isCurrentEditing = editingRecord && editingRecord.id === log.id;
                      return (
                        <tr key={log.id} className={isCurrentEditing ? 'table-warning' : ''}>
                          <td className="ps-3 fw-bold text-dark font-mono">
                            <FaClock className="me-1 text-primary extra-small" /> {log.feeding_time}
                          </td>
                          <td>
                            <strong>{Number(log.amount_kg || 0).toFixed(2)} kg</strong>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {log.product_code || log.feed_type || 'Starter'}
                            </span>
                          </td>
                          <td>
                            {log.has_vitamin && log.vitamin_name && log.vitamin_name !== 'None' ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill extra-small fw-bold">
                                +{log.vitamin_name}
                              </span>
                            ) : (
                              <span className="text-muted extra-small">None</span>
                            )}
                          </td>
                          <td className="extra-small text-muted">
                            {log.recorded_by_name || 'Caretaker'}
                          </td>
                          <td className="pe-3 text-end">
                            <div className="d-inline-flex align-items-center gap-1.5">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => handleSelectSlot(log.feeding_time)}
                                title="Edit this feeding log"
                              >
                                <FaEdit size={11} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => handleDeleteRecord(log)}
                                title="Delete this feeding log"
                              >
                                <FaTrash size={11} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🌟 DUAL-MODE OCR WATER QUALITY MODAL */}
      <WaterQualityOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => {
          setIsOcrModalOpen(false);
          setEditingWqRecord(null);
        }}
        assignedPonds={assignedPonds}
        initialPondId={selectedPondId}
        initialDate={ocrTargetDate || todayDateStr}
        initialRecord={editingWqRecord}
        caretakerName={user?.full_name || 'Caretaker'}
        caretakerId={user?.id}
        onSuccess={(record) => {
          if (selectedPondId) {
            fetchWaterQualityStatus(selectedPondId);
          }
        }}
      />

      {/* 🌟 WATER QUALITY LOG HISTORY & BACKFILL MODAL */}
      <WaterQualityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        pond={selectedPond}
        canEdit={true}
        onEditRecord={(record) => {
          setEditingWqRecord(record);
          setOcrTargetDate(record.record_date);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
        onAddRecord={(date) => {
          setEditingWqRecord(null);
          setOcrTargetDate(date || todayDateStr);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
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

      {/* 🌟 POND CULTURE CYCLE CALENDAR MODAL */}
      {showCycleCalendar && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.72)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl">
              <PondCycleCalendar
                pondId={selectedPond?.id}
                stockingDate={selectedPond?.stocking_date}
                selectedDate={recordDate || todayDateStr}
                pondName={selectedPond?.pond_name || 'My Pond'}
                records={todayLogs}
                onSelectDate={(dateStr) => {
                  setRecordDate(dateStr);
                }}
                onClose={() => setShowCycleCalendar(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
