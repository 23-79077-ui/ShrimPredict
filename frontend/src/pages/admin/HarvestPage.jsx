import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  FaCalendarAlt,
  FaChartLine,
  FaExclamationTriangle,
  FaSeedling,
  FaWeightHanging,
  FaFileCsv,
  FaSync,
  FaWater
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import AdminFilterToolbar from '../../components/AdminFilterToolbar';
import { useLanguage } from '../../context/LanguageContext';

const formatKg = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
const formatTons = (value = 0) => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons`;
const formatPct = (value = 0) => `${Number(value || 0).toFixed(2)}%`;

export default function HarvestPage() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCaretaker, setSelectedCaretaker] = useState('all');
  const [selectedPond, setSelectedPond] = useState('all');
  const [activeChartTab, setActiveChartTab] = useState('feedVsHarvest'); // 'feedVsHarvest' | 'progressTrend'

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCaretaker !== 'all') params.caretaker_id = selectedCaretaker;
      if (selectedPond !== 'all') params.pond_id = selectedPond;
      const res = await api.get('/harvest_predictions.php', { params });
      setData(res.data || {});
    } catch (error) {
      setData({ predictions: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCaretaker, selectedPond]);

  const predictions = safeArray(data?.predictions);
  const caretakers = safeArray(data?.caretakers);
  const pondsList = safeArray(data?.ponds);
  const summary = data?.summary || {};
  const feedReferenceKg = data?.feed_reference_kg || summary.feed_reference_kg || 15000;
  const baselineHarvestTons = data?.target_harvest_tons || summary.target_harvest_tons_per_pond || 11;

  const feedVsHarvestData = useMemo(() => ({
    labels: predictions.map((item) => item.pond_name || `Pond ${item.pond_id}`),
    datasets: [
      {
        label: t('Feed Consumed (kg)'),
        data: predictions.map((item) => Number(item.total_feed_consumed_kg || 0)),
        backgroundColor: '#FC563C',
        borderRadius: 6,
      },
      {
        label: t('Adjusted Harvest Est. (kg)'),
        data: predictions.map((item) => Number(item.adjusted_harvest_kg || 0)),
        backgroundColor: '#FC563C',
        borderRadius: 6,
      },
    ],
  }), [predictions, t]);

  const progressData = useMemo(() => ({
    labels: predictions.map((item) => item.pond_name || `Pond ${item.pond_id}`),
    datasets: [
      {
        label: t('Feed Progress Toward Historical Baseline (%)'),
        data: predictions.map((item) => Number(item.feed_progress_percentage || 0)),
        borderColor: '#FC563C',
        backgroundColor: 'rgba(252, 86, 60, 0.12)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#FC563C',
        pointBorderColor: '#FFFFFF',
        pointRadius: 4,
      },
    ],
  }), [predictions, t]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (predictions.length === 0) return;
    const headers = ['Pond,Caretaker,Total Feed (kg),ABW (g),Target Yield (kg),Estimated Harvest (kg),Est Tons,Progress (%),Readiness\n'];
    const rows = predictions.map(
      (p) =>
        `"${p.pond_name || `Pond ${p.pond_id}`}","${p.caretaker_names || 'N/A'}",${p.total_feed_consumed_kg || 0},${p.average_weight || 0},${p.baseline_harvest_kg || 0},${p.adjusted_harvest_kg || 0},${p.predicted_harvest_tons || 0},${p.feed_progress_percentage || 0},"${p.readiness_status || ''}"`
    );
    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShrimpPredict_Harvest_Model_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 1. TITLE HEADER ROW */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 mb-3">
        <div className="d-flex align-items-center gap-2.5">
          <h3 className="fw-extrabold mb-0 tracking-tight text-dark" style={{ fontSize: '1.48rem', letterSpacing: '-0.02em' }}>
            {t('Harvest Forecast & Yield Estimates')}
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
            {t('• Operational Model')}
          </span>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm minimal-filter-control d-inline-flex align-items-center gap-1.5 px-3 py-2 shadow-2xs hover-shadow"
            onClick={loadData}
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

      {/* 2. 4 OPERATIONAL KPI CARDS */}
      <div className="row g-3 g-xl-4 mb-4">
        {/* Card 1: Predicted Harvest */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Predicted Yield Mass')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaWeightHanging size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(summary.adjusted_harvest_kg)}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Commercial Yield')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {formatTons(summary.predicted_harvest_tons)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Feed Consumed */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Total Feed Consumed')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#FFF7ED', color: '#FC563C' }}>
                  <FaSeedling size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(summary.total_feed_consumed_kg)}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Caretaker Field Logs')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', fontWeight: 600 }}>
                  {t('Cumulative Cycle')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Average Feed Progress */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Historical Progress')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaChartLine size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatPct(summary.average_feed_progress_percentage)}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Target Completion')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  {t('15,000 kg Benchmark')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Historical Baseline */}
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="shrimp-kpi-card">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-secondary extra-small fw-bold text-uppercase tracking-wider">
                  {t('Average Per Pond')}
                </span>
                <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, backgroundColor: '#F1F5F9', color: '#172A39' }}>
                  <FaCalendarAlt size={15} />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ fontSize: '2.1rem', letterSpacing: '-0.03em' }}>
                {formatKg(feedReferenceKg)}
              </h2>
            </div>
            <div className="pt-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                <span className="text-secondary small fw-medium">
                  {t('Standard Target')}
                </span>
                <span className="badge rounded-pill px-2.5 py-1 extra-small" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                  ~{baselineHarvestTons} {t('Tons Target')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Disclaimer Alert */}
      <div
        className="p-3 mb-4 rounded-4 d-flex align-items-start gap-3 bg-white border shadow-2xs"
        style={{ borderColor: '#E2E8F0', borderLeft: '4px solid #FC563C' }}
      >
        <div className="rounded-circle p-2 flex-shrink-0" style={{ backgroundColor: '#FFF7ED', color: '#FC563C' }}>
          <FaExclamationTriangle size={15} />
        </div>
        <div>
          <strong className="text-dark" style={{ fontSize: '0.9rem' }}>
            {data?.method ? t(data.method) : t('Caretaker Historical Feed-to-Harvest Baseline Model')}
          </strong>
          <div className="text-secondary extra-small mt-0.5">
            {t('Historical baseline: caretakers reported that')} {formatKg(feedReferenceKg)} {t('feed per pond usually yields around')} {formatTons(baselineHarvestTons)} {t('harvest.')}
            {' '}{data?.disclaimer ? t(data.disclaimer) : t('Harvest readiness is an operational estimate and must be confirmed by farm management.')}
          </div>
        </div>
      </div>

      {/* 3. UNIFIED HARVEST & FEED ANALYTICS (Toggleable between Estimate and Historical Trend) */}
      <div className="bg-white border rounded-4 p-4 mb-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight">
              {activeChartTab === 'feedVsHarvest' ? t('Feed-To-Harvest Estimate By Pond') : t('Past Feed Progress Trend')}
            </h5>
            <p className="text-secondary mb-0 small" style={{ fontSize: '0.82rem' }}>
              {activeChartTab === 'feedVsHarvest'
                ? t('Comparison between total feed given vs expected shrimp harvest weight (kg).')
                : t('Progress toward the 15,000 kg farm harvest goal.')}
            </p>
          </div>

          {/* Toggle Pills */}
          <div className="d-inline-flex p-1 rounded-pill bg-light border" style={{ borderColor: '#E2E8F0' }}>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'feedVsHarvest' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'feedVsHarvest' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('feedVsHarvest')}
            >
              <FaWeightHanging size={11} className="me-1.5" />
              {t('Feed-To-Harvest Estimate')}
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all ${
                activeChartTab === 'progressTrend' ? 'bg-white text-dark shadow-2xs border' : 'btn-link text-secondary text-decoration-none'
              }`}
              style={{ fontSize: '0.78rem', borderColor: activeChartTab === 'progressTrend' ? '#E2E8F0' : 'transparent' }}
              onClick={() => setActiveChartTab('progressTrend')}
            >
              <FaChartLine size={11} className="me-1.5" />
              {t('Historical Progress Trend')}
            </button>
          </div>
        </div>

        {activeChartTab === 'feedVsHarvest' ? (
          <div style={{ minHeight: 290, height: 300 }}>
            <Bar
              data={feedVsHarvestData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { family: "'Poppins', sans-serif", weight: '600', size: 11 } } } },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: 'rgba(252, 86, 60, 0.06)' } }
                }
              }}
            />
          </div>
        ) : (
          <div style={{ minHeight: 290, height: 300 }}>
            <Line
              data={progressData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { family: "'Poppins', sans-serif", weight: '600', size: 11 } } } },
                scales: {
                  x: { grid: { display: false } },
                  y: { max: 100, grid: { color: 'rgba(252, 86, 60, 0.06)' } }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 4. PREDICTION TABLE & INTEGRATED FILTER TOOLBAR */}
      <div className="bg-white border rounded-4 p-4 shadow-2xs" style={{ borderColor: '#E2E8F0' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: '#E2E8F0' }}>
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight d-flex align-items-center gap-2">
              <FaWater style={{ color: '#FC563C' }} /> {t('Pond Harvest Readiness & Sampling')}
            </h5>
            <p className="text-secondary mb-0 small" style={{ fontSize: '0.82rem' }}>
              {t('Showing')} {predictions.length} {t('active pond predictions based on feeding and growth logs.')}
            </p>
          </div>
        </div>

        {/* Integrated Filter Toolbar with Distinct Border */}
        <AdminFilterToolbar
          className="admin-search-section-box admin-filter-card"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('Search harvest prediction, pond, caretaker...')}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onRefresh={() => {
            setSelectedCaretaker('all');
            setSelectedPond('all');
            loadData();
          }}
          loading={loading}
          tabs={[{ id: 'all', label: t('All Predictions'), count: predictions.length }]}
          activeTab="all"
          metaRight={
            <>
              {t('Harvest Model:')} <strong>{t('Feed-to-Harvest Baseline Intelligence')}</strong>
            </>
          }
          filterFields={[
            {
              label: t('Pond'),
              type: 'select',
              value: selectedPond,
              onChange: setSelectedPond,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Ponds') },
                ...pondsList.map((p) => ({ value: p.id, label: p.pond_name }))
              ]
            },
            {
              label: t('Assigned Caretaker'),
              type: 'select',
              value: selectedCaretaker,
              onChange: setSelectedCaretaker,
              colClass: 'col-12 col-md-4',
              options: [
                { value: 'all', label: t('All Caretakers') },
                ...caretakers.map((c) => ({ value: c.id, label: c.full_name || `Caretaker ${c.id}` }))
              ]
            }
          ]}
          onResetFilters={() => {
            setSearchQuery('');
            setSelectedPond('all');
            setSelectedCaretaker('all');
          }}
        />

        {loading ? (
          <div className="text-center py-5 text-muted">
            <div className="spinner-border" style={{ color: '#FC563C' }} role="status" />
            <p className="mt-2 mb-0 extra-small fw-semibold">{t('Loading harvest forecast...')}</p>
          </div>
        ) : (
          <div className="table-responsive admin-scrollable-table-4rows rounded-3 border" style={{ maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', borderColor: '#E2E8F0' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.80rem', tableLayout: 'fixed', width: '100%' }}>
              <thead className="table-light border-bottom sticky-top" style={{ borderColor: '#E2E8F0' }}>
                <tr className="text-secondary extra-small text-uppercase fw-bold" style={{ letterSpacing: '0.03em' }}>
                  <th className="ps-3 py-2.5" style={{ width: '9%' }}>{t('Pond')}</th>
                  <th className="py-2.5" style={{ width: '12%' }}>{t('Caretaker')}</th>
                  <th className="py-2.5" style={{ width: '10%' }}>{t('Feed Used')}</th>
                  <th className="py-2.5" style={{ width: '9%' }}>{t('ABW')}</th>
                  <th className="py-2.5" style={{ width: '10%' }}>{t('Target Yield')}</th>
                  <th className="py-2.5" style={{ width: '12%' }}>{t('Est. Harvest')}</th>
                  <th className="py-2.5" style={{ width: '15%' }}>{t('Cycle Progress')}</th>
                  <th className="py-2.5" style={{ width: '10%' }}>{t('Readiness')}</th>
                  <th className="pe-3 py-2.5 text-end" style={{ width: '13%' }}>{t('Calculated')}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = predictions.filter((item) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return (
                      String(item.pond_name || '').toLowerCase().includes(q) ||
                      String(item.caretaker_names || '').toLowerCase().includes(q) ||
                      String(item.readiness_status || '').toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan="9" className="text-muted text-center py-5">
                          {t('No pond harvest predictions match the search query or filters.')}
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((item) => (
                    <tr key={item.pond_id}>
                      <td className="ps-3 py-2.5">
                        <span
                          className="badge rounded-pill fw-bold px-2 py-1 d-inline-flex align-items-center gap-1 text-truncate"
                          style={{ background: 'rgba(252, 86, 60, 0.08)', color: '#FC563C', border: '1px solid rgba(252, 86, 60, 0.16)', fontSize: '0.78rem', maxWidth: '100%' }}
                          title={item.pond_name || `Pond ${item.pond_id}`}
                        >
                          <FaWater size={9} /> {item.pond_name || `Pond ${item.pond_id}`}
                        </span>
                      </td>
                      <td className="small text-truncate py-2.5" style={{ fontSize: '0.78rem' }} title={item.caretaker_names || t('Caretaker account')}>
                        {item.caretaker_names || t('Caretaker account')}
                      </td>
                      <td className="py-2.5">
                        <span className="fw-bold" style={{ color: '#FC563C', fontSize: '0.82rem' }}>{formatKg(item.total_feed_consumed_kg)}</span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className="badge rounded-pill extra-small px-2 py-0.5 fw-bold"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: '0.74rem' }}
                        >
                          {Number(item.average_weight || 0) > 0 ? `${Number(item.average_weight).toFixed(1)} g` : '—'}
                        </span>
                      </td>
                      <td className="small text-secondary py-2.5" style={{ fontSize: '0.82rem' }}>{formatKg(item.baseline_harvest_kg)}</td>
                      <td className="py-2.5">
                        <span className="fw-bolder text-dark d-block" style={{ fontSize: '0.86rem' }}>{formatKg(item.adjusted_harvest_kg)}</span>
                        <div className="mt-1">
                          <span
                            className="badge rounded-pill fw-bold font-mono px-2 py-0.5 d-inline-flex align-items-center gap-1 shadow-2xs"
                            style={{
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              fontSize: '0.70rem'
                            }}
                            title={`${formatTons(item.predicted_harvest_tons)} predicted harvest`}
                          >
                            <FaWeightHanging size={8} /> {formatTons(item.predicted_harvest_tons)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="d-flex justify-content-between extra-small mb-1 font-mono" style={{ fontSize: '0.72rem' }}>
                          <span className="fw-bold" style={{ color: '#FC563C' }}>{formatPct(item.feed_progress_percentage)}</span>
                          <span className="text-muted">{formatKg(item.remaining_feed_kg)} {t('left')}</span>
                        </div>
                        <div className="tri-progress-track" style={{ height: 5 }}>
                          <div
                            className="tri-progress-bar"
                            style={{
                              width: `${Math.min(100, item.feed_progress_visual_percentage || 0)}%`,
                              background: 'linear-gradient(90deg, #FC563C, #F97316)'
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className="badge rounded-pill extra-small px-2 py-0.5 fw-bold text-truncate d-inline-block"
                          style={{
                            maxWidth: '100%',
                            fontSize: '0.72rem',
                            backgroundColor: String(item.readiness_status || '').toLowerCase().includes('ready') ? '#F0FDF4' : 'rgba(252, 86, 60, 0.08)',
                            color: String(item.readiness_status || '').toLowerCase().includes('ready') ? '#16A34A' : '#FC563C',
                            border: '1px solid rgba(252, 86, 60, 0.12)'
                          }}
                        >
                          {t(item.readiness_status)}
                        </span>
                      </td>
                      <td className="pe-3 py-2.5 text-end">
                        <div className="d-flex flex-column align-items-end" style={{ lineHeight: 1.25 }}>
                          <span className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.74rem' }}>
                            {String(item.calculated_at || '').split(' ')[0]}
                          </span>
                          <span className="extra-small text-muted font-mono text-truncate" style={{ fontSize: '0.68rem' }}>
                            {String(item.calculated_at || '').split(' ').slice(1).join(' ')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
