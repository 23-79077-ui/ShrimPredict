import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FaCalendarAlt,
  FaFilter,
  FaLeaf,
  FaUtensils,
  FaWater,
  FaEye,
  FaSearch,
  FaSync,
  FaFileDownload,
  FaFilePdf,
  FaFileExcel,
  FaTimes,
  FaInfoCircle,
  FaUserCheck,
  FaClock,
  FaSeedling,
  FaCommentDots,
  FaHashtag,
  FaWeightHanging,
  FaCheckCircle,
  FaLayerGroup,
  FaPlus,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaListUl,
  FaUndo,
  FaCheck,
  FaExclamationTriangle
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';
import PondCycleCalendar from '../../components/PondCycleCalendar';

const STANDARD_SLOTS = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = new Date((targetDateStr || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t - s;
  return Math.floor(diffTime / 86400000) + 1;
}

function formatKg(gramsOrKg) {
  const num = parseFloat(gramsOrKg) || 0;
  const kg = num > 50 ? num / 1000 : num;
  return kg.toFixed(2);
}

function normalizeSlot(timeStr) {
  if (!timeStr) return '';
  const s = String(timeStr).toUpperCase().replace(/\s+/g, ' ').trim();
  if (s.includes('6:00 AM') || s.startsWith('6:00') || s.startsWith('06:00')) return '6:00 AM';
  if (s.includes('9:00 AM') || s.startsWith('9:00') || s.startsWith('09:00')) return '9:00 AM';
  if (s.includes('12:00 PM') || s.startsWith('12:00')) return '12:00 PM';
  if (s.includes('3:00 PM') || s.startsWith('15:00') || s.startsWith('3:00')) return '3:00 PM';
  if (s.includes('6:00 PM') || s.startsWith('18:00')) return '6:00 PM';
  return s;
}

export default function FeedingHistoryPage() {
  const { user } = useAuth();

  const assignedPonds = useMemo(() => (
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond' }] : [])
  ), [user?.assigned_ponds, user?.pond_id]);

  const assignedPondIds = useMemo(() => (
    Array.from(new Set([...(assignedPonds.map((pond) => pond.id) || []), user?.pond_id].filter(Boolean).map(Number)))
  ), [assignedPonds, user?.pond_id]);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedPondFilter, setSelectedPondFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'nursery' | 'growout'
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'slot'

  // Selected Log Details Modal State & Cycle Calendar Modal State
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);
  const [calendarModalPond, setCalendarModalPond] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Backfill / Edit Record Modal State
  const [backfillModalOpen, setBackfillModalOpen] = useState(false);
  const [editingModalRecord, setEditingModalRecord] = useState(null);
  const [backfillForm, setBackfillForm] = useState({
    pond_id: '',
    record_date: new Date().toISOString().split('T')[0],
    feeding_time: '6:00 AM',
    amount_grams: '',
    amount_kg: '',
    product_code: 'Starter',
    vitamin_name: 'Sanolife PRO-2, Sano Top-S',
    notes: '',
  });
  const [savingBackfill, setSavingBackfill] = useState(false);

  // Helper for YYYY-MM-DD format
  const formatYMD = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayYMD = formatYMD(new Date());

  const loadHistory = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = {
        user_id: user?.id || 0,
        recorded_by_name: user?.full_name || '',
      };

      if (selectedPondFilter !== 'all') {
        params.pond_id = selectedPondFilter;
      }

      const res = await api.get('/feeding_records.php', { params });
      const rawRecords = safeArray(res.data);

      const filtered = rawRecords.filter((record) => {
        const recordUserId = record.user_id ?? record.userId;
        const recordName = record.recorded_by_name ?? record.recordedByName;
        if (user?.id && Number(recordUserId) === Number(user.id)) return true;
        if (user?.full_name && recordName === user.full_name) return true;
        if (assignedPondIds.length && assignedPondIds.includes(Number(record.pond_id))) return true;
        return !user?.id; // fallback if no specific user context
      });

      setRecords(filtered);
      if (isManualRefresh) {
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
        Toast.fire({
          icon: 'success',
          title: 'Feeding history synced',
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load feeding history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignedPondIds, selectedPondFilter, user?.id, user?.full_name]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleOpenBackfill = (recordToEdit = null, defaultPondId = null, defaultDate = null, defaultSlot = null) => {
    if (recordToEdit) {
      setEditingModalRecord(recordToEdit);
      const kg = recordToEdit.amount_kg !== null && recordToEdit.amount_kg !== undefined ? String(recordToEdit.amount_kg) : '';
      const grams = recordToEdit.amount_grams !== null && recordToEdit.amount_grams !== undefined
        ? String(recordToEdit.amount_grams)
        : (kg !== '' ? String(Math.round(parseFloat(kg) * 1000)) : '');
      setBackfillForm({
        id: recordToEdit.id,
        pond_id: String(recordToEdit.pond_id),
        record_date: formatYMD(recordToEdit.record_date || recordToEdit.created_at) || todayYMD,
        feeding_time: recordToEdit.feeding_time || '6:00 AM',
        amount_grams: grams,
        amount_kg: kg,
        product_code: recordToEdit.product_code || (String(recordToEdit.feed_type).toLowerCase().includes('grower') ? 'Grower' : 'Starter'),
        vitamin_name: recordToEdit.vitamin_name || 'Sanolife PRO-2, Sano Top-S',
        notes: recordToEdit.notes || '',
      });
    } else {
      setEditingModalRecord(null);
      const chosenPondId = defaultPondId || (selectedPondFilter !== 'all' ? selectedPondFilter : (assignedPonds[0]?.id ? String(assignedPonds[0].id) : ''));
      setBackfillForm({
        pond_id: String(chosenPondId),
        record_date: defaultDate || customDate || todayYMD,
        feeding_time: defaultSlot || '6:00 AM',
        amount_grams: '',
        amount_kg: '',
        product_code: 'Starter',
        vitamin_name: 'Sanolife PRO-2, Sano Top-S',
        notes: '',
      });
    }
    setBackfillModalOpen(true);
  };

  const handleSaveBackfill = async (e) => {
    e?.preventDefault();
    const pid = Number(backfillForm.pond_id);
    const grams = backfillForm.amount_grams !== '' ? parseFloat(backfillForm.amount_grams) : (parseFloat(backfillForm.amount_kg) * 1000 || 0);
    const amt = backfillForm.amount_kg !== '' ? parseFloat(backfillForm.amount_kg) : (grams / 1000);

    if (!pid) {
      Swal.fire({ icon: 'warning', title: 'Pond Basin Required', text: 'Please select an assigned pond basin.' });
      return;
    }
    if (isNaN(amt) || amt < 0 || isNaN(grams) || grams < 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Feed Mass', text: 'Please enter a valid amount in grams (0 or greater).' });
      return;
    }
    if (!backfillForm.record_date) {
      Swal.fire({ icon: 'warning', title: 'Date Required', text: 'Please select the record date.' });
      return;
    }

    const vit = backfillForm.vitamin_name || 'None';

    setSavingBackfill(true);
    try {
      const payload = {
        action: editingModalRecord ? 'update' : 'insert',
        record_id: editingModalRecord ? editingModalRecord.id : undefined,
        is_update: Boolean(editingModalRecord),
        pond_id: pid,
        amount_grams: grams,
        amount_kg: amt,
        feeding_time: backfillForm.feeding_time,
        product_code: backfillForm.product_code,
        vitamin_name: vit,
        has_vitamin: vit && vit !== 'None' ? 1 : 0,
        record_date: backfillForm.record_date,
        notes: backfillForm.notes || (grams === 0 ? 'No feed logged (0g)' : ''),
        recorded_by: user?.full_name || 'Caretaker',
        recorded_by_name: user?.full_name || 'Caretaker',
        user_id: Number(user?.id || 0),
      };

      const res = await api.post('/feeding_records.php', payload);
      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: editingModalRecord ? 'Record Updated!' : 'Feeding Record Logged!',
          text: `${grams}g (${amt.toFixed(2)}kg) of ${backfillForm.product_code} on ${backfillForm.record_date} (${backfillForm.feeding_time}) recorded.`,
          timer: 2000,
          showConfirmButton: false,
        });
        setBackfillModalOpen(false);
        loadHistory(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('shrim-feed-updated'));
        }
      } else {
        throw new Error(res.data?.message || 'Save failed');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.response?.data?.message || err.message || 'Unable to save feeding record.',
      });
    } finally {
      setSavingBackfill(false);
    }
  };

  const handleDeleteHistoryRecord = async (record) => {
    if (!record?.id) return;
    const confirm = await Swal.fire({
      title: 'Delete Feeding Record?',
      text: `Are you sure you want to delete the ${record.feeding_time} record (${record.amount_kg}kg) on ${record.record_date} for ${record.pond_name || `Pond #${record.pond_id}`}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EA580C',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Yes, delete record',
      cancelButtonText: 'Cancel',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await api.post('/feeding_records.php', {
        action: 'delete',
        id: record.id,
      });
      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Record Deleted',
          text: 'The record was successfully removed.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadHistory(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('shrim-feed-updated'));
        }
      } else {
        throw new Error(res.data?.message || 'Delete failed');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err.response?.data?.message || err.message || 'Could not delete feeding record.',
      });
    }
  };

  // Enrich records with DOC and stage relative to record_date
  const recordsWithStage = useMemo(() => {
    return records.map((r) => {
      const rDate = formatYMD(r.record_date || r.created_at);
      const pondObj = assignedPonds.find((p) => String(p.id) === String(r.pond_id));
      const stocking = r.stocking_date || pondObj?.stocking_date;
      const doc = computeDoc(stocking, rDate);
      const isNursery = doc !== null
        ? (doc >= 1 && doc <= 19)
        : (String(r.product_code || r.feed_type).toLowerCase().includes('starter'));
      const isGrowout = doc !== null
        ? (doc >= 20)
        : (String(r.product_code || r.feed_type).toLowerCase().includes('grower'));
      const stage = isNursery ? 'nursery' : (isGrowout ? 'growout' : 'other');

      return {
        ...r,
        doc,
        stage,
        isNursery,
        isGrowout,
      };
    });
  }, [records, assignedPonds]);

  const nurseryRecordsCount = useMemo(() => recordsWithStage.filter((r) => r.isNursery).length, [recordsWithStage]);
  const growoutRecordsCount = useMemo(() => recordsWithStage.filter((r) => r.isGrowout).length, [recordsWithStage]);

  // Client-side Filtered Records (Date, Stage & Search)
  const filteredRecords = useMemo(() => {
    return recordsWithStage.filter((r) => {
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

      // 2. Stage Filter
      let matchStage = true;
      if (stageFilter === 'nursery') {
        matchStage = r.isNursery;
      } else if (stageFilter === 'growout') {
        matchStage = r.isGrowout;
      }

      // 3. Search Term Filter
      const matchSearch =
        !searchTerm ||
        String(r.pond_name || `Pond ${r.pond_id}`).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.feed_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.product_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.vitamin_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.recorded_by_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.record_date || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.feeding_time || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchDate && matchStage && matchSearch;
    });
  }, [recordsWithStage, dateFilter, customDate, stageFilter, searchTerm, todayYMD]);

  // Group records by Date and Pond for Daily Total Summary View
  const dailyGroupedRecords = useMemo(() => {
    const map = {};
    filteredRecords.forEach((r) => {
      const rDate = formatYMD(r.record_date || r.created_at);
      const pondKey = String(r.pond_id || '0');
      const key = `${pondKey}_${rDate}`;
      if (!map[key]) {
        map[key] = {
          key,
          pond_id: r.pond_id,
          pond_name: r.pond_name || `Pond #${r.pond_id}`,
          stocking_date: r.stocking_date,
          date: rDate,
          doc: r.doc,
          stage: r.stage,
          isNursery: r.isNursery,
          isGrowout: r.isGrowout,
          total_kg: 0,
          total_grams: 0,
          feed_types: new Set(),
          vitamins: new Set(),
          records: [],
          slotsMap: {},
        };
      }
      const kg = parseFloat(r.amount_kg) || 0;
      const g = r.amount_grams !== null && r.amount_grams !== undefined ? parseFloat(r.amount_grams) : kg * 1000;
      map[key].total_kg += kg;
      map[key].total_grams += g;
      if (r.feed_type || r.product_code) map[key].feed_types.add(r.feed_type || r.product_code);
      if (r.vitamin_name && r.vitamin_name !== 'None') map[key].vitamins.add(r.vitamin_name);
      map[key].records.push(r);
      const normSlot = normalizeSlot(r.feeding_time);
      if (normSlot) {
        map[key].slotsMap[normSlot] = r;
      }
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        feed_types: Array.from(item.feed_types),
        vitamins: Array.from(item.vitamins),
        records: item.records.sort((a, b) => (a.feeding_time || '').localeCompare(b.feeding_time || '')),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords]);

  // Dynamic Summary Metrics
  const selectedPond = assignedPonds.find((pond) => String(pond.id) === String(selectedPondFilter));
  const currentScope = selectedPondFilter === 'all' ? 'All Assigned Basins' : selectedPond?.pond_name || 'Selected Pond';

  const totalFeedKg = filteredRecords.reduce((sum, record) => sum + (parseFloat(record.amount_kg) || 0), 0);
  const totalLogsCount = filteredRecords.length;
  const pondsWithRecords = new Set(filteredRecords.map((record) => String(record.pond_id || record.pond_name || '')).filter(Boolean)).size;

  const vitaminRecords = filteredRecords.filter((record) => record.has_vitamin || (record.vitamin_name && record.vitamin_name !== 'None'));
  const vitaminLogsCount = vitaminRecords.length;

  const latestRecord = filteredRecords[0];
  const latestDateText = latestRecord?.record_date ? `Latest: ${latestRecord.record_date}` : 'No records';

  // Export to Excel / CSV
  const handleExportCSV = () => {
    setShowExportMenu(false);
    if (filteredRecords.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data to Export', text: 'There are no feeding records matching your current filter.' });
      return;
    }

    const headers = ['Record ID,Pond Name,Date,Time,Amount (kg),Amount (grams),Feed Type,Vitamin Name,Recorded By,Notes'];
    const rows = filteredRecords.map((r) =>
      `${r.id},"${r.pond_name || `Pond #${r.pond_id}`}","${r.record_date || ''}","${r.feeding_time || ''}",${r.amount_kg || 0},${r.amount_grams || 0},"${r.feed_type || r.product_code || 'Starter'}","${r.vitamin_name || 'None'}","${r.recorded_by_name || 'Caretaker'}","${(r.notes || '').replace(/"/g, '""')}"`
    );

    const csvContent = '\uFEFF' + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ShrimPredict_Feeding_History_${selectedPondFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const handleExportPDF = () => {
    setShowExportMenu(false);
    if (filteredRecords.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data to Export', text: 'There are no feeding records matching your current filter.' });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire({ icon: 'error', title: 'Popup Blocked', text: 'Please allow popups to view the PDF report.' });
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Feeding History Report - ShrimPredict</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 24px; color: #0F172A; background: #ffffff; }
            .header-bar { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0B2C5F; padding-bottom: 12px; margin-bottom: 16px; }
            h2 { color: #0B2C5F; margin: 0 0 4px 0; font-size: 22px; font-weight: 800; }
            .subtext { color: #64748B; font-size: 13px; margin: 0; }
            .meta-strip { display: flex; gap: 16px; background: #F8FAFD; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(11, 44, 95, 0.12); font-size: 13px; }
            .meta-strip div { flex: 1; }
            .meta-strip strong { color: #0B2C5F; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .meta-strip span { font-size: 15px; font-weight: 700; color: #EA580C; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th, td { border: 1px solid #CBD5E1; padding: 8px 12px; text-align: left; }
            th { background-color: #0B2C5F; color: #FFFFFF; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
            tr:nth-child(even) { background-color: #F8FAFC; }
            .badge { background: #FFF7ED; color: #EA580C; border: 1px solid rgba(234, 88, 12, 0.25); padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; display: inline-block; }
            .badge-slot { background: rgba(11, 44, 95, 0.08); color: #0B2C5F; border: 1px solid rgba(11, 44, 95, 0.15); padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; }
            .footer { margin-top: 32px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h2>ShrimPredict • Caretaker Feeding Activity Log</h2>
              <p class="subtext">O&amp;B Aqua Farm Production Telemetry • Generated on ${new Date().toLocaleString()}</p>
            </div>
            <div style="text-align: right; color: #0B2C5F; font-weight: 800; font-size: 13px;">
              Tri-Color Field Protocol
            </div>
          </div>
          <div class="meta-strip">
            <div><strong>Active Scope:</strong> <span>${currentScope}</span></div>
            <div><strong>Total Log Entries:</strong> <span>${filteredRecords.length} records</span></div>
            <div><strong>Cumulative Feed Consumed:</strong> <span>${totalFeedKg.toFixed(2)} kg (${Math.round(totalFeedKg * 1000).toLocaleString()} g)</span></div>
            <div><strong>Vitamin Additive Sessions:</strong> <span>${vitaminLogsCount} logs</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Pond Basin</th>
                <th>Slot Time</th>
                <th>Feed Mass</th>
                <th>Product Formulation</th>
                <th>Vitamins &amp; Additives</th>
                <th>Caretaker</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr>
                  <td><strong>${r.record_date || '-'}</strong></td>
                  <td>${r.pond_name || `Pond #${r.pond_id}`}</td>
                  <td><span class="badge-slot">${r.feeding_time || '-'}</span></td>
                  <td><strong>${Number(r.amount_kg || 0).toFixed(2)} kg</strong> <small>(${r.amount_grams || 0}g)</small></td>
                  <td>${r.feed_type || r.product_code || 'Starter Feed'}</td>
                  <td>${r.vitamin_name && r.vitamin_name !== 'None' ? `<span class="badge">${r.vitamin_name}</span>` : 'None'}</td>
                  <td>${r.recorded_by_name || 'Caretaker'}</td>
                  <td>${r.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">ShrimPredict Smart Aquaculture System • Official Caretaker Field Feeding History</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleResetFilters = () => {
    setSelectedPondFilter('all');
    setStageFilter('all');
    setDateFilter('all');
    setCustomDate('');
    setSearchTerm('');
  };

  const isFiltered = selectedPondFilter !== 'all' || stageFilter !== 'all' || dateFilter !== 'all' || Boolean(searchTerm);

  return (
    <div className="caretaker-history-hub">
      {/* 🌟 HERO CONTROL STRIP (TRI-COLOR CLEAN: NAVY & WARM ORANGE) */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge badge-tri-navy rounded-pill px-2.5 py-0.5 extra-small">
              Caretaker Operations
            </span>
            <span className="badge badge-tri-orange rounded-pill px-2.5 py-0.5 extra-small">
              Feeding Telemetry
            </span>
          </div>
          <h2 className="fw-extrabold mb-0 tracking-tight" style={{ color: '#0B2C5F', fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Feeding History &amp; Operations
          </h2>
          <p className="text-muted extra-small mb-0 mt-0.5">
            Monitor daily feed consumption, 5-slot feeding adherence, DOC growth milestones, and vitamin additives.
          </p>
        </div>

        {/* Action Controls Cluster */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Refresh / Sync Button */}
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs hover-lift"
            onClick={() => loadHistory(true)}
            disabled={refreshing}
            title="Sync Feeding Records with Farm Database"
          >
            <FaSync size={11} className={refreshing ? 'fa-spin' : ''} style={{ color: '#0B2C5F' }} />
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Pond Cycle Calendar Shortcut */}
          <button
            type="button"
            className="btn btn-sm btn-tri-outline px-3.5 py-2 shadow-xs hover-lift"
            onClick={() => {
              const activePond = assignedPonds.find((p) => String(p.id) === String(selectedPondFilter)) || assignedPonds[0] || null;
              setCalendarModalPond(activePond);
            }}
            title="Inspect Culture Cycle Calendar & Transfer Milestones"
          >
            <FaCalendarAlt size={11} style={{ color: '#EA580C' }} />
            <span>Cycle Calendar</span>
          </button>

          {/* Export Dropdown */}
          <div className="position-relative">
            <button
              type="button"
              className="btn btn-sm btn-tri-navy px-3.5 py-2 shadow-xs hover-lift"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export Feeding Data to CSV or PDF"
            >
              <FaFileDownload size={11} />
              <span>Export</span>
              <FaChevronDown size={9} className="opacity-75 ms-1" />
            </button>

            {showExportMenu && (
              <div
                className="position-absolute end-0 mt-1 bg-white shadow-lg rounded-4 border py-1.5"
                style={{ zIndex: 1050, minWidth: 180, borderColor: 'rgba(11, 44, 95, 0.12)' }}
              >
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 extra-small fw-bold text-dark"
                  onClick={handleExportCSV}
                >
                  <FaFileExcel className="text-success" size={13} /> Export to Excel (.csv)
                </button>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 extra-small fw-bold text-dark"
                  onClick={handleExportPDF}
                >
                  <FaFilePdf className="text-danger" size={13} /> Export to PDF (.pdf)
                </button>
              </div>
            )}
          </div>

          {/* Backfill / Log Feeding Button */}
          <button
            type="button"
            className="btn btn-sm btn-tri-orange px-4 py-2 shadow-sm hover-lift"
            onClick={() => handleOpenBackfill()}
            title="Backfill or record farm feeding session"
          >
            <FaPlus size={11} />
            <span>Log Feeding</span>
          </button>
        </div>
      </div>

      {/* 🌟 POND QUICK-SELECTOR NAVIGATION STRIP (TRI-POND PILLS) */}
      {assignedPonds.length > 0 && (
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 flex-wrap tri-pond-pill-strip">
            <span className="extra-small fw-bold text-uppercase tracking-wider me-1" style={{ color: '#0B2C5F', fontSize: '0.72rem' }}>
              <FaWater className="me-1 text-primary" size={11} /> Filter Basin:
            </span>

            {/* "All Ponds" Pill */}
            <button
              type="button"
              className={`tri-pond-pill border-0 ${selectedPondFilter === 'all' ? 'btn-tri-navy text-white shadow-sm' : 'bg-white text-dark shadow-xs'}`}
              style={{
                border: selectedPondFilter === 'all' ? 'none' : '1px solid rgba(11, 44, 95, 0.12)',
              }}
              onClick={() => setSelectedPondFilter('all')}
            >
              <FaLayerGroup size={11} />
              <span>All Basins ({records.length})</span>
            </button>

            {/* Assigned Pond Pills */}
            {assignedPonds.map((pond) => {
              const isSelected = String(selectedPondFilter) === String(pond.id);
              const pondRecords = records.filter((r) => String(r.pond_id) === String(pond.id));
              const currentDoc = computeDoc(pond.stocking_date, todayYMD);

              return (
                <button
                  key={pond.id}
                  type="button"
                  className={`tri-pond-pill border-0 ${isSelected ? 'btn-tri-orange text-white shadow-sm' : 'bg-white text-dark shadow-xs'}`}
                  style={{
                    border: isSelected ? 'none' : '1px solid rgba(11, 44, 95, 0.12)',
                  }}
                  onClick={() => setSelectedPondFilter(String(pond.id))}
                >
                  <FaWater size={11} className={isSelected ? 'text-white' : 'text-primary'} />
                  <span>{pond.pond_name}</span>
                  {currentDoc && (
                    <span
                      className="badge rounded-pill extra-small px-1.5 py-0.5 ms-1"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(11, 44, 95, 0.08)',
                        color: isSelected ? '#FFFFFF' : '#0B2C5F',
                        fontSize: '0.66rem',
                      }}
                    >
                      DOC {currentDoc}
                    </span>
                  )}
                  <span
                    className="badge rounded-pill extra-small px-1.5 py-0.5"
                    style={{
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                      fontSize: '0.66rem',
                    }}
                  >
                    {pondRecords.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 🌟 4 TRI-COLOR KPI TELEMETRY CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* KPI 1: Cumulative Feed Intake */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                    KPI 1
                  </span>
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feed Consumed</span>
                </div>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaUtensils size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {totalFeedKg.toFixed(2)} <small className="fs-6 text-muted fw-normal">kg</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Total mass: <strong className="font-mono" style={{ color: '#0B2C5F' }}>{Math.round(totalFeedKg * 1000).toLocaleString()} g</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(12, (totalFeedKg / Math.max(1, (assignedPonds?.length || 1) * 50)) * 100))}%`,
                    background: 'linear-gradient(90deg, #0B2C5F 0%, #1E3A8A 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>{currentScope}</span>
                <span className="badge badge-tri-navy rounded-pill extra-small px-2 py-0.5">Telemetry</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Feeding Logs */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(234, 88, 12, 0.16)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
                    KPI 2
                  </span>
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Feeding Logs</span>
                </div>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaCalendarAlt size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {totalLogsCount} <small className="fs-6 text-muted fw-normal">entries</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Daily summaries: <strong className="font-mono" style={{ color: '#EA580C' }}>{dailyGroupedRecords.length} days</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (totalLogsCount / Math.max(1, (assignedPonds?.length || 1) * 15)) * 100))}%`,
                    background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Logged sessions</span>
                <span className="badge badge-tri-orange rounded-pill extra-small px-2 py-0.5">Recorded</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Active Production Basins */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5" style={{ backgroundColor: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}>
                    KPI 3
                  </span>
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Active Basins</span>
                </div>
                <div className="tri-kpi-icon tri-kpi-icon-blue">
                  <FaWater size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#0B2C5F', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {pondsWithRecords} <small className="fs-6 text-muted fw-normal">/ {assignedPonds.length || 1}</small>
              </h2>
              <div className="extra-small text-muted fw-semibold">
                Assigned ponds: <strong style={{ color: '#0B2C5F' }}>{assignedPonds.length} ponds</strong>
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5">
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(15, (pondsWithRecords / Math.max(1, assignedPonds?.length || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #0B2C5F 0%, #38BDF8 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small">Basins with logs</span>
                <span className="badge badge-tri-navy rounded-pill extra-small px-2 py-0.5">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Vitamins & Probiotics Logged */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="tri-kpi-card" style={{ borderColor: 'rgba(234, 88, 12, 0.16)' }}>
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge rounded-pill extra-small fw-bold px-2 py-0.5" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>
                    KPI 4
                  </span>
                  <span className="text-muted extra-small fw-bold text-uppercase tracking-wider">Supplements</span>
                </div>
                <div className="tri-kpi-icon tri-kpi-icon-orange">
                  <FaLeaf size={17} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1" style={{ color: '#EA580C', fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {vitaminLogsCount} <small className="fs-6 text-muted fw-normal">sessions</small>
              </h2>
              <div className="extra-small text-muted fw-semibold text-truncate">
                {latestDateText}
              </div>
            </div>
            <div>
              <div className="tri-progress-track my-2.5" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)' }}>
                <div
                  className="tri-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(10, (vitaminLogsCount / Math.max(1, totalLogsCount || 1)) * 100))}%`,
                    background: 'linear-gradient(90deg, #EA580C 0%, #F97316 100%)',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-muted extra-small text-truncate" style={{ maxWidth: 140 }}>Sanolife &amp; Sano Top</span>
                <span className="badge badge-tri-orange rounded-pill extra-small px-2 py-0.5">Additives</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 MAIN CONTENT CONTAINER: TOOLBAR, CONTROLS & TABLE */}
      <div className="tri-card p-3.5 p-md-4 mb-4">
        {/* TOOLBAR ROW 1: SEARCH, DATE FILTER PRESETS & RESET */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2.5 mb-3">
          {/* Live Search Input */}
          <div
            className="d-flex align-items-center bg-white rounded-pill px-3 shadow-xs"
            style={{
              width: '100%',
              maxWidth: 280,
              minWidth: 180,
              height: 38,
              border: '1px solid rgba(11, 44, 95, 0.15)',
            }}
          >
            <FaSearch className="text-muted extra-small me-2 flex-shrink-0" />
            <input
              type="text"
              className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-semibold text-dark"
              placeholder="Search pond, date, feed, vitamins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ outline: 'none' }}
            />
            {searchTerm && (
              <button
                type="button"
                className="btn btn-link p-0 text-muted extra-small ms-1"
                onClick={() => setSearchTerm('')}
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Date Range Selector Pill */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div
              className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white shadow-xs"
              style={{ border: '1px solid rgba(11, 44, 95, 0.15)', height: 38 }}
            >
              <FaCalendarAlt size={12} style={{ color: '#EA580C' }} />
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-bold p-0 extra-small shadow-none cursor-pointer"
                style={{ width: 115, height: '100%', outline: 'none', color: '#0B2C5F' }}
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  if (e.target.value !== 'custom') setCustomDate('');
                }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
                <option value="custom">Custom Date...</option>
              </select>
            </div>

            {/* Custom Date Input (Shown when custom is selected) */}
            {dateFilter === 'custom' && (
              <div
                className="d-flex align-items-center gap-1.5 px-3 py-1 rounded-pill bg-white shadow-xs"
                style={{ border: '1px solid #EA580C', height: 38 }}
              >
                <input
                  type="date"
                  className="form-control form-control-sm border-0 bg-transparent fw-bold p-0 extra-small shadow-none"
                  style={{ width: 125, height: '100%', outline: 'none', color: '#0B2C5F' }}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              </div>
            )}

            {/* Reset Filters Button */}
            {isFiltered && (
              <button
                type="button"
                className="btn btn-sm btn-tri-outline px-3 py-1.5 extra-small shadow-xs hover-lift"
                style={{ height: 38 }}
                onClick={handleResetFilters}
                title="Reset all active filters"
              >
                <FaUndo size={10} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR ROW 2: CULTURE STAGE FILTER PILLS & VIEW MODE SEGMENTED SWITCH */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2.5 pt-3 pb-3 border-top" style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}>
          {/* Stage Filter Pills */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="extra-small fw-bold text-uppercase tracking-wider me-1 text-muted" style={{ fontSize: '0.72rem' }}>
              Phase:
            </span>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                stageFilter === 'all' ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
              }`}
              onClick={() => setStageFilter('all')}
            >
              All Stages ({records.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                stageFilter === 'nursery' ? 'btn-tri-orange shadow-xs' : 'btn-tri-outline-orange'
              }`}
              onClick={() => setStageFilter('nursery')}
            >
              🌱 Nursery (DOC 1–19) ({nurseryRecordsCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                stageFilter === 'growout' ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
              }`}
              onClick={() => setStageFilter('growout')}
            >
              🌊 Grow-out (DOC 20+) ({growoutRecordsCount})
            </button>
          </div>

          {/* View Mode Switcher: Daily Total View vs Per Slot View */}
          <div className="d-flex align-items-center gap-2">
            <span className="extra-small fw-bold text-uppercase tracking-wider text-muted me-1 d-none d-md-inline" style={{ fontSize: '0.72rem' }}>
              View Mode:
            </span>
            <div className="tri-segmented-switch">
              <button
                type="button"
                className={`tri-segmented-item ${viewMode === 'daily' ? 'active' : ''}`}
                onClick={() => setViewMode('daily')}
                title="Aggregate daily total kg per pond"
              >
                <FaLayerGroup size={11} />
                <span>Daily Total</span>
              </button>
              <button
                type="button"
                className={`tri-segmented-item ${viewMode === 'slot' ? 'active' : ''}`}
                onClick={() => setViewMode('slot')}
                title="Itemize every individual feeding slot"
              >
                <FaClock size={11} />
                <span>Per Slot</span>
              </button>
            </div>
          </div>
        </div>

        {/* 🌟 TABLE SECTION */}
        {loading ? (
          <div className="py-5 text-center text-muted">
            <div className="spinner-border text-primary spinner-border-sm me-2" role="status" />
            <span className="fw-semibold small">Loading feeding records from farm database...</span>
          </div>
        ) : error ? (
          <div className="alert alert-danger my-3 rounded-4 d-flex align-items-center gap-2">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-5 text-center text-muted">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 56, height: 56, backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}
            >
              <FaUtensils size={24} />
            </div>
            <h6 className="fw-bold text-dark mb-1">No feeding records found</h6>
            <p className="extra-small text-muted mb-3" style={{ maxWidth: 380, margin: '0 auto' }}>
              No feeding activity recorded for {currentScope} matching your current filters.
            </p>
            <div className="d-flex align-items-center justify-content-center gap-2">
              {isFiltered && (
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small"
                  onClick={handleResetFilters}
                >
                  <FaUndo size={11} /> Clear Filters
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-tri-orange px-4 py-1.5 extra-small"
                onClick={() => handleOpenBackfill()}
              >
                <FaPlus size={11} /> Log Feeding Session
              </button>
            </div>
          </div>
        ) : (
          <div
            className="table-responsive rounded-4 position-relative"
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              border: '1px solid rgba(11, 44, 95, 0.08)',
            }}
          >
            <table className="table tri-table align-middle mb-0">
              {viewMode === 'daily' ? (
                <>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="ps-3 py-3">Pond Basin</th>
                      <th className="py-3">Stage &amp; DOC</th>
                      <th className="py-3">Log Date</th>
                      <th className="py-3">Daily Feed Mass</th>
                      <th className="py-3">5-Slot Feeding Schedule</th>
                      <th className="py-3">Feed Formulation &amp; Additives</th>
                      <th className="pe-3 py-3 text-center" style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyGroupedRecords.map((item) => {
                      const matchedPond = assignedPonds.find(p => String(p.id) === String(item.pond_id)) || {
                        id: item.pond_id,
                        pond_name: item.pond_name,
                        stocking_date: item.stocking_date,
                      };
                      const slotsLoggedCount = Object.keys(item.slotsMap).length;
                      const isCompleteDay = slotsLoggedCount >= 5;

                      return (
                        <tr key={item.key}>
                          <td className="ps-3 fw-bold text-dark">
                            <div className="d-flex align-items-center gap-2">
                              <span
                                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{ width: 30, height: 30, background: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F' }}
                              >
                                <FaWater size={12} />
                              </span>
                              <div>
                                <span className="d-block text-dark fw-bold" style={{ fontSize: '0.92rem' }}>
                                  {item.pond_name}
                                </span>
                                <small className="text-muted extra-small">Production Basin</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            {item.isNursery ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}
                              >
                                🌱 {item.doc ? `Day ${item.doc}` : 'DOC 1-19'} • Nursery
                              </span>
                            ) : item.isGrowout ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                style={{ background: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.18)' }}
                              >
                                🌊 {item.doc ? `Day ${item.doc}` : 'DOC 20+'} • Grow-out
                              </span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-2.5 py-1 extra-small fw-bold">
                                Pre-Stocking
                              </span>
                            )}
                          </td>

                          <td>
                            <strong className="text-dark font-mono" style={{ fontSize: '0.86rem' }}>
                              {item.date}
                            </strong>
                          </td>

                          <td>
                            <div>
                              <strong className="text-dark font-mono" style={{ fontSize: '0.95rem', color: '#0B2C5F' }}>
                                {item.total_kg.toFixed(2)} kg
                              </strong>
                              <span className="extra-small text-muted font-mono d-block">
                                ({Math.round(item.total_grams).toLocaleString()} g)
                              </span>
                            </div>
                          </td>

                          {/* 5-Slot Visual Schedule Indicator */}
                          <td>
                            <div className="d-flex flex-column gap-1.5">
                              <div className="d-flex align-items-center gap-1 flex-wrap">
                                {STANDARD_SLOTS.map((slot) => {
                                  const isLogged = Boolean(item.slotsMap[slot]);
                                  const shortSlot = slot.replace(':00', '');
                                  return (
                                    <span
                                      key={slot}
                                      className={`tri-slot-chip ${isLogged ? 'logged' : 'empty'}`}
                                      title={isLogged ? `${slot}: Logged (${item.slotsMap[slot]?.amount_kg}kg)` : `${slot}: Not yet logged`}
                                    >
                                      {isLogged ? <FaCheck size={8} style={{ color: '#0B2C5F' }} /> : '○'}
                                      <span>{shortSlot}</span>
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="d-flex align-items-center gap-1.5">
                                <span
                                  className={`badge rounded-pill px-2 py-0.5 extra-small fw-bold ${
                                    isCompleteDay ? 'badge-tri-navy' : 'badge-tri-orange'
                                  }`}
                                  style={{ fontSize: '0.67rem' }}
                                >
                                  {isCompleteDay ? '✓ 5/5 Slots Complete' : `${slotsLoggedCount}/5 Slots Logged`}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1">
                              <span className="fw-semibold text-dark extra-small">
                                {item.feed_types.join(', ') || 'Starter Feed'}
                              </span>
                              {item.vitamins.length > 0 ? (
                                <span
                                  className="badge badge-tri-orange rounded-pill px-2 py-0.5 extra-small fw-bold"
                                  style={{ width: 'fit-content' }}
                                >
                                  +{item.vitamins.join(', ')}
                                </span>
                              ) : (
                                <span className="text-muted extra-small">No Additives</span>
                              )}
                            </div>
                          </td>

                          <td className="pe-3 text-center">
                            <div className="d-flex align-items-center justify-content-center gap-1.5">
                              {/* Open in Cycle Calendar button */}
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline rounded-pill px-2.5 py-1 extra-small shadow-xs hover-lift"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => {
                                  setCalendarModalPond(matchedPond);
                                  setCustomDate(item.date);
                                }}
                                title="Inspect in Pond Cycle Calendar"
                              >
                                <FaCalendarAlt size={10} style={{ color: '#EA580C' }} />
                                <span>Calendar</span>
                              </button>

                              {/* Quick View Details button */}
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift"
                                style={{ width: 28, height: 28 }}
                                onClick={() => setSelectedRecordDetails(item.records[0])}
                                title="View Feeding Session Details"
                              >
                                <FaEye size={11} style={{ color: '#0B2C5F' }} />
                              </button>

                              {/* Add Missing Slot Button */}
                              {!isCompleteDay && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-tri-orange rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift"
                                  style={{ width: 28, height: 28 }}
                                  onClick={() => {
                                    const missingSlot = STANDARD_SLOTS.find(s => !item.slotsMap[s]) || '6:00 AM';
                                    handleOpenBackfill(null, String(item.pond_id), item.date, missingSlot);
                                  }}
                                  title={`Log next missing feeding slot for ${item.date}`}
                                >
                                  <FaPlus size={10} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="ps-3 py-3">Pond Basin</th>
                      <th className="py-3">Stage &amp; DOC</th>
                      <th className="py-3">Feeding Slot</th>
                      <th className="py-3">Feed Mass &amp; Formulation</th>
                      <th className="py-3">Supplements Status</th>
                      <th className="py-3">Log Date &amp; Caretaker</th>
                      <th className="pe-3 py-3 text-center" style={{ width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => {
                      const isNursery = record.isNursery;
                      const isGrowout = record.isGrowout;

                      return (
                        <tr key={record.id}>
                          <td className="ps-3 fw-bold text-dark">
                            <div className="d-flex align-items-center gap-2">
                              <span
                                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                                style={{ width: 30, height: 30, background: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F' }}
                              >
                                <FaWater size={12} />
                              </span>
                              <div>
                                <span className="d-block text-dark fw-bold" style={{ fontSize: '0.92rem' }}>
                                  {record.pond_name || `Pond #${record.pond_id}`}
                                </span>
                                <small className="text-muted extra-small">Log #{record.id}</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            {isNursery ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid rgba(234, 88, 12, 0.25)' }}
                              >
                                🌱 {record.doc ? `Day ${record.doc}` : 'DOC 1-19'} • Nursery
                              </span>
                            ) : isGrowout ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1"
                                style={{ background: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.18)' }}
                              >
                                🌊 {record.doc ? `Day ${record.doc}` : 'DOC 20+'} • Grow-out
                              </span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-2.5 py-1 extra-small fw-bold">
                                Pre-Stocking
                              </span>
                            )}
                          </td>

                          <td>
                            <span className="badge badge-tri-navy rounded-pill font-mono px-2.5 py-1 fw-semibold d-inline-flex align-items-center gap-1">
                              <FaClock size={10} style={{ color: '#EA580C' }} />
                              {record.feeding_time || '-'}
                            </span>
                          </td>

                          <td>
                            {Number(record.amount_grams) > 0 ? (
                              <div>
                                <span className="fw-bold text-dark font-mono" style={{ fontSize: '0.92rem' }}>
                                  {record.amount_grams} g ({formatKg(record.amount_grams)} kg)
                                </span>
                                <span className="extra-small text-muted d-block font-mono">
                                  {record.feed_type || record.product_code || 'Starter Feed'}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="fw-bold text-muted font-mono">0 g (0.00 kg)</span>
                                <span className="extra-small text-muted d-block font-mono">
                                  No feed logged • {record.feed_type || record.product_code || 'Starter'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td>
                            {record.vitamin_name && record.vitamin_name !== 'None' ? (
                              <span className="badge badge-tri-orange rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1">
                                <FaLeaf size={9} />
                                {record.vitamin_name}
                              </span>
                            ) : (
                              <span className="text-muted extra-small">None</span>
                            )}
                          </td>

                          <td>
                            <div>
                              <strong className="text-dark font-mono d-block" style={{ fontSize: '0.84rem' }}>
                                {record.record_date || '-'}
                              </strong>
                              <span className="extra-small text-muted d-inline-flex align-items-center gap-1">
                                <FaUserCheck size={9} className="text-success" />
                                {record.recorded_by_name || 'Caretaker'}
                              </span>
                            </div>
                          </td>

                          <td className="pe-3 text-center">
                            <div className="d-flex align-items-center justify-content-center gap-1">
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift"
                                style={{ width: 28, height: 28 }}
                                onClick={() => setSelectedRecordDetails(record)}
                                title="View Feeding Details"
                              >
                                <FaEye size={11} style={{ color: '#0B2C5F' }} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline-orange rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift"
                                style={{ width: 28, height: 28 }}
                                onClick={() => handleOpenBackfill(record)}
                                title="Edit this Feeding Record"
                              >
                                <FaEdit size={11} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift text-danger"
                                style={{ width: 28, height: 28 }}
                                onClick={() => handleDeleteHistoryRecord(record)}
                                title="Delete this Feeding Record"
                              >
                                <FaTrash size={10} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-tri-outline rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-lift"
                                style={{ width: 28, height: 28 }}
                                onClick={() => {
                                  const matchedPond = assignedPonds.find(p => String(p.id) === String(record.pond_id)) || {
                                    id: record.pond_id,
                                    pond_name: record.pond_name,
                                    stocking_date: record.stocking_date,
                                  };
                                  setCalendarModalPond(matchedPond);
                                }}
                                title="View Pond Cycle Calendar"
                              >
                                <FaCalendarAlt size={10} style={{ color: '#EA580C' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </div>

      {/* 🌟 ULTRA-PREMIUM COMPACT MODAL FOR FEEDING LOG DETAILS */}
      {selectedRecordDetails && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{
            backgroundColor: 'rgba(7, 23, 51, 0.78)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease',
            zIndex: 1060,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRecordDetails(null);
          }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '490px' }}>
            <div
              className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden position-relative"
              style={{
                background: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(11, 44, 95, 0.38)',
                animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* GRADIENT NAVY HEADER WITH CLOSE BUTTON */}
              <div
                className="modal-header text-white border-0 position-relative overflow-hidden d-flex align-items-center"
                style={{
                  background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 65%, #0E3D7D 100%)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div className="d-flex align-items-center gap-3 position-relative" style={{ zIndex: 1, paddingRight: '45px' }}>
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: '38px',
                      height: '38px',
                      background: 'rgba(255, 255, 255, 0.16)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <FaUtensils size={17} style={{ color: '#EA580C' }} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0 fs-6 tracking-tight">
                      Feeding Log Details
                    </h5>
                    <small className="text-white-50 extra-small font-mono fw-medium d-block">
                      Verified Field Aquaculture Telemetry
                    </small>
                  </div>
                </div>

                {/* FAR TOP-RIGHT ABSOLUTE CLOSE BUTTON */}
                <button
                  type="button"
                  className="btn border-0 text-white rounded-circle d-flex align-items-center justify-content-center p-0 shadow-none position-absolute hover-lift"
                  style={{
                    top: '12px',
                    right: '12px',
                    width: '32px',
                    height: '32px',
                    background: 'rgba(255, 255, 255, 0.18)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    zIndex: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedRecordDetails(null)}
                  title="Close Modal"
                >
                  <FaTimes size={13} />
                </button>
              </div>

              {/* MODAL BODY */}
              <div className="modal-body" style={{ background: '#F8FAFC', padding: '1.25rem' }}>
                {/* HERO POND & LOG BADGE CARD */}
                <div
                  className="rounded-4 mb-3 p-3 bg-white shadow-xs"
                  style={{ border: '1px solid rgba(11, 44, 95, 0.1)' }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2.5">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'rgba(11, 44, 95, 0.08)',
                          color: '#0B2C5F',
                        }}
                      >
                        <FaWater size={16} />
                      </div>
                      <div>
                        <h5 className="fw-extrabold mb-0 fs-6" style={{ color: '#0B2C5F' }}>
                          {selectedRecordDetails.pond_name || `Pond #${selectedRecordDetails.pond_id}`}
                        </h5>
                        <small className="text-muted extra-small">Assigned Shrimp Production Basin</small>
                      </div>
                    </div>

                    <span className="badge badge-tri-orange rounded-pill fw-bold font-mono px-2.5 py-1 extra-small">
                      <FaHashtag size={9} className="me-1 opacity-75" />
                      Log #{selectedRecordDetails.id}
                    </span>
                  </div>

                  {/* DATE & TIME ROW */}
                  <div className="d-flex align-items-center justify-content-between pt-2 border-top extra-small" style={{ borderColor: 'rgba(11, 44, 95, 0.07)' }}>
                    <div className="d-flex align-items-center gap-1.5 fw-semibold text-secondary">
                      <FaCalendarAlt size={12} style={{ color: '#EA580C' }} />
                      <span className="text-muted">Date:</span>
                      <strong className="text-dark ms-0.5">{selectedRecordDetails.record_date || '-'}</strong>
                    </div>
                    <div className="d-flex align-items-center gap-1.5 fw-semibold text-secondary">
                      <FaClock size={12} style={{ color: '#0B2C5F' }} />
                      <span className="text-muted">Time Slot:</span>
                      <strong className="text-dark ms-0.5">{selectedRecordDetails.feeding_time || '-'}</strong>
                    </div>
                  </div>
                </div>

                {/* ROW 1: AMOUNT & FEED PRODUCT */}
                <div className="row g-2.5 mb-2.5">
                  {/* Feed Amount Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 p-3 h-100 bg-white shadow-xs"
                      style={{ border: '1px solid rgba(11, 44, 95, 0.1)' }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider text-muted" style={{ fontSize: '0.68rem' }}>
                          Feed Amount
                        </span>
                        <div
                          className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                          style={{ width: 22, height: 22, background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F' }}
                        >
                          <FaWeightHanging size={10} />
                        </div>
                      </div>
                      <h4 className="fw-extrabold mb-1" style={{ color: '#0B2C5F' }}>
                        {Number(selectedRecordDetails.amount_kg || 0).toFixed(2)}{' '}
                        <small className="fs-6 text-muted fw-semibold">kg</small>
                      </h4>
                      <span className="extra-small text-muted font-mono d-block">
                        ≈ {Number(selectedRecordDetails.amount_grams || (Number(selectedRecordDetails.amount_kg || 0) * 1000)).toLocaleString()} grams
                      </span>
                    </div>
                  </div>

                  {/* Feed Product Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 p-3 h-100 bg-white shadow-xs"
                      style={{ border: '1px solid rgba(234, 88, 12, 0.15)' }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider" style={{ color: '#EA580C', fontSize: '0.68rem' }}>
                          Feed Product
                        </span>
                        <div
                          className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                          style={{ width: 22, height: 22, background: '#FFF7ED', color: '#EA580C' }}
                        >
                          <FaSeedling size={11} />
                        </div>
                      </div>
                      <h6 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '0.92rem', lineHeight: 1.3 }}>
                        {selectedRecordDetails.feed_type || selectedRecordDetails.product_code || 'Starter Feed'}
                      </h6>
                      <span className="badge badge-tri-orange rounded-pill extra-small px-2 py-0.5">
                        Tateh Aqua Feed
                      </span>
                    </div>
                  </div>
                </div>

                {/* ROW 2: VITAMINS ADDED & CARETAKER */}
                <div className="row g-2.5 mb-2.5">
                  {/* Vitamins Added Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 p-3 h-100 bg-white shadow-xs"
                      style={{ border: '1px solid rgba(11, 44, 95, 0.1)' }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider text-muted" style={{ fontSize: '0.68rem' }}>
                          Supplements
                        </span>
                        <div
                          className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                          style={{ width: 22, height: 22, background: '#FFF7ED', color: '#EA580C' }}
                        >
                          <FaLeaf size={10} />
                        </div>
                      </div>
                      <div>
                        {selectedRecordDetails.vitamin_name && selectedRecordDetails.vitamin_name !== 'None' ? (
                          <span className="badge badge-tri-orange rounded-pill fw-bold extra-small px-2.5 py-1 d-inline-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '100%' }}>
                            <FaLeaf size={9} /> {selectedRecordDetails.vitamin_name}
                          </span>
                        ) : selectedRecordDetails.has_vitamin ? (
                          <span className="badge badge-tri-navy rounded-pill extra-small px-2 py-0.5">
                            Standard Mix
                          </span>
                        ) : (
                          <span className="text-muted extra-small fw-semibold">
                            Feed Only (No Additives)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Caretaker Verification Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 p-3 h-100 bg-white shadow-xs"
                      style={{ border: '1px solid rgba(11, 44, 95, 0.1)' }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small text-muted tracking-wider" style={{ fontSize: '0.68rem' }}>
                          Caretaker
                        </span>
                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-0.5 extra-small fw-bold">
                          Verified
                        </span>
                      </div>
                      <div className="fw-extrabold text-dark d-flex align-items-center gap-1.5 text-truncate" style={{ fontSize: '0.88rem' }}>
                        <FaUserCheck className="text-success" size={13} />
                        <span className="text-truncate">{selectedRecordDetails.recorded_by_name || 'Caretaker'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NOTES / REMARKS CARD */}
                <div
                  className="rounded-4 p-3 bg-white shadow-xs"
                  style={{
                    border: '1px solid rgba(11, 44, 95, 0.1)',
                    borderLeft: '4px solid #0B2C5F',
                  }}
                >
                  <div className="d-flex align-items-center gap-1.5 mb-1">
                    <FaCommentDots size={12} style={{ color: '#0B2C5F' }} />
                    <span className="text-uppercase fw-bold extra-small text-muted tracking-wider" style={{ fontSize: '0.7rem' }}>
                      Notes &amp; Field Observations
                    </span>
                  </div>
                  <p className="text-secondary small mb-0 fw-medium" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                    {selectedRecordDetails.notes && selectedRecordDetails.notes.trim() !== ''
                      ? selectedRecordDetails.notes
                      : 'No special remarks recorded for this feeding slot.'}
                  </p>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div
                className="modal-footer p-2.5 px-3 bg-light border-top d-flex justify-content-between align-items-center"
                style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small fw-bold"
                  onClick={() => setSelectedRecordDetails(null)}
                >
                  Close
                </button>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-tri-orange px-3.5 py-1.5 extra-small fw-bold shadow-xs hover-lift"
                    onClick={() => {
                      const rec = selectedRecordDetails;
                      setSelectedRecordDetails(null);
                      handleOpenBackfill(rec);
                    }}
                  >
                    <FaEdit size={11} /> Edit Record
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 POND CULTURE CYCLE CALENDAR MODAL */}
      {calendarModalPond && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.76)', zIndex: 1060 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 overflow-hidden shadow-2xl">
              <PondCycleCalendar
                pondId={calendarModalPond.id}
                stockingDate={calendarModalPond.stocking_date}
                selectedDate={customDate || todayYMD}
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

      {/* 🌟 BACKFILL & EDIT FEEDING RECORD MODAL (TRI-COLOR THEMED) */}
      {backfillModalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.82)', backdropFilter: 'blur(8px)', zIndex: 1070 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 overflow-hidden bg-white shadow-2xl">
              <form onSubmit={handleSaveBackfill}>
                {/* MODAL HEADER */}
                <div
                  className="p-3.5 px-4 text-white d-flex justify-content-between align-items-center"
                  style={{ background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 65%, #0E3D7D 100%)' }}
                >
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{ width: 32, height: 32, background: 'rgba(255, 255, 255, 0.18)' }}
                    >
                      {editingModalRecord ? <FaEdit style={{ color: '#EA580C' }} size={14} /> : <FaPlus style={{ color: '#EA580C' }} size={13} />}
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-white" style={{ fontSize: '1rem' }}>
                        {editingModalRecord ? `Edit Feeding Record #${editingModalRecord.id}` : 'Log Farm Feeding Session'}
                      </h6>
                      <small className="text-white-50 extra-small">Caretaker Daily Farm Telemetry</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm border-0 text-white rounded-circle p-1.5 d-flex align-items-center justify-content-center hover-lift"
                    style={{ width: 30, height: 30, background: 'rgba(255, 255, 255, 0.15)' }}
                    onClick={() => setBackfillModalOpen(false)}
                  >
                    <FaTimes size={12} />
                  </button>
                </div>

                {/* MODAL BODY */}
                <div className="modal-body p-4 bg-white">
                  <div className="row g-3">
                    {/* Pond Basin */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Pond Basin <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm fw-semibold rounded-3"
                        value={backfillForm.pond_id}
                        onChange={(e) => setBackfillForm({ ...backfillForm, pond_id: e.target.value })}
                        required
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      >
                        <option value="">Select Pond...</option>
                        {assignedPonds.map((p) => (
                          <option key={p.id} value={p.id}>{p.pond_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Log Date */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Log Date <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-semibold rounded-3"
                        value={backfillForm.record_date}
                        onChange={(e) => setBackfillForm({ ...backfillForm, record_date: e.target.value })}
                        required
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      >
                      </input>
                    </div>

                    {/* Feeding Slot */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Feeding Slot <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm font-mono fw-bold rounded-3"
                        value={backfillForm.feeding_time}
                        onChange={(e) => setBackfillForm({ ...backfillForm, feeding_time: e.target.value })}
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      >
                        {STANDARD_SLOTS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Amount in Grams */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">
                        Amount (grams) <span className="text-danger">*</span>
                        {backfillForm.amount_grams !== '' && !isNaN(parseFloat(backfillForm.amount_grams)) && (
                          <span className="ms-1 fw-bold" style={{ color: '#EA580C' }}>
                            ≈ {(parseFloat(backfillForm.amount_grams) / 1000).toFixed(2)} kg
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control form-control-sm fw-bold rounded-3 font-mono"
                        placeholder="e.g. 500 (or 0 for no feed)"
                        value={backfillForm.amount_grams}
                        onChange={(e) => {
                          const gVal = e.target.value;
                          const kgVal = gVal === '' ? '' : (parseFloat(gVal) / 1000).toString();
                          setBackfillForm({ ...backfillForm, amount_grams: gVal, amount_kg: kgVal });
                        }}
                        required
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      />
                      <small className="extra-small text-muted mt-1 d-block">
                        Enter in grams (e.g. 500g). Use 0 for "No feed logged".
                      </small>
                    </div>

                    {/* Product Code */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Product Formulation</label>
                      <select
                        className="form-select form-select-sm fw-semibold rounded-3"
                        value={backfillForm.product_code}
                        onChange={(e) => setBackfillForm({ ...backfillForm, product_code: e.target.value })}
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      >
                        <option value="Starter">Starter • Tateh Feed</option>
                        <option value="Grower">Grower • Tateh Feed</option>
                      </select>
                    </div>

                    {/* Supplements & Additives */}
                    <div className="col-md-6">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Vitamins &amp; Supplements</label>
                      <select
                        className="form-select form-select-sm fw-semibold rounded-3"
                        value={backfillForm.vitamin_name}
                        onChange={(e) => setBackfillForm({ ...backfillForm, vitamin_name: e.target.value })}
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      >
                        <option value="Sanolife PRO-2, Sano Top-S">Sanolife PRO-2, Sano Top-S (Both Consumed • Standard)</option>
                        <option value="Sanolife PRO-2">Sanolife PRO-2</option>
                        <option value="Sano Top-S">Sano Top-S</option>
                        <option value="None">None (No Vitamin)</option>
                      </select>
                    </div>

                    {/* Notes / Remarks */}
                    <div className="col-12">
                      <label className="form-label extra-small fw-bold text-dark mb-1">Notes / Remarks (Optional)</label>
                      <textarea
                        className="form-control form-control-sm rounded-3"
                        rows="2"
                        placeholder="e.g. Backfilled from farm logsheet or feeding observation notes"
                        value={backfillForm.notes}
                        onChange={(e) => setBackfillForm({ ...backfillForm, notes: e.target.value })}
                        style={{ border: '1px solid rgba(11, 44, 95, 0.18)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* MODAL FOOTER */}
                <div
                  className="modal-footer p-3 bg-light border-top d-flex justify-content-end gap-2"
                  style={{ borderColor: 'rgba(11, 44, 95, 0.08)' }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-tri-outline px-3.5 py-1.5 extra-small fw-bold"
                    onClick={() => setBackfillModalOpen(false)}
                    disabled={savingBackfill}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-tri-orange px-4 py-1.5 extra-small fw-bold shadow-sm hover-lift"
                    disabled={savingBackfill}
                  >
                    {savingBackfill ? 'Saving...' : (editingModalRecord ? 'Save Changes' : 'Save Feeding Record')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Animation Style */}
      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
