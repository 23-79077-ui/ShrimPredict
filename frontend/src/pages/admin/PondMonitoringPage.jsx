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
  FaHistory
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
  const cardGlowClass =
    tone === 'success' ? 'stat-card-green' :
      tone === 'danger' ? 'stat-card-red' :
        tone === 'warning' ? 'stat-card-orange' :
          tone === 'info' ? 'stat-card-purple' :
            'stat-card-cyan';

  return (
    <div className={`card ${cardGlowClass} shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden`}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <span className="text-muted small fw-semibold pt-0.5">{title}</span>
        <div className={`rounded-3 p-2 bg-${tone} bg-opacity-10 text-${tone} fs-6`}>{icon}</div>
      </div>
      <h3 className="fw-extrabold mb-2">{value}</h3>
      <span className="text-muted extra-small d-block pb-0.5">{detail}</span>
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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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
        ? 'Nursery (Starter Feed)'
        : isGrowout
          ? 'Grow-out (Grower Feed)'
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
      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search pond or caretaker"
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((show) => !show)}
        onExportCSV={handleExportCSV}
        onRefresh={loadPondData}
        loading={loading}
        tabs={[
          { id: 'All', label: 'All Ponds', count: ponds.length },
          { id: 'Nursery', label: 'Nursery Ponds (Days 1–19 • Starter Feed)', count: nurseryCount },
          { id: 'Growout', label: '🌊 Grow-out Ponds (Day 20+ • Grower Feed)', count: growoutCount }
        ]}
        activeTab={stageFilter}
        onTabChange={setStageFilter}
        metaRight={
          <>
            Target Feed: <strong>Days 1–19 Nursery (Starter)</strong> ➔ <strong>Day 20+ Grow-out (Grower)</strong>
          </>
        }
        filterFields={[
          {
            label: 'Evaluation Date',
            icon: <FaCalendarAlt className="me-1 text-primary" />,
            type: 'date',
            value: filterDate,
            onChange: setFilterDate,
            colClass: 'col-12 col-md-3',
            headerAction: filterDate !== todayStr ? (
              <button
                type="button"
                className="btn btn-link p-0 extra-small text-primary text-decoration-none"
                onClick={() => setFilterDate(todayStr)}
              >
                Reset Today
              </button>
            ) : null
          },
          {
            label: 'Pond Status',
            type: 'select',
            value: statusFilter,
            onChange: setStatusFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'All', label: 'All statuses' },
              { value: 'Healthy', label: 'Healthy' },
              { value: 'Warning', label: 'Warning' },
              { value: 'Critical', label: 'Critical' },
              { value: 'Unmonitored', label: 'Unmonitored' }
            ]
          },
          {
            label: 'Disease Detection',
            type: 'select',
            value: diseaseFilter,
            onChange: setDiseaseFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'All', label: 'All detections' },
              { value: 'Clear', label: 'Clear only' },
              { value: 'Alert', label: 'Alerts only' }
            ]
          },
          {
            label: 'Assigned Caretaker',
            type: 'select',
            value: caretakerFilter,
            onChange: setCaretakerFilter,
            colClass: 'col-12 col-md-3',
            options: [
              { value: 'All', label: 'All caretakers' },
              ...uniqueCaretakers.map((c) => ({ value: c, label: c }))
            ]
          }
        ]}
        onResetFilters={clearFilters}
      />

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4">
          <FaTimesCircle /> {error}
        </div>
      )}

      {/* 6 TOP METRIC CARDS WITH FULL GLOWING BACKGROUND & BORDER SYSTEM (MATCHING PICTURE 2) */}
      <div className="row g-3 mb-4">
        {/* Total Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-cyan shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Total Ponds</span>
              <div className="rounded-3 p-2 bg-primary bg-opacity-10 text-primary fs-6">
                <FaLayerGroup />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{summary.total_ponds}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Monitored Ponds</span>
          </div>
        </div>

        {/* Healthy Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-green shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Healthy Ponds</span>
              <span className="badge bg-success bg-opacity-20 text-success rounded-pill px-2.5 py-1 fw-bold">🟢 Safe</span>
            </div>
            <h3 className="fw-extrabold text-success mb-2">{summary.healthy_ponds}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Optimal Water</span>
          </div>
        </div>

        {/* Warning Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-orange shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Warning</span>
              <span className="badge bg-warning bg-opacity-20 text-warning rounded-pill px-2.5 py-1 fw-bold">🟡 Watch</span>
            </div>
            <h3 className="fw-extrabold text-warning mb-2">{summary.warning_ponds}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Sub-optimal Water</span>
          </div>
        </div>

        {/* Critical Ponds */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-red shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Critical</span>
              <span className="badge bg-danger bg-opacity-20 text-danger rounded-pill px-2.5 py-1 fw-bold">🔴 Alert</span>
            </div>
            <h3 className="fw-extrabold text-danger mb-2">{summary.critical_ponds}</h3>
            <span className="text-muted extra-small d-block pb-0.5">Action Required</span>
          </div>
        </div>

        {/* Avg Feed Today */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-purple shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Avg Feed Today</span>
              <div className="rounded-3 p-2 bg-info bg-opacity-10 text-info fs-6">
                <FaUtensils />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{summary.average_feed_today} <small className="fs-6 text-muted fw-normal">kg</small></h3>
            <span className="text-muted extra-small d-block pb-0.5">Daily Consumption</span>
          </div>
        </div>

        {/* Avg Pond Age */}
        <div className="col-12 col-sm-6 col-md-4 col-xl-2">
          <div className="card stat-card-cyan shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold pt-0.5">Avg Pond Age</span>
              <div className="rounded-3 p-2 bg-primary bg-opacity-10 text-primary fs-6">
                <FaCalendarAlt />
              </div>
            </div>
            <h3 className="fw-extrabold mb-2">{summary.average_pond_age} <small className="fs-6 text-muted fw-normal">Days</small></h3>
            <span className="text-muted extra-small d-block pb-0.5">Culture Days (DOC)</span>
          </div>
        </div>
      </div>

      {/* 🌊 POND MONITORING TABLE CARD (FULL WIDTH COL-12 WITH STICKY HEADER & MAX 10 ROWS VISIBLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border border-primary border-opacity-20 shadow-sm rounded-4 bg-white position-relative overflow-hidden">
            <div className="position-absolute top-0 start-0 end-0 bg-primary" style={{ height: 4 }} />
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <FaWater className="text-primary" /> Pond Monitoring
                  </h5>
                  <p className="small text-muted mb-0">Showing {filteredPonds.length} of {ponds.length} database records.</p>
                </div>
                <button
                  className="btn btn-primary d-flex align-items-center gap-2"
                  onClick={openAddPondModal}
                >
                  <FaPlus /> Add Pond
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
                /* 📜 Scrollable container displaying ~10 rows before vertical scroll bar appears */
                <div className="table-responsive border rounded-3 shadow-xs" style={{ maxHeight: 540, overflowY: 'auto' }}>
                  <table className="table align-middle mb-0">
                    <thead className="table-light sticky-top shadow-xs" style={{ top: 0, zIndex: 5 }}>
                      <tr>
                        <th className="ps-3 py-3 text-secondary text-uppercase extra-small fw-bold">Pond</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Culture Stage & Feed</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Status</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Caretaker</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Water Quality</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Feed Consumption</th>
                        <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Disease Alert</th>
                        <th className="pe-3 py-3 text-secondary text-uppercase extra-small fw-bold text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPonds.map((pond) => {
                        const tone = statusClass[pond.status] || 'secondary';
                        return (
                          <tr key={pond.id}>
                            <td className="ps-3">
                              <div className="fw-bold text-dark">{pond.pond_name}</div>
                              <small className="text-muted">Pond #{pond.id}</small>
                            </td>
                            <td>
                              {pond.docOnFilterDate !== null ? (
                                pond.isNursery ? (
                                  <div>
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                      style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.78rem' }}
                                    >
                                      Day {pond.docOnFilterDate} • Nursery
                                    </span>
                                    <small className="d-block text-muted extra-small mt-0.5">Feed: <strong>Tateh - Starter</strong></small>
                                  </div>
                                ) : pond.docOnFilterDate === 20 ? (
                                  <div>
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                      style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontSize: '0.78rem' }}
                                    >
                                      ⚡ Day 20 • Transfer Day
                                    </span>
                                    <small className="d-block text-muted extra-small mt-0.5">Feed: <strong>Tateh - Grower</strong></small>
                                  </div>
                                ) : (
                                  <div>
                                    <span
                                      className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                      style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.78rem' }}
                                    >
                                      Day {pond.docOnFilterDate} • Grow-out
                                    </span>
                                    <small className="d-block text-muted extra-small mt-0.5">Feed: <strong>Tateh - Grower</strong></small>
                                  </div>
                                )
                              ) : (
                                <span className="badge bg-light text-muted border px-2 py-1 extra-small">
                                  Pre-Stocking
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge bg-${tone} ${tone === 'warning' ? 'text-dark' : ''} px-2.5 py-1.5 fw-bold`}>
                                {pond.status || '-'}
                              </span>
                            </td>
                            <td className="fw-medium text-dark">{pond.assigned_caretaker_name || 'Unassigned'}</td>
                            <td>
                              <small className="d-block text-secondary">Temp: <strong className="text-dark">{valueOrDash(pond.temperature, ' °C')}</strong></small>
                              <small className="d-block text-secondary">pH: <strong className="text-dark">{valueOrDash(pond.ph_level)}</strong></small>
                              <small className="d-block text-secondary">DO: <strong className="text-dark">{valueOrDash(pond.dissolved_oxygen, ' mg/L')}</strong></small>
                              <small className="d-block text-secondary">Sal: <strong className="text-dark">{valueOrDash(pond.salinity, ' ppt')}</strong></small>
                            </td>
                            <td>
                              <small className="d-block text-secondary">Today: <strong className="text-dark">{formatNumber(pond.feed_today_kg)} kg</strong></small>
                              <small className="d-block text-secondary">Total: <strong className="text-dark">{formatNumber(pond.total_feed_kg)} kg</strong></small>
                            </td>
                            <td>
                              {isDiseaseAlert(pond.disease_detection) ? (
                                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1.5 fw-bold">
                                  {pond.disease_detection}
                                </span>
                              ) : (
                                <span className="badge bg-success bg-opacity-10 text-success px-2.5 py-1.5 fw-bold">Clear</span>
                              )}
                            </td>
                            <td className="pe-3 text-end">
                              <div className="d-flex justify-content-end gap-1.5 flex-wrap">
                                <button
                                  className="btn btn-sm btn-outline-info rounded-pill px-2.5 py-1 fw-bold shadow-xs d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => setCalendarModalPond(pond)}
                                  title="View Pond Culture Cycle Calendar"
                                >
                                  <FaCalendarAlt size={11} /> Cycle
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary rounded-pill px-2.5 py-1 fw-bold shadow-xs d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => {
                                    setHistoryModalPond(pond);
                                    setIsHistoryModalOpen(true);
                                  }}
                                  title="View Water Quality Log History and past date records"
                                >
                                  <FaHistory size={11} className="text-info" /> Logs
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold shadow-xs"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => setSelectedPond(pond)}
                                >
                                  Details
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1 fw-bold shadow-xs"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => openEditPondModal(pond)}
                                >
                                  <FaEdit className="me-1" /> Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 fw-bold shadow-xs"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => handleDeletePond(pond)}
                                >
                                  <FaTrash className="me-1" /> Delete
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
      </div>

      {/* 📊 HEALTH DISTRIBUTION CARD (PLACED DIRECTLY BELOW POND MONITORING TABLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border border-info border-opacity-25 shadow-sm rounded-4 bg-white position-relative overflow-hidden">
            <div className="position-absolute top-0 start-0 end-0 bg-info" style={{ height: 4 }} />
            <div className="card-body p-4">
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
                            Required Feed Formulation: <strong className="text-dark">{feedType}</strong> • Protocol: Starter (Days 1–19 Nursery) ➔ Grower (Day 20+ Grow-out)
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

      {/* 📅 POND CYCLE CALENDAR MODAL (DAYS 1-19 NURSERY / STARTER & DAY 20+ GROW-OUT / GROWER) */}
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
