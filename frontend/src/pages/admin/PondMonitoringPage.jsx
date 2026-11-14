import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import {
  FaBug,
  FaCalendarAlt,
  FaChartPie,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileCsv,
  FaEdit,
  FaLayerGroup,
  FaPlus,
  FaRulerVertical,
  FaSearch,
  FaSeedling,
  FaSync,
  FaTimes,
  FaTimesCircle,
  FaTrash,
  FaUser,
  FaUtensils,
  FaWater,
  FaWeightHanging,
  FaEye,
  FaChartBar,
  FaClock,
  FaBalanceScale
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api, { safeArray } from '../../services/api';
import PondCycleCalendar from '../../components/PondCycleCalendar';
import { useLanguage } from '../../context/LanguageContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 ? diffDays : null;
}

const statusClass = {
  Healthy: 'success',
  Warning: 'warning',
  Critical: 'danger',
  Unmonitored: 'secondary',
};

function valueOrDash(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}${suffix}`;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '-';
  const num = Number(value);
  if (digits === 0) {
    return Math.round(num).toLocaleString();
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 === 0 ? 1 : 1,
    maximumFractionDigits: digits,
  });
}

function isDiseaseAlert(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized && normalized !== 'healthy' && normalized !== 'none' && normalized !== 'no disease detected';
}

export default function PondMonitoringPage() {
  const { t, isDark } = useLanguage();

  const [ponds, setPonds] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [harvestMap, setHarvestMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');
  const [caretakerFilter, setCaretakerFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All'); // 'All' | 'Nursery' | 'Growout' | 'HarvestReady'
  const [sortBy, setSortBy] = useState('name-asc'); // Default arranged in order: 'name-asc' | 'doc-desc' | 'doc-asc' | 'weight-desc' | 'feed-desc'
  const [showFilters, setShowFilters] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState('feed'); // 'feed' | 'weight' | 'stages'
  const [showFarmOverview, setShowFarmOverview] = useState(false);

  // Modals
  const [selectedPond, setSelectedPond] = useState(null);
  const [editingPond, setEditingPond] = useState(null);
  const [showAddPondModal, setShowAddPondModal] = useState(false);
  const [calendarModalPond, setCalendarModalPond] = useState(null);

  // Form Fields
  const [formPondName, setFormPondName] = useState('');
  const [formCaretakerId, setFormCaretakerId] = useState('');
  const [formStockingDate, setFormStockingDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAreaSqm, setFormAreaSqm] = useState(500);
  const [formDimensions, setFormDimensions] = useState('');
  const [formStockingDensity, setFormStockingDensity] = useState('');
  const [formPlCount, setFormPlCount] = useState('');
  const [formShrimpWeight, setFormShrimpWeight] = useState(15.0);
  const [formCycleTargetFeed, setFormCycleTargetFeed] = useState(15000);
  const [formOperationalStatus, setFormOperationalStatus] = useState('Grow-out');
  const [savingPond, setSavingPond] = useState(false);

  // Isolated Ponds State
  const [isolatedPonds, setIsolatedPonds] = useState(() => {
    try {
      const saved = localStorage.getItem('shrim_isolated_ponds_v3');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isPondIsolated = (pond) => {
    if (!pond) return false;
    const name = pond.pond_name || '';
    const id = pond.id ? String(pond.id) : '';
    return isolatedPonds.includes(name) || (id && isolatedPonds.includes(id));
  };

  const handleToggleIsolate = (pond) => {
    const isIso = isPondIsolated(pond);
    const name = pond.pond_name || `Pond #${pond.id}`;
    Swal.fire({
      title: isIso ? t('De-Isolate Pond?') : t('Isolate Bio-Zone?'),
      html: isIso
        ? `Restore normal water flow and gates for <strong>${name}</strong>?`
        : `Close water gates and quarantine <strong>${name}</strong>? Caretaker will receive emergency dispatch.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#FC563C',
      cancelButtonColor: '#6E7575',
      confirmButtonText: isIso ? t('Yes, De-Isolate') : t('Yes, Isolate Pond'),
      cancelButtonText: t('Cancel')
    }).then((res) => {
      if (res.isConfirmed) {
        let updated;
        if (isIso) {
          updated = isolatedPonds.filter((x) => x !== name && x !== String(pond.id));
        } else {
          updated = [...isolatedPonds, name];
        }
        setIsolatedPonds(updated);
        localStorage.setItem('shrim_isolated_ponds_v3', JSON.stringify(updated));
        Swal.fire({
          icon: 'success',
          title: isIso ? t('Pond Restored') : t('Pond Isolated & Gates Closed'),
          text: `${name} status updated.`,
          timer: 1800,
          showConfirmButton: false
        });
      }
    });
  };

  // Load Data
  const loadPondData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pondsRes, usersRes, harvestRes] = await Promise.all([
        api.get('/ponds.php'),
        api.get('/users.php?role=caretaker'),
        api.get('/harvest_predictions.php').catch(() => ({ data: { predictions: [] } }))
      ]);

      const pondList = safeArray(pondsRes.data?.ponds || pondsRes.data);
      setPonds(pondList);

      const userList = safeArray(usersRes.data?.users || usersRes.data);
      setCaretakers(userList.filter((u) => String(u.role || '').toLowerCase() === 'caretaker'));

      const hPreds = safeArray(harvestRes.data?.predictions);
      const hMap = {};
      hPreds.forEach((hp) => {
        if (hp.pond_id) hMap[String(hp.pond_id)] = hp;
        if (hp.pond_name) hMap[String(hp.pond_name).toLowerCase().trim()] = hp;
      });
      setHarvestMap(hMap);
    } catch (err) {
      console.error('Error fetching pond reports:', err);
      setError(err.response?.data?.message || err.message || 'Error loading pond data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPondData();
  }, []);

  // Process Ponds with DOC and Feed Progress
  const processedPonds = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const savedOverrides = (() => {
      try {
        return JSON.parse(localStorage.getItem('shrim_pond_status_overrides') || '{}');
      } catch {
        return {};
      }
    })();

    return ponds.map((p) => {
      const pName = (p.pond_name || `Pond #${p.id}`).trim();
      const cleanName = pName.toLowerCase();
      const hp = harvestMap[String(p.id)] || harvestMap[cleanName] || null;

      const rawOverride = savedOverrides[pName] || savedOverrides[String(p.id)] || p.operational_status;
      const doc = p.doc ?? computeDoc(p.stocking_date, todayStr);

      // 1. Feeding Consumption: authoritative synchronization with Harvest Forecast
      const consumedKg = hp && hp.total_feed_consumed_kg !== undefined
        ? Number(hp.total_feed_consumed_kg)
        : (!isNaN(parseFloat(p.total_feed_kg)) ? parseFloat(p.total_feed_kg) : 0);

      // 2. Cycle Target Feed (15,000 kg standard farm benchmark in Harvest Forecast)
      const targetKg = hp && hp.feed_reference_kg
        ? Number(hp.feed_reference_kg)
        : (parseFloat(p.cycle_target_feed_kg) >= 1000 ? parseFloat(p.cycle_target_feed_kg) : 15000);

      // 3. Remaining Feed (kg left until 15,000 kg target harvest)
      const remainingKg = hp && hp.remaining_feed_kg !== undefined
        ? Number(hp.remaining_feed_kg)
        : (!isNaN(parseFloat(p.remaining_feed_kg)) && parseFloat(p.remaining_feed_kg) > 0
          ? parseFloat(p.remaining_feed_kg)
          : Math.max(0, targetKg - consumedKg));

      // 4. Feed Progress Percentage (%)
      const feedProgressPct = hp && hp.feed_progress_percentage !== undefined
        ? Number(hp.feed_progress_percentage)
        : (targetKg > 0 ? Math.min(100, Math.round((consumedKg / targetKg) * 100)) : 0);

      // 5. Average Shrimp Body Weight (ABW in grams from Harvest Forecast / feeding samples)
      const weightG = hp && Number(hp.average_weight) > 0
        ? Number(hp.average_weight)
        : (!isNaN(parseFloat(p.shrimp_weight_g)) && parseFloat(p.shrimp_weight_g) > 0 && parseFloat(p.shrimp_weight_g) !== 18.5
          ? parseFloat(p.shrimp_weight_g)
          : (consumedKg > 0 ? 15.0 : 0));

      // 6. Caretaker Name: prioritize Harvest Forecast assigned caretaker
      const assignedCaretaker = hp?.caretaker_names || p.assigned_caretaker_name || p.caretaker_name || t('Unassigned');

      // 7. Harvest Readiness & Forecast Metrics
      const targetYieldKg = hp?.baseline_harvest_kg ?? p.target_yield_kg ?? (consumedKg * 0.7333);
      const adjustedHarvestKg = hp?.adjusted_harvest_kg ?? p.adjusted_harvest_kg ?? targetYieldKg;
      const predictedHarvestTons = hp?.predicted_harvest_tons ?? p.predicted_harvest_tons ?? (adjustedHarvestKg / 1000);
      const harvestReadinessStatus = hp?.readiness_status ?? p.harvest_readiness_status ?? null;

      // 8. Operational Status & Culture Stage
      const isRecentlyHarvested =
        rawOverride === 'Recently Harvested' ||
        Boolean(p.is_harvested) ||
        String(p.status || '').toLowerCase() === 'harvested' ||
        String(p.operational_status || '').toLowerCase().includes('harvest');

      const isNursery =
        rawOverride === 'Nursery State' ||
        (!isRecentlyHarvested && doc !== null && doc >= 1 && doc <= 19 && consumedKg < 1000);

      // STRICT HARVEST READINESS CRITERIA:
      // 1. Feeding consumption must reach the target of 15,000 kg (consumedKg >= 15000 or feedProgressPct >= 100)
      // 2. Average body weight from weekly sampling must reach 23.0 grams up (weightG >= 23.0g)
      // Regardless of Day of Culture (even if DOC is 90+, 120+, 231, 239 days), a pond CANNOT be Ready to Harvest until both are satisfied!
      const hasReachedTargetFeed = consumedKg >= 15000 || (targetKg > 0 && consumedKg >= targetKg && consumedKg >= 10000);
      const hasReachedTargetWeight = weightG >= 23.0;
      const isHarvestReady = !isRecentlyHarvested && !isNursery && hasReachedTargetFeed && hasReachedTargetWeight;

      const isGrowout =
        rawOverride === 'Grow-Out Phase' ||
        rawOverride === 'Grow-out' ||
        (!isRecentlyHarvested && !isNursery && !isHarvestReady && (
          (doc !== null && doc >= 20) ||
          consumedKg > 0 ||
          feedProgressPct > 0 ||
          weightG > 0
        ));

      const isInactive =
        rawOverride === 'Resting / Prep' ||
        rawOverride === 'Fallow / Prep' ||
        rawOverride === 'Resting' ||
        (p.operational_status && String(p.operational_status).toLowerCase() === 'inactive') ||
        p.is_active === false ||
        (p.status && String(p.status).toLowerCase() === 'inactive') ||
        (!p.stocking_date && !isRecentlyHarvested) ||
        (consumedKg === 0 && !isNursery && !rawOverride);

      const operationalStatus = isInactive ? 'Inactive' : 'Active';
      const isActive = !isInactive && !isRecentlyHarvested;

      let stageLabel = t('Unstocked');
      let statusDisplay = t('Active');
      let statusColor = '#10B981';
      let statusBg = '#ECFDF5';
      let statusBorder = '#86EFAC';

      if (isRecentlyHarvested) {
        stageLabel = t('Recently Harvested');
        statusDisplay = t('Recently Harvested');
        statusColor = '#8B5CF6';
        statusBg = '#EDE9FE';
        statusBorder = '#C4B5FD';
      } else if (isNursery) {
        stageLabel = t('Nursery State');
        statusDisplay = t('Nursery State');
        statusColor = '#0284C7';
        statusBg = '#E0F2FE';
        statusBorder = '#7DD3FC';
      } else if (isHarvestReady) {
        stageLabel = t('Ready to Harvest');
        statusDisplay = t('Ready to Harvest');
        statusColor = '#D97706';
        statusBg = '#FEF3C7';
        statusBorder = '#FCD34D';
      } else if (isGrowout || isActive) {
        stageLabel = t('Grow-Out Phase');
        statusDisplay = t('Grow-Out Phase');
        statusColor = '#10B981';
        statusBg = '#ECFDF5';
        statusBorder = '#86EFAC';
      } else {
        stageLabel = t('Resting / Prep');
        statusDisplay = t('Resting / Prep');
        statusColor = '#64748B';
        statusBg = '#F1F5F9';
        statusBorder = '#CBD5E1';
      }

      const finalDoc = isHarvestReady && (p.expected_harvest_date || p.latest_feed_date)
        ? computeDoc(p.stocking_date, p.expected_harvest_date || p.latest_feed_date)
        : (p.doc ?? doc);

      return {
        ...p,
        doc: finalDoc,
        assigned_caretaker_name: assignedCaretaker,
        isRecentlyHarvested,
        isNursery,
        isGrowout,
        isHarvestReady,
        isInactive,
        stageLabel,
        statusDisplay,
        statusColor,
        statusBg,
        statusBorder,
        consumedKg,
        targetKg,
        remainingKg,
        feedProgressPct,
        weightG,
        operationalStatus,
        isActive,
        targetYieldKg,
        adjustedHarvestKg,
        predictedHarvestTons,
        harvestReadinessStatus,
      };
    });
  }, [ponds, harvestMap, t]);

  // Filtered & Sorted Ponds
  const filteredPonds = useMemo(() => {
    return processedPonds
      .filter((p) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = String(p.pond_name || '').toLowerCase().includes(q);
          const matchCaretaker = String(p.assigned_caretaker_name || '').toLowerCase().includes(q);
          const matchDoc = String(p.doc || '').includes(q);
          const matchStage = String(p.stageLabel || '').toLowerCase().includes(q);
          if (!matchName && !matchCaretaker && !matchDoc && !matchStage) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter !== 'All') {
          if (statusFilter === 'Nursery') {
            if (!p.isNursery) return false;
          } else if (statusFilter === 'Harvested') {
            if (!p.isRecentlyHarvested) return false;
          } else if (statusFilter === 'HarvestReady') {
            if (!p.isHarvestReady) return false;
          } else if (statusFilter === 'Growout') {
            if (!p.isGrowout) return false;
          } else if (statusFilter.toLowerCase() === 'active') {
            if (!p.isActive) return false;
          } else if (statusFilter.toLowerCase() === 'inactive') {
            if (p.isActive) return false;
          } else if (statusFilter === 'Isolated') {
            if (!isPondIsolated(p)) return false;
          } else if (String(p.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
            return false;
          }
        }

        // Disease Filter
        if (diseaseFilter !== 'All') {
          const hasAlert = isDiseaseAlert(p.disease_detection) || p.status === 'Critical';
          if (diseaseFilter === 'Clear' && hasAlert) return false;
          if (diseaseFilter === 'Alert' && !hasAlert) return false;
        }

        // Caretaker Filter
        if (caretakerFilter !== 'All') {
          if (String(p.assigned_caretaker_name || '') !== caretakerFilter) {
            return false;
          }
        }

        // Stage Filter
        if (stageFilter === 'Nursery' && !p.isNursery) return false;
        if (stageFilter === 'Growout' && !p.isGrowout) return false;
        if (stageFilter === 'HarvestReady' && !p.isHarvestReady) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'doc-desc') return (b.doc || 0) - (a.doc || 0);
        if (sortBy === 'doc-asc') return (a.doc || 0) - (b.doc || 0);
        if (sortBy === 'weight-desc') return (b.weightG || 0) - (a.weightG || 0);
        if (sortBy === 'feed-desc') return (b.consumedKg || 0) - (a.consumedKg || 0);
        // Default: natural alphanumeric order (Pond A1, Pond A2, Pond A3...)
        return (a.pond_name || '').localeCompare(b.pond_name || '', undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [processedPonds, searchQuery, statusFilter, diseaseFilter, caretakerFilter, stageFilter, sortBy, isolatedPonds]);

  // Overall KPI Summary
  const summary = useMemo(() => {
    const totalPonds = ponds.length;
    let sumDoc = 0;
    let docCount = 0;
    let sumWeight = 0;
    let weightCount = 0;
    let totalConsumedFeed = 0;
    let totalRemainingFeed = 0;
    let nurseryCount = 0;
    let growoutCount = 0;
    let harvestReadyCount = 0;

    processedPonds.forEach((p) => {
      if (p.doc !== null && p.doc > 0) {
        sumDoc += p.doc;
        docCount++;
      }
      if (p.weightG > 0) {
        sumWeight += p.weightG;
        weightCount++;
      }
      totalConsumedFeed += p.consumedKg;
      totalRemainingFeed += p.remainingKg;

      if (p.isHarvestReady) harvestReadyCount++;
      else if (p.isNursery) nurseryCount++;
      else if (p.isGrowout) growoutCount++;
    });

    return {
      total_ponds: totalPonds,
      avg_doc: docCount > 0 ? Math.round(sumDoc / docCount) : 0,
      avg_weight: weightCount > 0 ? (sumWeight / weightCount).toFixed(1) : '16.5',
      total_consumed_feed: Math.round(totalConsumedFeed),
      total_remaining_feed: Math.round(totalRemainingFeed),
      nurseryCount,
      growoutCount,
      harvestReadyCount,
    };
  }, [ponds, processedPonds]);

  const uniqueCaretakers = useMemo(() => {
    const names = new Set();
    ponds.forEach((p) => {
      if (p.assigned_caretaker_name) names.add(p.assigned_caretaker_name);
    });
    return Array.from(names).sort();
  }, [ponds]);

  // Chart 1: Feeding Consumption vs Remaining Feed Bar Chart
  const feedComparisonChart = useMemo(() => {
    const labels = processedPonds.slice(0, 10).map((p) => p.pond_name || `Pond #${p.id}`);
    const consumed = processedPonds.slice(0, 10).map((p) => Math.round(p.consumedKg));
    const remaining = processedPonds.slice(0, 10).map((p) => Math.round(p.remainingKg));

    return {
      labels: labels.length > 0 ? labels : ['Pond A1', 'Pond A2', 'Pond A3', 'Pond B1', 'Pond B2'],
      datasets: [
        {
          label: t('Consumed Feed (kg)'),
          data: consumed.length > 0 ? consumed : [645, 390, 510, 620, 760],
          backgroundColor: '#FC563C',
          borderRadius: 6,
        },
        {
          label: t('Remaining Feed (kg)'),
          data: remaining.length > 0 ? remaining : [155, 360, 240, 180, 40],
          backgroundColor: '#38BDF8',
          borderRadius: 6,
        }
      ]
    };
  }, [processedPonds, t]);

  // Chart 2: Shrimp Weight (grams) by Pond Bar Chart
  const shrimpWeightChart = useMemo(() => {
    const labels = processedPonds.slice(0, 10).map((p) => p.pond_name || `Pond #${p.id}`);
    const weights = processedPonds.slice(0, 10).map((p) => p.weightG);

    return {
      labels: labels.length > 0 ? labels : ['Pond A1', 'Pond A2', 'Pond A3', 'Pond B1', 'Pond B2'],
      datasets: [
        {
          label: t('Current Shrimp Weight (grams)'),
          data: weights.length > 0 ? weights : [18.5, 12.8, 16.5, 21.0, 26.2],
          backgroundColor: '#10B981',
          borderRadius: 6,
        }
      ]
    };
  }, [processedPonds, t]);

  // Chart 3: Culture Stages Donut
  const stageDonutChart = useMemo(() => {
    return {
      labels: [t('Nursery Stage (Days 1–19)'), t('Grow-out Stage (Day 20+)'), t('Harvest Ready')],
      datasets: [
        {
          data: [
            summary.nurseryCount || 2,
            summary.growoutCount || 5,
            summary.harvestReadyCount || 2
          ],
          backgroundColor: ['#10B981', '#0284C7', '#F59E0B'],
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          hoverOffset: 6
        }
      ]
    };
  }, [summary, t]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredPonds.length) {
      Swal.fire({ icon: 'warning', title: t('No Data'), text: t('No pond records match the current filters.') });
      return;
    }

    const headers = [
      'Pond Name', 'Caretaker', 'DOC (Days)', 'Culture Stage', 'Shrimp Weight (g)',
      'Feeding Consumption (kg)', 'Remaining Feed (kg)', 'Cycle Target Feed (kg)',
      'Feed Progress (%)', 'Stocking Date', 'Expected Harvest Date', 'Status'
    ];
    const rows = filteredPonds.map((p) => [
      `"${(p.pond_name || '').replace(/"/g, '""')}"`,
      `"${(p.assigned_caretaker_name || 'Unassigned').replace(/"/g, '""')}"`,
      p.doc ?? 0,
      `"${p.stageLabel || ''}"`,
      p.weightG ?? 15.0,
      p.consumedKg ?? 0,
      p.remainingKg ?? 0,
      p.targetKg ?? 15000,
      `${p.feedProgressPct ?? 0}%`,
      `"${p.stocking_date || ''}"`,
      `"${p.expected_harvest_date || ''}"`,
      `"${p.status || 'Active'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pond_Reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setEditingPond(null);
    setFormPondName('');
    setFormCaretakerId('');
    setFormStockingDate(new Date().toISOString().split('T')[0]);
    setFormAreaSqm(500);
    setFormDimensions('');
    setFormStockingDensity('');
    setFormPlCount('');
    setFormShrimpWeight(15.0);
    setFormCycleTargetFeed(15000);
    setFormOperationalStatus('Grow-out');
  };

  const openAddPondModal = () => {
    resetForm();
    setShowAddPondModal(true);
  };

  const openEditPondModal = (pond) => {
    setEditingPond(pond);
    setFormPondName(pond.pond_name || '');
    setFormCaretakerId(pond.assigned_caretaker_id ? String(pond.assigned_caretaker_id) : '');
    setFormStockingDate(pond.stocking_date || new Date().toISOString().split('T')[0]);
    setFormAreaSqm(pond.area_sqm || 500);
    setFormDimensions(pond.dimensions || '');
    setFormStockingDensity(pond.stocking_density ? String(pond.stocking_density) : '');
    setFormPlCount(pond.pl_count ? String(pond.pl_count) : '');
    setFormShrimpWeight(pond.weightG || pond.shrimp_weight_g || 15.0);
    setFormCycleTargetFeed(pond.targetKg || pond.cycle_target_feed_kg || 15000);
    setFormOperationalStatus(
      pond.isRecentlyHarvested
        ? 'Recently Harvested'
        : pond.isNursery
          ? 'Nursery State'
          : pond.isHarvestReady
            ? 'Ready to Harvest'
            : !pond.isActive
              ? 'Resting / Prep'
              : 'Grow-out'
    );
    setShowAddPondModal(true);
  };

  const handleSavePond = async (e) => {
    e.preventDefault();
    const pondName = formPondName.trim();
    if (!pondName) {
      Swal.fire({ icon: 'warning', title: t('Pond Name Required'), text: t('Please enter a pond name.') });
      return;
    }

    if (formOperationalStatus === 'Ready to Harvest') {
      const currentFed = parseFloat(editingPond?.consumedKg ?? editingPond?.total_feed_kg ?? 0);
      const currentWeight = parseFloat(formShrimpWeight || editingPond?.weightG || editingPond?.shrimp_weight_g || 0);
      if (currentFed < 15000 || currentWeight < 23.0) {
        Swal.fire({
          icon: 'warning',
          title: t('Harvest Criteria Not Met'),
          text: t('Cannot mark pond as Ready to Harvest. The pond must reach at least 15,000 kg feed consumption and 23.0 grams average shrimp weight from sampling.'),
          confirmButtonColor: '#FC563C',
        });
        return;
      }
    }

    setSavingPond(true);
    try {
      const payload = {
        pond_name: pondName,
        assigned_caretaker_id: formCaretakerId,
        stocking_date: formStockingDate,
        area_sqm: parseInt(formAreaSqm, 10) || 500,
        dimensions: formDimensions.trim() || null,
        stocking_density: formStockingDensity ? parseInt(formStockingDensity, 10) : null,
        pl_count: formPlCount ? parseInt(formPlCount, 10) : null,
        shrimp_weight_g: parseFloat(formShrimpWeight) || 15.0,
        cycle_target_feed_kg: parseFloat(formCycleTargetFeed) || 15000,
        operational_status: formOperationalStatus,
        status:
          formOperationalStatus === 'Recently Harvested'
            ? 'Harvested'
            : formOperationalStatus === 'Nursery State'
              ? 'Nursery'
              : formOperationalStatus === 'Resting / Prep' || formOperationalStatus === 'Fallow / Prep'
                ? 'Inactive'
                : 'Active',
      };

      if (editingPond) {
        payload.action = 'update';
        payload.id = editingPond.id;
        const currentFed = parseFloat(editingPond.total_feed_kg || 0);
        payload.remaining_feed_kg = Math.max(0, payload.cycle_target_feed_kg - currentFed);
      }

      // Persist operational status override locally
      try {
        const savedOverrides = JSON.parse(localStorage.getItem('shrim_pond_status_overrides') || '{}');
        savedOverrides[pondName] = formOperationalStatus;
        if (editingPond?.id) savedOverrides[String(editingPond.id)] = formOperationalStatus;
        localStorage.setItem('shrim_pond_status_overrides', JSON.stringify(savedOverrides));
      } catch (err) {
        console.error('Storage override error:', err);
      }

      const res = await api.post('/ponds.php', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to save pond.');
      }

      setShowAddPondModal(false);
      resetForm();
      await loadPondData();
      Swal.fire({
        icon: 'success',
        title: editingPond ? t('Pond Updated') : t('Pond Added'),
        text: `${pondName} ${t('has been successfully saved.')}`,
        timer: 1600,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('Save Error'),
        text: err.response?.data?.message || err.message || t('Please try again.')
      });
    } finally {
      setSavingPond(false);
    }
  };

  const handleDeletePond = async (pond) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('Delete Pond?'),
      html: `Delete <strong>${pond.pond_name}</strong>?<br/><span class="text-muted extra-small">Assigned to ${pond.assigned_caretaker_name || 'Staff'}. This action cannot be undone.</span>`,
      showCancelButton: true,
      confirmButtonText: t('Yes, Delete'),
      cancelButtonText: t('Cancel'),
      confirmButtonColor: '#EF4444',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await api.post('/ponds.php', { action: 'delete', id: pond.id });
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Unable to delete pond.');
      }

      if (selectedPond?.id === pond.id) {
        setSelectedPond(null);
      }
      await loadPondData();
      Swal.fire({ icon: 'success', title: t('Pond Deleted'), text: `${pond.pond_name} ${t('has been deleted.')}`, timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: t('Delete Blocked'), text: err.response?.data?.message || err.message });
    }
  };

  return (
    <div className="pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Pond Reports')}
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
            {t('• Operational')}
          </span>
        </div>

        {/* Action Controls: Stock New Pond, Refresh & CSV Export */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-understated-feed d-inline-flex align-items-center gap-1.5 px-3.5 py-2 shadow-2xs hover-shadow"
            onClick={openAddPondModal}
          >
            <FaPlus size={11} /> {t('Stock New Pond')}
          </button>

          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-2 shadow-2xs hover-shadow"
            onClick={loadPondData}
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

      {/* 2. SEARCH & SUMMARY BAR */}
      <div className="admin-filter-card p-3 mb-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5">
          <div className="position-relative flex-grow-1" style={{ maxWidth: 460 }}>
            <FaSearch
              className="position-absolute text-muted"
              size={13}
              style={{ left: '16px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-control form-control-sm pe-4 rounded-pill border shadow-none"
              placeholder={t('Search by pond name, caretaker...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.84rem', borderColor: '#E2E8F0', height: '38px', paddingLeft: '40px' }}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn btn-link p-0 position-absolute text-muted"
                style={{ right: '14px', top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
                onClick={() => setSearchQuery('')}
              >
                <FaTimes size={12} />
              </button>
            )}
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="text-secondary extra-small fw-medium">
              {summary.total_ponds} {t('Active Ponds')} • {summary.avg_doc} {t('Avg DOC')}
            </span>
            <span className="badge rounded-pill px-2.5 py-1 extra-small border" style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0', fontWeight: 600 }}>
              {filteredPonds.length} {filteredPonds.length === 1 ? t('Pond Showing') : t('Ponds Showing')}
            </span>
          </div>
        </div>

        {/* Status Filter Pills: All Ponds, Nursery State, Grow-Out, Recently Harvested, etc. */}
        <div className="d-flex align-items-center gap-1.5 mt-2.5 pt-2 border-top flex-wrap" style={{ borderColor: '#F1F5F9' }}>
          {[
            { id: 'All', label: t('All Ponds') },
            { id: 'Nursery', label: t('Nursery State') },
            { id: 'Growout', label: t('Grow-Out Phase') },
            { id: 'HarvestReady', label: t('Ready to Harvest') },
            { id: 'Harvested', label: t('Recently Harvested') },
            { id: 'Inactive', label: t('Resting / Inactive') }
          ].map((tab) => {
            const isActiveTab = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${isActiveTab ? 'text-white shadow-2xs' : 'btn-light border text-secondary'
                  }`}
                style={isActiveTab ? { backgroundColor: '#FC563C', borderColor: '#FC563C' } : { borderColor: '#E2E8F0' }}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4 mb-4">
          <FaTimesCircle /> {error}
        </div>
      )}

      {/* 2. POND SUMMARY CARDS GRID */}
      <div className="mb-4">
        <div className="row g-3 g-xl-4">
          {filteredPonds.map((pond) => {
            return (
              <div key={pond.id} className="col-12 col-md-6 col-xl-4">
                <div
                  className="bg-white rounded-4 p-4 shadow-2xs h-100 d-flex flex-column justify-content-between pond-monitoring-card"
                  onClick={() => setSelectedPond(pond)}
                  title={t('Click to view pond details')}
                >
                  <div>
                    {/* 1. Pond Name & Status Header */}
                    <div
                      className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom"
                      style={{ borderColor: '#E2E8F0' }}
                    >
                      <div className="d-flex align-items-center gap-2.5">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 38,
                            height: 38,
                            backgroundColor: '#EFF6FF',
                            color: '#0284C7',
                            border: '1.5px solid #BAE6FD',
                            borderRadius: '10px',
                          }}
                        >
                          <FaWater size={16} />
                        </div>
                        <div>
                          <h6 className="fw-extrabold mb-0 text-dark" style={{ fontSize: '1.08rem' }}>
                            {pond.pond_name}
                          </h6>
                        </div>
                      </div>

                      {/* Status: Recently Harvested / Nursery State / Ready to Harvest / Grow-Out / Resting */}
                      <span
                        className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
                        style={{
                          backgroundColor: pond.statusBg,
                          color: pond.statusColor,
                          border: `1.5px solid ${pond.statusBorder}`,
                          fontSize: '0.74rem',
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: pond.statusColor,
                          }}
                        />
                        {pond.statusDisplay}
                      </span>
                    </div>

                    {/* 2. Caretaker */}
                    <div
                      className="pond-monitoring-caretaker-strip px-3.5 py-2.5 rounded-3 d-flex align-items-center gap-2.5"
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: '12px',
                        marginBottom: '14px',
                      }}
                    >
                      <div
                        className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                        style={{ width: 30, height: 30, backgroundColor: '#334155', fontSize: '0.70rem', border: '1px solid #1E293B' }}
                      >
                        {(pond.assigned_caretaker_name || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <span
                          className="text-muted d-block text-uppercase fw-semibold"
                          style={{ fontSize: '0.67rem', letterSpacing: '0.04em', lineHeight: 1.2 }}
                        >
                          {t('Caretaker')}
                        </span>
                        <strong
                          className="d-block text-dark fw-bold text-truncate"
                          style={{ fontSize: '0.88rem' }}
                          title={pond.assigned_caretaker_name || t('Unassigned')}
                        >
                          {pond.assigned_caretaker_name || t('Unassigned')}
                        </strong>
                      </div>
                    </div>

                    {/* 3, 4, 5, 6. The 4 Core Metrics: Day of Culture, Shrimp Weight, Feeding Consumption, Remaining Feed */}
                    <div className="row gx-3 gy-3" style={{ rowGap: '12px' }}>
                      {/* 3. Day of Culture (DOC) */}
                      <div className="col-6">
                        <div
                          className="pond-metric-card pond-metric-card-doc rounded-3 p-3 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#F0FDF4',
                            border: '1.5px solid #86EFAC',
                            borderRadius: '14px',
                            minHeight: '88px',
                            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.06)',
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span
                              className="fw-bold text-uppercase"
                              style={{ fontSize: '0.68rem', letterSpacing: '0.03em', color: '#047857' }}
                            >
                              {t('Day of Culture')}
                            </span>
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 26, height: 26, color: '#059669', backgroundColor: '#DCFCE7', border: '1.5px solid #86EFAC' }}
                            >
                              <FaCalendarAlt size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#047857', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {pond.doc !== null ? pond.doc : '-'}
                            </span>
                            <span className="fw-bold extra-small" style={{ color: '#059669' }}>
                              {t('days')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 6. Shrimp Weight in Grams */}
                      <div className="col-6">
                        <div
                          className="pond-metric-card pond-metric-card-weight rounded-3 p-3 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#FAF5FF',
                            border: '1.5px solid #D8B4FE',
                            borderRadius: '14px',
                            minHeight: '88px',
                            boxShadow: '0 1px 3px rgba(139, 92, 246, 0.06)',
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span
                              className="fw-bold text-uppercase"
                              style={{ fontSize: '0.68rem', letterSpacing: '0.03em', color: '#6B21A8' }}
                            >
                              {t('Shrimp Weight')}
                            </span>
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 26, height: 26, color: '#7C3AED', backgroundColor: '#F3E8FF', border: '1.5px solid #D8B4FE' }}
                            >
                              <FaWeightHanging size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#6B21A8', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {pond.weightG > 0 ? formatNumber(pond.weightG, 1) : '—'}
                            </span>
                            <span className="fw-bold extra-small" style={{ color: '#7C3AED' }}>
                              {pond.weightG > 0 ? 'grams' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Feeding Consumption */}
                      <div className="col-6">
                        <div
                          className="pond-metric-card pond-metric-card-feeding rounded-3 p-3 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#FFF7ED',
                            border: '1.5px solid #FDBA74',
                            borderRadius: '14px',
                            minHeight: '88px',
                            boxShadow: '0 1px 3px rgba(249, 115, 22, 0.06)',
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span
                              className="fw-bold text-uppercase"
                              style={{ fontSize: '0.68rem', letterSpacing: '0.03em', color: '#C2410C' }}
                            >
                              {t('Feeding Consumption')}
                            </span>
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 26, height: 26, color: '#EA580C', backgroundColor: '#FFEDD5', border: '1.5px solid #FDBA74' }}
                            >
                              <FaUtensils size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#C2410C', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {formatNumber(pond.consumedKg, 0)}
                            </span>
                            <span className="fw-bold extra-small" style={{ color: '#EA580C' }}>
                              kg
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5. Remaining Feed */}
                      <div className="col-6">
                        <div
                          className="pond-metric-card pond-metric-card-remaining rounded-3 p-3 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#F0F9FF',
                            border: '1.5px solid #7DD3FC',
                            borderRadius: '14px',
                            minHeight: '88px',
                            boxShadow: '0 1px 3px rgba(2, 132, 199, 0.06)',
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span
                              className="fw-bold text-uppercase"
                              style={{ fontSize: '0.68rem', letterSpacing: '0.03em', color: '#0369A1' }}
                            >
                              {t('Remaining Feed')}
                            </span>
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 26, height: 26, color: '#0284C7', backgroundColor: '#E0F2FE', border: '1.5px solid #7DD3FC' }}
                            >
                              <FaBalanceScale size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#0369A1', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {formatNumber(pond.remainingKg, 0)}
                            </span>
                            <span className="fw-bold extra-small" style={{ color: '#0284C7' }}>
                              kg
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. VISUAL ANALYTICS CONTAINER (Multi-View Tabs) */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-extrabold mb-1 tracking-tight text-dark" style={{ fontSize: '1.08rem' }}>
              {activeChartTab === 'feed' && t('Feed Consumption vs Remaining Feed Target (kg)')}
              {activeChartTab === 'weight' && t('Shrimp Growth & Current Body Weight (grams)')}
              {activeChartTab === 'stages' && t('Pond Culture Stages Split')}
            </h5>
            <p className="text-secondary mb-0 small" style={{ fontSize: '0.82rem' }}>
              {activeChartTab === 'feed' && t('Comparative analysis of feed consumed versus remaining feed allowance per pond.')}
              {activeChartTab === 'weight' && t('Average body weight (ABW in grams) recorded across active shrimp ponds.')}
              {activeChartTab === 'stages' && t('Distribution of active ponds across Nursery, Grow-out, and Harvest Ready milestones.')}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="d-inline-flex p-1 rounded-pill bg-light border" style={{ borderColor: '#E2E8F0' }}>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${activeChartTab === 'feed' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
                }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'feed' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('feed')}
            >
              <FaUtensils size={11} className="me-1.5" />
              {t('Feed Tracking')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${activeChartTab === 'weight' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
                }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'weight' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('weight')}
            >
              <FaWeightHanging size={11} className="me-1.5" />
              {t('Shrimp Weight (g)')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${activeChartTab === 'stages' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
                }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'stages' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('stages')}
            >
              <FaChartPie size={11} className="me-1.5" />
              {t('Culture Stages')}
            </button>
          </div>
        </div>

        {/* Tab 1: Feed Comparison */}
        {activeChartTab === 'feed' && (
          <div style={{ height: '240px' }}>
            <Bar
              data={feedComparisonChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, family: "'Poppins', sans-serif" } } }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Kilograms (kg)' } },
                  x: { grid: { display: false } }
                }
              }}
            />
          </div>
        )}

        {/* Tab 2: Shrimp Weight */}
        {activeChartTab === 'weight' && (
          <div style={{ height: '240px' }}>
            <Bar
              data={shrimpWeightChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11, family: "'Poppins', sans-serif" } } }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Weight (grams)' } },
                  x: { grid: { display: false } }
                }
              }}
            />
          </div>
        )}

        {/* Tab 3: Stages Donut */}
        {activeChartTab === 'stages' && (
          <div className="row align-items-center g-4">
            <div className="col-12 col-md-5 d-flex justify-content-center">
              <div style={{ width: '220px', height: '220px', position: 'relative' }}>
                <Doughnut
                  data={stageDonutChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '74%',
                  }}
                />
                <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ pointerEvents: 'none' }}>
                  <span className="d-block fw-extrabold text-dark" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                    {summary.total_ponds}
                  </span>
                  <span className="extra-small text-muted">{t('Active Ponds')}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-7">
              <div className="d-flex flex-column gap-2.5">
                <div className="p-2.5 rounded-3 border d-flex justify-content-between align-items-center bg-light">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                    <span className="small fw-bold text-dark">{t('Nursery Stage (Days 1–19)')}</span>
                  </div>
                  <span className="badge rounded-pill bg-white text-success border px-2.5 py-1 fw-bold">
                    {summary.nurseryCount} {t('ponds')}
                  </span>
                </div>
                <div className="p-2.5 rounded-3 border d-flex justify-content-between align-items-center bg-light">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0284C7' }}></span>
                    <span className="small fw-bold text-dark">{t('Grow-out Stage (Day 20+)')}</span>
                  </div>
                  <span className="badge rounded-pill bg-white text-primary border px-2.5 py-1 fw-bold">
                    {summary.growoutCount} {t('ponds')}
                  </span>
                </div>
                <div className="p-2.5 rounded-3 border d-flex justify-content-between align-items-center bg-light">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#F59E0B' }}></span>
                    <span className="small fw-bold text-dark">{t('Ready for Harvest')}</span>
                  </div>
                  <span className="badge rounded-pill bg-white text-warning border px-2.5 py-1 fw-bold">
                    {summary.harvestReadyCount} {t('ponds')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* 6. INSPECTION / VIEW DETAILS MODAL */}
      {selectedPond && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
          onClick={() => setSelectedPond(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div
                className="modal-header text-white px-4 py-3"
                style={{ backgroundColor: '#1E293B' }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white"
                    style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' }}
                  >
                    <FaWater size={15} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: '1.05rem' }}>
                      {selectedPond.pond_name} {t('Report & Performance')}
                    </h5>
                    <span className="extra-small text-white-50">
                      {t('Assigned Caretaker:')} {selectedPond.assigned_caretaker_name || t('Unassigned')} • {selectedPond.stageLabel}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setSelectedPond(null)}
                />
              </div>

              <div className="modal-body p-4 bg-light">
                {/* 4 Core Pond Report Metrics (Styled as 1st pic Summary Cards) */}
                <div className="row g-2.5 mb-3">
                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border shadow-2xs h-100 d-flex flex-column justify-content-between" style={{ borderColor: '#E2E8F0' }}>
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                          <span className="extra-small fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                            {t('Day of Culture')}
                          </span>
                          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 26, height: 26, color: '#10B981', backgroundColor: '#D1FAE5' }}>
                            <FaCalendarAlt size={12} />
                          </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-1">
                          <strong className="fs-5 fw-extrabold" style={{ color: '#10B981' }}>
                            {selectedPond.doc !== null ? selectedPond.doc : '-'}
                          </strong>
                          <span className="extra-small fw-bold text-muted">{t('Days')}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-top" style={{ borderColor: '#F1F5F9' }}>
                        <span className="extra-small text-muted">{selectedPond.stageLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border shadow-2xs h-100 d-flex flex-column justify-content-between" style={{ borderColor: '#E2E8F0' }}>
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                          <span className="extra-small fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                            {t('Shrimp Weight')}
                          </span>
                          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 26, height: 26, color: '#8B5CF6', backgroundColor: '#EDE9FE' }}>
                            <FaWeightHanging size={12} />
                          </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-1">
                          <strong className="fs-5 fw-extrabold" style={{ color: '#8B5CF6' }}>
                            {selectedPond.weightG.toFixed(1)}
                          </strong>
                          <span className="extra-small fw-bold text-muted">g</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-top" style={{ borderColor: '#F1F5F9' }}>
                        <span className="extra-small text-muted">Average Body Weight (ABW)</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border shadow-2xs h-100 d-flex flex-column justify-content-between" style={{ borderColor: '#E2E8F0' }}>
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                          <span className="extra-small fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                            {t('Feed Consumed')}
                          </span>
                          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 26, height: 26, color: '#FC563C', backgroundColor: 'rgba(252, 86, 60, 0.12)' }}>
                            <FaUtensils size={12} />
                          </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-1">
                          <strong className="fs-5 fw-extrabold" style={{ color: '#FC563C' }}>
                            {Math.round(selectedPond.consumedKg).toLocaleString()}
                          </strong>
                          <span className="extra-small fw-bold text-muted">kg</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-top" style={{ borderColor: '#F1F5F9' }}>
                        <span className="extra-small text-muted">{selectedPond.feedProgressPct}% completed</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border shadow-2xs h-100 d-flex flex-column justify-content-between" style={{ borderColor: '#E2E8F0' }}>
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-1.5">
                          <span className="extra-small fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
                            {t('Remaining Feed')}
                          </span>
                          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 26, height: 26, color: '#0284C7', backgroundColor: '#E0F2FE' }}>
                            <FaBalanceScale size={12} />
                          </div>
                        </div>
                        <div className="d-flex align-items-baseline gap-1">
                          <strong className="fs-5 fw-extrabold text-dark">
                            {Math.round(selectedPond.remainingKg).toLocaleString()}
                          </strong>
                          <span className="extra-small fw-bold text-muted">kg</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-top" style={{ borderColor: '#F1F5F9' }}>
                        <span className="extra-small text-muted">{t('Until Target Harvest')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Snapshot Details */}
                <div className="bg-white p-3 rounded-3 border mb-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Stocking Date')}</span>
                      <strong className="small text-dark">{selectedPond.stocking_date || t('Not set')}</strong>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Expected Harvest Date')}</span>
                      <strong className="small text-dark">{selectedPond.expected_harvest_date || t('Not set')}</strong>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Basin Surface Area')}</span>
                      <span className="small text-dark">{selectedPond.area_sqm || 500} sqm</span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Harvest Readiness')}</span>
                      <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold" style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}>
                        {selectedPond.feedProgressPct}% • {selectedPond.harvestReadinessStatus || t('In Progress')}
                      </span>
                    </div>
                    {selectedPond.adjustedHarvestKg > 0 && (
                      <div className="col-12 col-md-6">
                        <span className="extra-small text-muted d-block">{t('Predicted Harvest Yield')}</span>
                        <strong className="small text-dark">
                          {Math.round(selectedPond.adjustedHarvestKg).toLocaleString()} kg ({selectedPond.predictedHarvestTons ? selectedPond.predictedHarvestTons.toFixed(2) : (selectedPond.adjustedHarvestKg / 1000).toFixed(2)} tons)
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Biosecurity & Feed Formulation Banner */}
                <div className="p-3 rounded-3 border bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <span className="extra-small text-muted d-block fw-bold">{t('Biosecurity & Recommended Feed')}</span>
                    <span className="small text-dark">
                      {selectedPond.isNursery ? t('Tateh Starter Feed • Days 1–19 Nursery Phase') : t('Tateh Grower Feed • Day 20+ Grow-out Phase')}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 extra-small fw-bold d-flex align-items-center gap-1.5"
                    onClick={() => {
                      setCalendarModalPond(selectedPond);
                    }}
                  >
                    <FaCalendarAlt size={11} /> {t('View Cycle Calendar')}
                  </button>
                </div>
              </div>

              <div className="modal-footer px-4 py-2.5 bg-white border-top d-flex justify-content-between align-items-center">
                <button
                  type="button"
                  className="btn btn-sm btn-light border rounded-pill px-3 fw-semibold text-secondary d-flex align-items-center gap-1.5"
                  onClick={() => {
                    const p = selectedPond;
                    setSelectedPond(null);
                    openEditPondModal(p);
                  }}
                >
                  <FaEdit size={11} /> {t('Edit Pond Details')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-3"
                  onClick={() => setSelectedPond(null)}
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ADD & EDIT POND MODAL */}
      {showAddPondModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
          onClick={() => {
            setShowAddPondModal(false);
            resetForm();
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <form className="modal-content border-0 rounded-4 shadow-lg overflow-hidden" onSubmit={handleSavePond}>
              <div
                className="modal-header text-white px-4 py-3"
                style={{ backgroundColor: editingPond ? '#1E293B' : '#FC563C' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <FaWater size={16} />
                  <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: '1.05rem' }}>
                    {editingPond ? t('Edit Pond Details') : t('Stock New Pond')}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => {
                    setShowAddPondModal(false);
                    resetForm();
                  }}
                  disabled={savingPond}
                />
              </div>

              <div className="modal-body p-4 bg-light">
                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">{t('Pond Name')}</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3"
                    value={formPondName}
                    onChange={(e) => setFormPondName(e.target.value)}
                    placeholder="e.g., Pond A1, Pond B2"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">{t('Operational Status / State')}</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={formOperationalStatus}
                    onChange={(e) => setFormOperationalStatus(e.target.value)}
                  >
                    <option value="Grow-out">{t('Active (Grow-Out Phase)')}</option>
                    <option value="Nursery State">{t('Nursery State (Recently Put into Nursery)')}</option>
                    <option value="Recently Harvested">{t('Recently Harvested')}</option>
                    <option value="Ready to Harvest">{t('Ready to Harvest')}</option>
                    <option value="Resting / Prep">{t('Resting / Pond Preparation')}</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold text-dark">{t('Assigned Caretaker')}</label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={formCaretakerId}
                    onChange={(e) => setFormCaretakerId(e.target.value)}
                  >
                    <option value="">{t('Select Caretaker...')}</option>
                    {caretakers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.email || 'Caretaker'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label extra-small fw-bold text-dark">{t('Stocking Date')}</label>
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-3"
                      value={formStockingDate}
                      onChange={(e) => setFormStockingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label extra-small fw-bold text-dark">{t('Area (sqm)')}</label>
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      value={formAreaSqm}
                      onChange={(e) => setFormAreaSqm(e.target.value)}
                      min="50"
                      step="10"
                      required
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <label className="form-label extra-small fw-bold text-dark">{t('Dimensions (L × W)')}</label>
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-3"
                      value={formDimensions}
                      onChange={(e) => setFormDimensions(e.target.value)}
                      placeholder="25m × 20m"
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label extra-small fw-bold text-dark">{t('Stocking Density')}</label>
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      value={formStockingDensity}
                      onChange={(e) => setFormStockingDensity(e.target.value)}
                      min="1"
                      placeholder="50000"
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label extra-small fw-bold text-dark">{t('Post-Larvae (PL) Count')}</label>
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      value={formPlCount}
                      onChange={(e) => setFormPlCount(e.target.value)}
                      min="1"
                      placeholder="50000"
                    />
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label extra-small fw-bold text-dark">{t('Shrimp Weight (grams)')}</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control form-control-sm rounded-3"
                      value={formShrimpWeight}
                      onChange={(e) => setFormShrimpWeight(e.target.value)}
                      placeholder="18.5"
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label extra-small fw-bold text-dark">{t('Cycle Target Feed (kg)')}</label>
                    <input
                      type="number"
                      step="1"
                      className="form-control form-control-sm rounded-3"
                      value={formCycleTargetFeed}
                      onChange={(e) => setFormCycleTargetFeed(e.target.value)}
                      placeholder="15000"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer px-4 py-2.5 bg-white border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-light border rounded-pill px-3"
                  onClick={() => {
                    setShowAddPondModal(false);
                    resetForm();
                  }}
                  disabled={savingPond}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-sm text-white rounded-pill px-4 fw-bold"
                  style={{ backgroundColor: editingPond ? '#1E293B' : '#FC563C' }}
                  disabled={savingPond}
                >
                  {savingPond ? (
                    <>
                      <FaSync className="fa-spin me-1.5" /> {t('Saving...')}
                    </>
                  ) : editingPond ? (
                    t('Save Changes')
                  ) : (
                    t('Add Pond')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. POND CYCLE CALENDAR MODAL */}
      {calendarModalPond && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.72)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
          onClick={() => setCalendarModalPond(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl scan-report-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl">
              <PondCycleCalendar
                pond={calendarModalPond}
                pondId={calendarModalPond.id}
                stockingDate={calendarModalPond.stocking_date}
                pondName={calendarModalPond.pond_name || `Pond #${calendarModalPond.id}`}
                isOpen={Boolean(calendarModalPond)}
                onClose={() => setCalendarModalPond(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
