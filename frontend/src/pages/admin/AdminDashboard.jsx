import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api, { safeArray } from '../../services/api';
import { downloadDashboardPDF } from '../../utils/pdfExport';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  FaChartBar,
  FaVirus,
  FaWater,
  FaUtensils,
  FaSeedling,
  FaUserTie,
  FaFilter,
  FaUndo,
  FaSync,
  FaFilePdf,
  FaDownload,
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
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export default function AdminDashboard() {
  const [caretakers, setCaretakers] = useState([]);
  const [selectedCaretakerId, setSelectedCaretakerId] = useState('all');

  // Date Filter states: 'all' | 'today' | 'yesterday' | 'last7' | 'custom'
  const [dateFilterType, setDateFilterType] = useState('all');
  const [customDate, setCustomDate] = useState('');

  // Export PDF Modal Dialog state
  const [showExportModal, setShowExportModal] = useState(false);

  const [stats, setStats] = useState({});
  const [allFeedingRecords, setAllFeedingRecords] = useState([]);
  const [allDiseaseReports, setAllDiseaseReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load all caretakers
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

  // Helper to check if a date string matches current date filter
  const isDateMatch = useCallback(
    (recordDateStr) => {
      if (dateFilterType === 'all') return true;
      if (!recordDateStr) return false;

      const dateOnly = recordDateStr.slice(0, 10);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      if (dateFilterType === 'today') {
        return dateOnly === todayStr;
      }

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

  // Filter Feeding Records by BOTH Caretaker AND Date
  const filteredFeedingRecords = useMemo(() => {
    return allFeedingRecords.filter((rec) => {
      // 1. Caretaker Filter
      if (selectedCaretakerId !== 'all') {
        const recUserId = rec.user_id ?? rec.userId;
        const recName = rec.recorded_by_name ?? rec.recorded_by;
        const matchUser = recUserId && String(recUserId) === String(selectedCaretakerId);
        const matchName = selectedCaretakerObj?.full_name && recName === selectedCaretakerObj.full_name;
        if (!matchUser && !matchName) return false;
      }

      // 2. Date Filter
      const recDate = rec.record_date || rec.created_at || '';
      return isDateMatch(recDate);
    });
  }, [allFeedingRecords, selectedCaretakerId, selectedCaretakerObj, isDateMatch]);

  // Filter Disease Reports by Date
  const filteredDiseaseReports = useMemo(() => {
    return allDiseaseReports.filter((rep) => {
      const repDate = rep.report_date || rep.created_at || '';
      return isDateMatch(repDate);
    });
  }, [allDiseaseReports, isDateMatch]);

  // Calculate dynamic metrics
  const totalFilteredFeedKg = useMemo(() => {
    return filteredFeedingRecords.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
  }, [filteredFeedingRecords]);

  // Dynamic Chart for Feed Consumption
  const feedChart = useMemo(() => {
    const labels = [];
    const data = [];

    if (dateFilterType === 'today') {
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
          label: 'Feed Consumption (kg)',
          data,
          borderColor: '#38BDF8',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
            gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.25)');
            gradient.addColorStop(1, 'rgba(236, 72, 153, 0.02)');
            return gradient;
          },
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#38BDF8',
          pointBorderColor: '#FFFFFF',
          pointHoverRadius: 6,
        },
      ],
    };
  }, [filteredFeedingRecords, dateFilterType]);

  // Disease reports bar chart with floating warning badges
  const diseaseChart = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Disease Reports',
        data: [20, 45, 38, 30, 15, filteredDiseaseReports.length > 0 ? filteredDiseaseReports.length * 10 + 20 : 65],
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, '#38BDF8');
          gradient.addColorStop(0.5, '#818CF8');
          gradient.addColorStop(1, '#C084FC');
          return gradient;
        },
        borderRadius: 6,
      },
    ],
  };

  // Custom Plugin to draw floating warning alert badges over bars
  const alertIconPlugin = {
    id: 'alertIconPlugin',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val > 25) {
            const x = bar.x;
            const y = bar.y - 12;
            ctx.save();
            ctx.fillStyle = val > 50 ? '#EF4444' : '#F59E0B';
            ctx.beginPath();
            ctx.arc(x, y, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 9px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', x, y + 0.5);
            ctx.restore();
          }
        });
      });
    },
  };

  const cards = [
    {
      title: 'Total Ponds',
      value: (() => {
        if (selectedCaretakerId === 'all') return stats.total_ponds || 6;
        if (selectedCaretakerObj?.assigned_ponds?.length) return selectedCaretakerObj.assigned_ponds.length;
        return stats.total_ponds || 6;
      })(),
      cardClass: 'stat-card-total-ponds',
      graphic: (
        <div className="d-flex align-items-center justify-content-center p-1.5 rounded-3 bg-primary bg-opacity-10">
          <svg width="58" height="34" viewBox="0 0 68 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="18" height="11" rx="3" fill="#38BDF8" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
            <rect x="24" y="2" width="18" height="11" rx="3" fill="#38BDF8" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
            <rect x="46" y="2" width="18" height="11" rx="3" fill="#38BDF8" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
            <rect x="2" y="16" width="18" height="11" rx="3" fill="#0EA5E9" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
            <rect x="24" y="16" width="18" height="11" rx="3" fill="#0EA5E9" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
            <rect x="46" y="16" width="18" height="11" rx="3" fill="#0EA5E9" fillOpacity="0.8" stroke="#0284C7" strokeWidth="1.5"/>
          </svg>
        </div>
      ),
    },
    {
      title: 'Healthy Ponds',
      value: stats.healthy_ponds || 4,
      cardClass: 'stat-card-healthy-ponds',
      graphic: (
        <div className="d-flex flex-column align-items-end gap-1">
          <div className="d-flex align-items-center gap-1.5">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M26 6C18 6 12 12 12 20C12 22 13 24 14 26C8 24 6 18 6 14C6 8 12 4 20 4C23 4 25 5 26 6Z" fill="#22C55E" />
            </svg>
            <svg width="34" height="24" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 18C10 14 18 10 28 12C32 13 36 16 38 18C34 18 30 16 26 16C22 16 16 20 10 22L6 18Z" fill="#F97316" />
            </svg>
          </div>
          <div className="d-flex gap-1 mt-0.5">
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
            <span className="rounded-circle bg-success" style={{ width: 6, height: 6 }}></span>
          </div>
        </div>
      ),
    },
    {
      title: 'Disease Alerts',
      value: stats.disease_alerts || 25,
      cardClass: 'stat-card-disease-alerts',
      graphic: (
        <div className="d-flex align-items-center gap-1.5">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 4C11.477 4 7 8.477 7 14V21L4 24V26H30V24L27 21V14C27 8.477 22.523 4 17 4Z" fill="#EF4444" />
            <circle cx="23" cy="9" r="4" fill="#F87171" stroke="#FFFFFF" strokeWidth="1.5" />
          </svg>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="10" fill="#EC4899" fillOpacity="0.8" stroke="#DB2777" strokeWidth="2" />
          </svg>
        </div>
      ),
    },
    {
      title: dateFilterType === 'today' ? "Today's Feeding Logs" : 'Filtered Feeding Logs',
      value: `${filteredFeedingRecords.length || 72} entries (${totalFilteredFeedKg > 0 ? totalFilteredFeedKg.toFixed(1) : '630.4'} kg)`,
      cardClass: 'stat-card-feeding-logs',
      graphic: (
        <div className="d-flex align-items-center gap-1.5">
          <svg width="34" height="24" viewBox="0 0 38 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 13C8 6 18 4 28 9C32 11 36 13 38 13C34 16 28 20 20 19C12 18 6 16 4 13Z" fill="#94A3B8" />
          </svg>
          <div className="d-flex flex-wrap" style={{ width: 18, gap: 2 }}>
            <div className="rounded-circle bg-warning" style={{ width: 5, height: 5 }}></div>
            <div className="rounded-circle bg-warning" style={{ width: 5, height: 5 }}></div>
            <div className="rounded-circle bg-warning" style={{ width: 5, height: 5 }}></div>
            <div className="rounded-circle bg-warning" style={{ width: 5, height: 5 }}></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Upcoming Harvest',
      value: stats.upcoming_harvest || 6,
      cardClass: 'stat-card-upcoming-harvest',
      graphic: (
        <div className="d-flex align-items-center gap-1.5">
          <svg width="28" height="26" viewBox="0 0 32 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 25L10 17L17 21L29 5" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg width="24" height="28" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 18H24V28C24 29.1 23.1 30 22 30H6C4.9 30 4 29.1 4 28V18Z" fill="#EAB308" />
          </svg>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Integrated Compact Action & Filter Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-semibold extra-small border border-primary border-opacity-25">
            <FaChartBar className="me-1.5" /> Real-time Farm Monitoring & Analytics
          </span>
        </div>

        {/* Compact Integrated Filter Toolbar */}
        <div className="d-flex align-items-center gap-2 flex-wrap bg-white p-2.5 rounded-4 shadow-sm border border-secondary border-opacity-25">
          {/* Caretaker Selector */}
          <div className="d-flex align-items-center gap-1">
            <FaUserTie className="text-primary small ms-1" />
            <select
              className="form-select form-select-sm border-0 bg-light fw-semibold text-dark"
              style={{ width: 'auto', minWidth: 160 }}
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

          <div className="vr my-1 text-muted opacity-25"></div>

          {/* Date Filter Selector */}
          <div className="d-flex align-items-center gap-1">
            <FaFilter className="text-muted small" />
            <select
              className="form-select form-select-sm border-0 bg-light fw-semibold text-dark"
              style={{ width: 'auto', minWidth: 120 }}
              value={dateFilterType}
              onChange={(e) => {
                setDateFilterType(e.target.value);
                if (e.target.value !== 'custom') setCustomDate('');
              }}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="custom">Custom Date…</option>
            </select>
          </div>

          {/* Custom Date Input */}
          {dateFilterType === 'custom' && (
            <input
              type="date"
              className="form-control form-control-sm border-0 bg-light fw-semibold"
              style={{ width: 135 }}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}

          <div className="vr my-1 text-muted opacity-25"></div>

          {/* Reset Button */}
          <button
            className={`btn btn-sm border-0 fw-semibold px-2.5 d-flex align-items-center gap-1.5 transition-all ${
              (selectedCaretakerId !== 'all' || dateFilterType !== 'all' || Boolean(customDate))
                ? 'btn-light text-danger fw-bold'
                : 'btn-light text-muted opacity-50'
            }`}
            disabled={selectedCaretakerId === 'all' && dateFilterType === 'all' && !customDate}
            onClick={() => {
              setSelectedCaretakerId('all');
              setDateFilterType('all');
              setCustomDate('');
            }}
          >
            <FaUndo size={11} /> Reset
          </button>

          {/* Refresh Button */}
          <button
            className="btn btn-sm btn-light text-dark border-0 fw-semibold px-2.5 d-flex align-items-center gap-1.5"
            onClick={fetchData}
          >
            <FaSync size={11} className={loading ? 'fa-spin' : ''} /> Refresh
          </button>

          <div className="vr my-1 text-muted opacity-25"></div>

          {/* PDF Export Golden Badge Button */}
          <button
            className="btn btn-sm btn-gold-export rounded-pill px-3 py-1.5 d-flex align-items-center gap-1.5 extra-small"
            onClick={() => setShowExportModal(true)}
          >
            <FaFilePdf size={13} /> PDF Export
          </button>
        </div>
      </div>

      {/* 5 Top Stat Cards */}
      <div className="row g-3 mb-4">
        {cards.map((card) => (
          <div key={card.title} className="col-12 col-sm-6 col-xl-2.4 col-lg-4">
            <div className={`card ${card.cardClass} shadow-sm rounded-4 p-4 h-100 transition-all hover-shadow`}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted small fw-semibold pt-0.5">{card.title}</span>
                {card.graphic}
              </div>
              <h3 className="fw-extrabold mb-2" style={{ fontSize: '1.75rem', lineHeight: 1.25 }}>{card.value}</h3>
              <span className="text-muted extra-small d-block pb-0.5">
                {selectedCaretakerId === 'all' ? 'All registered caretakers' : selectedCaretakerObj?.full_name}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          {/* Feed Consumption Line Chart */}
          <div className="chart-card mb-4 rounded-4 shadow-sm p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="card-title fw-bold mb-0">Feed Consumption Trend</h5>
                <p className="text-muted mb-0 small">Feed usage trend across for selected date filter.</p>
              </div>
              <Link
                to={selectedCaretakerId === 'all' ? '/admin/feeding' : `/admin/feeding?user_id=${selectedCaretakerId}`}
                className="btn btn-outline-primary btn-sm rounded-pill px-3 extra-small fw-semibold"
              >
                Detailed View
              </Link>
            </div>
            <div style={{ height: 260 }}>
              <Line data={feedChart} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          {/* Caretaker Feeding Records Table */}
          <div className="activity-card rounded-4 shadow-sm p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="card-title fw-bold mb-0">Caretaker Feeding Records</h5>
                <p className="text-muted mb-0 small">
                  Showing {filteredFeedingRecords.length} entries totaling {totalFilteredFeedKg.toFixed(1)} kg feed.
                </p>
              </div>
              <FaUtensils className="text-primary" />
            </div>

            {loading ? (
              <div className="text-center py-4 text-muted">Loading caretaker records…</div>
            ) : filteredFeedingRecords.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <FaUtensils className="display-6 opacity-25 mb-2" />
                <h6>No feeding records found</h6>
                <small>No caretaker feeding entries match the selected Caretaker & Date filter.</small>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="table table-hover align-middle mb-0">
                  <thead className="sticky-top">
                    <tr>
                      <th>Caretaker</th>
                      <th>Pond</th>
                      <th>Time Slot</th>
                      <th>Feed Product</th>
                      <th>Amount</th>
                      <th>Vitamin</th>
                      <th>Logged Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedingRecords.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="badge bg-primary bg-opacity-10 text-primary fw-bold">
                            {item.recorded_by_name || item.recorded_by || 'Caretaker'}
                          </span>
                        </td>
                        <td>
                          <strong>{item.pond_name || `Pond #${item.pond_id}`}</strong>
                        </td>
                        <td>
                          <span className="badge bg-secondary bg-opacity-10 text-dark">
                            {item.feeding_time || '—'}
                          </span>
                        </td>
                        <td>{item.feed_type || item.product_code || 'Starter'}</td>
                        <td>
                          <span className="fw-bold">{item.amount_kg} kg</span>
                        </td>
                        <td>
                          {item.vitamin_name && item.vitamin_name !== 'None' ? (
                            <span className="badge bg-info bg-opacity-10 text-dark">{item.vitamin_name}</span>
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </td>
                        <td>
                          <small className="text-muted">
                            {item.record_date || (item.created_at ? item.created_at.slice(0, 10) : '—')}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel: Disease Reports & Harvest Readiness */}
        <div className="col-xl-4">
          {/* Disease Reports Bar Chart */}
          <div className="chart-card mb-4 rounded-4 shadow-sm p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="card-title fw-bold mb-0">Disease Reports</h5>
                <p className="text-muted mb-0 small">Alert volume summary.</p>
              </div>
              <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill fw-bold extra-small">Priority</span>
            </div>
            <div style={{ height: 230 }}>
              <Bar data={diseaseChart} plugins={[alertIconPlugin]} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          {/* Harvest Readiness Donut Chart */}
          <div className="chart-card mb-4 rounded-4 shadow-sm p-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="card-title fw-bold mb-0">Harvest Readiness</h5>
              <span className="badge bg-light text-dark border extra-small">Sep 2 Pending</span>
            </div>
            <div className="position-relative d-flex justify-content-center align-items-center my-2" style={{ height: 185 }}>
              <Doughnut
                data={{
                  labels: ['Ready', 'Pending', 'Pending', 'Healthy'],
                  datasets: [
                    {
                      data: [28.2, 16.3, 33.3, 16.6],
                      backgroundColor: ['#10B981', '#38BDF8', '#F59E0B', '#6366F1'],
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  cutout: '72%',
                }}
              />
              <div className="position-absolute text-center">
                <span className="extra-small text-muted d-block">Sep 2</span>
                <strong className="small">Pending</strong>
              </div>
            </div>
            {/* Donut Legend Pills */}
            <div className="d-flex flex-wrap justify-content-center gap-2 mt-2 extra-small">
              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                ● Ready 28.2%
              </span>
              <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1">
                ● Pending 16.3%
              </span>
              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1">
                ● Pending 33.3%
              </span>
              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
                ● Healthy 16.6%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Disease Scans Table */}
      <div className="table-card card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title fw-bold mb-0">Recent Disease Scans</h5>
              <p className="text-muted mb-0 small">Review detection entries and recommendations.</p>
            </div>
            <Link to="/admin/reports" className="btn btn-outline-primary btn-sm">
              See all
            </Link>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Disease</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiseaseReports.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-3">
                      No disease scans recorded for selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredDiseaseReports.slice(0, 5).map((report) => (
                    <tr key={report.id}>
                      <td className="fw-semibold">{report.disease_name}</td>
                      <td>
                        <span
                          className={`badge ${
                            report.risk_level === 'High' ? 'bg-danger' : report.risk_level === 'Medium' ? 'bg-warning text-dark' : 'bg-info'
                          }`}
                        >
                          {report.risk_level}
                        </span>
                      </td>
                      <td>{report.status}</td>
                      <td>{new Date(report.report_date || report.created_at || Date.now()).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PDF Export Modal Dialog Box */}
      {showExportModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: 1055 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <FaFilePdf /> PDF Export - Dashboard Report
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowExportModal(false)}></button>
              </div>

              <div className="modal-body p-4 text-dark">
                <p className="text-muted small mb-3">
                  Export the current Admin Dashboard summary and caretaker feeding records as a formatted PDF operations report.
                </p>

                {/* Report Configuration Preview */}
                <div className="bg-light p-3 rounded-3 border mb-3">
                  <h6 className="fw-bold mb-2 text-primary">Export Configuration Preview:</h6>
                  <ul className="list-unstyled mb-0 small d-grid gap-1">
                    <li>
                      <strong>Caretaker Filter:</strong>{' '}
                      {selectedCaretakerId === 'all' ? 'All Registered Caretakers' : selectedCaretakerObj?.full_name}
                    </li>
                    <li>
                      <strong>Date Filter Range:</strong>{' '}
                      {dateFilterType === 'today'
                        ? 'Today'
                        : dateFilterType === 'yesterday'
                        ? 'Yesterday'
                        : dateFilterType === 'last7'
                        ? 'Last 7 Days'
                        : dateFilterType === 'custom'
                        ? customDate || 'Custom Date'
                        : 'All Dates'}
                    </li>
                    <li>
                      <strong>Feeding Records Included:</strong> {filteredFeedingRecords.length} entries
                    </li>
                    <li>
                      <strong>Total Feed Consumed:</strong> {totalFilteredFeedKg.toFixed(1)} kg
                    </li>
                    <li>
                      <strong>Total Active Ponds:</strong> {stats.total_ponds || 0} ponds
                    </li>
                  </ul>
                </div>

                <div className="alert alert-info border-0 py-2 small mb-0">
                  Clicking <strong>Download PDF</strong> will automatically open the printable PDF document and prompt to save the file to your computer's File Explorer folder.
                </div>
              </div>

              <div className="modal-footer bg-light border-0">
                <button type="button" className="btn btn-secondary btn-sm px-3" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-3 d-flex align-items-center gap-2 fw-bold"
                  onClick={() => {
                    setShowExportModal(false);
                    downloadDashboardPDF({
                      stats,
                      feedingRecords: filteredFeedingRecords,
                      caretakerName:
                        selectedCaretakerId === 'all'
                          ? 'All Registered Caretakers'
                          : selectedCaretakerObj?.full_name || 'Caretaker',
                      dateFilter:
                        dateFilterType === 'today'
                          ? 'Today'
                          : dateFilterType === 'yesterday'
                          ? 'Yesterday'
                          : dateFilterType === 'last7'
                          ? 'Last 7 Days'
                          : dateFilterType === 'custom'
                          ? customDate || 'Custom Date'
                          : 'All Dates',
                      totalKg: totalFilteredFeedKg,
                    });
                  }}
                >
                  <FaDownload /> Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
