import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
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
  Filler
} from 'chart.js';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';
import {
  FaUtensils,
  FaWater,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaClock,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaStethoscope,
  FaCamera,
  FaSeedling,
  FaSync,
  FaLock,
  FaShieldAlt,
  FaChevronRight,
  FaFileAlt,
  FaHistory,
  FaChartLine,
  FaChartBar
} from 'react-icons/fa';
import WaterQualityOcrModal from '../../components/WaterQualityOcrModal';
import WaterQualityHistoryModal from '../../components/WaterQualityHistoryModal';

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

const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

const normalizeFeedingTime = (value = '') => String(value).trim().replace(/^0(\d:)/, '$1').toUpperCase();

export const getLocalDateString = (d = new Date()) => {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = parseLocalDate(stockingDateStr);
  const t = targetDateStr ? parseLocalDate(targetDateStr) : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 ? diffDays : null;
}

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

export default function CaretakerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedPonds, setAssignedPonds] = useState(
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : [])
  );

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [records, setRecords] = useState([]);
  const [diseaseScans, setDiseaseScans] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [waterQualityChecklist, setWaterQualityChecklist] = useState({
    total_assigned: 0,
    verified_count: 0,
    is_all_completed: false,
    checklist: [],
  });
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrTargetPondId, setOcrTargetPondId] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTargetPond, setHistoryTargetPond] = useState(null);
  const [editingWqRecord, setEditingWqRecord] = useState(null);
  const [ocrTargetDate, setOcrTargetDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [selectedDiseasePondFilter, setSelectedDiseasePondFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortOption, setSortOption] = useState('latest');

  // Chart control states
  const [chartRange, setChartRange] = useState('7days'); // '7days' | '14days' | 'todaySlots'
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'
  const [chartUnit, setChartUnit] = useState('auto'); // 'auto' | 'kg' | 'g'
  const [chartPondFilter, setChartPondFilter] = useState('all');

  // Sync chart pond filter with main pond filter if changed
  useEffect(() => {
    setChartPondFilter(selectedPondFilter);
  }, [selectedPondFilter]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [feedRes, diseaseRes, alertsRes, wqRes, pondsRes] = await Promise.allSettled([
        api.get('/feeding_records.php', {
          params: {
            user_id: user?.id || 0,
            recorded_by_name: user?.full_name || '',
          },
        }),
        api.get('/disease_reports.php', {
          params: {
            user_id: user?.id || 0,
            caretaker_name: user?.full_name || '',
          },
        }),
        api.get('/alerts.php'),
        api.get('/water_quality_records.php', {
          params: {
            caretaker_id: user?.id || 0,
          },
        }),
        api.get('/caretaker_ponds.php', {
          params: {
            user_id: user?.id || 0,
          },
        }),
      ]);

      if (feedRes.status === 'fulfilled') {
        const recs = safeArray(feedRes.value.data);
        setRecords(recs);
        // User Rule: Always remain on today's real date by default (never auto-jump to older date)
      }
      if (diseaseRes.status === 'fulfilled') setDiseaseScans(safeArray(diseaseRes.value.data));
      if (alertsRes.status === 'fulfilled') setAlerts(safeArray(alertsRes.value.data));
      if (wqRes.status === 'fulfilled' && wqRes.value.data?.success) {
        setWaterQualityChecklist(wqRes.value.data);
      }
      if (pondsRes.status === 'fulfilled' && pondsRes.value.data?.success && Array.isArray(pondsRes.value.data.ponds) && pondsRes.value.data.ponds.length > 0) {
        setAssignedPonds(pondsRes.value.data.ponds);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.full_name]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('shrim-water-quality-updated', handleUpdate);
    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('shrim-water-quality-updated', handleUpdate);
    };
  }, [loadData]);

  const availableDates = useMemo(() => {
    const dateMap = new Map();
    records.forEach((r) => {
      const d = (r.record_date || r.created_at || '').slice(0, 10);
      if (!d) return;
      const existing = dateMap.get(d) || {
        date: d,
        count: 0,
        totalKg: 0,
        stockingDate: r.stocking_date || assignedPonds[0]?.stocking_date || '2026-08-10'
      };
      existing.count += 1;
      existing.totalKg += parseFloat(r.amount_kg) || 0;
      dateMap.set(d, existing);
    });
    return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, assignedPonds]);

  const selectedDateRecords = records.filter((r) => (r.record_date || r.created_at || '').slice(0, 10) === selectedDate);
  const todayRecords = selectedDateRecords;
  const filteredTodayRecords = selectedDateRecords.filter((r) => {
    if (selectedPondFilter === 'all') return true;
    return String(r.pond_id) === String(selectedPondFilter);
  });

  const searchedTodayRecords = filteredTodayRecords.filter((r) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      (r.feeding_time || '').toLowerCase().includes(term) ||
      (r.pond_name || '').toLowerCase().includes(term) ||
      (r.feed_type || r.product_code || '').toLowerCase().includes(term) ||
      (r.vitamin_name || '').toLowerCase().includes(term)
    );
  });

  const sortedSearchedTodayRecords = [...searchedTodayRecords].sort((a, b) => {
    if (sortOption === 'oldest') {
      return (a.id || 0) - (b.id || 0);
    }
    if (sortOption === 'amount-high') {
      return (parseFloat(b.amount_kg) || 0) - (parseFloat(a.amount_kg) || 0);
    }
    if (sortOption === 'amount-low') {
      return (parseFloat(a.amount_kg) || 0) - (parseFloat(b.amount_kg) || 0);
    }
    if (sortOption === 'pond') {
      return (a.pond_name || '').localeCompare(b.pond_name || '');
    }
    return (b.id || 0) - (a.id || 0);
  });

  const totalAmountToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  const totalGramsToday = filteredTodayRecords.reduce((sum, r) => sum + (parseFloat(r.amount_grams) || ((parseFloat(r.amount_kg) || 0) * 1000) || 0), 0);
  const selectedPondObj = assignedPonds.find((p) => String(p.id) === String(selectedPondFilter));
  const loggedFeedingSlots = new Set(filteredTodayRecords.map((r) => normalizeFeedingTime(r.feeding_time)).filter(Boolean));
  const completedFeedingSlots = feedingTimes.filter((time) => loggedFeedingSlots.has(normalizeFeedingTime(time))).length;
  const feedingCompletion = Math.round((completedFeedingSlots / feedingTimes.length) * 100);
  const currentScope = selectedPondFilter === 'all' ? 'All assigned ponds' : selectedPondObj?.pond_name || 'Selected pond';
  const filteredDiseaseScans = diseaseScans.filter((scan) => {
    if (selectedDiseasePondFilter === 'all') return true;
    return String(scan.pond_name || '').trim().toLowerCase() === String(selectedDiseasePondFilter).trim().toLowerCase();
  });
  const latestDisease = filteredDiseaseScans[0];
  const latestAlert = alerts[0];

  // 🌟 FEEDING CONSUMPTION CHART DATA & TELEMETRY
  const chartData = useMemo(() => {
    // 1. Hourly Slots for Selected Date Mode
    if (chartRange === 'todaySlots') {
      const slots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
      const slotGrams = slots.map((time) => {
        const matching = records.filter((r) => {
          const rDate = (r.record_date || r.created_at || '').slice(0, 10);
          const matchesDate = rDate === selectedDate;
          const matchesTime = normalizeFeedingTime(r.feeding_time) === normalizeFeedingTime(time);
          const matchesPond = chartPondFilter === 'all'
            ? assignedPonds.some((p) => String(p.id) === String(r.pond_id))
            : String(r.pond_id) === String(chartPondFilter);
          return matchesDate && matchesTime && matchesPond;
        });
        return matching.reduce((sum, r) => {
          const grams = (r.amount_grams != null && Number(r.amount_grams) > 0)
            ? Number(r.amount_grams)
            : ((parseFloat(r.amount_kg) || 0) * 1000);
          return sum + grams;
        }, 0);
      });

      const totalGrams = slotGrams.reduce((a, b) => a + b, 0);
      const totalKg = totalGrams / 1000;
      const peakGrams = Math.max(0, ...slotGrams);
      const peakIndex = slotGrams.indexOf(peakGrams);
      const peakLabel = peakGrams > 0 ? slots[peakIndex] : 'None';
      const peakKg = peakGrams / 1000;

      const useGrams = chartUnit === 'g' || (chartUnit === 'auto' && totalKg < 1.0);
      const displayData = useGrams
        ? slotGrams.map((g) => Math.round(g * 10) / 10)
        : slotGrams.map((g) => Number((g / 1000).toFixed(3)));

      return {
        labels: slots,
        unit: useGrams ? 'g' : 'kg',
        datasets: [
          {
            label: chartPondFilter === 'all'
              ? 'All Assigned Basins'
              : (assignedPonds.find((p) => String(p.id) === String(chartPondFilter))?.pond_name || 'Selected Basin'),
            data: displayData,
            borderColor: '#0B2C5F',
            backgroundColor: chartType === 'bar' ? '#0B2C5F' : 'rgba(11, 44, 95, 0.08)',
            pointBackgroundColor: '#EA580C',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            tension: 0.35,
            fill: chartType === 'line',
          },
        ],
        totalKg,
        totalGrams,
        avgDailyKg: totalKg,
        avgDailyGrams: totalGrams,
        peakLabel,
        peakKg,
        peakGrams,
        dataPointsCount: slotGrams.filter((v) => v > 0).length,
      };
    }

    // 2. Multi-Day Range Mode (7 or 14 Days)
    const daysCount = chartRange === '14days' ? 14 : 7;
    const dateList = [];
    const validBase = parseLocalDate(selectedDate || todayStr);

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(validBase.getFullYear(), validBase.getMonth(), validBase.getDate() - i);
      dateList.push(getLocalDateString(d));
    }

    const labels = dateList.map((dStr) => {
      const dObj = parseLocalDate(dStr);
      return dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const dailyGrams = dateList.map((dStr) => {
      const matching = records.filter((r) => {
        const rDate = (r.record_date || r.created_at || '').slice(0, 10);
        const matchesDate = rDate === dStr;
        const matchesPond = chartPondFilter === 'all'
          ? assignedPonds.some((p) => String(p.id) === String(r.pond_id))
          : String(r.pond_id) === String(chartPondFilter);
        return matchesDate && matchesPond;
      });
      return matching.reduce((sum, r) => {
        const grams = (r.amount_grams != null && Number(r.amount_grams) > 0)
          ? Number(r.amount_grams)
          : ((parseFloat(r.amount_kg) || 0) * 1000);
        return sum + grams;
      }, 0);
    });

    const totalGrams = dailyGrams.reduce((a, b) => a + b, 0);
    const totalKg = totalGrams / 1000;
    const nonZeroDays = dailyGrams.filter((v) => v > 0).length;
    const avgDailyGrams = daysCount > 0 ? totalGrams / daysCount : 0;
    const avgDailyKg = avgDailyGrams / 1000;
    const peakGrams = Math.max(0, ...dailyGrams);
    const peakIndex = dailyGrams.indexOf(peakGrams);
    const peakLabel = peakGrams > 0 ? labels[peakIndex] : 'None';
    const peakKg = peakGrams / 1000;

    const useGrams = chartUnit === 'g' || (chartUnit === 'auto' && peakKg < 1.5);
    const displayData = useGrams
      ? dailyGrams.map((g) => Math.round(g * 10) / 10)
      : dailyGrams.map((g) => Number((g / 1000).toFixed(3)));

    return {
      labels,
      unit: useGrams ? 'g' : 'kg',
      datasets: [
        {
          label: chartPondFilter === 'all'
            ? 'All Assigned Basins'
            : (assignedPonds.find((p) => String(p.id) === String(chartPondFilter))?.pond_name || 'Selected Basin'),
          data: displayData,
          borderColor: '#0B2C5F',
          backgroundColor: chartType === 'bar' ? '#0B2C5F' : 'rgba(11, 44, 95, 0.08)',
          pointBackgroundColor: '#EA580C',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.35,
          fill: chartType === 'line',
        },
      ],
      totalKg,
      totalGrams,
      avgDailyKg,
      avgDailyGrams,
      peakLabel,
      peakKg,
      peakGrams,
      dataPointsCount: nonZeroDays,
    };
  }, [chartRange, chartType, chartUnit, chartPondFilter, records, selectedDate, todayStr, assignedPonds]);

  const chartOptions = useMemo(() => {
    const isGrams = chartData.unit === 'g';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { family: "'Poppins', sans-serif", size: 12, weight: '600' },
            color: '#0B2C5F',
          },
        },
        tooltip: {
          backgroundColor: '#071733',
          titleColor: '#FFFFFF',
          bodyColor: '#FFFFFF',
          borderColor: 'rgba(234, 88, 12, 0.5)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          titleFont: { family: "'Poppins', sans-serif", weight: 'bold', size: 12 },
          bodyFont: { family: "'Poppins', sans-serif", size: 12 },
          callbacks: {
            label: (context) => {
              const rawVal = Number(context.parsed.y || 0);
              const grams = isGrams ? rawVal : rawVal * 1000;
              const kg = isGrams ? rawVal / 1000 : rawVal;
              return ` Feed: ${Math.round(grams).toLocaleString()} g (${kg.toFixed(3)} kg)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#64748B',
            font: { family: "'Poppins', sans-serif", size: 11, weight: '500' },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(11, 44, 95, 0.05)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748B',
            font: { family: "'Poppins', sans-serif", size: 11 },
            callback: (value) => isGrams ? `${value} g` : `${value} kg`,
          },
          title: {
            display: true,
            text: isGrams ? 'Feed Consumption (grams)' : 'Feed Consumption (kg)',
            color: '#0B2C5F',
            font: { family: "'Poppins', sans-serif", size: 11, weight: '600' },
          },
        },
      },
    };
  }, [chartData.unit]);

  return (
    <div className="caretaker-dashboard-hub">
      {/* 🌟 HERO CONTROL STRIP: TITLE & SLEEK PILL FILTERS */}
      <div className="d-flex justify-content-between align-items-center mb-4 mb-xl-5 flex-wrap gap-3">
        <div>
          <h2 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Field Operations Hub
          </h2>
          <span className="text-muted extra-small fw-medium">
            O&amp;B Aquafarm • Pond Caretaker Live Telemetry &amp; Daily Records
          </span>
        </div>

        {/* Compact Pill-Shaped Filter Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Pond Selector Pill */}
          <div
            className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-xs"
            style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
          >
            <FaWater style={{ color: '#0B2C5F', fontSize: '0.82rem' }} />
            <select
              className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 cursor-pointer"
              style={{ width: 'auto', minWidth: 155, fontSize: '0.82rem', outline: 'none', color: '#0B2C5F' }}
              value={selectedPondFilter}
              onChange={(e) => setSelectedPondFilter(e.target.value)}
            >
              <option value="all">All Assigned Ponds ({assignedPonds.length})</option>
              {assignedPonds.map((pond) => (
                <option key={pond.id} value={String(pond.id)}>
                  {pond.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Date Selector Pill */}
          <div
            className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill bg-white shadow-xs"
            style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
          >
            <FaCalendarAlt size={12} style={{ color: '#EA580C' }} />
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-transparent fw-semibold p-0"
              style={{ width: 115, fontSize: '0.82rem', outline: 'none', color: '#0B2C5F' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Select date to inspect feeding records & DOC"
            />
          </div>

          {/* Quick Return to Today Button */}
          {selectedDate !== todayStr && (
            <button
              type="button"
              className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs"
              style={{ height: 38, fontSize: '0.8rem' }}
              onClick={() => setSelectedDate(todayStr)}
              title="Return to today's real date"
            >
              Reset to Today
            </button>
          )}

          {/* DOC Presets Quick Jump Dropdown */}
          {availableDates.length > 0 && (
            <div
              className="d-none d-md-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
            >
              <span className="extra-small fw-bold text-uppercase tracking-wider" style={{ color: '#EA580C', fontSize: '0.68rem' }}>DOC:</span>
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 cursor-pointer"
                style={{ width: 'auto', minWidth: 150, fontSize: '0.8rem', outline: 'none', color: '#0B2C5F' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                title="Quick jump to Culture Day (DOC)"
              >
                <option value={todayStr}>Today ({todayStr})</option>
                {availableDates.map((item) => {
                  const pondObj = assignedPonds[0];
                  const sDate = item.stockingDate || pondObj?.stocking_date;
                  const doc = computeDoc(sDate, item.date);
                  const isNursery = doc !== null && doc <= 19;
                  const dateFormatted = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const stageBadge = doc ? (isNursery ? `DOC #${doc} Nur` : `DOC #${doc} Grow`) : item.date;
                  return (
                    <option key={item.date} value={item.date}>
                      {dateFormatted} • {stageBadge} ({item.totalKg.toFixed(1)} kg)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Sync Button */}
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3 py-1.5 shadow-xs"
            style={{ height: 38, fontSize: '0.8rem' }}
            onClick={loadData}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} style={{ color: '#0B2C5F' }} /> Sync
          </button>

          {/* Launch OCR Quick Action */}
          <button
            type="button"
            className="btn btn-sm btn-tri-orange px-3.5 py-1.5 shadow-xs"
            style={{ height: 38, fontSize: '0.8rem' }}
            onClick={() => {
              const firstUnverified = waterQualityChecklist.checklist?.find((p) => !p.is_verified_today);
              setOcrTargetPondId(
                firstUnverified
                  ? String(firstUnverified.pond_id)
                  : assignedPonds[0]?.id
                    ? String(assignedPonds[0].id)
                    : ''
              );
              setIsOcrModalOpen(true);
            }}
          >
            <FaCamera size={12} /> Scan Water Quality
          </button>
        </div>
      </div>

      {/* 🌟 DAILY WATER QUALITY VERIFICATION PROTOCOL CARD */}
      <div className="tri-card mb-4 mb-xl-5 overflow-hidden">
        <div
          className="p-3.5 p-md-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 text-white"
          style={{
            background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 65%, #0E3D7D 100%)',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
              style={{
                width: 44,
                height: 44,
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                color: '#FFFFFF',
                fontSize: '1.2rem',
              }}
            >
              {waterQualityChecklist.is_all_completed ? <FaCheckCircle style={{ color: '#EA580C' }} /> : <FaCamera />}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2.5 flex-wrap">
                <h6 className="fw-bold mb-0 text-white" style={{ fontSize: '1.02rem', letterSpacing: '-0.01em' }}>
                  Pre-Stocking Water Quality Verification
                </h6>
                <span
                  className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill"
                  style={{
                    background: 'rgba(255, 255, 255, 0.14)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#FFFFFF',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                  }}
                >
                  <span
                    className="rounded-circle"
                    style={{
                      width: 6,
                      height: 6,
                      backgroundColor: waterQualityChecklist.is_all_completed ? '#FFFFFF' : '#EA580C',
                    }}
                  />
                  {waterQualityChecklist.verified_count} / {assignedPonds.length} Ponds Verified (Baseline)
                </span>
              </div>
              <p className="text-white text-opacity-80 extra-small mb-0 mt-1" style={{ maxWidth: 640 }}>
                {waterQualityChecklist.is_all_completed
                  ? 'All assigned ponds have verified baseline water quality on record. Monitoring and feeding records are fully unlocked.'
                  : 'O&B Aqua Farm Protocol: Verify DO, Temp, pH, and Salinity via Dual-Mode OCR once before initiating pond monitoring and stocking.'}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 ms-md-auto flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-tri-orange px-3.5 py-2 shadow-xs"
              style={{ fontSize: '0.82rem' }}
              onClick={() => {
                const firstUnverified = waterQualityChecklist.checklist?.find((p) => !p.is_verified_today);
                setOcrTargetPondId(
                  firstUnverified
                    ? String(firstUnverified.pond_id)
                    : assignedPonds[0]?.id
                      ? String(assignedPonds[0].id)
                      : ''
                );
                setIsOcrModalOpen(true);
              }}
            >
              <FaCamera size={13} /> {waterQualityChecklist.is_all_completed ? 'Re-scan Readings' : 'Verify Readings (OCR)'}
            </button>
          </div>
        </div>

        {/* Assigned Ponds Checklist Strip - Spacious & Polished */}
        <div className="p-3.5 p-md-4 border-top" style={{ backgroundColor: '#F8FAFD' }}>
          <div className="row g-3 g-xl-3.5">
            {assignedPonds.map((pond) => {
              const checkItem = waterQualityChecklist.checklist?.find((c) => c.pond_id === pond.id);
              const isVerified = Boolean(checkItem?.is_verified_today);
              const readings = checkItem?.latest_readings;

              return (
                <div key={pond.id} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="p-3.5 rounded-4 bg-white border d-flex flex-column justify-content-between h-100 transition-all hover-shadow"
                    style={{
                      borderLeft: isVerified ? '4px solid #0B2C5F' : '4px solid #EA580C',
                      borderColor: 'rgba(11, 44, 95, 0.09)',
                      boxShadow: '0 2px 12px rgba(11, 44, 95, 0.04)',
                      minHeight: 215,
                    }}
                  >
                    <div>
                      {/* Tier 1: Pond Name & Status Badge */}
                      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{
                              width: 32,
                              height: 32,
                              backgroundColor: isVerified ? 'rgba(11, 44, 95, 0.07)' : '#FFF7ED',
                              color: isVerified ? '#0B2C5F' : '#EA580C',
                              fontSize: '0.82rem',
                            }}
                          >
                            <FaWater />
                          </div>
                          <div>
                            <strong className="d-block" style={{ color: '#0B2C5F', fontSize: '0.95rem', lineHeight: 1.2 }}>
                              {pond.pond_name}
                            </strong>
                            <span className="text-muted extra-small">Production Basin</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        {isVerified ? (
                          <span
                            className="d-inline-flex align-items-center gap-1 px-2.5 py-1 rounded-pill"
                            style={{
                              backgroundColor: 'rgba(11, 44, 95, 0.07)',
                              border: '1px solid rgba(11, 44, 95, 0.18)',
                              color: '#0B2C5F',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <FaCheckCircle size={9} style={{ color: '#0B2C5F' }} />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span
                            className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill"
                            style={{
                              backgroundColor: '#FFF7ED',
                              border: '1px solid rgba(234, 88, 12, 0.28)',
                              color: '#EA580C',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span
                              className="rounded-circle"
                              style={{ width: 6, height: 6, backgroundColor: '#EA580C' }}
                            />
                            <span>Needs Test</span>
                          </span>
                        )}
                      </div>

                      {/* Tier 2: Culture Stage / DOC Pill */}
                      {pond.stocking_date && (() => {
                        const doc = computeDoc(pond.stocking_date, selectedDate);
                        if (!doc) return null;
                        const isNursery = doc >= 1 && doc <= 19;
                        return (
                          <div className="mb-2.5">
                            <span
                              className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                              style={{
                                backgroundColor: isNursery ? 'rgba(11, 44, 95, 0.06)' : '#FFF7ED',
                                color: isNursery ? '#0B2C5F' : '#EA580C',
                                border: isNursery ? '1px solid rgba(11, 44, 95, 0.14)' : '1px solid rgba(234, 88, 12, 0.22)',
                                fontSize: '0.7rem',
                              }}
                            >
                              {isNursery ? `Day ${doc} Nursery (DOC #${doc})` : `Day ${doc} Grow-out (DOC #${doc})`}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Tier 3: Telemetry Cluster Strip */}
                      <div
                        className="p-2.5 rounded-3 mb-3"
                        style={{
                          backgroundColor: isVerified ? '#F8FAFD' : '#FFFBF5',
                          border: isVerified ? '1px solid rgba(11, 44, 95, 0.07)' : '1px dashed rgba(234, 88, 12, 0.28)',
                        }}
                      >
                        {isVerified ? (
                          <div className="d-flex align-items-center justify-content-around text-center">
                            <div>
                              <span className="text-muted extra-small d-block" style={{ fontSize: '0.68rem' }}>DO</span>
                              <strong style={{ color: '#0B2C5F', fontSize: '0.86rem' }}>{readings?.dissolved_oxygen ?? '—'}</strong>
                              <small className="text-muted" style={{ fontSize: '0.62rem' }}> mg/L</small>
                            </div>
                            <div style={{ width: 1, height: 22, backgroundColor: 'rgba(11, 44, 95, 0.1)' }} />
                            <div>
                              <span className="text-muted extra-small d-block" style={{ fontSize: '0.68rem' }}>Temp</span>
                              <strong style={{ color: '#0B2C5F', fontSize: '0.86rem' }}>{readings?.temperature ?? '—'}</strong>
                              <small className="text-muted" style={{ fontSize: '0.62rem' }}> °C</small>
                            </div>
                            <div style={{ width: 1, height: 22, backgroundColor: 'rgba(11, 44, 95, 0.1)' }} />
                            <div>
                              <span className="text-muted extra-small d-block" style={{ fontSize: '0.68rem' }}>pH</span>
                              <strong style={{ color: '#0B2C5F', fontSize: '0.86rem' }}>{readings?.ph_level ?? '—'}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center gap-2 extra-small py-0.5 px-1">
                            <FaLock size={11} style={{ color: '#EA580C', flexShrink: 0 }} />
                            <span style={{ color: '#EA580C', fontWeight: 500, fontSize: '0.74rem' }}>
                              Pre-stocking OCR scan required before monitoring
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tier 4: Action Buttons Footer */}
                    <div className="d-flex align-items-center justify-content-between gap-2 pt-2.5 border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.07)' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-tri-outline px-3 py-1.5 extra-small shadow-xs"
                        style={{ fontSize: '0.74rem' }}
                        onClick={() => {
                          setHistoryTargetPond(pond);
                          setIsHistoryModalOpen(true);
                        }}
                        title="View Water Quality Log History and past date records"
                      >
                        <FaHistory size={10} style={{ color: '#0B2C5F' }} />
                        <span>History</span>
                      </button>

                      {!isVerified ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-tri-orange px-3.5 py-1.5 extra-small shadow-xs"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => {
                            setEditingWqRecord(null);
                            setOcrTargetPondId(String(pond.id));
                            setOcrTargetDate(todayStr);
                            setIsOcrModalOpen(true);
                          }}
                        >
                          <FaCamera size={11} />
                          <span>Scan Readings</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-tri-navy px-3.5 py-1.5 extra-small shadow-xs"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => {
                            setEditingWqRecord(checkItem?.today_record || null);
                            setOcrTargetPondId(String(pond.id));
                            setOcrTargetDate(todayStr);
                            setIsOcrModalOpen(true);
                          }}
                          title="Re-scan / Update Today's Readings"
                        >
                          <FaSync size={10} />
                          <span>Re-test (OCR)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🌟 OPERATIONAL PERFORMANCE & 4 TELEMETRY CARDS */}
      <div className="mb-4 mb-xl-5">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2.5">
            <span
              className="badge rounded-pill px-3 py-1.5 fw-bold text-white extra-small shadow-xs"
              style={{ background: '#0B2C5F', letterSpacing: '0.06em' }}
            >
              OPERATIONS
            </span>
            <div>
              <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
                Operational Telemetry &amp; Performance
              </h5>
              <span className="text-muted extra-small">Daily Field Operations, Feeding Adherence &amp; Water Telemetry Benchmarks</span>
            </div>
          </div>
          <span className="badge bg-white rounded-pill px-3 py-1.5 extra-small shadow-xs" style={{ color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
            ● Daily Field Benchmarks
          </span>
        </div>

        <div className="row g-3 g-xl-4">
          {/* Card 1: Assigned Ponds */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Assigned Ponds</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaWater size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {assignedPonds.length}
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div className="tri-progress-bar" style={{ width: '100%', background: '#0B2C5F' }} />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small text-truncate" style={{ maxWidth: 130 }}>
                    {selectedPondFilter === 'all' ? 'All basins active' : `Focused: ${selectedPondObj?.pond_name || 'Active'}`}
                  </span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Feeding Logs */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Today's Logs</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaUtensils size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {filteredTodayRecords.length}
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.min(100, Math.max(10, (filteredTodayRecords.length / Math.max(1, assignedPonds.length * 4)) * 100))}%`,
                      background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                    {currentScope}
                  </span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                    Logged
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Total Feed */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185, borderColor: 'rgba(234, 88, 12, 0.15)' }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">
                    Total Feed ({selectedDate === todayStr ? 'Today' : selectedDate})
                  </span>
                  <div className="tri-kpi-icon tri-kpi-icon-orange">
                    <FaCheckCircle size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {totalAmountToday.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
                </h2>
                <div className="extra-small text-muted fw-semibold">
                  Total grams: <strong className="font-mono" style={{ color: '#0B2C5F' }}>{Math.round(totalGramsToday).toLocaleString()} g</strong>
                </div>
              </div>
              <div>
                <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.min(100, Math.max(12, (totalAmountToday / Math.max(1, assignedPonds.length * 35)) * 100))}%`,
                      background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small">Distributed across 5 slots</span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                    5 Feedings
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Feeding Schedule Progress */}
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="tri-kpi-card" style={{ minHeight: 185 }}>
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feeding Schedule</span>
                  <div className="tri-kpi-icon tri-kpi-icon-blue">
                    <FaClock size={17} />
                  </div>
                </div>
                <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                  {feedingCompletion}%
                </h2>
              </div>
              <div>
                <div className="tri-progress-track my-2.5">
                  <div
                    className="tri-progress-bar"
                    style={{
                      width: `${Math.max(5, feedingCompletion)}%`,
                      background: 'linear-gradient(90deg, #0B2C5F 0%, #EA580C 100%)',
                    }}
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <span className="text-muted extra-small font-mono fw-semibold">{completedFeedingSlots}/5 Slots Logged</span>
                  <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                    {feedingCompletion === 100 ? 'Complete' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ASSIGNED PONDS LIVE OVERVIEW & QUICK ACTION HUB */}
      <div className="tri-card p-4 p-md-4.5 mb-4 mb-xl-5">
        <div className="d-flex align-items-center justify-content-between mb-3.5 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
              Assigned Ponds Live Overview &amp; Quick Actions
            </h5>
            <small className="text-muted">Instant pond status monitoring and one-touch caretaker actions</small>
          </div>
          <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
            {assignedPonds.length} Active Basins
          </span>
        </div>

        <div className="row g-3 g-xl-3.5">
          {assignedPonds.map((pond) => {
            const pondLogs = todayRecords.filter((r) => String(r.pond_id) === String(pond.id));
            const pondSlots = new Set(pondLogs.map((r) => normalizeFeedingTime(r.feeding_time)).filter(Boolean));
            const pondCompletedCount = feedingTimes.filter((time) => pondSlots.has(normalizeFeedingTime(time))).length;
            const pondPct = Math.round((pondCompletedCount / feedingTimes.length) * 100);

            return (
              <div key={pond.id} className="col-12 col-md-6 col-xl-4">
                <div
                  className="card shadow-xs rounded-4 p-3.5 p-md-4 h-100 d-flex flex-column justify-content-between transition-all hover-shadow overflow-hidden bg-white"
                  style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: 38, height: 38, background: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}
                        >
                          <FaWater size={16} />
                        </div>
                        <div>
                          <h6 className="fw-bold mb-0 fs-6" style={{ color: '#0B2C5F' }}>{pond.pond_name}</h6>
                          <div className="d-flex align-items-center gap-1.5 flex-wrap extra-small text-muted">
                            <span>Production Basin</span>
                            {pond.stocking_date && (() => {
                              const doc = computeDoc(pond.stocking_date, selectedDate);
                              return doc ? <span>• <strong style={{ color: '#EA580C' }}>DOC #{doc}</strong></span> : null;
                            })()}
                          </div>
                        </div>
                      </div>
                      <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.14)' }}>
                        ● Nominal
                      </span>
                    </div>

                    <div className="my-2 py-1">
                      <div className="d-flex align-items-center justify-content-between extra-small text-muted mb-1.5">
                        <span className="fw-semibold">Today's Feeding Progress</span>
                        <span className="fw-bold font-mono" style={{ color: '#0B2C5F' }}>{pondCompletedCount}/5 ({pondPct}%)</span>
                      </div>
                      <div className="progress rounded-pill" style={{ height: 7, backgroundColor: 'rgba(11, 44, 95, 0.06)' }}>
                        <div
                          className="progress-bar rounded-pill"
                          role="progressbar"
                          style={{
                            width: `${pondPct}%`,
                            background: 'linear-gradient(90deg, #0B2C5F 0%, #EA580C 100%)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Guaranteed 3-Column Single-Row Buttons (50% / 25% / 25%) */}
                  <div className="row g-2 mt-3 pt-3 border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.07)' }}>
                    <div className="col-6">
                      <button
                        type="button"
                        className="btn btn-sm btn-tri-navy w-100 py-1.5 extra-small shadow-xs text-nowrap"
                        style={{ fontSize: '0.74rem' }}
                        onClick={() => navigate('/caretaker/my-pond')}
                      >
                        <FaPlus size={9} /> Log Feed
                      </button>
                    </div>
                    <div className="col-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-tri-outline w-100 py-1.5 extra-small shadow-xs text-nowrap"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => navigate('/caretaker/disease-scan')}
                        title="AI Disease Scan"
                      >
                        <FaStethoscope size={10} style={{ color: '#0B2C5F' }} /> Scan
                      </button>
                    </div>
                    <div className="col-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-tri-outline-orange w-100 py-1.5 extra-small shadow-xs text-nowrap"
                        style={{ fontSize: '0.72rem' }}
                        onClick={() => navigate('/caretaker/reports')}
                        title="Report Pond Concern"
                      >
                        <FaExclamationTriangle size={10} style={{ color: '#EA580C' }} /> Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 POND FEEDING CONSUMPTION ANALYTICS */}
      <div className="tri-card p-4 p-md-4.5 mb-4 mb-xl-5">
        <div className="d-flex align-items-center justify-content-between mb-3.5 flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center shadow-xs"
                style={{ width: 36, height: 36, backgroundColor: '#0B2C5F', color: '#FFFFFF' }}
              >
                <FaChartLine size={16} />
              </div>
              <div>
                <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  Pond Feeding Consumption Analytics
                </h5>
                <small className="text-muted">
                  Feed intake distribution for assigned ponds • Real-time telemetry
                </small>
              </div>
            </div>
          </div>

          {/* Controls: Pond Select, Range Toggles, Line/Bar Toggle */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Pond Selector */}
            {assignedPonds.length > 1 && (
              <div
                className="d-flex align-items-center px-2.5 py-1 rounded-pill bg-white shadow-xs"
                style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 34 }}
              >
                <select
                  className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 cursor-pointer"
                  style={{ width: 'auto', minWidth: 120, fontSize: '0.78rem', outline: 'none', color: '#0B2C5F' }}
                  value={chartPondFilter}
                  onChange={(e) => setChartPondFilter(e.target.value)}
                >
                  <option value="all">All Assigned Ponds</option>
                  {assignedPonds.map((p) => (
                    <option key={p.id} value={p.id}>{p.pond_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Range Toggle Pills */}
            <div
              className="d-inline-flex p-1 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 34 }}
            >
              <button
                type="button"
                className="btn btn-sm py-0 px-2.5 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartRange === 'todaySlots' ? '#0B2C5F' : 'transparent',
                  color: chartRange === 'todaySlots' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.74rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartRange('todaySlots')}
              >
                Hourly Slots
              </button>
              <button
                type="button"
                className="btn btn-sm py-0 px-2.5 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartRange === '7days' ? '#0B2C5F' : 'transparent',
                  color: chartRange === '7days' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.74rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartRange('7days')}
              >
                Past 7 Days
              </button>
              <button
                type="button"
                className="btn btn-sm py-0 px-2.5 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartRange === '14days' ? '#0B2C5F' : 'transparent',
                  color: chartRange === '14days' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.74rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartRange('14days')}
              >
                Past 14 Days
              </button>
            </div>

            {/* Unit Toggle (Auto / kg / g) */}
            <div
              className="d-inline-flex p-1 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 34 }}
            >
              <button
                type="button"
                className="btn btn-sm py-0 px-2 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartUnit === 'auto' ? '#0B2C5F' : 'transparent',
                  color: chartUnit === 'auto' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.72rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartUnit('auto')}
                title="Automatic unit based on intake scale"
              >
                Auto ({chartData.unit})
              </button>
              <button
                type="button"
                className="btn btn-sm py-0 px-2 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartUnit === 'g' ? '#0B2C5F' : 'transparent',
                  color: chartUnit === 'g' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.72rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartUnit('g')}
                title="Display in grams (g)"
              >
                g
              </button>
              <button
                type="button"
                className="btn btn-sm py-0 px-2 rounded-pill border-0 extra-small fw-semibold transition-all"
                style={{
                  backgroundColor: chartUnit === 'kg' ? '#0B2C5F' : 'transparent',
                  color: chartUnit === 'kg' ? '#FFFFFF' : '#64748B',
                  fontSize: '0.72rem',
                  lineHeight: '24px',
                }}
                onClick={() => setChartUnit('kg')}
                title="Display in kilograms (kg)"
              >
                kg
              </button>
            </div>

            {/* Chart Type Toggle (Line / Bar) */}
            <div
              className="d-inline-flex p-1 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 34 }}
            >
              <button
                type="button"
                className="btn btn-sm py-0 px-2 rounded-pill border-0 transition-all"
                style={{
                  backgroundColor: chartType === 'line' ? '#EA580C' : 'transparent',
                  color: chartType === 'line' ? '#FFFFFF' : '#64748B',
                  lineHeight: '24px',
                }}
                onClick={() => setChartType('line')}
                title="Line Trend"
              >
                <FaChartLine size={13} />
              </button>
              <button
                type="button"
                className="btn btn-sm py-0 px-2 rounded-pill border-0 transition-all"
                style={{
                  backgroundColor: chartType === 'bar' ? '#EA580C' : 'transparent',
                  color: chartType === 'bar' ? '#FFFFFF' : '#64748B',
                  lineHeight: '24px',
                }}
                onClick={() => setChartType('bar')}
                title="Bar Chart"
              >
                <FaChartBar size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* 4 Summary Badges Row */}
        <div className="row g-2.5 mb-3.5">
          <div className="col-6 col-md-3">
            <div className="p-2.5 rounded-3 bg-white" style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}>
              <div className="text-muted extra-small fw-medium">Total Consumption</div>
              <div className="d-flex align-items-baseline gap-1 mt-0.5">
                <span className="fw-bold" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  {chartData.totalKg < 1 && chartData.totalGrams > 0
                    ? `${Math.round(chartData.totalGrams).toLocaleString()} g`
                    : `${chartData.totalKg.toFixed(2)} kg`}
                </span>
                <span className="extra-small ms-auto fw-semibold" style={{ color: '#EA580C' }}>
                  {chartData.totalKg < 1 && chartData.totalGrams > 0
                    ? `(${chartData.totalKg.toFixed(3)} kg)`
                    : `(${Math.round(chartData.totalGrams).toLocaleString()} g)`}
                </span>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 rounded-3 bg-white" style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}>
              <div className="text-muted extra-small fw-medium">
                {chartRange === 'todaySlots' ? 'Day Total' : 'Daily Average'}
              </div>
              <div className="d-flex align-items-baseline gap-1 mt-0.5">
                <span className="fw-bold" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  {chartData.avgDailyKg < 1 && chartData.avgDailyGrams > 0
                    ? `${Math.round(chartData.avgDailyGrams).toLocaleString()} g/day`
                    : `${chartData.avgDailyKg.toFixed(2)} kg/day`}
                </span>
                <span className="extra-small text-muted ms-auto">
                  {chartData.avgDailyKg < 1 && chartData.avgDailyGrams > 0
                    ? `(${chartData.avgDailyKg.toFixed(3)} kg)`
                    : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 rounded-3 bg-white" style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}>
              <div className="text-muted extra-small fw-medium">Peak Intake</div>
              <div className="d-flex align-items-baseline gap-1 mt-0.5">
                <span className="fw-bold" style={{ color: '#EA580C', fontSize: '1.15rem' }}>
                  {chartData.peakKg < 1 && chartData.peakGrams > 0
                    ? `${Math.round(chartData.peakGrams)} g`
                    : `${chartData.peakKg.toFixed(2)} kg`}
                </span>
                <span className="extra-small text-muted ms-auto text-truncate" style={{ maxWidth: 85 }} title={chartData.peakLabel}>
                  {chartData.peakLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-2.5 rounded-3 bg-white" style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}>
              <div className="text-muted extra-small fw-medium">Active Basins Filter</div>
              <div className="d-flex align-items-baseline gap-1 mt-0.5">
                <span className="fw-bold text-truncate" style={{ color: '#0B2C5F', fontSize: '0.95rem' }}>
                  {chartPondFilter === 'all'
                    ? `${assignedPonds.length} Basins`
                    : (assignedPonds.find((p) => String(p.id) === String(chartPondFilter))?.pond_name || 'Selected')}
                </span>
                <span className="badge rounded-pill bg-light text-muted ms-auto extra-small border">
                  {chartRange === 'todaySlots' ? selectedDate : chartRange} • {chartData.unit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart View Container */}
        <div
          className="p-3 rounded-3"
          style={{
            background: 'linear-gradient(180deg, #F8FAFD 0%, #FFFFFF 100%)',
            border: '1px solid rgba(11, 44, 95, 0.06)',
            position: 'relative',
            height: 290,
          }}
        >
          {chartType === 'line' ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* 🌟 FEEDING RECORDS PANEL */}
      <div className="tri-card p-4 p-md-4.5 mb-4 mb-xl-5">
        <div className="d-flex align-items-center justify-content-between mb-3.5 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
              {selectedDate === todayStr ? "Today's Feeding Records" : `Feeding Records (${selectedDate})`}
            </h5>
            <small className="text-muted">
              {selectedPondFilter === 'all'
                ? `Showing all assigned basins for ${selectedDate === todayStr ? `Today (${todayStr})` : selectedDate}`
                : `Filtered by ${selectedPondObj?.pond_name || 'Selected Basin'} (${selectedDate})`}
            </small>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Search Input Pill */}
            <div
              className="d-flex align-items-center px-3 py-1 rounded-pill bg-white shadow-xs"
              style={{ height: 38, width: 220, border: '1px solid rgba(11, 44, 95, 0.15)' }}
            >
              <FaSearch style={{ color: '#0B2C5F', fontSize: '0.8rem' }} className="me-2" />
              <input
                type="text"
                className="form-control form-control-sm border-0 bg-transparent p-0 extra-small fw-medium"
                style={{ color: '#0B2C5F', outline: 'none' }}
                placeholder="Search logs, vitamins..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            {/* Sort Pill */}
            <div
              className="d-flex align-items-center px-3 py-1.5 rounded-pill bg-white shadow-xs"
              style={{ height: 38, border: '1px solid rgba(11, 44, 95, 0.15)' }}
            >
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 cursor-pointer"
                style={{ width: 'auto', minWidth: 140, fontSize: '0.82rem', outline: 'none', color: '#0B2C5F' }}
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount-high">Amount (High to Low)</option>
                <option value="amount-low">Amount (Low to High)</option>
                <option value="pond">Pond Name</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted small">
            <FaSync className="fa-spin mb-2" size={20} style={{ color: '#0B2C5F' }} />
            <p className="mb-0">Loading today's feeding logs...</p>
          </div>
        ) : sortedSearchedTodayRecords.length > 0 ? (
          <div
            className="table-responsive rounded-3 border"
            style={{ maxHeight: '460px', overflowY: 'auto', borderColor: 'rgba(11, 44, 95, 0.1)' }}
          >
            <table className="table tri-table align-middle mb-0" style={{ fontSize: '0.86rem', minWidth: 880 }}>
              <thead
                className="sticky-top shadow-xs"
                style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#F8FAFD' }}
              >
                <tr>
                  <th className="ps-3 py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Time Slot</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Basin</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>DOC / Stage</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Product / Feed Type</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Amount (Grams / Kg)</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Vitamin / Additive</th>
                  <th className="py-3 text-uppercase extra-small fw-bold" style={{ color: '#0B2C5F' }}>Logged At</th>
                </tr>
              </thead>
              <tbody>
                {sortedSearchedTodayRecords.map((r) => (
                  <tr key={r.id} className="transition-all">
                    <td className="ps-3">
                      <span className="badge rounded-pill px-2.5 py-1 extra-small fw-bold" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(11, 44, 95, 0.15)', color: '#0B2C5F' }}>
                        {r.feeding_time || '-'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0B2C5F' }}>{r.pond_name || `Pond ${r.pond_id}`}</strong>
                    </td>
                    <td>
                      {(() => {
                        const pondObj = assignedPonds.find((p) => String(p.id) === String(r.pond_id));
                        const sDate = r.stocking_date || pondObj?.stocking_date;
                        const d = computeDoc(sDate, r.record_date || selectedDate);
                        if (!d) return <span className="text-muted extra-small">—</span>;
                        const isNur = d >= 1 && d <= 19;
                        return (
                          <span
                            className="badge rounded-pill extra-small fw-bold"
                            style={{
                              backgroundColor: 'rgba(11, 44, 95, 0.06)',
                              color: '#0B2C5F',
                              border: '1px solid rgba(11, 44, 95, 0.14)',
                            }}
                          >
                            {isNur ? `Day ${d} Nursery (DOC #${d})` : `Day ${d} Grow-out (DOC #${d})`}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span
                        className="badge rounded-pill px-2.5 py-1 extra-small fw-semibold"
                        style={{
                          backgroundColor: '#FFF7ED',
                          color: '#EA580C',
                          border: '1px solid rgba(234, 88, 12, 0.2)',
                        }}
                      >
                        {r.feed_type || r.product_code || 'Tateh'}
                      </span>
                    </td>
                    <td>
                      {parseFloat(r.amount_kg) === 0 ? (
                        <span className="badge bg-light text-muted border">0 g (No feed logged)</span>
                      ) : (
                        <div>
                          <strong className="d-block" style={{ color: '#0B2C5F' }}>
                            {r.amount_grams ?? Math.round(parseFloat(r.amount_kg) * 1000)} g
                          </strong>
                          <span className="extra-small font-mono fw-semibold" style={{ color: '#627591' }}>
                            ({parseFloat(r.amount_kg).toFixed(2)} kg)
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      {r.vitamin_name && r.vitamin_name !== 'None' ? (
                        <span className="badge rounded-pill px-2.5 py-1 extra-small fw-semibold" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}>
                          {r.vitamin_name}
                        </span>
                      ) : (
                        <span className="text-muted extra-small">None</span>
                      )}
                    </td>
                    <td>
                      <span className="text-muted extra-small font-mono">
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.record_date}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 text-center bg-white rounded-4 border" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
            <p className="text-muted mb-3 small">
              {searchFilter
                ? `No matching feeding logs found for "${searchFilter}".`
                : selectedPondFilter === 'all'
                  ? "No feeding records logged for today yet."
                  : `No feeding records logged for ${selectedPondObj?.pond_name || 'this pond'} today.`}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-tri-navy px-4 py-2 shadow-xs"
              onClick={() => navigate('/caretaker/my-pond')}
            >
              Log Today's First Feeding
            </button>
          </div>
        )}
      </div>

      {/* 🌟 SIDE-BY-SIDE DISEASE SCAN & SYSTEM ALERTS */}
      <div className="row g-3 g-md-4">
        {/* Left Card: Disease Scan */}
        <div className="col-md-6">
          <div className="tri-card p-4 p-md-4.5 h-100 d-flex flex-column justify-content-between" style={{ minHeight: 280 }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3.5 gap-2 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 34, height: 34, background: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F' }}
                  >
                    <FaStethoscope size={14} />
                  </div>
                  <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>Disease Scan Telemetry</h5>
                </div>

                <div className="d-flex align-items-center gap-2 ms-auto">
                  <select
                    className="form-select form-select-sm rounded-pill bg-white px-3 py-1 shadow-xs cursor-pointer extra-small fw-semibold"
                    style={{ width: 'auto', minWidth: 140, height: 36, border: '1px solid rgba(11, 44, 95, 0.15)', color: '#0B2C5F' }}
                    value={selectedDiseasePondFilter}
                    onChange={(event) => setSelectedDiseasePondFilter(event.target.value)}
                  >
                    <option value="all">All Assigned Basins</option>
                    {assignedPonds.map((pond) => (
                      <option key={pond.id} value={pond.pond_name}>
                        {pond.pond_name}
                      </option>
                    ))}
                  </select>
                  <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                    {filteredDiseaseScans.length} Scans
                  </span>
                </div>
              </div>

              {latestDisease ? (
                <div className="d-flex align-items-center p-3 rounded-4 bg-white border" style={{ minHeight: 110, borderColor: 'rgba(11, 44, 95, 0.1)' }}>
                  {latestDisease.image_path && (
                    <img
                      src={resolveImageUrl(latestDisease.image_path)}
                      alt="Latest disease scan"
                      className="rounded-3 me-3 flex-shrink-0 border"
                      style={{ width: 64, height: 64, objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <div className="fw-bold mb-1 fs-6" style={{ color: '#0B2C5F' }}>{latestDisease.disease_name}</div>
                    <div className="d-flex align-items-center gap-2 flex-wrap extra-small text-muted">
                      <span>Risk:</span>
                      <span className="badge rounded-pill" style={{ backgroundColor: latestDisease.risk_level === 'High' ? '#EA580C' : '#0B2C5F', color: '#FFFFFF' }}>
                        {latestDisease.risk_level || 'Safe'}
                      </span>
                      <span>•</span>
                      <span>Confidence: <strong style={{ color: '#0B2C5F' }}>{latestDisease.confidence_score}%</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 rounded-4 bg-white border text-muted small" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <FaStethoscope size={22} className="mb-2 opacity-40" style={{ color: '#0B2C5F' }} />
                  <p className="mb-0 fw-semibold" style={{ color: '#0B2C5F' }}>No disease scans recorded yet</p>
                  <small className="extra-small text-muted">AI image inference is nominal.</small>
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small shadow-xs"
                onClick={() => navigate('/caretaker/disease-scan')}
              >
                Scan Shrimp Health <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: System Alerts */}
        <div className="col-md-6">
          <div className="tri-card p-4 p-md-4.5 h-100 d-flex flex-column justify-content-between" style={{ minHeight: 280 }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3.5 gap-2">
                <div className="d-flex align-items-center gap-2">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: 34, height: 34, background: '#FFF7ED', color: '#EA580C' }}
                  >
                    <FaExclamationTriangle size={14} />
                  </div>
                  <h5 className="fw-bold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>System Incident Alerts</h5>
                </div>
                <span className="badge rounded-pill extra-small px-2.5 py-1.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  {alerts.length} Active
                </span>
              </div>

              {latestAlert ? (
                <div className="d-flex flex-column justify-content-center p-3 rounded-4" style={{ minHeight: 110, backgroundColor: '#FFF7ED', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  <div className="fw-bold d-flex align-items-center gap-2 mb-1 fs-6" style={{ color: '#EA580C' }}>
                    <FaExclamationTriangle size={13} /> {latestAlert.title}
                  </div>
                  <small className="text-muted" style={{ lineHeight: 1.45 }}>{latestAlert.message}</small>
                </div>
              ) : (
                <div className="text-center py-4 rounded-4 bg-white border text-muted small" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <FaShieldAlt size={22} className="mb-2 opacity-40" style={{ color: '#0B2C5F' }} />
                  <p className="mb-0 fw-semibold" style={{ color: '#0B2C5F' }}>No active alerts for your ponds</p>
                  <small className="extra-small text-muted">All ponds and telemetry parameters are stable.</small>
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-top d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-tri-outline-orange px-3.5 py-1.5 extra-small shadow-xs"
                onClick={() => navigate('/caretaker/reports')}
              >
                Submit Incident Report <FaChevronRight size={10} />
              </button>
            </div>
          </div>
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
        initialPondId={ocrTargetPondId || (assignedPonds[0]?.id ? String(assignedPonds[0].id) : '')}
        initialDate={ocrTargetDate || todayStr}
        initialRecord={editingWqRecord}
        caretakerName={user?.full_name || 'Caretaker'}
        caretakerId={user?.id}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* 🌟 WATER QUALITY LOG HISTORY & BACKFILL MODAL */}
      <WaterQualityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryTargetPond(null);
        }}
        pond={historyTargetPond}
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
          if (historyTargetPond) setOcrTargetPondId(String(historyTargetPond.id));
          setOcrTargetDate(date || todayStr);
          setIsHistoryModalOpen(false);
          setIsOcrModalOpen(true);
        }}
      />
    </div>
  );
}
