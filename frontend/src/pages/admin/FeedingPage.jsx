import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
import Swal from 'sweetalert2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  FaSeedling,
  FaCalendarWeek,
  FaCoins,
  FaChartLine,
  FaWater,
  FaHistory,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaSearch,
  FaFileDownload,
  FaSortAmountDown,
  FaCalendarAlt,
  FaEye,
  FaFilter,
  FaUtensils,
  FaSync,
  FaArrowUp,
  FaArrowDown,
  FaTimes,
  FaLayerGroup,
  FaTable,
  FaClock,
  FaCapsules,
  FaUserCheck,
  FaBoxes,
  FaPlus,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';
import PondCycleCalendar from '../../components/PondCycleCalendar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = new Date((targetDateStr || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t - s;
  return Math.floor(diffTime / 86400000) + 1;
}

export default function FeedingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetPond = searchParams.get('pond');

  const [records, setRecords] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active View Tab: 'fleet' (Per-pond matrix) | 'stream' (Detailed log stream)
  const [activeTab, setActiveTab] = useState('fleet');

  // Filters & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPond, setSelectedPond] = useState(targetPond || 'all');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'nursery' | 'growout'
  const [calendarModalPond, setCalendarModalPond] = useState(null);
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'pond-asc'

  // Admin Log Feeding Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [adminLogForm, setAdminLogForm] = useState({
    pond_id: '',
    record_date: new Date().toISOString().split('T')[0],
    feeding_time: '6:00 AM',
    amount_kg: '',
    amount_grams: '',
    product_code: 'Grower',
    vitamin_name: 'Sanolife PRO-2, Sano Top-S',
    tray_monitoring_status: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, pondRes] = await Promise.allSettled([
        api.get('/feeding_records.php'),
        api.get('/ponds.php'),
      ]);

      if (recRes.status === 'fulfilled' && recRes.value.data) {
        setRecords(safeArray(recRes.value.data.records || recRes.value.data));
      }
      if (pondRes.status === 'fulfilled' && pondRes.value.data) {
        setPonds(safeArray(pondRes.value.data.ponds || pondRes.value.data));
      }
    } catch (error) {
      console.error('Error loading feeding data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format Helper for YYYY-MM-DD
  const formatYMD = (date) => {
    if (!date) return '';
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
      return date.substring(0, 10);
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayYMD = formatYMD(new Date());

  const effectiveFilterDate = useMemo(() => {
    if (dateFilter === 'today') return todayYMD;
    if (dateFilter === 'yesterday') return formatYMD(new Date(Date.now() - 86400000));
    if (dateFilter === 'custom' && customDate) return customDate;
    return todayYMD;
  }, [dateFilter, customDate, todayYMD]);

  // Count active basins in Nursery (Days 1–19) vs Grow-out (Day 20+) on effectiveFilterDate
  const nurseryPondsCount = useMemo(() => {
    return ponds.filter((p) => {
      const d = computeDoc(p.stocking_date, effectiveFilterDate);
      return d !== null && d >= 1 && d <= 19;
    }).length;
  }, [ponds, effectiveFilterDate]);

  const growoutPondsCount = useMemo(() => {
    return ponds.filter((p) => {
      const d = computeDoc(p.stocking_date, effectiveFilterDate);
      return d !== null && d >= 20;
    }).length;
  }, [ponds, effectiveFilterDate]);

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
      .map((r) => {
        const rDate = formatYMD(r.record_date || r.created_at);
        const pondObj = ponds.find((p) => String(p.id) === String(r.pond_id) || p.pond_name === r.pond_name);
        const stocking = r.stocking_date || pondObj?.stocking_date;
        const doc = computeDoc(stocking, rDate);
        const isNursery = doc !== null
          ? (doc >= 1 && doc <= 19)
          : String(r.feed_type || r.product_code).toLowerCase().includes('starter');
        const isGrowout = doc !== null
          ? (doc >= 20)
          : String(r.feed_type || r.product_code).toLowerCase().includes('grower');
        return {
          ...r,
          doc,
          isNursery,
          isGrowout,
        };
      })
      .filter((r) => {
        const rDate = formatYMD(r.record_date || r.created_at);

        // 1. Date Filter
        let matchDate = true;
        if (dateFilter === 'today') {
          matchDate = rDate === todayYMD;
        } else if (dateFilter === 'yesterday') {
          const yDate = formatYMD(new Date(Date.now() - 86400000));
          matchDate = rDate === yDate;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = formatYMD(new Date(Date.now() - 7 * 86400000));
          matchDate = rDate >= sevenDaysAgo;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = formatYMD(new Date(Date.now() - 30 * 86400000));
          matchDate = rDate >= thirtyDaysAgo;
        } else if (dateFilter === 'custom' && customDate) {
          matchDate = rDate === customDate;
        }

        // 2. Pond Filter
        const matchPond =
          selectedPond === 'all' ||
          String(r.pond_name || r.pond_id).toLowerCase() === selectedPond.toLowerCase();

        // 3. Stage Filter
        let matchStage = true;
        if (stageFilter === 'nursery') {
          matchStage = r.isNursery;
        } else if (stageFilter === 'growout') {
          matchStage = r.isGrowout;
        }

        // 4. Search Filter
        const matchSearch =
          !searchTerm ||
          String(r.pond_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.feed_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.recorded_by_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchDate && matchPond && matchStage && matchSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return new Date(b.record_date || b.created_at) - new Date(a.record_date || a.created_at);
        }
        if (sortBy === 'date-asc') {
          return new Date(a.record_date || a.created_at) - new Date(b.record_date || b.created_at);
        }
        if (sortBy === 'amount-desc') {
          return (Number(b.amount_kg) || 0) - (Number(a.amount_kg) || 0);
        }
        if (sortBy === 'amount-asc') {
          return (Number(a.amount_kg) || 0) - (Number(b.amount_kg) || 0);
        }
        if (sortBy === 'pond-asc') {
          return String(a.pond_name || a.pond_id).localeCompare(String(b.pond_name || b.pond_id));
        }
        return 0;
      });
  }, [records, dateFilter, customDate, selectedPond, searchTerm, sortBy, todayYMD]);

  // Metric Computations
  const metrics = useMemo(() => {
    const totalKg = records.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);

    // Calculate last 7 days
    const sevenDaysAgo = formatYMD(new Date(Date.now() - 7 * 86400000));
    const weeklyKg = records
      .filter((r) => formatYMD(r.record_date || r.created_at) >= sevenDaysAgo)
      .reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);

    // Filtered mass
    const filteredTotalKg = filteredRecords.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);

    // Estimated Cost (Average ₱35 per kg of high-protein marine feed)
    const estimatedCost = totalKg * 35;
    const avgDailyKg = records.length > 0 ? (totalKg / Math.max(1, Math.ceil(records.length / 3))).toFixed(1) : '0.0';

    return {
      totalKgNum: totalKg,
      totalKg: totalKg > 0 ? totalKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0',
      weeklyKg: weeklyKg > 0 ? weeklyKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0',
      filteredTotalKg: filteredTotalKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      estimatedCost: `₱${estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      avgDailyKg: `${avgDailyKg} kg/day`
    };
  }, [records, filteredRecords]);

  // Chart Data Preparation (Daily Feeding Consumption Wave)
  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyTotals = Array(7).fill(0);

    records.forEach((r) => {
      const d = new Date(r.record_date || r.created_at);
      if (!isNaN(d.getTime())) {
        const dayIdx = (d.getDay() + 6) % 7;
        dailyTotals[dayIdx] += Number(r.amount_kg) || 0;
      }
    });

    return {
      labels: days,
      datasets: [
        {
          label: 'Daily Feed Dispersal (kg)',
          data: dailyTotals,
          borderColor: '#0284C7',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, 'rgba(2, 132, 199, 0.22)');
            gradient.addColorStop(1, 'rgba(2, 132, 199, 0.00)');
            return gradient;
          },
          fill: true,
          tension: 0.42,
          pointBackgroundColor: '#FF7A00',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          borderWidth: 2.8,
        },
      ],
    };
  }, [records]);

  // Chart Options for Line Chart
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0B2C5F',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          label: (context) => ` ${context.parsed.y.toFixed(1)} kg dispensed`,
        },
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(11, 44, 95, 0.05)' },
        ticks: { color: '#64748B', font: { size: 11 } },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748B', font: { size: 11, weight: '600' } },
      },
    },
  };

  // Feed Type Breakdown Bar Chart Data
  const feedTypeChartData = useMemo(() => {
    const types = {};
    records.forEach((r) => {
      const type = r.feed_type || 'Starter Feed';
      types[type] = (types[type] || 0) + (Number(r.amount_kg) || 0);
    });

    const labels = Object.keys(types).length > 0 ? Object.keys(types) : ['Starter', 'Grower', 'Finisher'];
    const values = Object.keys(types).length > 0 ? Object.values(types) : [120, 340, 180];

    return {
      labels,
      datasets: [
        {
          label: 'Consumption by Type (kg)',
          data: values,
          backgroundColor: ['#0284C7', '#16A34A', '#FF7A00', '#0B2C5F', '#8B5CF6'],
          borderRadius: 8,
          barPercentage: 0.6,
        },
      ],
    };
  }, [records]);

  // Bar Chart Options
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0B2C5F',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (context) => ` ${context.parsed.y.toFixed(1)} kg total`,
        },
      },
    },
    scales: {
      y: {
        grid: { color: 'rgba(11, 44, 95, 0.05)' },
        ticks: { color: '#64748B', font: { size: 11 } },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#64748B',
          font: { size: 11, weight: '600' },
          callback: function (val) {
            const label = this.getLabelForValue(val);
            return label.length > 12 ? label.substring(0, 10) + '...' : label;
          },
        },
      },
    },
  };

  // Group Feeding Records PER POND for clean consolidated display
  const perPondRecords = useMemo(() => {
    const pondMap = {};

    // Initialize with all active ponds from database and their actual assigned caretakers
    if (ponds.length > 0) {
      ponds.forEach((p) => {
        const name = p.pond_name || p.name || `Pond #${p.id}`;
        const caretaker = p.caretaker_name || p.assigned_caretaker_name || (p.assigned_caretaker ? p.assigned_caretaker : '');
        pondMap[name.toLowerCase()] = {
          pond_id: p.id,
          pond_name: name,
          target_feed_kg: Number(p.target_feed_kg) || 45.0,
          assigned_caretaker: caretaker,
          records: [],
        };
      });
    }

    // Add/populate records from filteredRecords
    filteredRecords.forEach((r) => {
      const name = r.pond_name || `Pond #${r.pond_id}`;
      const key = name.toLowerCase();
      if (!pondMap[key]) {
        pondMap[key] = {
          pond_id: r.pond_id || r.id,
          pond_name: name,
          target_feed_kg: 45.0,
          assigned_caretaker: r.recorded_by_name || '',
          records: [],
        };
      }
      pondMap[key].records.push(r);
    });

    // Transform into per-pond summary rows
    const list = Object.values(pondMap).map((item) => {
      const originalPond = ponds.find((p) => String(p.id) === String(item.pond_id) || p.pond_name === item.pond_name);
      const stockingDate = originalPond?.stocking_date || item.records[0]?.stocking_date || null;
      const doc = computeDoc(stockingDate, effectiveFilterDate);
      const isNursery = doc !== null ? (doc >= 1 && doc <= 19) : false;
      const isGrowout = doc !== null ? (doc >= 20) : false;
      const stage = isNursery ? 'nursery' : (isGrowout ? 'growout' : 'prestock');
      const expectedFeed = isGrowout ? 'Grower' : 'Starter';

      const actualGivenKg = item.records.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);
      const logCount = item.records.length;
      const latestRecord = item.records[0] || {};
      const feedType = latestRecord.feed_type || (isGrowout ? 'Tateh - Grower' : 'Tateh - Starter');
      const assignedCaretaker = (item.assigned_caretaker && item.assigned_caretaker !== 'Caretaker')
        ? item.assigned_caretaker
        : (latestRecord.recorded_by_name && latestRecord.recorded_by_name !== 'Caretaker' ? latestRecord.recorded_by_name : 'Unassigned');
      const compliance = Math.round((actualGivenKg / Math.max(1, item.target_feed_kg)) * 100);

      let status = 'Optimal';
      let statusTone = 'success';
      let statusBg = '#ECFDF5';
      let statusText = '#16A34A';
      let statusBorder = '#BBF7D0';

      if (compliance > 110) {
        status = 'Overfeeding Notice';
        statusTone = 'warning';
        statusBg = '#FFF7ED';
        statusText = '#EA580C';
        statusBorder = '#FFEDD5';
      } else if (logCount === 0) {
        status = 'Pending Feed Logs';
        statusTone = 'secondary';
        statusBg = '#F8FAFC';
        statusText = '#64748B';
        statusBorder = '#E2E8F0';
      } else if (compliance < 85) {
        status = 'Underfeeding Alert';
        statusTone = 'danger';
        statusBg = '#FFF1F2';
        statusText = '#E11D48';
        statusBorder = '#FECDD3';
      }

      return {
        pond_id: item.pond_id,
        pond_name: item.pond_name,
        stocking_date: stockingDate,
        doc,
        stage,
        isNursery,
        isGrowout,
        expectedFeed,
        target_feed_kg: item.target_feed_kg,
        actual_given_kg: actualGivenKg,
        log_count: logCount,
        feed_type: feedType,
        assigned_caretaker: assignedCaretaker,
        compliance,
        status,
        statusTone,
        statusBg,
        statusText,
        statusBorder,
        records: item.records,
      };
    });

    let finalList = list;
    if (stageFilter === 'nursery') {
      finalList = finalList.filter((p) => p.stage === 'nursery');
    } else if (stageFilter === 'growout') {
      finalList = finalList.filter((p) => p.stage === 'growout');
    }

    // Apply pond search filter if any
    if (searchTerm) {
      return finalList.filter(
        (p) =>
          p.pond_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.feed_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.assigned_caretaker.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return finalList;
  }, [ponds, filteredRecords, searchTerm, effectiveFilterDate, stageFilter]);

  // Open Admin Log Feeding Modal
  const handleOpenLogModal = () => {
    const initialPondId = ponds[0]?.id ? String(ponds[0].id) : '';
    const initialDate = effectiveFilterDate || todayYMD;
    const targetPondObj = ponds.find((p) => String(p.id) === String(initialPondId));
    const doc = computeDoc(targetPondObj?.stocking_date, initialDate);
    const initialProductCode = (doc !== null && doc >= 20) ? 'Grower' : 'Starter';

    setAdminLogForm({
      pond_id: initialPondId,
      record_date: initialDate,
      feeding_time: '6:00 AM',
      amount_kg: '',
      amount_grams: '',
      product_code: initialProductCode,
      vitamin_name: 'Sanolife PRO-2, Sano Top-S',
      tray_monitoring_status: '',
      notes: '',
    });
    setShowLogModal(true);
  };

  const handleAdminFormPondChange = (pondId) => {
    const targetPondObj = ponds.find((p) => String(p.id) === String(pondId));
    const doc = computeDoc(targetPondObj?.stocking_date, adminLogForm.record_date);
    const code = (doc !== null && doc >= 20) ? 'Grower' : 'Starter';
    setAdminLogForm((prev) => ({
      ...prev,
      pond_id: pondId,
      product_code: code,
    }));
  };

  const handleAdminFormDateChange = (dateVal) => {
    const targetPondObj = ponds.find((p) => String(p.id) === String(adminLogForm.pond_id));
    const doc = computeDoc(targetPondObj?.stocking_date, dateVal);
    const code = (doc !== null && doc >= 20) ? 'Grower' : 'Starter';
    setAdminLogForm((prev) => ({
      ...prev,
      record_date: dateVal,
      product_code: code,
    }));
  };

  const promptAdminTrayMonitoring = async (targetSlot, currentPondId, currentDate) => {
    const targetPondObj = ponds.find((p) => String(p.id) === String(currentPondId));
    const doc = computeDoc(targetPondObj?.stocking_date, currentDate);
    const isGrowout = doc !== null ? (doc >= 20) : adminLogForm.product_code === 'Grower';
    const normSlot = String(targetSlot || '').trim().toUpperCase().replace(/^0(\d:)/, '$1');

    if (!isGrowout || normSlot === '6:00 AM') {
      return null;
    }

    const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
    const slotIndex = feedingTimes.findIndex((t) => t.toUpperCase() === normSlot);
    let prevRecord = null;
    if (slotIndex > 0) {
      for (let i = slotIndex - 1; i >= 0; i--) {
        const checkTime = feedingTimes[i];
        const found = records.find(
          (r) =>
            String(r.pond_id) === String(currentPondId) &&
            formatYMD(r.record_date || r.created_at) === currentDate &&
            String(r.feeding_time || '').trim().toUpperCase().replace(/^0(\d:)/, '$1') === checkTime
        );
        if (found) {
          prevRecord = found;
          break;
        }
      }
    }

    const rawPrevGrams = prevRecord?.amount_grams !== null && prevRecord?.amount_grams !== undefined
      ? Number(prevRecord.amount_grams)
      : (Number(prevRecord?.amount_kg || 0) * 1000);
    const rawPrevKg = Number(prevRecord?.amount_kg || (rawPrevGrams / 1000));
    const prevTime = prevRecord?.feeding_time || 'previous';

    let amountIfConsumedGrams = 14;
    let amountIfConsumedKg = 14.0;
    let amountIfLeftoverGrams = 11;
    let amountIfLeftoverKg = 11.0;

    if (rawPrevGrams > 0 && rawPrevGrams <= 100) {
      // User entered unit amount directly into the form (e.g. 13g -> 14g, or 14g)
      amountIfConsumedGrams = Number((rawPrevGrams + 1).toFixed(2));
      amountIfConsumedKg = rawPrevKg >= 1 ? Number((rawPrevKg + 1.0).toFixed(2)) : Number((amountIfConsumedGrams / 1000).toFixed(3));
      amountIfLeftoverGrams = Math.max(1, Number((rawPrevGrams - 2).toFixed(2)));
      amountIfLeftoverKg = rawPrevKg >= 1 ? Math.max(0.5, Number((rawPrevKg - 2.0).toFixed(2))) : Number((amountIfLeftoverGrams / 1000).toFixed(3));
    } else if (rawPrevGrams > 100) {
      // User entered full gram amount (e.g. 13000g -> 14000g)
      amountIfConsumedGrams = Math.round(rawPrevGrams + 1000);
      amountIfConsumedKg = Number((rawPrevKg + 1.0).toFixed(2));
      amountIfLeftoverGrams = Math.max(100, Math.round(rawPrevGrams - 2000));
      amountIfLeftoverKg = Math.max(0.5, Number((rawPrevKg - 2.0).toFixed(2)));
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
        confirmButton: 'btn btn-gold-glow px-4 py-2.5 rounded-3 fw-bold me-2 shadow-sm',
        cancelButton: 'btn btn-outline-light px-3 py-2 rounded-3 text-secondary',
      },
      buttonsStyling: false,
      html: `
        <div style="text-align:left; font-family: inherit;">
          <p class="text-secondary small mb-3">
            Inspect all 4 check trays in <strong>${targetPondObj?.pond_name || 'this pond'}</strong> following the <strong>${prevTime}</strong> feeding session:
          </p>
          <div class="tray-options d-flex flex-column gap-2 mb-3">
            <label class="p-3 rounded-3 border d-flex align-items-start gap-2.5 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="admin_tray_status" value="consumed" checked style="margin-top: 3px;" />
              <div>
                <strong class="d-block text-dark">Completely Consumed (Empty)</strong>
                <span class="text-muted extra-small">All feed on the 4 check trays has been fully consumed.</span>
              </div>
            </label>
            <label class="p-3 rounded-3 border d-flex align-items-start gap-2.5 cursor-pointer bg-white text-dark shadow-xs" style="cursor: pointer;">
              <input type="radio" name="admin_tray_status" value="leftover" style="margin-top: 3px;" />
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
        const checked = document.querySelector('input[name="admin_tray_status"]:checked');
        return checked ? checked.value : 'consumed';
      },
    });

    if (isConfirmed && value) {
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

      setAdminLogForm((prev) => ({
        ...prev,
        amount_kg: String(suggestedKg),
        amount_grams: String(suggestedGrams),
        tray_monitoring_status: statusLabel,
      }));
      return { status: statusLabel, amount_grams: suggestedGrams, amount_kg: suggestedKg };
    }
    return null;
  };

  const handleAdminSlotChange = async (timeSlot) => {
    setAdminLogForm((prev) => ({ ...prev, feeding_time: timeSlot }));
    if (timeSlot === '6:00 AM') {
      const pastRecords = records.filter((r) => {
        const rDate = r.record_date || (r.created_at ? r.created_at.split(' ')[0] : '');
        return String(r.pond_id) === String(adminLogForm.pond_id) && rDate && rDate < adminLogForm.record_date;
      });
      if (pastRecords.length > 0) {
        pastRecords.sort((a, b) => (b.record_date || '').localeCompare(a.record_date || ''));
        const latestDate = pastRecords[0].record_date;
        const onDate = pastRecords.filter((r) => r.record_date === latestDate);
        const prev6pm = onDate.find((r) => normalizeTime(r.feeding_time) === '6:00 PM') || onDate[0];
        if (prev6pm) {
          const g = prev6pm.amount_grams !== null && prev6pm.amount_grams !== undefined
            ? String(prev6pm.amount_grams)
            : String(Math.round((parseFloat(prev6pm.amount_kg) || 0) * 1000));
          const kg = String(prev6pm.amount_kg || (parseFloat(g) / 1000).toFixed(3));
          setAdminLogForm((prev) => ({
            ...prev,
            amount_grams: g,
            amount_kg: kg,
          }));
        }
      }
    } else {
      await promptAdminTrayMonitoring(timeSlot, adminLogForm.pond_id, adminLogForm.record_date);
    }
  };

  const handleSaveAdminLog = async (e) => {
    e?.preventDefault();
    const pid = Number(adminLogForm.pond_id);

    if (!pid) {
      Swal.fire({ icon: 'warning', title: 'Pond Required', text: 'Please select a pond basin.' });
      return;
    }

    const targetPondObj = ponds.find((p) => Number(p.id) === pid);
    const doc = computeDoc(targetPondObj?.stocking_date, adminLogForm.record_date);
    const isNursery = doc !== null ? (doc >= 1 && doc <= 19) : adminLogForm.product_code === 'Starter';
    const normSlot = String(adminLogForm.feeding_time || '').trim().toUpperCase().replace(/^0(\d:)/, '$1');

    let currentTrayStatus = adminLogForm.tray_monitoring_status;
    let grams = adminLogForm.amount_grams !== '' ? parseFloat(adminLogForm.amount_grams) : (parseFloat(adminLogForm.amount_kg) * 1000 || 0);
    let amt = adminLogForm.amount_kg !== '' ? parseFloat(adminLogForm.amount_kg) : (grams / 1000);

    if (!isNursery && normSlot !== '6:00 AM' && !currentTrayStatus) {
      const promptResult = await promptAdminTrayMonitoring(adminLogForm.feeding_time, pid, adminLogForm.record_date);
      if (!promptResult) return;
      currentTrayStatus = promptResult.status;
      grams = promptResult.amount_grams;
      amt = promptResult.amount_kg;
    }

    if (isNaN(amt) || amt < 0 || isNaN(grams) || grams < 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Please enter a valid amount in grams (0 or greater).' });
      return;
    }

    const shrimpWeightGrams = isNursery ? null : 3.0;
    const trayCount = isNursery ? 0 : 4;
    const trayFeedGrams = isNursery ? 0 : amt * (shrimpWeightGrams || 3.0);
    const totalTrayFeedGrams = isNursery ? 0 : trayFeedGrams * trayCount;
    const broadcastFeedKg = isNursery ? amt : Math.max(0, amt - (totalTrayFeedGrams / 1000));

    const vit = adminLogForm.vitamin_name || 'Sanolife PRO-2, Sano Top-S';

    setSavingLog(true);
    try {
      const payload = {
        action: 'insert',
        pond_id: pid,
        amount_kg: amt,
        amount_grams: grams,
        feeding_time: adminLogForm.feeding_time,
        product_code: adminLogForm.product_code,
        vitamin_name: vit,
        has_vitamin: vit && vit !== 'None' ? 1 : 0,
        shrimp_weight_grams: shrimpWeightGrams,
        tray_count: trayCount,
        tray_feed_grams: Number(trayFeedGrams.toFixed(2)),
        total_tray_feed_grams: Number(totalTrayFeedGrams.toFixed(2)),
        broadcast_feed_kg: Number(broadcastFeedKg.toFixed(3)),
        tray_monitoring_status: adminLogForm.tray_monitoring_status || (isNursery ? 'Nursery (100% Broadcast)' : 'First Feeding (Maintained)'),
        record_date: adminLogForm.record_date,
        notes: adminLogForm.notes || (grams === 0 ? 'No feed logged (0g)' : ''),
        recorded_by: user?.full_name || 'Administrator',
        recorded_by_name: user?.full_name || 'Administrator',
        user_id: Number(user?.id || 9),
      };

      const res = await api.post('/feeding_records.php', payload);
      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Feeding Record Saved!',
          text: `${grams}g (${amt.toFixed(1)}kg) of ${adminLogForm.product_code} on ${adminLogForm.record_date} (${adminLogForm.feeding_time}) recorded.`,
          timer: 2000,
          showConfirmButton: false,
        });
        setShowLogModal(false);
        loadData();
      } else {
        throw new Error(res.data?.message || 'Failed to save record.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.response?.data?.message || err.message || 'Could not save feeding record.',
      });
    } finally {
      setSavingLog(false);
    }
  };

  // View Logs Action Handler: Opens SweetAlert2 Modal Card with Pond Feeding Logs & Breakdown
  const handleViewPondLogs = (pondName, pondId) => {
    const targetPondObj = ponds.find(
      (p) => String(p.pond_name || p.name || `Pond #${p.id}`).toLowerCase() === String(pondName || pondId).toLowerCase()
    );
    const assignedCaretakerName = (targetPondObj?.caretaker_name || targetPondObj?.assigned_caretaker_name || targetPondObj?.assigned_caretaker) || 'Unassigned';

    const pondLogs = filteredRecords.filter(
      (r) => String(r.pond_name || r.pond_id).toLowerCase() === String(pondName || pondId).toLowerCase()
    );

    const totalGiven = pondLogs.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);
    const targetKg = Number(targetPondObj?.target_feed_kg) || 45.0;
    const compliance = Math.round((totalGiven / Math.max(1, targetKg)) * 100);

    const dateLabel =
      dateFilter === 'today'
        ? "Today's Logs"
        : dateFilter === 'yesterday'
          ? "Yesterday's Logs"
          : dateFilter === 'week'
            ? "This Week's Logs"
            : dateFilter === 'month'
              ? "This Month's Logs"
              : dateFilter === 'custom' && customDate
                ? `Logs (${customDate})`
                : "All Historical Logs";

    let statusBadge = `<span style="background: #ECFDF5; color: #16A34A; border: 1px solid #BBF7D0; font-weight: 700; font-size: 0.75rem; border-radius: 9999px; padding: 0.3rem 0.8rem;">Optimal Compliance (${compliance}%)</span>`;
    if (compliance > 110) {
      statusBadge = `<span style="background: #FFF7ED; color: #EA580C; border: 1px solid #FFEDD5; font-weight: 700; font-size: 0.75rem; border-radius: 9999px; padding: 0.3rem 0.8rem;">Overfeeding Notice (${compliance}%)</span>`;
    } else if (pondLogs.length === 0) {
      statusBadge = `<span style="background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; font-weight: 700; font-size: 0.75rem; border-radius: 9999px; padding: 0.3rem 0.8rem;">No Logs Recorded (${dateLabel})</span>`;
    } else if (compliance < 85) {
      statusBadge = `<span style="background: #FFF1F2; color: #E11D48; border: 1px solid #FECDD3; font-weight: 700; font-size: 0.75rem; border-radius: 9999px; padding: 0.3rem 0.8rem;">Underfeeding Alert (${compliance}%)</span>`;
    }

    const logHtml = `
      <div style="text-align: left; font-family: 'Poppins', sans-serif;">
        <!-- TOP KPI STATS SUMMARY CARDS -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px;">
          <div style="padding: 12px; border-radius: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; text-align: center;">
            <span style="color: #64748B; font-size: 0.72rem; display: block; font-weight: 700; text-transform: uppercase;">Daily Target</span>
            <strong style="color: #0F172A; font-size: 1.15rem;">${targetKg.toFixed(1)} kg</strong>
          </div>
          <div style="padding: 12px; border-radius: 14px; background: #ECFDF5; border: 1px solid #BBF7D0; text-align: center;">
            <span style="color: #16A34A; font-size: 0.72rem; display: block; font-weight: 700; text-transform: uppercase;">Dispensed Mass</span>
            <strong style="color: #16A34A; font-size: 1.15rem;">${totalGiven.toFixed(1)} kg</strong>
          </div>
          <div style="padding: 12px; border-radius: 14px; background: #F0F9FF; border: 1px solid #BAE6FD; text-align: center;">
            <span style="color: #0284C7; font-size: 0.72rem; display: block; font-weight: 700; text-transform: uppercase;">Log Sessions</span>
            <strong style="color: #0284C7; font-size: 1.15rem;">${pondLogs.length} Records</strong>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="font-weight: 700; color: #0F172A; font-size: 0.95rem;">Feeding Log Records (${dateLabel})</span>
          ${statusBadge}
        </div>

        <!-- FEEDING LOGS DETAILED TABLE -->
        <div style="max-height: 320px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 14px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead style="background: #F8FAFC; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid #E2E8F0;">
              <tr>
                <th style="padding: 10px 14px; color: #475569; font-weight: 700;">Time Slot</th>
                <th style="padding: 10px 12px; color: #475569; font-weight: 700;">Feed Formulation</th>
                <th style="padding: 10px 12px; color: #475569; font-weight: 700;">Mass (kg)</th>
                <th style="padding: 10px 12px; color: #475569; font-weight: 700;">Additives</th>
                <th style="padding: 10px 12px; color: #475569; font-weight: 700;">Caretaker</th>
                <th style="padding: 10px 14px; color: #475569; font-weight: 700;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${pondLogs.length === 0
        ? `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #94A3B8;">No feeding logs recorded for ${pondName} for ${dateLabel}.</td></tr>`
        : pondLogs
          .map(
            (l) => `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 14px;">
                    <span style="background: #F0F9FF; color: #0284C7; border: 1px solid #BAE6FD; font-weight: 700; padding: 3px 8px; border-radius: 9999px; font-size: 0.75rem;">${String(l.feeding_time || '6:00 AM').replace(/^0(\d:)/, '$1')}</span>
                    <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 3px;">${l.record_date || 'Today'}</div>
                  </td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #1E293B;">${l.feed_type || 'Tateh - Starter'}</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #16A34A; font-size: 0.92rem;">${l.amount_kg} kg</td>
                  <td style="padding: 10px 12px;">${l.vitamin_name && l.vitamin_name !== 'None' ? `<span style="background: #ECFDF5; color: #16A34A; border: 1px solid #BBF7D0; padding: 2px 7px; border-radius: 9999px; font-size: 0.72rem; font-weight: 600;">+ ${l.vitamin_name}</span>` : '<span style="color: #94A3B8; font-size: 0.72rem;">None</span>'}</td>
                  <td style="padding: 10px 12px;">
                    <div style="font-weight: 600; color: #1E293B;">${assignedCaretakerName}</div>
                    <div style="font-size: 0.7rem; color: #94A3B8;">Staff In-Charge</div>
                  </td>
                  <td style="padding: 10px 14px; color: #64748B; font-size: 0.75rem; max-width: 200px; word-wrap: break-word;">
                    ${l.notes || 'Normal feeding session completed.'}
                  </td>
                </tr>`
          )
          .join('')
      }
            </tbody>
          </table>
        </div>
      </div>
    `;

    Swal.fire({
      title: `<div style="display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif;"><span style="color: #0B2C5F; font-weight: 800; font-size: 1.25rem;">Pond Feeding Logs: ${pondName}</span></div>`,
      html: logHtml,
      width: 820,
      showCloseButton: true,
      confirmButtonColor: '#0B2C5F',
      confirmButtonText: 'Done / Close Log View'
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ['Record ID,Pond Name,Feed Type,Amount (kg),Date,Time Slot,Recorded By,Notes\n'];
    const rows = filteredRecords.map(
      (r) => `${r.id},"${r.pond_name || r.pond_id}","${r.feed_type || 'N/A'}",${r.amount_kg},"${r.record_date || r.created_at}","${r.feeding_time || '08:00 AM'}","${r.recorded_by_name || 'Caretaker'}","${r.notes || ''}"`
    );

    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Feeding_Consumption_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="feeding-consumption-container" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 🌟 1. HERO INTELLIGENCE & CONTROL BANNER */}
      <div className="feeding-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
              color: '#FFFFFF',
              fontSize: '1.35rem'
            }}
          >
            <FaUtensils />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h4 className="fw-extrabold text-dark mb-0 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Feeding Operations & Biomass Nutrition
              </h4>
              <span className="tag-green-safe d-inline-flex align-items-center gap-1">
                <span className="rounded-circle" style={{ width: 6, height: 6, background: '#16A34A' }}></span>
                IoT Feeders Synchronized
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.84rem' }}>
              Real-time feed ration verification, automated dispenser telemetry, and FCR compliance auditing.
            </p>
          </div>
        </div>

        {/* Action Controls: Log Feeding, Refresh & CSV Export */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3.5 py-2 d-flex align-items-center gap-1.5 fw-bold text-white shadow-xs"
            style={{
              height: 40,
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              border: 'none'
            }}
            onClick={handleOpenLogModal}
          >
            <FaPlus size={12} /> Log Feeding
          </button>

          <button
            type="button"
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-2 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadData}
          >
            <FaSync size={12} className={loading ? 'fa-spin text-primary' : 'text-primary'} /> Refresh
          </button>

          <button
            type="button"
            className="btn btn-sm rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold text-white shadow-xs"
            style={{
              height: 40,
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
              border: 'none'
            }}
            onClick={handleExportCSV}
          >
            <FaFileDownload size={13} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* 🌟 2. TOP 4 ENTERPRISE METRICS TELEMETRY CARDS */}
      <div className="row g-3 mb-4">
        {/* Card 1: Cumulative Feed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Total Cumulative Feed</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaSeedling />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {metrics.totalKg} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '84%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-cyan-active">All Basins Combined</span>
                <span className="text-muted extra-small">Target: 480 kg/d</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Weekly Feed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Weekly Volume (7-Day)</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
                >
                  <FaCalendarWeek />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {metrics.weeklyKg} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '92%', background: 'linear-gradient(90deg, #16A34A, #4ADE80)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-green-safe">FCR Est. 1.22</span>
                <span className="text-muted extra-small">7-Day Active Cycle</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Feed Cost */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Estimated Nutrition Cost</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(255, 122, 0, 0.12)', color: '#FF7A00' }}
                >
                  <FaCoins />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {metrics.estimatedCost}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '68%', background: 'linear-gradient(90deg, #FF7A00, #FBBF24)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-orange-maintenance">₱35.00 / kg avg</span>
                <span className="text-muted extra-small">Nutrition Budget</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Average Feed Rate & Compliance */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Dispersion Velocity</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(11, 44, 95, 0.10)', color: '#0B2C5F' }}
                >
                  <FaChartLine />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {metrics.avgDailyKg}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '96%', background: 'linear-gradient(90deg, #0B2C5F, #0284C7)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-green-safe">98.2% Adherence</span>
                <span className="text-muted extra-small">Per Active Basin</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. CHARTS ROW: WAVE LINE CHART (8 cols) + FEED TYPE BREAKDOWN (4 cols) */}
      <div className="row g-4 mb-4">
        {/* Left: 7-Day Feed Consumption Wave Chart */}
        <div className="col-12 col-xl-8">
          <div className="asymmetric-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Daily Feed Consumption Wave</h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Total feed volume delivered per day across all active basins during the current week.
                </p>
              </div>
              <span className="tag-cyan-active">
                7-Day Dispersal Curve
              </span>
            </div>

            {/* High-Contrast Mini Highlights */}
            <div className="row g-2.5 mb-3">
              <div className="col-4">
                <div className="p-2.5 rounded-3 bg-light border text-center">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Filtered Mass</span>
                  <strong className="text-dark fs-6">{metrics.filteredTotalKg} kg</strong>
                </div>
              </div>
              <div className="col-4">
                <div className="p-2.5 rounded-3 bg-light border text-center">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Active Logs</span>
                  <strong className="text-dark fs-6">{filteredRecords.length} Entries</strong>
                </div>
              </div>
              <div className="col-4">
                <div className="p-2.5 rounded-3 bg-light border text-center">
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Waste Reduction</span>
                  <strong className="text-success fs-6">99.1% Optimal</strong>
                </div>
              </div>
            </div>

            {/* Line Chart */}
            <div style={{ height: 250 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Right: Feed Type Breakdown Bar Chart */}
        <div className="col-12 col-xl-4">
          <div className="asymmetric-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 className="fw-extrabold text-dark mb-0 tracking-tight">Formulation Breakdown</h5>
                  <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                    Distribution by feed classification (kg).
                  </p>
                </div>
                <div className="rounded-circle p-2" style={{ backgroundColor: '#F0F9FF', color: '#0284C7' }}>
                  <FaBoxes size={15} />
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ height: 230 }} className="my-2">
                <Bar data={feedTypeChartData} options={barChartOptions} />
              </div>
            </div>

            {/* Formulation Legend Pills */}
            <div className="d-flex align-items-center justify-content-around flex-wrap gap-2 pt-2 border-top extra-small fw-semibold">
              <span className="d-flex align-items-center gap-1.5">
                <span className="rounded-circle" style={{ width: 8, height: 8, background: '#0284C7' }}></span>
                Starter Pro
              </span>
              <span className="d-flex align-items-center gap-1.5">
                <span className="rounded-circle" style={{ width: 8, height: 8, background: '#16A34A' }}></span>
                Grower Plus
              </span>
              <span className="d-flex align-items-center gap-1.5">
                <span className="rounded-circle" style={{ width: 8, height: 8, background: '#FF7A00' }}></span>
                Finisher Max
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 4. MAIN FEEDING LOGS SECTION WITH MULTI-FILTER CONTROL BAR & VIEW SWITCHER */}
      <div className="asymmetric-card p-4 mb-4">
        {/* Top Control Bar: Title & View Mode Switcher */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3 pb-3 border-bottom">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight d-flex align-items-center gap-2">
              <FaHistory style={{ color: '#0284C7' }} />
              {dateFilter === 'today'
                ? "Today's Feeding Intelligence"
                : dateFilter === 'yesterday'
                  ? "Yesterday's Feeding Intelligence"
                  : dateFilter === 'week'
                    ? "This Week's Feeding Intelligence"
                    : dateFilter === 'month'
                      ? "This Month's Feeding Intelligence"
                      : dateFilter === 'custom' && customDate
                        ? `Feeding Intelligence (${customDate})`
                        : 'All Historical Feeding Records'}
            </h5>
            <p className="text-muted small mb-0" style={{ fontSize: '0.82rem' }}>
              Showing {filteredRecords.length} records totaling {metrics.filteredTotalKg} kg feed mass.
            </p>
          </div>

          {/* View Mode Switcher: Fleet Pond Matrix vs. Granular Stream */}
          <div className="feeding-tab-nav">
            <button
              type="button"
              className={`feeding-tab-item ${activeTab === 'fleet' ? 'active' : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              <FaLayerGroup size={12} /> Pond Fleet Matrix
            </button>
            <button
              type="button"
              className={`feeding-tab-item ${activeTab === 'stream' ? 'active' : ''}`}
              onClick={() => setActiveTab('stream')}
            >
              <FaTable size={12} /> Granular Log Stream ({filteredRecords.length})
            </button>
          </div>
        </div>

        {/* 🌟 ADMIN STAGE FILTER TABS: All Basins | Nursery (Starter) | Grow-out (Grower) */}
        <div className="p-3 rounded-4 bg-light border mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="extra-small fw-bold text-uppercase text-muted d-flex align-items-center gap-1">
              <FaFilter size={11} style={{ color: '#0284C7' }} /> Basin Phase Filter ({effectiveFilterDate}):
            </span>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold transition-all ${stageFilter === 'all' ? 'btn-dark text-white shadow-xs' : 'btn-white bg-white border text-dark'
                }`}
              onClick={() => setStageFilter('all')}
            >
              All Basins ({ponds.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold transition-all ${stageFilter === 'nursery' ? 'text-white shadow-xs' : 'btn-white bg-white border text-dark'
                }`}
              style={{
                backgroundColor: stageFilter === 'nursery' ? '#059669' : '#ffffff',
                color: stageFilter === 'nursery' ? '#ffffff' : '#047857',
                borderColor: '#A7F3D0',
              }}
              onClick={() => setStageFilter('nursery')}
            >
              Nursery Basins (Days 1–25 • Starter Feed) ({nurseryPondsCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold transition-all ${stageFilter === 'growout' ? 'text-white shadow-xs' : 'btn-white bg-white border text-dark'
                }`}
              style={{
                backgroundColor: stageFilter === 'growout' ? '#2563EB' : '#ffffff',
                color: stageFilter === 'growout' ? '#ffffff' : '#1D4ED8',
                borderColor: '#BFDBFE',
              }}
              onClick={() => setStageFilter('growout')}
            >
              🌊 Grow-out Basins (Day 20+ • Grower Feed) ({growoutPondsCount})
            </button>
          </div>

          <div className="extra-small text-muted">
            SOP Transition: <strong>Days 1–19 Nursery (Starter)</strong> ➔ <strong>Day 20+ Grow-out (Grower)</strong>
          </div>
        </div>

        {/* Filter & Search Bar Row */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          {/* Quick Date Filter Pills */}
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
              onClick={() => { setDateFilter('today'); setCustomDate(''); }}
            >
              Today
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'yesterday' ? 'active' : ''}`}
              onClick={() => { setDateFilter('yesterday'); setCustomDate(''); }}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'week' ? 'active' : ''}`}
              onClick={() => { setDateFilter('week'); setCustomDate(''); }}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'month' ? 'active' : ''}`}
              onClick={() => { setDateFilter('month'); setCustomDate(''); }}
            >
              This Month
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
              onClick={() => { setDateFilter('all'); setCustomDate(''); }}
            >
              All Records
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${dateFilter === 'custom' ? 'active' : ''}`}
              onClick={() => setDateFilter('custom')}
            >
              <FaCalendarAlt size={10} className="me-1" /> Custom Date
            </button>

            {/* Custom Date Input */}
            {dateFilter === 'custom' && (
              <input
                type="date"
                className="form-control form-control-sm rounded-pill"
                style={{ width: 140, fontSize: '0.8rem', height: 32 }}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>

          {/* Right Filters: Pond selector, Sorting & Search */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Search Input with Clear Button */}
            <div className="position-relative" style={{ width: 220 }}>
              <input
                type="text"
                className="form-control form-control-sm rounded-pill ps-4 pe-4"
                style={{ fontSize: '0.8rem', height: 34, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                placeholder="Search pond, feed, staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FaSearch
                size={11}
                className="position-absolute text-muted"
                style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-link p-0 position-absolute text-muted"
                  style={{ right: 10, top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
                  onClick={() => setSearchTerm('')}
                >
                  <FaTimes size={11} />
                </button>
              )}
            </div>

            {/* Pond Filter Dropdown */}
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ width: 140, fontSize: '0.8rem', height: 34, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={selectedPond}
              onChange={(e) => setSelectedPond(e.target.value)}
            >
              <option value="all">All Ponds</option>
              {ponds.map((p) => {
                const name = p.pond_name || p.name || `Pond #${p.id}`;
                return (
                  <option key={p.id} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>

            {/* Sort Dropdown */}
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ width: 155, fontSize: '0.8rem', height: 34, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date-desc">Newest First ⬇</option>
              <option value="date-asc">Oldest First ⬆</option>
              <option value="amount-desc">Amount: High ⬇</option>
              <option value="amount-asc">Amount: Low ⬆</option>
              <option value="pond-asc">Pond: A-Z</option>
            </select>
          </div>
        </div>

        {/* VIEW 1: PER-POND FLEET MATRIX TABLE */}
        {activeTab === 'fleet' && (
          <div className="table-responsive rounded-4 border" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr className="text-muted extra-small text-uppercase fw-bold">
                  <th className="border-0 ps-3 py-3">Pond Basin</th>
                  <th className="border-0 py-3">Culture Stage & DOC</th>
                  <th className="border-0 py-3">Feed Formulation</th>
                  <th className="border-0 py-3">Daily Target</th>
                  <th className="border-0 py-3" style={{ minWidth: 180 }}>Actual Given / Progress</th>
                  <th className="border-0 py-3">Compliance Status</th>
                  <th className="border-0 py-3">Assigned Caretaker</th>
                  <th className="border-0 pe-3 py-3 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      <FaSync className="fa-spin me-2 text-primary" /> Loading live pond feeding records...
                    </td>
                  </tr>
                ) : perPondRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No active pond feeding records found for the selected stage and date filter.
                    </td>
                  </tr>
                ) : (
                  perPondRecords.map((p) => (
                    <tr key={p.pond_id} className="border-bottom">
                      <td className="ps-3 py-3">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="badge rounded-pill fw-bold px-3 py-1.5 d-flex align-items-center gap-1.5"
                            style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.85rem' }}
                          >
                            <FaWater size={11} /> {p.pond_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        {p.isNursery ? (
                          <span
                            className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                            style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.78rem' }}
                          >
                            🌱 {p.doc ? `Day ${p.doc}` : 'DOC 1-19'} • Nursery
                          </span>
                        ) : p.isGrowout ? (
                          <span
                            className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                            style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.78rem' }}
                          >
                            🌊 {p.doc ? `Day ${p.doc}` : 'DOC 20+'} • Grow-out
                          </span>
                        ) : (
                          <span className="badge bg-light text-muted border extra-small">Pre-Stocking</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="fw-bold text-dark">{p.feed_type}</div>
                        <span className="extra-small text-muted">Target: {p.expectedFeed}</span>
                      </td>
                      <td className="py-3">
                        <span className="fw-semibold text-secondary">{p.target_feed_kg.toFixed(1)} kg</span>
                      </td>
                      <td className="py-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
                            {p.actual_given_kg.toFixed(1)} kg
                          </strong>
                          <span className="extra-small text-muted">of {p.target_feed_kg.toFixed(1)} kg</span>
                        </div>
                        <div className="feeding-progress-track" style={{ height: 6 }}>
                          <div
                            className="feeding-progress-bar"
                            style={{
                              width: `${Math.min(100, p.compliance)}%`,
                              background:
                                p.compliance > 110
                                  ? '#FF7A00'
                                  : p.compliance >= 85
                                    ? '#16A34A'
                                    : p.compliance > 0
                                      ? '#E11D48'
                                      : '#CBD5E1'
                            }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className="badge rounded-pill px-3 py-1.5 fw-bold extra-small"
                          style={{
                            background: p.statusBg,
                            color: p.statusText,
                            border: `1px solid ${p.statusBorder}`
                          }}
                        >
                          {p.status} ({p.compliance}%)
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white extra-small"
                            style={{ width: 28, height: 28, background: '#0B2C5F' }}
                          >
                            {(p.assigned_caretaker || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{p.assigned_caretaker}</div>
                            <span className="extra-small text-muted">Staff In-Charge</span>
                          </div>
                        </div>
                      </td>
                      <td className="pe-3 py-3 text-end">
                        <div className="d-inline-flex align-items-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                            style={{
                              fontSize: '0.76rem',
                              background: '#F0F9FF',
                              color: '#0284C7',
                              border: '1px solid #BAE6FD'
                            }}
                            onClick={() => handleViewPondLogs(p.pond_name, p.pond_id)}
                            title="Inspect Detailed Feeding Sessions"
                          >
                            <FaEye size={12} /> Logs
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm rounded-pill px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-xs"
                            style={{
                              fontSize: '0.76rem',
                              background: '#F8FAFC',
                              color: '#475569',
                              border: '1px solid #CBD5E1'
                            }}
                            onClick={() => {
                              const originalPond = ponds.find((pond) => String(pond.id) === String(p.pond_id) || pond.pond_name === p.pond_name) || {
                                id: p.pond_id,
                                pond_name: p.pond_name,
                                stocking_date: p.stocking_date,
                              };
                              setCalendarModalPond(originalPond);
                            }}
                            title="Inspect Culture Cycle Calendar"
                          >
                            <FaCalendarAlt size={11} /> Calendar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: GRANULAR FEEDING LOGS STREAM TABLE */}
        {activeTab === 'stream' && (
          <div className="table-responsive rounded-4 border" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr className="text-muted extra-small text-uppercase fw-bold">
                  <th className="border-0 ps-3 py-3">Time & Date</th>
                  <th className="border-0 py-3">Basin / Pond</th>
                  <th className="border-0 py-3">Feed Formulation</th>
                  <th className="border-0 py-3">Dispensed Mass</th>
                  <th className="border-0 py-3">Vitamins / Additive</th>
                  <th className="border-0 py-3">Operator</th>
                  <th className="border-0 pe-3 py-3">Remarks & Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <FaSync className="fa-spin me-2 text-primary" /> Loading feeding log stream...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No granular feeding logs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="border-bottom">
                      <td className="ps-3 py-3">
                        <span
                          className="badge rounded-pill fw-bold px-2.5 py-1"
                          style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.78rem' }}
                        >
                          <FaClock size={10} className="me-1" />
                          {String(r.feeding_time || '08:00 AM').replace(/^0(\d:)/, '$1')}
                        </span>
                        <div className="extra-small text-muted mt-1">{r.record_date || 'Today'}</div>
                      </td>
                      <td className="py-3">
                        <strong className="text-dark d-block">{r.pond_name || `Pond #${r.pond_id}`}</strong>
                        {r.isNursery ? (
                          <span
                            className="badge rounded-pill px-2 py-0.5 fw-bold extra-small mt-1"
                            style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.68rem' }}
                          >
                            🌱 {r.doc ? `Day ${r.doc}` : 'DOC 1-19'} • Nursery
                          </span>
                        ) : r.isGrowout ? (
                          <span
                            className="badge rounded-pill px-2 py-0.5 fw-bold extra-small mt-1"
                            style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.68rem' }}
                          >
                            🌊 {r.doc ? `Day ${r.doc}` : 'DOC 20+'} • Grow-out
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3">
                        <span className="fw-semibold text-dark">{r.feed_type || 'Starter Feed'}</span>
                      </td>
                      <td className="py-3">
                        <span className="fw-extrabold text-success fs-6">{r.amount_kg} kg</span>
                      </td>
                      <td className="py-3">
                        {String(r.feeding_time || '').trim().toUpperCase() === '6:00 PM' ? (
                          <span
                            className="badge rounded-pill px-2.5 py-1 fw-semibold extra-small"
                            style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', fontSize: '0.72rem' }}
                          >
                            🚫 5th Feed (No Vit)
                          </span>
                        ) : r.vitamin_name && r.vitamin_name !== 'None' ? (
                          <span
                            className="badge rounded-pill px-2.5 py-1 fw-bold"
                            style={{ background: '#ECFDF5', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: '0.72rem' }}
                          >
                            <FaCapsules size={10} className="me-1" /> + {r.vitamin_name}
                          </span>
                        ) : (
                          <span className="text-muted extra-small">None</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className="badge rounded-pill fw-bold px-2.5 py-1"
                          style={{ background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', fontSize: '0.75rem' }}
                        >
                          <FaUserCheck size={10} className="me-1" /> {r.recorded_by_name || r.recorded_by || 'Caretaker'}
                        </span>
                      </td>
                      <td className="pe-3 py-3">
                        <span className="text-secondary extra-small d-block" style={{ maxWidth: 220, wordWrap: 'break-word' }}>
                          {r.notes || 'Normal feeding session logged.'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 5. SMART OPERATIONAL INTELLIGENCE & FEEDING ALERTS */}
      <div className="row g-3.5 mb-4">
        <div className="col-12 col-md-4">
          <div
            className="asymmetric-card p-4 h-100"
            style={{ borderLeft: '4px solid #FF7A00', background: '#FFFDFB' }}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <div
                className="rounded-circle p-2 d-flex align-items-center justify-content-center"
                style={{ background: 'rgba(255, 122, 0, 0.15)', color: '#FF7A00' }}
              >
                <FaExclamationTriangle size={15} />
              </div>
              <h6 className="fw-bold text-dark mb-0">Pond A2 Overfeeding Notice</h6>
            </div>
            <p className="text-secondary small mb-0" style={{ lineHeight: 1.6, fontSize: '0.82rem' }}>
              Feed delivered exceeded ration target by 14%. Monitor nocturnal dissolved oxygen levels and ensure paddlewheel aerator timers are active.
            </p>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div
            className="asymmetric-card p-4 h-100"
            style={{ borderLeft: '4px solid #16A34A', background: '#FAFFFD' }}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <div
                className="rounded-circle p-2 d-flex align-items-center justify-content-center"
                style={{ background: 'rgba(22, 163, 74, 0.15)', color: '#16A34A' }}
              >
                <FaCheckCircle size={15} />
              </div>
              <h6 className="fw-bold text-dark mb-0">Pond A1 Schedule Completed</h6>
            </div>
            <p className="text-secondary small mb-0" style={{ lineHeight: 1.6, fontSize: '0.82rem' }}>
              Morning and afternoon feeding cycles for Pond A1 recorded 100% target compliance with zero residue on check trays.
            </p>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div
            className="asymmetric-card p-4 h-100"
            style={{ borderLeft: '4px solid #0284C7', background: '#FAFCFF' }}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <div
                className="rounded-circle p-2 d-flex align-items-center justify-content-center"
                style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284C7' }}
              >
                <FaInfoCircle size={15} />
              </div>
              <h6 className="fw-bold text-dark mb-0">Feed Inventory Buffer Alert</h6>
            </div>
            <p className="text-secondary small mb-0" style={{ lineHeight: 1.6, fontSize: '0.82rem' }}>
              High-protein Starter #2 warehouse reserve is sufficient for 6 operational days. Automatic reorder request generated for supplier batch.
            </p>
          </div>
        </div>
      </div>

      {/* 🌟 6. ADMIN LOG FEEDING MODAL */}
      {showLogModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.72)', zIndex: 1055 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl">
              <div
                className="modal-header p-4 border-0 text-white"
                style={{ background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)' }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle p-2.5 d-flex align-items-center justify-content-center bg-white text-primary shadow-sm"
                    style={{ width: 44, height: 44 }}
                  >
                    <FaUtensils size={18} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-extrabold text-white mb-0">Log Feeding Session</h5>
                    <span className="extra-small text-white-50">Admin Feeding Operations &amp; Rations Recording</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowLogModal(false)}
                  disabled={savingLog}
                />
              </div>

              <form onSubmit={handleSaveAdminLog}>
                <div className="modal-body p-4 bg-white">
                  <div className="row g-3">
                    {/* Pond Selection */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Pond Basin</label>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        value={adminLogForm.pond_id}
                        onChange={(e) => handleAdminFormPondChange(e.target.value)}
                        required
                      >
                        <option value="">Select Pond...</option>
                        {ponds.map((p) => {
                          const name = p.pond_name || p.name || `Pond #${p.id}`;
                          return <option key={p.id} value={p.id}>{name}</option>;
                        })}
                      </select>
                    </div>

                    {/* Date Selection */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Feeding Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-semibold"
                        value={adminLogForm.record_date}
                        onChange={(e) => handleAdminFormDateChange(e.target.value)}
                        required
                      />
                    </div>

                    {/* Culture Stage / DOC Info Badge */}
                    {adminLogForm.pond_id && (
                      <div className="col-12">
                        <div className="p-2.5 rounded-3 bg-light border d-flex align-items-center justify-content-between flex-wrap gap-2">
                          {(() => {
                            const pObj = ponds.find((p) => String(p.id) === String(adminLogForm.pond_id));
                            const doc = computeDoc(pObj?.stocking_date, adminLogForm.record_date);
                            const isGrowout = doc !== null ? (doc >= 20) : adminLogForm.product_code === 'Grower';
                            return (
                              <>
                                <div className="d-flex align-items-center gap-2">
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 fw-bold extra-small"
                                    style={{
                                      background: isGrowout ? '#EFF6FF' : '#ECFDF5',
                                      color: isGrowout ? '#1D4ED8' : '#047857',
                                      border: isGrowout ? '1px solid #BFDBFE' : '1px solid #A7F3D0'
                                    }}
                                  >
                                    {isGrowout ? `🌊 DOC Day ${doc || 20}+ • Grow-out Stage` : `🌱 DOC Day ${doc || 1} • Nursery Stage`}
                                  </span>
                                  <span className="extra-small text-muted">
                                    Recommended: <strong>{isGrowout ? 'Grower Feed' : 'Starter Feed'}</strong>
                                  </span>
                                </div>
                                <span className="extra-small text-secondary">
                                  Target: <strong>{Number(pObj?.target_feed_kg || 45).toFixed(1)} kg/day</strong>
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Feeding Slot Buttons */}
                    <div className="col-12">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Feeding Time Slot &amp; Daily Schedule
                        <span className="text-muted ms-1 extra-small fw-normal">(Trays monitored after 6:00 AM)</span>
                      </label>
                      <div className="d-flex flex-wrap gap-2">
                        {['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'].map((t) => {
                          const isSelected = adminLogForm.feeding_time === t;
                          const logged = records.find(
                            (r) =>
                              String(r.pond_id) === String(adminLogForm.pond_id) &&
                              formatYMD(r.record_date || r.created_at) === adminLogForm.record_date &&
                              String(r.feeding_time || '').trim().toUpperCase().replace(/^0(\d:)/, '$1') === t.toUpperCase()
                          );
                          return (
                            <button
                              key={t}
                              type="button"
                              className={`btn btn-sm rounded-pill px-3 py-1.5 extra-small fw-bold transition-all d-flex align-items-center gap-1.5 ${
                                isSelected
                                  ? 'btn-primary shadow-sm text-white'
                                  : logged
                                    ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                                    : 'bg-light text-dark border'
                              }`}
                              onClick={() => handleAdminSlotChange(t)}
                            >
                              {logged ? <FaCheckCircle size={10} className="text-success" /> : <FaClock size={10} />}
                              <span>{t}</span>
                              {logged && <span className="badge bg-success text-white extra-small ms-1">{logged.amount_kg}kg</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Amount in grams & kg */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Feed Amount (grams)
                        {adminLogForm.amount_grams !== '' && !isNaN(parseFloat(adminLogForm.amount_grams)) && (
                          <span className="text-success ms-1 fw-bold">
                            ≈ {(parseFloat(adminLogForm.amount_grams) / 1000).toFixed(1)} kg
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control form-control-sm fw-bold"
                        placeholder="e.g. 13000 (13 kg)"
                        value={adminLogForm.amount_grams}
                        onChange={(e) => {
                          const gVal = e.target.value;
                          const kgVal = gVal === '' ? '' : (parseFloat(gVal) / 1000).toString();
                          setAdminLogForm({ ...adminLogForm, amount_grams: gVal, amount_kg: kgVal });
                        }}
                        required
                      />
                      <small className="extra-small text-muted mt-1 d-block">
                        Auto-adjusted based on 4-tray monitoring inspection.
                      </small>
                    </div>

                    {/* Product Code */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Feed Formulation</label>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        value={adminLogForm.product_code}
                        onChange={(e) => setAdminLogForm({ ...adminLogForm, product_code: e.target.value })}
                      >
                        <option value="Starter">Starter (Tateh Feed - Nursery)</option>
                        <option value="Grower">Grower (Tateh Feed - Grow-out)</option>
                      </select>
                    </div>

                    {/* Vitamins & Supplements */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Vitamins &amp; Supplements</label>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        value={adminLogForm.vitamin_name}
                        onChange={(e) => setAdminLogForm({ ...adminLogForm, vitamin_name: e.target.value })}
                      >
                        <option value="Sanolife PRO-2, Sano Top-S">Sanolife PRO-2, Sano Top-S (Both Consumed • Standard)</option>
                        <option value="Sanolife PRO-2">Sanolife PRO-2</option>
                        <option value="Sano Top-S">Sano Top-S</option>
                        <option value="None">None (No Vitamin)</option>
                      </select>
                      <small className="extra-small text-muted mt-1 d-block">
                        Both vitamins are pre-selected by default.
                      </small>
                    </div>

                    {/* Tray Monitoring Status Display */}
                    {adminLogForm.tray_monitoring_status && (
                      <div className="col-12">
                        <div className="p-2.5 rounded-3 bg-light border d-flex align-items-center gap-2">
                          <span className="badge rounded-pill bg-primary px-2.5 py-1 extra-small">Tray Status</span>
                          <span className="extra-small fw-bold text-dark">{adminLogForm.tray_monitoring_status}</span>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="col-12">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Notes / Remarks (Optional)</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        placeholder="e.g. Session supervised by Admin"
                        value={adminLogForm.notes}
                        onChange={(e) => setAdminLogForm({ ...adminLogForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer p-3 bg-light border-top d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary rounded-pill px-3.5 py-1.5 extra-small fw-bold"
                    onClick={() => setShowLogModal(false)}
                    disabled={savingLog}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm rounded-pill px-4 py-1.5 extra-small fw-bold text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', border: 'none' }}
                    disabled={savingLog}
                  >
                    {savingLog ? 'Saving...' : 'Save Feeding Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 POND CULTURE CYCLE CALENDAR MODAL (ADMIN) */}
      {calendarModalPond && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.72)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl">
              <PondCycleCalendar
                stockingDate={calendarModalPond.stocking_date}
                selectedDate={effectiveFilterDate}
                pondName={calendarModalPond.pond_name || `Pond #${calendarModalPond.id}`}
                records={records.filter(r => String(r.pond_id) === String(calendarModalPond.id))}
                onSelectDate={(dateStr) => {
                  setDateFilter('custom');
                  setCustomDate(dateStr);
                  setCalendarModalPond(null);
                }}
                onClose={() => setCalendarModalPond(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
