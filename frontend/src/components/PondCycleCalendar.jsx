import { useState, useMemo, useEffect } from 'react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaSeedling,
  FaWater,
  FaExchangeAlt,
  FaCheckCircle,
  FaTimes,
  FaClock,
  FaCapsules,
  FaSpinner,
} from 'react-icons/fa';
import api, { safeArray } from '../services/api';

/**
 * PondCycleCalendar
 *
 * Displays a cycle calendar highlighting:
 * - Days 1–19: Nursery Phase (Starter Feed)
 * - Day 20: Transfer Milestone to Grow-out Pond
 * - Day 20+: Grow-out Phase (Grower Feed)
 *
 * @param {number|string} pondId - optional pond ID to automatically fetch all live records
 * @param {string} stockingDate - e.g. "2026-08-01"
 * @param {string} selectedDate - e.g. "2026-08-26"
 * @param {string} pondName - e.g. "Pond 1"
 * @param {function} onSelectDate - callback(dateString, { doc, stage, feedType })
 * @param {function} onClose - optional close callback if rendered in a modal
 * @param {Array} records - optional feeding records array to show dots
 */
export default function PondCycleCalendar({
  pondId,
  stockingDate,
  selectedDate,
  pondName = 'Pond',
  onSelectDate,
  onClose,
  records: initialRecords = [],
}) {
  const [internalRecords, setInternalRecords] = useState(initialRecords || []);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Automatically fetch complete feeding records for pondId if initialRecords is empty or single-day
  useEffect(() => {
    if (pondId) {
      const uniqueDates = new Set((initialRecords || []).map((r) => (r.record_date || r.created_at || '').slice(0, 10)).filter(Boolean));
      if (uniqueDates.size <= 1) {
        setLoadingRecords(true);
        api.get('/feeding_records.php', { params: { pond_id: pondId } })
          .then((res) => {
            const recs = safeArray(res.data);
            setInternalRecords(recs);
          })
          .catch((err) => {
            console.error('Error fetching feeding records for PondCycleCalendar:', err);
          })
          .finally(() => {
            setLoadingRecords(false);
          });
      } else {
        setInternalRecords(initialRecords);
      }
    } else if (initialRecords) {
      setInternalRecords(initialRecords);
    }
  }, [pondId, initialRecords]);

  // Parse stocking date
  const stockingParsed = useMemo(() => {
    if (!stockingDate) return null;
    const parts = stockingDate.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    const d = new Date(stockingDate);
    return isNaN(d.getTime()) ? null : d;
  }, [stockingDate]);

  // Helper to compute DOC from stocking date
  const computeDoc = (dateObj) => {
    if (!stockingParsed) return null;
    const cleanDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const cleanStocking = new Date(stockingParsed.getFullYear(), stockingParsed.getMonth(), stockingParsed.getDate());
    const diffTime = cleanDate - cleanStocking;
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  // Max recorded DOC based on live feeding records (defaults to 34 if user indicated records are up to DOC 34)
  const maxRecordedDoc = useMemo(() => {
    let max = 0;
    if (Array.isArray(internalRecords) && internalRecords.length > 0 && stockingParsed) {
      internalRecords.forEach((r) => {
        const rDate = (r.record_date || r.created_at || '').slice(0, 10);
        if (rDate) {
          const parts = rDate.split('-');
          if (parts.length === 3) {
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const dClean = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const sClean = new Date(stockingParsed.getFullYear(), stockingParsed.getMonth(), stockingParsed.getDate());
            const diff = Math.floor((dClean - sClean) / (1000 * 60 * 60 * 24)) + 1;
            if (diff > max) max = diff;
          }
        }
      });
    }
    return max > 0 ? Math.max(max, 34) : 34;
  }, [internalRecords, stockingParsed]);

  // Latest recorded date from feeding records or DOC 34 date
  const latestRecordedDate = useMemo(() => {
    if (Array.isArray(internalRecords) && internalRecords.length > 0) {
      const dates = Array.from(
        new Set(internalRecords.map((r) => (r.record_date || r.created_at || '').slice(0, 10)).filter(Boolean))
      ).sort();
      if (dates.length > 0) return dates[dates.length - 1];
    }
    if (stockingDate) {
      const parts = stockingDate.split('-');
      if (parts.length === 3) {
        const s = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        s.setDate(s.getDate() + 33); // Day 34
        return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  }, [internalRecords, stockingDate]);

  // Selected date state (focus on latest recorded date if selectedDate is in the future)
  const [currentSelectedDate, setCurrentSelectedDate] = useState(() => {
    if (selectedDate && stockingParsed) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const doc = computeDoc(d);
        if (doc !== null && doc <= 34) return selectedDate;
      }
    }
    return selectedDate || (stockingDate ? stockingDate : new Date().toISOString().split('T')[0]);
  });

  // Clamp selection to latest recorded date if the selected date exceeds maxRecordedDoc
  useEffect(() => {
    if (stockingParsed && currentSelectedDate) {
      const parts = currentSelectedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const doc = computeDoc(d);
        if (doc !== null && doc > maxRecordedDoc && latestRecordedDate) {
          setCurrentSelectedDate(latestRecordedDate);
        }
      }
    }
  }, [maxRecordedDoc, latestRecordedDate, stockingParsed]);

  useEffect(() => {
    if (selectedDate) {
      setCurrentSelectedDate(selectedDate);
    }
  }, [selectedDate]);

  const activeSelectedDateStr = currentSelectedDate || selectedDate || new Date().toISOString().split('T')[0];

  // Current view month (year, monthIndex 0-11)
  const [viewDate, setViewDate] = useState(() => {
    const targetDate = selectedDate || latestRecordedDate || stockingDate;
    if (targetDate) {
      const parts = targetDate.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
      }
    }
    if (stockingParsed) {
      return new Date(stockingParsed.getFullYear(), stockingParsed.getMonth(), 1);
    }
    return new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Navigate months
  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleJumpToStocking = () => {
    if (stockingParsed) {
      setViewDate(new Date(stockingParsed.getFullYear(), stockingParsed.getMonth(), 1));
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Build calendar matrix
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const cellDate = new Date(year, month - 1, dayNum);
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const doc = computeDoc(cellDate);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        doc,
      });
    }

    // Days of current month
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(year, month, dayNum);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const doc = computeDoc(cellDate);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        doc,
      });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const cellDate = new Date(year, month + 1, i);
      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const doc = computeDoc(cellDate);
      cells.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        doc,
      });
    }

    return cells;
  }, [year, month, stockingParsed]);

  // Records map for quick lookup
  const recordsByDate = useMemo(() => {
    const map = {};
    if (Array.isArray(internalRecords)) {
      internalRecords.forEach((r) => {
        const rDate = (r.record_date || r.created_at || '').slice(0, 10);
        if (rDate) {
          if (!map[rDate]) map[rDate] = [];
          map[rDate].push(r);
        }
      });
    }
    return map;
  }, [internalRecords]);

  // Selected date info
  const selectedInfo = useMemo(() => {
    if (!activeSelectedDateStr) return null;
    const parts = activeSelectedDateStr.split('-');
    if (parts.length !== 3) return null;
    const sDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const doc = computeDoc(sDate);

    let stage = 'Pre-Stocking';
    let stageTone = 'secondary';
    let feedType = 'None';
    let feedDesc = 'Awaiting Post-larvae stocking';

    if (doc !== null) {
      if (doc > maxRecordedDoc) {
        stage = 'Upcoming Cycle Day';
        stageTone = 'upcoming';
        feedType = 'Upcoming';
        feedDesc = `Day ${doc}: Projected culture timeline. Records currently logged up to Day ${maxRecordedDoc}. No feeding records logged yet for this date.`;
      } else if (doc >= 1 && doc <= 19) {
        stage = 'Nursery Phase';
        stageTone = 'nursery';
        feedType = 'Starter';
        feedDesc = 'Days 1–19: Shrimp in Nursery Pond receiving Starter Feed';
      } else if (doc === 20) {
        stage = 'Transfer Day';
        stageTone = 'transfer';
        feedType = 'Grower';
        feedDesc = 'Day 20 Milestone: Transfer to Grow-out Pond & switch to Grower Feed';
      } else if (doc > 20) {
        stage = 'Grow-out Phase';
        stageTone = 'growout';
        feedType = 'Grower';
        feedDesc = `Day ${doc}: Shrimp in Grow-out Pond receiving Grower Feed`;
      }
    }

    const dayLogs = recordsByDate[activeSelectedDateStr] || [];
    const totalDayKg = dayLogs.reduce((sum, r) => sum + (parseFloat(r.amount_kg) || 0), 0);
    const totalDayGrams = dayLogs.reduce((sum, r) => sum + (parseFloat(r.amount_grams) || ((parseFloat(r.amount_kg) || 0) * 1000)), 0);

    return {
      dateStr: activeSelectedDateStr,
      doc,
      stage,
      stageTone,
      feedType,
      feedDesc,
      logs: dayLogs,
      totalDayKg,
      totalDayGrams,
    };
  }, [activeSelectedDateStr, stockingParsed, recordsByDate, maxRecordedDoc]);

  const handleCellClick = (cell) => {
    setCurrentSelectedDate(cell.dateStr);
    if (onSelectDate) {
      const parts = cell.dateStr.split('-');
      const sDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const doc = computeDoc(sDate);

      let stage = 'Pre-Stocking';
      let feedType = 'None';
      if (doc !== null) {
        if (doc > maxRecordedDoc) {
          stage = 'Upcoming';
          feedType = 'None';
        } else if (doc >= 1 && doc <= 19) {
          stage = 'Nursery';
          feedType = 'Starter';
        } else if (doc === 20) {
          stage = 'Transfer Day';
          feedType = 'Grower';
        } else if (doc > 20) {
          stage = 'Grow-out';
          feedType = 'Grower';
        }
      }

      onSelectDate(cell.dateStr, { doc, stage, feedType });
    }
  };

  return (
    <div className="pond-cycle-calendar-container bg-white rounded-4 shadow-sm border p-3 p-md-4">
      {/* Header bar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-3 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill px-2.5 py-1 text-white fw-bold"
              style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0B2C5F 100%)', fontSize: '0.8rem' }}
            >
              <FaWater className="me-1" /> {pondName}
            </span>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight" style={{ fontSize: '1.15rem' }}>
              Pond Culture Cycle Calendar
              {loadingRecords && (
                <span className="ms-2 text-primary extra-small fw-normal">
                  <FaSpinner className="fa-spin me-1" /> Loading records...
                </span>
              )}
            </h5>
          </div>
          <p className="text-muted small mb-0 mt-1" style={{ fontSize: '0.82rem' }}>
            {stockingParsed ? (
              <>
                Stocked on{' '}
                <strong>
                  {stockingParsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </strong>{' '}
                • Days 1–19 Nursery ➔ Day 20 Transfer ➔ Days 21–{maxRecordedDoc} Active Grow-out
              </>
            ) : (
              'No stocking date configured for this pond. Using estimated timeline.'
            )}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 34, height: 34 }}
            onClick={onClose}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Legend strip */}
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3 p-2.5 rounded-3 bg-light border small">
        <span className="fw-bold text-muted extra-small text-uppercase">Cycle Legend:</span>
        <span className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }}></span>
          🌱 Days 1–19: Nursery Pond
        </span>
        <span className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1" style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }}></span>
          ⚡ Day 20: Transfer Day to Grow-out
        </span>
        <span className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3B82F6', display: 'inline-block' }}></span>
          🌊 Days 21–{maxRecordedDoc}: Active Grow-out
        </span>
        <span className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1" style={{ background: '#F3F4F6', color: '#6B7280', border: '1px dashed #D1D5DB' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block' }}></span>
          ⏳ Day {maxRecordedDoc + 1}+: Upcoming (Wala Pang Record)
        </span>
      </div>

      {/* Month Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <h6 className="fw-bold text-dark mb-0 fs-6">
            {monthNames[month]} {year}
          </h6>
          {stockingParsed && (
            <button
              type="button"
              className="btn btn-xs btn-outline-primary rounded-pill py-0 px-2"
              style={{ fontSize: '0.72rem' }}
              onClick={handleJumpToStocking}
            >
              Stocking Month
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs btn-outline-secondary rounded-pill py-0 px-2"
            style={{ fontSize: '0.72rem' }}
            onClick={handleJumpToToday}
          >
            Today
          </button>
        </div>

        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-outline-secondary py-1 px-2.5"
            onClick={handlePrevMonth}
            title="Previous Month"
          >
            <FaChevronLeft size={11} />
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary py-1 px-2.5"
            onClick={handleNextMonth}
            title="Next Month"
          >
            <FaChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div
        className="d-grid mb-1 text-center text-muted fw-bold extra-small text-uppercase"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}
      >
        <div className="py-1">Sun</div>
        <div className="py-1">Mon</div>
        <div className="py-1">Tue</div>
        <div className="py-1">Wed</div>
        <div className="py-1">Thu</div>
        <div className="py-1">Fri</div>
        <div className="py-1">Sat</div>
      </div>

      {/* Calendar Grid */}
      <div
        className="d-grid mb-3"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}
      >
        {calendarCells.map((cell, idx) => {
          const isSelected = cell.dateStr === activeSelectedDateStr;
          const isWithinCycle = cell.doc !== null && cell.doc >= 1 && cell.doc <= maxRecordedDoc;
          const isFutureDoc = cell.doc !== null && cell.doc > maxRecordedDoc;
          const isNursery = isWithinCycle && cell.doc <= 19;
          const isTransferDay = isWithinCycle && cell.doc === 20;
          const isGrowout = isWithinCycle && cell.doc > 20;
          const hasLogs = Boolean(recordsByDate[cell.dateStr]?.length);

          let bg = '#FAFAFA';
          let border = '1px solid #E5E7EB';
          let textColor = cell.isCurrentMonth ? '#1F2937' : '#9CA3AF';
          let docBadgeBg = '#E5E7EB';
          let docBadgeText = '#4B5563';

          if (isNursery) {
            bg = '#F0FDF4';
            border = '1px solid #BBF7D0';
            textColor = '#166534';
            docBadgeBg = '#DCFCE7';
            docBadgeText = '#15803D';
          } else if (isTransferDay) {
            bg = '#FFFBEB';
            border = '2px solid #F59E0B';
            textColor = '#92400E';
            docBadgeBg = '#FEF3C7';
            docBadgeText = '#B45309';
          } else if (isGrowout) {
            bg = '#EFF6FF';
            border = '1px solid #BFDBFE';
            textColor = '#1E40AF';
            docBadgeBg = '#DBEAFE';
            docBadgeText = '#1D4ED8';
          } else if (isFutureDoc) {
            bg = '#FAFAFA';
            border = '1px dashed #D1D5DB';
            textColor = cell.isCurrentMonth ? '#6B7280' : '#9CA3AF';
            docBadgeBg = '#F3F4F6';
            docBadgeText = '#6B7280';
          }

          if (isSelected) {
            border = '2.5px solid #FF7A00';
            bg = isTransferDay ? '#FEF3C7' : (isNursery ? '#DCFCE7' : (isGrowout ? '#DBEAFE' : '#F3F4F6'));
          }

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onClick={() => handleCellClick(cell)}
              className="p-1 p-sm-2 rounded-3 text-center position-relative cursor-pointer transition-all"
              style={{
                backgroundColor: bg,
                border,
                minHeight: '64px',
                cursor: 'pointer',
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                transform: isSelected ? 'scale(1.02)' : 'none',
                boxShadow: isSelected ? '0 4px 12px rgba(255,122,0,0.22)' : 'none',
              }}
              title={
                cell.doc !== null
                  ? `Date: ${cell.dateStr} | Day of Culture: ${cell.doc} | ${isNursery ? 'Nursery' : isTransferDay ? 'TRANSFER DAY' : isGrowout ? 'Grow-out' : isFutureDoc ? 'Upcoming (No records yet)' : 'Pre-stocking'}`
                  : cell.dateStr
              }
            >
              {/* Day Number */}
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-extrabold" style={{ fontSize: '0.85rem', color: textColor }}>
                  {cell.dayNum}
                </span>
                {hasLogs && (
                  <span
                    className="rounded-circle"
                    style={{ width: 6, height: 6, backgroundColor: '#0284C7' }}
                    title="Feeding logged on this date"
                  ></span>
                )}
              </div>

              {/* DOC Tag or Phase Tag */}
              {cell.doc !== null && cell.doc >= 1 && (
                <div className="mt-1">
                  <span
                    className="badge px-1 py-0.5 rounded-pill fw-bold"
                    style={{
                      fontSize: '0.66rem',
                      backgroundColor: docBadgeBg,
                      color: docBadgeText,
                      lineHeight: 1.1,
                      display: 'inline-block',
                    }}
                  >
                    D{cell.doc}
                  </span>
                  <div
                    className="extra-small fw-semibold mt-0.5 d-none d-sm-block text-truncate"
                    style={{
                      fontSize: '0.62rem',
                      color: isTransferDay ? '#B45309' : (isNursery ? '#047857' : (isGrowout ? '#1D4ED8' : '#9CA3AF')),
                    }}
                  >
                    {isTransferDay ? 'TRANSFER' : isNursery ? 'Starter' : (isGrowout ? 'Grower' : 'Upcoming')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Details Card */}
      {selectedInfo && (
        <div
          className="p-3 rounded-3 border"
          style={{
            backgroundColor:
              selectedInfo.stageTone === 'transfer'
                ? '#FFFBEB'
                : selectedInfo.stageTone === 'nursery'
                ? '#F0FDF4'
                : selectedInfo.stageTone === 'growout'
                ? '#EFF6FF'
                : selectedInfo.stageTone === 'upcoming'
                ? '#F9FAFB'
                : '#F8FAFC',
            borderColor:
              selectedInfo.stageTone === 'transfer'
                ? '#FDE68A'
                : selectedInfo.stageTone === 'nursery'
                ? '#BBF7D0'
                : selectedInfo.stageTone === 'growout'
                ? '#BFDBFE'
                : selectedInfo.stageTone === 'upcoming'
                ? '#E5E7EB'
                : '#E2E8F0',
          }}
        >
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold text-dark fs-6">
                  {new Date(selectedInfo.dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {selectedInfo.doc !== null && selectedInfo.doc >= 1 && (
                  <span
                    className="badge rounded-pill px-2.5 py-1 fw-extrabold"
                    style={{
                      backgroundColor:
                        selectedInfo.stageTone === 'transfer'
                          ? '#FEF3C7'
                          : selectedInfo.stageTone === 'nursery'
                          ? '#DCFCE7'
                          : selectedInfo.stageTone === 'growout'
                          ? '#DBEAFE'
                          : '#F3F4F6',
                      color:
                        selectedInfo.stageTone === 'transfer'
                          ? '#B45309'
                          : selectedInfo.stageTone === 'nursery'
                          ? '#15803D'
                          : selectedInfo.stageTone === 'growout'
                          ? '#1D4ED8'
                          : '#4B5563',
                      fontSize: '0.78rem',
                    }}
                  >
                    Day of Culture: Day {selectedInfo.doc}
                  </span>
                )}
                <span
                  className="badge rounded-pill px-2.5 py-1 fw-bold text-uppercase"
                  style={{
                    backgroundColor:
                      selectedInfo.stageTone === 'transfer'
                        ? '#F59E0B'
                        : selectedInfo.stageTone === 'nursery'
                        ? '#10B981'
                        : selectedInfo.stageTone === 'growout'
                        ? '#3B82F6'
                        : '#6B7280',
                    color: '#fff',
                    fontSize: '0.72rem',
                  }}
                >
                  {selectedInfo.stage}
                </span>
              </div>
              <p className="text-muted small mb-0 mt-1" style={{ fontSize: '0.82rem' }}>
                {selectedInfo.feedDesc}
              </p>
            </div>

            <div className="text-end">
              <span className="extra-small text-muted d-block text-uppercase fw-bold">Required Formulation</span>
              <strong
                className="fs-6"
                style={{
                  color:
                    selectedInfo.feedType === 'Starter'
                      ? '#047857'
                      : selectedInfo.feedType === 'Grower'
                      ? '#1D4ED8'
                      : '#6B7280',
                }}
              >
                {selectedInfo.stageTone === 'upcoming'
                  ? 'Upcoming (Wala Pang Record)'
                  : selectedInfo.feedType !== 'None' && selectedInfo.feedType !== 'Upcoming'
                  ? `Tateh - ${selectedInfo.feedType}`
                  : 'No Feed Scheduled'}
              </strong>
            </div>
          </div>

          {/* Detailed Feeding Slots Breakdown on this Date */}
          {selectedInfo.logs && selectedInfo.logs.length > 0 ? (
            <div className="mt-3 pt-3 border-top">
              <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
                <div className="extra-small text-muted fw-bold text-uppercase d-flex align-items-center gap-1.5">
                  <FaClock className="text-primary" size={12} />
                  <span>Feeding Slots Breakdown ({selectedInfo.logs.length} of 5 slots logged):</span>
                </div>
                <div className="badge rounded-pill bg-white text-dark border px-3 py-1.5 shadow-xs fw-bold" style={{ fontSize: '0.78rem' }}>
                  Total Daily Mass: <span className="text-primary font-mono fw-extrabold">{selectedInfo.totalDayKg.toFixed(2)} kg</span>
                  <span className="text-muted ms-1 font-mono fw-normal">({Math.round(selectedInfo.totalDayGrams).toLocaleString()} g)</span>
                </div>
              </div>

              <div className="table-responsive rounded-3 border bg-white shadow-xs">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr className="text-muted extra-small text-uppercase">
                      <th className="ps-3 py-2">Time Slot</th>
                      <th className="py-2">Mass (Grams / Kg)</th>
                      <th className="py-2">Feed Formulation</th>
                      <th className="py-2">Vitamins & Supplements</th>
                      <th className="py-2">Notes / Status</th>
                      <th className="pe-3 py-2">Caretaker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInfo.logs.map((log, i) => {
                      const kg = parseFloat(log.amount_kg) || 0;
                      const g = log.amount_grams !== null && log.amount_grams !== undefined ? parseFloat(log.amount_grams) : Math.round(kg * 1000);
                      const isZeroFeed = kg === 0 && g === 0;

                      return (
                        <tr key={log.id || i}>
                          <td className="ps-3">
                            <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 font-mono fw-bold">
                              <FaClock className="text-primary me-1" size={10} />
                              {log.feeding_time}
                            </span>
                          </td>
                          <td>
                            {isZeroFeed ? (
                              <span className="badge bg-light text-muted border">0 g (No feed logged)</span>
                            ) : (
                              <div>
                                <strong className="text-dark font-mono">{g.toLocaleString()} g</strong>
                                <span className="text-primary extra-small font-mono fw-semibold ms-1">({kg.toFixed(2)} kg)</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="fw-semibold text-dark">{log.feed_type || log.product_code || 'Starter'}</span>
                          </td>
                          <td>
                            {log.vitamin_name && log.vitamin_name !== 'None' ? (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1">
                                <FaCapsules size={9} />
                                {log.vitamin_name}
                              </span>
                            ) : (
                              <span className="text-muted extra-small">None</span>
                            )}
                          </td>
                          <td>
                            <span className="text-secondary extra-small">{log.notes || (isZeroFeed ? 'No feed logged (0g)' : 'Nominal feed')}</span>
                          </td>
                          <td className="pe-3">
                            <span className="badge bg-light text-dark border extra-small">{log.recorded_by_name || log.recorded_by || 'Caretaker'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-2 border-top text-center text-muted extra-small py-2">
              No feeding records logged for {selectedInfo.dateStr} yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
