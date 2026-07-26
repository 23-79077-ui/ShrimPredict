import { useEffect, useState, useMemo } from 'react';
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
  FaUtensils
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';

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

export default function FeedingPage() {
  const [searchParams] = useSearchParams();
  const targetPond = searchParams.get('pond');

  const [records, setRecords] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPond, setSelectedPond] = useState(targetPond || 'all');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  const [customDate, setCustomDate] = useState('');
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'pond-asc'

  useEffect(() => {
    const loadData = async () => {
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
    };
    loadData();
  }, []);

  // Format Helper for YYYY-MM-DD
  const formatYMD = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayYMD = formatYMD(new Date());

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
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

        // 3. Search Filter
        const matchSearch =
          !searchTerm ||
          String(r.pond_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.feed_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.recorded_by_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(r.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchDate && matchPond && matchSearch;
      })
      .sort((a, b) => {
        // Sorting Logic
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

    // Estimated Cost (Average ₱35 per kg of premium feed)
    const estimatedCost = totalKg * 35;
    const avgDailyKg = records.length > 0 ? (totalKg / Math.max(1, Math.ceil(records.length / 3))).toFixed(1) : '0.0';

    return {
      totalKg: totalKg > 0 ? totalKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0',
      weeklyKg: weeklyKg > 0 ? weeklyKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0',
      estimatedCost: `₱${estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      avgDailyKg: `${avgDailyKg} kg/day`
    };
  }, [records]);

  // Chart Data Preparation (Daily Feeding Consumption)
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
          label: 'Daily Feed Consumption (kg)',
          data: dailyTotals,
          borderColor: '#0B2C5F',
          backgroundColor: 'rgba(11, 44, 95, 0.12)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#FF7A00',
          pointBorderColor: '#ffffff',
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    };
  }, [records]);

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
          label: 'Consumption by Feed Type (kg)',
          data: values,
          backgroundColor: ['#0B2C5F', '#1FB567', '#FF7A00', '#1E40AF', '#8B5CF6'],
          borderRadius: 8
        }
      ]
    };
  }, [records]);

  // View Logs Action Handler: Opens SweetAlert2 Modal with Pond Feeding Breakdown
  const handleViewPondLogs = (pondName, pondId) => {
    const pondLogs = records.filter(
      (r) => String(r.pond_name || r.pond_id).toLowerCase() === String(pondName || pondId).toLowerCase()
    );

    const totalGiven = pondLogs.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);

    const logHtml =
      pondLogs.length === 0
        ? `<div class="p-3 text-muted">No feeding records found for ${pondName}.</div>`
        : `
          <div class="text-start mb-3 p-3 bg-light rounded-3">
            <div class="d-flex justify-content-between mb-1">
              <span class="fw-bold text-dark">Target Daily Feed:</span>
              <span class="fw-bold text-primary">45.0 kg</span>
            </div>
            <div class="d-flex justify-content-between mb-1">
              <span class="fw-bold text-dark">Total Logged Feed:</span>
              <span class="fw-bold text-success">${totalGiven.toFixed(1)} kg</span>
            </div>
            <div class="d-flex justify-content-between">
              <span class="fw-bold text-dark">Total Log Entries:</span>
              <span>${pondLogs.length} logs</span>
            </div>
          </div>
          <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-sm table-striped text-start small align-middle mb-0">
              <thead class="table-primary">
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Feed Type</th>
                  <th>Amount</th>
                  <th>Vitamins</th>
                  <th>Caretaker</th>
                </tr>
              </thead>
              <tbody>
                ${pondLogs
                  .map(
                    (l) => `
                  <tr>
                    <td>${l.record_date || 'Today'}</td>
                    <td><span class="badge bg-secondary">${l.feeding_time || '08:00 AM'}</span></td>
                    <td>${l.feed_type || 'Starter Feed'}</td>
                    <td class="fw-bold text-success">${l.amount_kg} kg</td>
                    <td>${l.vitamin_name && l.vitamin_name !== 'None' ? `<span class="badge bg-success">${l.vitamin_name}</span>` : '<span class="text-muted">None</span>'}</td>
                    <td>${l.recorded_by_name || 'Caretaker'}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;

    Swal.fire({
      title: `<i class="fa fa-water text-primary me-2"></i> Feeding Logs: ${pondName}`,
      html: logHtml,
      width: 650,
      showCloseButton: true,
      confirmButtonColor: '#0B2C5F',
      confirmButtonText: 'Close Panel'
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ['Record ID,Pond Name,Feed Type,Amount (kg),Date,Recorded By,Notes\n'];
    const rows = filteredRecords.map(
      (r) => `${r.id},"${r.pond_name || r.pond_id}","${r.feed_type || 'N/A'}",${r.amount_kg},"${r.record_date || r.created_at}","${r.recorded_by_name || 'Caretaker'}","${r.notes || ''}"`
    );

    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Feeding_Consumption_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="feeding-consumption-container">
      {/* Top Action Bar (CSV Export) */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold extra-small">
            <FaUtensils className="me-1" /> Real-time Feed Analytics & Log Verification
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary d-flex align-items-center gap-2 shadow-sm rounded-pill px-4 py-2"
          onClick={handleExportCSV}
        >
          <FaFileDownload /> Export CSV Report
        </button>
      </div>

      {/* 2. TOP METRIC CARDS ROW WITH GENEROUS SPACING & PADDING (4 CARDS) */}
      <div className="row g-3 mb-4">
        {/* Card 1: Total Feed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Total Cumulative Feed</span>
              <div className="rounded-3 p-2.5 bg-primary bg-opacity-10 text-primary">
                <FaSeedling size={22} />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{metrics.totalKg} <small className="fs-6 text-muted fw-normal">kg</small></h3>
            <span className="badge bg-success bg-opacity-10 text-success rounded-pill extra-small fw-semibold">
              <FaCheckCircle className="me-1" /> All Ponds Combined
            </span>
          </div>
        </div>

        {/* Card 2: Weekly Feed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Weekly Consumption</span>
              <div className="rounded-3 p-2.5 bg-success bg-opacity-10 text-success">
                <FaCalendarWeek size={22} />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{metrics.weeklyKg} <small className="fs-6 text-muted fw-normal">kg</small></h3>
            <span className="text-muted extra-small">Last 7 Days Activity</span>
          </div>
        </div>

        {/* Card 3: Feed Cost */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Estimated Feed Cost</span>
              <div className="rounded-3 p-2.5 bg-warning bg-opacity-10 text-warning">
                <FaCoins size={22} />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{metrics.estimatedCost}</h3>
            <span className="text-muted extra-small">Avg ₱35.00 / kg feed</span>
          </div>
        </div>

        {/* Card 4: Average Feed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 position-relative overflow-hidden">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small fw-semibold">Average Rate</span>
              <div className="rounded-3 p-2.5 bg-info bg-opacity-10 text-info">
                <FaChartLine size={22} />
              </div>
            </div>
            <h3 className="fw-extrabold text-dark mb-2">{metrics.avgDailyKg}</h3>
            <span className="text-muted extra-small">Per Active Pond / Day</span>
          </div>
        </div>
      </div>

      {/* 3. CHARTS SECTION (Daily Feeding Consumption Chart + Feed Type Breakdown) */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm rounded-4 bg-white p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold text-dark mb-1">
                  <FaChartLine className="text-primary me-2" /> Daily Feeding Consumption Chart
                </h5>
                <p className="text-muted small mb-0">Tracked feed volume (kg) delivered throughout the current week.</p>
              </div>
              <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-1.5 extra-small fw-semibold">
                7-Day Trend
              </span>
            </div>
            <div style={{ height: 260 }}>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true },
                    x: { grid: { display: false } }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 bg-white p-4 h-100">
            <div className="mb-3">
              <h5 className="fw-bold text-dark mb-1">Feed Type Breakdown</h5>
              <p className="text-muted small mb-0">Distribution by feed classification (kg).</p>
            </div>
            <div style={{ height: 260 }}>
              <Bar
                data={feedTypeChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true },
                    x: { grid: { display: false } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. POND FEEDING STATUS TABLE */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h5 className="fw-bold text-dark mb-1">
              <FaWater className="text-primary me-2" /> Pond Feeding Status Table
            </h5>
            <p className="text-muted small mb-0">Compliance and feed rate targets for each monitored pond.</p>
          </div>
          <span className="badge bg-light text-muted border px-3 py-1.5 extra-small">
            {ponds.length > 0 ? `${ponds.length} Active Ponds` : 'Monitored Ponds'}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light rounded-3">
              <tr>
                <th className="border-0 ps-3">Pond Name</th>
                <th className="border-0">Daily Target</th>
                <th className="border-0">Actual Given</th>
                <th className="border-0">Compliance</th>
                <th className="border-0">Feeding Status</th>
                <th className="border-0 pe-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {ponds.length === 0 ? (
                [
                  { id: 1, name: 'Pond A1', target: '45.0 kg', actual: '45.0 kg', compliance: 100, status: 'Optimal' },
                  { id: 2, name: 'Pond A2', target: '50.0 kg', actual: '58.0 kg', compliance: 116, status: 'Overfeeding Warning' },
                  { id: 3, name: 'Pond B1', target: '40.0 kg', actual: '38.0 kg', compliance: 95, status: 'Optimal' },
                  { id: 4, name: 'Pond B2', target: '35.0 kg', actual: '28.0 kg', compliance: 80, status: 'Underfeeding Alert' },
                ].map((p) => (
                  <tr key={p.id} className="border-bottom">
                    <td className="ps-3 fw-bold text-dark">
                      <FaWater className="text-primary me-2" /> {p.name}
                    </td>
                    <td>{p.target}</td>
                    <td className="fw-semibold">{p.actual}</td>
                    <td style={{ width: 160 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: 6 }}>
                          <div
                            className={`progress-bar ${p.compliance > 110 ? 'bg-warning' : p.compliance < 90 ? 'bg-danger' : 'bg-success'}`}
                            style={{ width: `${Math.min(100, p.compliance)}%` }}
                          ></div>
                        </div>
                        <small className="extra-small font-mono fw-bold">{p.compliance}%</small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge rounded-pill px-3 py-1 extra-small fw-semibold ${
                          p.status.includes('Optimal')
                            ? 'bg-success bg-opacity-10 text-success'
                            : p.status.includes('Overfeeding')
                            ? 'bg-warning bg-opacity-10 text-warning'
                            : 'bg-danger bg-opacity-10 text-danger'
                        }`}
                      >
                        {p.status.includes('Optimal') && <FaCheckCircle className="me-1" />}
                        {p.status.includes('Warning') && <FaExclamationTriangle className="me-1" />}
                        {p.status.includes('Alert') && <FaExclamationTriangle className="me-1" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="pe-3 text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                        style={{ width: 34, height: 34 }}
                        onClick={() => handleViewPondLogs(p.name, p.id)}
                        title="View Logs"
                      >
                        <FaEye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                ponds.map((pond) => {
                  const pondRecords = records.filter(
                    (r) => String(r.pond_name || r.pond_id).toLowerCase() === String(pond.name || pond.id).toLowerCase()
                  );
                  const actualKg = pondRecords.reduce((sum, r) => sum + (Number(r.amount_kg) || 0), 0);
                  const targetKg = Number(pond.target_feed_kg) || 45;
                  const compliance = Math.round((actualKg / Math.max(1, targetKg)) * 100);

                  const status =
                    compliance > 110
                      ? 'Overfeeding Warning'
                      : compliance < 85
                      ? 'Underfeeding Alert'
                      : 'Optimal';

                  return (
                    <tr key={pond.id} className="border-bottom">
                      <td className="ps-3 fw-bold text-dark">
                        <FaWater className="text-primary me-2" /> {pond.pond_name || pond.name || `Pond A${pond.id}`}
                      </td>
                      <td>{targetKg.toFixed(1)} kg</td>
                      <td className="fw-semibold">{actualKg.toFixed(1)} kg</td>
                      <td style={{ width: 160 }}>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 6 }}>
                            <div
                              className={`progress-bar ${compliance > 110 ? 'bg-warning' : compliance < 85 ? 'bg-danger' : 'bg-success'}`}
                              style={{ width: `${Math.min(100, compliance)}%` }}
                            ></div>
                          </div>
                          <small className="extra-small font-mono fw-bold">{compliance}%</small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-3 py-1 extra-small fw-semibold ${
                            status.includes('Optimal')
                              ? 'bg-success bg-opacity-10 text-success'
                              : status.includes('Overfeeding')
                              ? 'bg-warning bg-opacity-10 text-warning'
                              : 'bg-danger bg-opacity-10 text-danger'
                          }`}
                        >
                          {status.includes('Optimal') && <FaCheckCircle className="me-1" />}
                          {status.includes('Warning') && <FaExclamationTriangle className="me-1" />}
                          {status.includes('Alert') && <FaExclamationTriangle className="me-1" />}
                          {status}
                        </span>
                      </td>
                      <td className="pe-3 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                          style={{ width: 34, height: 34 }}
                          onClick={() => handleViewPondLogs(pond.name || `Pond #${pond.id}`, pond.id)}
                          title="View Logs"
                        >
                          <FaEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. TODAY'S FEEDING RECORDS (FULL WIDTH) WITH SWAPPED SEARCH & FILTERS */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
              <div>
                <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                  <FaHistory className="text-primary" />
                  {dateFilter === 'today'
                    ? "Today's Feeding Records"
                    : dateFilter === 'yesterday'
                    ? "Yesterday's Feeding Records"
                    : dateFilter === 'week'
                    ? "This Week's Feeding Records"
                    : dateFilter === 'month'
                    ? "This Month's Feeding Records"
                    : dateFilter === 'custom' && customDate
                    ? `Feeding Records (${customDate})`
                    : 'All Feeding Records'}
                </h5>
                <p className="text-muted small mb-0">Detailed list of feed logs recorded by caretakers from MySQL database.</p>
              </div>

              {/* Swapped Controls: Search Input on Left, Date & Sort Filters on Right */}
              <div className="d-flex align-items-center flex-wrap gap-2">
                {/* 1. Search Input (Left Position) */}
                <div className="input-group input-group-sm style-search" style={{ width: 220 }}>
                  <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Search feeding logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* 2. Date Filter Dropdown */}
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ width: 140 }}
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    if (e.target.value !== 'custom') setCustomDate('');
                  }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Records</option>
                  <option value="custom">Custom Date...</option>
                </select>

                {/* Custom Date Input */}
                {dateFilter === 'custom' && (
                  <input
                    type="date"
                    className="form-control form-control-sm rounded-pill"
                    style={{ width: 140 }}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                )}

                {/* 3. Sort Dropdown */}
                <select
                  className="form-select form-select-sm rounded-pill"
                  style={{ width: 160 }}
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

            <div className="table-responsive" style={{ maxHeight: '520px', overflowY: 'auto', borderRadius: '0.75rem' }}>
              <table className="table align-middle mb-0">
                <thead className="table-light sticky-top shadow-xs" style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th>Date & Time</th>
                    <th>Pond</th>
                    <th>Feed Type</th>
                    <th>Amount</th>
                    <th>Vitamins Added</th>
                    <th>Recorded By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-muted">
                        Loading feeding logs...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-muted">
                        No feeding records found for the selected date filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="border-bottom">
                        <td>
                          <div className="fw-semibold text-dark">
                            {r.record_date || new Date(r.created_at || Date.now()).toLocaleDateString()}
                          </div>
                          <small className="badge bg-secondary bg-opacity-10 text-dark extra-small">
                            {r.feeding_time || '08:00 AM'}
                          </small>
                        </td>
                        <td>
                          <span className="badge bg-primary bg-opacity-10 text-primary fw-bold rounded-pill px-3 py-1">
                            <FaWater className="me-1" /> {r.pond_name || `Pond #${r.pond_id}`}
                          </span>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{r.feed_type || 'Tateh - Starter'}</div>
                        </td>
                        <td className="fw-bold text-success fs-6">{r.amount_kg} kg</td>
                        <td>
                          {r.vitamin_name && r.vitamin_name !== 'None' ? (
                            <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3 py-1 extra-small fw-semibold">
                              + {r.vitamin_name}
                            </span>
                          ) : (
                            <span className="text-muted extra-small">None</span>
                          )}
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{r.recorded_by_name || 'Caretaker'}</div>
                          <small className="text-muted extra-small">Field Staff</small>
                        </td>
                        <td>
                          <small className="text-secondary extra-small">{r.notes || 'Normal feeding session'}</small>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 6. ALERTS & NOTIFICATIONS (SPACIOUS PADDING & BEAUTIFUL CORNERS) */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
            <div className="mb-3.5">
              <h5 className="fw-bold text-dark mb-1">
                <FaExclamationTriangle className="text-warning me-2" /> Alerts & Notifications
              </h5>
              <p className="text-muted small mb-0">System notices regarding feeding schedules and inventory.</p>
            </div>

            <div className="row g-3.5">
              {/* Alert 1 */}
              <div className="col-12 col-md-4">
                <div
                  className="rounded-4 bg-warning bg-opacity-10 border border-warning border-opacity-25 h-100 shadow-xs"
                  style={{ padding: '1.4rem', borderRadius: '1.25rem' }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="rounded-circle p-1.5 bg-warning bg-opacity-20 d-flex align-items-center justify-content-center">
                      <FaExclamationTriangle className="text-warning" size={14} />
                    </div>
                    <span className="fw-bold text-dark fs-6">Pond A2 Overfeeding Notice</span>
                  </div>
                  <p className="text-secondary small mb-0" style={{ lineHeight: 1.65 }}>
                    Feed delivered exceeded target by 16%. Monitor dissolved oxygen levels in Pond A2 closely.
                  </p>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="col-12 col-md-4">
                <div
                  className="rounded-4 bg-success bg-opacity-10 border border-success border-opacity-25 h-100 shadow-xs"
                  style={{ padding: '1.4rem', borderRadius: '1.25rem' }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="rounded-circle p-1.5 bg-success bg-opacity-20 d-flex align-items-center justify-content-center">
                      <FaCheckCircle className="text-success" size={14} />
                    </div>
                    <span className="fw-bold text-dark fs-6">Pond A1 Schedule Completed</span>
                  </div>
                  <p className="text-secondary small mb-0" style={{ lineHeight: 1.65 }}>
                    Morning feeding session for Pond A1 finished with 100% target compliance.
                  </p>
                </div>
              </div>

              {/* Alert 3 */}
              <div className="col-12 col-md-4">
                <div
                  className="rounded-4 bg-info bg-opacity-10 border border-info border-opacity-25 h-100 shadow-xs"
                  style={{ padding: '1.4rem', borderRadius: '1.25rem' }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="rounded-circle p-1.5 bg-info bg-opacity-20 d-flex align-items-center justify-content-center">
                      <FaInfoCircle className="text-info" size={14} />
                    </div>
                    <span className="fw-bold text-dark fs-6">Feed Inventory Stock Alert</span>
                  </div>
                  <p className="text-secondary small mb-0" style={{ lineHeight: 1.65 }}>
                    Starter Feed #2 inventory level is sufficient for 5 days. Recommended re-order batch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
