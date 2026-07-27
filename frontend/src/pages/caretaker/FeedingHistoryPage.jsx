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
  FaLayerGroup
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

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
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Log Details Modal State
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

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
          title: 'Feeding history updated',
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

  // Client-side Filtered Records (Date & Search)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
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

      // 2. Search Term Filter
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

      return matchDate && matchSearch;
    });
  }, [records, dateFilter, customDate, searchTerm, todayYMD]);

  // Dynamic Summary Metrics
  const selectedPond = assignedPonds.find((pond) => String(pond.id) === String(selectedPondFilter));
  const currentScope = selectedPondFilter === 'all' ? 'All Ponds' : selectedPond?.pond_name || 'Selected pond';
  
  const totalFeedKg = filteredRecords.reduce((sum, record) => sum + (parseFloat(record.amount_kg) || 0), 0);
  const totalLogsCount = filteredRecords.length;
  const pondsWithRecords = new Set(filteredRecords.map((record) => String(record.pond_id || record.pond_name || '')).filter(Boolean)).size;
  
  const vitaminRecords = filteredRecords.filter((record) => record.has_vitamin || (record.vitamin_name && record.vitamin_name !== 'None'));
  const vitaminLogsCount = vitaminRecords.length;
  
  const latestVitaminRecord = vitaminRecords[0] || filteredRecords.find(r => r.record_date);
  const latestDateText = latestVitaminRecord?.record_date ? `Latest: ${latestVitaminRecord.record_date}` : 'No records yet';

  // Export to Excel / CSV
  const handleExportCSV = () => {
    setShowExportMenu(false);
    if (filteredRecords.length === 0) {
      Swal.fire({ icon: 'info', title: 'No Data to Export', text: 'There are no feeding records matching your current filter.' });
      return;
    }

    const headers = ['Record ID,Pond Name,Date,Time,Amount (kg),Feed Type,Vitamin Name,Recorded By,Notes'];
    const rows = filteredRecords.map((r) => 
      `${r.id},"${r.pond_name || `Pond #${r.pond_id}`}","${r.record_date || ''}","${r.feeding_time || ''}",${r.amount_kg || 0},"${r.feed_type || r.product_code || 'Starter'}","${r.vitamin_name || 'None'}","${r.recorded_by_name || 'Caretaker'}","${(r.notes || '').replace(/"/g, '""')}"`
    );

    const csvContent = '\uFEFF' + headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Feeding_History_${selectedPondFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
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
      Swal.fire({ icon: 'error', title: 'Popup Blocked', text: 'Please allow popups to generate the PDF report.' });
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Feeding History Report - ShrimPredict</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #0f172a; }
            h2 { color: #0B2C5F; margin-bottom: 5px; font-weight: 700; }
            p { color: #64748b; font-size: 13px; margin-top: 0; }
            .meta { display: flex; justify-content: space-between; background: #f8fafc; padding: 14px 18px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 13px; }
            th { background-color: #0B2C5F; color: white; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 12px; }
            .footer { margin-top: 35px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <h2>ShrimPredict • Caretaker Feeding Report</h2>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <div class="meta">
            <div><strong>Filter Scope:</strong> ${currentScope}</div>
            <div><strong>Total Logs:</strong> ${filteredRecords.length}</div>
            <div><strong>Total Feed Consumed:</strong> ${totalFeedKg.toFixed(1)} kg</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Pond</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Feed Product</th>
                <th>Vitamins</th>
                <th>Recorded By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map(r => `
                <tr>
                  <td><strong>${r.record_date || '-'}</strong></td>
                  <td>${r.pond_name || `Pond #${r.pond_id}`}</td>
                  <td><span class="badge">${r.feeding_time || '-'}</span></td>
                  <td><strong>${Number(r.amount_kg || 0).toFixed(2)} kg</strong></td>
                  <td>${r.feed_type || r.product_code || 'Tateh'}</td>
                  <td>${r.vitamin_name || 'None'}</td>
                  <td>${r.recorded_by_name || 'Caretaker'}</td>
                  <td>${r.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">ShrimPredict Smart Aquaculture System • Official Caretaker Feeding History</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="caretaker-history-page">
      {/* Top Hero Banner */}
      <section className="caretaker-dashboard-hero mb-4">
        <div>
          <span className="caretaker-dashboard-kicker">CARETAKER FEEDING RECORDS</span>
          <h3>Feeding History</h3>
          <p>Review feed consumption, vitamins, product type, and pond activity from your submitted feeding logs.</p>
        </div>
      </section>

      {/* SUMMARY CARDS (REQUIRED 4 CARDS PRESERVED & DYNAMIC) */}
      <div className="row g-3 mb-4">
        {/* Card 1: Total Feed Consumption */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Total Feed Consumption</span>
              <div className="rounded-3 p-2.5 bg-info bg-opacity-10 text-info fs-5">
                <FaUtensils />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{totalFeedKg.toFixed(1)} <small className="fs-6 text-muted fw-normal">kg</small></h3>
            <span className="text-muted extra-small">{currentScope}</span>
          </div>
        </div>

        {/* Card 2: Total Logs */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Total Logs</span>
              <div className="rounded-3 p-2.5 bg-success bg-opacity-10 text-success fs-5">
                <FaCalendarAlt />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{totalLogsCount}</h3>
            <span className="text-muted extra-small">Submitted caretaker records</span>
          </div>
        </div>

        {/* Card 3: Ponds With Logs */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Ponds With Logs</span>
              <div className="rounded-3 p-2.5 bg-primary bg-opacity-10 text-primary fs-5">
                <FaWater />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{pondsWithRecords}</h3>
            <span className="text-muted extra-small">Within the selected filter</span>
          </div>
        </div>

        {/* Card 4: Vitamin Logs */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Vitamin Logs</span>
              <div className="rounded-3 p-2.5 bg-warning bg-opacity-10 text-warning fs-5">
                <FaLeaf />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{vitaminLogsCount}</h3>
            <span className="text-muted extra-small">{latestDateText}</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT PANEL: TOOLBAR & SCROLLABLE TABLE */}
      <div className="card caretaker-panel-card shadow-sm border-0 rounded-4">
        <div className="card-body p-4">
          
          {/* TOOLBAR CONTROLS */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
            <div>
              <h5 className="fw-bold text-dark mb-0">Feeding Log Records</h5>
              <small className="text-muted">Showing {filteredRecords.length} record(s) for {currentScope}</small>
            </div>

            <div className="d-flex align-items-center flex-wrap gap-2.5">
              {/* 1. Live Search Input */}
              <div
                className="input-group bg-white border border-secondary border-opacity-25 rounded-pill shadow-xs overflow-hidden d-flex align-items-center px-3"
                style={{ width: 230, height: 38 }}
              >
                <span className="text-muted extra-small me-2 d-flex align-items-center"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-medium text-dark"
                  placeholder="Search pond, date, feed..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ height: '100%' }}
                />
              </div>

              {/* 2. Pond Filter Dropdown */}
              <div
                className="bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded-pill d-flex align-items-center px-3 shadow-xs"
                style={{ height: 38 }}
              >
                <span className="text-primary extra-small fw-bold text-nowrap me-1.5 d-flex align-items-center gap-1">
                  <FaFilter size={11} /> Ponds:
                </span>
                <select
                  className="form-select form-select-sm border-0 bg-transparent text-primary fw-bold p-0 extra-small shadow-none cursor-pointer"
                  style={{ width: 110, height: '100%' }}
                  value={selectedPondFilter}
                  onChange={(event) => setSelectedPondFilter(event.target.value)}
                >
                  <option value="all">All Ponds</option>
                  {assignedPonds.map((pond) => (
                    <option key={pond.id} value={pond.id}>
                      {pond.pond_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Date Filter Dropdown */}
              <div
                className="bg-white border border-secondary border-opacity-25 rounded-pill d-flex align-items-center px-3 shadow-xs"
                style={{ height: 38 }}
              >
                <select
                  className="form-select form-select-sm border-0 bg-transparent text-dark fw-semibold p-0 extra-small shadow-none cursor-pointer"
                  style={{ width: 110, height: '100%' }}
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    if (e.target.value !== 'custom') setCustomDate('');
                  }}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Date...</option>
                </select>
              </div>

              {/* Custom Date Input */}
              {dateFilter === 'custom' && (
                <input
                  type="date"
                  className="form-control form-control-sm rounded-pill border-secondary border-opacity-25 extra-small px-3 shadow-xs"
                  style={{ width: 140, height: 38 }}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              )}

              {/* 4. Refresh Button */}
              <button
                type="button"
                className="btn btn-outline-secondary rounded-pill d-inline-flex align-items-center justify-content-center gap-1.5 px-3.5 extra-small fw-semibold shadow-xs"
                style={{ height: 38 }}
                onClick={() => loadHistory(true)}
                disabled={refreshing}
                title="Refresh Feeding Logs"
              >
                <FaSync className={refreshing ? 'fa-spin' : ''} size={11} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {/* 5. Export Dropdown Options */}
              <div className="position-relative">
                <button
                  type="button"
                  className="btn btn-primary rounded-pill d-inline-flex align-items-center justify-content-center gap-1.5 px-3.5 extra-small fw-bold shadow-xs"
                  style={{ height: 38 }}
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  <FaFileDownload size={11} /> Export File
                </button>

                {showExportMenu && (
                  <div
                    className="position-absolute end-0 mt-1 bg-white shadow-lg rounded-3 border py-1"
                    style={{ zIndex: 1050, minWidth: 165 }}
                  >
                    <button
                      type="button"
                      className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 extra-small fw-semibold text-dark hover-bg-light"
                      onClick={handleExportCSV}
                    >
                      <FaFileExcel className="text-success" /> Export to Excel (.csv)
                    </button>
                    <button
                      type="button"
                      className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 small fw-semibold text-dark hover-bg-light"
                      onClick={handleExportPDF}
                    >
                      <FaFilePdf className="text-danger" /> Export to PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TABLE SECTION (FIXED HEIGHT CONTAINER FOR 10 DISPLAY ITEMS + SCROLLABLE FOR REST) */}
          {loading ? (
            <div className="caretaker-empty-state py-5 text-center text-muted">
              <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
              Loading feeding history from database...
            </div>
          ) : error ? (
            <div className="alert alert-danger mb-0">{error}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="caretaker-empty-state py-5 text-center text-muted">
              No feeding records found for {currentScope} with the selected filters.
            </div>
          ) : (
            <div
              className="table-responsive border rounded-3 shadow-xs position-relative"
              style={{
                maxHeight: '450px', // Fits ~10 rows comfortably
                overflowY: 'auto',
              }}
            >
              <table className="table table-hover align-middle mb-0 caretaker-history-table">
                <thead
                  className="table-light sticky-top shadow-xs"
                  style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc' }}
                >
                  <tr>
                    <th className="ps-3 py-3 text-secondary text-uppercase small fw-bold">Pond</th>
                    <th className="py-3 text-secondary text-uppercase small fw-bold">Time</th>
                    <th className="py-3 text-secondary text-uppercase small fw-bold">Date</th>
                    <th className="pe-3 py-3 text-center text-secondary text-uppercase small fw-bold" style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-bottom">
                      <td className="ps-3 fw-bold text-dark">
                        <div className="d-flex align-items-center gap-2">
                          <span className="p-1.5 rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex">
                            <FaWater size={13} />
                          </span>
                          <span>{record.pond_name || `Pond #${record.pond_id}`}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary bg-opacity-10 text-dark font-mono px-2.5 py-1.5 rounded-pill fw-semibold">
                          <FaClock className="me-1 text-muted" size={11} />
                          {record.feeding_time || '-'}
                        </span>
                      </td>
                      <td>
                        <strong className="text-dark">{record.record_date || '-'}</strong>
                      </td>
                      <td className="pe-3 text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs hover-scale"
                          style={{ width: 34, height: 34, transition: 'all 0.2s ease' }}
                          onClick={() => setSelectedRecordDetails(record)}
                          title="View Feeding Details"
                        >
                          <FaEye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ULTRA-PREMIUM COMPACT MODAL FOR FEEDING LOG DETAILS (NO SCROLL NEEDED) */}
      {selectedRecordDetails && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.3s ease',
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
              {/* STUNNING GRADIENT HEADER WITH ABSOLUTE FAR TOP-RIGHT X BUTTON */}
              <div
                className="modal-header text-white border-0 position-relative overflow-hidden d-flex align-items-center"
                style={{
                  background: 'linear-gradient(135deg, #0B2C5F 0%, #1E40AF 100%)',
                  padding: '1rem 1.25rem',
                }}
              >
                {/* Decorative background glow circle */}
                <div
                  className="position-absolute rounded-circle opacity-20 pointer-events-none"
                  style={{
                    width: '160px',
                    height: '160px',
                    background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)',
                    top: '-50px',
                    right: '-30px',
                  }}
                />

                <div className="d-flex align-items-center gap-3 position-relative" style={{ zIndex: 1, paddingRight: '45px' }}>
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: '38px',
                      height: '38px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    <FaInfoCircle size={19} className="text-white" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white mb-0 fs-6 tracking-tight">
                      Feeding Log Details
                    </h5>
                    <small className="text-white-50 extra-small font-mono fw-medium d-block" style={{ fontSize: '0.73rem', marginTop: '1px' }}>
                      Verified Caretaker Session
                    </small>
                  </div>
                </div>

                {/* FAR TOP-RIGHT ABSOLUTE X BUTTON */}
                <button
                  type="button"
                  className="btn border-0 text-white rounded-circle d-flex align-items-center justify-content-center p-0 shadow-none position-absolute hover-scale"
                  style={{
                    top: '12px',
                    right: '12px',
                    width: '32px',
                    height: '32px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    zIndex: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedRecordDetails(null)}
                  title="Close Modal"
                >
                  <FaTimes size={14} />
                </button>
              </div>

              {/* MODAL BODY - COMPACT NO-SCROLL LAYOUT */}
              <div className="modal-body" style={{ background: '#f8fafc', padding: '1.15rem 1.25rem' }}>
                
                {/* HERO POND & LOG BADGE CARD */}
                <div
                  className="rounded-4 mb-2.5 position-relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                    padding: '0.85rem 1.15rem',
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle text-primary d-flex align-items-center justify-content-center shadow-xs"
                        style={{
                          width: '38px',
                          height: '38px',
                          background: 'linear-gradient(135deg, rgba(11,44,95,0.12), rgba(30,64,175,0.06))',
                          flexShrink: 0,
                        }}
                      >
                        <FaWater size={17} />
                      </div>
                      <div>
                        <h5 className="fw-extrabold text-dark mb-0 fs-6" style={{ color: '#0B2C5F', letterSpacing: '-0.2px' }}>
                          {selectedRecordDetails.pond_name || `Pond #${selectedRecordDetails.pond_id}`}
                        </h5>
                        <small className="text-muted extra-small d-block fw-medium" style={{ fontSize: '0.73rem', marginTop: '1px' }}>Assigned Shrimp Pond</small>
                      </div>
                    </div>

                    <span
                      className="badge rounded-pill fw-bold font-mono shadow-xs d-inline-flex align-items-center gap-1.5"
                      style={{
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        padding: '0.35rem 0.8rem',
                      }}
                    >
                      <FaHashtag size={10} className="opacity-75" />
                      Log #{selectedRecordDetails.id}
                    </span>
                  </div>

                  {/* DATE & TIME BAR WITH EXPLICIT SPACING */}
                  <div className="d-flex align-items-center justify-content-between pt-2 border-top border-slate-200 extra-small text-secondary" style={{ fontSize: '0.78rem' }}>
                    <div className="d-flex align-items-center gap-2 fw-semibold text-slate-700">
                      <FaCalendarAlt className="text-primary me-1" size={13} />
                      <span className="text-muted fw-normal">Date :</span>
                      <strong className="text-dark ms-1">{selectedRecordDetails.record_date || '-'}</strong>
                    </div>
                    <div className="d-flex align-items-center gap-2 fw-semibold text-slate-700">
                      <FaClock className="text-primary me-1" size={13} />
                      <span className="text-muted fw-normal">Time :</span>
                      <strong className="text-dark ms-1">{selectedRecordDetails.feeding_time || '-'}</strong>
                    </div>
                  </div>
                </div>

                {/* ROW 1 GRID: AMOUNT & PRODUCT */}
                <div className="row g-2.5 mb-2.5">
                  {/* Feed Amount Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 h-100 position-relative"
                      style={{
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: '1px solid #bbf7d0',
                        boxShadow: '0 2px 5px rgba(22, 101, 52, 0.04)',
                        padding: '0.85rem 1rem',
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider" style={{ color: '#15803d', fontSize: '0.7rem' }}>
                          Feed Amount
                        </span>
                        <div className="rounded-circle p-1 bg-white text-success shadow-xs d-flex align-items-center justify-content-center" style={{ width: 24, height: 24 }}>
                          <FaWeightHanging size={12} />
                        </div>
                      </div>
                      <h4 className="fw-extrabold text-dark mb-1" style={{ color: '#14532d' }}>
                        {Number(selectedRecordDetails.amount_kg || 0).toFixed(2)}{' '}
                        <small className="fs-6 text-emerald-700 fw-semibold ms-1">kg</small>
                      </h4>
                      <span className="text-success extra-small fw-bold d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.72rem' }}>
                        <FaCheckCircle size={11} /> Consumed Log
                      </span>
                    </div>
                  </div>

                  {/* Feed Product Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 h-100 position-relative"
                      style={{
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        border: '1px solid #bae6fd',
                        boxShadow: '0 2px 5px rgba(3, 105, 161, 0.04)',
                        padding: '0.85rem 1rem',
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider" style={{ color: '#0369a1', fontSize: '0.7rem' }}>
                          Feed Product
                        </span>
                        <div className="rounded-circle p-1 bg-white text-info shadow-xs d-flex align-items-center justify-content-center" style={{ width: 24, height: 24 }}>
                          <FaSeedling size={12} />
                        </div>
                      </div>
                      <h6 className="fw-extrabold text-dark mb-1" style={{ color: '#0c4a6e', fontSize: '0.9rem', lineHeight: 1.3 }}>
                        {selectedRecordDetails.feed_type || selectedRecordDetails.product_code || 'Tateh Starter'}
                      </h6>
                      <span className="text-info extra-small fw-semibold d-inline-block" style={{ fontSize: '0.72rem' }}>
                        Tateh Aqua Feed
                      </span>
                    </div>
                  </div>
                </div>

                {/* ROW 2 GRID: VITAMINS ADDED & RECORDED BY (SIDE BY SIDE TO SAVE HEIGHT) */}
                <div className="row g-2.5 mb-2.5">
                  {/* Vitamins Added Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 h-100 position-relative"
                      style={{
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        border: '1px solid #fde68a',
                        boxShadow: '0 2px 5px rgba(180, 83, 9, 0.04)',
                        padding: '0.85rem 1rem',
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small tracking-wider" style={{ color: '#b45309', fontSize: '0.7rem' }}>
                          Vitamins Added
                        </span>
                        <div className="rounded-circle p-1 bg-white text-warning shadow-xs d-flex align-items-center justify-content-center" style={{ width: 24, height: 24 }}>
                          <FaLeaf size={12} />
                        </div>
                      </div>
                      <div>
                        {selectedRecordDetails.vitamin_name && selectedRecordDetails.vitamin_name !== 'None' ? (
                          <span
                            className="badge rounded-pill fw-bold text-white shadow-xs d-inline-flex align-items-center gap-1.5 text-truncate"
                            style={{
                              background: 'linear-gradient(135deg, #d97706, #b45309)',
                              fontSize: '0.78rem',
                              padding: '0.35rem 0.75rem',
                              maxWidth: '100%',
                            }}
                          >
                            <FaLeaf size={11} className="me-0.5" /> {selectedRecordDetails.vitamin_name}
                          </span>
                        ) : selectedRecordDetails.has_vitamin ? (
                          <span className="badge bg-success text-white rounded-pill fw-bold" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                            Yes (Standard Mix)
                          </span>
                        ) : (
                          <span className="badge bg-amber bg-opacity-20 text-dark rounded-pill fw-semibold" style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}>
                            None (Feed Only)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recorded By Caretaker Card */}
                  <div className="col-6">
                    <div
                      className="rounded-4 h-100 bg-white border border-slate-200 shadow-xs"
                      style={{ padding: '0.85rem 1rem' }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="text-uppercase fw-bold extra-small text-muted tracking-wider" style={{ fontSize: '0.7rem' }}>
                          Caretaker
                        </span>
                        <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 py-0.5 extra-small fw-bold border border-success border-opacity-25" style={{ fontSize: '0.68rem' }}>
                          Verified
                        </span>
                      </div>
                      <div className="fw-extrabold text-dark d-flex align-items-center gap-2 text-truncate" style={{ color: '#0F172A', fontSize: '0.9rem' }}>
                        <FaUserCheck className="text-success me-1" size={15} />
                        <span className="text-truncate">{selectedRecordDetails.recorded_by_name || 'Caretaker'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NOTES / REMARKS CARD (FULL WIDTH AT BOTTOM) */}
                <div>
                  <div
                    className="rounded-4 bg-white border border-slate-200 shadow-xs"
                    style={{
                      padding: '0.85rem 1.15rem',
                      borderLeft: '4px solid #3b82f6',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1.5">
                      <FaCommentDots className="text-primary" size={14} />
                      <span className="text-uppercase fw-bold extra-small text-muted tracking-wider" style={{ fontSize: '0.72rem' }}>
                        Notes & Remarks
                      </span>
                    </div>
                    <p className="text-secondary small mb-0 fw-medium" style={{ fontSize: '0.83rem', lineHeight: 1.5 }}>
                      {selectedRecordDetails.notes && selectedRecordDetails.notes.trim() !== ''
                        ? selectedRecordDetails.notes
                        : 'No extra notes recorded for this feeding session.'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Smooth Keyframe Animation */}
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
        .hover-scale:hover {
          transform: translateY(-1px) scale(1.02);
        }
      `}</style>
    </div>
  );
}

