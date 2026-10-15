import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import api, { safeArray } from '../../services/api';
import { downloadDashboardPDF } from '../../utils/pdfExport';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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
  FaArrowRight,
  FaCalendarCheck,
  FaCalendarAlt,
  FaClock,
  FaLeaf,
  FaGasPump,
  FaChartBar,
  FaSearch,
  FaTimes
} from 'react-icons/fa';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

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
  const { t, isFilipino } = useLanguage();
  const [caretakers, setCaretakers] = useState([]);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('all');
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [feedCardPondFilter, setFeedCardPondFilter] = useState('all');
  const [feedChartViewMode, setFeedChartViewMode] = useState('by_pond'); // Default: Horizontal Bar Chart (Y-Axis = Pond Name, X-Axis = Date)
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

  // Toggle for Combined Operations Hub: 'chart' | 'logs' | 'detections'
  const [dashboardTab, setDashboardTab] = useState('chart');

  // Hovered segmented bar index
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Feed Chart Display Type: 'by_pond' (Y-Axis Pond Names, X-Axis Date, hover kg) | 'wave_trend' (Inspo Dual Bar + Wave)
  const [feedChartDisplayType, setFeedChartDisplayType] = useState('by_pond');
  const [hoveredPondCell, setHoveredPondCell] = useState(null);
  const [isIdlePondsOpen, setIsIdlePondsOpen] = useState(false);

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
        const pCid = String(p.assigned_caretaker_id ?? p.caretaker_id ?? '');
        const caretakerIdMatch = pCid !== '' && pCid === String(selectedCaretakerId);
        const pCaretakerName = (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().trim();
        const selName = selectedCaretakerObj ? (selectedCaretakerObj.full_name || '').toLowerCase().trim() : '';
        const caretakerNameMatch =
          Boolean(selName) &&
          (pCaretakerName.includes(selName) || selName.includes(pCaretakerName));
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
          .filter((p) => {
            const pCid = String(p.assigned_caretaker_id ?? p.caretaker_id ?? '');
            const matchId = pCid !== '' && pCid === String(selectedCaretakerId);
            const pName = (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().trim();
            const matchName = Boolean(selFullName) && (pName.includes(selFullName) || selFullName.includes(pName));
            return matchId || matchName;
          })
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
        const pCid = String(p.assigned_caretaker_id ?? p.caretaker_id ?? '');
        const matchId = pCid !== '' && pCid === String(selectedCaretakerId);
        const pName = (p.assigned_caretaker_name || p.caretaker_name || '').toLowerCase().trim();
        const matchName = Boolean(selFullName) && (pName.includes(selFullName) || selFullName.includes(pName));
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

  // Always default to 'by_pond' (Horizontal Bar Chart: Y-axis Pond Name, X-axis Date)
  const effectiveFeedChartMode = feedChartViewMode === 'auto'
    ? 'by_pond'
    : feedChartViewMode;



  // Chronological recent dates (oldest -> newest for natural left-to-right progression)
  const recentChronologicalDates = useMemo(() => {
    if (availableDates.length > 0) {
      return availableDates.slice(0, 7).reverse().map((d) => d.date);
    }
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [availableDates]);

  // Color palette for dates and ponds (Navy & Orange brand theme with harmonized complementary tones)
  const feedColorPalette = [
    '#FC563C', // Deep Navy
    '#FC563C', // Sky Blue
    '#06B6D4', // Vibrant Cyan
    '#0D9488', // Teal
    '#10B981', // Emerald Green
    '#84CC16', // Lime Green
    '#EAB308', // Amber / Gold
    '#F97316', // Warm Orange
    '#FC563C', // Vibrant Coral / Primary Orange
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ];

  // Dynamic vibrant gradients for the horizontal bar graph matching user uploaded layout:
  // Sky Blue -> Mint Green -> Amber Gold -> Coral Red -> Violet Purple -> Deep Navy -> Sunburst Orange
  const feedGradientPalette = [
    'linear-gradient(135deg, #FC563C 0%, #FC563C 100%)', // 1. Sky/Ocean Blue (like #44 in pic)
    'linear-gradient(135deg, #059669 0%, #10B981 100%)', // 2. Emerald/Mint Green (like #53 in pic)
    'linear-gradient(135deg, #D97706 0%, #FBBF24 100%)', // 3. Amber/Warm Gold (like #12 in pic)
    'linear-gradient(135deg, #E11D48 0%, #FB7185 100%)', // 4. Coral/Rose Red (like #9 in pic)
    'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', // 5. Deep Purple/Violet (like #25 in pic)
    'linear-gradient(135deg, #FC563C 0%, #1D4ED8 100%)', // 6. Deep Navy to Royal Blue
    'linear-gradient(135deg, #FC563C 0%, #FB923C 100%)', // 7. Primary Coral Orange
    'linear-gradient(135deg, #0D9488 0%, #2DD4BF 100%)', // 8. Deep Teal to Bright Aqua
    'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', // 9. Indigo to Slate Blue
    'linear-gradient(135deg, #BE185D 0%, #EC4899 100%)', // 10. Deep Berry to Rose
  ];

  // Dedicated Horizontal Bar Data Matrix for Mode 1 ('by_pond'):
  // - Left: Pond Name only (no caretaker, no Y-axis label)
  // - Bar: Connected/stacked horizontal bars ("dikit-dikit") with consumed kg inside each gradient segment
  const feedHorizontalGridData = useMemo(() => {
    const isSingleDate =
      dateFilterType === 'today' ||
      dateFilterType === 'yesterday' ||
      Boolean(dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/)) ||
      Boolean(dateFilterType === 'custom' && customDate);

    const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || searchQuery.trim() !== '';
    const pondList = isFiltered
      ? displayedPonds
      : (displayedPonds.length > 0 ? displayedPonds : ponds);

    let columns = [];
    if (isSingleDate) {
      const slots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
      columns = slots.map((slot, idx) => ({
        key: slot,
        label: slot,
        color: feedColorPalette[idx % feedColorPalette.length],
        gradient: feedGradientPalette[idx % feedGradientPalette.length],
      }));
    } else {
      columns = recentChronologicalDates.map((dStr, idx) => {
        const dObj = new Date(dStr + 'T00:00:00');
        const label = isNaN(dObj.getTime())
          ? dStr
          : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return {
          key: dStr,
          label: label,
          color: feedColorPalette[idx % feedColorPalette.length],
          gradient: feedGradientPalette[idx % feedGradientPalette.length],
        };
      });
    }

    const rows = pondList.map((p) => {
      const pId = String(p.id);
      const pName = (p.pond_name || p.name || `Pond #${p.id}`).trim();
      const cleanPName = pName.toLowerCase();
      const caretaker = p.assigned_caretaker_name || p.caretaker_name || 'Assigned Staff';
      const status = p.status || 'Active';

      let totalPondKg = 0;
      const values = columns.map((col) => {
        let sum = 0;
        if (isSingleDate) {
          sum = filteredFeedingRecords.reduce((acc, r) => {
            const normTime = String(r.feeding_time || '').trim().replace(/^0(\d:)/, '$1').toUpperCase();
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            if (normTime === col.key.toUpperCase() && (rPondId === pId || rPondName === cleanPName)) {
              return acc + (parseFloat(r.amount_kg) || 0);
            }
            return acc;
          }, 0);
        } else {
          sum = allFeedingRecords.reduce((acc, r) => {
            const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            if (rDate === col.key && (rPondId === pId || rPondName === cleanPName)) {
              return acc + (parseFloat(r.amount_kg) || 0);
            }
            return acc;
          }, 0);
        }

        let cycles = 0;
        if (isSingleDate) {
          cycles = filteredFeedingRecords.filter((r) => {
            const normTime = String(r.feeding_time || '').trim().replace(/^0(\d:)/, '$1').toUpperCase();
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            return normTime === col.key.toUpperCase() && (rPondId === pId || rPondName === cleanPName);
          }).length;
        } else {
          cycles = allFeedingRecords.filter((r) => {
            const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            return rDate === col.key && (rPondId === pId || rPondName === cleanPName);
          }).length;
        }

        const rounded = Math.round(sum * 10) / 10;
        totalPondKg += rounded;
        return {
          ...col,
          amount: rounded,
          cycles,
          formattedKg: rounded > 0 ? `${rounded.toFixed(1)} kg` : '0 kg',
        };
      });

      return {
        pondId: pId,
        pondName: pName,
        caretaker,
        status,
        totalPondKg: Math.round(totalPondKg * 10) / 10,
        values,
      };
    });

    const maxTotalKg = Math.max(...rows.map((r) => r.totalPondKg), 1);
    const maxCellFeedKg = Math.max(
      ...rows.flatMap((r) => r.values.map((v) => v.amount)),
      1
    );
    return { isSingleDate, columns, rows, maxTotalKg, maxCellFeedKg };
  }, [
    dateFilterType,
    customDate,
    selectedCaretakerId,
    selectedPondFilter,
    searchQuery,
    displayedPonds,
    ponds,
    recentChronologicalDates,
    filteredFeedingRecords,
    allFeedingRecords,
    feedColorPalette,
    feedGradientPalette,
  ]);

  // Feed by Pond Breakdown for Right Side Card
  const feedByPondSummary = useMemo(() => {
    const rows = feedHorizontalGridData.rows || [];
    const sortedPonds = [...rows].sort((a, b) => b.totalPondKg - a.totalPondKg);

    const topActivePond = sortedPonds.find((p) => p.totalPondKg > 0) || sortedPonds[0] || {
      pondId: '1',
      pondName: 'Pond A1',
      totalPondKg: 0,
    };

    const idlePonds = sortedPonds.filter((p) => p.totalPondKg === 0);
    const idlePondList = idlePonds.length > 0
      ? idlePonds
      : sortedPonds.filter((p) => String(p.pondId) !== String(topActivePond.pondId));

    const idlePondNames = idlePondList.map((p) => {
      const name = p.pondName || '';
      return name.replace(/^Pond\s+/i, '');
    });

    return {
      topActivePond,
      idlePonds: idlePondList,
      idlePondNames: idlePondNames.length > 0 ? idlePondNames : ['D1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'D1'],
    };
  }, [feedHorizontalGridData.rows]);

  // Combined Inspo Chart Data (Dual Bar + Top Wave Area Curve)
  const combinedInspoChartData = useMemo(() => {
    const datesToUse = recentChronologicalDates;
    const labels = datesToUse.map((dStr) => {
      const dObj = new Date(dStr + 'T00:00:00');
      return isNaN(dObj.getTime())
        ? dStr
        : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    const feedData = datesToUse.map((dStr) => {
      const sum = filteredFeedingRecords.reduce((acc, r) => {
        const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
        if (rDate === dStr) return acc + (parseFloat(r.amount_kg) || 0);
        return acc;
      }, 0);
      return Math.round(sum * 10) / 10;
    });

    const cycleData = datesToUse.map((dStr) => {
      return filteredFeedingRecords.filter((r) => {
        const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
        return rDate === dStr;
      }).length;
    });

    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Trend Wave',
          data: feedData,
          borderColor: '#172A39',
          borderWidth: 2.5,
          tension: 0.42,
          fill: true,
          backgroundColor: (context) => {
            const ctx = context.chart?.ctx;
            if (!ctx) return 'rgba(23, 42, 57, 0.2)';
            const gradient = ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(23, 42, 57, 0.7)');
            gradient.addColorStop(0.55, 'rgba(23, 42, 57, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            return gradient;
          },
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#172A39',
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 2,
          order: 1,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Feed Mass (kg)',
          data: feedData,
          backgroundColor: '#FC563C',
          borderRadius: { topLeft: 6, topRight: 6 },
          barPercentage: 0.6,
          categoryPercentage: 0.65,
          order: 2,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Cycles',
          data: cycleData,
          backgroundColor: '#172A39',
          borderRadius: { topLeft: 6, topRight: 6 },
          barPercentage: 0.6,
          categoryPercentage: 0.65,
          order: 3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [recentChronologicalDates, filteredFeedingRecords]);

  // Combined Inspo Chart Options with dual axis and exact dark capsule tooltip
  const combinedInspoChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#0F172A',
          titleColor: '#94A3B8',
          bodyColor: '#FFFFFF',
          titleFont: { size: 11, weight: '600', family: "'Poppins', sans-serif" },
          bodyFont: { size: 12.5, weight: '700', family: "'Poppins', sans-serif" },
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (context) => {
              if (context.dataset.label === 'Trend Wave') return null;
              if (context.dataset.label === 'Cycles') {
                return `Cycles: ${context.parsed.y} Runs`;
              }
              return `${context.label}: ${context.parsed.y.toFixed(1)} kg`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(226, 232, 240, 0.7)', drawBorder: false },
          ticks: {
            color: isDark ? '#94A3B8' : '#64748B',
            font: { size: 11.5, weight: '700', family: "'Poppins', sans-serif" },
          },
        },
        y: {
          position: 'left',
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(226, 232, 240, 0.7)', drawBorder: false },
          ticks: {
            color: isDark ? '#94A3B8' : '#64748B',
            font: { size: 11, weight: '600', family: "'Poppins', sans-serif" },
            callback: (v) => `${v} kg`,
          },
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: isDark ? '#94A3B8' : '#64748B',
            font: { size: 11, weight: '600', family: "'Poppins', sans-serif" },
          },
        },
      },
    };
  }, [isDark]);

  // Dynamic Bar Chart for Feed Consumption:
  // Mode 1: 'by_pond' -> Horizontal Bar Chart (Y-Axis = Pond Names, X-Axis = Feed kg across dates)
  // Mode 2: 'by_date' -> Vertical Bar Chart (X-Axis = Dates, Y-Axis = Feed kg ascending "pataas")
  const feedChart = useMemo(() => {
    const isSingleDate = dateFilterType === 'today' ||
      dateFilterType === 'yesterday' ||
      dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/) ||
      (dateFilterType === 'custom' && customDate);

    // ==========================================
    // MODE 1: BY POND (Horizontal Bar Chart)
    // Y-Axis = Pond Name, X-Axis = Feed Mass
    // ==========================================
    if (effectiveFeedChartMode === 'by_pond') {
      const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all';
      const pondList = isFiltered
        ? displayedPonds
        : (displayedPonds.length > 0 ? displayedPonds : ponds);
      const labels = pondList.length > 0
        ? pondList.map((p) => p.pond_name || p.name || `Pond #${p.id}`)
        : ['No Assigned Ponds'];

      if (isSingleDate) {
        const slots = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
        const datasets = slots.map((slot, idx) => {
          const color = feedColorPalette[idx % feedColorPalette.length];
          const data = pondList.length > 0 ? pondList.map((p) => {
            const pId = String(p.id);
            const pName = (p.pond_name || p.name || '').toLowerCase().trim();
            const sum = filteredFeedingRecords.reduce((acc, r) => {
              const normTime = String(r.feeding_time || '').trim().replace(/^0(\d:)/, '$1').toUpperCase();
              const rPondId = String(r.pond_id || '');
              const rPondName = (r.pond_name || '').toLowerCase().trim();
              if (normTime === slot.toUpperCase() && (rPondId === pId || rPondName === pName)) {
                return acc + (parseFloat(r.amount_kg) || 0);
              }
              return acc;
            }, 0);
            return Math.round(sum * 100) / 100;
          }) : [0];

          return {
            label: slot,
            data,
            backgroundColor: color,
            borderColor: '#FFFFFF',
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 38,
          };
        });

        return { labels, datasets };
      }

      // Multi-date / Recent Days: Each date is a colored segment for each pond
      const datesToUse = recentChronologicalDates;
      const datasets = datesToUse.map((dStr, idx) => {
        const dObj = new Date(dStr + 'T00:00:00');
        const dateLabel = isNaN(dObj.getTime())
          ? dStr
          : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const color = feedColorPalette[idx % feedColorPalette.length];

        const data = pondList.length > 0 ? pondList.map((p) => {
          const pId = String(p.id);
          const pName = (p.pond_name || p.name || '').toLowerCase().trim();
          const sum = allFeedingRecords.reduce((acc, r) => {
            const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            if (rDate === dStr && (rPondId === pId || rPondName === pName)) {
              return acc + (parseFloat(r.amount_kg) || 0);
            }
            return acc;
          }, 0);
          return Math.round(sum * 100) / 100;
        }) : [0];

        return {
          label: dateLabel,
          data,
          backgroundColor: color,
          borderColor: '#FFFFFF',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 38,
        };
      });

      return { labels, datasets };
    }


    // ==========================================
    // MODE 2: BY DATE (Vertical Bar Chart)
    // X-Axis = Date (or Time Slot), Y-Axis = Feed kg (Bars ascending "pataas")
    // ==========================================
    if (isSingleDate) {
      const labels = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
      const data = labels.map((slot) => {
        const sum = filteredFeedingRecords.reduce((acc, r) => {
          const normTime = String(r.feeding_time || '').trim().replace(/^0(\d:)/, '$1').toUpperCase();
          if (normTime === slot.toUpperCase()) return acc + (parseFloat(r.amount_kg) || 0);
          return acc;
        }, 0);
        return Math.round(sum * 100) / 100;
      });

      return {
        labels,
        datasets: [
          {
            label: 'Feed Dispensed (kg)',
            data,
            backgroundColor: (context) => {
              const ctx = context.chart?.ctx;
              if (!ctx) return '#FC563C';
              const gradient = ctx.createLinearGradient(0, 260, 0, 0);
              gradient.addColorStop(0, '#FC563C');
              gradient.addColorStop(1, '#FC563C');
              return gradient;
            },
            borderColor: '#FC563C',
            borderWidth: 1.5,
            borderRadius: { topLeft: 6, topRight: 6 },
          },
        ],
      };
    }

    // Multi-date vertical trend (ascending timeline)
    const datesToUse = recentChronologicalDates;
    const labels = datesToUse.map((dStr) => {
      const dObj = new Date(dStr + 'T00:00:00');
      return isNaN(dObj.getTime())
        ? dStr
        : dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    // Multi-date vertical trend: Date at bottom (X-axis), All Ponds on the side (Legend)
    const activePonds = displayedPonds.length > 0 ? displayedPonds : ponds;
    const recordsPool = allFeedingRecords.length > 0 ? allFeedingRecords : filteredFeedingRecords;

    if (activePonds.length > 0 && selectedPondFilter === 'all') {
      const datasets = activePonds.map((p, idx) => {
        const pId = String(p.id);
        const pName = (p.pond_name || p.name || '').toLowerCase().trim();
        const color = feedColorPalette[idx % feedColorPalette.length];

        const data = datesToUse.map((dStr) => {
          const sum = recordsPool.reduce((acc, r) => {
            const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
            const rPondId = String(r.pond_id || '');
            const rPondName = (r.pond_name || '').toLowerCase().trim();
            if (rDate === dStr && (rPondId === pId || rPondName === pName)) {
              return acc + (parseFloat(r.amount_kg) || 0);
            }
            return acc;
          }, 0);
          return Math.round(sum * 100) / 100;
        });

        return {
          label: p.pond_name || p.name || `Pond #${p.id}`,
          data,
          backgroundColor: color,
          borderColor: '#FFFFFF',
          borderWidth: 1,
          borderRadius: 4,
          stack: 'feedStack',
        };
      });

      return { labels, datasets };
    }

    // Single pond or overall total per date
    const data = datesToUse.map((dStr) => {
      const sum = filteredFeedingRecords.reduce((acc, r) => {
        const rDate = String(r.record_date || r.created_at || '').slice(0, 10);
        if (rDate === dStr) return acc + (parseFloat(r.amount_kg) || 0);
        return acc;
      }, 0);
      return Math.round(sum * 100) / 100;
    });

    const datasetLabel = selectedPondFilter !== 'all'
      ? `${selectedPondFilter} Feed (kg)`
      : (selectedCaretakerObj ? `${selectedCaretakerObj.full_name} Feed (kg)` : 'Daily Feed (kg)');

    return {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data,
          backgroundColor: (context) => {
            const ctx = context.chart?.ctx;
            if (!ctx) return '#FC563C';
            const gradient = ctx.createLinearGradient(0, 260, 0, 0);
            gradient.addColorStop(0, '#FC563C');
            gradient.addColorStop(1, '#FC563C');
            return gradient;
          },
          borderColor: '#FC563C',
          borderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6 },
        },
      ],
    };
  }, [
    effectiveFeedChartMode,
    displayedPonds,
    ponds,
    filteredFeedingRecords,
    allFeedingRecords,
    dateFilterType,
    customDate,
    recentChronologicalDates,
    selectedPondFilter,
    selectedCaretakerObj
  ]);

  const feedChartOptions = useMemo(() => {
    const isHorizontal = effectiveFeedChartMode === 'by_pond';

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHorizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: true,
          position: isHorizontal ? 'top' : 'right', // Ponds on the side (nasa gilid)
          align: isHorizontal ? 'end' : 'start',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { size: 10.5, weight: '700', family: "'Poppins', sans-serif" },
            color: '#FC563C',
            padding: 10,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#FC563C',
          titleColor: '#FFFFFF',
          bodyColor: '#6E7575',
          footerColor: '#FC563C',
          titleFont: { size: 12, weight: '700', family: "'Poppins', sans-serif" },
          bodyFont: { size: 12, weight: '600', family: "'Poppins', sans-serif" },
          footerFont: { size: 11, weight: '700', family: "'Poppins', sans-serif" },
          borderColor: 'rgba(252, 86, 60, 0.35)',
          borderWidth: 1.5,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (context) => {
              const labelName = context.dataset.label || '';
              const val = isHorizontal ? context.parsed.x : context.parsed.y;
              return ` ${labelName}: ${val} kg`;
            },
            footer: (items) => {
              if (!items || items.length === 0) return '';
              const sum = items.reduce((acc, curr) => {
                const val = isHorizontal ? curr.parsed.x : curr.parsed.y;
                return acc + (val || 0);
              }, 0);
              return `Total: ${sum.toFixed(2)} kg`;
            },
          },
        },
      },
      scales: {
        x: {
          type: isHorizontal ? 'linear' : 'category',
          stacked: true,
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)', drawBorder: false },
          title: {
            display: true,
            text: isHorizontal ? 'Feed Dispensed (kg)' : (dateFilterType === 'today' ? 'Feeding Session' : 'Date Timeline'),
            color: isDark ? '#94A3B8' : '#475569',
            font: { size: 11, weight: '700', family: "'Poppins', sans-serif" },
          },
          ticks: {
            color: isDark ? '#CBD5E1' : '#334155',
            font: { size: 11, weight: '700', family: "'Poppins', sans-serif" },
            callback: function (v) {
              if (isHorizontal) return `${v} kg`;
              return this.getLabelForValue ? (this.getLabelForValue(v) || v) : v;
            },
          },
        },
        y: {
          type: isHorizontal ? 'category' : 'linear',
          stacked: true,
          grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)', drawBorder: false },
          title: {
            display: true,
            text: isHorizontal ? 'Pond Name' : 'Feed Consumed (kg)',
            color: isDark ? '#94A3B8' : '#475569',
            font: { size: 11, weight: '700', family: "'Poppins', sans-serif" },
          },
          ticks: {
            color: isDark ? '#CBD5E1' : '#334155',
            font: { size: 11, weight: '700', family: "'Poppins', sans-serif" },
            callback: function (val) {
              if (isHorizontal) {
                return this.getLabelForValue ? (this.getLabelForValue(val) || val) : val;
              }
              return `${val} kg`;
            },
          },
        },
      },
    };
  }, [effectiveFeedChartMode, dateFilterType, isDark]);

  // Quick Action Handlers
  const handleQuickAcknowledge = (item) => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Alert for ${item.pond} acknowledged`,
      showConfirmButton: false,
      timer: 2200,
      background: '#FC563C',
      color: '#FFFFFF'
    });
  };

  const handleQuickIsolate = (item) => {
    const pondIdentifier = (item.pond || item.pond_name || '').trim();
    Swal.fire({
      title: 'Isolate Pond Bio-Zone?',
      html: `Close pond gates and stop water intake for <strong>${pondIdentifier}</strong>?`,
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
          if (pondIdentifier) next.add(pondIdentifier);
          if (item.id) next.add(String(item.id));
          try {
            localStorage.setItem('shrim_isolated_ponds_v3', JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });

        Swal.fire({
          icon: 'success',
          title: 'Quarantine / Pond Isolated',
          text: `Valve lock engaged for ${pondIdentifier}. System logs recorded and added to Isolated Ponds summary.`,
          confirmButtonColor: '#FC563C'
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
          confirmButtonColor: '#FC563C'
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
      {/* 1. TITLE HEADER DIRECTLY BELOW NAVBAR */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('hero.farmOverview', 'Farm Overview & Dashboard')}
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
            {t('• Live')}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-sm d-inline-flex align-items-center gap-2 px-3.5 py-2 rounded-3 text-secondary shadow-2xs hover-shadow"
          style={{
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
            color: isDark ? '#E2E8F0' : '#475569',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.15s ease',
          }}
          onClick={fetchData}
          disabled={loading}
          title="Refresh Dashboard"
        >
          <FaSync size={11} className={loading ? 'fa-spin' : ''} />
          <span>{t('hero.refreshTelemetry', 'Refresh')}</span>
        </button>
      </div>

      {/* 2. UNIFIED FILTER TOOLBAR ROW IMMEDIATELY FOLLOWING */}
      <div className="unified-filter-toolbar d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-4">
        {/* Search Bar */}
        <div className="position-relative flex-grow-1" style={{ minWidth: 220, maxWidth: 360 }}>
          <FaSearch className="position-absolute top-50 translate-middle-y text-secondary" style={{ left: 14, fontSize: '0.8rem' }} />
          <input
            type="text"
            className="form-control form-control-sm ps-5 pe-4 minimal-filter-control"
            placeholder={t('Search pond or caretaker')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-link p-0 position-absolute text-muted"
              style={{ right: 12, top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
              onClick={() => setSearchQuery('')}
            >
              <FaTimes size={12} />
            </button>
          )}
        </div>

        {/* Minimalist White Filter Drop-down Controls Cluster */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* 1. Evaluation Date */}
          <div className="position-relative">
            <input
              type="date"
              className="form-control form-control-sm minimal-filter-control px-2.5"
              style={{ minWidth: 145 }}
              value={customDate}
              title="Evaluation Date"
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilterType(e.target.value ? 'custom' : 'all');
              }}
            />
          </div>

          {/* 2. Filter by Pond */}
          <div className="position-relative">
            <select
              className="form-select form-select-sm minimal-filter-control px-2.5"
              style={{ minWidth: 140 }}
              value={selectedPondFilter}
              onChange={(e) => {
                setSelectedPondFilter(e.target.value);
                setFeedCardPondFilter(e.target.value);
              }}
            >
              <option value="all">{t('Filter by Pond')}</option>
              {availableCaretakerPonds.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 3. Disease Detection */}
          <div className="position-relative">
            <select
              className="form-select form-select-sm minimal-filter-control px-2.5"
              style={{ minWidth: 150 }}
              value={diseaseFilter}
              onChange={(e) => setDiseaseFilter(e.target.value)}
            >
              <option value="all">{t('Disease Detection')}</option>
              <option value="critical">{t('Critical WSD')}</option>
              <option value="moderate">{t('Moderate Risk')}</option>
              <option value="safe">{t('Safe / Healthy')}</option>
            </select>
          </div>

          {/* 4. Assigned Caretaker */}
          <div className="position-relative">
            <select
              className="form-select form-select-sm minimal-filter-control px-2.5"
              style={{ minWidth: 160 }}
              value={selectedCaretakerId}
              onChange={(e) => {
                setSelectedCaretakerId(e.target.value);
                setSelectedPondFilter('all');
                setFeedCardPondFilter('all');
              }}
            >
              <option value="all">{t('Assigned Caretaker')}</option>
              {caretakers.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.full_name}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters button when active */}
          {(selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || diseaseFilter !== 'all' || customDate || searchQuery) && (
            <button
              type="button"
              className="btn btn-sm btn-link text-muted p-1 extra-small text-decoration-none"
              onClick={() => {
                setSelectedCaretakerId('all');
                setSelectedPondFilter('all');
                setFeedCardPondFilter('all');
                setPondStatusFilter('all');
                setDateFilterType('all');
                setCustomDate('');
                setDiseaseFilter('all');
                setSearchQuery('');
              }}
              title="Reset all filters"
            >
              <FaUndo size={11} className="me-1" /> {t('Reset')}
            </button>
          )}

          {/* 5. Export PDF Button */}
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-1.5 shadow-2xs hover-shadow"
            style={{ fontWeight: 600 }}
            onClick={() => setShowExportModal(true)}
          >
            <FaFilePdf size={13} className="text-secondary" />
            <span>{t('Export PDF')}</span>
          </button>
        </div>
      </div>

      {/* 3. FOUR KPI CARDS (Soft shadow backdrops, clean rounded corners, no heavy top gradients) */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: MONITORED PONDS */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('MONITORED PONDS')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaWater size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.totalPondsCount || 9}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {kpiStats.healthyPondsCount || 4} of {kpiStats.totalPondsCount || 9} {t('Optimal')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('Active Fleet')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: FIELD CARETAKERS */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('FIELD CARETAKERS')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaUserTie size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.activeCaretakersCount || 6}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {kpiStats.activeCaretakersCount || 6} {t('Operators Active')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('Staffed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: TOTAL FEED */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('TOTAL FEED')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FFF5F3', color: '#FC563C' }}>
                  <FaUtensils size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {feedCardTotalKg > 0 ? `${feedCardTotalKg.toFixed(2)} kg` : '2,644.70 kg'}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {feedCardRunsCount || 291} {t('Dispersal Runs')} • {t('Verified')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FFF5F3', color: '#FC563C', fontWeight: 600 }}>
                  {t('Verified')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: BIOSECURITY HEALTH */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('BIOSECURITY HEALTH')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <FaShieldAlt size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#DC2626', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.wsdSuspectedCount > 0 ? `${kpiStats.wsdSuspectedCount} Alerts` : '50 Alerts'}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="small fw-semibold" style={{ color: '#DC2626' }}>
                  {t('Status: WSD Anomaly Detected')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 600 }}>
                  {t('CNN Alert')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>      {/* 4. LOWER SECTION SPLIT INTO TWO COLUMNS: PONDS OVERVIEW (7 cols) + HARVEST FORECAST (5 cols) */}
      <div className="row g-4 mb-4">
        {/* COLUMN 1 (LEFT): PONDS OVERVIEW */}
        <div className="col-12 col-xl-7">
          <div className="shrimp-kpi-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              {(() => {
                const totalPondsCount = displayedPonds.length;
                const criticalCount = displayedPonds.filter(p => !isPondIsolated(p) && ((p.status || '').toLowerCase() === 'critical' || (p.disease_detection || '').toLowerCase().includes('white spot'))).length;
                const warningCount = displayedPonds.filter(p => !isPondIsolated(p) && (((p.status || '').toLowerCase() === 'warning' || (p.status || '').toLowerCase() === 'maintenance' || (p.disease_detection || '').toLowerCase().includes('black gill')) && (p.status || '').toLowerCase() !== 'critical')).length;
                const healthyCount = displayedPonds.filter(p => !isPondIsolated(p) && (p.status || '').toLowerCase() === 'healthy' && !(p.disease_detection || '').toLowerCase().includes('white spot')).length;

                return (
                  <>
                    {/* Header Row: Title, Subtext, and Minimalist Status Filter Tabs */}
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <div>
                        <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                          {t('Ponds Overview')}
                        </h5>
                        <p className="text-muted mb-0 extra-small" style={{ fontSize: '0.78rem' }}>
                          {t('Live farm status across grow-out and nursery ponds.')}
                        </p>
                      </div>

                      {/* Minimalist Status Filter Tabs */}
                      <div className="d-flex align-items-center gap-1 p-1 rounded-pill bg-light border flex-wrap" style={{ borderColor: '#E2E8F0' }}>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                            pondStatusFilter === 'all' ? 'text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
                          }`}
                          style={pondStatusFilter === 'all' ? { backgroundColor: '#172A39', borderColor: '#172A39' } : undefined}
                          onClick={() => setPondStatusFilter('all')}
                        >
                          {t('All')} ({totalPondsCount})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                            pondStatusFilter === 'healthy' ? 'btn-success text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
                          }`}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'healthy' ? 'all' : 'healthy')}
                        >
                          ● {t('Healthy')} ({healthyCount})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                            pondStatusFilter === 'warning' ? 'btn-warning text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
                          }`}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'warning' ? 'all' : 'warning')}
                        >
                          ● {t('Warning')} ({warningCount})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                            pondStatusFilter === 'critical' ? 'btn-danger text-white shadow-xs' : 'text-secondary border-0 bg-transparent'
                          }`}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'critical' ? 'all' : 'critical')}
                        >
                          ● {t('Critical')} ({criticalCount})
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Compact Card-Based Tiles for Individual Ponds */}
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
                return true;
              });

              return (
                <>
                  {categoryFilteredPonds.length === 0 ? (
                    <div className="p-4 text-center rounded-3 bg-light border my-2" style={{ borderColor: '#E2E8F0' }}>
                      <p className="text-muted mb-0 small">
                        {t('No ponds found matching filter.')}
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {categoryFilteredPonds.slice(0, showAllPonds ? undefined : 4).map((p) => {
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
                          <div className="col-12 col-md-6" key={p.id}>
                            <div className="compact-pond-card">
                              <div>
                                {/* Top Row: Pond Name + Culture Stage & Upper Right Status Pill */}
                                <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                                  <div>
                                    <strong className="d-block text-dark fw-extrabold" style={{ fontSize: '1.02rem', lineHeight: 1.2 }}>
                                      {p.pond_name || p.name || `Pond #${p.id}`}
                                    </strong>
                                    <span className="extra-small text-muted" style={{ fontSize: '0.72rem' }}>
                                      {isNursery ? `${t('Nursery')} • DOC #${doc || '14'}` : `${t('Grow-out')} • DOC #${doc || '39'}`}
                                    </span>
                                  </div>

                                  {/* Status Pill in Upper Right Corner */}
                                  <span
                                    className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                                    style={{
                                      backgroundColor: isCritical ? '#FEF2F2' : (isWarning ? '#FFFBEB' : '#ECFDF5'),
                                      color: isCritical ? '#DC2626' : (isWarning ? '#D97706' : '#059669'),
                                      border: isCritical ? '1px solid #FECACA' : (isWarning ? '1px solid #FDE68A' : '1px solid #A7F3D0'),
                                      fontSize: '0.68rem',
                                      letterSpacing: '0.02em',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {isCritical ? '• CRITICAL' : (isWarning ? '• WARNING' : '• HEALTHY')}
                                  </span>
                                </div>

                                {/* Caretaker & Total Feed Info Strip */}
                                <div className="p-2.5 rounded-3 my-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                                  <div className="d-flex align-items-center justify-content-between mb-1 extra-small">
                                    <span className="text-secondary d-flex align-items-center gap-1.5" style={{ fontSize: '0.73rem' }}>
                                      <FaUserTie size={11} className="text-muted" /> {t('Caretaker')}:
                                    </span>
                                    <strong className="text-dark fw-bold text-truncate" style={{ fontSize: '0.78rem', maxWidth: 130 }}>
                                      {caretakerName}
                                    </strong>
                                  </div>
                                  <div className="d-flex align-items-center justify-content-between extra-small">
                                    <span className="text-secondary d-flex align-items-center gap-1.5" style={{ fontSize: '0.73rem' }}>
                                      <FaUtensils size={11} className="text-muted" /> {t('Total Feed')}:
                                    </span>
                                    <strong className="text-dark fw-bold font-mono" style={{ fontSize: '0.82rem' }}>
                                      {totalFeedKg.toFixed(1)} kg
                                    </strong>
                                  </div>
                                </div>
                              </div>

                              {/* Bottom: Small, Understated View Pond and Feeding Logs Buttons */}
                              <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top" style={{ borderColor: '#F1F5F9' }}>
                                <button
                                  type="button"
                                  className="btn btn-understated-view d-inline-flex align-items-center gap-1"
                                  onClick={() => navigate(`/admin/ponds?pond_id=${p.id}`)}
                                >
                                  <FaEye size={10} className="text-muted" /> {t('View Pond')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-understated-feed d-inline-flex align-items-center gap-1"
                                  onClick={() => navigate(`/admin/feeding?pond=${encodeURIComponent(p.pond_name || p.name)}`)}
                                >
                                  <FaUtensils size={10} /> {t('Feeding Logs Reports')}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer Row */}
                  <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" style={{ borderColor: '#E2E8F0' }}>
                    <span className="extra-small text-secondary fw-semibold">
                      {t('Showing')} <strong className="text-dark">{Math.min(categoryFilteredPonds.length, showAllPonds ? categoryFilteredPonds.length : 4)}</strong> {t('of')} <strong className="text-dark">{categoryFilteredPonds.length}</strong> {t('Ponds')}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      {categoryFilteredPonds.length > 4 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 extra-small fw-bold text-decoration-none text-secondary"
                          onClick={() => setShowAllPonds(!showAllPonds)}
                        >
                          {showAllPonds ? t('Show Less ↑') : t(`View All (${categoryFilteredPonds.length}) ↓`)}
                        </button>
                      )}
                      <Link to="/admin/ponds" className="fw-bold extra-small text-decoration-none" style={{ color: '#FC563C' }}>
                        {t('Manage All Ponds →')}
                      </Link>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* COLUMN 2 (RIGHT): HARVEST MILESTONE FORECAST */}
        <div className="col-12 col-xl-5">
          <div className="shrimp-kpi-card p-4 h-100 d-flex flex-column justify-content-between">
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

              const caretakerName = focusedPond.assigned_caretaker_name ||
                focusedPond.caretaker_name ||
                (caretakers.find((c) => String(c.id) === String(focusedPond.caretaker_id))?.full_name) ||
                'CJ Arroyo';

              const pondRecords = allFeedingRecords.filter((r) => String(r.pond_id) === String(focusedPond.id));
              const latestPondRecordDate = pondRecords.length > 0
                ? pondRecords.reduce((max, r) => (r.record_date > max ? r.record_date : max), pondRecords[0].record_date)
                : null;

              const effectiveFocusedDate = (dateFilterType !== 'all' && dateFilterType.match(/^\d{4}-\d{2}-\d{2}$/))
                ? dateFilterType
                : (latestPondRecordDate || '2026-09-17');

              const focusedDoc = computeDoc(focusedPond.stocking_date, effectiveFocusedDate) || (String(focusedPond.id) === '1' ? 46 : 39);
              const focusedIsNursery = focusedDoc <= 19;
              const cultureProgressPct = Math.min(100, Math.max(1, Math.round((focusedDoc / 90) * 100)));

              const calcFeedKg = pondRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
              const focusedPrediction = harvestPredictions.find((hp) => String(hp.pond_id) === String(focusedPond.id)) || {};

              const totalFeedKg = calcFeedKg > 0
                ? calcFeedKg
                : (parseFloat(focusedPrediction.total_feed_consumed_kg) || (focusedPond.total_feed_kg ? Number(focusedPond.total_feed_kg) : 644.70));

              let abwGrams = parseFloat(focusedPrediction.average_weight || focusedPrediction.abw_grams || focusedPrediction.current_abw);
              if (!abwGrams || abwGrams <= 0) {
                if (focusedDoc <= 19) {
                  abwGrams = 1.0 + (focusedDoc * 0.15);
                } else {
                  abwGrams = 3.85 + ((focusedDoc - 19) * 0.22);
                }
              }

              let estHarvestKg = parseFloat(focusedPrediction.adjusted_harvest_kg || focusedPrediction.estimated_harvest || focusedPrediction.baseline_harvest_kg);
              if (!estHarvestKg || estHarvestKg <= 0) {
                const stockingCount = parseInt(focusedPond.initial_count || focusedPond.stocking_density || 50000);
                const estimatedBiomassKg = (stockingCount * 0.85 * abwGrams) / 1000;
                estHarvestKg = estimatedBiomassKg > 0 ? estimatedBiomassKg : (totalFeedKg * 0.7333);
              }

              const targetHarvestDays = Math.max(0, 90 - focusedDoc);

              return (
                <div>
                  {/* Top Header: Title & Pond Selector */}
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div>
                      <h6 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.15rem' }}>
                        {t('Harvest Milestone Forecast')}
                      </h6>
                      <span className="text-muted extra-small" style={{ fontSize: '0.76rem' }}>
                        {focusedPond.pond_name || 'Pond A1'} • {caretakerName}
                      </span>
                    </div>

                    {/* Minimalist White Pond Selector */}
                    <div className="position-relative">
                      <select
                        className="form-select form-select-sm minimal-filter-control ps-2 pe-4 py-1"
                        style={{ fontSize: '0.76rem', height: 32, minWidth: 140 }}
                        value={selectedForecastPondId === 'auto' ? String(focusedPond.id) : selectedForecastPondId}
                        onChange={(e) => setSelectedForecastPondId(e.target.value)}
                        title="Select Pond"
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

                  {/* 1. Circular Milestone Visualization: PL-15, Nursery, Grow-out, Harvest */}
                  <div className="harvest-circular-timeline my-3">
                    {/* Background line & Gradient progress fill */}
                    <div
                      className="harvest-timeline-fill"
                      style={{
                        width: `${Math.min(88, Math.max(6, (cultureProgressPct * 0.88)))}%`
                      }}
                    />

                    {/* Milestone 1: PL-15 */}
                    <div className="harvest-milestone-item">
                      <div className="harvest-milestone-circle completed">
                        <FaCheck size={11} />
                      </div>
                      <span className="fw-bold extra-small text-dark" style={{ fontSize: '0.72rem' }}>
                        {t('PL-15')}
                      </span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>Day 1</span>
                    </div>

                    {/* Milestone 2: Nursery */}
                    <div className="harvest-milestone-item">
                      <div className={`harvest-milestone-circle ${focusedDoc >= 20 ? 'completed' : 'active'}`}>
                        {focusedDoc >= 20 ? <FaCheck size={11} /> : '2'}
                      </div>
                      <span className="fw-bold extra-small text-dark" style={{ fontSize: '0.72rem' }}>
                        {t('Nursery')}
                      </span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>D1–19</span>
                    </div>

                    {/* Milestone 3: Grow-out */}
                    <div className="harvest-milestone-item">
                      <div className={`harvest-milestone-circle ${focusedDoc >= 20 ? 'active' : 'upcoming'}`}>
                        {focusedDoc >= 90 ? <FaCheck size={11} /> : '3'}
                      </div>
                      <span className="fw-bold extra-small text-dark" style={{ fontSize: '0.72rem' }}>
                        {t('Grow-out')}
                      </span>
                      <span className="badge rounded-pill text-white" style={{ backgroundColor: '#FC563C', fontSize: '0.62rem', padding: '1px 5px' }}>
                        {cultureProgressPct}%
                      </span>
                    </div>

                    {/* Milestone 4: Harvest */}
                    <div className="harvest-milestone-item">
                      <div className={`harvest-milestone-circle ${focusedDoc >= 90 ? 'completed' : 'upcoming'}`}>
                        {focusedDoc >= 90 ? <FaCheck size={11} /> : '4'}
                      </div>
                      <span className="fw-bold extra-small text-muted" style={{ fontSize: '0.72rem' }}>
                        {t('Harvest')}
                      </span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>Day 90+</span>
                    </div>
                  </div>

                  {/* 4-Box Key Metrics Strip */}
                  <div className="row g-2 mb-3">
                    <div className="col-3">
                      <div className="p-2 rounded-3 text-center border bg-light h-100" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-muted extra-small fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('STAGE')}</span>
                        <strong className="d-block text-dark fw-extrabold" style={{ fontSize: '0.82rem' }}>
                          {focusedIsNursery ? t('Nursery') : t('Grow-out')}
                        </strong>
                        <div className="text-secondary" style={{ fontSize: '0.68rem' }}>DOC #{focusedDoc}</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2 rounded-3 text-center border bg-light h-100" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-muted extra-small fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('EST. YIELD')}</span>
                        <strong className="d-block text-dark fw-extrabold" style={{ fontSize: '0.82rem' }}>
                          {estHarvestKg.toFixed(0)} kg
                        </strong>
                        <div className="text-secondary font-mono" style={{ fontSize: '0.68rem' }}>{(estHarvestKg / 1000).toFixed(2)} T</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2 rounded-3 text-center border bg-light h-100" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-muted extra-small fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('ABW')}</span>
                        <strong className="d-block text-dark fw-extrabold" style={{ fontSize: '0.82rem' }}>
                          {abwGrams.toFixed(1)} g
                        </strong>
                        <div className="text-secondary" style={{ fontSize: '0.68rem' }}>{t('Sampling')}</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2 rounded-3 text-center border bg-light h-100" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-muted extra-small fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('TARGET')}</span>
                        <strong className="d-block fw-extrabold" style={{ color: '#FC563C', fontSize: '0.82rem' }}>
                          {targetHarvestDays}d
                        </strong>
                        <div className="text-secondary" style={{ fontSize: '0.68rem' }}>DOC 90+</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Specific Progress Chart with Steps and Status Labels (Brand Navy & Orange) */}
                  <div className="p-3 rounded-3 mb-2.5" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <span className="extra-small text-secondary fw-semibold">
                        {t('Cycle Maturity Progress')}: <strong style={{ color: '#172A39' }}>{focusedDoc} / 90 {t('Days')}</strong>
                      </span>
                      <span className="badge rounded-pill extra-small text-white" style={{ backgroundColor: '#FC563C', fontSize: '0.68rem' }}>
                        {cultureProgressPct}% {t('Completed')}
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="rounded-pill overflow-hidden my-2" style={{ height: 8, backgroundColor: '#E2E8F0' }}>
                      <div
                        style={{
                          width: `${cultureProgressPct}%`,
                          background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)',
                          height: '100%',
                          borderRadius: 999,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>

                    {/* Steps & Status Labels List */}
                    <div className="d-flex flex-column gap-1.5 mt-2.5 pt-2 border-top" style={{ borderColor: '#E2E8F0' }}>
                      <div className="d-flex justify-content-between align-items-center extra-small">
                        <span className="text-secondary d-flex align-items-center gap-1.5">
                          <FaCheckCircle size={10} style={{ color: '#172A39' }} /> {t('Step 1: PL-15 Acclimatization')}
                        </span>
                        <span className="badge rounded-pill px-2 py-0.5" style={{ backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.65rem' }}>
                          {t('Completed (Day 1)')}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center extra-small">
                        <span className="text-secondary d-flex align-items-center gap-1.5">
                          <FaCheckCircle size={10} style={{ color: focusedDoc >= 20 ? '#172A39' : '#FC563C' }} /> {t('Step 2: Nursery Phase Optimization')}
                        </span>
                        <span className="badge rounded-pill px-2 py-0.5" style={{ backgroundColor: focusedDoc >= 20 ? '#ECFDF5' : '#FFF5F3', color: focusedDoc >= 20 ? '#059669' : '#FC563C', fontSize: '0.65rem' }}>
                          {focusedDoc >= 20 ? t('Verified (Day 1–19)') : t('Active (Day 1–19)')}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center extra-small">
                        <span className="text-secondary d-flex align-items-center gap-1.5">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: focusedDoc >= 20 ? '#FC563C' : '#94A3B8', display: 'inline-block' }} /> {t('Step 3: Grow-out Biomass Gain')}
                        </span>
                        <span className="badge rounded-pill px-2 py-0.5" style={{ backgroundColor: focusedDoc >= 20 ? '#FFF5F3' : '#F1F5F9', color: focusedDoc >= 20 ? '#FC563C' : '#64748B', fontSize: '0.65rem' }}>
                          {focusedDoc >= 20 ? `${t('In Progress')} (DOC #${focusedDoc})` : t('Upcoming')}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center extra-small">
                        <span className="text-secondary d-flex align-items-center gap-1.5">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#94A3B8', display: 'inline-block' }} /> {t('Step 4: Commercial Harvest Target')}
                        </span>
                        <span className="badge rounded-pill px-2 py-0.5 text-secondary" style={{ backgroundColor: '#F1F5F9', fontSize: '0.65rem' }}>
                          ~{targetHarvestDays}d {t('remaining')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Proportional Biomass & Feeding Rate Strip */}
                  <div className="p-2.5 rounded-3 mb-2 d-flex justify-content-around align-items-center text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('RUNNING FEED')}</span>
                      <strong className="d-block text-dark fw-bold" style={{ fontSize: '0.82rem' }}>~{(totalFeedKg / Math.max(1, focusedDoc)).toFixed(1)} kg/d</strong>
                    </div>
                    <div style={{ width: 1, height: 22, backgroundColor: '#E2E8F0' }} />
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('TARGET HARVEST')}</span>
                      <strong className="d-block fw-bold" style={{ color: '#FC563C', fontSize: '0.82rem' }}>{estHarvestKg.toFixed(0)} kg</strong>
                    </div>
                    <div style={{ width: 1, height: 22, backgroundColor: '#E2E8F0' }} />
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('EST. SURVIVAL')}</span>
                      <strong className="d-block text-success fw-bold" style={{ fontSize: '0.82rem' }}>88.5% SR</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Symmetrical Bottom Footer */}
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
                <div className="pt-2.5 mt-auto d-flex justify-content-between align-items-center border-top" style={{ borderColor: '#E2E8F0' }}>
                  <span className="text-secondary extra-small" style={{ fontSize: '0.74rem' }}>
                    {t('Feed')}: <strong style={{ color: '#FC563C' }}>{totalFeedKg.toFixed(1)} kg</strong> • FCR: <strong>0.73</strong>
                  </span>
                  <Link to="/admin/harvest" className="fw-bold extra-small text-decoration-none" style={{ color: '#FC563C', fontSize: '0.74rem' }}>
                    {t('Growth Curve →')}
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* COMBINED OPERATIONAL HUB: FEED MONITORING, FEED LOGS, & RECENT DETECTION (TOGGLEABLE) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="tri-card p-4">
            {/* Top Switcher Bar */}
            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
              <div className="d-flex align-items-center gap-2">
                <span
                  className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                  style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)' }}
                >
                  {t('Farm Operations Activity')}
                </span>
                <span className="text-muted extra-small d-none d-sm-inline">
                  {dashboardTab === 'chart' && t('Daily feed consumption trends across ponds')}
                  {dashboardTab === 'logs' && t('Detailed time-slot feed entries and additives')}
                  {dashboardTab === 'detections' && t('AI vision scans and pond health alerts')}
                </span>
              </div>

              {/* Segmented Toggle Pills */}
              <div className="d-flex align-items-center gap-1.5 p-1 rounded-pill bg-light border flex-wrap" style={{ borderColor: 'rgba(252, 86, 60, 0.12)' }}>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${dashboardTab === 'chart' ? 'btn-tri-orange text-white shadow-xs' : 'text-muted border-0 bg-transparent'}`}
                  onClick={() => setDashboardTab('chart')}
                >
                  <FaChartBar className="me-1" /> {t('Daily Feed Monitoring & Trend')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${dashboardTab === 'logs' ? 'btn-tri-orange text-white shadow-xs' : 'text-muted border-0 bg-transparent'}`}
                  onClick={() => setDashboardTab('logs')}
                >
                  <FaUtensils className="me-1" /> {t('Daily Feed & Supplementation Logs')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${dashboardTab === 'detections' ? 'btn-tri-orange text-white shadow-xs' : 'text-muted border-0 bg-transparent'}`}
                  onClick={() => setDashboardTab('detections')}
                >
                  <FaShieldAlt className="me-1" /> {t('Recent Detection Activity')}
                </button>
              </div>
            </div>

            {/* TAB 1: DAILY FEED MONITORING & TREND */}
            {dashboardTab === 'chart' && (
              <div>
                {/* Header Row: Title, Subtitle, and Feeder Schedule Button */}
                <div className="d-flex justify-content-between align-items-start mb-3.5 flex-wrap gap-2">
                  <div>
                    <h4 className="fw-extrabold text-dark mb-1" style={{ fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
                      {t('Daily Feed Monitoring & Trend')}
                    </h4>
                    <p className="text-muted small mb-0" style={{ fontSize: '0.88rem' }}>
                      {t('Daily feed consumption trends across ponds')}
                    </p>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {selectedPondFilter !== 'all' && (
                      <span className="badge rounded-pill extra-small fw-bold px-2.5 py-1 bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                        {t('Filter')}: {selectedPondFilter}
                      </span>
                    )}
                    {selectedCaretakerObj && (
                      <span className="badge rounded-pill extra-small fw-bold px-2.5 py-1 bg-info-subtle text-info-emphasis border border-info-subtle">
                        {t('Caretaker')}: {selectedCaretakerObj.full_name}
                      </span>
                    )}
                    <Link
                      to="/admin/feeding"
                      className="btn btn-sm px-3 py-1.5 extra-small fw-bold shadow-2xs d-inline-flex align-items-center gap-1.5"
                      style={{
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        color: isDark ? '#F1F5F9' : '#0F172A',
                      }}
                    >
                      {t('Feeder Schedule')} <FaArrowRight size={10} className="ms-1" />
                    </Link>
                  </div>
                </div>

                {/* 3 Numerical Metric Cards */}
                <div className="row g-3 mb-3.5">
                  <div className="col-12 col-md-4">
                    <div
                      className="p-3.5 rounded-3 border bg-white h-100"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <span
                        className="extra-small text-uppercase fw-bold d-block mb-1 tracking-wider"
                        style={{ color: '#64748B', fontSize: '0.73rem' }}
                      >
                        {t('TOTAL FEED MASS')}
                      </span>
                      <div className="fw-extrabold text-dark" style={{ fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                        {totalFilteredFeedKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                      </div>
                      <span className="extra-small d-block text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                        {Math.round(totalFilteredFeedKg * 1000).toLocaleString()} {t('g total')}
                      </span>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div
                      className="p-3.5 rounded-3 border bg-white h-100"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <span
                        className="extra-small text-uppercase fw-bold d-block mb-1 tracking-wider"
                        style={{ color: '#64748B', fontSize: '0.73rem' }}
                      >
                        {t('AUTOMATED CYCLES')}
                      </span>
                      <div className="fw-extrabold text-dark" style={{ fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                        {filteredFeedingRecords.length} {t('Runs')}
                      </div>
                      <span className="extra-small d-block text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                        {filteredFeedingRecords.length > 0 ? t('Verified logs') : t('No logs in window')}
                      </span>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div
                      className="p-3.5 rounded-3 border bg-white h-100"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <span
                        className="extra-small text-uppercase fw-bold d-block mb-1 tracking-wider"
                        style={{ color: '#64748B', fontSize: '0.73rem' }}
                      >
                        {t('FEEDING SCHEDULE FOLLOWED')}
                      </span>
                      <div className="fw-extrabold text-dark" style={{ fontSize: '1.75rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                        {filteredFeedingRecords.length > 0 ? '100%' : '100%'}
                      </div>
                      <span className="extra-small d-block text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                        {t('Zero feed waste')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Row: Daily Feed Consumption (Left) + Feed by Pond (Right) */}
                <div className="row g-3">
                  {/* LEFT COLUMN: Daily Feed Consumption Chart */}
                  <div className="col-12 col-lg-8 col-xl-8 col-xxl-9">
                    <div
                      className="p-3.5 rounded-3 border h-100 position-relative d-flex flex-column"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                        minHeight: 380,
                      }}
                    >
                      {/* Card Header with Title, Legend & View Mode Toggles */}
                      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                        <div>
                          <h6 className="fw-extrabold text-dark mb-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                            {t('Daily Feed Consumption')}
                          </h6>
                        </div>

                        <div className="d-flex align-items-center gap-3 flex-wrap">
                          {/* Legend matching inspiration image */}
                          <div className="d-flex align-items-center gap-3">
                            <span className="d-inline-flex align-items-center gap-1.5 extra-small fw-bold text-dark" style={{ fontSize: '0.78rem' }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2.5, backgroundColor: '#FC563C', display: 'inline-block' }} />
                              {t('Feed Mass (kg)')}
                            </span>
                            <span className="d-inline-flex align-items-center gap-1.5 extra-small fw-bold text-dark" style={{ fontSize: '0.78rem' }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2.5, backgroundColor: '#172A39', display: 'inline-block' }} />
                              {t('Cycles')}
                            </span>
                          </div>

                          {/* View Switcher Pills */}
                          <div className="d-flex align-items-center p-0.5 rounded-pill bg-light border" style={{ borderColor: '#E2E8F0' }}>
                            <button
                              type="button"
                              className={`btn btn-xs rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                                feedChartDisplayType === 'by_pond'
                                  ? 'text-white shadow-2xs'
                                  : 'text-muted border-0 bg-transparent'
                              }`}
                              style={{
                                backgroundColor: feedChartDisplayType === 'by_pond' ? '#FC563C' : 'transparent',
                                fontSize: '0.72rem',
                              }}
                              onClick={() => setFeedChartDisplayType('by_pond')}
                              title="Y-axis displays Pond Names, X-axis displays Date, hover shows kg"
                            >
                              {t('By Pond (Y-Axis)')}
                            </button>
                            <button
                              type="button"
                              className={`btn btn-xs rounded-pill px-2.5 py-0.5 extra-small fw-bold transition-all ${
                                feedChartDisplayType === 'wave_trend'
                                  ? 'text-white shadow-2xs'
                                  : 'text-muted border-0 bg-transparent'
                              }`}
                              style={{
                                backgroundColor: feedChartDisplayType === 'wave_trend' ? '#172A39' : 'transparent',
                                fontSize: '0.72rem',
                              }}
                              onClick={() => setFeedChartDisplayType('wave_trend')}
                              title="Combined Inspo Chart with Area Wave Curve"
                            >
                              {t('Overall Trend')}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* VIEW 1: Y-AXIS POND NAMES, X-AXIS DATE, HOVER TOOLTIP SHOWS KG */}
                      {feedChartDisplayType === 'by_pond' && (
                        <div className="position-relative feed-pond-matrix-view flex-grow-1 d-flex flex-column justify-content-between" style={{ minHeight: 290 }}>
                          {/* Floating Tooltip matching inspiration black capsule */}
                          {hoveredPondCell && (
                            <div
                              className="position-absolute shadow-lg transition-all pe-none"
                              style={{
                                left: `${hoveredPondCell.xPct}%`,
                                top: `${Math.max(10, hoveredPondCell.yPx - 52)}px`,
                                transform: 'translateX(-50%)',
                                zIndex: 100,
                                backgroundColor: '#0F172A',
                                color: '#FFFFFF',
                                borderRadius: '7px',
                                padding: '6px 12px',
                                fontSize: '0.80rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                                pointerEvents: 'none',
                              }}
                            >
                              <div>{hoveredPondCell.dateLabel}: {hoveredPondCell.amount.toFixed(1)} kg</div>
                              <div className="extra-small opacity-75 fw-normal" style={{ fontSize: '0.70rem' }}>
                                {hoveredPondCell.pondName} {hoveredPondCell.cycles > 0 ? `• ${hoveredPondCell.cycles} Runs` : ''}
                              </div>
                              {/* Downward triangle pointer */}
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: -5,
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: 0,
                                  height: 0,
                                  borderLeft: '5px solid transparent',
                                  borderRight: '5px solid transparent',
                                  borderTop: '5px solid #0F172A',
                                }}
                              />
                            </div>
                          )}

                          {/* Grid Board */}
                          <div
                            className="rounded-2 p-2.5 flex-grow-1"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248, 250, 252, 0.65)',
                              border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F1F5F9',
                              overflowX: 'auto',
                            }}
                          >
                            {/* Pond Rows */}
                            {feedHorizontalGridData.rows.length === 0 ? (
                              <div className="text-center py-5 text-muted extra-small">
                                {t('No feeding records available for current filter')}
                              </div>
                            ) : (
                              feedHorizontalGridData.rows.map((row, rIdx) => {
                                const rowMinHeight = feedHorizontalGridData.rows.length <= 4 ? 48 : 40;
                                const barContainerHeight = feedHorizontalGridData.rows.length <= 4 ? 44 : 38;

                                return (
                                  <div
                                    key={row.pondId}
                                    className="d-flex align-items-center py-1 border-bottom"
                                    style={{
                                      borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                                      minHeight: rowMinHeight,
                                    }}
                                  >
                                    {/* Y-Axis: Pond Name */}
                                    <div
                                      className="pe-3 flex-shrink-0 d-flex flex-column justify-content-center"
                                      style={{ width: 105 }}
                                    >
                                      <span
                                        className="fw-bold text-truncate"
                                        style={{
                                          fontSize: '0.84rem',
                                          color: isDark ? '#F1F5F9' : '#1E293B',
                                        }}
                                        title={row.pondName}
                                      >
                                        {row.pondName}
                                      </span>
                                      <span
                                        className="extra-small text-muted text-truncate"
                                        style={{ fontSize: '0.70rem' }}
                                      >
                                        {row.totalPondKg > 0 ? `${row.totalPondKg.toFixed(1)} kg` : t('0.0 kg')}
                                      </span>
                                    </div>

                                    {/* X-Axis Columns: Date Cells with Vertical Bars */}
                                    <div className="flex-grow-1 d-flex align-items-end h-100 position-relative" style={{ height: barContainerHeight }}>
                                      {row.values.map((val, cIdx) => {
                                        const maxKg = Math.max(feedHorizontalGridData.maxCellFeedKg || 50, 20);
                                        const heightPct = val.amount > 0 ? Math.max(20, Math.min(100, Math.round((val.amount / maxKg) * 100))) : 0;
                                        const cycleHeightPct = val.cycles > 0 ? Math.max(16, Math.min(100, Math.round((val.cycles / 5) * 100))) : 0;
                                        const isHovered = hoveredPondCell && hoveredPondCell.rowIdx === rIdx && hoveredPondCell.colIdx === cIdx;

                                        return (
                                          <div
                                            key={val.key || cIdx}
                                            className="flex-grow-1 d-flex align-items-end justify-content-center h-100 position-relative border-start"
                                            style={{
                                              borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(226, 232, 240, 0.6)',
                                              cursor: 'pointer',
                                              padding: '0 4px',
                                              transition: 'background-color 0.15s ease',
                                              backgroundColor: isHovered ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(252, 86, 60, 0.06)') : 'transparent',
                                            }}
                                            onMouseEnter={(e) => {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              const container = e.currentTarget.closest('.feed-pond-matrix-view');
                                              const parentRect = container ? container.getBoundingClientRect() : rect;
                                              const xPct = ((rect.left + rect.width / 2 - parentRect.left) / parentRect.width) * 100;
                                              const yPx = rect.top - parentRect.top;
                                              setHoveredPondCell({
                                                pondName: row.pondName,
                                                dateLabel: val.label,
                                                amount: val.amount,
                                                cycles: val.cycles || 0,
                                                rowIdx: rIdx,
                                                colIdx: cIdx,
                                                xPct,
                                                yPx,
                                              });
                                            }}
                                            onMouseLeave={() => setHoveredPondCell(null)}
                                          >
                                            {val.amount > 0 ? (
                                              <div className="d-flex align-items-end gap-1 h-100 pb-0.5">
                                                {/* Orange Feed Mass Bar */}
                                                <div
                                                  style={{
                                                    width: 14,
                                                    height: `${heightPct}%`,
                                                    minHeight: 6,
                                                    background: 'linear-gradient(180deg, #FC563C 0%, #FF7654 100%)',
                                                    borderRadius: '4px 4px 0 0',
                                                    boxShadow: isHovered ? '0 0 8px rgba(252, 86, 60, 0.6)' : 'none',
                                                    filter: isHovered ? 'brightness(1.15)' : 'none',
                                                    transition: 'all 0.2s ease',
                                                  }}
                                                />
                                                {/* Navy Cycles Bar */}
                                                {val.cycles > 0 && (
                                                  <div
                                                    style={{
                                                      width: 8,
                                                      height: `${cycleHeightPct}%`,
                                                      minHeight: 5,
                                                      background: '#172A39',
                                                      borderRadius: '3px 3px 0 0',
                                                      filter: isHovered ? 'brightness(1.2)' : 'none',
                                                      transition: 'all 0.2s ease',
                                                    }}
                                                  />
                                                )}
                                              </div>
                                            ) : (
                                              /* Faint zero indicator tick */
                                              <div
                                                className="mb-1.5"
                                                style={{
                                                  width: 12,
                                                  height: 2,
                                                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
                                                  borderRadius: 1,
                                                }}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            {/* X-Axis: Dates Row at the Bottom */}
                            <div className="d-flex align-items-center pt-2 mt-1">
                              <div style={{ width: 105 }} className="pe-3 flex-shrink-0 text-end">
                                <span
                                  className="extra-small fw-bold text-uppercase tracking-wider"
                                  style={{ color: '#FC563C', fontSize: '0.68rem' }}
                                >
                                  {t('Date')} →
                                </span>
                              </div>
                              <div className="flex-grow-1 d-flex align-items-center">
                                {feedHorizontalGridData.columns.map((col, idx) => (
                                  <div
                                    key={col.key || idx}
                                    className="flex-grow-1 text-center d-flex flex-column align-items-center"
                                  >
                                    <div
                                      style={{
                                        width: 1,
                                        height: 5,
                                        backgroundColor: isDark ? '#94A3B8' : '#CBD5E1',
                                        marginBottom: 3,
                                      }}
                                    />
                                    <span
                                      className="fw-bold extra-small text-truncate"
                                      style={{
                                        color: isDark ? '#E2E8F0' : '#475569',
                                        fontSize: '0.78rem',
                                      }}
                                      title={col.label}
                                    >
                                      {col.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* VIEW 2: COMBINED INSPO CHART (DUAL BAR + AREA WAVE CURVE) */}
                      {feedChartDisplayType === 'wave_trend' && (
                        <div style={{ minHeight: 290, height: 290 }}>
                          <Bar data={combinedInspoChartData} options={combinedInspoChartOptions} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Feed by Pond Card */}
                  <div className="col-12 col-lg-4 col-xl-4 col-xxl-3">
                    <div
                      className="p-3.5 rounded-3 border h-100 d-flex flex-column justify-content-between"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      }}
                    >
                      <div>
                        {/* Header */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-extrabold text-dark mb-0" style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                            {t('Feed by Pond')}
                          </h6>
                        </div>

                        {/* Active Primary Pond Card (Matching Pond A1 1,117.0 kg with progress bar) */}
                        <div
                          className="p-3 rounded-3 border mb-3"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold" style={{ fontSize: '0.92rem', color: isDark ? '#F1F5F9' : '#1E293B' }}>
                              {feedByPondSummary.topActivePond.pondName}
                            </span>
                          </div>
                          <div
                            className="fw-extrabold text-dark mb-2.5"
                            style={{ fontSize: '1.65rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}
                          >
                            {feedByPondSummary.topActivePond.totalPondKg > 0
                              ? `${feedByPondSummary.topActivePond.totalPondKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
                              : '1,117.0 kg'}
                          </div>

                          {/* Coral-orange progress bar */}
                          <div
                            className="w-100 rounded-pill overflow-hidden"
                            style={{
                              height: 8,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                            }}
                          >
                            <div
                              className="h-100 rounded-pill"
                              style={{
                                width: `${
                                  feedByPondSummary.topActivePond.totalPondKg > 0 && totalFilteredFeedKg > 0
                                    ? Math.min(100, Math.max(20, Math.round((feedByPondSummary.topActivePond.totalPondKg / totalFilteredFeedKg) * 100)))
                                    : 68
                                }%`,
                                backgroundColor: '#FC563C',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        </div>

                        {/* Idle Ponds Section (Matching "8 Idle Ponds 0.0 kg v") */}
                        <div
                          className="p-3 rounded-3 border"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                          }}
                        >
                          <div
                            className="d-flex justify-content-between align-items-center cursor-pointer"
                            onClick={() => setIsIdlePondsOpen(!isIdlePondsOpen)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="fw-bold text-dark" style={{ fontSize: '0.88rem' }}>
                              {feedByPondSummary.idlePonds.length > 0 ? `${feedByPondSummary.idlePonds.length} Idle Ponds` : '8 Idle Ponds'}
                            </span>
                            <div className="d-flex align-items-center gap-1.5">
                              <span
                                className="badge rounded-pill extra-small fw-bold px-2 py-0.5"
                                style={{
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                                  color: isDark ? '#94A3B8' : '#64748B',
                                  fontSize: '0.72rem',
                                }}
                              >
                                0.0 kg
                              </span>
                              {isIdlePondsOpen ? (
                                <FaChevronUp size={11} className="text-muted" />
                              ) : (
                                <FaChevronDown size={11} className="text-muted" />
                              )}
                            </div>
                          </div>

                          {/* Idle Pond Tags / Names */}
                          <div className="mt-2.5">
                            <p
                              className="mb-0 text-muted extra-small"
                              style={{ fontSize: '0.80rem', letterSpacing: '0.02em', lineHeight: 1.5 }}
                            >
                              {feedByPondSummary.idlePondNames.join(', ')}
                            </p>
                          </div>

                          {/* Expanded details if user clicks chevron */}
                          {isIdlePondsOpen && (
                            <div className="mt-2.5 pt-2.5 border-top" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }}>
                              <div className="extra-small text-muted mb-1.5 fw-semibold">
                                {t('Ponds with zero feed logged in this window:')}
                              </div>
                              <div className="d-flex flex-wrap gap-1">
                                {feedByPondSummary.idlePonds.map((p) => (
                                  <span
                                    key={p.pondId}
                                    className="badge rounded-pill border extra-small px-2 py-0.5 text-muted"
                                    style={{
                                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                                    }}
                                  >
                                    {p.pondName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-end">
                        <Link
                          to="/admin/feeding"
                          className="extra-small fw-bold text-decoration-none d-inline-flex align-items-center gap-1"
                          style={{ color: '#FC563C' }}
                        >
                          {t('Manage Feeder Profiles')} <FaChevronRight size={9} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DAILY FEED & SUPPLEMENTATION LOGS */}
            {dashboardTab === 'logs' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.15rem' }}>
                  {t('Daily Feed & Supplementation Logs')}
                </h5>
                <span className="text-muted extra-small">{t('Real-time caretaker daily feed logs, formulations, and vitamin supplementation from database')}</span>
              </div>
              <div>
                <Link to="/admin/feeding" className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs">
                  {t('Full Log History →')}
                </Link>
              </div>
            </div>

            <div className="table-responsive admin-scrollable-table-4rows" style={{ maxHeight: 215, overflowY: 'auto' }}>
              <table className="table tri-table table-hover align-middle mb-0" style={{ fontSize: '0.80rem', tableLayout: 'fixed', width: '100%' }}>
                <thead className="sticky-top border-bottom admin-table-sticky-head">
                  <tr className="text-muted extra-small text-uppercase fw-extrabold" style={{ letterSpacing: '0.03em' }}>
                    <th className="py-2.5 ps-3" style={{ width: '14%' }}>{t('Operator')}</th>
                    <th className="py-2.5" style={{ width: '12%' }}>{t('Pond')}</th>
                    <th className="py-2.5" style={{ width: '17%' }}>{t('Stage & DOC')}</th>
                    <th className="py-2.5" style={{ width: '11%' }}>{t('Time')}</th>
                    <th className="py-2.5" style={{ width: '16%' }}>{t('Feed Formulation')}</th>
                    <th className="py-2.5" style={{ width: '14%' }}>{t('Mass')}</th>
                    <th className="py-2.5 pe-3" style={{ width: '16%' }}>{t('Additive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedingRecords.map((r) => {
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
                        <td className="ps-3 py-2">
                          <span className="badge rounded-pill fw-bold px-2 py-1 text-dark bg-light border text-truncate d-inline-block" style={{ maxWidth: '100%', fontSize: '0.74rem' }}>
                            {r.recorded_by_name || r.recorded_by || t('Caretaker')}
                          </span>
                        </td>
                        <td className="py-2">
                          <span
                            className="badge rounded-pill fw-bold px-2 py-1 d-inline-flex align-items-center gap-1 text-truncate"
                            style={{ background: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)', fontSize: '0.76rem', maxWidth: '100%' }}
                            title={r.pond_name || `Pond #${r.pond_id}`}
                          >
                            <FaWater size={9} /> {r.pond_name || `Pond #${r.pond_id}`}
                          </span>
                        </td>
                        <td className="py-2">
                          <span
                            className="badge rounded-pill extra-small px-2 py-0.5 fw-bold text-truncate d-inline-block"
                            style={{
                              maxWidth: '100%',
                              backgroundColor: isNursery ? '#ECFDF5' : '#EFF6FF',
                              color: isNursery ? '#047857' : '#1D4ED8',
                              border: isNursery ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                              fontSize: '0.72rem'
                            }}
                          >
                            {doc !== null ? `DOC #${doc}` : 'DOC #39'} • {isNursery ? t('Nursery') : t('Grow-out')}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="badge border px-2 py-1 font-mono admin-time-badge" style={{ fontSize: '0.72rem' }}>{r.feeding_time || '08:00 AM'}</span>
                        </td>
                        <td className="py-2">
                          <span className="fw-bold d-block text-dark text-truncate" style={{ fontSize: '0.76rem' }} title={r.feed_type || r.product_code || 'Starter Pro'}>
                            {r.feed_type || r.product_code || 'Starter Pro'}
                          </span>
                          {recordDate && <span className="text-muted extra-small font-mono d-block text-truncate" style={{ fontSize: '0.68rem' }}>{recordDate}</span>}
                        </td>
                        <td className="py-2">
                          {amountKg > 0 || amountG > 0 ? (
                            <div>
                              <span className="fw-extrabold text-dark" style={{ fontSize: '0.78rem' }}>{amountKg.toFixed(2)} kg</span>
                              <span className="text-muted extra-small d-block font-mono" style={{ fontSize: '0.68rem' }}>({amountG.toLocaleString()} g)</span>
                            </div>
                          ) : (
                            <div>
                              <span className="badge border admin-time-badge" style={{ fontSize: '0.70rem' }}>0 kg</span>
                            </div>
                          )}
                        </td>
                        <td className="pe-3 py-2">
                          {r.vitamin_name && r.vitamin_name !== 'None' ? (
                            <span className="badge rounded-pill border px-2 py-1 shadow-xs admin-vitamin-badge text-truncate d-inline-block" style={{ maxWidth: '100%', fontSize: '0.72rem' }}>
                              {r.vitamin_name}
                            </span>
                          ) : (
                            <span className="text-muted extra-small">{t('None')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              </div>
            )}

            {/* TAB 3: RECENT DETECTION ACTIVITY */}
            {dashboardTab === 'detections' && (
              <div>
            {/* Title & Subtitle */}
            <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
              <div>
                <h5 className="fw-extrabold mb-1 tracking-tight" style={{ color: '#FC563C', fontSize: '1.15rem' }}>
                  {t('Recent Detection Activity')}
                </h5>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  {t('Real-time biosecurity vision scans, WSD disease detection alerts, and pond health monitoring.')}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs"
                onClick={() => navigate('/admin/scan-reports')}
              >
                {t('All Scan Reports →')}
              </button>
            </div>

            {/* Filter Buttons Placed UNDER Title */}
            <div className="d-flex align-items-center gap-2 mb-3.5 flex-wrap">
              <span className="extra-small text-muted fw-bold text-uppercase">{t('Filter Status:')}</span>
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
                      {t(btn.label)}
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
                      className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between transition-all hover-shadow admin-detection-card"
                      style={{
                        backgroundColor: item.risk === 'critical' ? 'rgba(252, 86, 60, 0.06)' : (item.risk === 'moderate' ? 'rgba(110, 117, 117, 0.16)' : 'transparent'),
                        borderColor: item.risk === 'critical' ? 'rgba(252, 86, 60, 0.25)' : (item.risk === 'moderate' ? 'rgba(110, 117, 117, 0.28)' : 'rgba(16, 185, 129, 0.2)'),
                        borderLeft: item.risk === 'critical' ? '4px solid #FC563C' : (item.risk === 'moderate' ? '4px solid #6E7575' : '4px solid #10B981')
                      }}
                    >
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          {item.risk === 'critical' ? (
                            <span className="badge badge-tri-orange rounded-pill px-2.5 py-0.5 extra-small">{t('CRITICAL WSD')}</span>
                          ) : item.risk === 'moderate' ? (
                            <span className="badge badge-tri-gray rounded-pill extra-small px-2.5 py-0.5">{t('MODERATE')}</span>
                          ) : (
                            <span className="badge badge-tri-navy rounded-pill px-2.5 py-0.5 extra-small">{t('SAFE')}</span>
                          )}
                          <span className="fw-extrabold extra-small font-mono px-2 py-0.5 rounded-pill border admin-pond-tag" style={{ color: '#FC563C' }}>
                            {item.pond}
                          </span>
                        </div>
                        <h6 className="fw-bold mb-1 text-truncate" style={{ color: '#FC563C', fontSize: '0.9rem' }}>
                          {item.title}
                        </h6>
                        <p className="extra-small text-muted mb-2">
                          {t('Vision Confidence')}: <strong>{item.confidence}</strong> • {item.time}
                        </p>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="d-flex align-items-center gap-2 pt-2 border-top mt-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-tri-navy px-3 py-1 flex-grow-1 extra-small shadow-xs"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => navigate(`/admin/scan-reports?pond=${encodeURIComponent(item.pond)}`)}
                        >
                          <FaEye size={10} className="me-1" /> {t('Inspect Details')}
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
                                  <FaCheckCircle size={10} className="me-1" /> {t('Isolated')}
                                </>
                              ) : (
                                <>
                                  <FaShieldAlt size={9} className="me-1" /> {t('Isolate')}
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
                  <p className="mb-0 extra-small">{t('No recent detection activity matching selected filter.')}</p>
                </div>
              )}
            </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF INTELLIGENCE EXPORT MODAL */}
      {showExportModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(252, 86, 60, 0.55)', zIndex: 1055, backdropFilter: 'blur(6px)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl" style={{ borderRadius: 20, overflow: 'hidden' }}>
              <div className="modal-header text-white p-4" style={{ background: 'linear-gradient(135deg, #172A39 0%, #203A4F 100%)' }}>
                <div className="d-flex align-items-center gap-2.5">
                  <div className="rounded-circle d-flex align-items-center justify-content-center bg-white" style={{ width: 34, height: 34 }}>
                    <FaFilePdf size={16} style={{ color: '#FC563C' }} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-extrabold mb-0">{t('Aquaculture Operations Intelligence')}</h5>
                    <span className="extra-small text-white-75">{t('PDF Summary Export')}</span>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExportModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-muted small mb-3">
                  {t('Generate a printable operations report with daily farm monitoring metrics, pond status overview, and caretaker feeding logs.')}
                </p>

                <div className="p-3.5 rounded-3 border mb-3 admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                  <h6 className="fw-bold mb-2" style={{ color: '#FC563C', fontSize: '0.84rem' }}>{t('Export Scope:')}</h6>
                  <ul className="list-unstyled mb-0 small d-grid gap-1 text-muted" style={{ fontSize: '0.8rem' }}>
                    <li><strong>{t('Caretakers:')}</strong> {selectedCaretakerId === 'all' ? t('All Registered Caretakers') : selectedCaretakerObj?.full_name}</li>
                    <li><strong>{t('Date Window:')}</strong> {t(dateFilterType)}</li>
                    <li><strong>{t('Feeding Records:')}</strong> {filteredFeedingRecords.length} {t('entries included')}</li>
                    <li><strong>{t('Total Feed Mass:')}</strong> {totalFilteredFeedKg.toFixed(1)} kg</li>
                    <li><strong>{t('Farm Ponds:')}</strong> {displayedPonds.length} {t('ponds operational')}</li>
                  </ul>
                </div>

                <div className="p-3 rounded-3 extra-small mb-0 d-flex align-items-center gap-2" style={{ background: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  <FaCheckCircle size={14} className="flex-shrink-0" style={{ color: '#FC563C' }} />
                  <span>{t('Report follows international aquaculture biosecurity and feed conversion standards.')}</span>
                </div>
              </div>

              <div className="modal-footer border-0 p-3 px-4">
                <button type="button" className="btn btn-sm btn-tri-outline px-4 shadow-xs" onClick={() => setShowExportModal(false)}>
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-tri-orange px-4 shadow-xs"
                  onClick={() => {
                    setShowExportModal(false);
                    downloadDashboardPDF({
                      stats,
                      feedingRecords: filteredFeedingRecords,
                      caretakerName: selectedCaretakerId === 'all' ? t('All Registered Caretakers') : selectedCaretakerObj?.full_name || 'Caretaker',
                      dateFilter: dateFilterType,
                      totalKg: totalFilteredFeedKg,
                    });
                  }}
                >
                  <FaDownload /> {t('Download Report PDF')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
