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
  FaEye
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../../services/api';
import PondCycleCalendar from '../../components/PondCycleCalendar';
import WaterQualityHistoryModal from '../../components/WaterQualityHistoryModal';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';

import AdminFilterToolbar from '../../components/AdminFilterToolbar';

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
  const isOrange = tone === 'warning' || tone === 'danger';
  return (
    <div className="tri-kpi-card">
      <div>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{title}</span>
          <div className={`tri-kpi-icon ${isOrange ? 'tri-kpi-icon-orange' : 'tri-kpi-icon-blue'}`}>{icon}</div>
        </div>
        <h3 className="fw-extrabold mb-1" style={{ color: isOrange ? '#EA580C' : '#0B2C5F', fontSize: '1.8rem', letterSpacing: '-0.02em' }}>
          {value}
        </h3>
      </div>
      <div>
        <div className="tri-progress-track my-2.5" style={{ backgroundColor: isOrange ? 'rgba(234, 88, 12, 0.1)' : 'rgba(11, 44, 95, 0.08)' }}>
          <div
            className="tri-progress-bar"
            style={{
              width: '100%',
              background: isOrange ? 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)' : 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)'
            }}
          />
        </div>
        <span className="text-muted extra-small d-block">{detail}</span>
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

  const filteredPonds = useMemo(() => pondsWithDoc.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = [p.pond_name, p.assigned_caretaker_name].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (diseaseFilter === 'Clear' && isDiseaseAlert(p.disease_detection)) return false;
    if (diseaseFilter === 'Alert' && !isDiseaseAlert(p.disease_detection)) return false;
    if (caretakerFilter !== 'All' && p.assigned_caretaker_name !== caretakerFilter) return false;
    if (stageFilter === 'Nursery' && !p.isNursery) return false;
    if (stageFilter === 'Growout' && !p.isGrowout) return false;
    return true;
  }), [pondsWithDoc, searchQuery, statusFilter, diseaseFilter, caretakerFilter, stageFilter]);

  const pieData = {
    labels: ['Healthy', 'Warning', 'Critical'],
    datasets: [{
      data: [
        summary.pie_chart?.healthy_pct || 0,
        summary.pie_chart?.warning_pct || 0,
        summary.pie_chart?.critical_pct || 0,
      ],
      backgroundColor: ['#1FB567', '#FF7A00', '#E04848'],
      borderColor: '#ffffff',
      borderWidth: 3,
    }],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true } },
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
      {/* 🌟 1. EXECUTIVE HERO BANNER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
            style={{
              width: 50,
              height: 50,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #1E3A8A 100%)',
              color: '#FFFFFF',
              fontSize: '1.3rem',
              border: '2px solid rgba(234, 88, 12, 0.3)'
            }}
          >
            <FaWater />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Pond Basins &amp; Real-time Biometrics
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
              >
                ● Live Production Telemetry
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              Comprehensive water quality parameter monitoring, biomass telemetry, stocking cycle stages, and OCR sensor logs.
            </p>
          </div>
        </div>

        {/* Action Controls: Add Pond, Refresh, Export CSV */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-tri-orange px-3.5 py-2 shadow-xs"
            style={{ height: 40, fontSize: '0.82rem' }}
            onClick={openAddPondModal}
          >
            <FaPlus size={12} className="me-1.5" /> Add Pond
          </button>

          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadPondData}
            disabled={loading}
          >
            <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> Refresh
          </button>

          <button
            type="button"
            className="btn btn-sm btn-tri-navy px-4 py-2 shadow-xs"
            style={{ height: 40, fontSize: '0.82rem' }}
            onClick={handleExportCSV}
          >
            <FaFileCsv size={13} className="me-1.5" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4 mb-4">
          <FaTimesCircle /> {error}
        </div>
      )}

      {/* 🌟 2. 6 TOP METRIC CARDS (Tri-Color System) */}
      <div className="row g-3 g-xl-3 mb-4">
        {/* Total Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Total Ponds</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue" style={{ width: 34, height: 34 }}>
                  <FaLayerGroup size={14} />
                </div>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.total_ponds}
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2">
                <div className="tri-progress-bar" style={{ width: '100%', background: 'linear-gradient(90deg, #0B2C5F, #1E3A8A)' }} />
              </div>
              <span className="text-muted extra-small d-block">Monitored Basins</span>
            </div>
          </div>
        </div>

        {/* Healthy Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Healthy</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  ✓ Stable
                </span>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#16A34A', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.healthy_ponds}
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2" style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)' }}>
                <div className="tri-progress-bar" style={{ width: summary.total_ponds > 0 ? `${(summary.healthy_ponds / summary.total_ponds) * 100}%` : '0%', background: 'linear-gradient(90deg, #16A34A, #22C55E)' }} />
              </div>
              <span className="text-muted extra-small d-block">Optimal Water</span>
            </div>
          </div>
        </div>

        {/* Warning Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Warning</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                  ⚠ Notice
                </span>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#D97706', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.warning_ponds}
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2" style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)' }}>
                <div className="tri-progress-bar" style={{ width: summary.total_ponds > 0 ? `${(summary.warning_ponds / summary.total_ponds) * 100}%` : '0%', background: 'linear-gradient(90deg, #D97706, #F59E0B)' }} />
              </div>
              <span className="text-muted extra-small d-block">Sub-optimal Water</span>
            </div>
          </div>
        </div>

        {/* Critical Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card" style={{ borderColor: summary.critical_ponds > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(11, 44, 95, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Critical</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5 fw-bold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  🔴 Alert
                </span>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#DC2626', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.critical_ponds}
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)' }}>
                <div className="tri-progress-bar" style={{ width: summary.total_ponds > 0 ? `${Math.max(10, (summary.critical_ponds / summary.total_ponds) * 100)}%` : '0%', background: 'linear-gradient(90deg, #DC2626, #EF4444)' }} />
              </div>
              <span className="text-muted extra-small d-block">Action Required</span>
            </div>
          </div>
        </div>

        {/* Avg Feed Today */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feed Today</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue" style={{ width: 34, height: 34 }}>
                  <FaUtensils size={14} />
                </div>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.average_feed_today} <small className="fs-6 text-muted fw-normal">kg</small>
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2">
                <div className="tri-progress-bar" style={{ width: '85%', background: 'linear-gradient(90deg, #0B2C5F, #1E3A8A)' }} />
              </div>
              <span className="text-muted extra-small d-block">Daily Consumption</span>
            </div>
          </div>
        </div>

        {/* Avg Pond Age */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Avg Pond DOC</span>
                <div className="tri-kpi-icon tri-kpi-icon-orange" style={{ width: 34, height: 34 }}>
                  <FaCalendarAlt size={14} />
                </div>
              </div>
              <h3 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                {summary.average_pond_age} <small className="fs-6 text-muted fw-normal">Days</small>
              </h3>
            </div>
            <div>
              <div className="tri-progress-track my-2" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div className="tri-progress-bar" style={{ width: '70%', background: 'linear-gradient(90deg, #EA580C, #F97316)' }} />
              </div>
              <span className="text-muted extra-small d-block">Culture Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. UNIFIED SEARCH, STAGE & PARAMETER FILTER TOOLBAR */}
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search pond name, caretaker, or basin notes..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
        onExportCSV={handleExportCSV}
        onRefresh={loadPondData}
        loading={loading}
        tabs={[
          { id: 'All', label: 'All Basins', count: ponds.length },
          { id: 'Nursery', label: 'Nursery (Days 1–19)', count: nurseryCount },
          { id: 'Growout', label: 'Grow-out (Day 20+)', count: growoutCount }
        ]}
        activeTab={stageFilter}
        onTabChange={setStageFilter}
        metaRight={
          <span className="text-muted extra-small">
            Target Feed: <strong>Days 1–19 Nursery (Starter)</strong> ➔ <strong>Day 20+ Grow-out (Grower)</strong>
          </span>
        }
        onResetFilters={clearFilters}
      >
        <div className="row g-3">
          {/* Date Filter */}
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted d-flex align-items-center justify-content-between">
              <span><FaCalendarAlt className="me-1 text-primary" /> Evaluation Date</span>
              {filterDate !== todayStr && (
                <button
                  type="button"
                  className="btn btn-link p-0 extra-small text-primary text-decoration-none"
                  onClick={() => setFilterDate(todayStr)}
                >
                  Reset Today
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
            <label className="form-label small fw-bold text-muted">Pond Status</label>
            <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Unmonitored">Unmonitored</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted">Disease Detection</label>
            <select className="form-select" value={diseaseFilter} onChange={(event) => setDiseaseFilter(event.target.value)}>
              <option value="All">All detections</option>
              <option value="Clear">Clear only</option>
              <option value="Alert">Alerts only</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-bold text-muted">Assigned Caretaker</label>
            <select className="form-select" value={caretakerFilter} onChange={(event) => setCaretakerFilter(event.target.value)}>
              <option value="All">All caretakers</option>
              {uniqueCaretakers.map((caretaker) => <option key={caretaker} value={caretaker}>{caretaker}</option>)}
            </select>
          </div>
        </div>
      </AdminFilterToolbar>

      {/* 🌊 POND MONITORING TABLE CARD (FULL WIDTH COL-12 WITH STICKY HEADER & CLEAN EXECUTIVE DESIGN) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="tri-card p-4 position-relative overflow-hidden">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3 pb-3 border-bottom">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: '42px',
                    height: '42px',
                    background: 'linear-gradient(135deg, rgba(11, 44, 95, 0.08) 0%, rgba(30, 58, 138, 0.14) 100%)',
                    color: '#0B2C5F',
                    border: '1px solid rgba(11, 44, 95, 0.12)'
                  }}
                >
                  <FaWater size={18} />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h5 className="fw-extrabold text-dark mb-0" style={{ letterSpacing: '-0.01em' }}>
                      Pond Monitoring
                    </h5>
                    <span className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-0.5 extra-small fw-bold">
                      {filteredPonds.length} of {ponds.length} Basins
                    </span>
                  </div>
                  <p className="extra-small text-muted mb-0 mt-0.5">
                    Real-time water quality indices, culture stage tracking, and caretaker basin assignments
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-tri-orange px-3 py-2 shadow-xs"
                onClick={openAddPondModal}
              >
                <FaPlus size={11} className="me-1.5" /> Add New Pond
              </button>
            </div>

            {loading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 mb-0">Loading pond records...</p>
              </div>
            ) : filteredPonds.length === 0 ? (
              <div className="text-center py-5 bg-light rounded-4 border">
                <FaWater className="fs-2 text-muted mb-2" />
                <h6 className="fw-bold">No ponds found</h6>
                <p className="small text-muted mb-0">No database records match the current filters.</p>
              </div>
            ) : (
              <div className="table-responsive border rounded-3 shadow-xs" style={{ maxHeight: 560, overflowY: 'auto' }}>
                <table className="table tri-table align-middle mb-0">
                  <thead className="table-light sticky-top shadow-xs" style={{ top: 0, zIndex: 5 }}>
                    <tr>
                      <th className="ps-3.5 py-3 text-secondary extra-small fw-bold" style={{ minWidth: '150px' }}>Pond Basin</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '160px' }}>Culture & Feed</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '105px' }}>Status</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '135px' }}>Caretaker</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '175px' }}>Water Quality Indices</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '125px' }}>Feeding</th>
                      <th className="py-3 text-secondary extra-small fw-bold" style={{ minWidth: '110px' }}>Biosecurity</th>
                      <th className="pe-3.5 py-3 text-secondary extra-small fw-bold text-end" style={{ minWidth: '190px' }}>Quick Actions</th>
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
                                  width: '36px',
                                  height: '36px',
                                  background: 'rgba(11, 44, 95, 0.06)',
                                  color: '#0B2C5F',
                                  border: '1px solid rgba(11, 44, 95, 0.1)'
                                }}
                              >
                                <FaWater size={15} />
                              </div>
                              <div>
                                <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '140px', fontSize: '0.88rem' }}>
                                  {pond.pond_name}
                                </div>
                                <div className="d-flex align-items-center gap-1 extra-small text-muted mt-0.5">
                                  <span className="badge bg-light text-secondary border px-1.5 py-0 extra-small fw-semibold">
                                    Basin #{pond.id}
                                  </span>
                                </div>
                              </div>
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
                                    Day {pond.docOnFilterDate} • Nursery
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium">
                                    Feed: <strong className="text-secondary">Tateh - Starter</strong>
                                  </div>
                                </div>
                              ) : pond.docOnFilterDate === 20 ? (
                                <div>
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontSize: '0.74rem' }}
                                  >
                                    ⚡ Day 20 • Transfer
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium">
                                    Feed: <strong className="text-secondary">Tateh - Grower</strong>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                    style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.74rem' }}
                                  >
                                    <span className="rounded-circle bg-primary" style={{ width: 5, height: 5 }} />
                                    Day {pond.docOnFilterDate} • Grow-out
                                  </span>
                                  <div className="extra-small text-muted mt-1 fw-medium">
                                    Feed: <strong className="text-secondary">Tateh - Grower</strong>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div>
                                <span className="badge bg-light text-muted border px-2.5 py-1 extra-small fw-medium rounded-pill">
                                  Pre-Stocking
                                </span>
                                <div className="extra-small text-muted mt-1">Pending Stock</div>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3">
                            <span
                              className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1.5"
                              style={{
                                fontSize: '0.75rem',
                                backgroundColor:
                                  tone === 'success' ? '#ECFDF5' :
                                  tone === 'warning' ? '#FFFBEB' :
                                  tone === 'danger' ? '#FEF2F2' : '#F1F5F9',
                                color:
                                  tone === 'success' ? '#047857' :
                                  tone === 'warning' ? '#B45309' :
                                  tone === 'danger' ? '#B91C1C' : '#475569',
                                border: `1px solid ${
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
                                    tone === 'success' ? '#10B981' :
                                    tone === 'warning' ? '#F59E0B' :
                                    tone === 'danger' ? '#EF4444' : '#64748B'
                                }}
                              />
                              {pond.status || 'Unmonitored'}
                            </span>
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
                                    ? 'linear-gradient(135deg, #0B2C5F 0%, #1E4E8C 100%)'
                                    : '#94A3B8'
                                }}
                              >
                                {pond.assigned_caretaker_name ? pond.assigned_caretaker_name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <span
                                className="fw-medium text-dark text-truncate"
                                style={{ maxWidth: '120px', fontSize: '0.84rem' }}
                                title={pond.assigned_caretaker_name || 'Unassigned'}
                              >
                                {pond.assigned_caretaker_name || <span className="text-muted fst-italic">Unassigned</span>}
                              </span>
                            </div>
                          </td>

                          {/* Water Quality Indices (Clean 2x2 Grid) */}
                          <td className="py-3">
                            <div
                              className="d-grid gap-1"
                              style={{
                                gridTemplateColumns: 'repeat(2, minmax(75px, 1fr))',
                                width: '165px'
                              }}
                            >
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Water Temperature"
                              >
                                <span className="text-muted fw-semibold">Temp</span>
                                <span className="fw-bold text-dark">{valueOrDash(pond.temperature, '°C')}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Water pH Level"
                              >
                                <span className="text-muted fw-semibold">pH</span>
                                <span className="fw-bold text-dark">{valueOrDash(pond.ph_level)}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Dissolved Oxygen (DO)"
                              >
                                <span className="text-muted fw-semibold">DO</span>
                                <span className="fw-bold text-dark">{valueOrDash(pond.dissolved_oxygen, 'mg')}</span>
                              </div>
                              <div
                                className="px-2 py-0.5 rounded bg-light border border-light-subtle d-flex align-items-center justify-content-between"
                                style={{ fontSize: '0.72rem' }}
                                title="Salinity Level"
                              >
                                <span className="text-muted fw-semibold">Sal</span>
                                <span className="fw-bold text-dark">{valueOrDash(pond.salinity, 'ppt')}</span>
                              </div>
                            </div>
                          </td>

                          {/* Feed Consumption */}
                          <td className="py-3">
                            <div style={{ minWidth: '115px' }}>
                              <div className="d-flex align-items-baseline gap-1">
                                <span className="fw-extrabold text-dark" style={{ fontSize: '0.92rem' }}>
                                  {formatNumber(pond.feed_today_kg)}
                                </span>
                                <span className="extra-small text-muted fw-semibold">kg today</span>
                              </div>
                              <div className="extra-small text-muted mt-0.5">
                                Total: <strong className="text-secondary">{formatNumber(pond.total_feed_kg)} kg</strong>
                              </div>
                            </div>
                          </td>

                          {/* Biosecurity */}
                          <td className="py-3">
                            {isDiseaseAlert(pond.disease_detection) ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 extra-small"
                                style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                                title={`Disease Alert: ${pond.disease_detection}`}
                              >
                                <FaExclamationTriangle size={10} />
                                <span className="text-truncate" style={{ maxWidth: '80px' }}>
                                  {pond.disease_detection}
                                </span>
                              </span>
                            ) : (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 extra-small"
                                style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}
                              >
                                <FaCheckCircle size={10} /> Clear
                              </span>
                            )}
                          </td>

                          {/* Quick Actions (Streamlined, Non-Wrapping) */}
                          <td className="pe-3.5 py-3 text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1.5 flex-nowrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-navy rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                                onClick={() => setSelectedPond(pond)}
                                title="View Detailed Pond Analytics"
                              >
                                <FaEye size={11} /> Details
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

      
{/* 📊 HEALTH DISTRIBUTION CARD (PLACED DIRECTLY BELOW POND MONITORING TABLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="tri-card p-4 position-relative overflow-hidden">
            
            
              <div className="row align-items-center gy-4">
                <div className="col-lg-5 text-center text-lg-start">
                  <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2 justify-content-center justify-content-lg-start">
                    <FaChartPie className="text-info" /> Health Distribution
                  </h5>
                  <p className="small text-muted mb-4">Computed overall health status breakdown across all monitored ponds.</p>
                  <div className="d-flex flex-column gap-2.5">
                    <div className="p-3 rounded-4 bg-success bg-opacity-10 border border-success border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-success d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-success"></span> Healthy Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-success d-block">{summary.pie_chart?.healthy_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.healthy_ponds || 0} Ponds</small>
                      </div>
                    </div>

                    <div className="p-3 rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-warning-emphasis d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-warning"></span> Warning Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-warning-emphasis d-block">{summary.pie_chart?.warning_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.warning_ponds || 0} Ponds</small>
                      </div>
                    </div>

                    <div className="p-3 rounded-4 bg-danger bg-opacity-10 border border-danger border-opacity-25 d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-danger d-flex align-items-center gap-2">
                        <span className="p-1.5 rounded-circle bg-danger"></span> Critical Ponds
                      </span>
                      <div className="text-end">
                        <strong className="fs-5 text-danger d-block">{summary.pie_chart?.critical_pct || 0}%</strong>
                        <small className="text-muted extra-small">{summary.critical_ponds || 0} Ponds</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-7 d-flex justify-content-center align-items-center">
                  <div
                    className="p-4 rounded-4 border border-info border-opacity-25 bg-light bg-opacity-50 shadow-xs w-100 d-flex flex-column align-items-center justify-content-center position-relative"
                    style={{
                      background: 'linear-gradient(135deg, rgba(13, 202, 240, 0.04) 0%, rgba(255, 255, 255, 0.95) 100%)',
                      maxWidth: 420,
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between w-100 mb-3 border-bottom pb-2">
                      <span className="extra-small fw-bold text-uppercase text-secondary tracking-wider d-flex align-items-center gap-1.5">
                        <FaChartPie className="text-info" /> Visual Distribution Breakdown
                      </span>
                      <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 rounded-pill extra-small fw-bold">
                        {summary.total_ponds || 0} Total Ponds
                      </span>
                    </div>

                    <div style={{ height: 250, width: '100%', maxWidth: 350 }}>
                      <Doughnut data={pieData} options={pieOptions} />
                    </div>
                  </div>
                </div>
              </div>
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
                    Pond #{selectedPond.id} | Caretaker: {selectedPond.assigned_caretaker_name || 'Unassigned'}
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedPond(null)} />
              </div>
              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3"><MetricCard title="Status" value={selectedPond.status || '-'} detail="Database/API status" icon={<FaWater />} tone={statusClass[selectedPond.status] || 'secondary'} /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Area" value={valueOrDash(selectedPond.area_sqm, ' sqm')} detail="Pond size" icon={<FaRulerVertical />} tone="info" /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Stocking Date" value={valueOrDash(selectedPond.stocking_date)} detail={`${valueOrDash(selectedPond.current_age_days, ' DOC')}`} icon={<FaCalendarAlt />} tone="secondary" /></div>
                  <div className="col-12 col-md-3"><MetricCard title="Harvest Readiness" value={valueOrDash(formatNumber(selectedPond.harvest_readiness), '%')} detail={selectedPond.harvest_readiness_status || '-'} icon={<FaWeightHanging />} tone="warning" /></div>
                </div>

                {/* Culture Stage & Recommended Feed formulation Banner */}
                {(() => {
                  const selDoc = computeDoc(selectedPond.stocking_date, filterDate);
                  const isNursery = selDoc !== null && selDoc >= 1 && selDoc <= 19;
                  const isGrowout = selDoc !== null && selDoc >= 20;
                  const feedType = isNursery ? 'Tateh - Starter' : isGrowout ? 'Tateh - Grower' : '-';

                  return (
                    <div className="p-3.5 rounded-4 border mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ background: '#F8FAFC' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0 shadow-xs"
                          style={{
                            width: 44,
                            height: 44,
                            background: isNursery ? '#059669' : '#0284C7',
                          }}
                        >
                          {isNursery ? <FaSeedling size={20} /> : <FaWater size={20} />}
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h6 className="fw-extrabold mb-0 text-dark">
                              {selDoc !== null
                                ? isNursery
                                  ? `🌱 Nursery Pond Stage (Day ${selDoc} of Culture)`
                                  : selDoc === 20
                                    ? `⚡ Transfer Milestone Day (Day 20 of Culture)`
                                    : `🌊 Grow-out Pond Stage (Day ${selDoc} of Culture)`
                                : 'Unstocked / Pre-Stocking Phase'}
                            </h6>
                            <span className="badge bg-secondary bg-opacity-10 text-secondary extra-small">
                              Evaluated on {filterDate}
                            </span>
                          </div>
                          <p className="text-muted extra-small mb-0 mt-1">
                            Required Feed Formulation: <strong className="text-dark">{feedType}</strong> • Protocol: Days 1–19 Nursery ➔ Day 20+ Grow-out
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
                        <FaCalendarAlt size={12} /> View Pond Cycle Calendar
                      </button>
                    </div>
                  );
                })()}

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <div className={`p-4 rounded-4 border h-100 ${isDiseaseAlert(selectedPond.disease_detection) ? 'bg-danger bg-opacity-10 border-danger border-opacity-25' : 'bg-success bg-opacity-10 border-success border-opacity-25'}`}>
                      <h6 className={`fw-bold ${isDiseaseAlert(selectedPond.disease_detection) ? 'text-danger' : 'text-success'} d-flex align-items-center gap-2`}>
                        <FaBug /> Disease Detection
                      </h6>
                      <h5 className="fw-bold text-dark">{isDiseaseAlert(selectedPond.disease_detection) ? selectedPond.disease_detection : 'Clear'}</h5>
                      <p className="small text-muted mb-0">Confidence: {formatNumber(selectedPond.disease_confidence)}%</p>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="p-4 rounded-4 border bg-light h-100">
                      <h6 className="fw-bold text-dark d-flex align-items-center gap-2"><FaUtensils /> Feeding</h6>
                      <div className="d-flex justify-content-between"><span>Today</span><strong>{formatNumber(selectedPond.feed_today_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>Total</span><strong>{formatNumber(selectedPond.total_feed_kg)} kg</strong></div>
                      <div className="d-flex justify-content-between"><span>Latest Feed Date</span><strong>{valueOrDash(selectedPond.latest_feed_date)}</strong></div>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <h6 className="fw-bold text-muted text-uppercase mb-0">Water Quality Parameters</h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1.5 shadow-xs"
                    onClick={() => {
                      setHistoryModalPond(selectedPond);
                      setIsHistoryModalOpen(true);
                    }}
                  >
                    <FaHistory size={11} /> View Water Quality History &amp; Backfill
                  </button>
                </div>
                <div className="row g-3 text-center">
                  <WaterMetric icon={<FaThermometerHalf size={20} />} label="Temperature" value={valueOrDash(selectedPond.temperature, ' C')} tone="danger" />
                  <WaterMetric icon={<FaVial size={20} />} label="pH" value={valueOrDash(selectedPond.ph_level)} />
                  <WaterMetric icon={<FaFlask size={20} />} label="Salinity" value={valueOrDash(selectedPond.salinity, ' ppt')} tone="info" />
                  <WaterMetric icon={<FaWind size={20} />} label="Dissolved Oxygen" value={valueOrDash(selectedPond.dissolved_oxygen, ' mg/L')} tone="success" />
                  <WaterMetric icon={<FaRulerVertical size={20} />} label="Water Level" value={valueOrDash(selectedPond.water_level, ' m')} tone="secondary" />
                </div>
              </div>
              <div className="modal-footer bg-light border-0">
                <button className="btn btn-secondary px-4" onClick={() => setSelectedPond(null)}>Close</button>
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
                <h5 className="modal-title fw-bold text-white">{editingPond ? 'Edit Pond' : 'Add Pond'}</h5>
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
                <label className="form-label fw-bold">Pond Name</label>
                <input
                  className="form-control"
                  value={newPondName}
                  onChange={(event) => setNewPondName(event.target.value)}
                  placeholder="e.g. Pond D1"
                  autoFocus
                  disabled={savingPond}
                />
                <label className="form-label fw-bold mt-3">Assigned Caretaker</label>
                <select
                  className="form-select"
                  value={selectedCaretakerId}
                  onChange={(event) => setSelectedCaretakerId(event.target.value)}
                  disabled={savingPond}
                >
                  <option value="">Unassigned</option>
                  {caretakers.map((caretaker) => (
                    <option key={caretaker.id} value={caretaker.id}>{caretaker.full_name}</option>
                  ))}
                </select>
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <small className="text-muted d-block">
                    <FaWater className="me-1 text-primary" />
                    Status will initialize as <span className="badge bg-secondary">Unmonitored</span>. It will automatically update to Healthy, Warning, or Critical once actual water quality readings are recorded.
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
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4" disabled={savingPond}>
                  {savingPond ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📅 POND CYCLE CALENDAR MODAL (DAYS 1-19 NURSERY & DAY 20+ GROW-OUT) */}
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
                style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 50%, #0284C7 100%)' }}
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
                      Pond Culture Timeline & Cycle Calendar
                    </h5>
                    <span className="text-white text-opacity-80 extra-small">
                      {calendarModalPond.pond_name} • Assigned: {calendarModalPond.assigned_caretaker_name || 'Unassigned'}
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
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 WATER QUALITY LOG HISTORY & BACKFILL MODAL */}
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

      {/* 🌟 DUAL-MODE OCR WATER QUALITY MODAL */}
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
