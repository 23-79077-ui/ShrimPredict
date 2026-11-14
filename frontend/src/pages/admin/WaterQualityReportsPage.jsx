import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import {
  FaWater,
  FaThermometerHalf,
  FaVial,
  FaWind,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSearch,
  FaSync,
  FaPlus,
  FaFileCsv,
  FaEye,
  FaTrash,
  FaCalendarAlt,
  FaInfoCircle,
  FaTimes,
  FaClock,
  FaUserCheck,
  FaMicrochip,
  FaLayerGroup,
  FaAward,
  FaFlask,
  FaTint
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';
import { useLanguage } from '../../context/LanguageContext';

const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      const cleaned = url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/shrim_predict_api)?(\/backend)?/i, '');
      return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    }
    return url;
  }
  let clean = url.replace(/^\/?(shrim_predict_api\/)?(backend\/)?/, '');
  if (!clean.startsWith('uploads/')) {
    clean = `uploads/${clean}`;
  }
  return `/${clean}`;
};

const formatDate = (dateValue, timeValue) => {
  if (!dateValue) return 'No date';
  const fullStr = timeValue ? `${dateValue} ${timeValue}` : dateValue;
  const d = new Date(fullStr);
  if (isNaN(d.getTime())) return String(dateValue);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${m} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
};

