import { useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  FaBug,
  FaCalendarAlt,
  FaChartPie,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFileCsv,
  FaFilter,
  FaFlask,
  FaEdit,
  FaLayerGroup,
  FaMapMarkerAlt,
  FaPlus,
  FaRulerVertical,
  FaSearch,
  FaSeedling,
  FaSync,
  FaThermometerHalf,
  FaTimesCircle,
  FaTrash,
  FaUser,
  FaUtensils,
  FaVial,
  FaWater,
  FaWeightHanging,
  FaWind,
  FaHistory,
  FaShieldAlt,
  FaUndo,
  FaEye
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';
import PondCycleCalendar from '../../components/PondCycleCalendar';
import WaterQualityHistoryModal from '../../components/WaterQualityHistoryModal';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';

import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import { useLanguage } from '../../context/LanguageContext';

ChartJS.register(ArcElement, Tooltip, Legend);

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 ? diffDays : null;
}

const emptySummary = {
  total_ponds: 0,
  healthy_ponds: 0,
  warning_ponds: 0,
  critical_ponds: 0,
  average_feed_today: 0,
  average_pond_age: 0,
  disease_alerts: 0,
  pie_chart: { healthy_pct: 0, warning_pct: 0, critical_pct: 0 },
};

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
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

function isDiseaseAlert(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized && normalized !== 'healthy' && normalized !== 'none' && normalized !== 'no disease detected';
}

function MetricCard({ title, value, detail, icon, tone = 'primary' }) {
  const isDanger = tone === 'danger';
  const isWarning = tone === 'warning';
  const valueColor = isDanger ? '#DC2626' : isWarning ? '#EA580C' : '#172A39';
  return (
    <div className="shrimp-kpi-card">
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{title}</span>
          <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: isWarning ? '#FFF7ED' : isDanger ? '#FEF2F2' : '#F1F5F9', color: isWarning ? '#EA580C' : isDanger ? '#DC2626' : '#172A39' }}>{icon}</div>
        </div>
        <h3 className="fw-extrabold mb-1" style={{ color: valueColor, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>
          {value}
        </h3>
      </div>
      <div className="pt-2">
        <span className="text-secondary small fw-medium d-block">{detail}</span>
      </div>
    </div>
  );
}

function WaterMetric({ icon, label, value, tone = 'primary' }) {
  return (
    <div className="col-6 col-lg">
      <div className="p-3 rounded-3 bg-light border h-100">
        <div className={`text-${tone} mb-2`}>{icon}</div>
        <small className="text-muted text-uppercase fw-bold d-block">{label}</small>
        <strong className="text-dark">{value}</strong>
      </div>
    </div>
  );
}

