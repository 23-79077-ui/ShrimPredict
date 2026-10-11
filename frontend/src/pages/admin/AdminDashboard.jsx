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
  FaCalendarCheck,
  FaCalendarAlt,
  FaClock,
  FaLeaf,
  FaGasPump,
  FaChartBar
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

        const rounded = Math.round(sum * 10) / 10;
        totalPondKg += rounded;
        return {
          ...col,
          amount: rounded,
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
    return { isSingleDate, columns, rows, maxTotalKg };
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
      {/* HERO OPERATIONS HEADER */}
      <div className="disease-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="hero-icon-badge shadow-xs">
            <FaShieldAlt />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                {t('hero.adminDashboard', 'Executive Operations Hub')}
              </h3>
              <span
                className="badge rounded-pill extra-small px-3 py-1 fw-bold"
                style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)' }}
              >
                {t('hero.realTimeIntelligence', '● Real-Time Farm Intelligence')}
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
              {t('hero.adminDashboardSub', 'O&B Aquafarm • Farm Management Dashboard & Pond Overview')}
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={fetchData}
            disabled={loading}
          >
            <FaSync size={11} className={loading ? 'fa-spin me-1.5' : 'me-1.5'} /> {t('hero.refreshTelemetry', 'Refresh Data')}
          </button>
        </div>
      </div>

      {/* 4 TRI-COLOR OPERATIONAL TELEMETRY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Metric 1: Monitored Ponds */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Monitored Ponds')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaWater size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.totalPondsCount}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: `${kpiStats.healthyPct}%`, background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {kpiStats.healthyPondsCount} {t('of')} {kpiStats.totalPondsCount} {t('Optimal')}
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {t('Active Fleet')}
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
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Field Caretakers')}</span>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaUserTie size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.activeCaretakersCount}
              </h2>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)' }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {selectedCaretakerId === 'all' ? t('All Operators Active') : selectedCaretakerObj?.full_name || t('Active Operator')}
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {t('Staffed')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Feed Mass */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(252, 86, 60, 0.18)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">
                  {t('Total Feed')} {dateFilterType !== 'all' ? `(${dateFilterType === 'today' ? t('Today') : dateFilterType})` : ''}
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
                      {selectedCaretakerObj ? `${t('All Assigned Ponds')} (${availableCaretakerPonds.length})` : t('All Ponds')}
                    </option>
                    {availableCaretakerPonds.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {feedCardTotalKg.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                {t('Total grams')}: <strong className="font-mono text-dark">{feedCardTotalGrams.toLocaleString()} g</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(12, (feedCardTotalKg / Math.max(1, displayedPonds.length * 40)) * 100))}%`,
                    background: 'linear-gradient(90deg, #FC563C 0%, #6E7575 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>
                  {feedCardRunsCount} {t('Dispersal Runs')}
                </span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#E9E4E0', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.25)' }}>
                  {feedCardRunsCount > 0 ? t('Verified') : t('No Logs')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 4: Biosecurity Health */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: kpiStats.wsdSuspectedCount > 0 ? 'rgba(252, 86, 60, 0.25)' : 'rgba(252, 86, 60, 0.12)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">{t('Biosecurity Health')}</span>
                <div className={`tri-kpi-icon ${kpiStats.wsdSuspectedCount > 0 ? 'tri-kpi-icon-orange' : 'tri-kpi-icon-blue'}`}>
                  <FaShieldAlt size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: kpiStats.wsdSuspectedCount > 0 ? '#DC2626' : '#059669', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                {kpiStats.wsdSuspectedCount > 0 ? `${kpiStats.wsdSuspectedCount} ${t('Alert')}${kpiStats.wsdSuspectedCount > 1 ? 's' : ''}` : `${kpiStats.bioSafePct}%`}
              </h2>
              <div className="extra-small text-muted fw-semibold mb-0.5">
                {t('Status')}: <strong style={{ color: kpiStats.wsdSuspectedCount > 0 ? '#DC2626' : '#059669' }}>{kpiStats.wsdSuspectedCount > 0 ? t('WSD Anomaly Detected') : t('Fleet Bio-Protected')}</strong>
              </div>
              <div className="extra-small text-muted" style={{ fontSize: '0.74rem' }}>
                {t('Detection')}: <strong>{kpiStats.wsdSuspectedCount} {t('Suspected WSD')} | {kpiStats.normalFeedCount} {t('Normal')}</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: kpiStats.wsdSuspectedCount > 0 ? 'rgba(252, 86, 60, 0.1)' : 'rgba(252, 86, 60, 0.08)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${kpiStats.bioSafePct}%`,
                    background: kpiStats.wsdSuspectedCount > 0 ? 'linear-gradient(90deg, #FC563C 0%, #6E7575 100%)' : 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">{t('CNN Vision Classifier')}</span>
                <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: kpiStats.wsdSuspectedCount > 0 ? '#E9E4E0' : 'rgba(252, 86, 60, 0.06)', color: kpiStats.wsdSuspectedCount > 0 ? '#FC563C' : '#FC563C', border: kpiStats.wsdSuspectedCount > 0 ? '1px solid rgba(252, 86, 60, 0.25)' : '1px solid rgba(252, 86, 60, 0.15)' }}>
                  {kpiStats.wsdSuspectedCount > 0 ? t('CNN Alert') : t('100% Safe')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AdminFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('Search pond or caretaker')}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onExportCSV={() => setShowExportModal(true)}
        exportLabel={t('Export PDF')}
        onRefresh={fetchData}
        loading={loading}
        tabs={[
          { id: 'all', label: t('All Ponds'), count: displayedPonds.length },
          { id: 'today', label: t('Today') },
          { id: 'yesterday', label: t('Yesterday') },
          { id: 'last7', label: t('Last 7 Days') }
        ]}
        activeTab={dateFilterType}
        onTabChange={setDateFilterType}
        metaRight={
          <>
            {t('Target Feed')}: <strong>{t('Days 1–19 Nursery (Starter)')}</strong> &rarr; <strong>{t('Day 20+ Grow-out (Grower)')}</strong>
          </>
        }
        filterFields={[
          {
            label: t('Evaluation Date'),
            icon: <FaCalendarAlt className="me-1" style={{ color: '#FC563C' }} />,
            type: 'date',
            value: customDate,
            onChange: (val) => {
              setCustomDate(val);
              setDateFilterType('custom');
            },
            colClass: 'col-12 col-md-3'
          },
          {
            label: t('Filter by Pond'),
            type: 'select',
            value: selectedPondFilter,
            onChange: (val) => {
              setSelectedPondFilter(val);
              setFeedCardPondFilter(val);
            },
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'all', label: selectedCaretakerObj ? `${t('All Assigned Ponds')} (${availableCaretakerPonds.length})` : t('All Ponds') },
              ...availableCaretakerPonds.map((name) => ({
                value: name,
                label: name
              }))
            ]
          },
          {
            label: t('Disease Detection'),
            type: 'select',
            value: diseaseFilter,
            onChange: setDiseaseFilter,
            colClass: 'col-12 col-md-2',
            options: [
              { value: 'all', label: t('All detections') },
              { value: 'critical', label: t('Critical') },
              { value: 'moderate', label: t('Moderate') },
              { value: 'safe', label: t('Safe / Healthy') }
            ]
          },
          {
            label: t('Assigned Caretaker'),
            type: 'select',
            value: selectedCaretakerId,
            onChange: (val) => {
              setSelectedCaretakerId(val);
              setSelectedPondFilter('all');
              setFeedCardPondFilter('all');
            },
            colClass: 'col-12 col-md-3',
            options: [
              { value: 'all', label: t('All caretakers') },
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
                        <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.15rem' }}>{t('Ponds Overview')}</h5>
                        <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                          {t('Live farm status across grow-out and nursery ponds. Click any summary card to filter ponds.')}
                        </p>
                      </div>
                      <span className="badge rounded-pill extra-small px-3 py-1.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.06)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                        {t('Total')} {totalPondsCount} {totalPondsCount === 1 ? t('Pond') : t('Ponds')}
                      </span>
                    </div>

                    {/* Interactive Summary Cards for Ponds (All, Healthy, Warning, Critical) */}
                    <div className="row g-2.5 mb-3">
                      {/* Card 1: All Ponds */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 transition-all cursor-pointer h-100 admin-summary-filter-card ${
                            pondStatusFilter === 'all' ? 'shadow-sm active' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'all' ? (isDark ? 'rgba(252, 86, 60, 0.18)' : '#FFF5F3') : (isDark ? '#1E293B' : '#FFFFFF'),
                            borderColor: pondStatusFilter === 'all' ? '#FC563C' : (isDark ? '#334155' : '#CBD5E1'),
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            boxShadow: pondStatusFilter === 'all' ? '0 0 0 3px rgba(252, 86, 60, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                          onClick={() => setPondStatusFilter('all')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#FC563C', fontSize: '0.72rem' }}>
                              {t('All Ponds')}
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: 'rgba(252, 86, 60, 0.12)', color: '#FC563C' }}>
                              {t('Total')}
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#FC563C', fontSize: '1.4rem' }}>
                              {totalPondsCount}
                            </h4>
                            <span className="text-muted extra-small">{t('ponds')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Healthy */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 transition-all cursor-pointer h-100 admin-summary-filter-card ${
                            pondStatusFilter === 'healthy' ? 'shadow-sm active' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'healthy' ? (isDark ? 'rgba(22, 163, 74, 0.18)' : '#F0FDF4') : (isDark ? '#1E293B' : '#FFFFFF'),
                            borderColor: pondStatusFilter === 'healthy' ? '#16A34A' : (isDark ? '#334155' : '#CBD5E1'),
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            boxShadow: pondStatusFilter === 'healthy' ? '0 0 0 3px rgba(22, 163, 74, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'healthy' ? 'all' : 'healthy')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#16A34A', fontSize: '0.72rem' }}>
                              ● {t('Healthy')}
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: 'rgba(34, 197, 94, 0.18)', color: '#16A34A' }}>
                              {healthyPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#16A34A', fontSize: '1.4rem' }}>
                              {healthyCount}
                            </h4>
                            <span className="text-muted extra-small">{t('optimal')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Warning */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 transition-all cursor-pointer h-100 admin-summary-filter-card ${
                            pondStatusFilter === 'warning' ? 'shadow-sm active' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'warning' ? (isDark ? 'rgba(245, 158, 11, 0.18)' : '#FFFBEB') : (isDark ? '#1E293B' : '#FFFFFF'),
                            borderColor: pondStatusFilter === 'warning' ? '#F59E0B' : (isDark ? '#334155' : '#CBD5E1'),
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            boxShadow: pondStatusFilter === 'warning' ? '0 0 0 3px rgba(245, 158, 11, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'warning' ? 'all' : 'warning')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#D97706', fontSize: '0.72rem' }}>
                              ● {t('Warning')}
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#D97706' }}>
                              {warningPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#D97706', fontSize: '1.4rem' }}>
                              {warningCount}
                            </h4>
                            <span className="text-muted extra-small">{t('attention')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Critical */}
                      <div className="col-6 col-md-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 rounded-3 transition-all cursor-pointer h-100 admin-summary-filter-card ${
                            pondStatusFilter === 'critical' ? 'shadow-sm active' : 'hover-shadow'
                          }`}
                          style={{
                            backgroundColor: pondStatusFilter === 'critical' ? (isDark ? 'rgba(220, 38, 38, 0.18)' : '#FEF2F2') : (isDark ? '#1E293B' : '#FFFFFF'),
                            borderColor: pondStatusFilter === 'critical' ? '#DC2626' : (isDark ? '#334155' : '#CBD5E1'),
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            boxShadow: pondStatusFilter === 'critical' ? '0 0 0 3px rgba(220, 38, 38, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                          onClick={() => setPondStatusFilter(pondStatusFilter === 'critical' ? 'all' : 'critical')}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="extra-small fw-bold text-uppercase" style={{ color: '#DC2626', fontSize: '0.72rem' }}>
                              ● {t('Critical')}
                            </span>
                            <span className="badge rounded-pill extra-small px-1.5 py-0.5" style={{ backgroundColor: 'rgba(220, 38, 38, 0.18)', color: '#DC2626' }}>
                              {criticalPct}%
                            </span>
                          </div>
                          <div className="d-flex align-items-baseline gap-1.5">
                            <h4 className="fw-extrabold mb-0" style={{ color: '#DC2626', fontSize: '1.4rem' }}>
                              {criticalCount}
                            </h4>
                            <span className="text-muted extra-small">{t('alerts')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Status Filter Indicator Banner */}
                    {pondStatusFilter !== 'all' && (
                      <div className="d-flex justify-content-between align-items-center mb-3 px-3 py-1.5 rounded-3" style={{ backgroundColor: 'rgba(252, 86, 60, 0.04)', border: '1px dashed rgba(252, 86, 60, 0.2)' }}>
                        <span className="extra-small fw-semibold" style={{ color: '#FC563C' }}>
                          {t('Filtered by')} <strong>{t(pondStatusFilter.toUpperCase())}</strong>: {t('Showing')} {displayedPonds.filter(p => {
                            const status = (p.status || '').toLowerCase().trim();
                            const disease = (p.disease_detection || '').toLowerCase().trim();
                            if (pondStatusFilter === 'critical') return status === 'critical' || disease.includes('white spot');
                            if (pondStatusFilter === 'warning') return (status === 'warning' || status === 'maintenance' || disease.includes('black gill')) && status !== 'critical';
                            if (pondStatusFilter === 'healthy') return status === 'healthy' && !disease.includes('white spot');
                            if (pondStatusFilter === 'unmonitored') return !['healthy', 'warning', 'maintenance', 'critical'].includes(status);
                            return true;
                          }).length} {t('pond(s)')}
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 extra-small fw-bold text-decoration-none"
                          style={{ color: '#FC563C', fontSize: '0.72rem' }}
                          onClick={() => setPondStatusFilter('all')}
                        >
                          {t('Clear Status Filter ×')}
                        </button>
                      </div>
                    )}
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

              return (
                <>
                  {categoryFilteredPonds.length === 0 ? (
                    <div className="p-4 text-center rounded-3 bg-white border my-2" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                      <p className="text-muted mb-0 small">
                        {pondStatusFilter === 'isolated'
                          ? t('No ponds are currently isolated. To isolate a pond at risk, click "Isolate" on critical disease alerts below.')
                          : `${t('No ponds found matching')} "${t(pondStatusFilter.toUpperCase())}".`}
                      </p>
                    </div>
                  ) : (
                    <div className="admin-scrollable-ponds-overview">
                      <div className="row g-3.5 g-md-4">
                        {categoryFilteredPonds.map((p) => {
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
                          <div className={`col-12 col-md-${categoryFilteredPonds.length === 1 ? '12' : '6'}`} key={p.id}>
                            <div
                              className="p-4 rounded-4 d-flex flex-column justify-content-between h-100 transition-all hover-shadow admin-pond-card"
                              style={{
                                borderTop: '1px solid rgba(252, 86, 60, 0.12)',
                                borderRight: '1px solid rgba(252, 86, 60, 0.12)',
                                borderBottom: '1px solid rgba(252, 86, 60, 0.12)',
                                borderLeft: isIsolated ? '4px solid #7C3AED' : (isCritical ? '4px solid #EF4444' : (isWarning ? '4px solid #F59E0B' : '4px solid #10B981')),
                                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
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
                                        backgroundColor: isIsolated ? '#F5F3FF' : (isCritical ? '#FEF2F2' : (isWarning ? '#FFFBEB' : '#ECFDF5')),
                                        color: isIsolated ? '#7C3AED' : (isCritical ? '#EF4444' : (isWarning ? '#D97706' : '#059669')),
                                        fontSize: '0.85rem',
                                      }}
                                    >
                                      <FaWater />
                                    </div>
                                    <div>
                                      <strong className="d-block text-dark fw-extrabold" style={{ fontSize: '0.98rem', lineHeight: 1.2 }}>
                                        {p.pond_name || p.name || `Pond #${p.id}`}
                                      </strong>
                                      <span className="text-muted extra-small">{t('Pond')}</span>
                                    </div>
                                  </div>

                                  {/* Health Status badge */}
                                  <span
                                    className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill shadow-2xs"
                                    style={{
                                      backgroundColor: isIsolated ? '#F5F3FF' : (isCritical ? '#FEF2F2' : (isWarning ? '#FFFBEB' : '#ECFDF5')),
                                      border: isIsolated ? '1px solid rgba(124, 58, 237, 0.35)' : (isCritical ? '1px solid rgba(239, 68, 68, 0.28)' : (isWarning ? '1px solid rgba(245, 158, 11, 0.28)' : '1px solid rgba(16, 185, 129, 0.25)')),
                                      color: isIsolated ? '#7C3AED' : (isCritical ? '#DC2626' : (isWarning ? '#D97706' : '#059669')),
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span
                                      className="rounded-circle"
                                      style={{ width: 6, height: 6, backgroundColor: isIsolated ? '#7C3AED' : (isCritical ? '#DC2626' : (isWarning ? '#D97706' : '#059669')) }}
                                    />
                                    <span>{t(statusStr)}</span>
                                  </span>
                                </div>

                                {/* Tier 2: Culture Stage / DOC Pill */}
                                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                                  <span
                                    className="badge rounded-pill px-2.5 py-1 extra-small fw-bold"
                                    style={{
                                      backgroundColor: isNursery ? '#ECFDF5' : '#EFF6FF',
                                      color: isNursery ? '#047857' : '#1D4ED8',
                                      border: isNursery ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {isNursery ? `${t('Nursery')} (DOC #${doc || '39'})` : `${t('Grow-out')} (DOC #${doc || '39'})`}
                                  </span>
                                  <span className="text-muted extra-small">
                                    {doc ? `${t('Day')} ${doc} ${t('of cycle')}` : t('Active Cycle')}
                                  </span>
                                </div>

                                {/* Tier 3: Caretaker & Feed Strip */}
                                <div
                                  className="p-2.5 rounded-3 mb-3 admin-stat-box"
                                  style={{
                                    border: '1px solid #E2E8F0',
                                  }}
                                >
                                  <div className="d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center gap-2">
                                      <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: 26, height: 26, background: '#1E293B', fontSize: '0.7rem' }}
                                      >
                                        <FaUserTie />
                                      </div>
                                      <div>
                                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.66rem' }}>{t('Caretaker')}</span>
                                        <strong className="text-dark fw-bold" style={{ fontSize: '0.82rem' }}>{caretakerName}</strong>
                                      </div>
                                    </div>
                                    <div style={{ width: 1, height: 24, backgroundColor: '#E2E8F0' }} />
                                    <div className="text-end">
                                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.66rem' }}>{t('Total Feed')}</span>
                                      <strong className="text-dark fw-extrabold" style={{ fontSize: '0.92rem' }}>
                                        {totalFeedKg.toFixed(1)} <small className="text-muted" style={{ fontSize: '0.68rem' }}>kg</small>
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Tier 4: Actions Footer */}
                              <div className="d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.07)' }}>
                                <div className="d-flex align-items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs"
                                    style={{ fontSize: '0.74rem' }}
                                    onClick={() => navigate(`/admin/ponds?pond_id=${p.id}`)}
                                  >
                                    <FaEye size={10} className="me-1" style={{ color: '#FC563C' }} /> {t('View Pond')}
                                  </button>
                                  {isIsolated && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-secondary px-2.5 py-1 extra-small shadow-xs"
                                      style={{ fontSize: '0.72rem' }}
                                      onClick={() => handleLiftIsolation(p.pond_name || p.name)}
                                      title="Lift isolation quarantine protocol"
                                    >
                                      <FaUndo size={9} className="me-1" /> {t('Restore')}
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-tri-outline-orange px-3 py-1 extra-small shadow-xs"
                                  style={{ fontSize: '0.74rem' }}
                                  onClick={() => navigate(`/admin/feeding?pond=${encodeURIComponent(p.pond_name || p.name)}`)}
                                >
                                  <FaUtensils size={10} className="me-1" /> {t('Feeding Logs')}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}

                  {/* Footer Information */}
                  <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                    <span className="extra-small text-muted fw-semibold">
                      {t('Showing')} <strong style={{ color: '#FC563C' }}>{categoryFilteredPonds.length}</strong> {t('Ponds')} {categoryFilteredPonds.length > 4 && <span className="text-muted fw-normal ms-1">({t('scroll to view all')})</span>}
                    </span>
                    <Link to="/admin/ponds" className="fw-bold extra-small text-decoration-none ms-auto" style={{ color: '#FC563C' }}>
                      {t('Manage All Ponds →')}
                    </Link>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* RIGHT TELEMETRY COLUMN: HARVEST FORECAST & DISEASE RISK BREAKDOWN (Stacked Vertically) */}
        <div className="col-12 col-xl-5 d-flex flex-column gap-3">
          {/* 1. HARVEST MILESTONE FORECAST */}
          <div className="tri-card p-4 d-flex flex-column justify-content-between flex-fill">
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
                  {/* Header Row */}
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div>
                      <h6 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#FC563C', fontSize: '1.05rem' }}>
                        {t('Harvest Milestone Forecast')}
                      </h6>
                      <span className="text-muted extra-small" style={{ fontSize: '0.76rem' }}>
                        {focusedPond.pond_name || 'Pond A1'} • {caretakerName}
                      </span>
                    </div>

                    {/* Compact Tri-Color Pond Selector Pill */}
                    <div
                      className="d-flex align-items-center gap-1 px-2.5 py-1 rounded-pill bg-white shadow-2xs"
                      style={{ border: '1px solid rgba(252, 86, 60, 0.18)', height: 32 }}
                    >
                      <FaWater style={{ color: '#FC563C', fontSize: '0.74rem' }} />
                      <select
                        className="form-select form-select-sm border-0 bg-transparent fw-semibold p-0 ps-1 pe-3 cursor-pointer"
                        style={{
                          width: 'auto',
                          minWidth: 140,
                          fontSize: '0.74rem',
                          outline: 'none',
                          color: '#FC563C',
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%230B2C5F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.1rem center',
                          backgroundSize: '10px 10px',
                          paddingRight: '1rem'
                        }}
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

                  {/* 4-Box Key Forecast Metrics Grid */}
                  <div className="row g-2 mb-3">
                    <div className="col-3">
                      <div className="p-2.5 rounded-3 border text-center h-100 admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.15)' }}>
                        <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('Stage')}</span>
                        <span className="fw-extrabold d-block" style={{ color: '#FC563C', fontSize: '0.86rem' }}>
                          {focusedIsNursery ? t('Nursery') : t('Grow-out')}
                        </span>
                        <div className="fw-bold" style={{ color: '#FC563C', fontSize: '0.72rem' }}>DOC #{focusedDoc}</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2.5 rounded-3 border text-center h-100 admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.15)' }}>
                        <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('Est. Yield')}</span>
                        <span className="fw-extrabold d-block" style={{ color: '#FC563C', fontSize: '0.86rem' }}>
                          {estHarvestKg.toFixed(0)} kg
                        </span>
                        <div className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>{(estHarvestKg / 1000).toFixed(2)} T</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2.5 rounded-3 border text-center h-100 admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.15)' }}>
                        <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('ABW')}</span>
                        <span className="fw-extrabold d-block" style={{ color: '#FC563C', fontSize: '0.86rem' }}>
                          {abwGrams.toFixed(1)} g
                        </span>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{t('Sampling')}</div>
                      </div>
                    </div>
                    <div className="col-3">
                      <div className="p-2.5 rounded-3 border text-center h-100 admin-stat-box" style={{ borderColor: 'rgba(252, 86, 60, 0.15)' }}>
                        <span className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.65rem' }}>{t('Target')}</span>
                        <span className="fw-extrabold d-block" style={{ color: '#FC563C', fontSize: '0.86rem' }}>
                          {targetHarvestDays}d
                        </span>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>DOC 90+</div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone Timeline Track */}
                  <div className="milestone-track my-3" style={{ paddingTop: 8, paddingBottom: 6 }}>
                    <div className="milestone-line-bg" style={{ background: 'rgba(252, 86, 60, 0.15)', top: 17 }}></div>
                    <div className="milestone-line-fill" style={{ width: `${cultureProgressPct}%`, background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)', top: 17 }}></div>

                    {/* Step 1 */}
                    <div className="milestone-step">
                      <div className="milestone-node completed" style={{ width: 24, height: 24, background: '#FC563C', color: '#FFFFFF', fontSize: '0.68rem' }}>
                        <FaCheck size={9} />
                      </div>
                      <span className="fw-bold mt-1 extra-small" style={{ color: '#FC563C', fontSize: '0.7rem' }}>{t('PL-15')}</span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>Day 1</span>
                    </div>

                    {/* Step 2 */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 20 ? 'completed' : 'current'}`}
                        style={{
                          width: 24,
                          height: 24,
                          background: '#FC563C',
                          color: '#FFFFFF',
                          fontSize: '0.68rem',
                          boxShadow: focusedDoc < 20 ? '0 0 0 3px rgba(252, 86, 60, 0.2)' : undefined
                        }}
                      >
                        {focusedDoc >= 20 ? <FaCheck size={9} /> : '2'}
                      </div>
                      <span className="fw-bold mt-1 extra-small" style={{ color: '#FC563C', fontSize: '0.7rem' }}>{t('Nursery')}</span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>D1–19</span>
                    </div>

                    {/* Step 3 (Grow-out) */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 20 ? 'current' : 'upcoming'}`}
                        style={{
                          width: 24,
                          height: 24,
                          background: focusedDoc >= 20 ? '#FC563C' : '#F1F5F9',
                          color: focusedDoc >= 20 ? '#FFFFFF' : '#94A3B8',
                          fontSize: '0.68rem',
                          boxShadow: focusedDoc >= 20 ? '0 0 0 3px rgba(252, 86, 60, 0.25)' : undefined
                        }}
                      >
                        3
                      </div>
                      <span className="fw-bold mt-1 extra-small" style={{ color: focusedDoc >= 20 ? '#FC563C' : '#64748B', fontSize: '0.7rem' }}>
                        {t('Grow-out')}
                      </span>
                      <span className="badge rounded-pill text-white" style={{ background: '#FC563C', fontSize: '0.62rem', padding: '1.5px 5px' }}>
                        {cultureProgressPct}%
                      </span>
                    </div>

                    {/* Step 4 */}
                    <div className="milestone-step">
                      <div
                        className={`milestone-node ${focusedDoc >= 90 ? 'completed' : 'upcoming'}`}
                        style={{
                          width: 24,
                          height: 24,
                          background: focusedDoc >= 90 ? '#FC563C' : '#F1F5F9',
                          color: focusedDoc >= 90 ? '#FFFFFF' : '#94A3B8',
                          fontSize: '0.68rem'
                        }}
                      >
                        {focusedDoc >= 90 ? <FaCheck size={9} /> : '4'}
                      </div>
                      <span className="fw-bold mt-1 extra-small text-muted" style={{ fontSize: '0.7rem' }}>{t('Harvest')}</span>
                      <span className="text-muted extra-small font-mono" style={{ fontSize: '0.64rem' }}>Day 90+</span>
                    </div>
                  </div>

                  {/* Growth Progress & Target Telemetry Strip */}
                  <div className="p-3 rounded-3 mb-2.5 admin-stat-box" style={{ border: '1px solid rgba(252, 86, 60, 0.15)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <span className="extra-small text-muted fw-semibold" style={{ fontSize: '0.74rem' }}>
                        {t('Cycle Maturity')}: <strong style={{ color: '#FC563C' }}>{focusedDoc} / 90 {t('Days')}</strong>
                      </span>
                      <span className="badge rounded-pill extra-small" style={{ backgroundColor: 'rgba(252, 86, 60, 0.12)', color: '#FC563C', fontSize: '0.7rem' }}>
                        {cultureProgressPct}% {t('Completed')}
                      </span>
                    </div>
                    <div className="tri-progress-track" style={{ height: 7, backgroundColor: 'rgba(252, 86, 60, 0.08)' }}>
                      <div
                        className="tri-progress-bar"
                        style={{ width: `${cultureProgressPct}%`, background: 'linear-gradient(90deg, #172A39 0%, #FC563C 100%)' }}
                      />
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2 extra-small text-muted" style={{ fontSize: '0.7rem' }}>
                      <span>{t('Stocked')}: {focusedPond.stocking_date || '2026-08-10'}</span>
                      <span>{t('Est. Harvest Target')}: ~{targetHarvestDays}d {t('remaining')}</span>
                    </div>
                  </div>

                  {/* Proportional Biomass & Feeding Rate Strip */}
                  <div className="p-2.5 rounded-3 mb-2 admin-stat-box d-flex justify-content-around align-items-center text-center" style={{ border: '1px solid rgba(252, 86, 60, 0.12)' }}>
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('RUNNING FEED')}</span>
                      <strong className="d-block text-dark fw-bold" style={{ fontSize: '0.82rem' }}>~{(totalFeedKg / Math.max(1, focusedDoc)).toFixed(1)} kg/d</strong>
                    </div>
                    <div style={{ width: 1, height: 22, backgroundColor: 'rgba(252, 86, 60, 0.18)' }} />
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('TARGET HARVEST WEIGHT')}</span>
                      <strong className="d-block fw-bold" style={{ color: '#FC563C', fontSize: '0.82rem' }}>{estHarvestKg.toFixed(0)} kg</strong>
                    </div>
                    <div style={{ width: 1, height: 22, backgroundColor: 'rgba(252, 86, 60, 0.18)' }} />
                    <div>
                      <span className="text-muted extra-small d-block" style={{ fontSize: '0.65rem' }}>{t('EST. SURVIVAL')}</span>
                      <strong className="d-block text-success fw-bold" style={{ fontSize: '0.82rem' }}>88.5% SR</strong>
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
                <div className="pt-2.5 mt-auto d-flex justify-content-between align-items-center border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                  <span className="text-muted extra-small" style={{ fontSize: '0.75rem' }}>
                    {t('Feed')}: <strong style={{ color: '#FC563C' }}>{totalFeedKg.toFixed(1)} kg</strong> • FCR: <strong>0.73</strong>
                  </span>
                  <Link to="/admin/harvest" className="fw-bold extra-small text-decoration-none" style={{ color: '#FC563C', fontSize: '0.75rem' }}>
                    {t('Growth Curve →')}
                  </Link>
                </div>
              );
            })()}
          </div>

          {/* 2. DISEASE RISK BREAKDOWN */}
          <div className="tri-card p-4 d-flex flex-column justify-content-between flex-fill">
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
              let riskColor = '#10B981';

              if (totalCount > 0) {
                safeCount = activeDiseaseReports.filter(r => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase() === 'healthy').length;
                modCount = activeDiseaseReports.filter(r => ['moderate', 'medium', 'warning'].includes((r.risk_level || '').toLowerCase())).length;
                critCount = activeDiseaseReports.filter(r => ['high', 'critical'].includes((r.risk_level || '').toLowerCase()) || (r.disease_name || '').toLowerCase().includes('wssv') || (r.disease_name || '').toLowerCase().includes('wsd')).length;

                safePct = Math.round((safeCount / totalCount) * 100);
                modPct = Math.round((modCount / totalCount) * 100);
                critPct = Math.max(0, 100 - safePct - modPct);

                if (critCount > 0 || critPct >= 30) {
                  riskLevel = 'HIGH';
                  riskColor = '#FC563C';
                } else if (modCount > 0 || modPct >= 20) {
                  riskLevel = 'MOD';
                  riskColor = '#6E7575';
                } else {
                  riskLevel = 'LOW';
                  riskColor = '#10B981';
                }
              } else if (isFiltered) {
                safePct = 100;
                modPct = 0;
                critPct = 0;
                safeCount = 0;
                riskLevel = 'LOW';
                riskColor = '#10B981';
              } else {
                safePct = 51;
                modPct = 5;
                critPct = 44;
                riskLevel = 'HIGH';
                riskColor = '#FC563C';
              }

              // Dynamic scope label
              let scopeLabel = t('Biosecurity Health Index');
              if (selectedCaretakerObj && selectedPondFilter !== 'all') {
                scopeLabel = `${selectedCaretakerObj.full_name} • ${selectedPondFilter}`;
              } else if (selectedCaretakerObj) {
                scopeLabel = `${selectedCaretakerObj.full_name} (${totalCount} ${totalCount === 1 ? t('record') : t('records')})`;
              } else if (selectedPondFilter !== 'all') {
                scopeLabel = `${selectedPondFilter} (${totalCount} ${totalCount === 1 ? t('record') : t('records')})`;
              } else if (searchQuery.trim()) {
                scopeLabel = `"${searchQuery}" (${totalCount} ${totalCount === 1 ? t('record') : t('records')})`;
              }

              return (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
                    <div>
                      <h6 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.05rem' }}>
                        {t('Disease Risk Breakdown')}
                      </h6>
                      <span className="text-muted extra-small" style={{ fontSize: '0.76rem' }}>{scopeLabel}</span>
                    </div>
                    <span className="badge badge-tri-navy rounded-pill px-2.5 py-1 extra-small" style={{ fontSize: '0.74rem' }}>
                      ● {safePct}% {t('Bio-Safe')}
                    </span>
                  </div>

                  {/* Proportional Donut Chart */}
                  <div className="position-relative d-flex justify-content-center align-items-center my-2" style={{ height: 165 }}>
                    <Doughnut
                      data={{
                        labels: [t('Safe'), t('Moderate Risk'), t('Critical Alert')],
                        datasets: [
                          {
                            data: [safePct || (modPct === 0 && critPct === 0 ? 1 : 0), modPct, critPct],
                            backgroundColor: ['#10B981', '#64748B', '#EF4444'],
                            borderWidth: 2.5,
                            borderColor: isDark ? '#0F172A' : '#FFFFFF',
                            hoverOffset: 3
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        cutout: '70%'
                      }}
                    />
                    <div className="position-absolute text-center">
                      <span className="extra-small text-muted d-block" style={{ fontSize: '0.66rem' }}>
                        {isFiltered ? t('Target Risk') : t('Fleet Risk')}
                      </span>
                      <strong className="fw-extrabold" style={{ color: riskColor, fontSize: '1.15rem', lineHeight: 1.1 }}>
                        {t(riskLevel)}
                      </strong>
                    </div>
                  </div>

                  {/* Legend Tags */}
                  <div className="d-flex justify-content-center gap-2 mb-2.5 flex-wrap">
                    <span className="badge badge-tri-navy rounded-pill px-2.5 py-1 extra-small d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                      <span style={{ color: '#10B981' }}>●</span> {t('Safe')} ({safePct}%)
                    </span>
                    {modPct > 0 && (
                      <span className="badge badge-tri-gray rounded-pill extra-small px-2.5 py-1 d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                        <span style={{ color: '#6E7575' }}>●</span> {t('Moderate')} ({modPct}%)
                      </span>
                    )}
                    {critPct > 0 && (
                      <span className="badge badge-tri-orange rounded-pill px-2.5 py-1 extra-small d-inline-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                        <span style={{ color: '#FC563C' }}>●</span> {t('Critical')} ({critPct}%)
                      </span>
                    )}
                  </div>

                  {/* Micro Status Metric Row */}
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <div className="p-2 rounded-3 text-center admin-stat-box" style={{ border: '1.5px solid rgba(16, 185, 129, 0.25)', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4' }}>
                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.64rem' }}>{t('SAFE')}</span>
                        <strong className="d-block" style={{ color: '#10B981', fontSize: '0.92rem' }}>{safeCount}</strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded-3 text-center admin-stat-box" style={{ border: '1.5px solid rgba(100, 116, 139, 0.25)', backgroundColor: isDark ? 'rgba(100, 116, 139, 0.08)' : '#F8FAFC' }}>
                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.64rem' }}>{t('CAUTION')}</span>
                        <strong className="d-block" style={{ color: '#64748B', fontSize: '0.92rem' }}>{modCount}</strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded-3 text-center admin-stat-box" style={{ border: '1.5px solid rgba(239, 68, 68, 0.25)', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2' }}>
                        <span className="text-muted extra-small d-block" style={{ fontSize: '0.64rem' }}>{t('CRITICAL')}</span>
                        <strong className="d-block" style={{ color: '#EF4444', fontSize: '0.92rem' }}>{critCount}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Surveillance & Containment Status Strip */}
                  <div className="p-2 rounded-3 mb-2 admin-stat-box d-flex justify-content-between align-items-center extra-small text-muted" style={{ border: '1px solid rgba(11, 44, 95, 0.08)', fontSize: '0.68rem' }}>
                    <span className="d-flex align-items-center gap-1.5">
                      <span className="p-1 rounded-circle bg-success"></span>
                      {t('Surveillance Core')}: <strong>ResNet-50 CNN</strong>
                    </span>
                    <span className="text-secondary fw-semibold">
                      {t('Status')}: <strong style={{ color: critCount > 0 ? '#FC563C' : '#10B981' }}>{critCount > 0 ? t('Active Alert') : t('Fleet Safe')}</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Symmetrical Bottom Footer */}
            {(() => {
              const isFiltered = selectedCaretakerId !== 'all' || selectedPondFilter !== 'all' || searchQuery.trim() !== '' || dateFilterType !== 'all';
              const activeDiseaseReports = isFiltered ? filteredDiseaseReports : (allDiseaseReports.length > 0 ? allDiseaseReports : []);
              const critCount = activeDiseaseReports.filter(r => ['high', 'critical'].includes((r.risk_level || '').toLowerCase()) || (r.disease_name || '').toLowerCase().includes('wssv') || (r.disease_name || '').toLowerCase().includes('wsd')).length;
              const safeCount = activeDiseaseReports.filter(r => (r.risk_level || '').toLowerCase() === 'low' || (r.disease_name || '').toLowerCase() === 'healthy').length;

              return (
                <div className="pt-2.5 mt-auto d-flex justify-content-between align-items-center border-top" style={{ borderColor: 'rgba(252, 86, 60, 0.08)' }}>
                  <span className="text-muted extra-small" style={{ fontSize: '0.75rem' }}>
                    {t('Active Detections')}: <strong style={{ color: critCount > 0 ? '#FC563C' : '#10B981' }}>{critCount} {t('Critical')}</strong> • {safeCount} {t('Safe')}
                  </span>
                  <Link to="/admin/biosecurity" className="fw-bold extra-small text-decoration-none" style={{ color: '#FC563C', fontSize: '0.75rem' }}>
                    {t('Bio-Risk Center →')}
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
                {/* Chart Header with High-Contrast Numerical Highlights & Bar View Mode Controls */}
            <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.15rem' }}>
                    {t('Daily Feed Monitoring & Trend')}
                  </h5>
                  <span
                    className="badge rounded-pill extra-small fw-bold px-2.5 py-0.5"
                    style={{ backgroundColor: 'rgba(252, 86, 60, 0.08)', color: '#FC563C' }}
                  >
                    <FaChartBar className="me-1" style={{ color: '#FC563C' }} /> {t('Bar Graph')}
                  </span>
                  {selectedPondFilter !== 'all' && (
                    <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5 bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                      {t('Filter')}: {selectedPondFilter}
                    </span>
                  )}
                  {selectedCaretakerObj && (
                    <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5 bg-info-subtle text-info-emphasis border border-info-subtle">
                      {t('Caretaker')}: {selectedCaretakerObj.full_name}
                    </span>
                  )}
                </div>
                <p className="text-muted mb-0 small" style={{ fontSize: '0.82rem' }}>
                  {effectiveFeedChartMode === 'by_date'
                    ? t('Dates on bottom (X-axis) with feed consumption partitioned across all ponds on the side.')
                    : t('Y-axis displays Pond Names with feed consumption partitioned across recent dates.')}
                </p>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                {/* View Switcher Pills */}
                <div
                  className="btn-group btn-group-sm p-0.5 rounded-pill bg-light border shadow-2xs"
                  role="group"
                  aria-label="Feed bar chart mode switcher"
                >
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2.5 py-1 extra-small fw-bold transition-all ${
                      effectiveFeedChartMode === 'by_pond'
                        ? 'btn-tri-navy text-white shadow-xs'
                        : 'text-muted border-0 bg-transparent'
                    }`}
                    onClick={() => setFeedChartViewMode('by_pond')}
                    title="Y-axis: Pond Name, X-axis: Feed kg across Dates (Horizontal Bar Chart)"
                  >
                    📊 {t('Horizontal Bar (By Pond)')}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs rounded-pill px-2.5 py-1 extra-small fw-bold transition-all ${
                      effectiveFeedChartMode === 'by_date'
                        ? 'btn-tri-navy text-white shadow-xs'
                        : 'text-muted border-0 bg-transparent'
                    }`}
                    onClick={() => setFeedChartViewMode('by_date')}
                    title="X-axis: Date, Y-axis: Feed kg (Vertical Bar Chart)"
                  >
                    📈 {t('Vertical Bar (By Date)')}
                  </button>
                </div>


                <Link to="/admin/feeding" className="btn btn-sm btn-tri-outline px-3 py-1 extra-small shadow-xs">
                  {t('Feeder Schedule →')}
                </Link>
              </div>
            </div>

            {/* High-Contrast Numerical Highlights */}
            <div className="row g-3 mb-3">
              <div className="col-4">
                <div className="p-3 rounded-3 border admin-stat-box" style={{ borderColor: '#E2E8F0' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">{t('Total Feed Mass')}</span>
                  <span className="fw-extrabold fs-4 text-dark">{totalFilteredFeedKg.toFixed(2)} kg</span>
                  <span className="extra-small d-block fw-semibold text-muted">{Math.round(totalFilteredFeedKg * 1000).toLocaleString()} {t('grams total')}</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 border admin-stat-box" style={{ borderColor: '#E2E8F0' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">{t('Automated Cycles')}</span>
                  <span className="fw-extrabold fs-4 text-dark">{filteredFeedingRecords.length} {t('Runs')}</span>
                  <span className="extra-small text-muted d-block">{filteredFeedingRecords.length > 0 ? t('Verified logs') : t('No logs in window')}</span>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 border admin-stat-box" style={{ borderColor: '#E2E8F0' }}>
                  <span className="extra-small text-muted text-uppercase fw-bold d-block">{t('Feeding Schedule Followed')}</span>
                  <span className="fw-extrabold fs-4 text-dark">
                    {filteredFeedingRecords.length > 0 ? '100%' : '—'}
                  </span>
                  <span className="extra-small text-muted d-block">{t('Zero feed waste')}</span>
                </div>
              </div>
            </div>

            {/* Bar Chart Container / Custom Horizontal Matrix */}
            {effectiveFeedChartMode === 'by_pond' ? (
              <div className="feed-horizontal-matrix-container mt-1">
                {/* Top Legend: Dates with matching color indicators */}
                <div className="d-flex align-items-center justify-content-end flex-wrap gap-2 mb-2.5">
                  {feedHorizontalGridData.columns.map((col, idx) => (
                    <span
                      key={col.key || idx}
                      className="d-inline-flex align-items-center gap-1.5 extra-small fw-bold"
                      style={{ color: isDark ? '#E2E8F0' : '#1E293B', fontSize: '0.74rem' }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background: col.gradient || col.color,
                          display: 'inline-block',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        }}
                      />
                      {col.label}
                    </span>
                  ))}
                </div>

                {/* Matrix Bar Graph Board */}
                <div
                  className="p-3 rounded-3 admin-matrix-board"
                  style={{
                    border: '1px solid rgba(252, 86, 60, 0.09)',
                    boxShadow: '0 1px 4px rgba(252, 86, 60, 0.04)',
                    overflowX: 'auto',
                  }}
                >
                  <div
                    style={{
                      minWidth: '100%',
                    }}
                  >
                    {/* Header Row */}
                    <div className="d-flex align-items-center pb-2 mb-2.5 border-bottom border-light">
                      <div style={{ width: 110 }} className="pe-2 flex-shrink-0">
                        <span
                          className="fw-bold extra-small text-uppercase tracking-wider"
                          style={{ color: '#FC563C', fontSize: '0.72rem' }}
                        >
                          {t('Pond Name')}
                        </span>
                      </div>
                      <div className="flex-grow-1" />
                      <div style={{ width: 85 }} className="ps-2 flex-shrink-0 text-end">
                        <span
                          className="fw-bold extra-small text-uppercase tracking-wider"
                          style={{ color: '#FC563C', fontSize: '0.72rem' }}
                        >
                          {t('Total Feed')}
                        </span>
                      </div>
                    </div>

                    {/* Rows of Ponds (Stacked Horizontal Bars like uploaded pic) */}
                    {feedHorizontalGridData.rows.length === 0 ? (
                      <div className="text-center py-4 text-muted extra-small">
                        {t('No feeding data or ponds match the current filter selection.')}
                      </div>
                    ) : (
                      feedHorizontalGridData.rows.map((row) => {
                        const activeSegments = row.values.filter((v) => v.amount > 0);
                        const barWidthPercent =
                          row.totalPondKg > 0 && feedHorizontalGridData.maxTotalKg > 0
                            ? Math.max(16, Math.min(100, Math.round((row.totalPondKg / feedHorizontalGridData.maxTotalKg) * 100)))
                            : 0;

                        return (
                          <div
                            key={row.pondId}
                            className="d-flex align-items-center mb-2.5 pb-2.5 border-bottom border-light"
                            style={{ minHeight: 44 }}
                          >
                            {/* Pond Name Only (No caretaker, no Y-axis label) */}
                            <div
                              className="d-flex align-items-center pe-2 flex-shrink-0"
                              style={{ width: 110 }}
                            >
                              <span
                                className="fw-extrabold text-truncate"
                                style={{ color: '#FC563C', fontSize: '0.88rem' }}
                                title={row.pondName}
                              >
                                {row.pondName}
                              </span>
                            </div>

                            {/* Center: Stacked Horizontal Bar with Segments touching each other ("dikit-dikit") */}
                            <div
                              className="flex-grow-1 position-relative d-flex align-items-center admin-matrix-track"
                              style={{
                                height: 38,
                                borderRadius: 8,
                                padding: '2px',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Background Guide Lines */}
                              <div
                                className="position-absolute top-0 bottom-0"
                                style={{ left: '25%', width: 1, backgroundColor: '#E2E8F0', opacity: 0.7, pointerEvents: 'none' }}
                              />
                              <div
                                className="position-absolute top-0 bottom-0"
                                style={{ left: '50%', width: 1, backgroundColor: '#E2E8F0', opacity: 0.7, pointerEvents: 'none' }}
                              />
                              <div
                                className="position-absolute top-0 bottom-0"
                                style={{ left: '75%', width: 1, backgroundColor: '#E2E8F0', opacity: 0.7, pointerEvents: 'none' }}
                              />

                              {row.totalPondKg > 0 && activeSegments.length > 0 ? (
                                <div
                                  className="d-flex align-items-center h-100 position-relative transition-all"
                                  style={{
                                    width: `${barWidthPercent}%`,
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 6px rgba(252, 86, 60, 0.14)',
                                  }}
                                >
                                  {activeSegments.map((v, sIdx) => {
                                    const segWidthPct = (v.amount / row.totalPondKg) * 100;
                                    return (
                                      <div
                                        key={v.key || sIdx}
                                        className="d-flex align-items-center justify-content-center h-100 position-relative fw-bold text-white transition-all"
                                        style={{
                                          width: `${segWidthPct}%`,
                                          background: v.gradient || v.color,
                                          borderRight: sIdx < activeSegments.length - 1 ? '1.5px solid rgba(255, 255, 255, 0.9)' : 'none',
                                          fontSize: segWidthPct < 9 ? '0.72rem' : '0.8rem',
                                          fontWeight: 800,
                                          letterSpacing: '-0.01em',
                                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.55)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          padding: '0 4px',
                                          cursor: 'pointer',
                                          userSelect: 'none',
                                        }}
                                        title={`${row.pondName} • ${v.label}: ${v.formattedKg}`}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.filter = 'brightness(1.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.filter = 'none';
                                        }}
                                      >
                                        {segWidthPct >= 11
                                          ? `${v.amount.toFixed(1)} kg`
                                          : (segWidthPct >= 6 ? `${v.amount.toFixed(1)}` : `${Math.round(v.amount)}`)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="ps-2 text-muted extra-small fst-italic">
                                  {t('No feed dispensed')}
                                </div>
                              )}
                            </div>

                            {/* Right: Pond Total Feed */}
                            <div
                              className="d-flex align-items-center justify-content-end ps-2 flex-shrink-0"
                              style={{ width: 85 }}
                            >
                              <span
                                className="badge rounded-pill px-2.5 py-1.5 extra-small fw-extrabold"
                                style={{
                                  backgroundColor: row.totalPondKg > 0 ? 'rgba(252, 86, 60, 0.08)' : '#F1F5F9',
                                  color: row.totalPondKg > 0 ? '#FC563C' : '#94A3B8',
                                  fontSize: '0.8rem',
                                }}
                                title={`Total period feed for ${row.pondName}`}
                              >
                                {row.totalPondKg.toFixed(1)} kg
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Dates at the Bottom (Replacing the kg scale with the dates) */}
                    <div className="d-flex align-items-center pt-2 mt-1">
                      <div style={{ width: 110 }} className="pe-2 flex-shrink-0" />
                      <div
                        className="flex-grow-1 d-flex justify-content-between align-items-center px-1"
                        style={{ minHeight: 24 }}
                      >
                        {feedHorizontalGridData.columns.map((col, idx) => (
                          <div key={col.key || idx} className="text-center d-flex flex-column align-items-center">
                            <div
                              style={{
                                width: 2,
                                height: 6,
                                backgroundColor: isDark ? '#94A3B8' : '#64748B',
                                marginBottom: 3,
                                borderRadius: 1,
                              }}
                            />
                            <span
                              className="fw-bold extra-small text-truncate"
                              style={{ color: isDark ? '#E2E8F0' : '#0F172A', fontSize: '0.82rem' }}
                              title={col.label}
                            >
                              {col.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ width: 85 }} className="ps-2 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ minHeight: 280, height: 280 }}>
                <Bar data={feedChart} options={feedChartOptions} />
              </div>
            )}
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
                onClick={() => navigate('/admin/disease-reports')}
              >
                {t('All Detection Reports →')}
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
                          onClick={() => navigate(`/admin/disease-reports?pond=${encodeURIComponent(item.pond)}`)}
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