export default function WaterQualityReportsPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id');
  const targetPond = searchParams.get('pond');

  const [records, setRecords] = useState([]);
  const [pondsList, setPondsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pondFilter, setPondFilter] = useState(targetPond || 'all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Normal' | 'Warning' | 'Critical'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'temp-desc' | 'do-asc'

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [chartPondFilter, setChartPondFilter] = useState('all');

  // New Record Form State
  const [formPondId, setFormPondId] = useState('');
  const [formTemp, setFormTemp] = useState('28.5');
  const [formPh, setFormPh] = useState('7.8');
  const [formDo, setFormDo] = useState('6.2');
  const [formSalinity, setFormSalinity] = useState('18.0');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);

  // Load water quality records from backend
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/water_quality_reports.php', {
        params: { all: 1 }
      });
      if (res.data?.success && Array.isArray(res.data.records)) {
        setRecords(res.data.records);
      } else if (Array.isArray(res.data)) {
        setRecords(res.data);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error('Failed to load water quality reports:', err);
      // Fallback try water_quality_records.php directly
      try {
        const fallbackRes = await api.get('/water_quality_records.php', { params: { all: 1 } });
        if (fallbackRes.data?.success && Array.isArray(fallbackRes.data.records)) {
          setRecords(fallbackRes.data.records);
        }
      } catch (fbErr) {
        setRecords([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load ponds list for dropdown filter and creation
  const loadPonds = useCallback(async () => {
    try {
      const res = await api.get('/ponds.php');
      const list = safeArray(res.data);
      setPondsList(list);
      if (list.length > 0 && !formPondId) {
        setFormPondId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load ponds list:', e);
    }
  }, [formPondId]);

  useEffect(() => {
    loadRecords();
    loadPonds();
  }, [loadRecords, loadPonds]);

  // Deep-link auto-select
  useEffect(() => {
    if ((targetId || targetPond) && records.length > 0) {
      const matched = records.find((r) => {
        if (targetId && String(r.id) === String(targetId)) return true;
        if (targetPond && String(r.pond_name || '').toLowerCase() === targetPond.toLowerCase()) return true;
        return false;
      });
      if (matched) {
        setSelectedRecord(matched);
      }
    }
  }, [targetId, targetPond, records]);

  // Distinct ponds present in records
  const pondOptions = useMemo(() => {
    const names = new Set();
    records.forEach((r) => {
      if (r.pond_name) names.add(r.pond_name);
    });
    return Array.from(names).sort();
  }, [records]);

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchPond = String(r.pond_name || '').toLowerCase().includes(q);
          const matchCaretaker = String(r.recorded_by_name || '').toLowerCase().includes(q);
          const matchStatus = String(r.status || '').toLowerCase().includes(q);
          const matchDate = String(r.record_date || '').includes(q);
          const matchNotes = String(r.notes || '').toLowerCase().includes(q);
          if (!matchPond && !matchCaretaker && !matchStatus && !matchDate && !matchNotes) {
            return false;
          }
        }

        // Pond filter
        if (pondFilter !== 'all') {
          if (String(r.pond_name || '').toLowerCase() !== pondFilter.toLowerCase()) {
            return false;
          }
        }

        // Status filter (Safe vs Critical)
        if (statusFilter !== 'all') {
          const s = String(r.status || 'Safe').toLowerCase();
          const target = statusFilter.toLowerCase();
          if (target === 'safe') {
            if (s !== 'safe' && s !== 'normal') return false;
          } else if (target === 'critical') {
            if (s !== 'critical' && s !== 'warning') return false;
          } else if (s !== target) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.record_date || b.created_at || 0) - new Date(a.record_date || a.created_at || 0) || (b.id - a.id);
        }
        if (sortBy === 'oldest') {
          return new Date(a.record_date || a.created_at || 0) - new Date(b.record_date || b.created_at || 0) || (a.id - b.id);
        }
        if (sortBy === 'temp-desc') {
          return parseFloat(b.temperature || 0) - parseFloat(a.temperature || 0);
        }
        if (sortBy === 'do-asc') {
          return parseFloat(a.dissolved_oxygen || 0) - parseFloat(b.dissolved_oxygen || 0);
        }
        return 0;
      });
  }, [records, search, pondFilter, statusFilter, sortBy]);

  // KPI Summary Statistics
  const summary = useMemo(() => {
    const total = records.length;
    let safeCount = 0;
    let criticalCount = 0;
    let sumTemp = 0;
    let sumDo = 0;
    let sumPh = 0;
    let sumSal = 0;
    const pondsSet = new Set();

    records.forEach((r) => {
      const s = String(r.status || 'Safe').toLowerCase();
      if (s === 'critical' || s === 'warning') criticalCount++;
      else safeCount++;

      if (r.pond_name) pondsSet.add(r.pond_name);

      sumTemp += parseFloat(r.temperature || 0);
      sumDo += parseFloat(r.dissolved_oxygen || 0);
      sumPh += parseFloat(r.ph_level || 0);
      sumSal += parseFloat(r.salinity || 0);
    });

    return {
      total,
      safeCount,
      criticalCount,
      uniquePonds: pondsSet.size,
      avgTemp: total > 0 ? (sumTemp / total).toFixed(1) : '28.5',
      avgDo: total > 0 ? (sumDo / total).toFixed(2) : '6.20',
      avgPh: total > 0 ? (sumPh / total).toFixed(2) : '7.80',
      avgSal: total > 0 ? (sumSal / total).toFixed(1) : '18.0',
    };
  }, [records]);

  // Chart records filtered by chartPondFilter
  const chartRecords = useMemo(() => {
    if (chartPondFilter === 'all') return records;
    return records.filter((r) => String(r.pond_name || '').toLowerCase() === chartPondFilter.toLowerCase());
  }, [records, chartPondFilter]);

  const chartSummary = useMemo(() => {
    const total = chartRecords.length;
    let normalCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    chartRecords.forEach((r) => {
      const s = String(r.status || 'Safe').toLowerCase();
      if (s === 'critical' || s === 'danger') criticalCount++;
      else if (s === 'warning' || s === 'suboptimal') warningCount++;
      else normalCount++;
    });

    return {
      total,
      normalCount,
      warningCount,
      criticalCount,
    };
  }, [chartRecords]);

  // Parameter-by-parameter analysis (DO, Temp, pH Level, Salinity) & Overall Water Quality Score
  const parameterAnalysis = useMemo(() => {
    const total = chartRecords.length;

    let doNormal = 0, doWarning = 0, doCritical = 0, doSum = 0, doCount = 0;
    let tempNormal = 0, tempWarning = 0, tempCritical = 0, tempSum = 0, tempCount = 0;
    let phNormal = 0, phWarning = 0, phCritical = 0, phSum = 0, phCount = 0;
    let salNormal = 0, salWarning = 0, salCritical = 0, salSum = 0, salCount = 0;

    chartRecords.forEach((r) => {
      // 1. DO (Dissolved Oxygen) - Safe >= 5.0, Warning 4.0-4.99, Critical < 4.0
      if (r.dissolved_oxygen !== undefined && r.dissolved_oxygen !== null && r.dissolved_oxygen !== '') {
        const v = parseFloat(r.dissolved_oxygen);
        if (!isNaN(v)) {
          doSum += v;
          doCount++;
          if (v < 4.0) doCritical++;
          else if (v < 5.0) doWarning++;
          else doNormal++;
        }
      }

      // 2. Temperature (°C) - Safe 26.0-32.0, Warning 24.0-25.9 or 32.1-33.9, Critical <24 or >=34
      if (r.temperature !== undefined && r.temperature !== null && r.temperature !== '') {
        const v = parseFloat(r.temperature);
        if (!isNaN(v)) {
          tempSum += v;
          tempCount++;
          if (v < 24.0 || v >= 34.0) tempCritical++;
          else if (v < 26.0 || v >= 32.5) tempWarning++;
          else tempNormal++;
        }
      }

      // 3. pH Level - Safe 7.5-8.5, Warning 7.0-7.49 or 8.51-8.8, Critical <7.0 or >8.8
      if (r.ph_level !== undefined && r.ph_level !== null && r.ph_level !== '') {
        const v = parseFloat(r.ph_level);
        if (!isNaN(v)) {
          phSum += v;
          phCount++;
          if (v < 7.0 || v > 8.8) phCritical++;
          else if (v < 7.5 || v > 8.5) phWarning++;
          else phNormal++;
        }
      }

      // 4. Salinity (ppt) - Safe 15.0-28.0, Warning 10.0-14.9 or 28.1-32.0, Critical <10.0 or >32.0
      if (r.salinity !== undefined && r.salinity !== null && r.salinity !== '') {
        const v = parseFloat(r.salinity);
        if (!isNaN(v)) {
          salSum += v;
          salCount++;
          if (v < 10.0 || v > 32.0) salCritical++;
          else if (v < 15.0 || v > 28.0) salWarning++;
          else salNormal++;
        }
      }
    });

    const formatSummaryText = (tot, norm, warn, crit) => {
      if (tot === 0) return t('No test records');
      const parts = [];
      if (norm > 0) parts.push(`${norm} ${t('Normal')}`);
      if (warn > 0) parts.push(`${warn} ${t('Warning')}`);
      if (crit > 0) parts.push(`${crit} ${t('Critical')}`);
      const breakdown = parts.length > 0 ? parts.join(', ') : `${norm} ${t('Normal')}`;
      return `${tot} ${tot === 1 ? t('Test') : t('Tests')} (${breakdown})`;
    };

    // Overall Water Quality Score (0 - 100%)
    const totalParamsEvaluated = doCount + tempCount + phCount + salCount;
    let score = 100;
    if (totalParamsEvaluated > 0) {
      const totalPoints =
        (doNormal + tempNormal + phNormal + salNormal) * 100 +
        (doWarning + tempWarning + phWarning + salWarning) * 60 +
        (doCritical + tempCritical + phCritical + salCritical) * 0;
      score = Math.round(totalPoints / totalParamsEvaluated);
    } else if (total > 0) {
      const totalPoints = chartSummary.normalCount * 100 + chartSummary.warningCount * 60;
      score = Math.round(totalPoints / total);
    }

    let ratingText = t('EXCELLENT');
    let ratingColor = '#10B981';
    let gradientColors = ['#06B6D4', '#10B981'];

    if (score < 60) {
      ratingText = t('CRITICAL');
      ratingColor = '#EF4444';
      gradientColors = ['#F87171', '#EF4444'];
    } else if (score < 75) {
      ratingText = t('FAIR');
      ratingColor = '#F59E0B';
      gradientColors = ['#FBBF24', '#F59E0B'];
    } else if (score < 90) {
      ratingText = t('GOOD');
      ratingColor = '#0EA5E9';
      gradientColors = ['#38BDF8', '#0EA5E9'];
    }

    return {
      score,
      ratingText,
      ratingColor,
      gradientColors,
      parameters: [
        {
          id: 'do',
          title: 'DO',
          fullName: 'Dissolved Oxygen',
          unit: 'mg/L',
          target: '≥ 5.0 mg/L',
          avg: doCount > 0 ? (doSum / doCount).toFixed(2) : '6.20',
          total: doCount,
          normal: doNormal,
          warning: doWarning,
          critical: doCritical,
          summaryText: formatSummaryText(doCount, doNormal, doWarning, doCritical),
          Icon: FaWind,
          iconBg: '#E0F2FE',
          iconColor: '#0284C7',
        },
        {
          id: 'temp',
          title: 'Temp',
          fullName: 'Temperature',
          unit: '°C',
          target: '26.0 – 32.0 °C',
          avg: tempCount > 0 ? (tempSum / tempCount).toFixed(1) : '28.5',
          total: tempCount,
          normal: tempNormal,
          warning: tempWarning,
          critical: tempCritical,
          summaryText: formatSummaryText(tempCount, tempNormal, tempWarning, tempCritical),
          Icon: FaThermometerHalf,
          iconBg: '#FEE2E2',
          iconColor: '#FC563C',
        },
        {
          id: 'ph',
          title: 'pH Level',
          fullName: 'pH Level',
          unit: 'pH',
          target: '7.5 – 8.5',
          avg: phCount > 0 ? (phSum / phCount).toFixed(2) : '7.80',
          total: phCount,
          normal: phNormal,
          warning: phWarning,
          critical: phCritical,
          summaryText: formatSummaryText(phCount, phNormal, phWarning, phCritical),
          Icon: FaFlask,
          iconBg: '#DCFCE7',
          iconColor: '#16A34A',
        },
        {
          id: 'salinity',
          title: 'Salinity',
          fullName: 'Salinity',
          unit: 'ppt',
          target: '15.0 – 28.0 ppt',
          avg: salCount > 0 ? (salSum / salCount).toFixed(1) : '18.0',
          total: salCount,
          normal: salNormal,
          warning: salWarning,
          critical: salCritical,
          summaryText: formatSummaryText(salCount, salNormal, salWarning, salCritical),
          Icon: FaTint,
          iconBg: '#EDE9FE',
          iconColor: '#7C3AED',
        },
      ]
    };
  }, [chartRecords, chartSummary, t]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('No Data'),
        text: t('No water quality records available to export.'),
        confirmButtonColor: '#FC563C',
      });
      return;
    }

    const headers = ['ID', 'Pond Name', 'Temperature (°C)', 'pH Level', 'DO (mg/L)', 'Salinity (ppt)', 'Status', 'Date Tested', 'Recorded By', 'Capture Mode', 'Notes'];
    const rows = filteredRecords.map((r) => [
      r.id,
      `"${(r.pond_name || '').replace(/"/g, '""')}"`,
      r.temperature || 0,
      r.ph_level || 0,
      r.dissolved_oxygen || 0,
      r.salinity || 0,
      `"${r.status || 'Normal'}"`,
      `"${r.record_date || ''} ${r.recorded_at || ''}"`,
      `"${(r.recorded_by_name || 'Caretaker').replace(/"/g, '""')}"`,
      `"${r.capture_mode || 'manual'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Water_Quality_Reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Delete Record
  const handleDeleteRecord = async (record) => {
    const result = await Swal.fire({
      title: t('Delete Water Quality Record?'),
      html: `Delete record for <strong>${record.pond_name || 'Pond'}</strong> on <strong>${record.record_date}</strong>?<br/><span class="text-muted extra-small">DO: ${record.dissolved_oxygen} mg/L • Temp: ${record.temperature}°C • pH: ${record.ph_level}</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6E7575',
      confirmButtonText: t('Yes, Delete'),
      cancelButtonText: t('Cancel'),
    });

    if (result.isConfirmed) {
      try {
        const res = await api.delete('/water_quality_records.php', {
          params: { id: record.id }
        });
        if (res.data?.success) {
          Swal.fire({
            icon: 'success',
            title: t('Record Deleted'),
            text: t('The water quality test has been removed.'),
            confirmButtonColor: '#10B981',
            timer: 2000,
          });
          if (selectedRecord?.id === record.id) {
            setSelectedRecord(null);
          }
          loadRecords();
        } else {
          Swal.fire({
            icon: 'error',
            title: t('Delete Failed'),
            text: res.data?.message || t('Could not delete record.'),
            confirmButtonColor: '#EF4444',
          });
        }
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: t('Error'),
          text: err.response?.data?.message || err.message,
          confirmButtonColor: '#EF4444',
        });
      }
    }
  };

  // Handle Submit New Water Test from Admin Side
  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!formPondId) {
      Swal.fire({ icon: 'warning', title: t('Select Pond'), text: t('Please select a valid pond.'), confirmButtonColor: '#FC563C' });
      return;
    }

    setSubmittingForm(true);
    try {
      const doVal = parseFloat(formDo);
      const tempVal = parseFloat(formTemp);
      const phVal = parseFloat(formPh);
      const salVal = parseFloat(formSalinity);

      if (
        !Number.isFinite(doVal) || doVal < 0 || doVal > 30 ||
        !Number.isFinite(tempVal) || tempVal < 0 || tempVal > 60 ||
        !Number.isFinite(phVal) || phVal < 0 || phVal > 14 ||
        !Number.isFinite(salVal) || salVal < 0 || salVal > 60
      ) {
        Swal.fire({
          icon: 'warning',
          title: t('Out-of-Bounds Value Rejected'),
          text: t('Please enter valid biological ranges: DO (0–30 mg/L), Temperature (0–60 °C), pH (0.0–14.0), and Salinity (0–60 ppt).'),
          confirmButtonColor: '#FC563C',
        });
        setSubmittingForm(false);
        return;
      }

      const formData = new FormData();
      formData.append('pond_id', formPondId);
      formData.append('recorded_by_name', 'Farm Administrator');
      formData.append('dissolved_oxygen', formDo);
      formData.append('temperature', formTemp);
      formData.append('ph_level', formPh);
      formData.append('salinity', formSalinity);
      const isSafe = (doVal >= 5.0 && doVal <= 10.0) &&
        (tempVal >= 26.0 && tempVal <= 32.0) &&
        (phVal >= 7.5 && phVal <= 8.5) &&
        (salVal >= 15.0 && salVal <= 28.0);
      formData.append('status', isSafe ? 'Safe' : 'Critical');
      formData.append('capture_mode', 'manual');
      formData.append('record_date', formDate);
      formData.append('notes', formNotes);

      const res = await api.post('/water_quality_records.php', formData);
      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: t('Test Logged Successfully'),
          text: res.data.message || t('Water quality test has been added to reports.'),
          confirmButtonColor: '#10B981',
          timer: 2000,
        });
        setShowLogModal(false);
        setFormNotes('');
        loadRecords();
      } else {
        Swal.fire({
          icon: 'error',
          title: t('Error Saving Test'),
          text: res.data?.message || t('Failed to save test record.'),
          confirmButtonColor: '#EF4444',
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: t('Submission Error'),
        text: err.response?.data?.message || err.message,
        confirmButtonColor: '#EF4444',
      });
    } finally {
      setSubmittingForm(false);
    }
  };

  // Status Badge Renderer Helper
  const renderStatusBadge = (status) => {
    const s = String(status || 'Safe').toLowerCase();
    if (s === 'critical' || s === 'warning') {
      return (
        <span
          className="badge rounded-pill fw-bold extra-small px-2.5 py-1 d-inline-flex align-items-center gap-1.5"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#DC2626' }}></span>
          <span>{t('Critical')}</span>
        </span>
      );
    }
    return (
      <span
        className="badge rounded-pill fw-bold extra-small px-2.5 py-1 d-inline-flex align-items-center gap-1.5"
        style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }}></span>
        <span>{t('Safe')}</span>
      </span>
    );
  };

  return (
    <div className="pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Water Quality Reports')}
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
            {t('• Telemetry Active')}
          </span>
        </div>

        {/* Action Controls: Refresh & CSV Export */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-2 shadow-2xs hover-shadow"
            onClick={loadRecords}
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

      {/* 2. 4 TELEMETRY KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Total Water Tests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="kpi-label">{t('Total Water Tests')}</span>
                <div className="kpi-icon-bubble" style={{ color: '#0284C7', backgroundColor: '#E0F2FE' }}>
                  <FaWater size={14} />
                </div>
              </div>
              <div className="kpi-value text-dark">
                {summary.total}
              </div>
            </div>
            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
              <span className="extra-small text-muted">{t('Historical Telemetry')}</span>
              <span className="badge rounded-pill extra-small px-2 py-0.5 bg-light border text-secondary">
                {records.length} {t('Logs')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Safe Water Tests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="kpi-label">{t('Safe Water Tests')}</span>
                <div className="kpi-icon-bubble" style={{ color: '#10B981', backgroundColor: '#D1FAE5' }}>
                  <FaCheckCircle size={14} />
                </div>
              </div>
              <div className="kpi-value text-dark" style={{ color: '#10B981' }}>
                {summary.safeCount}
              </div>
            </div>
            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
              <span className="extra-small text-muted">{t('Safe Biological Parameters')}</span>
              <span className="badge rounded-pill extra-small px-2 py-0.5" style={{ backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                {summary.total > 0 ? `${Math.round((summary.safeCount / summary.total) * 100)}% Safe` : '100%'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Critical Water Tests */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="kpi-label">{t('Critical Water Tests')}</span>
                <div className="kpi-icon-bubble" style={{ color: '#EF4444', backgroundColor: '#FEE2E2' }}>
                  <FaExclamationTriangle size={14} />
                </div>
              </div>
              <div className="kpi-value text-dark" style={summary.criticalCount > 0 ? { color: '#DC2626' } : {}}>
                {summary.criticalCount}
              </div>
            </div>
            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
              <span className="extra-small text-muted">{t('Suboptimal Readings')}</span>
              <span
                className="badge rounded-pill extra-small px-2 py-0.5"
                style={{
                  backgroundColor: summary.criticalCount > 0 ? '#FEF2F2' : '#F1F5F9',
                  color: summary.criticalCount > 0 ? '#DC2626' : '#64748B',
                  border: summary.criticalCount > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0'
                }}
              >
                {summary.criticalCount} {t('Critical')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Tested Ponds Scope */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="kpi-label">{t('Tested Ponds')}</span>
                <div className="kpi-icon-bubble" style={{ color: '#8B5CF6', backgroundColor: '#EDE9FE' }}>
                  <FaLayerGroup size={14} />
                </div>
              </div>
              <div className="kpi-value text-dark">
                {summary.uniquePonds} / {pondsList.length || 7}
              </div>
            </div>
            <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
              <span className="extra-small text-muted">{t('Pond Coverage')}</span>
              <span className="badge rounded-pill extra-small px-2 py-0.5 bg-light border text-secondary">
                Grid Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WATER QUALITY STATUS BREAKDOWN & PARAMETERS (With Pond Selector) */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-2xs"
              style={{
                width: 34,
                height: 34,
                background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
                color: '#0284C7',
                border: '1px solid #BAE6FD'
              }}
            >
              <FaWater size={15} />
            </div>
            <div>
              <h5 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.12rem' }}>
                {t('Water Quality Status Breakdown')}
              </h5>
            </div>
          </div>

          {/* Pond Selector & Telemetry Tag */}
          <div className="d-flex align-items-center gap-2.5">
            <span
              className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-none d-md-inline-flex align-items-center gap-1.5"
              style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: '0.72rem' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
              Telemetry Live
            </span>
            <div className="d-flex align-items-center gap-1.5 bg-light px-2.5 py-1 rounded-pill border" style={{ borderColor: '#CBD5E1' }}>
              <span className="extra-small text-muted fw-bold">{t('Pond:')}</span>
              <select
                className="form-select form-select-sm border-0 bg-transparent p-0 extra-small fw-extrabold text-dark"
                style={{ fontSize: '0.78rem', minWidth: 130, boxShadow: 'none', cursor: 'pointer' }}
                value={chartPondFilter}
                onChange={(e) => setChartPondFilter(e.target.value)}
              >
                <option value="all">{t('All Ponds (Fleet)')}</option>
                {pondOptions.map((pName) => (
                  <option key={pName} value={pName}>{pName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Combined Section: Status Breakdown & 4 Parameters */}
        <div className="row g-4 align-items-stretch">
          {/* Left: Overall Water Quality Score Card */}
          <div className="col-12 col-xl-4 col-lg-5">
            <div
              className="p-3.5 rounded-4 border bg-white h-100 d-flex flex-column justify-content-between"
              style={{
                borderColor: '#E2E8F0',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
              }}
            >
              {/* Header */}
              <div className="text-center mb-1">
                <span
                  className="extra-small fw-extrabold text-uppercase text-secondary"
                  style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}
                >
                  {t('OVERALL WATER QUALITY SCORE')}
                </span>
              </div>

              {/* Semicircular Radial Gauge */}
              <div className="position-relative d-flex justify-content-center align-items-center my-auto py-1">
                <svg viewBox="0 0 240 135" style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="scoreGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={parameterAnalysis.gradientColors[0]} />
                      <stop offset="60%" stopColor={parameterAnalysis.gradientColors[1]} />
                      <stop offset="100%" stopColor={parameterAnalysis.gradientColors[1]} />
                    </linearGradient>
                    <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={parameterAnalysis.ratingColor} floodOpacity="0.25" />
                    </filter>
                  </defs>
                  {/* Background track */}
                  <path
                    d="M 32,122 A 88,88 0 0,1 208,122"
                    fill="none"
                    stroke="#EEF2F6"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  {/* Active foreground arc */}
                  <path
                    d="M 32,122 A 88,88 0 0,1 208,122"
                    fill="none"
                    stroke="url(#scoreGaugeGrad)"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="276.46"
                    strokeDashoffset={276.46 * (1 - Math.max(0, Math.min(100, parameterAnalysis.score)) / 100)}
                    filter="url(#gaugeGlow)"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                </svg>

                {/* Gauge Inner Content */}
                <div
                  className="position-absolute d-flex flex-column align-items-center justify-content-center text-center"
                  style={{ top: '26px', left: 0, right: 0, pointerEvents: 'none' }}
                >
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center mb-1 shadow-2xs"
                    style={{
                      width: 30,
                      height: 30,
                      background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                      color: '#D97706',
                      border: '1.5px solid #FCD34D',
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                    }}
                  >
                    <FaAward size={15} />
                  </div>
                  <span className="fw-extrabold text-dark lh-1" style={{ fontSize: '2.25rem', letterSpacing: '-0.03em' }}>
                    {parameterAnalysis.score}%
                  </span>
                  <span
                    className="fw-extrabold text-uppercase mt-1"
                    style={{ fontSize: '0.86rem', letterSpacing: '0.06em', color: parameterAnalysis.ratingColor }}
                  >
                    {parameterAnalysis.ratingText}
                  </span>
                  <span className="extra-small text-muted text-uppercase fw-bold" style={{ fontSize: '0.64rem', letterSpacing: '0.12em' }}>
                    {t('OVERALL QUALITY')}
                  </span>
                </div>
              </div>

              {/* Total Tests & Category Pills */}
              <div className="mt-2 pt-2 border-top" style={{ borderColor: '#E2E8F0' }}>
                <div className="text-center py-1 rounded-pill border bg-white mb-2 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
                  <span className="extra-small fw-extrabold text-dark tracking-wide" style={{ fontSize: '0.76rem' }}>
                    {t('TOTAL TESTS')}: <span className="text-primary">{chartSummary.total}</span>
                  </span>
                </div>

                <div className="d-flex align-items-center justify-content-between gap-1.5">
                  {/* Normal */}
                  <div
                    className="flex-fill rounded-pill py-1 px-1.5 border d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                    style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}
                  >
                    <span
                      className="badge rounded-circle p-0 d-flex align-items-center justify-content-center text-white fw-bold"
                      style={{ width: 19, height: 19, backgroundColor: '#10B981', fontSize: '0.70rem' }}
                    >
                      {chartSummary.normalCount}
                    </span>
                    <span className="extra-small fw-bold text-success" style={{ fontSize: '0.70rem' }}>
                      {t('Normal')}
                    </span>
                  </div>

                  {/* Warning */}
                  <div
                    className="flex-fill rounded-pill py-1 px-1.5 border d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                    style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                  >
                    <span
                      className="badge rounded-circle p-0 d-flex align-items-center justify-content-center text-white fw-bold"
                      style={{ width: 19, height: 19, backgroundColor: '#F59E0B', fontSize: '0.70rem' }}
                    >
                      {chartSummary.warningCount}
                    </span>
                    <span className="extra-small fw-bold" style={{ color: '#D97706', fontSize: '0.70rem' }}>
                      {t('Warning')}
                    </span>
                  </div>

                  {/* Critical */}
                  <div
                    className="flex-fill rounded-pill py-1 px-1.5 border d-flex align-items-center justify-content-center gap-1.5 shadow-2xs"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
                  >
                    <span
                      className="badge rounded-circle p-0 d-flex align-items-center justify-content-center text-white fw-bold"
                      style={{ width: 19, height: 19, backgroundColor: '#EF4444', fontSize: '0.70rem' }}
                    >
                      {chartSummary.criticalCount}
                    </span>
                    <span className="extra-small fw-bold text-danger" style={{ fontSize: '0.70rem' }}>
                      {t('Critical')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: 4 Parameters Grid */}
          <div className="col-12 col-xl-8 col-lg-7">
            <div className="row g-3 h-100">
              {parameterAnalysis.parameters.map((param) => {
                const ParamIcon = param.Icon;
                return (
                  <div key={param.id} className="col-12 col-sm-6">
                    <div
                      className="p-3.5 rounded-4 border bg-white h-100 d-flex flex-column justify-content-between transition-all"
                      style={{
                        borderColor: '#E2E8F0',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.06)';
                        e.currentTarget.style.borderColor = '#CBD5E1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.03)';
                        e.currentTarget.style.borderColor = '#E2E8F0';
                      }}
                    >
                      {/* Top: Icon, Title, Target & Avg badge */}
                      <div className="d-flex align-items-center justify-content-between mb-2.5">
                        <div className="d-flex align-items-center gap-2.5">
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center shadow-2xs flex-shrink-0"
                            style={{
                              width: 38,
                              height: 38,
                              backgroundColor: param.iconBg,
                              color: param.iconColor,
                              border: '1px solid rgba(0,0,0,0.05)',
                              borderRadius: 12
                            }}
                          >
                            <ParamIcon size={18} />
                          </div>
                          <div>
                            <div className="d-flex align-items-baseline gap-1.5">
                              <span className="fw-extrabold text-dark" style={{ fontSize: '1.02rem', letterSpacing: '-0.01em' }}>
                                {param.title}
                              </span>
                              <span className="extra-small text-muted fw-bold">
                                ({param.unit})
                              </span>
                            </div>
                            <div className="extra-small text-muted fw-medium" style={{ fontSize: '0.72rem' }}>
                              Target: <span className="fw-bold text-dark">{param.target}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <span
                            className="badge rounded-pill px-2.5 py-1 extra-small fw-bold border bg-light text-dark shadow-2xs"
                            style={{ borderColor: '#E2E8F0', fontSize: '0.74rem' }}
                          >
                            Avg: <span className="fw-extrabold text-primary">{param.avg}</span>
                          </span>
                        </div>
                      </div>

                      {/* Middle: Segmented Progress Bar with Numbers Inside */}
                      <div className="my-2.5">
                        <div
                          className="w-100 rounded-pill overflow-hidden d-flex"
                          style={{
                            height: '28px',
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
                            padding: '2.5px',
                            gap: '2px'
                          }}
                        >
                          {param.total > 0 ? (
                            <>
                              {param.normal > 0 && (
                                <div
                                  className="h-100 rounded-pill d-flex align-items-center justify-content-center text-white fw-bold extra-small"
                                  style={{
                                    width: `${(param.normal / param.total) * 100}%`,
                                    background: 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
                                    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.35)',
                                    fontSize: '0.82rem',
                                    minWidth: 26,
                                    transition: 'width 0.4s ease'
                                  }}
                                  title={`${param.normal} ${t('Normal')}`}
                                >
                                  {param.normal}
                                </div>
                              )}
                              {param.warning > 0 && (
                                <div
                                  className="h-100 rounded-pill d-flex align-items-center justify-content-center text-white fw-bold extra-small"
                                  style={{
                                    width: `${(param.warning / param.total) * 100}%`,
                                    background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)',
                                    boxShadow: '0 1px 3px rgba(245, 158, 11, 0.35)',
                                    fontSize: '0.82rem',
                                    minWidth: 26,
                                    transition: 'width 0.4s ease'
                                  }}
                                  title={`${param.warning} ${t('Warning')}`}
                                >
                                  {param.warning}
                                </div>
                              )}
                              {param.critical > 0 && (
                                <div
                                  className="h-100 rounded-pill d-flex align-items-center justify-content-center text-white fw-bold extra-small"
                                  style={{
                                    width: `${(param.critical / param.total) * 100}%`,
                                    background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                                    boxShadow: '0 1px 3px rgba(239, 68, 68, 0.35)',
                                    fontSize: '0.82rem',
                                    minWidth: 26,
                                    transition: 'width 0.4s ease'
                                  }}
                                  title={`${param.critical} ${t('Critical')}`}
                                >
                                  {param.critical}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center extra-small text-muted fw-bold">
                              {t('No readings')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom: Summary caption & status tag */}
                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <span className="extra-small text-muted fw-semibold" style={{ fontSize: '0.76rem' }}>
                          {param.summaryText}
                        </span>
                        <span
                          className="badge rounded-pill extra-small px-2.5 py-0.5 fw-bold d-inline-flex align-items-center gap-1.5"
                          style={{
                            backgroundColor: param.critical > 0 ? '#FEF2F2' : param.warning > 0 ? '#FFFBEB' : '#ECFDF5',
                            color: param.critical > 0 ? '#DC2626' : param.warning > 0 ? '#D97706' : '#059669',
                            border: `1px solid ${param.critical > 0 ? '#FECACA' : param.warning > 0 ? '#FDE68A' : '#A7F3D0'}`,
                            fontSize: '0.70rem'
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: param.critical > 0 ? '#EF4444' : param.warning > 0 ? '#F59E0B' : '#10B981'
                            }}
                          ></span>
                          {param.critical > 0 ? t('Action Needed') : param.warning > 0 ? t('Watch List') : t('Optimal')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. WATER QUALITY REPORTS TABLE SECTION */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-extrabold mb-1 tracking-tight text-dark" style={{ fontSize: '1.1rem' }}>
              {t('Water Quality Reports Stream')}
            </h5>
            <p className="text-secondary small mb-0" style={{ fontSize: '0.82rem' }}>
              {t('Pond Name, 4 Key Parameters (Temperature, pH level, DO, Salinity), Status, and Tested Dates.')}
            </p>
          </div>
          <span className="badge rounded-pill px-3 py-1.5 extra-small border" style={{ backgroundColor: '#F8FAFC', color: '#475569', borderColor: '#E2E8F0' }}>
            {t('Showing')} {filteredRecords.length} {filteredRecords.length === 1 ? t('Test Record') : t('Test Records')}
          </span>
        </div>

        {/* Admin Filter Toolbar */}
        <AdminFilterToolbar
          className="admin-search-section-box admin-filter-card"
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('Search by pond name, status, caretaker, notes...')}
          showFilters={true}
          onExportCSV={handleExportCSV}
          exportLabel={t('Export CSV')}
          onRefresh={loadRecords}
          loading={loading}
          tabs={[
            { id: 'all', label: t('All Tests'), count: filteredRecords.length },
            { id: 'Safe', label: t('Safe') },
            { id: 'Critical', label: t('Critical') },
          ]}
          activeTab={statusFilter}
          onTabChange={setStatusFilter}
          metaRight={
            <>
              {t('Standard Telemetry Ranges:')} <strong>DO &gt; 5.0 mg/L • Temp 26-32°C • pH 7.5-8.5</strong>
            </>
          }
          filterFields={[
            {
              label: t('Pond Name'),
              type: 'select',
              value: pondFilter,
              onChange: setPondFilter,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Ponds') },
                ...pondOptions.map((p) => ({ value: p, label: p })),
              ]
            },
            {
              label: t('Sort Sequence'),
              type: 'select',
              value: sortBy,
              onChange: setSortBy,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'newest', label: t('Newest Tested First') },
                { value: 'oldest', label: t('Oldest Tested First') },
                { value: 'temp-desc', label: t('Temperature (High to Low)') },
                { value: 'do-asc', label: t('DO Level (Lowest First)') },
              ]
            }
          ]}
          onResetFilters={() => {
            setSearch('');
            setStatusFilter('all');
            setPondFilter('all');
            setSortBy('newest');
          }}
        />

        {/* Scrollable Table matching UI Specification */}
        <div className="d-block d-md-none text-center text-muted extra-small mb-1 font-monospace" style={{ fontSize: '0.68rem' }}>
          {t('← Swipe table horizontally to see full details →')}
        </div>
        <div className="table-responsive admin-scrollable-table-4rows rounded-3 border" style={{ maxHeight: 290, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderColor: '#E2E8F0' }}>
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.82rem', minWidth: 720 }}>
            <thead className="table-light border-bottom" style={{ borderColor: '#E2E8F0' }}>
              <tr className="text-secondary extra-small text-uppercase fw-bold" style={{ letterSpacing: '0.03em' }}>
                <th className="py-2.5 ps-3" style={{ minWidth: 90 }}>{t('Pond Name')}</th>
                <th className="py-2.5" style={{ minWidth: 85 }}>{t('Temperature')}</th>
                <th className="py-2.5" style={{ minWidth: 75 }}>{t('pH Level')}</th>
                <th className="py-2.5" style={{ minWidth: 100 }}>{t('DO (Dissolved Oxygen)')}</th>
                <th className="py-2.5" style={{ minWidth: 75 }}>{t('Salinity')}</th>
                <th className="py-2.5" style={{ minWidth: 85 }}>{t('Status')}</th>
                <th className="py-2.5" style={{ minWidth: 100 }}>{t('Date Tested')}</th>
                <th className="py-2.5 pe-3 text-end" style={{ minWidth: 75 }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <FaSync className="fa-spin me-2" style={{ color: '#0284C7' }} /> {t('Loading water quality reports...')}
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <FaWater size={28} className="mb-2 opacity-25 d-block mx-auto" />
                    {t('No water quality records match the selected filter criteria.')}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const tempNum = parseFloat(record.temperature || 0);
                  const phNum = parseFloat(record.ph_level || 0);
                  const doNum = parseFloat(record.dissolved_oxygen || 0);
                  const salNum = parseFloat(record.salinity || 0);

                  const isDoCritical = doNum < 4.0;
                  const isDoWarning = doNum < 5.0 && !isDoCritical;

                  const isTempCritical = tempNum >= 34.0 || tempNum < 24.0;
                  const isTempWarning = (tempNum >= 32.5 || tempNum < 26.0) && !isTempCritical;

                  const isPhCritical = phNum < 7.0 || phNum > 8.8;
                  const isPhWarning = (phNum < 7.5 || phNum > 8.5) && !isPhCritical;

                  return (
                    <tr
                      key={record.id}
                      className="align-middle transition-all"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedRecord(record)}
                    >
                      {/* 1. Pond Name */}
                      <td className="ps-3 py-2.5">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 28, height: 28, backgroundColor: '#E0F2FE', color: '#0284C7' }}
                          >
                            <FaWater size={12} />
                          </div>
                          <div>
                            <span className="fw-bold text-dark d-block" style={{ fontSize: '0.84rem' }}>
                              {record.pond_name || `Pond #${record.pond_id}`}
                            </span>
                            <span className="extra-small text-muted" style={{ fontSize: '0.72rem' }}>
                              {record.recorded_by_name || 'Caretaker'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Temperature */}
                      <td className="py-2.5">
                        <div className="d-flex align-items-center gap-1.5">
                          <FaThermometerHalf
                            size={12}
                            style={{
                              color: isTempCritical ? '#DC2626' : isTempWarning ? '#D97706' : '#10B981'
                            }}
                          />
                          <span
                            className="fw-bold"
                            style={{
                              color: isTempCritical ? '#DC2626' : isTempWarning ? '#D97706' : '#1E293B'
                            }}
                          >
                            {tempNum.toFixed(1)} °C
                          </span>
                        </div>
                        <span className="extra-small text-muted" style={{ fontSize: '0.70rem' }}>
                          Target 26–32°C
                        </span>
                      </td>

                      {/* 3. pH Level */}
                      <td className="py-2.5">
                        <div className="d-flex align-items-center gap-1.5">
                          <FaVial
                            size={11}
                            style={{
                              color: isPhCritical ? '#DC2626' : isPhWarning ? '#D97706' : '#10B981'
                            }}
                          />
                          <span
                            className="fw-bold"
                            style={{
                              color: isPhCritical ? '#DC2626' : isPhWarning ? '#D97706' : '#1E293B'
                            }}
                          >
                            {phNum.toFixed(2)}
                          </span>
                        </div>
                        <span className="extra-small text-muted" style={{ fontSize: '0.70rem' }}>
                          Target 7.5–8.5
                        </span>
                      </td>

                      {/* 4. DO (Dissolved Oxygen) */}
                      <td className="py-2.5">
                        <div className="d-flex align-items-center gap-1.5">
                          <FaWind
                            size={12}
                            style={{
                              color: isDoCritical ? '#DC2626' : isDoWarning ? '#D97706' : '#10B981'
                            }}
                          />
                          <span
                            className="fw-bold"
                            style={{
                              color: isDoCritical ? '#DC2626' : isDoWarning ? '#D97706' : '#1E293B'
                            }}
                          >
                            {doNum.toFixed(2)} mg/L
                          </span>
                        </div>
                        <span className="extra-small text-muted" style={{ fontSize: '0.70rem' }}>
                          Target &gt;5.0 mg/L
                        </span>
                      </td>

                      {/* 5. Salinity */}
                      <td className="py-2.5">
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="fw-bold text-dark">
                            {salNum.toFixed(1)} ppt
                          </span>
                        </div>
                        <span className="extra-small text-muted" style={{ fontSize: '0.70rem' }}>
                          Target 15–28 ppt
                        </span>
                      </td>

                      {/* 6. Status */}
                      <td className="py-2.5">
                        {renderStatusBadge(record.status)}
                      </td>

                      {/* 7. Date Tested */}
                      <td className="py-2.5 text-nowrap">
                        <div className="d-flex align-items-center gap-1 text-dark fw-semibold" style={{ fontSize: '0.78rem' }}>
                          <FaCalendarAlt size={10} className="text-secondary opacity-75" />
                          <span>{record.record_date}</span>
                        </div>
                        <div className="extra-small text-muted" style={{ fontSize: '0.70rem' }}>
                          {record.recorded_at ? record.recorded_at.split(' ')[1] || '08:00 AM' : 'Daily Check'}
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-2.5 pe-3 text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex justify-content-end align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-light border p-1 rounded-2 text-secondary"
                            style={{ width: 28, height: 28 }}
                            title={t('View Details')}
                            onClick={() => setSelectedRecord(record)}
                          >
                            <FaEye size={11} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border p-1 rounded-2 text-danger"
                            style={{ width: 28, height: 28 }}
                            title={t('Delete Record')}
                            onClick={() => handleDeleteRecord(record)}
                          >
                            <FaTrash size={10} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. INSPECTION / VIEW DETAILS MODAL */}
      {selectedRecord && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div
                className="modal-header text-white px-4 py-3"
                style={{ backgroundColor: '#0284C7' }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white bg-white-20"
                    style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <FaWater size={15} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: '1.05rem' }}>
                      {t('Water Quality Inspection Log')} #{selectedRecord.id}
                    </h5>
                    <span className="extra-small text-white-50">
                      {selectedRecord.pond_name || `Pond #${selectedRecord.pond_id}`} • {selectedRecord.record_date}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setSelectedRecord(null)}
                />
              </div>

              <div className="modal-body p-4 bg-light">
                {/* 4 Tested Parameters Cards */}
                <div className="row g-2 mb-3">
                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border text-center shadow-2xs">
                      <span className="extra-small text-muted d-block mb-1">{t('Temperature')}</span>
                      <strong className="d-block fs-5 text-dark">{selectedRecord.temperature} °C</strong>
                      <span className="extra-small text-secondary">Target: 26–32°C</span>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border text-center shadow-2xs">
                      <span className="extra-small text-muted d-block mb-1">{t('pH Level')}</span>
                      <strong className="d-block fs-5 text-dark">{selectedRecord.ph_level}</strong>
                      <span className="extra-small text-secondary">Target: 7.5–8.5</span>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border text-center shadow-2xs">
                      <span className="extra-small text-muted d-block mb-1">{t('DO (Oxygen)')}</span>
                      <strong className="d-block fs-5 text-dark">{selectedRecord.dissolved_oxygen} mg/L</strong>
                      <span className="extra-small text-secondary">Target: &gt;5.0 mg/L</span>
                    </div>
                  </div>
                  <div className="col-6 col-sm-3">
                    <div className="bg-white p-3 rounded-3 border text-center shadow-2xs">
                      <span className="extra-small text-muted d-block mb-1">{t('Salinity')}</span>
                      <strong className="d-block fs-5 text-dark">{selectedRecord.salinity} ppt</strong>
                      <span className="extra-small text-secondary">Target: 15–28 ppt</span>
                    </div>
                  </div>
                </div>

                {/* Additional Snapshot Details */}
                <div className="bg-white p-3 rounded-3 border mb-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Health Status')}</span>
                      <div className="mt-1">{renderStatusBadge(selectedRecord.status)}</div>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Recorded By')}</span>
                      <strong className="small text-dark">{selectedRecord.recorded_by_name || 'Caretaker'}</strong>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Date & Time Recorded')}</span>
                      <span className="small text-dark">{formatDate(selectedRecord.record_date, selectedRecord.recorded_at)}</span>
                    </div>
                    <div className="col-12 col-md-6">
                      <span className="extra-small text-muted d-block">{t('Capture Method')}</span>
                      <span className="badge bg-light text-secondary border extra-small px-2 py-1 text-uppercase">
                        {selectedRecord.capture_mode || 'Manual'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attached Image if available */}
                {selectedRecord.image_path && (
                  <div className="bg-white p-3 rounded-3 border mb-3">
                    <span className="extra-small text-muted d-block mb-2 fw-bold">{t('Sensor / Capture Proof')}</span>
                    <div className="text-center rounded-3 overflow-hidden border bg-dark p-1">
                      <img
                        src={resolveImageUrl(selectedRecord.image_path)}
                        alt="Water Quality Sensor"
                        style={{ maxHeight: '240px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}

                {/* Notes or Recommendations */}
                <div className="bg-white p-3 rounded-3 border">
                  <span className="extra-small text-muted d-block mb-1 fw-bold">{t('Caretaker Notes / Observations')}</span>
                  <p className="small text-dark mb-0">
                    {selectedRecord.notes ? selectedRecord.notes : t('No specific caretaker field notes recorded for this testing session.')}
                  </p>
                </div>
              </div>

              <div className="modal-footer px-4 py-2.5 bg-white border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rounded-pill px-3"
                  onClick={() => setSelectedRecord(null)}
                >
                  {t('Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. "LOG WATER TEST" MODAL FOR ADMIN */}
      {showLogModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1060 }}
          tabIndex="-1"
          role="dialog"
          onClick={() => setShowLogModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div
                className="modal-header text-white px-4 py-3"
                style={{ backgroundColor: '#0284C7' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <FaWater size={16} />
                  <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: '1.05rem' }}>
                    {t('Log Water Quality Test')}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setShowLogModal(false)}
                />
              </div>

              <form onSubmit={handleCreateTest}>
                <div className="modal-body p-4 bg-light">
                  {/* Select Pond */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">{t('Target Pond')}</label>
                    <select
                      className="form-select form-select-sm rounded-3"
                      value={formPondId}
                      onChange={(e) => setFormPondId(e.target.value)}
                      required
                    >
                      <option value="">{t('Select Pond...')}</option>
                      {pondsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.pond_name} (Current Status: {p.status || 'Active'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4 Parameters inputs */}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label extra-small fw-bold text-dark">{t('Temperature (°C)')}</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm rounded-3"
                        value={formTemp}
                        onChange={(e) => setFormTemp(e.target.value)}
                        placeholder="28.5"
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label extra-small fw-bold text-dark">{t('pH Level')}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm rounded-3"
                        value={formPh}
                        onChange={(e) => setFormPh(e.target.value)}
                        placeholder="7.80"
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label extra-small fw-bold text-dark">{t('DO (mg/L)')}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm rounded-3"
                        value={formDo}
                        onChange={(e) => setFormDo(e.target.value)}
                        placeholder="6.20"
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label extra-small fw-bold text-dark">{t('Salinity (ppt)')}</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control form-control-sm rounded-3"
                        value={formSalinity}
                        onChange={(e) => setFormSalinity(e.target.value)}
                        placeholder="18.0"
                        required
                      />
                    </div>
                  </div>

                  {/* Date Tested */}
                  <div className="mb-3">
                    <label className="form-label extra-small fw-bold text-dark">{t('Date Tested')}</label>
                    <input
                      type="date"
                      className="form-control form-control-sm rounded-3"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                    />
                  </div>

                  {/* Notes */}
                  <div className="mb-0">
                    <label className="form-label extra-small fw-bold text-dark">{t('Notes / Observations')}</label>
                    <textarea
                      className="form-control form-control-sm rounded-3"
                      rows="2"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder={t('Optional notes regarding water color, weather conditions, aerator operation...')}
                    />
                  </div>
                </div>

                <div className="modal-footer px-4 py-2.5 bg-white border-top">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border rounded-pill px-3"
                    onClick={() => setShowLogModal(false)}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm text-white rounded-pill px-4 fw-bold"
                    style={{ backgroundColor: '#0284C7' }}
                    disabled={submittingForm}
                  >
                    {submittingForm ? (
                      <>
                        <FaSync className="fa-spin me-1.5" /> {t('Saving...')}
                      </>
                    ) : (
                      t('Save Water Test')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

