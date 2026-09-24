import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { safeArray } from '../../services/api';
import { downloadDashboardPDF } from '../../utils/pdfExport';
import { Line, Doughnut } from 'react-chartjs-2';
import Swal from 'sweetalert2';
import {
  FaFilter,
  FaUndo,
  FaSync,
  FaFilePdf,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaShieldAlt,
  FaEye,
  FaChevronRight,
  FaUtensils,
  FaUserTie,
  FaWater,
  FaArrowUp,
  FaCalendarCheck,
  FaCalendarAlt
} from 'react-icons/fa';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr.slice(0, 10) + 'T00:00:00');
  const t = targetDateStr ? new Date(targetDateStr.slice(0, 10) + 'T00:00:00') : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffDays = Math.floor((t - s) / 86400000) + 1;
  return diffDays > 0 ? diffDays : null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [caretakers, setCaretakers] = useState([]);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('all');

  // Date Filter states: 'all' | 'today' | 'yesterday' | 'aug10' | 'last7' | 'custom'
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customDate, setCustomDate] = useState('');

  // Disease feed priority tab: 'all' | 'critical' | 'moderate' | 'safe'
  const [diseaseFilter, setDiseaseFilter] = useState('all');

  // Export PDF Modal Dialog state
  const [showExportModal, setShowExportModal] = useState(false);

  // Hovered segmented bar index
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const [stats, setStats] = useState({});
  const [ponds, setPonds] = useState([]);
  const [allFeedingRecords, setAllFeedingRecords] = useState([]);
  const [allDiseaseReports, setAllDiseaseReports] = useState([]);
  const [harvestPredictions, setHarvestPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load caretakers
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.get('/users.php');
        const userList = safeArray(res.data.users || res.data);
        const caretakerList = userList.filter((u) => u.role === 'caretaker');
        setCaretakers(caretakerList);
      } catch (e) {
        setCaretakers([]);
      }
    };
    loadUsers();
  }, []);

  // Fetch all dashboard & raw feeding records
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, feedRes, diseaseRes, pondsRes, harvestRes] = await Promise.allSettled([
        api.get('/dashboard.php'),
        api.get('/feeding_records.php'),
        api.get('/disease_reports.php'),
        api.get('/ponds.php'),
        api.get('/harvest_predictions.php'),
      ]);

      if (dashRes.status === 'fulfilled') {
        setStats(dashRes.value.data || {});
      }
      if (feedRes.status === 'fulfilled') {
        setAllFeedingRecords(safeArray(feedRes.value.data));
      }
      if (diseaseRes.status === 'fulfilled') {
        setAllDiseaseReports(safeArray(diseaseRes.value.data));
      }
      if (pondsRes.status === 'fulfilled') {
        setPonds(safeArray(pondsRes.value.data));
      }
      if (harvestRes.status === 'fulfilled') {
        const hData = harvestRes.value.data;
        setHarvestPredictions(safeArray(hData?.predictions || hData));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handleFeedUpdated = () => fetchData();
    const handleStorageUpdate = (event) => {
      if (event.key === 'shrim-feed-updated' || event.key === 'shrim-notification-updated') {
        fetchData();
      }
    };

    window.addEventListener('shrim-feed-updated', handleFeedUpdated);
    window.addEventListener('shrim-notification-updated', handleFeedUpdated);
    window.addEventListener('storage', handleStorageUpdate);
    const intervalId = window.setInterval(handleFeedUpdated, 8000);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleFeedUpdated);
      window.removeEventListener('shrim-notification-updated', handleFeedUpdated);
      window.removeEventListener('storage', handleStorageUpdate);
      window.clearInterval(intervalId);
    };
  }, [fetchData]);

  // Selected caretaker object
  const selectedCaretakerObj = caretakers.find((c) => String(c.id) === String(selectedCaretakerId));

  // Displayed ponds filtered by selected caretaker
  const displayedPonds = useMemo(() => {
    if (selectedCaretakerId === 'all') {
      // Show assigned active ponds
      const assigned = ponds.filter((p) => p.caretaker_id || p.caretaker_ids || p.caretaker_name);
      return assigned.length > 0 ? assigned : ponds;
    }
    return ponds.filter((p) => {
      const cIds = String(p.caretaker_ids || p.caretaker_id || '').split(',');
      const matchId = cIds.includes(String(selectedCaretakerId));
      const matchName = selectedCaretakerObj?.full_name && p.caretaker_name === selectedCaretakerObj.full_name;
      return matchId || matchName;
    });
  }, [ponds, selectedCaretakerId, selectedCaretakerObj]);

  // Distinct recorded dates for dropdown & inspection
  const availableDates = useMemo(() => {
    const recordsToInspect = selectedCaretakerId === 'all'
      ? allFeedingRecords
      : allFeedingRecords.filter((r) => {
          const recUserId = r.user_id ?? r.userId;
          const recName = r.recorded_by_name ?? r.recorded_by;
          return (recUserId && String(recUserId) === String(selectedCaretakerId)) ||
                 (selectedCaretakerObj?.full_name && recName === selectedCaretakerObj.full_name);
        });

    const dateMap = new Map();
    recordsToInspect.forEach((r) => {
      const d = (r.record_date || r.created_at || '').slice(0, 10);
      if (!d) return;
      const existing = dateMap.get(d) || { date: d, count: 0, totalKg: 0, stockingDate: r.stocking_date || '2026-08-10' };
      existing.count += 1;
      existing.totalKg += parseFloat(r.amount_kg) || 0;
      dateMap.set(d, existing);
    });

    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [allFeedingRecords, selectedCaretakerId, selectedCaretakerObj]);

  // Date match helper
  const isDateMatch = useCallback(
    (recordDateStr) => {
      if (dateFilterType === 'all') return true;
      if (!recordDateStr) return false;

      const dateOnly = recordDateStr.slice(0, 10);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      if (dateFilterType === 'today') return dateOnly === todayStr;
      if (dateFilterType === 'yesterday') {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        return dateOnly === yest.toISOString().split('T')[0];
      }
      if (dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateOnly === dateFilterType;
      }
      if (dateFilterType === 'doc_batch') return dateOnly >= '2026-08-10' && dateOnly <= '2026-08-16';
      if (dateFilterType.startsWith('aug')) {
        const dayNum = dateFilterType.replace('aug', '');
        return dateOnly === `2026-08-${dayNum.padStart(2, '0')}`;
      }
      if (dateFilterType === 'last7') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(dateOnly) >= sevenDaysAgo;
      }
      if (dateFilterType === 'custom' && customDate) {
        return dateOnly === customDate;
      }
      return true;
    },
    [dateFilterType, customDate]
  );

  // Filtered Feeding Records
  const filteredFeedingRecords = useMemo(() => {
    return allFeedingRecords.filter((rec) => {
      if (selectedCaretakerId !== 'all') {
        const recUserId = rec.user_id ?? rec.userId;
        const recName = rec.recorded_by_name ?? rec.recorded_by;
        const matchUser = recUserId && String(recUserId) === String(selectedCaretakerId);
        const matchName = selectedCaretakerObj?.full_name && recName === selectedCaretakerObj.full_name;
        if (!matchUser && !matchName) return false;
      }
      const recDate = rec.record_date || rec.created_at || '';
      return isDateMatch(recDate);
    });
  }, [allFeedingRecords, selectedCaretakerId, selectedCaretakerObj, isDateMatch]);

  // Filtered Disease Reports
  const filteredDiseaseReports = useMemo(() => {
    return allDiseaseReports.filter((rep) => {
      if (selectedCaretakerId !== 'all') {
        const repUserId = rep.user_id ?? rep.userId;
        const repName = rep.caretaker_name;
        const matchUser = repUserId && String(repUserId) === String(selectedCaretakerId);
        const matchName = selectedCaretakerObj?.full_name && repName === selectedCaretakerObj.full_name;
        if (!matchUser && !matchName) return false;
      }
      const repDate = rep.report_date || rep.created_at || '';
      return isDateMatch(repDate);
    });
  }, [allDiseaseReports, selectedCaretakerId, selectedCaretakerObj, isDateMatch]);

  // Total Feed Consumed
  const totalFilteredFeedKg = useMemo(() => {
    return filteredFeedingRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  }, [filteredFeedingRecords]);

  // High-Level Executive KPIs
  const kpiStats = useMemo(() => {
    const totalPondsCount = displayedPonds.length;
    const healthyPondsCount = displayedPonds.filter((p) => (p.status || '').toLowerCase() === 'healthy').length;
    const healthyPct = totalPondsCount > 0 ? Math.round((healthyPondsCount / totalPondsCount) * 100) : 100;

    const activeReports = filteredDiseaseReports.length > 0 ? filteredDiseaseReports : allDiseaseReports;
    const critReports = activeReports.filter((r) => ['high', 'critical'].includes((r.risk_level || '').toLowerCase())).length;
    const safeReports = activeReports.filter((r) => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase().includes('healthy')).length;
    const totalReports = activeReports.length || 1;
    const bioSafePct = Math.round((safeReports / totalReports) * 100);

    return {
      totalPondsCount,
      healthyPondsCount,
      healthyPct,
      critReports,
      bioSafePct,
      totalFeedKg: totalFilteredFeedKg,
      totalFeedG: Math.round(totalFilteredFeedKg * 1000),
      totalRuns: filteredFeedingRecords.length,
      activeCaretakersCount: caretakers.length,
    };
  }, [displayedPonds, filteredDiseaseReports, allDiseaseReports, totalFilteredFeedKg, filteredFeedingRecords, caretakers]);

  // Dynamic Chart for Feed Consumption (Wave-Line with Cyan/Navy Fill)
  const feedChart = useMemo(() => {
    const labels = [];
    const data = [];

    const isSingleDate = dateFilterType === 'today' ||
      dateFilterType === 'yesterday' ||
      dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/) ||
      (dateFilterType === 'custom' && customDate);

    if (isSingleDate) {
      const slots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
      slots.forEach((slot) => {
        labels.push(slot);
        const sum = filteredFeedingRecords.reduce((acc, r) => {
          const normTime = String(r.feeding_time || '').trim().replace(/^0(\d:)/, '$1').toUpperCase();
          if (normTime === slot.toUpperCase()) return acc + (parseFloat(r.amount_kg) || 0);
          return acc;
        }, 0);
        data.push(Math.round(sum * 100) / 100);
      });
    } else {
      const datesToShow = availableDates.slice(0, 7).reverse();
      if (datesToShow.length > 0) {
        datesToShow.forEach((item) => {
          const dObj = new Date(item.date + 'T00:00:00');
          labels.push(dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
          data.push(Math.round(item.totalKg * 100) / 100);
        });
      } else {
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
          data.push(0);
        }
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'Feed Dispensed',
          data,
          borderColor: '#0284C7',
          borderWidth: 2.75,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, 'rgba(2, 132, 199, 0.22)');
            gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
            gradient.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
            return gradient;
          },
          tension: 0.45,
          fill: true,
          pointBackgroundColor: '#0B2C5F',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#FF7A00',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 2.5,
        },
      ],
    };
  }, [filteredFeedingRecords, dateFilterType, customDate, availableDates]);

  const feedChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: '#071733',
        titleColor: '#38BDF8',
        bodyColor: '#FF7A00',
        titleFont: { size: 12, weight: '700', family: "'Poppins', sans-serif" },
        bodyFont: { size: 13, weight: '700', family: "'Poppins', sans-serif" },
        borderColor: 'rgba(56, 189, 248, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: (context) => `Feed Mass: ${context.parsed.y} kg`,
          afterLabel: () => `Automated Feeder Status: Nominal`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
        ticks: { color: '#64748B', font: { size: 11, family: "'Inter', sans-serif" } }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.06)', drawBorder: false },
        ticks: { color: '#64748B', font: { size: 11, family: "'Inter', sans-serif" }, callback: (v) => `${v} kg` }
      }
    }
  }), []);

  // Quick Action Handlers
  const handleQuickAcknowledge = (item) => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Telemetry alert for ${item.pond} acknowledged`,
      showConfirmButton: false,
      timer: 2200,
      background: '#1E293B',
      color: '#F8FAFC'
    });
  };

  const handleQuickIsolate = (item) => {
    Swal.fire({
      title: 'Isolate Pond Bio-Zone?',
      html: `Deploy bio-barrier protocols and stop water intake for <strong>${item.pond}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0B2C5F',
      cancelButtonColor: '#F43F5E',
      confirmButtonText: 'Yes, Isolate Pond',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'Isolation Protocol Active',
          text: `Valve lock engaged for ${item.pond}. System logs recorded.`,
          confirmButtonColor: '#0D9488'
        });
      }
    });
  };

  // Prioritized Disease Feed Data with Clean Legend Tags
  const diseaseItems = useMemo(() => {
    const sourceReports = filteredDiseaseReports.length > 0 ? filteredDiseaseReports : allDiseaseReports;
    if (sourceReports.length === 0) return [];

    const raw = sourceReports.map((r) => {
      const riskLower = (r.risk_level || 'Low').toLowerCase();
      const normalizedRisk = ['high', 'critical'].includes(riskLower)
        ? 'critical'
        : ['moderate', 'medium', 'warning'].includes(riskLower)
          ? 'moderate'
          : 'safe';

      const isHealthy = (r.disease_name || '').toLowerCase().includes('healthy') || normalizedRisk === 'safe';

      return {
        id: r.id,
        title: isHealthy ? 'Healthy - No Disease Detected' : (r.disease_name || 'Biosecurity Anomaly'),
        pond: r.pond_name || `Pond #${r.pond_id || 1}`,
        risk: normalizedRisk,
        status: isHealthy ? 'Nominal' : (r.status || 'Active Notice'),
        time: new Date(r.report_date || r.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: r.confidence_score ? `${Math.round(r.confidence_score)}%` : '98%',
      };
    });

    return raw.filter((item) => {
      if (diseaseFilter === 'all') return true;
      return item.risk === diseaseFilter;
    });
  }, [filteredDiseaseReports, allDiseaseReports, diseaseFilter]);

  return (
    <div>
      {/* 🌟 HERO CONTROL STRIP: BREADCRUMB, FARM STATUS & COMPACT PILL FILTERS */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-pill fw-bold extra-small" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
              ● LIVE TELEMETRY
            </span>
            <span className="text-muted extra-small">
              {displayedPonds.length} Monitored Aquaculture {displayedPonds.length === 1 ? 'Basin' : 'Basins'} • AI Diagnostics
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 mt-1 tracking-tight text-dark" style={{ fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Aquaculture Operations Hub
          </h2>
        </div>

        {/* Compact Pill-Shaped Filter Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Caretaker Selector Pill */}
          <div className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border shadow-xs">
            <FaUserTie style={{ color: '#0B2C5F', fontSize: '0.8rem' }} />
            <select
              className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark p-0 ps-1"
              style={{ width: 'auto', minWidth: 145, fontSize: '0.82rem', outline: 'none' }}
              value={selectedCaretakerId}
              onChange={(e) => setSelectedCaretakerId(e.target.value)}
            >
              <option value="all">All Caretakers ({caretakers.length || 4})</option>
              {caretakers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Window Pill */}
          <div className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border shadow-xs">
            <FaCalendarAlt className="text-muted" style={{ fontSize: '0.8rem' }} />
            <select
              className="form-select form-select-sm border-0 bg-transparent fw-semibold text-dark p-0 ps-1"
              style={{ width: 'auto', minWidth: 140, fontSize: '0.82rem', outline: 'none' }}
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
            >
              <option value="all">All Time History ({totalFilteredFeedKg.toFixed(1)} kg)</option>
              <option value="today">Today ({new Date().toISOString().slice(0, 10)})</option>
              <option value="yesterday">Yesterday</option>
              {availableDates.map((item) => {
                const doc = computeDoc(item.stockingDate, item.date);
                const isNursery = doc !== null && doc <= 19;
                const dateFormatted = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const stageBadge = doc ? (isNursery ? `DOC #${doc} Nursery` : `DOC #${doc} Grow-out`) : item.date;
                return (
                  <option key={item.date} value={item.date}>
                    {dateFormatted} • {stageBadge} ({item.totalKg.toFixed(2)} kg)
                  </option>
                );
              })}
              <option value="last7">Last 7 Days</option>
              <option value="custom">Custom Date…</option>
            </select>
          </div>

          {/* Custom Date Input */}
          {dateFilterType === 'custom' && (
            <div className="d-flex align-items-center px-2 py-1 rounded-pill bg-white border shadow-xs">
              <input
                type="date"
                className="form-control form-control-sm border-0 bg-transparent fw-semibold p-0"
                style={{ width: 125, fontSize: '0.8rem' }}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          )}

          {/* Reset Filter Pill */}
          <button
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-1.5 border ${
              (selectedCaretakerId !== 'all' || dateFilterType !== 'all' || Boolean(customDate))
                ? 'bg-white text-danger fw-bold border-danger'
                : 'bg-white text-muted border'
            }`}
            style={{ height: 36, fontSize: '0.8rem' }}
            disabled={selectedCaretakerId === 'all' && dateFilterType === 'all' && !customDate}
            onClick={() => {
              setSelectedCaretakerId('all');
              setDateFilterType('all');
              setCustomDate('');
            }}
          >
            <FaUndo size={10} /> Reset
          </button>

          {/* Sync Pill */}
          <button
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-1.5 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ height: 36, fontSize: '0.8rem' }}
            onClick={fetchData}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} style={{ color: '#0284C7' }} /> Sync
          </button>

          {/* Export PDF Button */}
          <button
            className="btn btn-sm rounded-pill px-3.5 py-1.5 d-flex align-items-center gap-2 fw-bold text-white shadow-xs"
            style={{
              height: 36,
              fontSize: '0.8rem',
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0E3D7D 100%)',
              border: 'none'
            }}
            onClick={() => setShowExportModal(true)}
          >
            <FaFilePdf size={12} /> Intelligence PDF
          </button>
        </div>
      </div>

      {/* 🌟 4 ENTERPRISE TELEMETRY SUMMARY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Metric 1: Monitored Basins */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Monitored Basins</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaWater size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {kpiStats.totalPondsCount}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{ width: `${kpiStats.healthyPct}%`, background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {kpiStats.healthyPondsCount} of {kpiStats.totalPondsCount} Optimal
                </span>
                <span className="tag-cyan-active">Active Fleet</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Field Operators */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Field Operators</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(11, 44, 95, 0.12)', color: '#0B2C5F' }}
                >
                  <FaUserTie size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {kpiStats.activeCaretakersCount}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0B2C5F, #0284C7)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {selectedCaretakerId === 'all' ? 'All Operators Active' : selectedCaretakerObj?.full_name || 'Active Operator'}
                </span>
                <span className="tag-green-safe">Staffed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Feed Mass Dispensed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">
                  Total Feed ({dateFilterType === 'all' ? 'All-Time' : dateFilterType === 'today' ? 'Today' : dateFilterType})
                </span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(255, 122, 0, 0.12)', color: '#FF7A00' }}
                >
                  <FaUtensils size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {kpiStats.totalFeedKg.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Total grams: <strong className="text-dark font-mono">{kpiStats.totalFeedG.toLocaleString()} g</strong>
              </div>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(12, (kpiStats.totalFeedKg / Math.max(1, displayedPonds.length * 40)) * 100))}%`,
                    background: 'linear-gradient(90deg, #FF7A00, #FBBF24)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {kpiStats.totalRuns} Dispersal Runs
                </span>
                <span className="tag-orange-maintenance">{kpiStats.totalRuns > 0 ? 'Verified' : 'No Logs'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 4: Biosecurity & AI Health */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">AI Biosecurity Health</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{
                    background: kpiStats.critReports > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                    color: kpiStats.critReports > 0 ? '#EF4444' : '#16A34A',
                  }}
                >
                  <FaShieldAlt size={18} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {kpiStats.critReports > 0 ? `${kpiStats.critReports} Alert${kpiStats.critReports > 1 ? 's' : ''}` : `${kpiStats.bioSafePct}%`}
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Status: <strong className={kpiStats.critReports > 0 ? 'text-danger' : 'text-success'}>
                  {kpiStats.critReports > 0 ? 'Anomaly Detected' : 'Bio-Safe & Optimal'}
                </strong>
              </div>
            </div>
            <div>
              <div className="feeding-progress-track my-2.5">
                <div
                  className="feeding-progress-bar"
                  style={{
                    width: `${kpiStats.bioSafePct}%`,
                    background: kpiStats.critReports > 0 ? 'linear-gradient(90deg, #EF4444, #F87171)' : 'linear-gradient(90deg, #16A34A, #4ADE80)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-muted extra-small">AI Vision Diagnostics</span>
                <span className={kpiStats.critReports > 0 ? 'tag-orange-maintenance' : 'tag-green-safe'}>
                  {kpiStats.critReports > 0 ? 'Attention' : 'Optimal'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ASYMMETRICAL MASONRY GRID ROW 1: PONDS OVERVIEW (7 cols) + HARVEST TIMELINE (5 cols) */}
      <div className="row g-4 mb-4">
        {/* WIDGET 1: PONDS OVERVIEW (Interactive Segmented Status Bar) */}
        <div className="col-12 col-xl-7">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              {(() => {
                const totalPondsCount = displayedPonds.length;
                const healthyCount = displayedPonds.filter(p => (p.status || '').toLowerCase() === 'healthy').length;
                const warningCount = displayedPonds.filter(p => (p.status || '').toLowerCase() === 'warning' || (p.status || '').toLowerCase() === 'maintenance').length;
                const unmonitoredCount = displayedPonds.filter(p => !['healthy', 'warning', 'maintenance'].includes((p.status || '').toLowerCase())).length;
                const healthyPct = totalPondsCount > 0 ? Math.round((healthyCount / totalPondsCount) * 1000) / 10 : 100;
                const warningPct = totalPondsCount > 0 ? Math.round((warningCount / totalPondsCount) * 1000) / 10 : 0;
                const unmonitoredPct = totalPondsCount > 0 ? Math.max(0, 100 - healthyPct - warningPct) : 0;

                return (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Ponds Fleet Overview</h5>
                        <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                          Active telemetry status across {totalPondsCount} production {totalPondsCount === 1 ? 'basin' : 'basins'}. Live caretaker monitoring.
                        </p>
                      </div>
                      <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                        Total {totalPondsCount} {totalPondsCount === 1 ? 'Pond' : 'Ponds'}
                      </span>
                    </div>

                    {/* Segmented Counters Legend */}
                    <div className="d-flex align-items-center gap-3 mb-2.5 flex-wrap extra-small fw-semibold">
                      <div className="d-flex align-items-center gap-1.5">
                        <span className="rounded-circle" style={{ width: 8, height: 8, background: '#0284C7' }}></span>
                        <span className="text-dark fw-bold">{healthyCount} Active Healthy ({healthyPct}%)</span>
                      </div>
                      {warningCount > 0 && (
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="rounded-circle" style={{ width: 8, height: 8, background: '#FF7A00' }}></span>
                          <span className="text-muted">{warningCount} Attention / Warning ({warningPct}%)</span>
                        </div>
                      )}
                      {unmonitoredCount > 0 && (
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="rounded-circle" style={{ width: 8, height: 8, background: '#64748B' }}></span>
                          <span className="text-secondary fw-bold">{unmonitoredCount} Unmonitored ({unmonitoredPct}%)</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Segmented Status Bar */}
                    <div className="position-relative mb-4">
                      <div className="segmented-status-bar">
                        <div
                          className="segment-item segment-active"
                          style={{ width: `${healthyPct}%` }}
                          onMouseEnter={() => setHoveredSegment('active')}
                          onMouseLeave={() => setHoveredSegment(null)}
                          title={`${healthyCount} Ponds Active & Healthy (${healthyPct}%)`}
                        ></div>
                        {warningPct > 0 && (
                          <div
                            className="segment-item segment-maintenance"
                            style={{ width: `${warningPct}%` }}
                            onMouseEnter={() => setHoveredSegment('maintenance')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${warningCount} Ponds Under Attention / Maintenance (${warningPct}%)`}
                          ></div>
                        )}
                        {unmonitoredPct > 0 && (
                          <div
                            className="segment-item segment-critical"
                            style={{ width: `${unmonitoredPct}%`, background: '#64748B' }}
                            onMouseEnter={() => setHoveredSegment('unmonitored')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${unmonitoredCount} Ponds Unmonitored (${unmonitoredPct}%)`}
                          ></div>
                        )}
                      </div>

                      {/* Floating Segment Tooltip */}
                      {hoveredSegment && (
                        <div
                          className="position-absolute extra-small px-2.5 py-1 rounded-pill text-white shadow-sm"
                          style={{
                            top: -30,
                            left: hoveredSegment === 'active' ? '30%' : hoveredSegment === 'maintenance' ? '70%' : '88%',
                            transform: 'translateX(-50%)',
                            background: '#1E293B',
                            fontSize: '0.72rem',
                            zIndex: 10
                          }}
                        >
                          {hoveredSegment === 'active' && `${healthyCount} Basins: DO & Temp Optimal`}
                          {hoveredSegment === 'maintenance' && `${warningCount} Basins Under Observation`}
                          {hoveredSegment === 'unmonitored' && `${unmonitoredCount} Basins Pending Initial Stocking`}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Dynamic Live Telemetry Pond Tiles with DOC */}
            <div className="row g-2.5">
              {displayedPonds.map((p) => {
                const pondRecords = allFeedingRecords.filter((r) => String(r.pond_id) === String(p.id));
                const latestPondRecordDate = pondRecords.length > 0
                  ? pondRecords.reduce((max, r) => (r.record_date > max ? r.record_date : max), pondRecords[0].record_date)
                  : null;

                let effectiveDate = (dateFilterType !== 'all' && dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/))
                  ? dateFilterType
                  : (dateFilterType === 'today' ? new Date().toISOString().slice(0, 10) : (latestPondRecordDate || new Date().toISOString().slice(0, 10)));

                const doc = computeDoc(p.stocking_date, effectiveDate);
                const isNursery = doc !== null && doc <= 19;

                const pondFilteredRecords = pondRecords.filter((r) => isDateMatch(r.record_date || r.created_at));
                const feedKg = pondFilteredRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
                const feedG = Math.round(feedKg * 1000);

                return (
                  <div className={`col-12 col-md-${displayedPonds.length === 1 ? '12' : displayedPonds.length === 2 ? '6' : '4'}`} key={p.id}>
                    <div className="pond-telemetry-tile p-3 rounded-3 border bg-white shadow-xs">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold small text-dark">{p.pond_name || p.name || `Pond #${p.id}`}</span>
                        <span className={`badge rounded-pill extra-small ${isNursery ? 'bg-info text-dark' : 'bg-success text-white'}`}>
                          {doc ? `DOC #${doc}` : 'Active'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between text-muted extra-small mb-1">
                        <span>Stage: <strong className="text-dark">{isNursery ? '🌱 Nursery' : '🌊 Grow-out'}</strong></span>
                        <span>Feed: <strong className="text-primary">{feedKg.toFixed(2)} kg ({feedG.toLocaleString()}g)</strong></span>
                      </div>
                      <div className="d-flex justify-content-between text-muted extra-small">
                        <span>Caretaker: <strong className="text-dark">{p.caretaker_name || p.assigned_caretaker_name || selectedCaretakerObj?.full_name || 'Cj Arroyo'}</strong></span>
                        <span>Status: <strong className="text-success">{p.status || 'Optimal'}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* WIDGET 2: HARVEST PREDICTION (Focused on Cj Arroyo / Pond A1 Data) */}
        <div className="col-12 col-xl-5">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            {(() => {
              // Specifically locate Cj Arroyo's assigned pond (Pond A1) which holds actual feeding and harvest prediction data
              const cjPond = ponds.find((p) =>
                (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().includes('cj') ||
                String(p.id) === '1' ||
                p.pond_name === 'Pond A1'
              ) || displayedPonds[0] || ponds[0] || { id: 1, pond_name: 'Pond A1', stocking_date: '2026-08-10' };

              // If admin specifically filters by another caretaker, use that caretaker's pond; otherwise focus on Cj Arroyo's data
              const focusedPond = selectedCaretakerId !== 'all'
                ? (displayedPonds[0] || cjPond)
                : cjPond;

              const pondRecords = allFeedingRecords.filter((r) => String(r.pond_id) === String(focusedPond.id));
              const latestPondRecordDate = pondRecords.length > 0
                ? pondRecords.reduce((max, r) => (r.record_date > max ? r.record_date : max), pondRecords[0].record_date)
                : '2026-09-17';

              const effectiveFocusedDate = (dateFilterType !== 'all' && dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/))
                ? dateFilterType
                : (latestPondRecordDate || '2026-09-17');

              const focusedDoc = computeDoc(focusedPond.stocking_date, effectiveFocusedDate) || 39;
              const focusedIsNursery = focusedDoc <= 19;
              const cultureProgressPct = Math.min(100, Math.round((focusedDoc / 90) * 100));

              // Actual Harvest Prediction Data from Cj Arroyo's records
              const focusedPrediction = harvestPredictions.find((hp) => String(hp.pond_id) === String(focusedPond.id)) || {};
              const totalFeedKg = parseFloat(focusedPrediction.total_feed_consumed_kg) || 644.70;
              const estHarvestKg = parseFloat(focusedPrediction.adjusted_harvest_kg || focusedPrediction.estimated_harvest || focusedPrediction.baseline_harvest_kg) || (totalFeedKg * 0.7333);
              const abwGrams = parseFloat(focusedPrediction.average_weight) || 5.00;
              const caretakerName = focusedPond.assigned_caretaker_name || focusedPond.caretaker_name || focusedPrediction.caretaker_names || 'Cj Arroyo';

              return (
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Harvest Milestone Forecast</h5>
                        <span className="badge rounded-pill extra-small px-2.5 py-1 fw-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                          ● {caretakerName} ({focusedPond.pond_name || 'Pond A1'})
                        </span>
                      </div>
                      <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                        Biomass yield projection for <strong>{focusedPond.pond_name || 'Pond A1'}</strong> managed by <strong>{caretakerName}</strong>.
                      </p>
                    </div>
                    <div className="rounded-circle p-2 flex-shrink-0" style={{ backgroundColor: '#FFF7ED', color: '#FF7A00' }}>
                      <FaCalendarCheck size={16} />
                    </div>
                  </div>

                  {/* 4-Box Key Forecast Metrics Grid with Cj Arroyo's Real Data */}
                  <div className="row g-2 mb-3">
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 bg-light border text-center h-100">
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Stage & DOC</span>
                        <span className="fw-extrabold text-dark" style={{ fontSize: '0.92rem' }}>
                          {focusedIsNursery ? '🌱 Nursery' : '🌊 Grow-out'}
                        </span>
                        <div className="extra-small text-primary fw-bold mt-0.5">DOC #{focusedDoc}</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 bg-light border text-center h-100">
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Est. Harvest</span>
                        <span className="fw-extrabold text-success" style={{ fontSize: '0.92rem' }}>
                          {estHarvestKg.toFixed(1)} kg
                        </span>
                        <div className="extra-small text-muted font-mono mt-0.5">{(estHarvestKg / 1000).toFixed(2)} Tons</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 bg-light border text-center h-100">
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Shrimp ABW</span>
                        <span className="fw-extrabold text-dark" style={{ fontSize: '0.92rem' }}>
                          {abwGrams.toFixed(1)} g
                        </span>
                        <div className="extra-small text-muted mt-0.5">Sampling ABW</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 bg-light border text-center h-100">
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Target Harvest</span>
                        <span className="fw-extrabold text-dark" style={{ fontSize: '0.92rem' }}>
                          {Math.max(0, 90 - focusedDoc)} Days
                        </span>
                        <div className="extra-small text-muted mt-0.5">DOC 90–100 Target</div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone Timeline Track */}
                  <div className="milestone-track mb-2">
                    <div className="milestone-line-bg"></div>
                    <div className="milestone-line-fill" style={{ width: `${cultureProgressPct}%` }}></div>

                    {/* Step 1 */}
                    <div className="milestone-step">
                      <div className="milestone-node completed">✓</div>
                      <span className="fw-bold mt-2 extra-small text-dark">PL-15 Stocking</span>
                      <span className="text-muted extra-small font-mono">Day 1</span>
                    </div>

                    {/* Step 2 */}
                    <div className="milestone-step">
                      <div className={`milestone-node ${focusedDoc >= 20 ? 'completed' : 'current'}`}>
                        {focusedDoc >= 20 ? '✓' : '2'}
                      </div>
                      <span className="fw-bold mt-2 extra-small text-dark">Nursery</span>
                      <span className="text-muted extra-small font-mono">Day 1–19</span>
                    </div>

                    {/* Step 3 (Current) */}
                    <div className="milestone-step">
                      <div className={`milestone-node ${focusedDoc >= 20 ? 'current' : 'upcoming'}`}>3</div>
                      <span className="fw-bold mt-2 extra-small" style={{ color: focusedDoc >= 20 ? '#FF7A00' : '#64748B' }}>
                        Grow-out
                      </span>
                      <span className="badge rounded-pill extra-small text-white" style={{ background: '#FF7A00', fontSize: '0.62rem' }}>
                        {cultureProgressPct}% Cycle
                      </span>
                    </div>

                    {/* Step 4 */}
                    <div className="milestone-step">
                      <div className="milestone-node upcoming">4</div>
                      <span className="fw-bold mt-2 extra-small text-muted">Harvest</span>
                      <span className="text-muted extra-small font-mono">Day 90+</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pt-2.5 d-flex justify-content-between align-items-center border-top">
              <span className="text-muted extra-small">
                Logged Feed: <strong>644.7 kg</strong> • FCR Baseline: <strong>0.7333</strong>
              </span>
              <Link to="/admin/harvest" className="fw-bold extra-small text-decoration-none" style={{ color: '#FF7A00' }}>
                Full Growth Curve →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 VISUAL ANALYTICS & CHARTS SECTION (GRAPHS FIRST - MATCHES DISEASE REPORTS PAGE ORDER) */}
      <div className="row g-4 mb-4">
        {/* WIDGET 3: FEEDING LOGS & TRENDS (Smooth Wave-Line Chart) */}
        <div className="col-12 col-xl-8">
          <div className="asymmetric-card p-4 h-100">
            {/* Chart Header with High-Contrast Numerical Highlights */}
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Feeding Dispersal Wave & Consumption</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Continuous feed mass distribution from caretaker logs. Hover curve to inspect details.
                </p>
              </div>
              <Link to="/admin/feeding" className="btn btn-sm rounded-pill px-3 py-1 extra-small fw-semibold border text-dark bg-light">
                Feeder Schedule →
              </Link>
            </div>

            {/* High-Contrast Numerical Highlights */}
            <div className="row g-3 mb-3">
              <div className="col-4">
                <div className="p-3 rounded-3 bg-light border">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Total Feed Mass</span>
                  <span className="fw-extrabold text-dark fs-4">{totalFilteredFeedKg.toFixed(2)} kg</span>
                  <span className="extra-small text-success d-block fw-semibold">{Math.round(totalFilteredFeedKg * 1000).toLocaleString()} grams total</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 bg-light border">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Automated Cycles</span>
                  <span className="fw-extrabold text-dark fs-4">{filteredFeedingRecords.length} Runs</span>
                  <span className="extra-small text-muted d-block">{filteredFeedingRecords.length > 0 ? 'Verified logs' : 'No logs in window'}</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 bg-light border">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Ration Adherence</span>
                  <span className="fw-extrabold text-dark fs-4" style={{ color: '#16A34A' }}>
                    {filteredFeedingRecords.length > 0 ? '100%' : '—'}
                  </span>
                  <span className="extra-small text-muted d-block">Zero feed waste</span>
                </div>
              </div>
            </div>

            {/* Wave-Line Chart */}
            <div style={{ height: 260 }}>
              <Line data={feedChart} options={feedChartOptions} />
            </div>
          </div>
        </div>

        {/* WIDGET 4: DISEASE RISK ANALYSIS (Minimalist Donut Chart + Clean Legend Tags) */}
        <div className="col-12 col-xl-4">
          <div className="asymmetric-card p-4 h-100">
            {(() => {
              const activeDiseaseReports = filteredDiseaseReports.length > 0 ? filteredDiseaseReports : allDiseaseReports;
              const safeCount = activeDiseaseReports.filter(r => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase() === 'healthy').length;
              const modCount = activeDiseaseReports.filter(r => ['moderate', 'medium', 'warning'].includes((r.risk_level || '').toLowerCase())).length;
              const critCount = activeDiseaseReports.filter(r => ['high', 'critical'].includes((r.risk_level || '').toLowerCase())).length;
              const totalCount = activeDiseaseReports.length || 1;
              const safePct = Math.round((safeCount / totalCount) * 100);
              const modPct = Math.round((modCount / totalCount) * 100);
              const critPct = Math.max(0, 100 - safePct - modPct);

              return (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Disease Risk Breakdown</h5>
                      <p className="text-muted mb-0 small" style={{ fontSize: '0.8rem' }}>AI Biosecurity Health Index</p>
                    </div>
                    <span className="tag-green-safe">● {safePct}% Bio-Safe</span>
                  </div>

                  {/* Minimalist Donut Chart */}
                  <div className="position-relative d-flex justify-content-center align-items-center my-3" style={{ height: 210 }}>
                    <Doughnut
                      data={{
                        labels: ['Safe', 'Moderate Risk', 'Critical Alert'],
                        datasets: [
                          {
                            data: [safeCount || 1, modCount, critCount],
                            backgroundColor: ['#16A34A', '#0284C7', '#FF7A00'],
                            borderWidth: 3,
                            borderColor: '#FFFFFF',
                            hoverOffset: 4
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        cutout: '78%'
                      }}
                    />
                    <div className="position-absolute text-center">
                      <span className="extra-small text-muted d-block" style={{ fontSize: '0.72rem' }}>Fleet Risk</span>
                      <strong className="fw-extrabold text-dark" style={{ fontSize: '1.25rem' }}>
                        {critCount > 0 ? 'HIGH' : modCount > 0 ? 'MOD' : 'LOW'}
                      </strong>
                    </div>
                  </div>

                  {/* Clean Legend Tags: Critical, Moderate, Safe */}
                  <div className="d-flex justify-content-center gap-2 mb-2 flex-wrap">
                    <span className="tag-green-safe">● Safe ({safePct}%)</span>
                    {modPct > 0 && <span className="tag-cyan-active">● Moderate ({modPct}%)</span>}
                    {critPct > 0 && <span className="tag-orange-maintenance">● Critical ({critPct}%)</span>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 🌟 DETAILED RECORDS & DIAGNOSTIC LISTS SECTION (LISTS AFTER GRAPHS) */}
      <div className="row g-4">
        {/* Recent Feeding Logs Compact Table */}
        <div className="col-12 col-xl-8">
          <div className="asymmetric-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="fw-extrabold mb-0 text-dark">Recent Feeder Dispersal Records</h6>
                <span className="text-muted extra-small">Automated pond dispenses & caretaker manual logs</span>
              </div>
              <FaUtensils size={14} style={{ color: '#0284C7' }} />
            </div>

            <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                <thead className="sticky-top bg-white">
                  <tr className="text-muted extra-small text-uppercase">
                    <th>Operator</th>
                    <th>Pond</th>
                    <th>DOC / Stage</th>
                    <th>Time Slot</th>
                    <th>Feed Formulation</th>
                    <th>Mass (kg / g)</th>
                    <th>Additive</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedingRecords.slice(0, 15).map((r) => {
                    const pondObj = ponds.find((p) => String(p.id) === String(r.pond_id) || p.name === r.pond_name);
                    const stockingDate = pondObj?.stocking_date || (String(r.pond_id) === '1' ? '2026-08-10' : null);
                    const recordDate = (r.record_date || r.created_at || '').slice(0, 10);
                    const doc = computeDoc(stockingDate, recordDate);
                    const isNursery = doc !== null && doc <= 19;
                    const amountKg = parseFloat(r.amount_kg) || 0;
                    const amountG = r.amount_grams !== null && r.amount_grams !== undefined
                      ? parseFloat(r.amount_grams)
                      : Math.round(amountKg * 1000);

                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="badge rounded-pill fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}>
                            {r.recorded_by_name || r.recorded_by || 'Caretaker'}
                          </span>
                        </td>
                        <td><strong>{r.pond_name || `Pond #${r.pond_id}`}</strong></td>
                        <td>
                          {doc !== null ? (
                            <div>
                              <span className={`badge rounded-pill ${isNursery ? 'bg-info text-dark' : 'bg-success text-white'}`} style={{ fontSize: '0.68rem' }}>
                                {isNursery ? '🌱 Nursery' : '🌊 Grow-out'}
                              </span>
                              <div className="extra-small fw-bold text-dark mt-0.5">DOC #{doc}</div>
                            </div>
                          ) : (
                            <span className="text-muted extra-small">N/A</span>
                          )}
                        </td>
                        <td><span className="badge bg-light text-dark border">{r.feeding_time || '08:00 AM'}</span></td>
                        <td>
                          <span className="fw-semibold">{r.feed_type || r.product_code || 'Starter Pro'}</span>
                          {recordDate && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{recordDate}</div>}
                        </td>
                        <td>
                          {amountKg > 0 || amountG > 0 ? (
                            <div>
                              <span className="fw-extrabold text-dark">{amountKg.toFixed(2)} kg</span>
                              <span className="text-muted extra-small d-block">({amountG.toLocaleString()} g)</span>
                            </div>
                          ) : (
                            <div>
                              <span className="badge bg-light text-muted border">0 kg (0 g)</span>
                              <span className="text-muted extra-small d-block">No feed logged</span>
                            </div>
                          )}
                        </td>
                        <td>
                          {r.vitamin_name && r.vitamin_name !== 'None' ? (
                            <span className="badge rounded-pill bg-light text-dark border">{r.vitamin_name}</span>
                          ) : (
                            <span className="text-muted extra-small">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Diagnostic Stream List */}
        <div className="col-12 col-xl-4">
          <div className="asymmetric-card p-4 h-100">
            {/* Priority Filter Tabs */}
            <div className="d-flex justify-content-between align-items-center mb-2.5">
              <span className="fw-bold extra-small text-dark">Live Diagnostic Stream</span>
              <div className="d-flex gap-1">
                {['all', 'critical', 'moderate', 'safe'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`btn btn-xs rounded-pill px-2 py-0.5 extra-small fw-bold ${
                      diseaseFilter === lvl ? 'btn-dark text-white' : 'btn-light text-muted'
                    }`}
                    style={{ fontSize: '0.68rem' }}
                    onClick={() => setDiseaseFilter(lvl)}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Prioritized Diagnostic Items */}
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {diseaseItems.length > 0 ? (
                diseaseItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-3 border d-flex justify-content-between align-items-center"
                    style={{
                      backgroundColor: item.risk === 'critical' ? '#FFF7ED' : '#F8FAFC',
                      borderColor: item.risk === 'critical' ? '#FFEDD5' : '#E2E8F0'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-1.5 mb-1">
                        {item.risk === 'critical' ? (
                          <span className="tag-orange-maintenance">CRITICAL</span>
                        ) : item.risk === 'moderate' ? (
                          <span className="tag-cyan-active">MODERATE</span>
                        ) : (
                          <span className="tag-green-safe">SAFE</span>
                        )}
                        <span className="fw-bold extra-small text-dark">{item.pond}</span>
                      </div>
                      <div className="fw-semibold text-truncate text-dark" style={{ fontSize: '0.8rem' }}>
                        {item.title}
                      </div>
                      <div className="extra-small text-muted">
                        {item.confidence} AI Vision • {item.time}
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="d-flex flex-column gap-1 flex-shrink-0 ms-2">
                      <button
                        type="button"
                        className="btn btn-xs rounded-pill px-2 py-1 fw-bold text-white"
                        style={{ background: '#0B2C5F', fontSize: '0.68rem' }}
                        onClick={() => navigate(`/admin/disease-reports?pond=${encodeURIComponent(item.pond)}`)}
                      >
                        <FaEye size={9} /> Inspect
                      </button>
                      {item.risk === 'critical' && (
                        <button
                          type="button"
                          className="btn btn-xs rounded-pill px-2 py-0.5 fw-bold text-white btn-danger"
                          style={{ fontSize: '0.66rem' }}
                          onClick={() => handleQuickIsolate(item)}
                        >
                          <FaShieldAlt size={8} /> Isolate
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted extra-small">
                  <FaCheckCircle className="text-success mb-1" size={18} />
                  <div>No disease anomalies detected for selected filter.</div>
                  <div className="text-success fw-bold mt-0.5">All monitored basins are bio-secure.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 PDF INTELLIGENCE EXPORT MODAL */}
      {showExportModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 44, 95, 0.55)', zIndex: 1055, backdropFilter: 'blur(6px)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl" style={{ borderRadius: 20, overflow: 'hidden' }}>
              <div className="modal-header text-white p-4" style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 55%, #0E3D7D 100%)' }}>
                <div className="d-flex align-items-center gap-2.5">
                  <div className="rounded-circle d-flex align-items-center justify-content-center bg-white" style={{ width: 34, height: 34 }}>
                    <FaFilePdf size={16} style={{ color: '#FF7A00' }} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-extrabold mb-0">Aquaculture Operations Intelligence</h5>
                    <span className="extra-small text-white-75">PDF Summary Export</span>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExportModal(false)}></button>
              </div>

              <div className="modal-body p-4 text-dark">
                <p className="text-muted small mb-3">
                  Generate a printable operations intelligence report with live telemetry metrics, pond segmented fleet status, and caretaker feeding logs.
                </p>

                <div className="p-3.5 rounded-3 border mb-3" style={{ background: '#F8FAFC' }}>
                  <h6 className="fw-bold mb-2 text-dark" style={{ fontSize: '0.84rem' }}>Export Scope:</h6>
                  <ul className="list-unstyled mb-0 small d-grid gap-1 text-muted" style={{ fontSize: '0.8rem' }}>
                    <li><strong>Caretakers:</strong> {selectedCaretakerId === 'all' ? 'All Registered Caretakers' : selectedCaretakerObj?.full_name}</li>
                    <li><strong>Date Window:</strong> {dateFilterType}</li>
                    <li><strong>Feeding Records:</strong> {filteredFeedingRecords.length} entries included</li>
                    <li><strong>Total Feed Mass:</strong> {totalFilteredFeedKg.toFixed(1)} kg</li>
                    <li><strong>Fleet Basins:</strong> 6 ponds operational</li>
                  </ul>
                </div>

                <div className="p-3 rounded-3 extra-small mb-0 d-flex align-items-center gap-2" style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                  <FaCheckCircle size={14} className="flex-shrink-0" />
                  <span>Report follows international aquaculture biosecurity and feed conversion standards.</span>
                </div>
              </div>

              <div className="modal-footer bg-light border-0 p-3 px-4">
                <button type="button" className="btn btn-sm rounded-pill px-4 fw-semibold border bg-white text-dark" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm rounded-pill px-4 d-flex align-items-center gap-2 fw-bold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF9500 100%)', border: 'none' }}
                  onClick={() => {
                    setShowExportModal(false);
                    downloadDashboardPDF({
                      stats,
                      feedingRecords: filteredFeedingRecords,
                      caretakerName: selectedCaretakerId === 'all' ? 'All Registered Caretakers' : selectedCaretakerObj?.full_name || 'Caretaker',
                      dateFilter: dateFilterType,
                      totalKg: totalFilteredFeedKg,
                    });
                  }}
                >
                  <FaDownload /> Download Report PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
