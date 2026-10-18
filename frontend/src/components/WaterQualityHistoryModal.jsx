import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FaHistory,
  FaTimes,
  FaCalendarAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaSync,
  FaWater,
  FaSearch,
  FaFileAlt,
  FaMicrochip,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCalendarDay
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../services/api';

function computeDoc(stockingDateStr, targetDateStr) {
  if (!stockingDateStr) return null;
  const s = new Date(stockingDateStr + 'T00:00:00');
  const t = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date();
  if (isNaN(s.getTime()) || isNaN(t.getTime())) return null;
  const diffTime = t.getTime() - s.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays >= 1 ? diffDays : null;
}

export default function WaterQualityHistoryModal({
  isOpen,
  onClose,
  pond,
  canEdit = true,
  onEditRecord = () => {},
  onAddRecord = () => {},
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [proofModalImage, setProofModalImage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const pondId = pond?.id;
  const pondName = pond?.pond_name || `Pond #${pondId || ''}`;

  const loadHistory = useCallback(async () => {
    if (!pondId) return;
    setLoading(true);
    try {
      const res = await api.get('/water_quality_records.php', {
        params: {
          pond_id: pondId,
          all: 1,
        },
      });

      if (res.data?.success && Array.isArray(res.data.records)) {
        setRecords(res.data.records);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error('Error fetching water quality history:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    if (isOpen && pondId) {
      loadHistory();
    } else {
      setSearchTerm('');
      setProofModalImage(null);
    }
  }, [isOpen, pondId, loadHistory]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) => {
      const dateMatch = r.record_date?.toLowerCase().includes(term);
      const nameMatch = r.recorded_by_name?.toLowerCase().includes(term);
      const modeMatch = r.capture_mode?.toLowerCase().includes(term);
      const notesMatch = r.notes?.toLowerCase().includes(term);
      return dateMatch || nameMatch || modeMatch || notesMatch;
    });
  }, [records, searchTerm]);

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: 'Delete Water Quality Record?',
      html: `Are you sure you want to delete the log for <strong>${record.record_date}</strong> (DO: ${record.dissolved_oxygen} mg/L, Temp: ${record.temperature}°C)? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(record.id);
      const res = await api.delete('/water_quality_records.php', {
        params: { id: record.id },
      });

      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Record Deleted',
          text: 'The water quality log has been removed.',
          timer: 1500,
          showConfirmButton: false,
        });
        loadHistory();
        window.dispatchEvent(
          new CustomEvent('shrim-water-quality-updated', {
            detail: { pond_id: pondId, deleted_id: record.id },
          })
        );
      } else {
        Swal.fire('Error', res.data?.message || 'Failed to delete record', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      Swal.fire('Error', err.response?.data?.message || err.message || 'Failed to delete record', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(7, 23, 51, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1065 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable scan-report-modal-dialog">
        <div className="modal-content border-0 rounded-4 shadow-2xl overflow-hidden bg-white">
          {/* Header */}
          <div
            className="p-3.5 px-4 text-white d-flex justify-content-between align-items-start gap-2 position-relative"
            style={{ background: 'linear-gradient(135deg, #172A39 0%, #FC563C 60%, #0E3D7D 100%)' }}
          >
            <div className="d-flex align-items-start gap-2.5 gap-sm-3 min-w-0" style={{ paddingRight: '40px' }}>
              <div
                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm mt-0.5"
                style={{
                  width: 38,
                  height: 38,
                  background: 'linear-gradient(135deg, #FC563C 0%, #E03E26 100%)',
                  color: '#FFFFFF',
                  fontSize: '1.1rem',
                }}
              >
                <FaHistory />
              </div>
              <div className="min-w-0">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h5 className="fw-extrabold mb-0 text-white tracking-tight" style={{ fontSize: '1.08rem' }}>
                    Water Quality Records &amp; Past Logs
                  </h5>
                  <span className="badge bg-info bg-opacity-25 text-white border border-info border-opacity-50 rounded-pill extra-small">
                    {pondName}
                  </span>
                </div>
                <p className="mb-0 text-white text-opacity-70 small mt-0.5" style={{ fontSize: '0.78rem' }}>
                  Review, edit past paper logsheets, and add missed water quality records.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-light rounded-circle p-1.5 d-flex align-items-center justify-content-center position-absolute top-0 end-0 m-3"
              style={{ width: 30, height: 30, zIndex: 10 }}
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes size={12} />
            </button>
          </div>

          {/* Action Bar / Search Strip */}
          <div className="p-3 border-bottom bg-light d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-between gap-2.5">
            {canEdit && (
              <button
                type="button"
                className="btn btn-sm btn-warning fw-bold rounded-pill px-3 py-1.5 shadow-xs d-flex align-items-center justify-content-center gap-1.5 text-dark w-100 w-sm-auto"
                onClick={() => {
                  onAddRecord(new Date().toISOString().split('T')[0]);
                }}
              >
                <FaPlus size={11} /> Backfill / Log Past Date
              </button>
            )}

            <div className="d-flex align-items-center gap-2 flex-grow-1 w-100" style={{ maxWidth: 420 }}>
              <div className="input-group input-group-sm w-100">
                <span className="input-group-text bg-white text-muted border-end-0">
                  <FaSearch size={12} />
                </span>
                <input
                  type="text"
                  className="form-control form-control-sm border-start-0 bg-white"
                  placeholder="Filter by date, caretaker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary bg-white"
                    onClick={() => setSearchTerm('')}
                  >
                    <FaTimes size={10} />
                  </button>
                )}
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between justify-content-sm-end gap-2 w-100 w-sm-auto">
              <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2.5 py-1 extra-small fw-bold">
                {records.length} Total Record{records.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-2.5 py-1 extra-small fw-bold d-flex align-items-center gap-1"
                onClick={loadHistory}
                disabled={loading}
              >
                <FaSync size={10} className={loading ? 'fa-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Table / Log List */}
          <div className="modal-body p-3 p-lg-4" style={{ backgroundColor: '#E9E4E0', maxHeight: '68vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted small mt-2 mb-0">Loading past water quality records for {pondName}...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-5 bg-white rounded-4 border p-4">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: 56, height: 56, background: '#E0F2FE', color: '#FC563C', fontSize: '1.5rem' }}
                >
                  <FaWater />
                </div>
                <h6 className="fw-bold text-dark mb-1">
                  {records.length === 0
                    ? `No Water Quality Records Yet for ${pondName}`
                    : 'No Records Match Your Search'}
                </h6>
                <p className="text-muted small mb-3" style={{ maxWidth: 460, margin: '0 auto' }}>
                  {records.length === 0
                    ? 'Start backfilling previous farm logsheets or scan physical paper sheets to establish an accurate culture history.'
                    : 'Try clearing the search filter to display all historical logs.'}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
                    onClick={() => onAddRecord(new Date().toISOString().split('T')[0])}
                  >
                    <FaPlus size={12} /> Backfill Physical Farm Logsheet
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive bg-white rounded-4 border shadow-xs admin-scrollable-table-4rows" style={{ maxHeight: 290, overflowY: 'auto', border: '1.5px solid #CBD5E1' }}>
                <table className="table table-hover align-middle mb-0">
                  <thead className="shadow-xs" style={{ backgroundColor: '#FC563C', color: '#FFFFFF' }}>
                    <tr className="extra-small text-uppercase tracking-wider">
                      <th className="py-3 px-3">Record Date / Age</th>
                      <th className="py-3 px-2 text-center">DO (mg/L)</th>
                      <th className="py-3 px-2 text-center">Temp (°C)</th>
                      <th className="py-3 px-2 text-center">pH Balance</th>
                      <th className="py-3 px-2 text-center">Salinity (ppt)</th>
                      <th className="py-3 px-2 text-center">Status</th>
                      <th className="py-3 px-2 text-center">Capture Mode</th>
                      <th className="py-3 px-2">Recorded By</th>
                      <th className="py-3 px-2 text-center">Photo Proof</th>
                      {canEdit && <th className="py-3 px-3 text-end">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => {
                      const doc = computeDoc(pond?.stocking_date, r.record_date);
                      const isToday = r.record_date === new Date().toISOString().split('T')[0];
                      const doNum = parseFloat(r.dissolved_oxygen);
                      const tempNum = parseFloat(r.temperature);
                      const phNum = parseFloat(r.ph_level);
                      const salNum = parseFloat(r.salinity);

                      const isDoLow = doNum < 5.0;
                      const isTempAbnormal = tempNum >= 32.5 || tempNum < 24.0;
                      const isPhAbnormal = phNum < 7.5 || phNum > 8.5;
                      const isSalAbnormal = salNum < 15.0 || salNum > 28.0;

                      return (
                        <tr key={r.id}>
                          {/* Date & Culture Day */}
                          <td className="px-3 py-2.5">
                            <div className="d-flex align-items-center gap-2">
                              <div>
                                <div className="d-flex align-items-center gap-1.5">
                                  <strong className="text-dark" style={{ fontSize: '0.88rem' }}>
                                    {new Date(r.record_date + 'T00:00:00').toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                                  </strong>
                                  {isToday && (
                                    <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill extra-small">
                                      Today
                                    </span>
                                  )}
                                </div>
                                <div className="extra-small text-muted d-flex align-items-center gap-1.5 mt-0.5">
                                  {doc ? (
                                    <span className={doc <= 19 ? 'text-success fw-bold' : 'text-primary fw-bold'}>
                                      Day {doc} ({doc <= 19 ? 'Nursery' : 'Grow-out'})
                                    </span>
                                  ) : (
                                    <span>Record #{r.id}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* DO */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`badge rounded-pill px-2.5 py-1 ${
                                isDoLow
                                  ? 'bg-danger bg-opacity-15 text-danger border border-danger border-opacity-25'
                                  : 'bg-info bg-opacity-15 text-primary border border-info border-opacity-25'
                              } fw-extrabold`}
                            >
                              {doNum.toFixed(2)}
                            </span>
                          </td>

                          {/* Temp */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`badge rounded-pill px-2.5 py-1 ${
                                isTempAbnormal
                                  ? 'bg-warning bg-opacity-15 text-dark border border-warning border-opacity-30'
                                  : 'bg-light text-dark border'
                              } fw-bold`}
                            >
                              {tempNum.toFixed(1)}°
                            </span>
                          </td>

                          {/* pH */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`badge rounded-pill px-2.5 py-1 ${
                                isPhAbnormal
                                  ? 'bg-warning bg-opacity-15 text-dark border border-warning border-opacity-30'
                                  : 'bg-light text-dark border'
                              } fw-bold`}
                            >
                              {phNum.toFixed(2)}
                            </span>
                          </td>

                          {/* Salinity */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`badge rounded-pill px-2.5 py-1 ${
                                isSalAbnormal
                                  ? 'bg-warning bg-opacity-15 text-dark border border-warning border-opacity-30'
                                  : 'bg-light text-dark border'
                              } fw-bold`}
                            >
                              {salNum.toFixed(1)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-2 py-2.5 text-center">
                            {(() => {
                              const s = String(r.status || '').toLowerCase();
                              const isSafe = s === 'safe' || s === 'normal' || (!s && !isDoLow && !isTempAbnormal && !isPhAbnormal && !isSalAbnormal);
                              return (
                                <span
                                  className={`badge rounded-pill px-2.5 py-1 extra-small fw-bold ${
                                    isSafe
                                      ? 'bg-success bg-opacity-15 text-success border border-success border-opacity-25'
                                      : 'bg-danger bg-opacity-15 text-danger border border-danger border-opacity-25'
                                  }`}
                                >
                                  {isSafe ? 'Safe' : 'Critical'}
                                </span>
                              );
                            })()}
                          </td>

                          {/* Capture Mode */}
                          <td className="px-2 py-2.5 text-center">
                            {r.capture_mode === 'data_sheet' ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 extra-small">
                                <FaFileAlt className="me-1" size={10} /> Physical Sheet
                              </span>
                            ) : r.capture_mode === 'manual' ? (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary border extra-small">
                                Manual Entry
                              </span>
                            ) : (
                              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 extra-small">
                                <FaMicrochip className="me-1" size={10} /> LCD Meter
                              </span>
                            )}
                          </td>

                          {/* Recorded By */}
                          <td className="px-2 py-2.5">
                            <div className="small fw-semibold text-dark text-truncate" style={{ maxWidth: 130 }}>
                              {r.recorded_by_name || 'Caretaker'}
                            </div>
                            <div className="extra-small text-muted">
                              {r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </td>

                          {/* Photo Proof */}
                          <td className="px-2 py-2.5 text-center">
                            {r.image_path ? (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-info rounded-pill px-2 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => setProofModalImage(r.image_path)}
                                title="View Captured Photo Proof"
                              >
                                <FaEye size={10} /> Proof
                              </button>
                            ) : (
                              <span className="text-muted extra-small">—</span>
                            )}
                          </td>

                          {/* Actions: Edit & Delete */}
                          {canEdit && (
                            <td className="px-3 py-2.5 text-end">
                              <div className="d-inline-flex align-items-center gap-1.5">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary bg-white rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                                  onClick={() => onEditRecord(r)}
                                  title="Edit / Update This Record"
                                >
                                  <FaEdit size={11} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger bg-white rounded-circle p-1 extra-small d-inline-flex align-items-center justify-content-center shadow-xs"
                                  style={{ width: 28, height: 28 }}
                                  onClick={() => handleDelete(r)}
                                  disabled={deletingId === r.id}
                                  title="Delete Record"
                                >
                                  <FaTrash size={10} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-white border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="extra-small text-muted d-flex align-items-center gap-2">
              <FaCheckCircle className="text-success" />
              <span>
                Historical backfilling allows verifying feeding logs and growth predictions for past culture days.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary rounded-pill px-4 py-1.5 fw-bold"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Proof Lightbox Modal */}
      {proofModalImage && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.9)', zIndex: 1075 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 overflow-hidden bg-white shadow-2xl">
              <div className="p-3 px-4 bg-dark text-white d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <FaEye className="text-info" />
                  <span className="fw-bold small">Scanned Water Quality Photo Proof</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light rounded-circle p-1"
                  onClick={() => setProofModalImage(null)}
                >
                  <FaTimes size={12} />
                </button>
              </div>
              <div className="p-3 text-center bg-black">
                <img
                  src={
                    proofModalImage.startsWith('http')
                      ? proofModalImage
                      : `/shrim_predict_api/${proofModalImage}`
                  }
                  alt="Proof Document"
                  style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain' }}
                  className="rounded-2"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
