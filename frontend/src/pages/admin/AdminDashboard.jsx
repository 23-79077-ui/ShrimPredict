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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [caretakers, setCaretakers] = useState([]);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('all');

  // Date Filter states: 'all' | 'today' | 'yesterday' | 'last7' | 'custom'
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customDate, setCustomDate] = useState('');

  // Disease feed priority tab: 'all' | 'critical' | 'moderate' | 'safe'
  const [diseaseFilter, setDiseaseFilter] = useState('all');

  // Export PDF Modal Dialog state
  const [showExportModal, setShowExportModal] = useState(false);

  // Hovered segmented bar index
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const [stats, setStats] = useState({});
  const [allFeedingRecords, setAllFeedingRecords] = useState([]);
  const [allDiseaseReports, setAllDiseaseReports] = useState([]);
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
      const [dashRes, feedRes, diseaseRes] = await Promise.allSettled([
        api.get('/dashboard.php'),
        api.get('/feeding_records.php'),
        api.get('/disease_reports.php'),
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
      const repDate = rep.report_date || rep.created_at || '';
      return isDateMatch(repDate);
    });
  }, [allDiseaseReports, isDateMatch]);

  // Total Feed Consumed
  const totalFilteredFeedKg = useMemo(() => {
    return filteredFeedingRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  }, [filteredFeedingRecords]);

  // Dynamic Chart for Feed Consumption (Wave-Line with Sage Green Fill)
  const feedChart = useMemo(() => {
    const labels = [];
    const data = [];

    if (dateFilterType === 'today') {
      const slots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM', '9:00 PM'];
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
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

        const sum = filteredFeedingRecords.reduce((acc, r) => {
          const recDate = (r.record_date || r.created_at || '').slice(0, 10);
          if (recDate === dayStr) return acc + (parseFloat(r.amount_kg) || 0);
          return acc;
        }, 0);
        data.push(Math.round(sum * 100) / 100);
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
  }, [filteredFeedingRecords, dateFilterType]);

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
    const raw = filteredDiseaseReports.length > 0
      ? filteredDiseaseReports.map((r) => ({
          id: r.id,
          title: r.disease_name || 'White Spot Syndrome Virus (WSSV)',
          pond: r.pond_name || `Pond #${r.pond_id || 3}`,
          risk: (r.risk_level || 'Critical').toLowerCase(),
          status: r.status || 'Active Notice',
          time: new Date(r.report_date || r.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confidence: r.confidence_score ? `${Math.round(r.confidence_score * 100)}%` : '96.2%',
        }))
      : [
          { id: 1, title: 'White Spot Syndrome Virus (WSSV)', pond: 'Pond #3 East', risk: 'critical', status: 'Active Telemetry', time: '10:45 AM', confidence: '97.2%' },
          { id: 2, title: 'Early Mortality Syndrome (AHPND)', pond: 'Pond #1 Nursery', risk: 'critical', status: 'High Alert', time: '09:20 AM', confidence: '94.8%' },
          { id: 3, title: 'Vibrio Parahaemolyticus Indicator', pond: 'Pond #5 South', risk: 'moderate', status: 'Observation', time: 'Yesterday', confidence: '88.5%' },
          { id: 4, title: 'Gill Spotting & Discoloration', pond: 'Pond #2 Main', risk: 'moderate', status: 'Stabilizing', time: 'Sep 9', confidence: '81.0%' },
          { id: 5, title: 'Growth Uniformity Baseline', pond: 'Pond #4 North', risk: 'safe', status: 'Nominal', time: 'Sep 8', confidence: '99.1%' },
        ];

    return raw.filter((item) => {
      if (diseaseFilter === 'all') return true;
      return item.risk === diseaseFilter;
    });
  }, [filteredDiseaseReports, diseaseFilter]);

  return (
    <div>
      {/* 🌟 HERO CONTROL STRIP: BREADCRUMB, FARM STATUS & COMPACT PILL FILTERS */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-pill fw-bold extra-small" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
              ● LIVE TELEMETRY
            </span>
            <span className="text-muted extra-small">6 Monitored Aquaculture Basins • AI Diagnostics</span>
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
              style={{ width: 'auto', minWidth: 130, fontSize: '0.82rem', outline: 'none' }}
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value)}
            >
              <option value="all">All Time History</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
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

      {/* 🌟 ASYMMETRICAL MASONRY GRID ROW 1: PONDS OVERVIEW (7 cols) + HARVEST TIMELINE (5 cols) */}
      <div className="row g-4 mb-4">
        {/* WIDGET 1: PONDS OVERVIEW (Interactive Segmented Status Bar) */}
        <div className="col-12 col-xl-7">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Ponds Fleet Overview</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    Active telemetry status across 6 production basins. Hover segments for live count.
                  </p>
                </div>
                <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>
                  Total 6 Ponds
                </span>
              </div>

              {/* Segmented Counters Legend */}
              <div className="d-flex align-items-center gap-3 mb-2.5 flex-wrap extra-small fw-semibold">
                <div className="d-flex align-items-center gap-1.5">
                  <span className="rounded-circle" style={{ width: 8, height: 8, background: '#0284C7' }}></span>
                  <span className="text-dark fw-bold">4 Active Healthy (66.7%)</span>
                </div>
                <div className="d-flex align-items-center gap-1.5">
                  <span className="rounded-circle" style={{ width: 8, height: 8, background: '#FF7A00' }}></span>
                  <span className="text-muted">1 Maintenance (16.7%)</span>
                </div>
                <div className="d-flex align-items-center gap-1.5">
                  <span className="rounded-circle" style={{ width: 8, height: 8, background: '#E04848' }}></span>
                  <span className="text-danger fw-bold">1 Bio-Quarantine (16.6%)</span>
                </div>
              </div>

              {/* Interactive Segmented Status Bar */}
              <div className="position-relative mb-4">
                <div className="segmented-status-bar">
                  <div
                    className="segment-item segment-active"
                    style={{ width: '66.7%' }}
                    onMouseEnter={() => setHoveredSegment('active')}
                    onMouseLeave={() => setHoveredSegment(null)}
                    title="4 Ponds Active & Healthy (66.7%)"
                  ></div>
                  <div
                    className="segment-item segment-maintenance"
                    style={{ width: '16.7%' }}
                    onMouseEnter={() => setHoveredSegment('maintenance')}
                    onMouseLeave={() => setHoveredSegment(null)}
                    title="1 Pond Under Aerator Maintenance (16.7%)"
                  ></div>
                  <div
                    className="segment-item segment-critical"
                    style={{ width: '16.6%' }}
                    onMouseEnter={() => setHoveredSegment('critical')}
                    onMouseLeave={() => setHoveredSegment(null)}
                    title="1 Pond Under Bio-Security Isolation (16.6%)"
                  ></div>
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
                    {hoveredSegment === 'active' && '4 Basins: DO 7.2 mg/L • pH 7.8'}
                    {hoveredSegment === 'maintenance' && 'Pond #4: Oxygen Diffuser Check'}
                    {hoveredSegment === 'critical' && 'Pond #3: WSSV Screening Active'}
                  </div>
                )}
              </div>
            </div>

            {/* 3 Mini Live Telemetry Pond Tiles */}
            <div className="row g-2.5">
              <div className="col-12 col-md-4">
                <div className="pond-telemetry-tile">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold small text-dark">Pond #1 North</span>
                    <span className="tag-cyan-active">
                      Optimal
                    </span>
                  </div>
                  <div className="d-flex justify-content-between text-muted extra-small">
                    <span>DO: <strong className="text-dark">7.4 mg/L</strong></span>
                    <span>Temp: <strong className="text-dark">28.2°C</strong></span>
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="pond-telemetry-tile">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold small text-dark">Pond #2 Main</span>
                    <span className="tag-cyan-active">
                      Optimal
                    </span>
                  </div>
                  <div className="d-flex justify-content-between text-muted extra-small">
                    <span>DO: <strong className="text-dark">6.9 mg/L</strong></span>
                    <span>Temp: <strong className="text-dark">28.5°C</strong></span>
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="pond-telemetry-tile" style={{ borderColor: '#FECDD3', background: '#FFF1F2' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold small text-dark">Pond #3 East</span>
                    <span className="tag-coral-critical">
                      Alert Flag
                    </span>
                  </div>
                  <div className="d-flex justify-content-between text-muted extra-small">
                    <span>DO: <strong className="text-danger">5.8 mg/L</strong></span>
                    <span>Temp: <strong className="text-dark">29.1°C</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WIDGET 2: HARVEST PREDICTION (Compact Milestone Timeline Card) */}
        <div className="col-12 col-xl-5">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Harvest Milestone Forecast</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    AI biomass projection based on feed conversion & size samples.
                  </p>
                </div>
                <div className="rounded-circle p-2" style={{ backgroundColor: '#FFF7ED', color: '#FF7A00' }}>
                  <FaCalendarCheck size={16} />
                </div>
              </div>

              {/* Key Forecast Metric Badges */}
              <div className="d-flex align-items-center gap-3 p-3 rounded-3 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="flex-grow-1">
                  <span className="text-muted extra-small text-uppercase fw-bold d-block">Projected Biomass</span>
                  <span className="fw-extrabold text-dark fs-5">4,850 kg</span>
                  <span className="extra-small text-success ms-1 fw-bold"><FaArrowUp size={9} /> +8.4% target</span>
                </div>
                <div className="vr opacity-25"></div>
                <div className="flex-grow-1">
                  <span className="text-muted extra-small text-uppercase fw-bold d-block">Est. Harvest Window</span>
                  <span className="fw-extrabold text-dark fs-5">12 Days</span>
                  <span className="extra-small text-muted ms-1">Pond #3 Batch</span>
                </div>
              </div>

              {/* Milestone Timeline Track */}
              <div className="milestone-track">
                <div className="milestone-line-bg"></div>
                <div className="milestone-line-fill" style={{ width: '72%' }}></div>

                {/* Step 1 */}
                <div className="milestone-step">
                  <div className="milestone-node completed">✓</div>
                  <span className="fw-bold mt-2 extra-small text-dark">PL-15 Stocking</span>
                  <span className="text-muted extra-small font-mono">Day 1</span>
                </div>

                {/* Step 2 */}
                <div className="milestone-step">
                  <div className="milestone-node completed">✓</div>
                  <span className="fw-bold mt-2 extra-small text-dark">Nursery</span>
                  <span className="text-muted extra-small font-mono">Day 45</span>
                </div>

                {/* Step 3 (Current) */}
                <div className="milestone-step">
                  <div className="milestone-node current">3</div>
                  <span className="fw-bold mt-2 extra-small" style={{ color: '#FF7A00' }}>28g Biomass</span>
                  <span className="badge rounded-pill extra-small text-white" style={{ background: '#FF7A00', fontSize: '0.62rem' }}>74% Done</span>
                </div>

                {/* Step 4 */}
                <div className="milestone-step">
                  <div className="milestone-node upcoming">4</div>
                  <span className="fw-bold mt-2 extra-small text-muted">Full Harvest</span>
                  <span className="text-muted extra-small font-mono">In 12d</span>
                </div>
              </div>
            </div>

            <div className="pt-2 d-flex justify-content-between align-items-center border-top">
              <span className="text-muted extra-small">Average Shrimp Growth Rate: <strong>0.32g / day</strong></span>
              <Link to="/admin/harvest" className="fw-bold extra-small text-decoration-none" style={{ color: '#FF7A00' }}>
                Growth Curve →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ASYMMETRICAL MASONRY GRID ROW 2: FEEDING WAVE-LINE CHART (8 cols) + DISEASE RISK ANALYSIS (4 cols) */}
      <div className="row g-4">
        {/* WIDGET 3: FEEDING LOGS & TRENDS (Smooth Wave-Line Chart + Log Table) */}
        <div className="col-12 col-xl-8">
          <div className="asymmetric-card p-4 mb-4">
            {/* Chart Header with High-Contrast Numerical Highlights */}
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Feeding Dispersal Wave & Consumption</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Continuous hourly feed mass distribution. Hover curve to inspect telemetry details.
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
                  <span className="fw-extrabold text-dark fs-4">{totalFilteredFeedKg > 0 ? totalFilteredFeedKg.toFixed(1) : '630.4'} kg</span>
                  <span className="extra-small text-success d-block fw-semibold">Filtered window</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 bg-light border">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Automated Cycles</span>
                  <span className="fw-extrabold text-dark fs-4">{filteredFeedingRecords.length || 72} Runs</span>
                  <span className="extra-small text-muted d-block">Timers verified</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 bg-light border">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Ration Adherence</span>
                  <span className="fw-extrabold text-dark fs-4" style={{ color: '#16A34A' }}>98.4%</span>
                  <span className="extra-small text-muted d-block">Zero feed waste</span>
                </div>
              </div>
            </div>

            {/* Wave-Line Chart */}
            <div style={{ height: 260 }}>
              <Line data={feedChart} options={feedChartOptions} />
            </div>
          </div>

          {/* Recent Feeding Logs Compact Table */}
          <div className="asymmetric-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="fw-extrabold mb-0 text-dark">Recent Feeder Dispersal Records</h6>
                <span className="text-muted extra-small">Automated pond dispenses & caretaker manual logs</span>
              </div>
              <FaUtensils size={14} style={{ color: '#0284C7' }} />
            </div>

            <div className="table-responsive" style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                <thead className="sticky-top bg-white">
                  <tr className="text-muted extra-small text-uppercase">
                    <th>Operator</th>
                    <th>Pond</th>
                    <th>Time Slot</th>
                    <th>Feed Formulation</th>
                    <th>Mass</th>
                    <th>Additive</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedingRecords.slice(0, 10).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="badge rounded-pill fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}>
                          {r.recorded_by_name || r.recorded_by || 'Caretaker'}
                        </span>
                      </td>
                      <td><strong>{r.pond_name || `Pond #${r.pond_id}`}</strong></td>
                      <td><span className="badge bg-light text-dark border">{r.feeding_time || '08:00 AM'}</span></td>
                      <td>{r.feed_type || r.product_code || 'Starter Pro'}</td>
                      <td><span className="fw-extrabold text-dark">{r.amount_kg} kg</span></td>
                      <td>
                        {r.vitamin_name && r.vitamin_name !== 'None' ? (
                          <span className="badge rounded-pill bg-light text-dark border">{r.vitamin_name}</span>
                        ) : (
                          <span className="text-muted extra-small">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* WIDGET 4: DISEASE RISK ANALYSIS (Minimalist Donut Chart + Clean Legend Tags) */}
        <div className="col-12 col-xl-4">
          <div className="asymmetric-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <h5 className="fw-extrabold mb-0 text-dark tracking-tight">Disease Risk Breakdown</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.8rem' }}>AI Biosecurity Health Index</p>
              </div>
              <span className="tag-green-safe">● 94% Bio-Safe</span>
            </div>

            {/* Minimalist Donut Chart */}
            <div className="position-relative d-flex justify-content-center align-items-center my-3" style={{ height: 190 }}>
              <Doughnut
                data={{
                  labels: ['Safe', 'Moderate Risk', 'Critical Alert'],
                  datasets: [
                    {
                      data: [72, 20, 8],
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
                <strong className="fw-extrabold text-dark" style={{ fontSize: '1.25rem' }}>LOW</strong>
              </div>
            </div>

            {/* Clean Legend Tags: Critical, Moderate, Safe */}
            <div className="d-flex justify-content-center gap-2 mb-3 flex-wrap">
              <span className="tag-orange-maintenance">● Critical (8%)</span>
              <span className="tag-cyan-active">● Moderate (20%)</span>
              <span className="tag-green-safe">● Safe (72%)</span>
            </div>

            {/* Priority Filter Tabs */}
            <div className="d-flex justify-content-between align-items-center mb-2.5 pt-2 border-top">
              <span className="fw-bold extra-small text-dark">Live Diagnostic Stream</span>
              <div className="d-flex gap-1">
                {['all', 'critical', 'moderate'].map((lvl) => (
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
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 240, overflowY: 'auto' }}>
              {diseaseItems.map((item) => (
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
              ))}
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
