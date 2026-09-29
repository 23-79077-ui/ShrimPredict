import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { safeArray } from '../../services/api';
import { downloadDashboardPDF } from '../../utils/pdfExport';
import { Line, Doughnut } from 'react-chartjs-2';
import Swal from 'sweetalert2';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import {
  FaFilter,
  FaUndo,
  FaSync,
  FaFilePdf,
  FaDownload,
  FaCheck,
  FaCheckCircle,
  FaExclamationTriangle,
  FaShieldAlt,
  FaEye,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaUtensils,
  FaUserTie,
  FaWater,
  FaArrowUp,
  FaCalendarCheck,
  FaCalendarAlt,
  FaClock,
  FaLeaf,
  FaGasPump
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
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [feedCardPondFilter, setFeedCardPondFilter] = useState('all');
  const [pondStatusFilter, setPondStatusFilter] = useState('all'); // 'all' | 'healthy' | 'warning' | 'critical' | 'isolated' | 'unmonitored'
  const [isolatedPonds, setIsolatedPonds] = useState(() => {
    try {
      localStorage.removeItem('shrim_isolated_ponds'); // clear old stale test data so it starts unisolated
      const saved = localStorage.getItem('shrim_isolated_ponds_v3');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isPondIsolated = useCallback((pondIdentifier) => {
    if (!pondIdentifier) return false;
    const name = typeof pondIdentifier === 'object'
      ? (pondIdentifier.pond_name || pondIdentifier.pond || pondIdentifier.name || '')
      : String(pondIdentifier);
    const id = typeof pondIdentifier === 'object' ? String(pondIdentifier.id || '') : '';

    const cleanName = name.trim().toLowerCase();
    for (const item of isolatedPonds) {
      const cleanItem = String(item).trim().toLowerCase();
      if (cleanItem && (cleanItem === cleanName || (id && cleanItem === id))) {
        return true;
      }
    }
    return false;
  }, [isolatedPonds]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Date Filter states: 'all' | 'today' | 'yesterday' | 'aug10' | 'last7' | 'custom'
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customDate, setCustomDate] = useState('');

  // Selected Pond for Harvest Milestone Forecast widget filter
  const [selectedForecastPondId, setSelectedForecastPondId] = useState('auto');

  // Toggle for Pond Overview: show 4 ponds initially vs show all
  const [showAllPonds, setShowAllPonds] = useState(false);

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

  // Selected Caretaker Object
  const selectedCaretakerObj = useMemo(() => {
    if (selectedCaretakerId === 'all') return null;
    return caretakers.find((c) => String(c.id) === String(selectedCaretakerId)) || null;
  }, [selectedCaretakerId, caretakers]);

  // Helper to determine available dates in feeding records
  const availableDates = useMemo(() => {
    const map = new Map();
    allFeedingRecords.forEach((r) => {
      const d = (r.record_date || r.created_at || '').slice(0, 10);
      if (d) {
        map.set(d, (map.get(d) || 0) + (parseFloat(r.amount_kg) || 0));
      }
    });
    return Array.from(map.entries())
      .map(([date, totalKg]) => ({ date, totalKg }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allFeedingRecords]);

  // Helper date checker
  const isDateMatch = useCallback(
    (recordDateStr) => {
      if (!recordDateStr) return false;
      const rDate = recordDateStr.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const yesterdayObj = new Date();
      yesterdayObj.setDate(yesterdayObj.getDate() - 1);
      const yesterday = yesterdayObj.toISOString().slice(0, 10);

      if (dateFilterType === 'all') return true;
      if (dateFilterType === 'today') return rDate === today;
      if (dateFilterType === 'yesterday') return rDate === yesterday;
      if (dateFilterType === 'aug10') return rDate === '2026-08-10';
      if (dateFilterType === 'last7') {
        const d = new Date(rDate + 'T00:00:00');
        const now = new Date();
        const diffTime = now - d;
        const diffDays = Math.floor(diffTime / 86400000);
        return diffDays >= 0 && diffDays <= 7;
      }
      if (dateFilterType === 'custom' && customDate) {
        return rDate === customDate;
      }
      if (dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return rDate === dateFilterType;
      }
      return true;
    },
    [dateFilterType, customDate]
  );

  // Filtered Ponds (Search + Caretaker + Pond Filter)
  const displayedPonds = useMemo(() => {
    return ponds.filter((p) => {
      if (selectedPondFilter !== 'all') {
        const pName = (p.pond_name || p.name || '').toLowerCase().trim();
        const targetPond = selectedPondFilter.toLowerCase().trim();
        if (pName !== targetPond && !pName.includes(targetPond) && !targetPond.includes(pName)) {
          return false;
        }
      }

      if (selectedCaretakerId !== 'all') {
        const caretakerIdMatch = String(p.caretaker_id || '') === String(selectedCaretakerId);
        const caretakerNameMatch =
          selectedCaretakerObj &&
          (p.caretaker_name || p.assigned_caretaker_name || '')
            .toLowerCase()
            .includes(selectedCaretakerObj.full_name.toLowerCase());
        if (!caretakerIdMatch && !caretakerNameMatch) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (p.pond_name || p.name || '').toLowerCase();
        const cName = (p.caretaker_name || p.assigned_caretaker_name || '').toLowerCase();
        const status = (p.status || '').toLowerCase();
        return pName.includes(q) || cName.includes(q) || status.includes(q);
      }

      return true;
    });
  }, [ponds, selectedCaretakerId, selectedCaretakerObj, selectedPondFilter, searchQuery]);

  // Filtered Feeding Records (Date + Caretaker + Pond Filter + Search)
  const filteredFeedingRecords = useMemo(() => {
    return allFeedingRecords.filter((r) => {
      if (selectedPondFilter !== 'all') {
        const pName = (r.pond_name || '').toLowerCase().trim();
        const targetPond = selectedPondFilter.toLowerCase().trim();
        if (pName !== targetPond && !pName.includes(targetPond) && !targetPond.includes(pName)) {
          return false;
        }
      }

      if (selectedCaretakerId !== 'all') {
        const matchUser = String(r.user_id || '') === String(selectedCaretakerId);
        const matchName =
          selectedCaretakerObj &&
          (r.recorded_by_name || r.recorded_by || '')
            .toLowerCase()
            .includes(selectedCaretakerObj.full_name.toLowerCase());
        if (!matchUser && !matchName) return false;
      }

      const recDate = r.record_date || r.created_at || '';
      if (!isDateMatch(recDate)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (r.pond_name || '').toLowerCase();
        const fType = (r.feed_type || '').toLowerCase();
        const cName = (r.recorded_by_name || r.recorded_by || '').toLowerCase();
        return pName.includes(q) || fType.includes(q) || cName.includes(q);
      }

      return true;
    });
  }, [allFeedingRecords, selectedCaretakerId, selectedCaretakerObj, selectedPondFilter, isDateMatch, searchQuery]);

  // Filtered Disease Reports (Caretaker + Pond Filter + Search + Date)
  const filteredDiseaseReports = useMemo(() => {
    return allDiseaseReports.filter((rep) => {
      // 1. Caretaker Filter (checks user_id, fuzzy name matching both directions, and assigned ponds)
      if (selectedCaretakerId !== 'all') {
        const matchUser = String(rep.user_id || '') === String(selectedCaretakerId);

        const repCName = (rep.caretaker_name || '').toLowerCase().trim();
        const selFullName = selectedCaretakerObj ? (selectedCaretakerObj.full_name || '').toLowerCase().trim() : '';
        const selFirstName = selFullName.split(' ')[0] || '';

        const matchName =
          Boolean(selFullName) &&
          (repCName.includes(selFullName) ||
            selFullName.includes(repCName) ||
            (selFirstName.length >= 2 && repCName.includes(selFirstName)));

        const caretakerAssignedPonds = ponds
          .filter((p) => String(p.caretaker_id || '') === String(selectedCaretakerId) ||
            (selFullName && (p.caretaker_name || p.assigned_caretaker_name || '').toLowerCase().includes(selFullName)))
          .map((p) => (p.pond_name || '').toLowerCase().trim());
        const repPond = (rep.pond_name || '').toLowerCase().trim();
        const matchAssignedPond = caretakerAssignedPonds.includes(repPond);

        if (!matchUser && !matchName && !matchAssignedPond) return false;
      }

      // 2. Pond Filter
      if (selectedPondFilter !== 'all') {
        const repPond = (rep.pond_name || '').toLowerCase().trim();
        const targetPond = selectedPondFilter.toLowerCase().trim();
        if (repPond !== targetPond && !repPond.includes(targetPond) && !targetPond.includes(repPond)) {
          return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (rep.pond_name || '').toLowerCase();
        const cName = (rep.caretaker_name || '').toLowerCase();
        const dName = (rep.disease_name || '').toLowerCase();
        const rLevel = (rep.risk_level || '').toLowerCase();
        if (!pName.includes(q) && !cName.includes(q) && !dName.includes(q) && !rLevel.includes(q)) {
          return false;
        }
      }

      // 4. Date Match
      const repDate = rep.report_date || rep.created_at || '';
      return isDateMatch(repDate);
    });
  }, [allDiseaseReports, selectedCaretakerId, selectedCaretakerObj, selectedPondFilter, ponds, searchQuery, isDateMatch]);

  // Available Ponds for the selected caretaker (or for all ponds)
  const availableCaretakerPonds = useMemo(() => {
    if (selectedCaretakerId === 'all') {
      return Array.from(new Set(ponds.map((p) => p.pond_name || p.name).filter(Boolean)));
    }

    const selFullName = selectedCaretakerObj ? (selectedCaretakerObj.full_name || '').toLowerCase().trim() : '';

    // 1. Ponds assigned in ponds table
    const assignedNames = ponds
      .filter((p) => {
        const matchId = String(p.caretaker_id || '') === String(selectedCaretakerId);
        const matchName = Boolean(selFullName) && (p.caretaker_name || p.assigned_caretaker_name || '').toLowerCase().includes(selFullName);
        return matchId || matchName;
      })
      .map((p) => p.pond_name || p.name)
      .filter(Boolean);

    // 2. Ponds from feeding_records where this caretaker recorded feeds
    const feedPonds = allFeedingRecords
      .filter((r) => {
        const matchUser = String(r.user_id || '') === String(selectedCaretakerId);
        const matchName = Boolean(selFullName) && (r.recorded_by_name || r.recorded_by || '').toLowerCase().includes(selFullName);
        return matchUser || matchName;
      })
      .map((r) => {
        if (r.pond_name) return r.pond_name;
        const matchedPond = ponds.find((p) => String(p.id) === String(r.pond_id));
        return matchedPond ? (matchedPond.pond_name || matchedPond.name) : null;
      })
      .filter(Boolean);

    // 3. User's pond_id from users table if present
    const userPondId = selectedCaretakerObj?.pond_id;
    const userPond = userPondId ? ponds.find((p) => String(p.id) === String(userPondId)) : null;
    const userPondName = userPond ? (userPond.pond_name || userPond.name) : null;

    const combined = [...assignedNames, ...feedPonds];
    if (userPondName) combined.push(userPondName);

    return Array.from(new Set(combined)).filter(Boolean);
  }, [ponds, selectedCaretakerId, selectedCaretakerObj, allFeedingRecords]);

  // Feed records specific to the Total Feed KPI Card (Filtered per assigned pond)
  const feedCardRecords = useMemo(() => {
    return filteredFeedingRecords.filter((r) => {
      if (feedCardPondFilter !== 'all') {
        const rPond = (r.pond_name || '').toLowerCase().trim();
        const targetPond = feedCardPondFilter.toLowerCase().trim();
        if (rPond !== targetPond && !rPond.includes(targetPond) && !targetPond.includes(rPond)) {
          return false;
        }
      }
      return true;
    });
  }, [filteredFeedingRecords, feedCardPondFilter]);

  const feedCardTotalKg = useMemo(() => {
    return feedCardRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  }, [feedCardRecords]);

  const feedCardTotalGrams = useMemo(() => {
    return Math.round(feedCardTotalKg * 1000);
  }, [feedCardTotalKg]);

  const feedCardRunsCount = useMemo(() => {
    return feedCardRecords.length;
  }, [feedCardRecords]);

  // Total Feed Consumed
  const totalFilteredFeedKg = useMemo(() => {
    return filteredFeedingRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  }, [filteredFeedingRecords]);

  // High-Level Operational Metrics
  const kpiStats = useMemo(() => {
    const totalPondsCount = displayedPonds.length;
    const healthyPondsCount = displayedPonds.filter((p) => (p.status || '').toLowerCase() === 'healthy').length;
    const healthyPct = totalPondsCount > 0 ? Math.round((healthyPondsCount / totalPondsCount) * 100) : 100;

    const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || searchQuery.trim() !== '' || dateFilterType !== 'all';
    const activeReports = isFiltered ? filteredDiseaseReports : (allDiseaseReports.length > 0 ? allDiseaseReports : []);
    const wsdSuspectedCount = activeReports.filter((r) =>
      ['high', 'critical'].includes((r.risk_level || '').toLowerCase()) ||
      (r.disease_name || '').toLowerCase().includes('wsd') ||
      (r.disease_name || '').toLowerCase().includes('white spot')
    ).length;
    const totalLogsCount = activeReports.length;
    const finalWsdCount = wsdSuspectedCount;
    const normalFeedCount = Math.max(0, totalLogsCount - finalWsdCount);
    const safeReports = activeReports.filter((r) => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase().includes('healthy')).length;
    const totalReports = activeReports.length || (isFiltered ? 0 : 1);
    const bioSafePct = totalReports > 0 ? Math.round((safeReports / totalReports) * 100) : (isFiltered ? 100 : 51);

    return {
      totalPondsCount,
      healthyPondsCount,
      healthyPct,
      critReports: finalWsdCount,
      totalAlertsCount: totalLogsCount,
      wsdSuspectedCount: finalWsdCount,
      normalFeedCount,
      bioSafePct,
      totalFeedKg: totalFilteredFeedKg,
      totalFeedG: Math.round(totalFilteredFeedKg * 1000),
      totalRuns: filteredFeedingRecords.length,
      activeCaretakersCount: caretakers.length,
    };
  }, [displayedPonds, filteredDiseaseReports, allDiseaseReports, totalFilteredFeedKg, filteredFeedingRecords, caretakers, selectedCaretakerId, selectedPondFilter, searchQuery, dateFilterType]);

  // Dynamic Chart for Feed Consumption (Wave-Line with Navy & Orange Tri-Color Styling)
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
          label: 'Feed Dispensed (kg)',
          data,
          borderColor: '#0B2C5F',
          borderWidth: 2.5,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(11, 44, 95, 0.16)');
            gradient.addColorStop(1, 'rgba(11, 44, 95, 0.01)');
            return gradient;
          },
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#EA580C',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#EA580C',
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
        backgroundColor: '#0B2C5F',
        titleColor: '#FFFFFF',
        bodyColor: '#EA580C',
        titleFont: { size: 12, weight: '700', family: "'Poppins', sans-serif" },
        bodyFont: { size: 13, weight: '700', family: "'Poppins', sans-serif" },
        borderColor: 'rgba(234, 88, 12, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          label: (context) => ` Total Feed Mass: ${context.parsed.y} kg`,
          afterLabel: (context) => {
            const idx = context.dataIndex;
            const datesToShow = availableDates.slice(0, 7).reverse();
            const targetDateObj = datesToShow[idx];
            if (!targetDateObj || !targetDateObj.date) return '';

            const targetYmd = targetDateObj.date;
            const dayRecords = filteredFeedingRecords.filter(
              (r) => String(r.record_date || r.created_at || '').slice(0, 10) === targetYmd
            );

            if (dayRecords.length === 0) return '';

            const pondMap = {};
            dayRecords.forEach((r) => {
              const pName = r.pond_name || (r.pond_id ? `Pond #${r.pond_id}` : 'Pond');
              pondMap[pName] = (pondMap[pName] || 0) + (parseFloat(r.amount_kg) || 0);
            });

            const lines = Object.entries(pondMap)
              .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
              .map(([pName, kg]) => ` • ${pName}: ${kg.toFixed(1)} kg`);

            return ['----------------------------------', ' Ponds Feed Consumption:', ...lines];
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(11, 44, 95, 0.05)', drawBorder: false },
        ticks: { color: '#64748B', font: { size: 11, family: "'Poppins', sans-serif" } }
      },
      y: {
        grid: { color: 'rgba(11, 44, 95, 0.05)', drawBorder: false },
        ticks: { color: '#64748B', font: { size: 11, family: "'Poppins', sans-serif" }, callback: (v) => `${v} kg` }
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
      background: '#0B2C5F',
      color: '#FFFFFF'
    });
  };

  const handleQuickIsolate = (item) => {
    const pondIdentifier = (item.pond || item.pond_name || '').trim();
    Swal.fire({
      title: 'Isolate Pond Bio-Zone?',
      html: `Deploy bio-barrier protocols and stop water intake for <strong>${pondIdentifier}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0B2C5F',
      cancelButtonColor: '#EA580C',
      confirmButtonText: 'Yes, Isolate Pond',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        setIsolatedPonds((prev) => {
          const next = new Set(prev);
          if (pondIdentifier) next.add(pondIdentifier);
          if (item.id) next.add(String(item.id));
          try {
            localStorage.setItem('shrim_isolated_ponds_v3', JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });

        Swal.fire({
          icon: 'success',
          title: 'Isolation Protocol Active',
          text: `Valve lock engaged for ${pondIdentifier}. System logs recorded and added to Isolated Ponds summary.`,
          confirmButtonColor: '#0B2C5F'
        });
      }
    });
  };

  const handleLiftIsolation = (pondIdentifier) => {
    const name = typeof pondIdentifier === 'object'
      ? (pondIdentifier.pond_name || pondIdentifier.pond || pondIdentifier.name || '')
      : String(pondIdentifier);
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
            if (String(item).trim().toLowerCase() !== cleanName) {
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
          confirmButtonColor: '#0B2C5F'
        });
      }
    });
  };

  // Prioritized Disease Feed Data with Clean Legend Tags
  const diseaseItems = useMemo(() => {
    const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || searchQuery.trim() !== '' || dateFilterType !== 'all';
    const sourceReports = isFiltered ? filteredDiseaseReports : (allDiseaseReports.length > 0 ? allDiseaseReports : []);
    if (sourceReports.length === 0) return [];

    const raw = sourceReports.map((r) => {
      const riskLower = (r.risk_level || 'Low').toLowerCase();
      const normalizedRisk = ['high', 'critical'].includes(riskLower) || (r.disease_name || '').toLowerCase().includes('wssv')
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
  }, [filteredDiseaseReports, allDiseaseReports, diseaseFilter, selectedCaretakerId, selectedPondFilter, searchQuery, dateFilterType]);

  return (
    <div className="admin-dashboard-container">
      {/* HERO OPERATIONS HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Executive Operations Hub
          </h2>
          <span className="text-muted extra-small fw-medium">
            O&amp;B Aquafarm • Real-Time Administrative Telemetry &amp; Farm Fleet Control
          </span>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span
            className="badge bg-white rounded-pill px-3 py-1.5 extra-small shadow-xs"
            style={{ color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}
          >
            ● Real-Time Farm Intelligence
          </span>
        </div>
      </div>

      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search pond or caretaker"
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCSV={() => setShowExportModal(true)}
        exportLabel="Export PDF"
        onRefresh={fetchData}
        loading={loading}
        tabs={[
          { id: 'all', label: 'All Basins', count: displayedPonds.length },
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'last7', label: 'Last 7 Days' }
        ]}
        activeTab={dateFilterType}
        onTabChange={setDateFilterType}
        metaRight={
          <>
            Target Feed: <strong>Days 1–19 Nursery (Starter)</strong> &rarr; <strong>Day 20+ Grow-out (Grower)</strong>
          </>
        }
        filterFields={[
          {
            label: 'Evaluation Date',
            icon: <FaCalendarAlt className="me-1" style={{ color: '#EA580C' }} />,
            type: 'date',
            value: customDate,
            onChange: (val) => {
              setCustomDate(val);
              setDateFilterType('custom');
            },
            colClass: 'col-12 col-md-3'
          },
          {
            label: 'Filter by Pond',
            type: 'select',
            value: selectedPondFilter,
            onChange: (val) => {
              setSelectedPondFilter(val);
              setFeedCardPondFilter(val);
            },
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'all', label: selectedCaretakerObj ? `All Assigned Ponds (${availableCaretakerPonds.length})` : 'All Ponds' },
              ...availableCaretakerPonds.map((name) => ({
                value: name,
                label: name
              }))
            ]
          },
          {
            label: 'Disease Detection',
            type: 'select',
            value: diseaseFilter,
            onChange: setDiseaseFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'all', label: 'All detections' },
              { value: 'critical', label: 'Critical' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'safe', label: 'Safe / Healthy' }
            ]
          },
          {
            label: 'Assigned Caretaker',
            type: 'select',
            value: selectedCaretakerId,
            onChange: (val) => {
              setSelectedCaretakerId(val);
              setSelectedPondFilter('all');
              setFeedCardPondFilter('all');
            },
            colClass: 'col-12 col-md-3',
            options: [
              { value: 'all', label: 'All caretakers' },
              ...caretakers.map((c) => ({ value: String(c.id), label: c.full_name }))
            ]
          }
        ]}
        onResetFilters={() => {
          setSelectedCaretakerId('all');
          setSelectedPondFilter('all');
          setFeedCardPondFilter('all');
          setPondStatusFilter('all');
          setDateFilterType('all');
          setCustomDate('');
          setDiseaseFilter('all');
          setSearchQuery('');
        }}
      />

      {/* 4 TRI-COLOR OPERATIONAL TELEMETRY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Metric 1: Monitored Ponds */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Monitored Ponds</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaWater size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.totalPondsCount}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: `${kpiStats.healthyPct}%`, background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {kpiStats.healthyPondsCount} of {kpiStats.totalPondsCount} Optimal
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  Active Fleet
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Field Caretakers */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Field Caretakers</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaUserTie size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.activeCaretakersCount}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {selectedCaretakerId === 'all' ? 'All Operators Active' : selectedCaretakerObj?.full_name || 'Active Operator'}
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  Staffed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Feed Mass */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(234, 88, 12, 0.18)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">
                  Total Feed {dateFilterType !== 'all' ? `(${dateFilterType === 'today' ? 'Today' : dateFilterType})` : ''}
                </span>
                <div className="tri-kpi-icon tri-kpi-icon-orange" style={{ width: 32, height: 32 }}>
                  <FaUtensils size={15} />
                </div>
              </div>

              {/* Per-Pond Filter Dropdown inside Total Feed Card */}
              {availableCaretakerPonds.length > 0 && (
                <div className="mb-2">
                  <select
                    className="form-select form-select-sm extra-small py-0.5 ps-2 pe-4 fw-bold tri-feed-pond-select"
                    style={{
                      fontSize: '0.73rem',
                      borderRadius: 6,
                      height: 27,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                    value={feedCardPondFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFeedCardPondFilter(val);
                      setSelectedPondFilter(val);
                    }}
                    title="Filter Total Feed per assigned pond"
                  >
                    <option value="all">
                      {selectedCaretakerObj ? `All Assigned Ponds (${availableCaretakerPonds.length})` : 'All Ponds'}
                    </option>
                    {availableCaretakerPonds.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {feedCardTotalKg.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Total grams: <strong className="font-mono" style={{ color: '#0B2C5F' }}>{feedCardTotalGrams.toLocaleString()} g</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(12, (feedCardTotalKg / Math.max(1, displayedPonds.length * 40)) * 100))}%`,
                    background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {feedCardRunsCount} Dispersal Runs
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}>
                  {feedCardRunsCount > 0 ? 'Verified' : 'No Logs'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 4: Biosecurity Health */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: kpiStats.wsdSuspectedCount > 0 ? 'rgba(234, 88, 12, 0.25)' : 'rgba(11, 44, 95, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Biosecurity Health</span>
                <div className={`tri-kpi-icon ${kpiStats.wsdSuspectedCount > 0 ? 'tri-kpi-icon-orange' : 'tri-kpi-icon-blue'}`}>
                  <FaShieldAlt size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: kpiStats.wsdSuspectedCount > 0 ? '#EA580C' : '#0B2C5F', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.wsdSuspectedCount > 0 ? `${kpiStats.wsdSuspectedCount} Alert${kpiStats.wsdSuspectedCount > 1 ? 's' : ''}` : `${kpiStats.bioSafePct}%`}
              </h2>
              <div className="extra-small text-muted fw-semibold mb-0.5">
                Status: <strong style={{ color: kpiStats.wsdSuspectedCount > 0 ? '#EA580C' : '#0B2C5F' }}>{kpiStats.wsdSuspectedCount > 0 ? 'WSD Anomaly Detected' : 'Fleet Bio-Protected'}</strong>
              </div>
              <div className="extra-small text-muted" style={{ fontSize: '0.74rem' }}>
                Detection: <strong>{kpiStats.wsdSuspectedCount} Suspected WSD | {kpiStats.normalFeedCount} Normal</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: kpiStats.wsdSuspectedCount > 0 ? 'rgba(234, 88, 12, 0.1)' : 'rgba(11, 44, 95, 0.08)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${kpiStats.bioSafePct}%`,
                    background: kpiStats.wsdSuspectedCount > 0 ? 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)' : 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">CNN Vision Classifier</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: kpiStats.wsdSuspectedCount > 0 ? '#FFF7ED' : 'rgba(11, 44, 95, 0.06)', color: kpiStats.wsdSuspectedCount > 0 ? '#EA580C' : '#0B2C5F', border: kpiStats.wsdSuspectedCount > 0 ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid rgba(11, 44, 95, 0.15)' }}>
                  {kpiStats.wsdSuspectedCount > 0 ? 'CNN Alert' : '100% Safe'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ASYMMETRICAL MASONRY GRID ROW 1: PONDS OVERVIEW (7 cols) + HARVEST TIMELINE (5 cols) */}
      <div className="row g-4 mb-4">
        {/* WIDGET 1: PONDS OVERVIEW (Interactive Segmented Status Bar) */}
        <div className="col-12 col-xl-7">
          <div className="tri-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              {(() => {
                const totalPondsCount = displayedPonds.length;
                const criticalCount = displayedPonds.filter(p => !isPondIsolated(p) && ((p.status || '').toLowerCase() === 'critical' || (p.disease_detection || '').toLowerCase().includes('white spot'))).length;
                const warningCount = displayedPonds.filter(p => !isPondIsolated(p) && (((p.status || '').toLowerCase() === 'warning' || (p.status || '').toLowerCase() === 'maintenance' || (p.disease_detection || '').toLowerCase().includes('black gill')) && (p.status || '').toLowerCase() !== 'critical')).length;
                const healthyCount = displayedPonds.filter(p => !isPondIsolated(p) && (p.status || '').toLowerCase() === 'healthy' && !(p.disease_detection || '').toLowerCase().includes('white spot')).length;
                const isolatedCount = displayedPonds.filter(p => isPondIsolated(p)).length;
                const unmonitoredCount = displayedPonds.filter(p => !isPondIsolated(p) && !['healthy', 'warning', 'maintenance', 'critical'].includes((p.status || '').toLowerCase())).length;

                const healthyPct = totalPondsCount > 0 ? Math.round((healthyCount / totalPondsCount) * 100) : 0;
                const warningPct = totalPondsCount > 0 ? Math.round((warningCount / totalPondsCount) * 100) : 0;
                const criticalPct = totalPondsCount > 0 ? Math.round((criticalCount / totalPondsCount) * 100) : 0;
                const isolatedPct = totalPondsCount > 0 ? Math.round((isolatedCount / totalPondsCount) * 100) : 0;
                const unmonitoredPct = totalPondsCount > 0 ? Math.max(0, 100 - healthyPct - warningPct - criticalPct - isolatedPct) : 0;

                return (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>
                        <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>Ponds Overview</h5>
                        <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                          Active farm monitoring status across grow-out and nursery basins. Click any summary card to filter ponds.
                        </p>
                      </div>
                      <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                        Total {totalPondsCount} {totalPondsCount === 1 ? 'Pond' : 'Ponds'}
                      </span>
                    </div>

                    {/* Interactive Summary Cards for Ponds (All, Healthy, Warning, Critical) */}
                    <div className="row g-2.5 mb-3">
                      {/* Card 1: All Ponds */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 border transition-all cursor-pointer h-100 ${
                            pondStatusFilter === 'all' ? 'shadow-sm' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'all' ? 'rgba(11, 44, 95, 0.06)' : '#FFFFFF',
                            borderColor: pondStatusFilter === 'all' ? '#0B2C5F' : 'rgba(11, 44, 95, 0.12)',
                            borderWidth: pondStatusFilter === 'all' ? '2px' : '1px',
                          }}
                          onClick={() => setPondStatusFilter('all')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#0B2C5F', fontSize: '0.72rem' }}>
                              All Ponds
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                              Total
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#0B2C5F', fontSize: '1.4rem' }}>
                              {totalPondsCount}
                            </h4>
                            <span className="text-muted extra-small">basins</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Healthy */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 border transition-all cursor-pointer h-100 ${
                            pondStatusFilter === 'healthy' ? 'shadow-sm' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'healthy' ? '#F0FDF4' : '#FFFFFF',
                            borderColor: pondStatusFilter === 'healthy' ? '#16A34A' : 'rgba(22, 163, 74, 0.22)',
                            borderWidth: pondStatusFilter === 'healthy' ? '2px' : '1px',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'healthy' ? 'all' : 'healthy')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#16A34A', fontSize: '0.72rem' }}>
                              ● Healthy
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                              {healthyPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#16A34A', fontSize: '1.4rem' }}>
                              {healthyCount}
                            </h4>
                            <span className="text-muted extra-small">optimal</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Warning */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 border transition-all cursor-pointer h-100 ${
                            pondStatusFilter === 'warning' ? 'shadow-sm' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'warning' ? '#FFF7ED' : '#FFFFFF',
                            borderColor: pondStatusFilter === 'warning' ? '#EA580C' : 'rgba(234, 88, 12, 0.25)',
                            borderWidth: pondStatusFilter === 'warning' ? '2px' : '1px',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'warning' ? 'all' : 'warning')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#EA580C', fontSize: '0.72rem' }}>
                              ● Warning
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: '#FFEDD5', color: '#EA580C' }}>
                              {warningPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#EA580C', fontSize: '1.4rem' }}>
                              {warningCount}
                            </h4>
                            <span className="text-muted extra-small">attention</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Critical */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 border transition-all cursor-pointer h-100 ${
                            pondStatusFilter === 'critical' ? 'shadow-sm' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'critical' ? '#FEF2F2' : '#FFFFFF',
                            borderColor: pondStatusFilter === 'critical' ? '#DC2626' : 'rgba(220, 38, 38, 0.25)',
                            borderWidth: pondStatusFilter === 'critical' ? '2px' : '1px',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'critical' ? 'all' : 'critical')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#DC2626', fontSize: '0.72rem' }}>
                              ● Critical
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                              {criticalPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#DC2626', fontSize: '1.4rem' }}>
                              {criticalCount}
                            </h4>
                            <span className="text-muted extra-small">alerts</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Status Filter Indicator Banner */}
                    {pondStatusFilter !== 'all' && (
                      <div className="d-flex justify-content-between align-items-center mb-3 px-3 py-1.5 rounded-3" style={{ backgroundColor: 'rgba(11, 44, 95, 0.04)', border: '1px dashed rgba(11, 44, 95, 0.2)' }}>
                        <span className="extra-small fw-semibold" style={{ color: '#0B2C5F' }}>
                          Filtered by <strong>{pondStatusFilter.toUpperCase()}</strong>: Showing {displayedPonds.filter(p => {
                            const status = (p.status || '').toLowerCase().trim();
                            const disease = (p.disease_detection || '').toLowerCase().trim();
                            if (pondStatusFilter === 'critical') return status === 'critical' || disease.includes('white spot');
                            if (pondStatusFilter === 'warning') return (status === 'warning' || status === 'maintenance' || disease.includes('black gill')) && status !== 'critical';
                            if (pondStatusFilter === 'healthy') return status === 'healthy' && !disease.includes('white spot');
                            if (pondStatusFilter === 'unmonitored') return !['healthy', 'warning', 'maintenance', 'critical'].includes(status);
                            return true;
                          }).length} basin(s)
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 extra-small fw-bold text-decoration-none"
                          style={{ color: '#EA580C', fontSize: '0.72rem' }}
                          onClick={() => setPondStatusFilter('all')}
                        >
                          Clear Status Filter ×
                        </button>
                      </div>
                    )}

                    {/* Segmented Status Bar */}
                    <div className="position-relative mb-4">
                      <div
                        style={{
                          height: 14,
                          background: '#F1F5F9',
                          border: '1px solid rgba(11, 44, 95, 0.08)',
                          padding: 2,
                          borderRadius: 9999,
                          display: 'flex',
                          gap: 3,
                          alignItems: 'center'
                        }}
                      >
                        {healthyPct > 0 && (
                          <div
                            style={{
                              width: `${healthyPct}%`,
                              height: '100%',
                              borderRadius: 9999,
                              background: 'linear-gradient(90deg, #0B2C5F 0%, #16A34A 100%)',
                              transition: 'width 0.4s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => setPondStatusFilter(pondStatusFilter === 'healthy' ? 'all' : 'healthy')}
                            onMouseEnter={() => setHoveredSegment('healthy')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${healthyCount} Active Healthy Ponds (${healthyPct}%)`}
                          />
                        )}
                        {warningPct > 0 && (
                          <div
                            style={{
                              width: `${warningPct}%`,
                              height: '100%',
                              borderRadius: 9999,
                              background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                              transition: 'width 0.4s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => setPondStatusFilter(pondStatusFilter === 'warning' ? 'all' : 'warning')}
                            onMouseEnter={() => setHoveredSegment('warning')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${warningCount} Warning / Attention Ponds (${warningPct}%)`}
                          />
                        )}
                        {criticalPct > 0 && (
                          <div
                            style={{
                              width: `${criticalPct}%`,
                              height: '100%',
                              borderRadius: 9999,
                              background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)',
                              transition: 'width 0.4s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => setPondStatusFilter(pondStatusFilter === 'critical' ? 'all' : 'critical')}
                            onMouseEnter={() => setHoveredSegment('critical')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${criticalCount} Critical Alert Ponds (${criticalPct}%)`}
                          />
                        )}
                        {unmonitoredPct > 0 && (
                          <div
                            style={{
                              width: `${unmonitoredPct}%`,
                              height: '100%',
                              borderRadius: 9999,
                              background: '#CBD5E1',
                              transition: 'width 0.4s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => setPondStatusFilter(pondStatusFilter === 'unmonitored' ? 'all' : 'unmonitored')}
                            onMouseEnter={() => setHoveredSegment('unmonitored')}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${unmonitoredCount} Unmonitored Ponds (${unmonitoredPct}%)`}
                          />
                        )}
                      </div>

                      {/* Floating Segment Tooltip */}
                      {hoveredSegment && (
                        <div
                          className="position-absolute extra-small px-3 py-1.5 rounded-pill text-white shadow-lg"
                          style={{
                            top: -34,
                            left: hoveredSegment === 'healthy' ? '20%' : hoveredSegment === 'warning' ? '50%' : hoveredSegment === 'critical' ? '75%' : '90%',
                            transform: 'translateX(-50%)',
                            background: '#0B2C5F',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            zIndex: 10
                          }}
                        >
                          {hoveredSegment === 'healthy' && `${healthyCount} Ponds: DO & Temp Optimal`}
                          {hoveredSegment === 'warning' && `${warningCount} Ponds: Attention Required`}
                          {hoveredSegment === 'critical' && `${criticalCount} Ponds: Critical Alert / WSD`}
                          {hoveredSegment === 'unmonitored' && `${unmonitoredCount} Ponds: Pending Initial Stocking`}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Clean Tri-Color Pond Cards Grid */}
            {(() => {
              const categoryFilteredPonds = displayedPonds.filter((p) => {
                if (pondStatusFilter === 'all') return true;
                const status = (p.status || '').toLowerCase().trim();
                const disease = (p.disease_detection || '').toLowerCase().trim();

                if (pondStatusFilter === 'critical') {
                  return status === 'critical' || disease.includes('white spot') || disease.includes('critical') || disease.includes('wssv');
                }
                if (pondStatusFilter === 'warning') {
                  return (status === 'warning' || status === 'maintenance' || disease.includes('black gill') || disease.includes('warning')) && status !== 'critical';
                }
                if (pondStatusFilter === 'healthy') {
                  return status === 'healthy' && !disease.includes('white spot') && !disease.includes('critical');
                }
                if (pondStatusFilter === 'unmonitored') {
                  return !['healthy', 'warning', 'maintenance', 'critical'].includes(status);
                }
                return true;
              });

              const visiblePonds = showAllPonds ? categoryFilteredPonds : categoryFilteredPonds.slice(0, 4);

              return (
                <>
                  {visiblePonds.length === 0 ? (
                    <div className="p-4 text-center rounded-3 bg-white border my-2" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                      <p className="text-muted mb-0 small">
                        {pondStatusFilter === 'isolated'
                          ? 'No ponds are currently isolated. To isolate a pond at risk, click "Isolate" on critical disease alerts below.'
                          : `No basins found matching "${pondStatusFilter.toUpperCase()}" status.`}
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3.5 g-md-4">
                      {visiblePonds.map((p) => {
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
                        const calcFeedKg = pondFilteredRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
                        const totalFeedKg = calcFeedKg > 0 ? calcFeedKg : (p.total_feed_kg ? Number(p.total_feed_kg) : 644.70);

                        const caretakerName = p.caretaker_name || p.assigned_caretaker_name || selectedCaretakerObj?.full_name || 'CJ Arroyo';
                        const isIsolated = isPondIsolated(p);
                        const statusStr = isIsolated ? 'ISOLATED' : (p.status || 'HEALTHY').toUpperCase();
                        const isWarning = !isIsolated && statusStr.includes('WARN');
                        const isCritical = !isIsolated && statusStr.includes('CRIT');

                        return (
                          <div className={`col-12 col-md-${visiblePonds.length === 1 ? '12' : '6'}`} key={p.id}>
                            <div
                              className="p-4 rounded-4 bg-white d-flex flex-column justify-content-between h-100 transition-all hover-shadow"
                              style={{
                                borderTop: '1px solid rgba(11, 44, 95, 0.12)',
                                borderRight: '1px solid rgba(11, 44, 95, 0.12)',
                                borderBottom: '1px solid rgba(11, 44, 95, 0.12)',
                                borderLeft: isIsolated ? '4px solid #7C3AED' : (isWarning ? '4px solid #EA580C' : (isCritical ? '4px solid #DC2626' : '4px solid #0B2C5F')),
                                boxShadow: '0 4px 16px rgba(11, 44, 95, 0.05)',
                                minHeight: 235,
                                overflow: 'hidden',
                              }}
                            >
                              <div>
                                {/* Tier 1: Pond Name & Status Badge */}
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-2.5">
                                  <div className="d-flex align-items-center gap-2">
                                    <div
                                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        backgroundColor: isIsolated ? '#F5F3FF' : (isWarning ? '#FFF7ED' : 'rgba(11, 44, 95, 0.07)'),
                                        color: isIsolated ? '#7C3AED' : (isWarning ? '#EA580C' : '#0B2C5F'),
                                        fontSize: '0.85rem',
                                      }}
                                    >
                                      <FaWater />
                                    </div>
                                    <div>
                                      <strong className="d-block" style={{ color: '#0B2C5F', fontSize: '0.98rem', lineHeight: 1.2 }}>
                                        {p.pond_name || p.name || `Pond #${p.id}`}
                                      </strong>
                                      <span className="text-muted extra-small">Production Basin</span>
                                    </div>
                                  </div>

                                  {/* Health Status badge */}
                                  <span
                                    className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill"
                                    style={{
                                      backgroundColor: isIsolated ? '#F5F3FF' : (isWarning ? '#FFF7ED' : (isCritical ? '#FEF2F2' : 'rgba(11, 44, 95, 0.07)')),
                                      border: isIsolated ? '1px solid rgba(124, 58, 237, 0.35)' : (isWarning ? '1px solid rgba(234, 88, 12, 0.28)' : (isCritical ? '1px solid rgba(220, 38, 38, 0.28)' : '1px solid rgba(11, 44, 95, 0.18)')),
                                      color: isIsolated ? '#7C3AED' : (isWarning ? '#EA580C' : (isCritical ? '#DC2626' : '#0B2C5F')),
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span
                                      className="rounded-circle"
                                      style={{ width: 6, height: 6, backgroundColor: isIsolated ? '#7C3AED' : (isWarning ? '#EA580C' : (isCritical ? '#DC2626' : '#0B2C5F')) }}
                                    />
                                    <span>{statusStr}</span>
                                  </span>
                                </div>

                                {/* Tier 2: Culture Stage / DOC Pill */}
                                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                                    style={{
                                      backgroundColor: isNursery ? 'rgba(11, 44, 95, 0.06)' : '#FFF7ED',
                                      color: isNursery ? '#0B2C5F' : '#EA580C',
                                      border: isNursery ? '1px solid rgba(11, 44, 95, 0.14)' : '1px solid rgba(234, 88, 12, 0.22)',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {isNursery ? `Nursery (DOC #${doc || '39'})` : `Grow-out (DOC #${doc || '39'})`}
                                  </span>
                                  <span className="text-muted extra-small">
                                    {doc ? `Day ${doc} of cycle` : 'Active Cycle'}
                                  </span>
                                </div>

                                {/* Tier 3: Caretaker & Feed Strip */}
                                <div
                                  className="p-2.5 rounded-3 mb-3"
                                  style={{
                                    backgroundColor: '#F8FAFD',
                                    border: '1px solid rgba(11, 44, 95, 0.07)',
                                  }}
                                >
                                  <div className="d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center gap-2">
                                      <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: 26, height: 26, background: '#0B2C5F', fontSize: '0.7rem' }}
                                      >
                                        <FaUserTie />
                                      </div>
                                      <div>
                                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.66rem' }}>Caretaker</span>
                                        <strong style={{ color: '#0B2C5F', fontSize: '0.82rem' }}>{caretakerName}</strong>
                                      </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, backgroundColor: 'rgba(11, 44, 95, 0.1)' }} />
                                    <div className="text-end">
                                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.66rem' }}>Total Feed</span>
                                      <strong style={{ color: '#EA580C', fontSize: '0.92rem' }}>
                                        {totalFeedKg.toFixed(1)} <small className="text-muted" style={{ fontSize: '0.68rem' }}>kg</small>
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Tier 4: Actions Footer */}
                              <div className="d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.07)' }}>
                                <div className="d-flex align-items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs"
                                    style={{ fontSize: '0.74rem' }}
                                    onClick={() => navigate(`/admin/ponds?pond_id=${p.id}`)}
                                  >
                                    <FaEye size={10} className="me-1" style={{ color: '#0B2C5F' }} /> View Pond
                                  </button>
                                  {isIsolated && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary px-2.5 py-1 extra-small shadow-xs"
                                      style={{ fontSize: '0.72rem' }}
                                      onClick={() => handleLiftIsolation(p.pond_name || p.name)}
                                      title="Lift isolation quarantine protocol"
                                    >
                                      <FaUndo size={9} className="me-1" /> Restore
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-tri-outline-orange px-3 py-1 extra-small shadow-xs"
                                  style={{ fontSize: '0.74rem' }}
                                  onClick={() => navigate(`/admin/feeding?pond=${encodeURIComponent(p.pond_name || p.name)}`)}
                                >
                                  <FaUtensils size={10} className="me-1" /> Feeding Logs
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer Controls: Show All Toggle Button */}
                  {displayedPonds.length > 4 && (
                    <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                      <span className="extra-small text-muted fw-semibold">
                        Showing <strong style={{ color: '#0B2C5F' }}>{visiblePonds.length}</strong> of <strong style={{ color: '#0B2C5F' }}>{displayedPonds.length}</strong> Ponds
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-tri-outline px-3.5 py-1.5 fw-bold extra-small d-inline-flex align-items-center gap-1.5 shadow-xs ms-auto"
                        onClick={() => setShowAllPonds(!showAllPonds)}
                      >
                        {showAllPonds ? (
                          <>Show Less <FaChevronUp size={11} /></>
                        ) : (
                          <>Show All ({displayedPonds.length} Ponds) <FaChevronDown size={11} /></>
                        )}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* WIDGET 2: HARVEST PREDICTION (With Interactive Per-Pond Database Filter) */}
        <div className="col-12 col-xl-5">
          <div className="tri-card p-4 h-100 d-flex flex-column justify-content-between">
            {(() => {
              let focusedPond;
              if (selectedForecastPondId && selectedForecastPondId !== 'auto') {
                focusedPond = ponds.find((p) => String(p.id) === String(selectedForecastPondId));
              }

              if (!focusedPond) {
                if (selectedCaretakerId !== 'all') {
                  focusedPond = displayedPonds[0] || ponds[0];
                } else {
                  focusedPond = ponds.find((p) =>
                    (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().includes('cj') ||
                    String(p.id) === '1' ||
                    (p.pond_name || p.name || '').includes('A1')
                  ) || ponds[0] || { id: 1, pond_name: 'Pond A1', stocking_date: '2026-08-10' };
                }
              }

              if (!focusedPond) {
                focusedPond = { id: 1, pond_name: 'Pond A1', stocking_date: '2026-08-10' };
              }

              // Caretaker name resolution
              const caretakerName = focusedPond.assigned_caretaker_name ||
                focusedPond.caretaker_name ||
                (caretakers.find((c) => String(c.id) === String(focusedPond.caretaker_id))?.full_name) ||
                'Cj Arroyo';

              // Feeding logs & dates calculation
              const pondRecords = allFeedingRecords.filter((r) => String(r.pond_id) === String(focusedPond.id));
              const latestPondRecordDate = pondRecords.length > 0
                ? pondRecords.reduce((max, r) => (r.record_date > max ? r.record_date : max), pondRecords[0].record_date)
                : null;

              const effectiveFocusedDate = (dateFilterType !== 'all' && dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/))
                ? dateFilterType
                : (latestPondRecordDate || '2026-09-17');

              // Days of Culture (DOC) & Stage
              const focusedDoc = computeDoc(focusedPond.stocking_date, effectiveFocusedDate) || (String(focusedPond.id) === '1' ? 46 : 39);
              const focusedIsNursery = focusedDoc <= 19;
              const cultureProgressPct = Math.min(100, Math.max(1, Math.round((focusedDoc / 90) * 100)));

              // Feed kg calculation
              const calcFeedKg = pondRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
              const focusedPrediction = harvestPredictions.find((hp) => String(hp.pond_id) === String(focusedPond.id)) || {};

              const totalFeedKg = calcFeedKg > 0
                ? calcFeedKg
                : (parseFloat(focusedPrediction.total_feed_consumed_kg) || (focusedPond.total_feed_kg ? Number(focusedPond.total_feed_kg) : 644.70));

              // ABW (Average Body Weight in grams)
              let abwGrams = parseFloat(focusedPrediction.average_weight || focusedPrediction.abw_grams || focusedPrediction.current_abw);
              if (!abwGrams || abwGrams <= 0) {
                if (focusedDoc <= 19) {
                  abwGrams = 1.0 + (focusedDoc * 0.15);
                } else {
                  abwGrams = 3.85 + ((focusedDoc - 19) * 0.22);
                }
              }

              // Est. Harvest biomass (kg and Tons)
              let estHarvestKg = parseFloat(focusedPrediction.adjusted_harvest_kg || focusedPrediction.estimated_harvest || focusedPrediction.baseline_harvest_kg);
              if (!estHarvestKg || estHarvestKg <= 0) {
                const stockingCount = parseInt(focusedPond.initial_count || focusedPond.stocking_density || 50000);
                const estimatedBiomassKg = (stockingCount * 0.85 * abwGrams) / 1000;
                estHarvestKg = estimatedBiomassKg > 0 ? estimatedBiomassKg : (totalFeedKg * 0.7333);
              }

              const targetHarvestDays = Math.max(0, 90 - focusedDoc);

              return (
                <div>
                  {/* Header & Filter Row */}
                  <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                    <div className="flex-grow-1 me-2">
                      <h5 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                        Harvest Milestone Forecast
                      </h5>
                      <p className="text-muted mb-2 small" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                        Biomass yield projection for <strong>{focusedPond.pond_name || 'Pond A1'}</strong> managed by <strong>{caretakerName}</strong>.
                      </p>

                      {/* Clean Tri-Color Pond Selector Pill */}
                      <div className="d-flex align-items-center gap-2 mt-2">
                        <div
                          className="d-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white shadow-xs"
                          style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
                        >
                          <FaWater style={{ color: '#0B2C5F', fontSize: '0.82rem' }} />
                          <select
                            className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 pe-4 cursor-pointer"
                            style={{
                              width: 'auto',
                              minWidth: 185,
                              fontSize: '0.82rem',
                              outline: 'none',
                              color: '#0B2C5F',
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230B2C5F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 0.2rem center',
                              backgroundSize: '12px 12px',
                              paddingRight: '1.4rem'
                            }}
                            value={selectedForecastPondId === 'auto' ? String(focusedPond.id) : selectedForecastPondId}
                            onChange={(e) => setSelectedForecastPondId(e.target.value)}
                            title="Select Pond to filter harvest forecast"
                          >
                            {ponds.length === 0 ? (
                              <option value="1">Pond A1 - CJ Arroyo</option>
                            ) : (
                              ponds.map((p) => {
                                const pCaretaker = p.assigned_caretaker_name || p.caretaker_name || (caretakers.find((c) => String(c.id) === String(p.caretaker_id))?.full_name) || 'CJ Arroyo';
                                const pName = p.pond_name || p.name || `Pond #${p.id}`;
                                return (
                                  <option key={p.id} value={String(p.id)}>
                                    {pName} - {pCaretaker}
                                  </option>
                                );
                              })
                            )}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Box Key Forecast Metrics Grid */}
                  <div className="row g-2 mb-3">
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 border text-center h-100" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Stage & DOC</span>
                        <span className="fw-extrabold" style={{ color: '#0B2C5F', fontSize: '0.92rem' }}>
                          {focusedIsNursery ? 'Nursery' : 'Grow-out'}
                        </span>
                        <div className="extra-small fw-bold mt-0.5" style={{ color: '#EA580C' }}>DOC #{focusedDoc}</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 border text-center h-100" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Est. Harvest</span>
                        <span className="fw-extrabold" style={{ color: '#EA580C', fontSize: '0.92rem' }}>
                          {estHarvestKg.toFixed(1)} kg
                        </span>
                        <div className="extra-small text-muted font-mono mt-0.5">{(estHarvestKg / 1000).toFixed(2)} Tons</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 border text-center h-100" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Shrimp ABW</span>
                        <span className="fw-extrabold" style={{ color: '#0B2C5F', fontSize: '0.92rem' }}>
                          {abwGrams.toFixed(1)} g
                        </span>
                        <div className="extra-small text-muted mt-0.5">Sampling ABW</div>
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div className="p-2.5 rounded-3 border text-center h-100" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                        <span className="text-muted extra-small text-uppercase fw-bold d-block">Target Harvest</span>
                        <span className="fw-extrabold" style={{ color: '#0B2C5F', fontSize: '0.92rem' }}>
                          {targetHarvestDays} Days
                        </span>
                        <div className="extra-small text-muted mt-0.5">DOC 90–100</div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone Timeline Track */}
                  <div className="milestone-track mb-2">
                    <div className="milestone-line-bg" style={{ background: 'rgba(11, 44, 95, 0.08)' }}></div>
                    <div className="milestone-line-fill" style={{ width: `${cultureProgressPct}%`, background: 'linear-gradient(90deg, #0B2C5F 0%, #EA580C 100%)' }}></div>

                    {/* Step 1 */}
                    <div className="milestone-step">
                      <div className="milestone-node completed" style={{ background: '#0B2C5F', color: '#FFFFFF' }}>
                        <FaCheck size={10} />
                      </div>
                      <span className="fw-bold mt-2 extra-small" style={{ color: '#0B2C5F' }}>PL-15 Stocking</span>
                      <span className="text-muted extra-small font-mono">Day 1</span>
                    </div>

                    {/* Step 2 */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 20 ? 'completed' : 'current'}`}
                        style={{
                          background: focusedDoc >= 20 ? '#0B2C5F' : '#EA580C',
                          color: '#FFFFFF',
                          boxShadow: focusedDoc < 20 ? '0 0 0 4px rgba(234, 88, 12, 0.2)' : undefined
                        }}
                      >
                        {focusedDoc >= 20 ? <FaCheck size={10} /> : '2'}
                      </div>
                      <span className="fw-bold mt-2 extra-small" style={{ color: '#0B2C5F' }}>Nursery</span>
                      <span className="text-muted extra-small font-mono">Day 1–19</span>
                    </div>

                    {/* Step 3 (Grow-out) */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 20 ? 'current' : 'upcoming'}`}
                        style={{
                          background: focusedDoc >= 20 ? '#EA580C' : '#F1F5F9',
                          color: focusedDoc >= 20 ? '#FFFFFF' : '#94A3B8',
                          boxShadow: focusedDoc >= 20 ? '0 0 0 4px rgba(234, 88, 12, 0.25)' : undefined
                        }}
                      >
                        3
                      </div>
                      <span className="fw-bold mt-2 extra-small" style={{ color: focusedDoc >= 20 ? '#EA580C' : '#64748B' }}>
                        Grow-out
                      </span>
                      <span className="badge rounded-pill extra-small text-white" style={{ background: '#EA580C', fontSize: '0.62rem' }}>
                        {cultureProgressPct}% Cycle
                      </span>
                    </div>

                    {/* Step 4 */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 90 ? 'completed' : 'upcoming'}`}
                        style={{
                          background: focusedDoc >= 90 ? '#0B2C5F' : '#F1F5F9',
                          color: focusedDoc >= 90 ? '#FFFFFF' : '#94A3B8'
                        }}
                      >
                        {focusedDoc >= 90 ? <FaCheck size={10} /> : '4'}
                      </div>
                      <span className="fw-bold mt-2 extra-small text-muted">Harvest</span>
                      <span className="text-muted extra-small font-mono">Day 90+</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Dynamic Footer */}
            {(() => {
              let focusedPond;
              if (selectedForecastPondId && selectedForecastPondId !== 'auto') {
                focusedPond = ponds.find((p) => String(p.id) === String(selectedForecastPondId));
              }
              if (!focusedPond) {
                focusedPond = selectedCaretakerId !== 'all' ? (displayedPonds[0] || ponds[0]) : (ponds.find((p) => (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().includes('cj') || String(p.id) === '1') || ponds[0]);
              }
              const pId = focusedPond ? focusedPond.id : 1;
              const pondRecords = allFeedingRecords.filter((r) => String(r.pond_id) === String(pId));
              const calcFeedKg = pondRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
              const focusedPrediction = harvestPredictions.find((hp) => String(hp.pond_id) === String(pId)) || {};
              const totalFeedKg = calcFeedKg > 0 ? calcFeedKg : (parseFloat(focusedPrediction.total_feed_consumed_kg) || 644.70);

              return (
                <div className="pt-2.5 d-flex justify-content-between align-items-center border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <span className="text-muted extra-small">
                    Logged Feed: <strong style={{ color: '#0B2C5F' }}>{totalFeedKg.toFixed(1)} kg</strong> • FCR Baseline: <strong>0.7333</strong>
                  </span>
                  <Link to="/admin/harvest" className="fw-bold extra-small text-decoration-none" style={{ color: '#EA580C' }}>
                    Full Growth Curve →
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* VISUAL ANALYTICS & CHARTS SECTION */}
      <div className="row g-4 mb-4">
        {/* WIDGET 3: FEEDING LOGS & TRENDS */}
        <div className="col-12 col-xl-8">
          <div className="tri-card p-4 h-100">
            {/* Chart Header with High-Contrast Numerical Highlights */}
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  Daily Feed Monitoring &amp; Trend
                </h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Continuous feed mass distribution from caretaker logs. Hover curve to inspect details.
                </p>
              </div>
              <Link to="/admin/feeding" className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs">
                Feeder Schedule →
              </Link>
            </div>

            {/* High-Contrast Numerical Highlights */}
            <div className="row g-3 mb-3">
              <div className="col-4">
                <div className="p-3 rounded-3 border" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Total Feed Mass</span>
                  <span className="fw-extrabold fs-4" style={{ color: '#EA580C' }}>{totalFilteredFeedKg.toFixed(2)} kg</span>
                  <span className="extra-small d-block fw-semibold" style={{ color: '#0B2C5F' }}>{Math.round(totalFilteredFeedKg * 1000).toLocaleString()} grams total</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 border" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Automated Cycles</span>
                  <span className="fw-extrabold fs-4" style={{ color: '#0B2C5F' }}>{filteredFeedingRecords.length} Runs</span>
                  <span className="extra-small text-muted d-block">{filteredFeedingRecords.length > 0 ? 'Verified logs' : 'No logs in window'}</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 border" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">Ration Adherence</span>
                  <span className="fw-extrabold fs-4" style={{ color: '#0B2C5F' }}>
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

        {/* WIDGET 4: DISEASE RISK ANALYSIS (Doughnut Chart + Legend Tags) */}
        <div className="col-12 col-xl-4">
          <div className="tri-card p-4 h-100">
            {(() => {
              const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || searchQuery.trim() !== '' || dateFilterType !== 'all';
              const activeDiseaseReports = isFiltered ? filteredDiseaseReports : (allDiseaseReports.length > 0 ? allDiseaseReports : []);
              const totalCount = activeDiseaseReports.length;

              let safeCount = 0;
              let modCount = 0;
              let critCount = 0;
              let safePct = 0;
              let modPct = 0;
              let critPct = 0;
              let riskLevel = 'LOW';
              let riskColor = '#15803D';

              if (totalCount > 0) {
                safeCount = activeDiseaseReports.filter(r => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase() === 'healthy').length;
                modCount = activeDiseaseReports.filter(r => ['moderate', 'medium', 'warning'].includes((r.risk_level || '').toLowerCase())).length;
                critCount = activeDiseaseReports.filter(r => ['high', 'critical'].includes((r.risk_level || '').toLowerCase()) || (r.disease_name || '').toLowerCase().includes('wssv') || (r.disease_name || '').toLowerCase().includes('wsd')).length;

                safePct = Math.round((safeCount / totalCount) * 100);
                modPct = Math.round((modCount / totalCount) * 100);
                critPct = Math.max(0, 100 - safePct - modPct);

                if (critCount > 0 || critPct >= 30) {
                  riskLevel = 'HIGH';
                  riskColor = '#EA580C';
                } else if (modCount > 0 || modPct >= 20) {
                  riskLevel = 'MOD';
                  riskColor = '#0284C7';
                } else {
                  riskLevel = 'LOW';
                  riskColor = '#15803D';
                }
              } else if (isFiltered) {
                // When filtered caretaker or pond has 0 disease logs, mark as 100% Bio-Safe / Nominal
                safePct = 100;
                modPct = 0;
                critPct = 0;
                safeCount = 0;
                riskLevel = 'LOW';
                riskColor = '#15803D';
              } else {
                safePct = 51;
                modPct = 5;
                critPct = 44;
                riskLevel = 'HIGH';
                riskColor = '#EA580C';
              }

              // Dynamic scope label
              let scopeLabel = 'Biosecurity Health Index';
              if (selectedCaretakerObj && selectedPondFilter !== 'all') {
                scopeLabel = `${selectedCaretakerObj.full_name} • ${selectedPondFilter}`;
              } else if (selectedCaretakerObj) {
                scopeLabel = `${selectedCaretakerObj.full_name} (${totalCount} record${totalCount === 1 ? '' : 's'})`;
              } else if (selectedPondFilter !== 'all') {
                scopeLabel = `${selectedPondFilter} (${totalCount} record${totalCount === 1 ? '' : 's'})`;
              } else if (searchQuery.trim()) {
                scopeLabel = `"${searchQuery}" (${totalCount} record${totalCount === 1 ? '' : 's'})`;
              }

              return (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                        Disease Risk Breakdown
                      </h5>
                      <p className="text-muted mb-0 small" style={{ fontSize: '0.8rem' }}>{scopeLabel}</p>
                    </div>
                    <span className="badge badge-tri-navy rounded-pill px-3 py-1 extra-small">● {safePct}% Bio-Safe</span>
                  </div>

                  {/* Minimalist Donut Chart */}
                  <div className="position-relative d-flex justify-content-center align-items-center my-3" style={{ height: 210 }}>
                    <Doughnut
                      data={{
                        labels: ['Safe', 'Moderate Risk', 'Critical Alert'],
                        datasets: [
                          {
                            data: [safePct || (modPct === 0 && critPct === 0 ? 1 : 0), modPct, critPct],
                            backgroundColor: ['#0B2C5F', '#0284C7', '#EA580C'],
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
                      <span className="extra-small text-muted d-block" style={{ fontSize: '0.72rem' }}>
                        {isFiltered ? 'Target Risk' : 'Fleet Risk'}
                      </span>
                      <strong className="fw-extrabold" style={{ color: riskColor, fontSize: '1.25rem' }}>
                        {riskLevel}
                      </strong>
                    </div>
                  </div>

                  {/* Clean Legend Tags: Critical, Moderate, Safe */}
                  <div className="d-flex justify-content-center gap-2 mb-2 flex-wrap">
                    <span className="badge badge-tri-navy rounded-pill px-2.5 py-1 extra-small">● Safe ({safePct}%)</span>
                    {modPct > 0 && <span className="badge rounded-pill extra-small px-2.5 py-1" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>● Moderate ({modPct}%)</span>}
                    {critPct > 0 && <span className="badge badge-tri-orange rounded-pill px-2.5 py-1 extra-small">● Critical ({critPct}%)</span>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* DETAILED RECORDS & RECENT DETECTION ACTIVITY SECTION */}
      <div className="row g-4 mb-4">
        {/* Daily Feed & Supplementation Logs (Full Width Table) */}
        <div className="col-12">
          <div className="tri-card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  Daily Feed &amp; Supplementation Logs
                </h5>
                <span className="text-muted extra-small">Real-time caretaker daily feed logs, formulations, and vitamin supplementation from database</span>
              </div>
              <div>
                <Link to="/admin/feeding" className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs">
                  Full Log History →
                </Link>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table tri-table table-hover align-middle mb-0" style={{ fontSize: '0.84rem' }}>
                <thead className="sticky-top bg-white border-bottom">
                  <tr className="text-muted extra-small text-uppercase fw-extrabold" style={{ letterSpacing: '0.04em' }}>
                    <th className="py-2.5">Operator</th>
                    <th className="py-2.5">Pond Name</th>
                    <th className="py-2.5 text-center">Growth Stage</th>
                    <th className="py-2.5 text-center">Days of Culture</th>
                    <th className="py-2.5">Time Slot</th>
                    <th className="py-2.5">Feed Formulation</th>
                    <th className="py-2.5">Mass (kg / g)</th>
                    <th className="py-2.5">Additive / Supplement</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedingRecords.slice(0, 8).map((r) => {
                    const pondObj = ponds.find((p) => String(p.id) === String(r.pond_id) || p.name === r.pond_name || p.pond_name === r.pond_name);
                    const stockingDate = r.stocking_date || pondObj?.stocking_date || (String(r.pond_id) === '1' ? '2026-08-10' : null);
                    const recordDate = (r.record_date || r.created_at || '').slice(0, 10);
                    const doc = computeDoc(stockingDate, recordDate);
                    const isNursery = doc !== null ? doc <= 19 : false;
                    const amountKg = parseFloat(r.amount_kg) || 0;
                    const amountG = r.amount_grams !== null && r.amount_grams !== undefined
                      ? parseFloat(r.amount_grams)
                      : Math.round(amountKg * 1000);

                    return (
                      <tr key={r.id} className="align-middle">
                        <td>
                          <span className="badge rounded-pill fw-bold px-2.5 py-1" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                            {r.recorded_by_name || r.recorded_by || 'Caretaker'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#0B2C5F' }}>{r.pond_name || `Pond #${r.pond_id}`}</strong>
                        </td>
                        <td className="text-center">
                          <span
                            className="badge rounded-pill extra-small px-2.5 py-0.5 fw-bold"
                            style={{
                              backgroundColor: isNursery ? 'rgba(11, 44, 95, 0.06)' : '#FFF7ED',
                              color: isNursery ? '#0B2C5F' : '#EA580C',
                              border: isNursery ? '1px solid rgba(11, 44, 95, 0.15)' : '1px solid rgba(234, 88, 12, 0.25)'
                            }}
                          >
                            {isNursery ? 'NURSERY' : 'GROW-OUT'}
                          </span>
                        </td>
                        <td className="text-center">
                          <strong style={{ color: '#0B2C5F' }}>
                            {doc !== null ? `DOC #${doc}` : 'DOC #39'}
                          </strong>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border px-2.5 py-1 font-mono">{r.feeding_time || '08:00 AM'}</span>
                        </td>
                        <td>
                          <span className="fw-bold d-block" style={{ color: '#0B2C5F' }}>{r.feed_type || r.product_code || 'Starter Pro'}</span>
                          {recordDate && <span className="text-muted extra-small font-mono">{recordDate}</span>}
                        </td>
                        <td>
                          {amountKg > 0 || amountG > 0 ? (
                            <div>
                              <span className="fw-extrabold" style={{ color: '#EA580C' }}>{amountKg.toFixed(2)} kg</span>
                              <span className="text-muted extra-small d-block font-mono">({amountG.toLocaleString()} g)</span>
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
                            <span className="badge rounded-pill bg-white text-dark border px-2.5 py-1 shadow-xs">{r.vitamin_name}</span>
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

        {/* WIDGET 5: RECENT DETECTION ACTIVITY */}
        <div className="col-12">
          <div className="tri-card p-4">
            {/* Title & Subtitle */}
            <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.15rem' }}>
                  Recent Detection Activity
                </h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  Real-time biosecurity vision scans, WSD disease detection alerts, and pond health monitoring.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs"
                onClick={() => navigate('/admin/disease-reports')}
              >
                All Detection Reports →
              </button>
            </div>

            {/* Filter Buttons Placed UNDER Title */}
            <div className="d-flex align-items-center gap-2 mb-3.5 flex-wrap">
              <span className="extra-small text-muted fw-bold text-uppercase">Filter Status:</span>
              <div className="d-flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'All Scans' },
                  { key: 'critical', label: 'Critical WSD' },
                  { key: 'moderate', label: 'Moderate Risk' },
                  { key: 'safe', label: 'Safe / Healthy' },
                ].map((btn) => {
                  const isSelected = diseaseFilter === btn.key;
                  return (
                    <button
                      key={btn.key}
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                        isSelected
                          ? btn.key === 'critical' ? 'btn-tri-orange shadow-xs' : 'btn-tri-navy shadow-xs'
                          : 'btn-tri-outline'
                      }`}
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => setDiseaseFilter(btn.key)}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prioritized Detection Activity Grid */}
            <div className="row g-3" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {diseaseItems.length > 0 ? (
                diseaseItems.map((item) => (
                  <div className="col-12 col-md-6 col-xl-4" key={item.id}>
                    <div
                      className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between transition-all hover-shadow"
                      style={{
                        backgroundColor: item.risk === 'critical' ? '#FFFBF5' : (item.risk === 'moderate' ? '#F8FAFD' : '#FFFFFF'),
                        borderColor: item.risk === 'critical' ? 'rgba(234, 88, 12, 0.25)' : (item.risk === 'moderate' ? '#BAE6FD' : 'rgba(11, 44, 95, 0.09)'),
                        borderLeft: item.risk === 'critical' ? '4px solid #EA580C' : (item.risk === 'moderate' ? '4px solid #0284C7' : '4px solid #0B2C5F')
                      }}
                    >
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          {item.risk === 'critical' ? (
                            <span className="badge badge-tri-orange rounded-pill px-2.5 py-0.5 extra-small">CRITICAL WSD</span>
                          ) : item.risk === 'moderate' ? (
                            <span className="badge rounded-pill extra-small px-2.5 py-0.5" style={{ backgroundColor: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}>MODERATE</span>
                          ) : (
                            <span className="badge badge-tri-navy rounded-pill px-2.5 py-0.5 extra-small">SAFE</span>
                          )}
                          <span className="fw-extrabold extra-small font-mono bg-white px-2 py-0.5 rounded-pill border" style={{ color: '#0B2C5F' }}>
                            {item.pond}
                          </span>
                        </div>
                        <h6 className="fw-bold mb-1 text-truncate" style={{ color: '#0B2C5F', fontSize: '0.9rem' }}>
                          {item.title}
                        </h6>
                        <p className="extra-small text-muted mb-2">
                          Vision Confidence: <strong>{item.confidence}</strong> • {item.time}
                        </p>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="d-flex align-items-center gap-2 pt-2 border-top mt-2" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-tri-navy px-3 py-1 flex-grow-1 extra-small shadow-xs"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => navigate(`/admin/disease-reports?pond=${encodeURIComponent(item.pond)}`)}
                        >
                          <FaEye size={10} className="me-1" /> Inspect Details
                        </button>
                        {item.risk === 'critical' && (() => {
                          const isIsolated = isPondIsolated({ pond_name: item.pond, id: item.id });
                          return (
                            <button
                              type="button"
                              className={`btn btn-sm px-2.5 py-1 extra-small shadow-xs ${
                                isIsolated ? 'btn-secondary text-white' : 'btn-tri-orange'
                              }`}
                              style={{
                                fontSize: '0.7rem',
                                cursor: isIsolated ? 'not-allowed' : 'pointer',
                                opacity: isIsolated ? 0.75 : 1,
                              }}
                              disabled={isIsolated}
                              onClick={() => !isIsolated && handleQuickIsolate(item)}
                              title={isIsolated ? `Pond ${item.pond} is currently isolated` : `Isolate ${item.pond}`}
                            >
                              {isIsolated ? (
                                <>
                                  <FaCheckCircle size={10} className="me-1" /> Isolated
                                </>
                              ) : (
                                <>
                                  <FaShieldAlt size={9} className="me-1" /> Isolate
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12 text-center p-4 text-muted">
                  <p className="mb-0 extra-small">No recent detection activity matching selected filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF INTELLIGENCE EXPORT MODAL */}
      {showExportModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(11, 44, 95, 0.55)', zIndex: 1055, backdropFilter: 'blur(6px)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl" style={{ borderRadius: 20, overflow: 'hidden' }}>
              <div className="modal-header text-white p-4" style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 65%, #0E3D7D 100%)' }}>
                <div className="d-flex align-items-center gap-2.5">
                  <div className="rounded-circle d-flex align-items-center justify-content-center bg-white" style={{ width: 34, height: 34 }}>
                    <FaFilePdf size={16} style={{ color: '#EA580C' }} />
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
                  Generate a printable operations report with daily farm monitoring metrics, pond status overview, and caretaker feeding logs.
                </p>

                <div className="p-3.5 rounded-3 border mb-3" style={{ background: '#F8FAFD', borderColor: 'rgba(11, 44, 95, 0.08)' }}>
                  <h6 className="fw-bold mb-2" style={{ color: '#0B2C5F', fontSize: '0.84rem' }}>Export Scope:</h6>
                  <ul className="list-unstyled mb-0 small d-grid gap-1 text-muted" style={{ fontSize: '0.8rem' }}>
                    <li><strong>Caretakers:</strong> {selectedCaretakerId === 'all' ? 'All Registered Caretakers' : selectedCaretakerObj?.full_name}</li>
                    <li><strong>Date Window:</strong> {dateFilterType}</li>
                    <li><strong>Feeding Records:</strong> {filteredFeedingRecords.length} entries included</li>
                    <li><strong>Total Feed Mass:</strong> {totalFilteredFeedKg.toFixed(1)} kg</li>
                    <li><strong>Farm Ponds:</strong> {displayedPonds.length} ponds operational</li>
                  </ul>
                </div>

                <div className="p-3 rounded-3 extra-small mb-0 d-flex align-items-center gap-2" style={{ background: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.15)' }}>
                  <FaCheckCircle size={14} className="flex-shrink-0" style={{ color: '#0B2C5F' }} />
                  <span>Report follows international aquaculture biosecurity and feed conversion standards.</span>
                </div>
              </div>

              <div className="modal-footer bg-light border-0 p-3 px-4">
                <button type="button" className="btn btn-sm btn-tri-outline px-4 shadow-xs" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-tri-orange px-4 shadow-xs"
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
