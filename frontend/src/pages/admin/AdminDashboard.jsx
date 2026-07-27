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
          borderColor: '#0B2C5F',
          backgroundColor: 'rgba(11,44,95,0.12)',
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [filteredFeedingRecords, dateFilterType]);

  // Disease reports bar chart
  const diseaseChart = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{ label: 'Disease Reports', data: [2, 1, 3, 2, 4, filteredDiseaseReports.length], backgroundColor: '#FF7A00' }],
  };

  const cards = [
    {
      title: 'Total Ponds',
      value: (() => {
        if (selectedCaretakerId === 'all') return stats.total_ponds || 0;
        if (selectedCaretakerObj?.assigned_ponds?.length) return selectedCaretakerObj.assigned_ponds.length;
        return stats.total_ponds || 0;
      })(),
      icon: <FaWater />,
      theme: 'primary',
      borderClass: 'border-primary border-opacity-25',
      bgGradient: 'linear-gradient(180deg, rgba(13, 110, 253, 0.03) 0%, #ffffff 100%)',
    },
    {
      title: 'Healthy Ponds',
      value: stats.healthy_ponds || 0,
      icon: <FaSeedling />,
      theme: 'success',
      borderClass: 'border-success border-opacity-25',
      bgGradient: 'linear-gradient(180deg, rgba(25, 135, 84, 0.03) 0%, #ffffff 100%)',
    },
    {
      title: 'Disease Alerts',
      value: stats.disease_alerts || 0,
      icon: <FaVirus />,
      theme: 'danger',
      borderClass: 'border-danger border-opacity-25',
      bgGradient: 'linear-gradient(180deg, rgba(220, 53, 69, 0.03) 0%, #ffffff 100%)',
    },
    {
      title: dateFilterType === 'today' ? "Today's Feeding Logs" : 'Filtered Feeding Logs',
      value: `${filteredFeedingRecords.length} entries (${totalFilteredFeedKg.toFixed(1)} kg)`,
      icon: <FaUtensils />,
      theme: 'info',
      borderClass: 'border-info border-opacity-25',
      bgGradient: 'linear-gradient(180deg, rgba(13, 202, 240, 0.03) 0%, #ffffff 100%)',
    },
    {
      title: 'Upcoming Harvest',
      value: stats.upcoming_harvest || 0,
      icon: <FaChartBar />,
      theme: 'warning',
      borderClass: 'border-warning border-opacity-50',
      bgGradient: 'linear-gradient(180deg, rgba(255, 193, 7, 0.03) 0%, #ffffff 100%)',
    },
  ];

  return (
    <div>
      {/* Integrated Compact Action & Filter Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold extra-small">
            <FaChartBar className="me-1" /> Real-time Farm Monitoring & Analytics
          </span>
        </div>

        {/* Compact Integrated Filter Toolbar (Right Aligned) */}
        <div className="d-flex align-items-center gap-2 flex-wrap bg-white p-2.5 rounded-4 shadow-sm border border-secondary border-opacity-25">
          {/* Caretaker Selector */}
          <div className="d-flex align-items-center gap-1">
            <FaUserTie className="text-primary small ms-1" />
            <select
              className="form-select form-select-sm border-0 bg-light fw-semibold text-dark"
              style={{ width: 'auto', minWidth: 170 }}
              value={selectedCaretakerId}
              onChange={(e) => setSelectedCaretakerId(e.target.value)}
            >
              <option value="all">All Caretakers ({caretakers.length})</option>
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
              style={{ width: 'auto', minWidth: 130 }}
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

          {/* Reset & Refresh Toolbar Buttons */}
          <div className="vr my-1 text-muted opacity-25"></div>

          {/* Reset Button (Fixed Position, Faded/Disabled when no active filters) */}
          <button
            className={`btn btn-sm border-0 fw-semibold px-2.5 d-flex align-items-center gap-1.5 transition-all ${
              (selectedCaretakerId !== 'all' || dateFilterType !== 'all' || Boolean(customDate))
                ? 'btn-light text-danger fw-bold'
                : 'btn-light text-muted opacity-50'
            }`}
            disabled={selectedCaretakerId === 'all' && dateFilterType === 'all' && !customDate}
            style={{
              cursor: (selectedCaretakerId !== 'all' || dateFilterType !== 'all' || Boolean(customDate)) ? 'pointer' : 'not-allowed'
            }}
            onClick={() => {
              setSelectedCaretakerId('all');
              setDateFilterType('all');
              setCustomDate('');
            }}
            title={(selectedCaretakerId !== 'all' || dateFilterType !== 'all' || Boolean(customDate)) ? 'Reset Filters' : 'No active filters to reset'}
          >
            <FaUndo /> Reset
          </button>

          {/* Refresh Button (Matching Design) */}
          <button
            className="btn btn-sm btn-light text-dark border-0 fw-semibold px-2.5 d-flex align-items-center gap-1.5"
            onClick={fetchData}
            title="Refresh Data"
          >
            <FaSync className={loading ? 'fa-spin' : ''} /> Refresh
          </button>

          <div className="vr my-1 text-muted opacity-25"></div>

          {/* PDF Export Button */}
          <button
            className="btn btn-sm btn-danger border-0 fw-semibold px-2.5 d-flex align-items-center gap-1.5"
            onClick={() => setShowExportModal(true)}
            title="PDF Export"
          >
            <FaFilePdf /> PDF Export
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="row g-3 mb-4">
        {cards.map((card) => (
          <div key={card.title} className="col-12 col-sm-6 col-xl-2.4 col-lg-4">
            <div
              className={`card border ${card.borderClass} shadow-sm rounded-4 p-4 h-100 position-relative overflow-hidden transition-all hover-shadow`}
              style={{ background: card.bgGradient }}
            >
              <div className={`position-absolute top-0 start-0 end-0 bg-${card.theme}`} style={{ height: 4 }} />
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted small fw-semibold">{card.title}</span>
                <div className={`rounded-3 p-2.5 bg-${card.theme} bg-opacity-10 text-${card.theme} fs-5`}>
                  {card.icon}
                </div>
              </div>
              <h3 className="fw-extrabold text-dark mb-2">{card.value}</h3>
              <span className="text-muted extra-small">
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
          <div className="chart-card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title fw-bold">Feed Consumption Trend</h5>
                  <p className="text-muted mb-0 small">
                    {selectedCaretakerId === 'all'
                      ? 'Feed usage trend across all ponds for selected date filter.'
                      : `Feed usage logged by ${selectedCaretakerObj?.full_name}.`}
                  </p>
                </div>
                <Link
                  to={selectedCaretakerId === 'all' ? '/admin/feeding' : `/admin/feeding?user_id=${selectedCaretakerId}`}
                  className="btn btn-outline-primary btn-sm"
                >
                  Detailed View
                </Link>
              </div>
              <Line data={feedChart} />
            </div>
          </div>

          {/* Filtered Caretaker Feeding Records Table */}
          <div className="activity-card">
            <div className="card-body">
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
                <div className="table-responsive" style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light sticky-top">
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
        </div>

        {/* Side Panel: Disease Reports & Harvest Readiness */}
        <div className="col-xl-4">
          <div className="chart-card mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="card-title fw-bold">Disease Reports</h5>
                  <p className="text-muted mb-0 small">Alert volume summary.</p>
                </div>
                <span className="badge bg-warning text-dark">Priority</span>
              </div>
              <Bar data={diseaseChart} />
            </div>
          </div>

          <div className="chart-card mb-4">
            <div className="card-body">
              <h5 className="card-title fw-bold mb-3">Harvest Readiness</h5>
              <Doughnut
                data={{
                  labels: ['Ready', 'Pending'],
                  datasets: [{ data: [68, 32], backgroundColor: ['#1FB567', '#EAF4FF'] }],
                }}
              />
              <p className="text-muted mt-3 mb-0 small text-center">Projected readiness for next 30 days.</p>
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
