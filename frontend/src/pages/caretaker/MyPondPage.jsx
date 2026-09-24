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
  FaTrash,
  FaUtensils,
  FaBalanceScale,
  FaShieldAlt
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
const defaultVitamins = 'Sanolife PRO-2, Sano Top-S';
const vitaminOptions = [
  'Sanolife PRO-2, Sano Top-S',
  'Sanolife PRO-2',
  'Sano Top-S',
  'None'
];
const feedingTrayCount = 4;
const emptyForm = {
  feedingTime: '6:00 AM',
  amountGrams: '',
  amountKg: '',
  productCode: 'Starter',
  vitaminName: defaultVitamins,
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
  return String(value || '').trim().toUpperCase().replace(/^0(\d:)/, '$1');
}

const getLocalDateString = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return 1;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = new Date((targetDateStr || getLocalDateString(new Date())) + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return 1;
  const diffTime = t - s;
  return Math.floor(diffTime / 86400000) + 1;
}

export default function MyPondPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const suppressAutoTrayPromptRef = useRef(false);
  const trayPromptOpenRef = useRef(false);
  const justSubmittedRef = useRef(false);

  const [dbPonds, setDbPonds] = useState([]);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [formState, setFormState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);
  const [weeklySampling, setWeeklySampling] = useState(null);
  const [previousDayLastFeed, setPreviousDayLastFeed] = useState(null);
  const [trayMonitoringBySlot, setTrayMonitoringBySlot] = useState({});
  const [editingRecord, setEditingRecord] = useState(null);

  const defaultDateStr = useMemo(() => getLocalDateString(new Date()), []);
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
  const samplingStorageKey = selectedPondId ? `shrim-abw-sampling-pond-${selectedPondId}` : '';
  const legacySamplingKey = selectedPondId ? getSamplingStorageKey(user?.id, selectedPondId, todayDateStr) : '';

  // Current selected pond water quality status
  const currentPondWq = selectedPondId ? waterQualityStatus[selectedPondId] : null;
  const isPondWqVerified = Boolean(currentPondWq?.is_verified);
  const activeWqRecord = currentPondWq?.record;

  // Helper to resolve the active sampling for a given pond and date (valid for 7 days)
  const resolveActiveSampling = useCallback((pondId, targetDateStr, allRecords = []) => {
    if (!pondId || !targetDateStr) return null;

    // 1. Check local sampling history
    try {
      const historyRaw = localStorage.getItem(`shrim-abw-sampling-history-pond-${pondId}`);
      if (historyRaw) {
        const history = JSON.parse(historyRaw);
        if (Array.isArray(history) && history.length > 0) {
          const validHistory = history
            .filter((s) => s && s.sampledDate && s.sampledDate <= targetDateStr && Number(s.shrimpWeightGrams) > 0)
            .sort((a, b) => b.sampledDate.localeCompare(a.sampledDate));
          if (validHistory.length > 0) {
            return validHistory[0];
          }
        }
      }
    } catch (e) {}

    // 2. Check feeding records from database on or before targetDateStr
    if (Array.isArray(allRecords) && allRecords.length > 0) {
      const pastFeeds = allRecords
        .filter((r) => {
          const rDate = r.record_date || (r.created_at ? r.created_at.split(' ')[0] : '');
          const w = parseFloat(r.shrimp_weight_grams);
          return rDate && rDate <= targetDateStr && Number.isFinite(w) && w > 0;
        })
        .sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));

      if (pastFeeds.length > 0) {
        const latestWeight = parseFloat(pastFeeds[0].shrimp_weight_grams);
        // Trace back the start date of this specific sampling weight streak
        let streakStartDate = pastFeeds[0].record_date;
        for (let i = 0; i < pastFeeds.length; i++) {
          const currentWeight = parseFloat(pastFeeds[i].shrimp_weight_grams);
          if (Math.abs(currentWeight - latestWeight) < 0.05) {
            streakStartDate = pastFeeds[i].record_date;
          } else {
            break;
          }
        }

        return {
          shrimpWeightGrams: latestWeight,
          pondId: pondId,
          sampledDate: streakStartDate,
          sampledDoc: null,
          source: 'database',
        };
      }
    }

    // 3. Fallback to standard localStorage keys
    try {
      const singleKey = `shrim-abw-sampling-pond-${pondId}`;
      const stored = JSON.parse(localStorage.getItem(singleKey) || 'null');
      if (stored?.shrimpWeightGrams && (!stored.sampledDate || stored.sampledDate <= targetDateStr)) {
        return stored;
      }
    } catch (e) {}

    return null;
  }, []);

  useEffect(() => {
    if (!selectedPondId) {
      setWeeklySampling(null);
      return;
    }

    const resolved = resolveActiveSampling(selectedPondId, todayDateStr);
    if (resolved?.shrimpWeightGrams) {
      setWeeklySampling(resolved);
      return;
    }

    try {
      const stored = JSON.parse(localStorage.getItem(samplingStorageKey) || 'null');
      if (stored?.shrimpWeightGrams) {
        setWeeklySampling(stored);
        return;
      }
      const legacyStored = JSON.parse(localStorage.getItem(legacySamplingKey) || 'null');
      if (legacyStored?.shrimpWeightGrams) {
        setWeeklySampling({
          ...legacyStored,
          sampledDate: legacyStored.sampledDate || todayDateStr,
          sampledDoc: legacyStored.sampledDoc || currentDoc,
        });
        return;
      }
      setWeeklySampling(null);
    } catch (e) {
      setWeeklySampling(null);
    }
  }, [samplingStorageKey, legacySamplingKey, selectedPondId, todayDateStr, currentDoc, resolveActiveSampling]);

  const daysSinceSample = useMemo(() => {
    if (!weeklySampling?.sampledDate) return Infinity;
    const s = new Date(weeklySampling.sampledDate + 'T00:00:00');
    const t = new Date(todayDateStr + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(t.getTime())) return Infinity;
    const diffDays = Math.floor((t - s) / 86400000);
    return Math.max(0, diffDays);
  }, [weeklySampling?.sampledDate, todayDateStr]);

  const isDoc35Plus = currentDoc >= 35;
  const isSamplingDue = Boolean(isDoc35Plus && (!weeklySampling?.shrimpWeightGrams || daysSinceSample >= 7));

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

  // Fetch previous day's last feeding (prioritizing 6:00 PM) for the active pond
  const fetchPreviousDayLastFeed = useCallback(async (pondId, targetDateStr) => {
    if (!pondId) {
      setPreviousDayLastFeed(null);
      return null;
    }
    try {
      const res = await api.get('/feeding_records.php', {
        params: { pond_id: pondId },
      });
      if (Array.isArray(res.data)) {
        // Resolve active sampling dynamically from database records
        const activeSampling = resolveActiveSampling(pondId, targetDateStr, res.data);
        if (activeSampling?.shrimpWeightGrams) {
          setWeeklySampling(activeSampling);
        }

        const pastRecords = res.data.filter((r) => {
          const rDate = r.record_date || (r.created_at ? r.created_at.split(' ')[0] : '');
          return rDate && rDate < targetDateStr;
        });

        if (pastRecords.length > 0) {
          pastRecords.sort((a, b) => {
            const dA = a.record_date || '';
            const dB = b.record_date || '';
            return dB.localeCompare(dA);
          });

          const latestPastDate = pastRecords[0].record_date;
          const recordsOnLatestPastDate = pastRecords.filter((r) => r.record_date === latestPastDate);
          const sixPmLog = recordsOnLatestPastDate.find((r) => normalizeTime(r.feeding_time) === '6:00 PM');
          const lastLog = sixPmLog || recordsOnLatestPastDate[0];
          setPreviousDayLastFeed(lastLog);

          // Immediately populate into formState for 6:00 AM
          if (lastLog) {
            const rawG = lastLog.amount_grams !== null && lastLog.amount_grams !== undefined
              ? parseFloat(lastLog.amount_grams)
              : Math.round((parseFloat(lastLog.amount_kg) || 0) * 1000);
            const pG = String(rawG);
            const pK = String(lastLog.amount_kg || (rawG / 1000).toFixed(3));
            setFormState((prev) => {
              const current = prev[pondId] || emptyForm;
              if (normalizeTime(current.feedingTime) === '6:00 AM') {
                return {
                  ...prev,
                  [pondId]: {
                    ...current,
                    amountGrams: pG,
                    amountKg: pK,
                  },
                };
              }
              return prev;
            });
          }

          return lastLog;
        }
      }
      setPreviousDayLastFeed(null);
      return null;
    } catch (e) {
      console.error('Error fetching previous day last feed:', e);
      setPreviousDayLastFeed(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!selectedPondId) return;
    setTrayMonitoringBySlot({});
    setEditingRecord(null);
    setFormState((prev) => ({
      ...prev,
      [selectedPondId]: {
        ...emptyForm,
        productCode: autoProductCode,
        feedingTime: '6:00 AM',
      },
    }));
    fetchTodayLogs(selectedPondId);
    fetchWaterQualityStatus(selectedPondId);
    fetchPreviousDayLastFeed(selectedPondId, todayDateStr);

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
      fetchPreviousDayLastFeed(selectedPondId, todayDateStr);
    };

    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedPondId, todayDateStr, fetchTodayLogs, fetchWaterQualityStatus, fetchPreviousDayLastFeed]);

  // When previous day last feed is loaded and 6:00 AM is unlogged, auto-fill 6:00 AM feed amount
  useEffect(() => {
    if (!previousDayLastFeed || !selectedPondId) return;
    const isSixAmLogged = todayLogs.some((l) => normalizeTime(l.feeding_time) === '6:00 AM');
    if (isSixAmLogged) return;

    setFormState((prev) => {
      const current = prev[selectedPondId] || emptyForm;
      if (normalizeTime(current.feedingTime) === '6:00 AM') {
        const rawG = previousDayLastFeed.amount_grams !== null && previousDayLastFeed.amount_grams !== undefined
          ? parseFloat(previousDayLastFeed.amount_grams)
          : Math.round((parseFloat(previousDayLastFeed.amount_kg) || 0) * 1000);
        const prevGrams = String(rawG);
        const prevKg = String(previousDayLastFeed.amount_kg || (rawG / 1000).toFixed(3));

        return {
          ...prev,
          [selectedPondId]: {
            ...current,
            feedingTime: '6:00 AM',
            amountGrams: prevGrams,
            amountKg: prevKg,
          },
        };
      }
      return prev;
    });
  }, [previousDayLastFeed, todayLogs, selectedPondId]);

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

  // Reset tray prompt suppression whenever pond, date, or feeding time changes
  useEffect(() => {
    if (!justSubmittedRef.current) {
      suppressAutoTrayPromptRef.current = false;
    }
  }, [recordDate, selectedPondId, currentForm.feedingTime]);

  const requestWeeklySampling = async (isMandatory = false) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'Weekly Shrimp Sampling',
      text: 'Weekly shrimp sampling is required before you can log feeding. Please enter the average shrimp weight in grams:',
      input: 'number',
      inputValue: weeklySampling?.shrimpWeightGrams || '',
      inputPlaceholder: 'Average shrimp weight in grams (e.g. 15.0)',
      inputAttributes: {
        min: '0.5',
        step: '0.1',
      },
      showCancelButton: true,
      confirmButtonText: 'Save Sample',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'shrim-swal-popup',
        title: 'shrim-swal-title',
        confirmButton: 'btn btn-tri-navy px-4 py-2.5 rounded-pill fw-bold me-2 shadow-sm',
        cancelButton: 'btn btn-tri-outline px-3.5 py-2.5 rounded-pill fw-semibold',
      },
      buttonsStyling: false,
      inputValidator: (inputValue) => {
        const grams = Number(inputValue);
        if (!grams || grams <= 0) return 'Please enter a valid weight in grams.';
        return null;
      },
    });

    if (!isConfirmed || !value) return null;

    const nextSampling = {
      shrimpWeightGrams: Number(value),
      pondId: selectedPondId,
      pondName: selectedPond?.pond_name || '',
      sampledDate: todayDateStr,
      sampledDoc: currentDoc,
      sampledAt: new Date().toISOString(),
    };

    if (samplingStorageKey) {
      localStorage.setItem(samplingStorageKey, JSON.stringify(nextSampling));
    }
    try {
      const historyKey = `shrim-abw-sampling-history-pond-${selectedPondId}`;
      const historyRaw = localStorage.getItem(historyKey);
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      const updatedHistory = Array.isArray(history) ? history.filter((s) => s.sampledDate !== todayDateStr) : [];
      updatedHistory.push(nextSampling);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    } catch (e) {}
    setWeeklySampling(nextSampling);

    Swal.fire({
      icon: 'success',
      title: 'ABW Sample Recorded',
      text: `Average Body Weight set to ${value}g for ${selectedPond?.pond_name || 'this pond'}. Valid for the next 7 days.`,
      timer: 2000,
      showConfirmButton: false,
    });

    return nextSampling;
  };

  const handleSelectSlot = async (time) => {
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
          vitaminName: matchingLog.vitamin_name || defaultVitamins,
          notes: matchingLog.notes || '',
        },
      }));
    } else {
      // If DOC >= 35 and sampling is due (not set or >= 7 days), prompt for ABW sample before selecting slot
      if (isDoc35Plus && isSamplingDue) {
        const sample = await requestWeeklySampling(true);
        if (!sample) return;
      }

      setEditingRecord(null);
      suppressAutoTrayPromptRef.current = false;

      // If selecting 6:00 AM (first feeding of the day) and unlogged, auto-fill from previous day's 6:00 PM feed
      if (normalizeTime(time) === '6:00 AM' && previousDayLastFeed) {
        const rawG = previousDayLastFeed.amount_grams !== null && previousDayLastFeed.amount_grams !== undefined
          ? parseFloat(previousDayLastFeed.amount_grams)
          : Math.round((parseFloat(previousDayLastFeed.amount_kg) || 0) * 1000);
        const prevG = String(rawG);
        const prevK = String(previousDayLastFeed.amount_kg || (rawG / 1000).toFixed(3));
        setFormState((prev) => {
          const current = prev[selectedPondId] || emptyForm;
          return {
            ...prev,
            [selectedPondId]: {
              ...current,
              feedingTime: '6:00 AM',
              amountGrams: prevG,
              amountKg: prevK,
            },
          };
        });
      } else {
        handleChange('feedingTime', time);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    suppressAutoTrayPromptRef.current = false;
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

  const requestTrayMonitoring = async () => {
    if (!selectedSlotRequiresMonitoring) return 'first_feeding';
    if (trayMonitoringKey && trayMonitoringBySlot[trayMonitoringKey]) {
      return trayMonitoringBySlot[trayMonitoringKey];
    }

    const prevGrams = Number(
      previousFeedingLogForSelectedSlot?.amount_grams !== null && previousFeedingLogForSelectedSlot?.amount_grams !== undefined
        ? previousFeedingLogForSelectedSlot.amount_grams
        : (Number(previousFeedingLogForSelectedSlot?.amount_kg || 0) * 1000)
    );
    const prevKg = Number(previousFeedingLogForSelectedSlot?.amount_kg || (prevGrams / 1000));
    const previousTime = previousFeedingLogForSelectedSlot?.feeding_time || 'previous';

    let amountIfConsumedGrams = 14;
    let amountIfConsumedKg = 14.0;
    let amountIfLeftoverGrams = 11;
    let amountIfLeftoverKg = 11.0;

    if (prevGrams > 0 && prevGrams <= 100) {
      // User entered unit amount directly into the form (e.g. 13g -> 14g, or 14g)
      amountIfConsumedGrams = Number((prevGrams + 1).toFixed(2));
      amountIfConsumedKg = prevKg >= 1 ? Number((prevKg + 1.0).toFixed(2)) : Number((amountIfConsumedGrams / 1000).toFixed(3));
      amountIfLeftoverGrams = Math.max(1, Number((prevGrams - 2).toFixed(2)));
      amountIfLeftoverKg = prevKg >= 1 ? Math.max(0.5, Number((prevKg - 2.0).toFixed(2))) : Number((amountIfLeftoverGrams / 1000).toFixed(3));
    } else if (prevGrams > 100) {
      // User entered full gram amount (e.g. 13000g -> 14000g)
      amountIfConsumedGrams = Math.round(prevGrams + 1000);
      amountIfConsumedKg = Number((prevKg + 1.0).toFixed(2));
      amountIfLeftoverGrams = Math.max(100, Math.round(prevGrams - 2000));
      amountIfLeftoverKg = Math.max(0.5, Number((prevKg - 2.0).toFixed(2)));
    } else {
      amountIfConsumedGrams = 14;
      amountIfConsumedKg = 14.0;
      amountIfLeftoverGrams = 11;
      amountIfLeftoverKg = 11.0;
    }

    const { value, isConfirmed } = await Swal.fire({
      title: 'Feeding Tray Inspection',
      customClass: {
        popup: 'shrim-swal-popup',
        title: 'shrim-swal-title',
        confirmButton: 'btn btn-tri-navy px-4 py-2.5 rounded-pill fw-bold me-2 shadow-sm',
        cancelButton: 'btn btn-tri-outline px-3.5 py-2.5 rounded-pill fw-semibold',
      },
      buttonsStyling: false,
      html: `
        <div style="text-align:left; font-family: inherit;">
          <p class="text-secondary small mb-3">
            Inspect all 4 check trays in <strong>${selectedPond?.pond_name || 'this pond'}</strong> following the <strong>${previousTime}</strong> feeding session:
          </p>
          <div class="tray-options d-flex flex-column gap-2 mb-3">
            <label class="p-3 rounded-3 border d-flex align-items-start gap-2.5 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="tray_status" value="consumed" checked style="margin-top: 3px;" />
              <div>
                <strong class="d-block text-dark">Completely Consumed (Empty)</strong>
                <span class="text-muted extra-small">All feed on the 4 check trays has been fully consumed.</span>
              </div>
            </label>
            <label class="p-3 rounded-3 border d-flex align-items-start gap-2.5 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="tray_status" value="leftover" style="margin-top: 3px;" />
              <div>
                <strong class="d-block text-dark">Leftover Feed Detected (Unconsumed)</strong>
                <span class="text-muted extra-small">Feed residue remains on the check trays indicating slow feeding or satiation.</span>
              </div>
            </label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirm Tray Inspection',
      cancelButtonText: 'Skip Inspection',
      preConfirm: () => {
        const checked = document.querySelector('input[name="tray_status"]:checked');
        return checked ? checked.value : 'consumed';
      },
    });

    if (!isConfirmed) return null;

    let suggestedGrams = amountIfConsumedGrams;
    let suggestedKg = amountIfConsumedKg;
    let statusLabel = 'Completely Consumed (Empty)';

    if (value === 'leftover') {
      suggestedGrams = amountIfLeftoverGrams;
      suggestedKg = amountIfLeftoverKg;
      statusLabel = 'Leftover Feed Detected';
    } else {
      suggestedGrams = amountIfConsumedGrams;
      suggestedKg = amountIfConsumedKg;
      statusLabel = 'Completely Consumed (Empty)';
    }

    const monitoringResult = {
      status: statusLabel,
      trayStatusValue: value,
      suggestedAmountKg: suggestedKg,
      suggestedAmountGrams: suggestedGrams,
    };

    if (trayMonitoringKey) {
      setTrayMonitoringBySlot((prev) => ({
        ...prev,
        [trayMonitoringKey]: monitoringResult,
      }));
    }

    // Automatically update the form input fields with the calculated amount
    setFormState((prev) => {
      const current = prev[selectedPondId] || emptyForm;
      return {
        ...prev,
        [selectedPondId]: {
          ...current,
          amountKg: String(suggestedKg),
          amountGrams: String(suggestedGrams),
        },
      };
    });

    return monitoringResult;
  };

  useEffect(() => {
    if (justSubmittedRef.current) return;
    if (!selectedSlotRequiresMonitoring || !trayMonitoringKey || trayMonitoringBySlot[trayMonitoringKey]) return;
    if (suppressAutoTrayPromptRef.current || submitting || trayPromptOpenRef.current) return;
    if (editingRecord) return; // Only skip auto prompt if user is actively clicking to edit an existing record

    trayPromptOpenRef.current = true;
    requestTrayMonitoring().finally(() => {
      trayPromptOpenRef.current = false;
    });
  }, [selectedSlotRequiresMonitoring, trayMonitoringKey, trayMonitoringBySlot, submitting, editingRecord]);

  const handleSubmit = async () => {
    if (!selectedPond) return;

    // For live feeding, require pre-stocking baseline water quality verification if not done yet
    if (!isPastDate && !isPondWqVerified) {
      const choice = await Swal.fire({
        icon: 'info',
        title: 'Initial Water Quality Scan Required',
        html: `Pre-stocking water quality testing for <strong>${selectedPond.pond_name}</strong> has not been verified yet.<br/><br/>O&B Aqua Farm requires a one-time baseline water quality scan before initiating pond monitoring. Would you like to launch the OCR scanner now?`,
        confirmButtonText: 'Launch OCR Scanner',
        cancelButtonText: 'Continue Anyway',
        customClass: {
          popup: 'shrim-swal-popup',
          title: 'shrim-swal-title',
          confirmButton: 'btn btn-tri-navy px-4 py-2.5 rounded-pill fw-bold me-2 shadow-sm',
          cancelButton: 'btn btn-tri-outline px-3.5 py-2.5 rounded-pill fw-semibold',
        },
        buttonsStyling: false,
      });
      if (choice.isConfirmed) {
        setIsOcrModalOpen(true);
        return;
      }
    }

    const form = formState[selectedPondId] || emptyForm;
    const rawGrams = form.amountGrams !== undefined && form.amountGrams !== '' ? parseFloat(form.amountGrams) : (parseFloat(form.amountKg) * 1000);
    let grams = isNaN(rawGrams) ? 0 : rawGrams;
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

    let sampling = weeklySampling;
    let trayMonitoring = null;

    if (isNurseryStage) {
      // Nursery stage (DOC 1-19): No sampling, no tray monitoring (100% broadcast)
      sampling = null;
      trayMonitoring = { status: 'Nursery (No Trays • 100% Broadcast)' };
    } else if (editingRecord) {
      // Edit mode: keep existing status
      sampling = weeklySampling?.shrimpWeightGrams ? weeklySampling : { shrimpWeightGrams: 3.0 };
      trayMonitoring = { status: editingRecord.tray_monitoring_status || 'Manual Entry' };
    } else {
      // For DOC >= 35, weekly ABW sampling is strictly required every 7 days before logging
      if (isDoc35Plus && isSamplingDue) {
        sampling = await requestWeeklySampling(true);
        if (!sampling) {
          Swal.fire({
            icon: 'warning',
            title: 'Sampling Required',
            text: 'Weekly shrimp sampling is required before you can log feeding.',
          });
          return;
        }
      } else {
        sampling = weeklySampling?.shrimpWeightGrams ? weeklySampling : (isDoc35Plus ? null : { shrimpWeightGrams: 3.0 });
      }

      if (selectedSlotRequiresMonitoring) {
        trayMonitoring = await requestTrayMonitoring();
        if (!trayMonitoring) return;

        if (trayMonitoring?.suggestedAmountKg !== undefined) {
          amount = trayMonitoring.suggestedAmountKg;
        }
        if (trayMonitoring?.suggestedAmountGrams !== undefined) {
          grams = trayMonitoring.suggestedAmountGrams;
        }
      } else {
        trayMonitoring = { status: 'First Feeding (Maintained)' };
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
      justSubmittedRef.current = true;

      if (typeof window !== 'undefined') {
        localStorage.setItem('shrim-feed-updated', String(Date.now()));
        localStorage.setItem('shrim-notification-updated', String(Date.now()));
        window.dispatchEvent(new Event('shrim-feed-updated'));
        window.dispatchEvent(new Event('shrim-notification-updated'));
      }

      await Swal.fire({
        icon: 'success',
        title: editingRecord ? 'Feeding Log Updated!' : 'Feeding Logged Successfully!',
        text: `${grams}g (${formatKg(amount)}kg) recorded for ${selectedPond.pond_name} on ${todayDateStr} (${form.feedingTime}). Returning to dashboard...`,
        timer: 1600,
        showConfirmButton: false,
      });

      setEditingRecord(null);

      // Automatically return to dashboard after logging
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
      <div className="d-flex justify-content-between align-items-center mb-4 mb-xl-5 flex-wrap gap-3">
        <div>
          <h2 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            {selectedPond?.pond_name || 'My Pond'} Operations
          </h2>
          <span className="text-muted extra-small fw-medium">
            O&amp;B Aquafarm • Daily Pond Feeding Management &amp; Pre-Stocking Telemetry
          </span>
        </div>

        {/* Date Filter & Cycle Calendar Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div
            className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-white shadow-xs"
            style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
          >
            <FaCalendarAlt size={12} style={{ color: '#EA580C' }} />
            <span className="extra-small fw-semibold text-muted">Filter Date:</span>
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-transparent p-0 extra-small fw-bold"
              value={todayDateStr}
              onChange={(event) => setRecordDate(event.target.value || defaultDateStr)}
              style={{ width: 125, outline: 'none', color: '#0B2C5F' }}
              title="Filter ponds by date to inspect Nursery vs Grow-out stages"
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-tri-navy px-3.5 py-1.5 shadow-xs"
            style={{ height: 38, fontSize: '0.8rem' }}
            onClick={() => setShowCycleCalendar(true)}
            title="Open Cycle Calendar showing Nursery and Grow-out highlights"
          >
            <FaCalendarAlt size={11} /> Pond Cycle Calendar
          </button>

          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs"
            style={{ height: 38, fontSize: '0.8rem' }}
            onClick={() => setRecordDate(defaultDateStr)}
          >
            Reset to Today
          </button>
        </div>
      </div>

      {/* 🌟 POND SELECTION & CULTURE STAGE FILTER HUB */}
      <div className="tri-card p-3.5 p-md-4 mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-3 border-bottom" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="extra-small fw-extrabold text-uppercase me-1 d-flex align-items-center gap-1.5" style={{ color: '#0B2C5F', letterSpacing: '0.4px', fontSize: '0.76rem' }}>
              <FaFilter size={11} style={{ color: '#0B2C5F' }} />
              Stage Filter:
            </span>

            {/* All Ponds Filter Button */}
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all shadow-xs"
              style={{
                backgroundColor: stageFilter === 'all' ? '#0B2C5F' : '#FFFFFF',
                borderColor: stageFilter === 'all' ? '#0B2C5F' : 'rgba(11, 44, 95, 0.16)',
                color: stageFilter === 'all' ? '#FFFFFF' : '#0B2C5F',
              }}
              onClick={() => setStageFilter('all')}
            >
              <span>All Ponds</span>
              <span
                className="badge rounded-circle px-1.5 py-0.5"
                style={{
                  backgroundColor: stageFilter === 'all' ? 'rgba(255,255,255,0.22)' : 'rgba(11, 44, 95, 0.08)',
                  color: stageFilter === 'all' ? '#FFFFFF' : '#0B2C5F',
                  fontSize: '0.7rem',
                  minWidth: '18px',
                }}
              >
                {assignedPonds.length}
              </span>
            </button>

            {/* Nursery Basins Filter Button */}
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all shadow-xs"
              style={{
                backgroundColor: stageFilter === 'nursery' ? '#EA580C' : '#FFFFFF',
                borderColor: stageFilter === 'nursery' ? '#EA580C' : 'rgba(234, 88, 12, 0.3)',
                color: stageFilter === 'nursery' ? '#FFFFFF' : '#EA580C',
              }}
              onClick={() => setStageFilter('nursery')}
            >
              <span>Nursery Basins</span>
              <span
                className="badge rounded-circle px-1.5 py-0.5"
                style={{
                  backgroundColor: stageFilter === 'nursery' ? 'rgba(255,255,255,0.25)' : '#FFF7ED',
                  color: stageFilter === 'nursery' ? '#FFFFFF' : '#EA580C',
                  fontSize: '0.7rem',
                  minWidth: '18px',
                }}
              >
                {nurseryCount}
              </span>
            </button>

            {/* Grow-out Basins Filter Button */}
            <button
              type="button"
              className="btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold d-inline-flex align-items-center gap-2 transition-all shadow-xs"
              style={{
                backgroundColor: stageFilter === 'growout' ? '#0B2C5F' : '#FFFFFF',
                borderColor: stageFilter === 'growout' ? '#0B2C5F' : 'rgba(11, 44, 95, 0.16)',
                color: stageFilter === 'growout' ? '#FFFFFF' : '#0B2C5F',
              }}
              onClick={() => setStageFilter('growout')}
            >
              <span>Grow-out Basins</span>
              <span
                className="badge rounded-circle px-1.5 py-0.5"
                style={{
                  backgroundColor: stageFilter === 'growout' ? 'rgba(255,255,255,0.22)' : 'rgba(11, 44, 95, 0.08)',
                  color: stageFilter === 'growout' ? '#FFFFFF' : '#0B2C5F',
                  fontSize: '0.7rem',
                  minWidth: '18px',
                }}
              >
                {growoutCount}
              </span>
            </button>
          </div>

          <div className="text-end ms-auto">
            <span className="extra-small text-muted" style={{ fontSize: '0.76rem' }}>
              <strong style={{ color: '#EA580C' }}>Nursery:</strong> Days 1–19 • <strong style={{ color: '#0B2C5F' }}>Grow-out:</strong> Day 20+
            </span>
          </div>
        </div>

        {/* POND SELECTOR PILL TABS */}
        <div className="d-flex align-items-center gap-2 flex-wrap tri-pond-pill-strip">
          {filteredPonds.length === 0 ? (
            <div className="py-2 px-1 text-muted extra-small">
              No ponds match the "{stageFilter === 'nursery' ? 'Nursery' : 'Grow-out'}" phase on {todayDateStr}.
              <button
                type="button"
                className="btn btn-link btn-sm p-0 ms-2 text-decoration-none fw-bold extra-small"
                style={{ color: '#0B2C5F' }}
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
                  className="tri-pond-pill"
                  style={{
                    backgroundColor: isSelected ? (isNursery ? '#EA580C' : '#0B2C5F') : '#FFFFFF',
                    borderColor: isSelected ? (isNursery ? '#EA580C' : '#0B2C5F') : 'rgba(11, 44, 95, 0.12)',
                    color: isSelected ? '#FFFFFF' : '#0B2C5F',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                  onClick={() => setSelectedPondId(String(pond.id))}
                >
                  <FaWater size={12} style={{ color: isSelected ? '#FFFFFF' : (isNursery ? '#EA580C' : '#0B2C5F') }} />
                  <span>{pond.pond_name}</span>

                  {/* Culture Stage Badge */}
                  <span
                    className="badge rounded-pill px-2 py-0.5"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(255, 255, 255, 0.22)'
                        : (isNursery ? '#FFF7ED' : 'rgba(11, 44, 95, 0.06)'),
                      color: isSelected
                        ? '#FFFFFF'
                        : (isNursery ? '#EA580C' : '#0B2C5F'),
                      border: isSelected
                        ? '1px solid rgba(255, 255, 255, 0.35)'
                        : (isNursery ? '1px solid rgba(234, 88, 12, 0.22)' : '1px solid rgba(11, 44, 95, 0.14)'),
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
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(11, 44, 95, 0.06)',
                        color: isSelected ? '#FFFFFF' : '#0B2C5F',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      <span className="rounded-circle" style={{ width: 5, height: 5, backgroundColor: isSelected ? '#FFFFFF' : '#0B2C5F' }} />
                      Verified
                    </span>
                  ) : (
                    <span
                      className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded-pill"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : '#FFF7ED',
                        color: isSelected ? '#FFFFFF' : '#EA580C',
                        border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(234, 88, 12, 0.25)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                      }}
                    >
                      <span className="rounded-circle" style={{ width: 5, height: 5, backgroundColor: isSelected ? '#FFFFFF' : '#EA580C' }} />
                      Needs Test
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ACTIVE BASIN CULTURE STAGE BANNER */}
      {selectedPond && (
        <div
          className="tri-card p-3.5 p-md-4 mb-4 mb-xl-5 d-flex justify-content-between align-items-center flex-wrap gap-2"
          style={{
            borderLeft: currentDoc >= 20 ? '4px solid #0B2C5F' : '4px solid #EA580C',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 42,
                height: 42,
                backgroundColor: currentDoc >= 20 ? 'rgba(11, 44, 95, 0.07)' : '#FFF7ED',
                color: currentDoc >= 20 ? '#0B2C5F' : '#EA580C',
              }}
            >
              {currentDoc >= 20 ? <FaWater size={18} /> : <FaSeedling size={18} />}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <strong style={{ color: '#0B2C5F', fontSize: '1.05rem' }}>{selectedPond.pond_name}</strong>
                <span
                  className="badge rounded-pill px-2.5 py-1 fw-bold"
                  style={{
                    backgroundColor: currentDoc >= 20 ? '#0B2C5F' : '#EA580C',
                    color: '#FFFFFF',
                    fontSize: '0.74rem',
                  }}
                >
                  Day {currentDoc} of Culture • {currentDoc >= 20 ? 'Grow-out Phase' : 'Nursery Phase'}
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
                    <strong style={{ color: '#0B2C5F' }}>Grow-out Pond Active</strong>: Shrimp transferred on Day 20. Required feed formulation is <strong>Tateh Grower</strong>.
                  </>
                ) : (
                  <>
                    <strong style={{ color: '#EA580C' }}>Nursery Pond Active</strong>: Days 1–19 culture window. Required feed formulation is <strong>Tateh Starter</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small shadow-xs"
            onClick={() => setShowCycleCalendar(true)}
          >
            <FaCalendarAlt size={11} style={{ color: '#0B2C5F' }} /> View Full Cycle Calendar
          </button>
        </div>
      )}

      {/* WATER QUALITY GATE PROTOCOL CARD OR VERIFIED STATUS BANNER */}
      {!isPondWqVerified ? (
        <div
          className="tri-card mb-4 mb-xl-5 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 65%, #0E3D7D 100%)',
          }}
        >
          <div className="card-body p-4 text-white">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3.5">
              <div className="d-flex align-items-start gap-3">
                <div
                  className="rounded-4 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                  style={{
                    width: 48,
                    height: 48,
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    color: '#EA580C',
                    fontSize: '1.25rem',
                  }}
                >
                  <FaLock />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <h5 className="fw-bold mb-0 text-white tracking-tight">
                      Pre-Stocking Water Quality Scan Required
                    </h5>
                    <span
                      className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill extra-small fw-bold"
                      style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.28)' }}
                    >
                      <span className="rounded-circle" style={{ width: 6, height: 6, backgroundColor: '#EA580C' }} />
                      Initial Baseline Pending
                    </span>
                  </div>
                  <p className="text-white text-opacity-80 extra-small mb-0 mt-1" style={{ maxWidth: 640, lineHeight: 1.5 }}>
                    O&B Aqua Farm Protocol: An initial one-time water quality scan (DO, Temp, pH, Salinity) must be verified before stocking shrimp and logging daily feeding records for <strong>{selectedPond?.pond_name}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0 d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-3 py-2 extra-small shadow-xs"
                  onClick={() => setIsHistoryModalOpen(true)}
                  title="Browse historical logs and edit past dates"
                >
                  <FaHistory size={11} style={{ color: '#0B2C5F' }} /> Past Logs &amp; History
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-tri-orange px-3.5 py-2 extra-small shadow-xs"
                  style={{ fontSize: '0.82rem' }}
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
        <div className="tri-card mb-4 mb-xl-5 overflow-hidden">
          <div className="p-3.5 p-md-4 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 bg-white">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                style={{ width: 44, height: 44, background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', fontSize: '1.2rem' }}
              >
                <FaCheckCircle />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h6 className="fw-bold mb-0" style={{ color: '#0B2C5F' }}>
                    Pre-Stocking Water Quality Verified for {selectedPond?.pond_name}
                  </h6>
                  <span
                    className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                    style={{ backgroundColor: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.18)' }}
                  >
                    ✓ Verified Baseline
                  </span>
                </div>
                <div className="d-flex align-items-center gap-3 flex-wrap mt-1 extra-small text-muted">
                  <span>DO: <strong style={{ color: '#0B2C5F' }}>{activeWqRecord?.dissolved_oxygen}</strong> mg/L</span>
                  <span>•</span>
                  <span>Temp: <strong style={{ color: '#0B2C5F' }}>{activeWqRecord?.temperature}</strong>°C</span>
                  <span>•</span>
                  <span>pH: <strong style={{ color: '#0B2C5F' }}>{activeWqRecord?.ph_level}</strong></span>
                  <span>•</span>
                  <span>Salinity: <strong style={{ color: '#0B2C5F' }}>{activeWqRecord?.salinity}</strong> ppt</span>
                  <span>•</span>
                  <span className="badge rounded-pill extra-small" style={{ backgroundColor: '#F8FAFC', border: '1px solid rgba(11, 44, 95, 0.12)', color: '#0B2C5F' }}>
                    {activeWqRecord?.capture_mode === 'device_screen' ? 'LCD Meter Scan' : 'Logsheet Table Scan'}
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              {activeWqRecord?.image_path && (
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-3 py-1.5 extra-small shadow-xs"
                  onClick={() => setInspectProofModal(activeWqRecord)}
                >
                  <FaEye size={12} style={{ color: '#0B2C5F' }} /> View Photo Proof
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-tri-outline px-3 py-1.5 extra-small shadow-xs"
                onClick={() => setIsHistoryModalOpen(true)}
                title="Browse and manage all historical logs for this pond"
              >
                <FaHistory size={11} style={{ color: '#0B2C5F' }} /> History &amp; Past Logs
              </button>
              <button
                type="button"
                className="btn btn-sm btn-tri-navy px-3 py-1.5 extra-small shadow-xs"
                onClick={() => {
                  setEditingWqRecord(activeWqRecord || null);
                  setOcrTargetDate(todayDateStr);
                  setIsOcrModalOpen(true);
                }}
              >
                <FaEdit size={11} /> Re-scan / Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAST DATE FEEDING BACKFILL MODE BANNER */}
      {isPastDate && (
        <div
          className="tri-card p-3.5 mb-4 mb-xl-5 d-flex justify-content-between align-items-center flex-wrap gap-2 shadow-xs"
          style={{
            borderLeft: '4px solid #0B2C5F',
            backgroundColor: '#F8FAFD',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 42, height: 42, background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', fontSize: '1.1rem' }}
            >
              <FaCalendarAlt />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold mb-0" style={{ color: '#0B2C5F' }}>
                  Historical Feeding Backfill: {new Date(todayDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </h6>
                <span className="badge rounded-pill extra-small fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}>
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
            className="btn btn-sm btn-tri-outline rounded-pill px-3 py-1.5 extra-small fw-bold"
            onClick={() => setRecordDate(defaultDateStr)}
          >
            Return to Today ({defaultDateStr})
          </button>
        </div>
      )}

      {/* Main Feeding Form Panel Card */}
      <div className="tri-card p-4 p-md-4.5 mb-4 mb-xl-5">
        <div>
          <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
            <div>
              <h5 className="fw-extrabold text-dark mb-1 tracking-tight">Log Feeding Entry</h5>
              <p className="text-muted small mb-0">
                Save a verified feeding record for <strong style={{ color: '#0B2C5F' }}>{selectedPond?.pond_name || 'this pond'}</strong>.
              </p>
            </div>
            <div
              className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill extra-small fw-bold"
              style={{ backgroundColor: '#F8FAFD', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
            >
              <FaClipboardList />
              <span>{loggedTimesForPond.length} of 5 scheduled times completed today</span>
            </div>
          </div>

          <div className="row g-3 mb-4">
            {/* Weekly shrimp sample */}
            <div className="col-12 col-lg-4">
              <div
                className="p-3.5 rounded-3 h-100"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(11, 44, 95, 0.12)', boxShadow: '0 2px 8px rgba(11, 44, 95, 0.04)' }}
              >
                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="small fw-bold text-dark">Weekly shrimp sample</span>
                  {!isDoc35Plus ? (
                    <span
                      className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                      style={{ backgroundColor: '#F8FAFD', color: '#64748B', border: '1px solid rgba(11, 44, 95, 0.1)' }}
                    >
                      DOC {currentDoc} • Not Required
                    </span>
                  ) : isSamplingDue ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-tri-orange px-2.5 py-1 extra-small fw-bold shadow-xs"
                      onClick={() => requestWeeklySampling(false)}
                      disabled={!selectedPondId || allSlotsCompleted}
                    >
                      Sample Now
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-tri-outline px-2.5 py-1 extra-small fw-bold"
                      onClick={() => requestWeeklySampling(false)}
                      disabled={!selectedPondId || allSlotsCompleted}
                    >
                      Update
                    </button>
                  )}
                </div>
                {!isDoc35Plus ? (
                  <>
                    <h5 className="fw-bold text-secondary mb-1">Not Required</h5>
                    <p className="extra-small text-muted mb-0">
                      Weekly sampling starts at DOC 35.
                    </p>
                  </>
                ) : isSamplingDue ? (
                  <>
                    <h5 className="fw-bold mb-1" style={{ color: '#EA580C' }}>Sampling Required</h5>
                    <p className="extra-small mb-0" style={{ color: '#EA580C' }}>
                      Record shrimp weight in grams before logging feed.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="d-flex align-items-baseline gap-2 mb-1">
                      <h4 className="fw-bold mb-0" style={{ color: '#0B2C5F' }}>
                        {weeklySampling?.shrimpWeightGrams ? `${weeklySampling.shrimpWeightGrams}g` : '-'}
                      </h4>
                      <span
                        className="badge rounded-pill extra-small fw-bold"
                        style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
                      >
                        Active • {Math.max(0, 7 - daysSinceSample)}d left
                      </span>
                    </div>
                    <p className="extra-small text-muted mb-0">
                      Current average shrimp weight.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Feeding tray computation */}
            <div className="col-12 col-lg-8">
              <div
                className="p-3.5 rounded-3 h-100"
                style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.12)' }}
              >
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2.5">
                  <div>
                    <span className="small fw-bold" style={{ color: '#0B2C5F' }}>
                      {isNurseryStage ? 'Nursery Feed Broadcasting (100% Broadcast)' : 'Feeding tray computation'}
                    </span>
                    <p className="extra-small text-muted mb-0">
                      {isNurseryStage
                        ? 'Nursery basins do not use feeding trays. All feed is broadcast directly into the pond.'
                        : '4 trays are reserved first; remaining feed is broadcast to the pond.'}
                    </p>
                  </div>
                  <span
                    className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                    style={{ backgroundColor: '#FFFFFF', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
                  >
                    {isNurseryStage ? 'Trays: None (Nursery)' : `Tray count: ${feedingTrayCount}`}
                  </span>
                </div>
                {isNurseryStage ? (
                  <div className="row g-2">
                    <div className="col-6 col-md-4">
                      <small className="text-muted d-block extra-small">Feed Mass (grams)</small>
                      <strong className="fs-6 text-dark">{currentForm.amountGrams ? `${currentForm.amountGrams} g` : '0 g'}</strong>
                    </div>
                    <div className="col-6 col-md-4">
                      <small className="text-muted d-block extra-small">Mass in Kilograms</small>
                      <strong className="fs-6" style={{ color: '#0B2C5F' }}>{feedingPlan ? `${formatKg(feedingPlan.amountKg)} kg` : '0 kg'}</strong>
                    </div>
                    <div className="col-12 col-md-4">
                      <small className="text-muted d-block extra-small">Broadcast Mode</small>
                      <span
                        className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                        style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
                      >
                        100% Direct Broadcast
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="row g-2">
                    <div className="col-6 col-md-3">
                      <small className="text-muted d-block extra-small">Per tray</small>
                      <strong className="fs-6 text-dark">{feedingPlan ? `${formatKg(feedingPlan.trayFeedGrams)}g` : '-'}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted d-block extra-small">All trays</small>
                      <strong className="fs-6 text-dark">{feedingPlan ? `${formatKg(feedingPlan.totalTrayFeedGrams)}g` : '-'}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted d-block extra-small">Broadcast</small>
                      <strong className="fs-6" style={{ color: '#0B2C5F' }}>{feedingPlan ? `${formatKg(feedingPlan.broadcastFeedKg)}kg` : '-'}</strong>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted d-block extra-small">Formula</small>
                      <strong className="fs-6 text-dark text-truncate d-block" title={feedingPlan ? `${formatKg(feedingPlan.amountKg)} x ${feedingPlan.shrimpWeightGrams}g` : '-'}>
                        {feedingPlan ? `${formatKg(feedingPlan.amountKg)} x ${feedingPlan.shrimpWeightGrams}g` : '-'}
                      </strong>
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
                    borderColor: isBeingEdited ? '#EA580C' : (isSelected ? '#0B2C5F' : (isLoggedToday ? '#0B2C5F' : 'rgba(11, 44, 95, 0.15)')),
                    backgroundColor: isBeingEdited ? '#FFF7ED' : (isSelected ? '#0B2C5F' : (isLoggedToday ? '#F8FAFD' : '#FFFFFF')),
                    color: isSelected ? '#FFFFFF' : (isBeingEdited ? '#C2410C' : (isLoggedToday ? '#0B2C5F' : '#334155')),
                  }}
                  onClick={() => handleSelectSlot(time)}
                  title={isLoggedToday ? `${time} is logged (${matchingLog.amount_kg}kg) - Click to edit or review` : `Select ${time}`}
                >
                  {isBeingEdited ? (
                    <FaEdit className="me-1" style={{ color: '#EA580C' }} />
                  ) : isLoggedToday ? (
                    <FaCheckCircle className="me-1 fs-6" style={{ color: '#0B2C5F' }} />
                  ) : (
                    <FaClock className="me-1 opacity-75" />
                  )}
                  <span className="fw-bold">{time}</span>
                  {isLoggedToday && (
                    <span
                      className="badge rounded-pill ms-1 extra-small"
                      style={{
                        fontSize: '0.67rem',
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#FFF7ED',
                        color: isSelected ? '#FFFFFF' : '#EA580C',
                        fontWeight: 700,
                        border: isSelected ? 'none' : '1px solid #FFEDD5',
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
            <div
              className="d-flex align-items-center justify-content-between p-3.5 mb-4 rounded-3 shadow-xs"
              style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5' }}
            >
              <div className="d-flex align-items-center gap-2.5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 34, height: 34, backgroundColor: '#FFEDD5', color: '#EA580C' }}
                >
                  <FaEdit size={14} />
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
                className="btn btn-sm btn-tri-outline-orange rounded-pill px-3 py-1.5 extra-small fw-bold d-flex align-items-center gap-1"
                onClick={handleCancelEdit}
              >
                <FaTimes size={11} /> Cancel Edit
              </button>
            </div>
          )}

          {allSlotsCompleted && !editingRecord && (
            <div
              className="d-flex align-items-center justify-content-between gap-2 p-3.5 mb-4 rounded-3"
              style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.15)' }}
            >
              <div className="d-flex align-items-center gap-2.5">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32, backgroundColor: 'rgba(11, 44, 95, 0.1)', color: '#0B2C5F' }}
                >
                  <FaCheckCircle size={15} />
                </div>
                <div>
                  <strong className="d-block" style={{ color: '#0B2C5F' }}>All 5 Daily Feeding Slots Logged!</strong>
                  <span className="small text-muted">All scheduled daily feeding times for {selectedPond?.pond_name} have been recorded for this date. Click any time slot above or the table below to edit a record.</span>
                </div>
              </div>
            </div>
          )}

          {/* Clean 2-Row Form Grid: Amount + Product in Row 1, Vitamins + Notes in Row 2 */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold text-dark mb-1">
                Feed Amount (grams)
              </label>
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  step="10"
                  className="form-control fw-bold"
                  value={currentForm.amountGrams ?? ''}
                  onChange={(event) => handleChange('amountGrams', event.target.value)}
                  placeholder="e.g. 500 (or 0 for no feed)"
                  disabled={submitting || (allSlotsCompleted && !editingRecord)}
                  style={{ fontSize: '1rem' }}
                />
                <span className="input-group-text bg-light text-muted fw-semibold px-3">
                  grams
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-1 extra-small">
                <span className="text-muted">Equivalent mass:</span>
                <strong className="font-mono" style={{ color: '#0B2C5F' }}>
                  {currentForm.amountGrams !== '' && !isNaN(parseFloat(currentForm.amountGrams))
                    ? `${(parseFloat(currentForm.amountGrams) / 1000).toFixed(3)} kg`
                    : (currentForm.amountKg ? `${parseFloat(currentForm.amountKg).toFixed(3)} kg` : '0.000 kg')}
                </strong>
              </div>
              {normalizeTime(currentForm.feedingTime) === '6:00 AM' && previousDayLastFeed && !editingRecord && (
                <div className="mt-1 extra-small fw-semibold d-flex align-items-center gap-1" style={{ color: '#EA580C' }}>
                  <span>⚡ Auto-carried from previous 6:00 PM feed ({parseFloat(previousDayLastFeed.amount_grams || 0) || (parseFloat(previousDayLastFeed.amount_kg || 0) * 1000)}g)</span>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold text-dark mb-0">Feed Product</label>
                <span
                  className="badge rounded-pill extra-small px-2 py-0.5"
                  style={{
                    backgroundColor: currentDoc >= 20 ? 'rgba(11, 44, 95, 0.08)' : '#FFF7ED',
                    color: currentDoc >= 20 ? '#0B2C5F' : '#EA580C',
                    border: `1px solid ${currentDoc >= 20 ? 'rgba(11, 44, 95, 0.18)' : '#FFEDD5'}`,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {currentDoc >= 20 ? 'Grow-out • Day 20+' : 'Nursery • Days 1–19'}
                </span>
              </div>
              <select
                className="form-select fw-semibold"
                value={currentForm.productCode || autoProductCode}
                onChange={(event) => handleChange('productCode', event.target.value)}
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
                style={{ fontSize: '0.95rem' }}
              >
                {productCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <small className="extra-small text-muted d-block mt-1">
                Standard Tateh formulation for current pond culture stage.
              </small>
            </div>

            <div className="col-12 col-md-6">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold text-dark mb-0">Vitamins &amp; Additives</label>
                <span
                  className="badge rounded-pill extra-small px-2 py-0.5"
                  style={{
                    backgroundColor: '#F8FAFD',
                    color: '#0B2C5F',
                    border: '1px solid rgba(11, 44, 95, 0.18)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  Protocol
                </span>
              </div>
              <select
                className="form-select fw-semibold"
                value={currentForm.vitaminName || defaultVitamins}
                onChange={(event) => handleChange('vitaminName', event.target.value)}
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
                style={{ fontSize: '0.95rem' }}
              >
                {vitaminOptions.map((vit) => (
                  <option key={vit} value={vit}>
                    {vit === 'None' ? 'None (No Vitamin)' : vit}
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small d-block mt-1">
                Administered with feed across daily schedules.
              </small>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold text-dark mb-1">Pond Observations &amp; Notes (optional)</label>
              <input
                type="text"
                className="form-control"
                value={currentForm.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                placeholder="Turbidity observations, shrimp appetite, weather notes..."
                disabled={submitting || (allSlotsCompleted && !editingRecord)}
                style={{ fontSize: '0.95rem' }}
              />
              <small className="text-muted extra-small d-block mt-1">
                Optional note attached to this feeding slot.
              </small>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4">
            {editingRecord ? (
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-tri-orange btn-lg flex-grow-1 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  <FaEdit /> {submitting ? 'Updating...' : `Update Feeding Record #${editingRecord.id} (${currentForm.feedingTime})`}
                </button>
                <button
                  type="button"
                  className="btn btn-tri-outline btn-lg px-4 fw-semibold shadow-sm"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-tri-navy btn-lg w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
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
          </div>

          {/* 🌟 LOGGED FEEDS LIST FOR SELECTED DATE (With Edit & Delete) */}
          {todayLogs.length > 0 && (
            <div className="mt-4 pt-4 border-top">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="fw-extrabold text-dark mb-0 d-flex align-items-center gap-2">
                    <FaClipboardList style={{ color: '#0B2C5F' }} />
                    Logged Feeds for {new Date(todayDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span
                      className="badge rounded-pill extra-small ms-1"
                      style={{ backgroundColor: '#0B2C5F', color: '#FFFFFF' }}
                    >
                      {todayLogs.length} of 5 Logged
                    </span>
                  </h6>
                  <small className="text-muted">
                    Total feed: <strong style={{ color: '#0B2C5F' }}>{todayLogs.reduce((acc, l) => acc + Number(l.amount_kg || 0), 0).toFixed(2)} kg</strong> on this date.
                  </small>
                </div>
              </div>

              <div className="table-responsive border rounded-3 bg-white shadow-xs">
                <table className="table table-hover align-middle mb-0">
                  <thead style={{ backgroundColor: '#0B2C5F' }}>
                    <tr>
                      <th className="py-2.5 px-3 text-uppercase extra-small fw-bold text-white" style={{ borderBottom: 'none' }}>Time Slot</th>
                      <th className="py-2.5 text-uppercase extra-small fw-bold text-white" style={{ borderBottom: 'none' }}>Feed Amount</th>
                      <th className="py-2.5 text-uppercase extra-small fw-bold text-white" style={{ borderBottom: 'none' }}>Product Code</th>
                      <th className="py-2.5 text-uppercase extra-small fw-bold text-white" style={{ borderBottom: 'none' }}>Vitamins</th>
                      <th className="py-2.5 text-uppercase extra-small fw-bold text-white" style={{ borderBottom: 'none' }}>Logged By</th>
                      <th className="py-2.5 pe-3 text-end text-uppercase extra-small fw-bold text-white" style={{ width: 140, borderBottom: 'none' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.map((log) => {
                      const isCurrentEditing = editingRecord && editingRecord.id === log.id;
                      return (
                        <tr key={log.id} style={isCurrentEditing ? { backgroundColor: '#FFF7ED' } : {}}>
                          <td className="ps-3 fw-bold text-dark font-mono">
                            <FaClock className="me-1 extra-small" style={{ color: '#0B2C5F' }} /> {log.feeding_time}
                          </td>
                          <td>
                            <strong style={{ color: '#0B2C5F' }}>{Number(log.amount_kg || 0).toFixed(2)} kg</strong>
                          </td>
                          <td>
                            <span
                              className="badge rounded-pill extra-small fw-bold"
                              style={{
                                backgroundColor: String(log.product_code || log.feed_type).toLowerCase().includes('grower')
                                  ? 'rgba(11, 44, 95, 0.08)'
                                  : '#FFF7ED',
                                color: String(log.product_code || log.feed_type).toLowerCase().includes('grower')
                                  ? '#0B2C5F'
                                  : '#EA580C',
                                border: `1px solid ${String(log.product_code || log.feed_type).toLowerCase().includes('grower')
                                  ? 'rgba(11, 44, 95, 0.16)'
                                  : '#FFEDD5'}`,
                              }}
                            >
                              {log.product_code || log.feed_type || 'Starter'}
                            </span>
                          </td>
                          <td>
                            {log.has_vitamin && log.vitamin_name && log.vitamin_name !== 'None' ? (
                              <span
                                className="badge rounded-pill extra-small fw-bold"
                                style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
                              >
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
                                className="btn btn-sm btn-tri-outline rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => handleSelectSlot(log.feeding_time)}
                                title="Edit this feeding log"
                              >
                                <FaEdit size={11} /> Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline-orange rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
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
                  <FaEye style={{ color: '#EA580C' }} />
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

              <div className="modal-footer p-3 bg-white border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="extra-small text-muted">
                  <span><strong>Basin:</strong> {selectedPond?.pond_name}</span>
                  <span className="ms-3"><strong>Mode:</strong> {inspectProofModal.capture_mode === 'device_screen' ? 'LCD Meter Scan' : 'Logsheet Table'}</span>
                  <span className="ms-3"><strong>Date:</strong> {inspectProofModal.recorded_at || inspectProofModal.record_date}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-tri-navy px-3.5 py-1.5 extra-small shadow-xs"
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
