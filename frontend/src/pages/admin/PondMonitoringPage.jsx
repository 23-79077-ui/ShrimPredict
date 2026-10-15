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
  return num % 1 === 0 ? num.toLocaleString() : num.toFixed(digits);
}

function isDiseaseAlert(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized && normalized !== 'healthy' && normalized !== 'none' && normalized !== 'no disease detected';
}

export default function PondMonitoringPage() {
  const { t, isDark } = useLanguage();

  const [ponds, setPonds] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');
  const [caretakerFilter, setCaretakerFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All'); // 'All' | 'Nursery' | 'Growout' | 'HarvestReady'
  const [sortBy, setSortBy] = useState('doc-desc'); // 'doc-desc' | 'doc-asc' | 'weight-desc' | 'feed-desc' | 'name-asc'
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
  const [formShrimpWeight, setFormShrimpWeight] = useState(18.5);
  const [formCycleTargetFeed, setFormCycleTargetFeed] = useState(800);
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
      const [pondsRes, usersRes] = await Promise.all([
        api.get('/ponds.php'),
        api.get('/users.php?role=caretaker')
      ]);

      const pondList = safeArray(pondsRes.data?.ponds || pondsRes.data);
      setPonds(pondList);

      const userList = safeArray(usersRes.data?.users || usersRes.data);
      setCaretakers(userList.filter((u) => String(u.role || '').toLowerCase() === 'caretaker'));
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
    return ponds.map((p) => {
      const doc = p.doc ?? computeDoc(p.stocking_date, todayStr);
      const isNursery = doc !== null && doc >= 1 && doc <= 19;
      const isGrowout = doc !== null && doc >= 20;
      const isHarvestReady = (p.harvest_readiness || 0) >= 95 || (doc !== null && doc >= 85);

      const consumedKg = !isNaN(parseFloat(p.total_feed_kg)) ? parseFloat(p.total_feed_kg) : 0;
      const targetKg = parseFloat(p.cycle_target_feed_kg || 800);
      const remainingKg = !isNaN(parseFloat(p.remaining_feed_kg))
        ? parseFloat(p.remaining_feed_kg)
        : Math.max(0, targetKg - consumedKg);
      const feedProgressPct = targetKg > 0 ? Math.min(100, Math.round((consumedKg / targetKg) * 100)) : 0;
      const weightG = !isNaN(parseFloat(p.shrimp_weight_g)) ? parseFloat(p.shrimp_weight_g) : 18.5;

      let stageLabel = t('Unstocked');
      if (isHarvestReady) stageLabel = t('Ready to Harvest');
      else if (isNursery) stageLabel = t('Nursery');
      else if (isGrowout) stageLabel = t('Grow-out');

      const isInactive =
        (p.operational_status && String(p.operational_status).toLowerCase() === 'inactive') ||
        p.is_active === false ||
        (p.status && String(p.status).toLowerCase() === 'inactive') ||
        !p.stocking_date;
      const operationalStatus = isInactive ? 'Inactive' : 'Active';
      const isActive = !isInactive;

      return {
        ...p,
        doc,
        isNursery,
        isGrowout,
        isHarvestReady,
        stageLabel,
        consumedKg,
        targetKg,
        remainingKg,
        feedProgressPct,
        weightG,
        operationalStatus,
        isActive,
      };
    });
  }, [ponds, t]);

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
          if (statusFilter.toLowerCase() === 'active') {
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
        if (sortBy === 'name-asc') return (a.pond_name || '').localeCompare(b.pond_name || '');
        return 0;
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
      p.weightG ?? 18.5,
      p.consumedKg ?? 0,
      p.remainingKg ?? 0,
      p.targetKg ?? 800,
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
    setFormShrimpWeight(18.5);
    setFormCycleTargetFeed(800);
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
    setFormShrimpWeight(pond.shrimp_weight_g || 18.5);
    setFormCycleTargetFeed(pond.cycle_target_feed_kg || 800);
    setShowAddPondModal(true);
  };

  const handleSavePond = async (e) => {
    e.preventDefault();
    const pondName = formPondName.trim();
    if (!pondName) {
      Swal.fire({ icon: 'warning', title: t('Pond Name Required'), text: t('Please enter a pond name.') });
      return;
    }

    setSavingPond(true);
    try {
      const payload = {
        pond_name: pondName,
        assigned_caretaker_id: formCaretakerId,
        stocking_date: formStockingDate,
        area_sqm: parseInt(formAreaSqm, 10) || 500,
        shrimp_weight_g: parseFloat(formShrimpWeight) || 18.5,
        cycle_target_feed_kg: parseFloat(formCycleTargetFeed) || 800,
      };

      if (editingPond) {
        payload.action = 'update';
        payload.id = editingPond.id;
        const currentFed = parseFloat(editingPond.total_feed_kg || 0);
        payload.remaining_feed_kg = Math.max(0, payload.cycle_target_feed_kg - currentFed);
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
    <div className="container-fluid px-3 px-xl-4 py-3">
      {/* 1. UNIFIED HERO TITLE HEADER */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3.5 pb-2">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="badge rounded-pill fw-bold extra-small px-2.5 py-1 text-uppercase"
              style={{ backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              {t('Aquaculture Operations')}
            </span>
            <span className="text-muted extra-small">
              {summary.total_ponds} {t('Active Ponds')} • {summary.avg_doc} {t('Avg DOC')}
            </span>
            <span className="badge rounded-pill px-2.5 py-0.5 extra-small border" style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
              {filteredPonds.length} {filteredPonds.length === 1 ? t('Pond') : t('Ponds')}
            </span>
          </div>
          <h3 className="fw-extrabold mb-1 tracking-tight text-dark" style={{ fontSize: '1.45rem' }}>
            {t('Pond Reports')}
          </h3>
          <p className="text-secondary small mb-0" style={{ maxWidth: '820px' }}>
            {t('Pond Reports Subtitle')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="position-relative" style={{ minWidth: '220px' }}>
            <FaSearch
              className="position-absolute text-muted"
              size={12}
              style={{ left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-control form-control-sm ps-4 pe-3 rounded-pill border shadow-2xs"
              placeholder={t('Search by pond name, caretaker...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.82rem', borderColor: '#E2E8F0', height: '32px' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-understated-feed shadow-2xs"
            onClick={loadPondData}
            disabled={loading}
            title={t('Refresh')}
          >
            <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> {t('Refresh')}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-understated-feed shadow-2xs"
            onClick={handleExportCSV}
            title={t('Export CSV')}
          >
            <FaFileCsv size={13} className="me-1.5 text-success" /> {t('Export CSV')}
          </button>

          <button
            type="button"
            className="btn btn-sm text-white shadow-sm d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-3 fw-bold"
            style={{ backgroundColor: '#FC563C' }}
            onClick={openAddPondModal}
          >
            <FaPlus size={11} /> {t('Stock New Pond')}
          </button>
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
                  className="bg-white border rounded-4 p-4 shadow-2xs h-100 d-flex flex-column justify-content-between transition-all"
                  style={{
                    borderColor: '#E2E8F0',
                    borderRadius: '18px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedPond(pond)}
                  title={t('Click to view pond details')}
                >
                  <div>
                    {/* 1. Pond Name & Status Header */}
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 38,
                            height: 38,
                            backgroundColor: '#EFF6FF',
                            color: '#0284C7',
                            border: '1px solid #BAE6FD',
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

                      {/* Status: Active / Inactive based on database */}
                      <span
                        className="badge rounded-pill px-3 py-1.5 fw-bold d-inline-flex align-items-center gap-1.5"
                        style={{
                          backgroundColor: pond.isActive ? '#ECFDF5' : '#F1F5F9',
                          color: pond.isActive ? '#065F46' : '#475569',
                          border: pond.isActive ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                          fontSize: '0.74rem',
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: pond.isActive ? '#10B981' : '#94A3B8',
                          }}
                        />
                        {pond.isActive ? t('Active') : t('Inactive')}
                      </span>
                    </div>

                    {/* 2. Caretaker */}
                    <div
                      className="px-3.5 py-2.5 rounded-3 mb-3.5 d-flex align-items-center gap-2.5"
                      style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' }}
                    >
                      <div
                        className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                        style={{ width: 30, height: 30, backgroundColor: '#334155', fontSize: '0.70rem' }}
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
                    <div className="row g-3">
                      {/* 3. Day of Culture (DOC) */}
                      <div className="col-6">
                        <div
                          className="rounded-3 p-3.5 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#F0FDF4',
                            border: '1px solid #DCFCE7',
                            borderRadius: '14px',
                            minHeight: '88px',
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
                              style={{ width: 24, height: 24, color: '#059669', backgroundColor: '#DCFCE7' }}
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
                          className="rounded-3 p-3.5 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#FAF5FF',
                            border: '1px solid #F3E8FF',
                            borderRadius: '14px',
                            minHeight: '88px',
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
                              style={{ width: 24, height: 24, color: '#7C3AED', backgroundColor: '#F3E8FF' }}
                            >
                              <FaWeightHanging size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#6B21A8', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {formatNumber(pond.weightG, 1)}
                            </span>
                            <span className="fw-bold extra-small" style={{ color: '#7C3AED' }}>
                              grams
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Feeding Consumption */}
                      <div className="col-6">
                        <div
                          className="rounded-3 p-3.5 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#FFF7ED',
                            border: '1px solid #FFEDD5',
                            borderRadius: '14px',
                            minHeight: '88px',
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
                              style={{ width: 24, height: 24, color: '#EA580C', backgroundColor: '#FFEDD5' }}
                            >
                              <FaUtensils size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#C2410C', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {formatNumber(pond.consumedKg, 1)}
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
                          className="rounded-3 p-3.5 h-100 d-flex flex-column justify-content-between"
                          style={{
                            backgroundColor: '#F0F9FF',
                            border: '1px solid #E0F2FE',
                            borderRadius: '14px',
                            minHeight: '88px',
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
                              style={{ width: 24, height: 24, color: '#0284C7', backgroundColor: '#E0F2FE' }}
                            >
                              <FaBalanceScale size={11} />
                            </div>
                          </div>
                          <div className="d-flex align-items-baseline gap-1 mt-1">
                            <span className="fw-extrabold" style={{ color: '#0369A1', fontSize: '1.45rem', lineHeight: 1.1 }}>
                              {formatNumber(pond.remainingKg, 1)}
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
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'feed' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'feed' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('feed')}
            >
              <FaUtensils size={11} className="me-1.5" />
              {t('Feed Tracking')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'weight' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'weight' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('weight')}
            >
              <FaWeightHanging size={11} className="me-1.5" />
              {t('Shrimp Weight (g)')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'stages' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
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
                        {formatNumber(selectedPond.harvest_readiness)}% • {selectedPond.harvest_readiness_status || t('In Progress')}
                      </span>
                    </div>
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
                      placeholder="800"
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
        <PondCycleCalendar
          pond={calendarModalPond}
          isOpen={Boolean(calendarModalPond)}
          onClose={() => setCalendarModalPond(null)}
        />
      )}
    </div>
  );
}