export default function PondMonitoringPage() {
  const { t } = useLanguage();
  const [ponds, setPonds] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPond, setSelectedPond] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [diseaseFilter, setDiseaseFilter] = useState('All');
  const [caretakerFilter, setCaretakerFilter] = useState('All');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [stageFilter, setStageFilter] = useState('All'); // 'All' | 'Nursery' | 'Growout'
  const [calendarModalPond, setCalendarModalPond] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showAddPondModal, setShowAddPondModal] = useState(false);
  const [editingPond, setEditingPond] = useState(null);
  const [newPondName, setNewPondName] = useState('');
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('');
  const [caretakers, setCaretakers] = useState([]);
  const [savingPond, setSavingPond] = useState(false);
  const [historyModalPond, setHistoryModalPond] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [editingWqRecord, setEditingWqRecord] = useState(null);
  const [ocrTargetDate, setOcrTargetDate] = useState('');
  const [ocrTargetPondId, setOcrTargetPondId] = useState('');
  const [currentTheme, setCurrentTheme] = useState(() => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light'));

  useEffect(() => {
    const handleThemeChange = (e) => {
      const t = e?.detail?.theme || document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(t);
    };
    window.addEventListener('shrim-theme-changed', handleThemeChange);
    return () => window.removeEventListener('shrim-theme-changed', handleThemeChange);
  }, []);

  const isDark = currentTheme === 'dark';

  const [isolatedPonds, setIsolatedPonds] = useState(() => {
    try {
      const saved = localStorage.getItem('shrim_isolated_ponds_v3');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const syncStorage = () => {
      try {
        const saved = localStorage.getItem('shrim_isolated_ponds_v3');
        setIsolatedPonds(saved ? new Set(JSON.parse(saved)) : new Set());
      } catch {}
    };
    window.addEventListener('storage', syncStorage);
    return () => window.removeEventListener('storage', syncStorage);
  }, []);

  const isPondIsolated = (pond) => {
    if (!pond) return false;
    const name = (pond.pond_name || pond.name || '').trim().toLowerCase();
    const id = String(pond.id || '');
    if ((pond.status || '').toLowerCase() === 'isolated') return true;
    for (const item of isolatedPonds) {
      const clean = String(item).trim().toLowerCase();
      if (clean && (clean === name || clean === id)) return true;
    }
    return false;
  };

  const handleLiftIsolation = (pond) => {
    const name = pond.pond_name || pond.name || `Pond #${pond.id}`;
    const cleanName = name.trim().toLowerCase();
    Swal.fire({
      title: 'Lift Pond Isolation?',
      html: `Restore normal water intake and bio-monitoring for <strong>${name}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16A34A',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Yes, Restore Pond',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        setIsolatedPonds((prev) => {
          const next = new Set();
          for (const item of prev) {
            if (String(item).trim().toLowerCase() !== cleanName && String(item) !== String(pond.id)) {
              next.add(item);
            }
          }
          try {
            localStorage.setItem('shrim_isolated_ponds_v3', JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
        Swal.fire({
          icon: 'success',
          title: 'Isolation Lifted',
          text: `${name} has been restored to normal monitoring.`,
          confirmButtonColor: '#FC563C'
        });
      }
    });
  };

  const handleQuickIsolate = (pond) => {
    const name = pond.pond_name || pond.name || `Pond #${pond.id}`;
    Swal.fire({
      title: 'Isolate Pond Bio-Zone?',
      html: `Close pond gates and stop water intake for <strong>${name}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#FC563C',
      cancelButtonColor: '#FC563C',
      confirmButtonText: 'Yes, Isolate Pond',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        setIsolatedPonds((prev) => {
          const next = new Set(prev);
          if (name) next.add(name);
          if (pond.id) next.add(String(pond.id));
          try {
            localStorage.setItem('shrim_isolated_ponds_v3', JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
        Swal.fire({
          icon: 'success',
          title: 'Quarantine / Pond Isolated',
          text: `Valve lock engaged for ${name}. System logs recorded and added to Isolated Ponds summary.`,
          confirmButtonColor: '#FC563C'
        });
      }
    });
  };



  const loadPondData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/ponds.php');
      if (!res.data?.success || !Array.isArray(res.data.ponds)) {
        throw new Error(res.data?.message || 'Invalid pond monitoring response.');
      }
      setPonds(res.data.ponds);
      setSummary({ ...emptySummary, ...(res.data.summary || {}) });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to fetch pond records.');
      setPonds([]);
      setSummary(emptySummary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPondData();
  }, []);

  useEffect(() => {
    const loadCaretakers = async () => {
      try {
        const res = await api.get('/users.php');
        const users = Array.isArray(res.data?.users) ? res.data.users : [];
        setCaretakers(users
          .filter((user) => String(user.role || '').toLowerCase() === 'caretaker' && user.status !== 'Archived')
          .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''))));
      } catch (err) {
        setCaretakers([]);
      }
    };

    loadCaretakers();
  }, []);

  const uniqueCaretakers = useMemo(
    () => Array.from(new Set(ponds.map((p) => p.assigned_caretaker_name).filter(Boolean))).sort(),
    [ponds]
  );

  // Compute DOC, culture stage (Nursery vs Grow-out) and recommended feed for each pond on filterDate
  const pondsWithDoc = useMemo(() => {
    return ponds.map((p) => {
      const doc = computeDoc(p.stocking_date, filterDate);
      const isNursery = doc !== null && doc >= 1 && doc <= 19;
      const isGrowout = doc !== null && doc >= 20;
      const stageLabel = isNursery
        ? 'Nursery'
        : isGrowout
          ? 'Grow-out'
          : 'Pre-Stocking';
      const feedType = isNursery ? 'Tateh - Starter' : isGrowout ? 'Tateh - Grower' : '-';
      return {
        ...p,
        docOnFilterDate: doc,
        isNursery,
        isGrowout,
        stageLabel,
        feedType,
      };
    });
  }, [ponds, filterDate]);

  const nurseryCount = useMemo(() => {
    return pondsWithDoc.filter((p) => p.isNursery).length;
  }, [pondsWithDoc]);

  const growoutCount = useMemo(() => {
    return pondsWithDoc.filter((p) => p.isGrowout).length;
  }, [pondsWithDoc]);

  const isolatedPondsCount = useMemo(() => {
    return pondsWithDoc.filter((p) => isPondIsolated(p)).length;
  }, [pondsWithDoc, isolatedPonds]);

  const filteredPonds = useMemo(() => pondsWithDoc.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = [p.pond_name, p.assigned_caretaker_name].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (statusFilter === 'Isolated') {
      if (!isPondIsolated(p)) return false;
    } else if (statusFilter !== 'All') {
      if (isPondIsolated(p) || p.status !== statusFilter) return false;
    }
    if (diseaseFilter === 'Clear' && isDiseaseAlert(p.disease_detection)) return false;
    if (diseaseFilter === 'Alert' && !isDiseaseAlert(p.disease_detection)) return false;
    if (caretakerFilter !== 'All' && p.assigned_caretaker_name !== caretakerFilter) return false;
    if (stageFilter === 'Nursery' && !p.isNursery) return false;
    if (stageFilter === 'Growout' && !p.isGrowout) return false;
    return true;
  }), [pondsWithDoc, searchQuery, statusFilter, diseaseFilter, caretakerFilter, stageFilter, isolatedPonds]);

  const pieData = {
    labels: [t('Healthy'), t('Warning'), t('Critical')],
    datasets: [{
      data: [
        summary.pie_chart?.healthy_pct || 0,
        summary.pie_chart?.warning_pct || 0,
        summary.pie_chart?.critical_pct || 0,
      ],
      backgroundColor: ['#10B981', '#64748B', '#EF4444'],
      borderColor: isDark ? '#0F172A' : '#FFFFFF',
      borderWidth: 3,
    }],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          color: isDark ? '#F1F5F9' : '#0F172A',
          font: { weight: '700', size: 13, family: 'Inter, system-ui, -apple-system, sans-serif' },
          padding: 16,
          boxWidth: 8,
          boxHeight: 8,
        }
      },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}%` } },
    },
    cutout: '64%',
  };

  const handleExportCSV = () => {
    if (!filteredPonds.length) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No pond records match the current filters.' });
      return;
    }

    const headers = [
      'Pond Name', 'Status', 'Assigned Caretaker', 'Culture Stage', 'DOC (on Filter Date)', 'Recommended Feed',
      'Area (sqm)', 'Stocking Date', 'Age (Days)', 'Growth (%)', 'Feed Today (kg)', 'Total Feed (kg)',
      'Disease Detection', 'Confidence (%)', 'Harvest Readiness (%)', 'Expected Harvest Date', 'Temperature',
      'pH Level', 'Salinity', 'Dissolved Oxygen', 'Water Level', 'Latest Feed Date',
    ];
    const rows = filteredPonds.map((p) => [
      p.pond_name, p.status, p.assigned_caretaker_name, p.stageLabel, p.docOnFilterDate ?? '-', p.feedType,
      p.area_sqm, p.stocking_date, p.current_age_days, p.growth_percentage, p.feed_today_kg, p.total_feed_kg,
      p.disease_detection, p.disease_confidence, p.harvest_readiness, p.expected_harvest_date, p.temperature,
      p.ph_level, p.salinity, p.dissolved_oxygen, p.water_level, p.latest_feed_date,
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`));

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShrimPredict_Pond_Monitoring_${filterDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setDiseaseFilter('All');
    setCaretakerFilter('All');
    setStageFilter('All');
    setFilterDate(new Date().toISOString().split('T')[0]);
  };

  const resetPondForm = () => {
    setEditingPond(null);
    setNewPondName('');
    setSelectedCaretakerId('');
  };

  const openAddPondModal = () => {
    resetPondForm();
    setShowAddPondModal(true);
  };

  const openEditPondModal = (pond) => {
    const caretakerByName = caretakers.find((caretaker) => caretaker.full_name === pond.assigned_caretaker_name);
    setEditingPond(pond);
    setNewPondName(pond.pond_name || '');
    setSelectedCaretakerId(pond.assigned_caretaker_id ? String(pond.assigned_caretaker_id) : (caretakerByName ? String(caretakerByName.id) : ''));
    setShowAddPondModal(true);
  };

  const handleSavePond = async (event) => {
    event.preventDefault();
    const pondName = newPondName.trim();

    if (!pondName) {
      Swal.fire({ icon: 'warning', title: 'Pond Name Required', text: 'Please enter a pond name.' });
      return;
    }

    setSavingPond(true);
    try {
      const payload = {
        pond_name: pondName,
        assigned_caretaker_id: selectedCaretakerId,
      };
      if (editingPond) {
        payload.action = 'update';
        payload.id = editingPond.id;
      }

      const res = await api.post('/ponds.php', payload);
      if (!res.data?.success) {
        throw new Error(res.data?.message || `Unable to ${editingPond ? 'update' : 'create'} pond.`);
      }

      setShowAddPondModal(false);
      resetPondForm();
      await loadPondData();
      Swal.fire({
        icon: 'success',
        title: editingPond ? 'Pond Updated' : 'Pond Added',
        text: `${pondName} has been ${editingPond ? 'updated' : 'added'}.`,
        timer: 1600,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: `Unable to ${editingPond ? 'Update' : 'Add'} Pond`, text: err.response?.data?.message || err.message || 'Please try again.' });
    } finally {
      setSavingPond(false);
    }
  };

  const handleDeletePond = async (pond) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Pond',
      text: `Are you sure you want to delete ${pond.pond_name}?`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545',
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
      Swal.fire({ icon: 'success', title: 'Pond Deleted', text: `${pond.pond_name} has been deleted.`, timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Delete Blocked', text: err.response?.data?.message || err.message || 'This pond could not be deleted.' });
    }
  };

  return (
    <div className="pb-4">
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Pond Water Quality & Status')}
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
            {t('• Live Telemetry')}
          </span>
        </div>

        {/* Action Controls: Add Pond, Refresh, Export CSV */}
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

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4 mb-4">
          <FaTimesCircle /> {error}
        </div>
      )}

      {/* 2. 6 TOP METRIC CARDS (Leveled numbers across all 6 cards) */}
      <div className="row g-3 mb-3">
        {/* Total Ponds */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            className="shrimp-kpi-card h-100 transition-all cursor-pointer d-flex flex-column justify-content-between"
            style={{
              backgroundColor: statusFilter === 'All' ? '#F8FAFC' : '#FFFFFF',
              borderColor: statusFilter === 'All' ? '#FC563C' : '#E2E8F0',
              boxShadow: statusFilter === 'All' ? '0 0 0 2px rgba(252, 86, 60, 0.2)' : undefined,
            }}
            onClick={() => setStatusFilter('All')}
            title="Click to view all ponds"
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Total Ponds')}</span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 30, height: 30, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaLayerGroup size={13} />
                </div>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline text-dark" style={{ height: 38, lineHeight: '38px', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.total_ponds}
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Total Active Ponds')}</span>
            </div>
          </div>
        </div>

        {/* Healthy Ponds */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            className="shrimp-kpi-card h-100 transition-all cursor-pointer d-flex flex-column justify-content-between"
            style={{
              backgroundColor: statusFilter === 'Healthy' ? '#F0FDF4' : '#FFFFFF',
              borderColor: statusFilter === 'Healthy' ? '#16A34A' : '#E2E8F0',
              boxShadow: statusFilter === 'Healthy' ? '0 0 0 2px rgba(22, 163, 74, 0.25)' : undefined,
            }}
            onClick={() => setStatusFilter(statusFilter === 'Healthy' ? 'All' : 'Healthy')}
            title="Click to filter healthy ponds"
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Healthy')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  {t('Stable')}
                </span>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline" style={{ height: 38, lineHeight: '38px', color: '#16A34A', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.healthy_ponds}
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Optimal Water')}</span>
            </div>
          </div>
        </div>

        {/* Warning Ponds */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            className="shrimp-kpi-card h-100 transition-all cursor-pointer d-flex flex-column justify-content-between"
            style={{
              backgroundColor: statusFilter === 'Warning' ? '#FFFBEB' : '#FFFFFF',
              borderColor: statusFilter === 'Warning' ? '#D97706' : '#E2E8F0',
              boxShadow: statusFilter === 'Warning' ? '0 0 0 2px rgba(217, 119, 6, 0.25)' : undefined,
            }}
            onClick={() => setStatusFilter(statusFilter === 'Warning' ? 'All' : 'Warning')}
            title="Click to filter warning ponds"
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Warning')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                  {t('Notice')}
                </span>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline" style={{ height: 38, lineHeight: '38px', color: '#D97706', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.warning_ponds}
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Sub-optimal Water')}</span>
            </div>
          </div>
        </div>

        {/* Critical Ponds */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            className="shrimp-kpi-card h-100 transition-all cursor-pointer d-flex flex-column justify-content-between"
            style={{
              backgroundColor: statusFilter === 'Critical' ? '#FEF2F2' : '#FFFFFF',
              borderColor: statusFilter === 'Critical' ? '#DC2626' : '#E2E8F0',
              boxShadow: statusFilter === 'Critical' ? '0 0 0 2px rgba(220, 38, 38, 0.25)' : undefined,
            }}
            onClick={() => setStatusFilter(statusFilter === 'Critical' ? 'All' : 'Critical')}
            title="Click to filter critical alert ponds"
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Critical')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  {t('Alert')}
                </span>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline" style={{ height: 38, lineHeight: '38px', color: '#DC2626', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.critical_ponds}
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Action Required')}</span>
            </div>
          </div>
        </div>

        {/* Isolated Ponds */}
        <div className="col-6 col-md-4 col-xl-2">
          <div
            className="shrimp-kpi-card h-100 transition-all cursor-pointer d-flex flex-column justify-content-between"
            style={{
              backgroundColor: statusFilter === 'Isolated' ? '#F5F3FF' : '#FFFFFF',
              borderColor: statusFilter === 'Isolated' ? '#7C3AED' : '#E2E8F0',
              boxShadow: statusFilter === 'Isolated' ? '0 0 0 2px rgba(124, 58, 237, 0.25)' : undefined,
            }}
            onClick={() => setStatusFilter(statusFilter === 'Isolated' ? 'All' : 'Isolated')}
            title="Click to filter isolated quarantined ponds"
          >
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Isolated')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#EDE9FE', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                  {t('Bio-Lock')}
                </span>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline" style={{ height: 38, lineHeight: '38px', color: '#7C3AED', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {isolatedPondsCount}
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Isolated Ponds')}</span>
            </div>
          </div>
        </div>

        {/* Avg Feed Today */}
        <div className="col-6 col-md-4 col-xl-2">
          <div className="shrimp-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">{t('Feed Today')}</span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 30, height: 30, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaUtensils size={13} />
                </div>
              </div>
              <h3 className="fw-extrabold mb-1 d-flex align-items-baseline gap-1 text-dark" style={{ height: 38, lineHeight: '38px', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                <span>{summary.average_feed_today}</span> <small className="fs-6 text-muted fw-normal ms-1">kg</small>
              </h3>
            </div>
            <div className="pt-2">
              <span className="text-secondary extra-small d-block fw-medium">{t('Daily Consumption')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2b. COMBINED CULTURE MATURITY (AVG POND DOC) & HEALTH DISTRIBUTION */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight d-flex align-items-center gap-2">
              <FaChartPie style={{ color: '#FC563C' }} /> {t('Health Distribution & Culture Age')}
            </h5>
            <p className="small text-secondary mb-0">{t('Computed overall health status breakdown and fleet average culture age across monitored ponds.')}</p>
          </div>
          <span className="badge rounded-pill px-3 py-1.5 extra-small border" style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
            {summary.total_ponds || 0} {t('Total Monitored Ponds')}
          </span>
        </div>

        <div className="row align-items-stretch gy-4">
          {/* Section 1: Avg Pond DOC KPI Module */}
          <div className="col-12 col-md-6 col-lg-4">
            <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between admin-stat-box" style={{ border: '1.5px solid rgba(252, 86, 60, 0.18)', backgroundColor: isDark ? 'rgba(234, 88, 12, 0.04)' : '#FFFAF8' }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Avg Pond DOC')}</span>
                    <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#EA580C', fontSize: '0.68rem' }}>
                      {t('Fleet Average')}
                    </span>
                  </div>
                  <div className="tri-kpi-icon tri-kpi-icon-orange" style={{ width: 36, height: 36 }}>
                    <FaCalendarAlt size={15} />
                  </div>
                </div>

                <div className="d-flex align-items-baseline gap-2 mb-1">
                  <h3 className="fw-extrabold mb-0" style={{ color: '#EA580C', fontSize: '2.2rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {summary.average_pond_age}
                  </h3>
                  <span className="fs-6 text-muted fw-semibold">{t('Days')}</span>
                </div>
                <span className="text-muted extra-small d-block mb-3">{t('Mean culture duration across active monitored ponds')}</span>
              </div>

              <div className="pt-2 border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.12)' }}>
                <div className="d-flex justify-content-between align-items-center mb-1.5 extra-small">
                  <span className="text-muted fw-semibold">{t('Harvest Cycle Maturity')}</span>
                  <strong style={{ color: '#EA580C' }}>
                    {Math.min(100, Math.round(((summary.average_pond_age || 0) / 90) * 100))}%
                  </strong>
                </div>
                <div className="tri-progress-track mb-2" style={{ height: 7, backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.min(100, Math.round(((summary.average_pond_age || 0) / 90) * 100))}%`,
                      background: 'linear-gradient(90deg, #EA580C, #F97316)'
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center extra-small text-muted">
                  <span>{t('Harvest Benchmark')}: <strong className="text-dark">90d+</strong></span>
                  <span className="fw-bold" style={{ color: summary.average_pond_age >= 90 ? '#16A34A' : '#EA580C' }}>
                    {summary.average_pond_age >= 90 ? t('Harvest Ready') : `${Math.max(0, 90 - (summary.average_pond_age || 0))}d ${t('to benchmark')}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Health Status Breakdown Pills */}
          <div className="col-12 col-md-6 col-lg-4">
            <div className="d-flex flex-column justify-content-between h-100 gap-2.5">
              <div className="p-3 rounded-4 admin-health-pill admin-health-pill-healthy d-flex align-items-center justify-content-between flex-fill">
                <span className="fw-bold text-success d-flex align-items-center gap-2">
                  <span className="p-1.5 rounded-circle bg-success"></span> {t('Healthy Ponds')}
                </span>
                <div className="text-end">
                  <strong className="fs-5 text-success d-block">{summary.pie_chart?.healthy_pct || 0}%</strong>
                  <small className="text-muted extra-small">{summary.healthy_ponds || 0} {t('Ponds')}</small>
                </div>
              </div>

              <div className="p-3 rounded-4 admin-health-pill admin-health-pill-warning d-flex align-items-center justify-content-between flex-fill">
                <span className="fw-bold admin-health-warning-text d-flex align-items-center gap-2">
                  <span className="p-1.5 rounded-circle admin-health-warning-dot"></span> {t('Warning Ponds')}
                </span>
                <div className="text-end">
                  <strong className="fs-5 admin-health-warning-text d-block">{summary.pie_chart?.warning_pct || 0}%</strong>
                  <small className="text-muted extra-small">{summary.warning_ponds || 0} {t('Ponds')}</small>
                </div>
              </div>

              <div className="p-3 rounded-4 admin-health-pill admin-health-pill-critical d-flex align-items-center justify-content-between flex-fill">
                <span className="fw-bold text-danger d-flex align-items-center gap-2">
                  <span className="p-1.5 rounded-circle bg-danger"></span> {t('Critical Ponds')}
                </span>
                <div className="text-end">
                  <strong className="fs-5 text-danger d-block">{summary.pie_chart?.critical_pct || 0}%</strong>
                  <small className="text-muted extra-small">{summary.critical_ponds || 0} {t('Ponds')}</small>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Visual Doughnut Spotlight Box */}
          <div className="col-12 col-lg-4 d-flex justify-content-center align-items-center">
            <div
              className="p-4 rounded-4 shadow-xs w-100 d-flex flex-column align-items-center justify-content-center position-relative admin-chart-spotlight-box"
              style={{ maxWidth: 360 }}
            >
              <div className="d-flex align-items-center justify-content-between w-100 mb-2 border-bottom pb-2 admin-chart-spotlight-header">
                <span className="extra-small fw-bold text-uppercase tracking-wider d-flex align-items-center gap-1.5 admin-chart-spotlight-title">
                  <FaChartPie className="text-info" /> {t('Visual Distribution')}
                </span>
                <span className="badge rounded-pill extra-small fw-bold admin-chart-spotlight-badge">
                  {summary.total_ponds || 0} {t('Total Ponds')}
                </span>
              </div>

              <div style={{ height: 210, width: '100%', maxWidth: 300 }}>
                <Doughnut data={pieData} options={pieOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. POND MONITORING TABLE CARD (WITH INTEGRATED SEARCH & PARAMETER FILTERS) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="bg-white border rounded-4 p-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 pb-3 border-bottom" style={{ borderColor: '#E2E8F0' }}>
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: '42px',
                    height: '42px',
                    background: 'linear-gradient(135deg, rgba(252, 86, 60, 0.08) 0%, rgba(30, 58, 138, 0.14) 100%)',
                    color: '#FC563C',
                    border: '1px solid rgba(252, 86, 60, 0.12)'
                  }}
                >
                  <FaWater size={18} />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="fw-extrabold text-dark mb-0" style={{ letterSpacing: '-0.01em' }}>
                      {t('Pond Monitoring')}
                    </h5>
                    <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-0.5 extra-small fw-bold">
                      {filteredPonds.length} {t('of')} {ponds.length} {t('Ponds')}
                    </span>
                  </div>
                  <p className="extra-small text-muted mb-0 mt-0.5">
                    {t('Water quality readings, shrimp age (DOC), and caretaker pond assignments')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-tri-orange px-3 py-2 shadow-xs"
                onClick={openAddPondModal}
              >
                <FaPlus size={11} className="me-1.5" /> {t('Add New Pond')}
              </button>
            </div>

            {/* Integrated Search, Stage & Parameter Filter Toolbar with Distinct Border */}
            <AdminFilterToolbar
              className="admin-search-section-box admin-filter-card"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search pond name, caretaker, or notes..."
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters((s) => !s)}
              onExportCSV={handleExportCSV}
              onRefresh={loadPondData}
              loading={loading}
              tabs={[
                { id: 'All', label: t('All Ponds'), count: ponds.length },
                { id: 'Nursery', label: t('Nursery (Days 1–19)'), count: nurseryCount },
                { id: 'Growout', label: t('Grow-out (Day 20+)'), count: growoutCount }
              ]}
              activeTab={stageFilter}
              onTabChange={setStageFilter}
              metaRight={
                <span className="text-muted extra-small">
                  {t('Target Feed')}: <strong>{t('Days 1–19 Nursery (Starter)')}</strong> &rarr; <strong>{t('Day 20+ Grow-out (Grower)')}</strong>
                </span>
              }
              onResetFilters={clearFilters}
            >
              <div className="row g-3">
                {/* Date Filter */}
                <div className="col-12 col-md-3">
                  <label className="form-label small fw-bold text-muted d-flex align-items-center justify-content-between">
                    <span><FaCalendarAlt className="me-1 text-primary" /> {t('Evaluation Date')}</span>
                    {filterDate !== todayStr && (
                      <button
                        type="button"
                        className="btn btn-link p-0 extra-small text-primary text-decoration-none"
                        onClick={() => setFilterDate(todayStr)}
                      >
                        {t('Reset Today')}
                      </button>
                    )}
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={filterDate}
                    onChange={(event) => setFilterDate(event.target.value)}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small fw-bold text-muted">{t('Pond Status')}</label>
                  <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="All">{t('All statuses')}</option>
                    <option value="Healthy">{t('Healthy')}</option>
                    <option value="Warning">{t('Warning')}</option>
                    <option value="Critical">{t('Critical')}</option>
                    <option value="Isolated">{t('Isolated')} ({isolatedPondsCount})</option>
                    <option value="Unmonitored">{t('Unmonitored')}</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small fw-bold text-muted">{t('Disease Detection')}</label>
                  <select className="form-select" value={diseaseFilter} onChange={(event) => setDiseaseFilter(event.target.value)}>
                    <option value="All">{t('All detections')}</option>
                    <option value="Clear">{t('Clear only')}</option>
                    <option value="Alert">{t('Alerts only')}</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label small fw-bold text-muted">{t('Assigned Caretaker')}</label>
                  <select className="form-select" value={caretakerFilter} onChange={(event) => setCaretakerFilter(event.target.value)}>
                    <option value="All">{t('All caretakers')}</option>
                    {uniqueCaretakers.map((caretaker) => <option key={caretaker} value={caretaker}>{caretaker}</option>)}
                  </select>
                </div>
              </div>
            </AdminFilterToolbar>

            {loading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 mb-0">{t('Loading pond records...')}</p>
              </div>
            ) : filteredPonds.length === 0 ? (
              <div className="text-center py-5 bg-light rounded-4 border">
                <FaWater className="fs-2 text-muted mb-2" />
                <h6 className="fw-bold">{t('No ponds found')}</h6>
                <p className="small text-muted mb-0">{t('No database records match the current filters.')}</p>
              </div>
            ) : (
              <div className="table-responsive border rounded-3 admin-scrollable-table-ponds" style={{ maxHeight: 295, overflowY: 'auto', overflowX: 'auto', borderColor: '#E2E8F0' }}>
                <table className="table table-hover align-middle mb-0" style={{ minWidth: '1380px' }}>
                  <thead className="table-light border-bottom sticky-top" style={{ borderColor: '#E2E8F0', top: 0, zIndex: 5 }}>
                    <tr className="text-secondary extra-small text-uppercase fw-bold" style={{ letterSpacing: '0.03em' }}>
                      <th className="ps-3.5 py-3" style={{ minWidth: '150px' }}>{t('Pond')}</th>
                      <th className="py-3" style={{ minWidth: '175px' }}>{t('Culture & Feed')}</th>
                      <th className="py-3" style={{ minWidth: '115px' }}>{t('Status')}</th>
                      <th className="py-3" style={{ minWidth: '165px' }}>{t('Caretaker')}</th>
                      <th className="py-3" style={{ minWidth: '195px' }}>{t('Water Quality')}</th>
                      <th className="py-3" style={{ minWidth: '135px' }}>{t('Feeding')}</th>
                      <th className="py-3" style={{ minWidth: '200px' }}>{t('Biosecurity')}</th>
                      <th className="pe-3.5 py-3 text-end" style={{ minWidth: '225px' }}>{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPonds.map((pond) => {
                      const tone = statusClass[pond.status] || 'secondary';
                      return (
                        <tr key={pond.id}>
                          {/* Basin Info */}
                          <td className="ps-3.5 py-3">
                            <div className="d-flex align-items-center gap-2.5">
                              <div
                                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  background: 'rgba(252, 86, 60, 0.08)',
                                  color: '#FC563C',
                                  border: '1px solid rgba(252, 86, 60, 0.16)'
                                }}
                              >
                                <FaWater size={15} />
                              </div>
                              <span className="fw-bold text-dark text-nowrap" style={{ fontSize: '0.88rem' }}>
                                {pond.pond_name}
                              </span>
                            </div>
                          </td>

                          {/* Culture Stage & Feed */}
                          <td className="py-3">
                            {pond.docOnFilterDate !== null ? (
                              pond.isNursery ? (
                                <div>
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.74rem' }}
                                  >
                                    <span className="rounded-circle bg-success" style={{ width: 5, height: 5 }} />
                                    {t('Day')} {pond.docOnFilterDate} • {t('Nursery')}
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium text-nowrap">
                                    {t('Feed:')} <strong className="text-secondary">{t('Tateh - Starter')}</strong>
                                  </div>
                                </div>
                              ) : pond.docOnFilterDate === 20 ? (
                                <div>
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontSize: '0.74rem' }}
                                  >
                                    {t('Day')} 20 • {t('Transfer')}
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium text-nowrap">
                                    {t('Feed:')} <strong className="text-secondary">{t('Tateh - Grower')}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.74rem' }}
                                  >
                                    <span className="rounded-circle bg-primary" style={{ width: 5, height: 5 }} />
                                    {t('Day')} {pond.docOnFilterDate} • {t('Grow-out')}
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium text-nowrap">
                                    {t('Feed:')} <strong className="text-secondary">{t('Tateh - Grower')}</strong>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div>
                                <span className="badge bg-light text-muted border px-2.5 py-1 extra-small fw-medium rounded-pill">
                                  {t('Pre-Stocking')}
                                </span>
                                <div className="extra-small text-muted mt-1">{t('Pending Stock')}</div>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3">
                            {(() => {
                              const isolated = isPondIsolated(pond);
                              return (
                                <span
                                  className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1.5 shadow-2xs"
                                  style={{
                                    fontSize: '0.75rem',
                                    backgroundColor:
                                      isolated ? '#F5F3FF' :
                                      tone === 'success' ? '#ECFDF5' :
                                      tone === 'warning' ? '#FFFBEB' :
                                      tone === 'danger' ? '#FEF2F2' : '#F1F5F9',
                                    color:
                                      isolated ? '#7C3AED' :
                                      tone === 'success' ? '#047857' :
                                      tone === 'warning' ? '#B45309' :
                                      tone === 'danger' ? '#B91C1C' : '#475569',
                                    border: `1px solid ${
                                      isolated ? '#DDD6FE' :
                                      tone === 'success' ? '#A7F3D0' :
                                      tone === 'warning' ? '#FDE68A' :
                                      tone === 'danger' ? '#FECACA' : '#CBD5E1'
                                    }`
                                  }}
                                >
                                  <span
                                    className="rounded-circle"
                                    style={{
                                      width: 6,
                                      height: 6,
                                      backgroundColor:
                                        isolated ? '#7C3AED' :
                                        tone === 'success' ? '#10B981' :
                                        tone === 'warning' ? '#F59E0B' :
                                        tone === 'danger' ? '#EF4444' : '#64748B'
                                    }}
                                  />
                                  {isolated ? t('Isolated') : t(pond.status || 'Unmonitored')}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Caretaker */}
                          <td className="py-3">
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  fontSize: '0.72rem',
                                  background: pond.assigned_caretaker_name
                                    ? 'linear-gradient(135deg, #FC563C 0%, #1E4E8C 100%)'
                                    : '#94A3B8'
                                }}
                              >
                                {pond.assigned_caretaker_name ? pond.assigned_caretaker_name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <span
                                className="fw-medium text-dark text-nowrap"
                                style={{ fontSize: '0.84rem' }}
                                title={pond.assigned_caretaker_name || t('Unassigned')}
                              >
                                {pond.assigned_caretaker_name || <span className="text-muted fst-italic">{t('Unassigned')}</span>}
                              </span>
                            </div>
                          </td>

                          {/* Water Quality Indices (Clean 2x2 Grid) */}
                          <td className="py-3">
                            <div
                              className="d-grid gap-1"
                              style={{
                                gridTemplateColumns: 'repeat(2, minmax(80px, 1fr))',
                                width: '175px'
                              }}
                            >
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Water Temperature"
                              >
                                <span className="text-muted fw-semibold">Temp</span>
                                <span className="fw-bold text-dark font-mono ms-1">{valueOrDash(pond.temperature, '°C')}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Water pH Level"
                              >
                                <span className="text-muted fw-semibold">pH</span>
                                <span className="fw-bold text-dark font-mono ms-1">{valueOrDash(pond.ph_level)}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Dissolved Oxygen (DO)"
                              >
                                <span className="text-muted fw-semibold">DO</span>
                                <span className="fw-bold text-dark font-mono ms-1">{valueOrDash(pond.dissolved_oxygen, 'mg')}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Salinity Level"
                              >
                                <span className="text-muted fw-semibold">Sal</span>
                                <span className="fw-bold text-dark font-mono ms-1">{valueOrDash(pond.salinity, 'ppt')}</span>
                              </div>
                            </div>
                          </td>

                          {/* Feed Consumption */}
                          <td className="py-3">
                            <div style={{ minWidth: '120px' }}>
                              <div className="d-flex align-items-baseline gap-1 text-nowrap">
                                <span className="fw-extrabold text-dark" style={{ fontSize: '0.90rem' }}>
                                  {formatNumber(pond.feed_today_kg)}
                                </span>
                                <span className="extra-small text-muted fw-semibold">{t('kg today')}</span>
                              </div>
                              <div className="extra-small text-muted mt-0.5 text-nowrap">
                                {t('Total:')} <strong className="text-secondary">{Math.round(Number(pond.total_feed_kg || 0)).toLocaleString()} kg</strong>
                              </div>
                            </div>
                          </td>

                          {/* Biosecurity */}
                          <td className="py-3">
                            {isDiseaseAlert(pond.disease_detection) || pond.status === 'Critical' || isPondIsolated(pond) ? (
                              <div className="d-flex flex-column align-items-start gap-1">
                                <span
                                  className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 extra-small text-nowrap shadow-2xs"
                                  style={{
                                    background: '#FEF2F2',
                                    color: '#B91C1C',
                                    border: '1px solid #FECACA',
                                    fontSize: '0.72rem'
                                  }}
                                  title={`Disease Alert: ${pond.disease_detection || 'Critical Status'}`}
                                >
                                  <FaExclamationTriangle size={9} className="flex-shrink-0 text-danger" />
                                  <span>{pond.disease_detection || t('Critical Alert')}</span>
                                </span>
                                {isPondIsolated(pond) ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-0.5 extra-small fw-bold d-inline-flex align-items-center gap-1 shadow-2xs mt-0.5"
                                    style={{ fontSize: '0.70rem', lineHeight: '17px' }}
                                    onClick={() => handleLiftIsolation(pond)}
                                    title="Lift Quarantine Protocol"
                                  >
                                    <FaUndo size={8} /> {t('Restore')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger rounded-pill px-2.5 py-0.5 extra-small fw-bold d-inline-flex align-items-center gap-1 shadow-2xs mt-0.5"
                                    style={{ fontSize: '0.70rem', lineHeight: '17px', backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                                    onClick={() => handleQuickIsolate(pond)}
                                    title="Isolate Pond Bio-Zone"
                                  >
                                    <FaShieldAlt size={8} /> {t('Isolate')}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 extra-small"
                                style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.74rem' }}
                              >
                                <FaCheckCircle size={9} /> {t('Clear')}
                              </span>
                            )}
                          </td>

                          {/* Quick Actions (Streamlined, Non-Wrapping) */}
                          <td className="pe-3.5 py-3 text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1.5 flex-nowrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-navy rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                                style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                                onClick={() => setSelectedPond(pond)}
                                title="View Detailed Pond Analytics"
                              >
                                <FaEye size={10} /> {t('Details')}
                              </button>
                              <button
                                type="button"
                                className="btn-action-squircle action-cycle"
                                onClick={() => setCalendarModalPond(pond)}
                                title="Culture Cycle Calendar"
                              >
                                <FaCalendarAlt size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-action-squircle action-logs"
                                onClick={() => {
                                  setHistoryModalPond(pond);
                                  setIsHistoryModalOpen(true);
                                }}
                                title="Water Quality Historical Logs"
                              >
                                <FaHistory size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-action-squircle action-edit"
                                onClick={() => openEditPondModal(pond)}
                                title="Edit Pond Basin Details"
                              >
                                <FaEdit size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-action-squircle action-delete"
                                onClick={() => handleDeletePond(pond)}
                                title="Delete Pond Basin"
                              >
                                <FaTrash size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPond && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content border-0 shadow rounded-4 overflow-hidden">
              <div className="modal-header p-4 bg-primary text-white border-0">
                <div>
                  <h4 className="fw-bold text-white mb-1">{selectedPond.pond_name}</h4>
                  <div className="small text-white text-opacity-75">
                    {t('Pond')} #{selectedPond.id} | {t('Caretaker:')} {selectedPond.assigned_caretaker_name || t('Unassigned')}
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPond(null)} />
              </div>
              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3"><MetricCard title={t('Status')} value={t(selectedPond.status || '-')} detail={t('Database/API status')} icon={<FaWater />} tone={statusClass[selectedPond.status] || 'secondary'} /></div>
                  <div className="col-12 col-md-3"><MetricCard title={t('Area')} value={valueOrDash(selectedPond.area_sqm, ' sqm')} detail={t('Pond size')} icon={<FaRulerVertical />} tone="info" /></div>
                  <div className="col-12 col-md-3"><MetricCard title={t('Stocking Date')} value={valueOrDash(selectedPond.stocking_date)} detail={`${valueOrDash(selectedPond.current_age_days, ` ${t('DOC')}`)}`} icon={<FaCalendarAlt />} tone="secondary" /></div>
                  <div className="col-12 col-md-3"><MetricCard title={t('Harvest Readiness')} value={valueOrDash(formatNumber(selectedPond.harvest_readiness), '%')} detail={t(selectedPond.harvest_readiness_status || '-')} icon={<FaWeightHanging />} tone="warning" /></div>
                </div>

                {/* Culture Stage & Recommended Feed formulation Banner */}
                {(() => {
                  const selDoc = computeDoc(selectedPond.stocking_date, filterDate);
                  const isNursery = selDoc !== null && selDoc >= 1 && selDoc <= 19;
                  const isGrowout = selDoc !== null && selDoc >= 20;
                  const feedType = isNursery ? 'Tateh - Starter' : isGrowout ? 'Tateh - Grower' : '-';

                  return (
                    <div className="p-3.5 rounded-4 border mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ background: '#E9E4E0' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0 shadow-xs"
                          style={{
                            width: 44,
                            height: 44,
                            background: isNursery ? '#059669' : '#FC563C',
                          }}
                        >
                          {isNursery ? <FaSeedling size={20} /> : <FaWater size={20} />}
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h6 className="fw-extrabold mb-0 text-dark">
                              {selDoc !== null
                                ? isNursery
                                  ? `${t('Nursery Pond Stage')} (${t('Day')} ${selDoc} ${t('of Culture')})`
                                  : selDoc === 20
                                    ? `${t('Transfer Milestone Day')} (${t('Day')} 20 ${t('of Culture')})`
                                    : `${t('Grow-out Pond Stage')} (${t('Day')} ${selDoc} ${t('of Culture')})`
                                : t('Unstocked / Pre-Stocking Phase')}
                            </h6>
                            <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small">
                              {t('Evaluated on')} {filterDate}
                            </span>
                          </div>
                          <p className="text-muted extra-small mb-0 mt-1">
                            {t('Required Feed Formulation:')} <strong className="text-dark">{t(feedType)}</strong> • {t('Days 1–19 Nursery (Starter)')} &rarr; {t('Day 20+ Grow-out (Grower)')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 fw-bold d-flex align-items-center gap-2 shadow-xs"
                        onClick={() => {
                          setCalendarModalPond(selectedPond);
                        }}
                      >
                        <FaCalendarAlt size={12} /> {t('View Pond Cycle Calendar')}
                      </button>
                    </div>
                  );
                })()}

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <div className={`p-4 rounded-4 border h-100 ${isDiseaseAlert(selectedPond.disease_detection) ? 'bg-danger bg-opacity-10 border-danger border-opacity-25' : 'bg-success bg-opacity-10 border-success border-opacity-25'}`}>
                      <h6 className={`fw-bold ${isDiseaseAlert(selectedPond.disease_detection) ? 'text-danger' : 'text-success'} d-flex align-items-center gap-2`}>
                        <FaBug /> {t('Disease Detection')}
                      </h6>
                      <h5 className="fw-bold text-dark">{isDiseaseAlert(selectedPond.disease_detection) ? t(selectedPond.disease_detection) : t('Clear')}</h5>
                      <p className="small text-muted mb-0">{t('Confidence')}: {formatNumber(selectedPond.disease_confidence)}%</p>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-light h-100">
                      <h6 className="fw-bold text-dark d-flex align-items-center gap-2"><FaUtensils /> {t('Feeding')}</h6>
                      <div className="d-flex justify-content-between"><span>{t('Today')}</span><strong>{formatNumber(selectedPond.feed_today_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>{t('Total')}</span><strong>{formatNumber(selectedPond.total_feed_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>{t('Latest Feed Date')}</span><strong>{valueOrDash(selectedPond.latest_feed_date)}</strong></div>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <h6 className="fw-bold text-muted text-uppercase mb-0">{t('Water Quality Parameters')}</h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1.5 shadow-xs"
                    onClick={() => {
                      setHistoryModalPond(selectedPond);
                      setIsHistoryModalOpen(true);
                    }}
                  >
                    <FaHistory size={11} /> {t('View Water Quality History & Backfill')}
                  </button>
                </div>
                <div className="row g-3 text-center">
                  <WaterMetric icon={<FaThermometerHalf size={20} />} label={t('Temperature')} value={valueOrDash(selectedPond.temperature, ' °C')} tone="danger" />
                  <WaterMetric icon={<FaVial size={20} />} label={t('pH')} value={valueOrDash(selectedPond.ph_level)} />
                  <WaterMetric icon={<FaFlask size={20} />} label={t('Salinity')} value={valueOrDash(selectedPond.salinity, ' ppt')} tone="info" />
                  <WaterMetric icon={<FaWind size={20} />} label={t('Dissolved Oxygen')} value={valueOrDash(selectedPond.dissolved_oxygen, ' mg/L')} tone="success" />
                  <WaterMetric icon={<FaRulerVertical size={20} />} label={t('Water Level')} value={valueOrDash(selectedPond.water_level, ' m')} tone="secondary" />
                </div>
              </div>
              <div className="modal-footer bg-light border-0">
                <button className="btn btn-secondary px-4" onClick={() => setSelectedPond(null)}>{t('Close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddPondModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <form className="modal-content border-0 shadow rounded-4 overflow-hidden" onSubmit={handleSavePond}>
              <div className="modal-header bg-primary text-white border-0">
                <h5 className="modal-title fw-bold text-white">{editingPond ? t('Edit Pond') : t('Add Pond')}</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowAddPondModal(false);
                    resetPondForm();
                  }}
                  disabled={savingPond}
                />
              </div>
              <div className="modal-body p-4">
                <label className="form-label fw-bold">{t('Pond Name')}</label>
                <input
                  className="form-control"
                  value={newPondName}
                  onChange={(event) => setNewPondName(event.target.value)}
                  placeholder="e.g. Pond D1"
                  autoFocus
                  disabled={savingPond}
                />
                <label className="form-label fw-bold mt-3">{t('Assigned Caretaker')}</label>
                <select
                  className="form-select"
                  value={selectedCaretakerId}
                  onChange={(event) => setSelectedCaretakerId(event.target.value)}
                  disabled={savingPond}
                >
                  <option value="">{t('Unassigned')}</option>
                  {caretakers.map((caretaker) => (
                    <option key={caretaker.id} value={caretaker.id}>{caretaker.full_name}</option>
                  ))}
                </select>
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <small className="text-muted d-block">
                    <FaWater className="me-1 text-primary" />
                    {t('Status will initialize as Unmonitored. It will automatically update to Healthy, Warning, or Critical once actual water quality readings are recorded.')}
                  </small>
                </div>
              </div>
              <div className="modal-footer bg-light border-0">
                <button
                  type="button"
                  className="btn btn-secondary px-4"
                  onClick={() => {
                    setShowAddPondModal(false);
                    resetPondForm();
                  }}
                  disabled={savingPond}
                >
                  {t('Cancel')}
                </button>
                <button type="submit" className="btn btn-primary px-4" disabled={savingPond}>
                  {savingPond ? t('Saving...') : t('Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POND CYCLE CALENDAR MODAL (DAYS 1-19 NURSERY & DAY 20+ GROW-OUT) */}
      {calendarModalPond && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1070 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="modal-header text-white border-0 py-3"
                style={{ background: 'linear-gradient(135deg, #172A39 0%, #FC563C 50%, #FC563C 100%)' }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 34, height: 34, background: 'rgba(255, 255, 255, 0.15)' }}
                  >
                    <FaCalendarAlt size={16} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0">
                      {t('Pond Culture Timeline & Cycle Calendar')}
                    </h5>
                    <span className="text-white text-opacity-80 extra-small">
                      {calendarModalPond.pond_name} • {t('Assigned:')} {calendarModalPond.assigned_caretaker_name || t('Unassigned')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setCalendarModalPond(null)}
                />
              </div>
              <div className="modal-body p-4 bg-light">
                <PondCycleCalendar
                  pondId={calendarModalPond.id}
                  pondName={calendarModalPond.pond_name}
                  stockingDate={calendarModalPond.stocking_date}
                  selectedDate={filterDate && computeDoc(calendarModalPond.stocking_date, filterDate) <= 34 ? filterDate : undefined}
                  onSelectDate={(dateStr) => {
                    setFilterDate(dateStr);
                  }}
                  onClose={() => setCalendarModalPond(null)}
                />
              </div>
              <div className="modal-footer bg-white border-top py-2.5">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill px-4"
                  onClick={() => setCalendarModalPond(null)}
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WATER QUALITY LOG HISTORY & BACKFILL MODAL */}
      <WaterQualityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryModalPond(null);
        }}
        pond={historyModalPond}
        canEdit={true}
        onEditRecord={(record) => {
          setEditingWqRecord(record);
          setOcrTargetPondId(String(record.pond_id));
          setOcrTargetDate(record.record_date);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
        onAddRecord={(date) => {
          setEditingWqRecord(null);
          if (historyModalPond) setOcrTargetPondId(String(historyModalPond.id));
          setOcrTargetDate(date || todayStr);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
      />

      {/* DUAL-MODE OCR WATER QUALITY MODAL */}
      <WaterQualityOcrModal
        isOpen={isOcrModalOpen}
        onClose={() => {
          setIsOcrModalOpen(false);
          setEditingWqRecord(null);
        }}
        assignedPonds={ponds}
        initialPondId={ocrTargetPondId || (historyModalPond ? String(historyModalPond.id) : '')}
        initialDate={ocrTargetDate || todayStr}
        initialRecord={editingWqRecord}
        caretakerName="Administrator"
        onSuccess={() => {
          loadPondData();
        }}
      />
    </div>
  );
}
