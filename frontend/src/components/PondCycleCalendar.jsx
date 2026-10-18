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
import { getEffectiveTheme } from '../utils/theme';

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
function sanitizeNotes(notes, isZeroFeed) {
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return isZeroFeed ? 'No feed logged (0g)' : 'Nominal feed';
  }
  return notes
    .replace(/wala\s+pang\s+pakain/gi, 'No feed logged')
    .replace(/wala\s+pang\s+record/gi, 'No record yet')
    .replace(/wala\s+pang/gi, 'No feed logged')
    .replace(/\(0g\)\s*\(0g\)/gi, '(0g)');
}

function renderStructuredNotes(notesStr, isZeroFeed, isDark = false) {
  const clean = sanitizeNotes(notesStr, isZeroFeed);
  if (!clean || clean === 'Nominal feed' || clean === 'No feed logged (0g)') {
    return <span className="extra-small" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>{clean}</span>;
  }

  const parts = clean.split('|').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return (
      <div className="d-flex flex-column gap-1 extra-small py-1">
        {parts.map((part, idx) => (
          <div key={idx} className="d-flex align-items-center gap-1.5">
            <span className="rounded-circle flex-shrink-0" style={{ width: 5, height: 5, backgroundColor: isDark ? '#94A3B8' : '#64748B' }}></span>
            <span className="fw-medium" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{part}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="extra-small fw-medium" style={{ color: isDark ? '#CBD5E1' : '#475569' }}>{clean}</span>;
}

export default function PondCycleCalendar({
  pond,
  pondId: propPondId,
  stockingDate: propStockingDate,
  selectedDate,
  pondName: propPondName,
  onSelectDate,
  onClose,
  records: initialRecords = [],
  isOpen = true,
}) {
  if (isOpen === false) return null;

  const pondId = propPondId || pond?.id;
  const stockingDate = propStockingDate || pond?.stocking_date;
  const pondName = propPondName || pond?.pond_name || (pond?.id ? `Pond #${pond.id}` : 'Pond');

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
      if (document.body && document.body.classList.contains('dark-theme')) return 'dark';
    }
    return getEffectiveTheme();
  });

  useEffect(() => {
    const readTheme = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
      if (document.body && document.body.classList.contains('dark-theme')) return 'dark';
      return getEffectiveTheme();
    };

    const handleThemeChange = (e) => {
      const t = e?.detail?.theme || readTheme();
      setCurrentTheme(t);
    };

    window.addEventListener('shrim-theme-changed', handleThemeChange);

    const observer = new MutationObserver(() => {
      setCurrentTheme(readTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    return () => {
      window.removeEventListener('shrim-theme-changed', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  const isDark = currentTheme === 'dark';

  const [internalRecords, setInternalRecords] = useState(initialRecords || []);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Automatically fetch complete feeding records for pondId if needed
  useEffect(() => {
    let isMounted = true;
    if (pondId) {
      setLoadingRecords(true);
      api.get('/feeding_records.php', { params: { pond_id: pondId } })
        .then((res) => {
          if (!isMounted) return;
          const recs = safeArray(res.data);
          setInternalRecords(recs.length > 0 ? recs : (initialRecords || []));
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Error fetching feeding records for PondCycleCalendar:', err);
          setInternalRecords(initialRecords || []);
        })
        .finally(() => {
          if (isMounted) setLoadingRecords(false);
        });
    } else {
      setInternalRecords(initialRecords || []);
      setLoadingRecords(false);
    }
    return () => { isMounted = false; };
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
    <div
      className="pond-cycle-calendar-container w-100 p-3 p-md-4 p-xl-5 transition-all"
      style={{
        backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
        color: isDark ? '#F1F5F9' : '#0F172A',
      }}
    >
      {/* Header bar */}
      <div
        className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-3 border-bottom"
        style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' }}
      >
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge rounded-pill px-2.5 py-1 text-white fw-bold"
              style={{ background: 'linear-gradient(135deg, #FC563C 0%, #FC563C 100%)', fontSize: '0.8rem' }}
            >
              <FaWater className="me-1" /> {pondName}
            </span>
            <h5 className="fw-extrabold mb-0 tracking-tight" style={{ fontSize: '1.15rem', color: isDark ? '#FFFFFF' : '#0B2C5F' }}>
              Pond Culture Cycle Calendar
              {loadingRecords && (
                <span className="ms-2 text-primary extra-small fw-normal">
                  <FaSpinner className="fa-spin me-1" /> Loading records...
                </span>
              )}
            </h5>
          </div>
          <p className="small mb-0 mt-1" style={{ fontSize: '0.82rem', color: isDark ? '#CBD5E1' : '#64748B' }}>
            {stockingParsed ? (
              <>
                Stocked on{' '}
                <strong style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {stockingParsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </strong>{' '}
                • Days 1–19 Nursery &rarr; Day 20 Transfer &rarr; Days 21–{maxRecordedDoc} Active Grow-out
              </>
            ) : (
              'No stocking date configured for this pond. Using estimated timeline.'
            )}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="btn btn-sm border rounded-circle d-flex align-items-center justify-content-center transition-all"
            style={{
              width: 34,
              height: 34,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              color: isDark ? '#FFFFFF' : '#1E293B',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
            }}
            onClick={onClose}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Legend strip */}
      <div
        className="d-flex align-items-center gap-2 flex-wrap mb-3 p-2.5 rounded-3 small"
        style={{
          backgroundColor: isDark ? '#172A39' : '#F8FAFC',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
        }}
      >
        <span className="fw-bold extra-small text-uppercase" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>Cycle Legend:</span>
        <span
          className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
          style={{
            background: isDark ? 'rgba(16, 185, 129, 0.18)' : '#ECFDF5',
            color: isDark ? '#34D399' : '#047857',
            border: isDark ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid #A7F3D0',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }}></span>
          Days 1–19: Nursery Pond
        </span>
        <span
          className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
          style={{
            background: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
            color: isDark ? '#FBBF24' : '#B45309',
            border: isDark ? '1px solid rgba(251, 191, 36, 0.35)' : '1px solid #FDE68A',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }}></span>
          Day 20: Transfer Day to Grow-out
        </span>
        <span
          className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
          style={{
            background: isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF',
            color: isDark ? '#60A5FA' : '#1D4ED8',
            border: isDark ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid #BFDBFE',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3B82F6', display: 'inline-block' }}></span>
          Days 21–{maxRecordedDoc}: Active Grow-out
        </span>
        <span
          className="badge px-2 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
            color: isDark ? '#94A3B8' : '#6B7280',
            border: isDark ? '1px dashed rgba(255, 255, 255, 0.2)' : '1px dashed #D1D5DB',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block' }}></span>
          Day {maxRecordedDoc + 1}+: Upcoming (No Records Yet)
        </span>
      </div>

      {/* Month Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <h6 className="fw-bold mb-0 fs-6" style={{ color: isDark ? '#FFFFFF' : '#0B2C5F' }}>
            {monthNames[month]} {year}
          </h6>
          {stockingParsed && (
            <button
              type="button"
              className="btn btn-xs rounded-pill py-0.5 px-2.5 transition-all"
              style={{
                fontSize: '0.72rem',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF',
                color: isDark ? '#60A5FA' : '#1D4ED8',
                border: isDark ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid #BFDBFE',
              }}
              onClick={handleJumpToStocking}
            >
              Stocking Month
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs rounded-pill py-0.5 px-2.5 transition-all"
            style={{
              fontSize: '0.72rem',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              color: isDark ? '#CBD5E1' : '#475569',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #CBD5E1',
            }}
            onClick={handleJumpToToday}
          >
            Today
          </button>
        </div>

        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className="btn py-1 px-2.5 transition-all"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              color: isDark ? '#E2E8F0' : '#475569',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #CBD5E1',
            }}
            onClick={handlePrevMonth}
            title="Previous Month"
          >
            <FaChevronLeft size={11} />
          </button>
          <button
            type="button"
            className="btn py-1 px-2.5 transition-all"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
              color: isDark ? '#E2E8F0' : '#475569',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #CBD5E1',
            }}
            onClick={handleNextMonth}
            title="Next Month"
          >
            <FaChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div
        className="d-grid mb-1 text-center fw-bold extra-small text-uppercase"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', color: isDark ? '#94A3B8' : '#64748B' }}
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

          let bg = isDark ? '#172A39' : '#FAFAFA';
          let border = isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E5E7EB';
          let textColor = cell.isCurrentMonth
            ? (isDark ? '#F1F5F9' : '#1F2937')
            : (isDark ? '#64748B' : '#9CA3AF');
          let docBadgeBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB';
          let docBadgeText = isDark ? '#CBD5E1' : '#4B5563';

          if (isNursery) {
            bg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4';
            border = isDark ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid #BBF7D0';
            textColor = isDark ? '#34D399' : '#166534';
            docBadgeBg = isDark ? 'rgba(16, 185, 129, 0.28)' : '#DCFCE7';
            docBadgeText = isDark ? '#4ADE80' : '#15803D';
          } else if (isTransferDay) {
            bg = isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB';
            border = isDark ? '2px solid #F59E0B' : '2px solid #F59E0B';
            textColor = isDark ? '#FBBF24' : '#92400E';
            docBadgeBg = isDark ? 'rgba(245, 158, 11, 0.35)' : '#FEF3C7';
            docBadgeText = isDark ? '#FCD34D' : '#B45309';
          } else if (isGrowout) {
            bg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF';
            border = isDark ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid #BFDBFE';
            textColor = isDark ? '#60A5FA' : '#1E40AF';
            docBadgeBg = isDark ? 'rgba(59, 130, 246, 0.28)' : '#DBEAFE';
            docBadgeText = isDark ? '#93C5FD' : '#1D4ED8';
          } else if (isFutureDoc) {
            bg = isDark ? 'rgba(255, 255, 255, 0.03)' : '#FAFAFA';
            border = isDark ? '1px dashed rgba(255, 255, 255, 0.14)' : '1px dashed #D1D5DB';
            textColor = cell.isCurrentMonth
              ? (isDark ? '#94A3B8' : '#6B7280')
              : (isDark ? '#475569' : '#9CA3AF');
            docBadgeBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6';
            docBadgeText = isDark ? '#94A3B8' : '#6B7280';
          }

          if (isSelected) {
            border = '2.5px solid #FC563C';
            bg = isTransferDay
              ? (isDark ? 'rgba(245, 158, 11, 0.35)' : '#FEF3C7')
              : isNursery
              ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#DCFCE7')
              : isGrowout
              ? (isDark ? 'rgba(59, 130, 246, 0.3)' : '#DBEAFE')
              : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#F3F4F6');
          }

          return (
            <div
              key={`${cell.dateStr}-${idx}`}
              onClick={() => handleCellClick(cell)}
              className="p-2 rounded-3 text-center position-relative cursor-pointer transition-all"
              style={{
                backgroundColor: bg,
                border,
                minHeight: '96px',
                cursor: 'pointer',
                opacity: cell.isCurrentMonth ? 1 : 0.45,
                transform: isSelected ? 'scale(1.02)' : 'none',
                boxShadow: isSelected ? '0 4px 14px rgba(252, 86, 60, 0.35)' : 'none',
              }}
              title={
                cell.doc !== null
                  ? `Date: ${cell.dateStr} | Day of Culture: ${cell.doc} | ${isNursery ? 'Nursery' : isTransferDay ? 'TRANSFER DAY' : isGrowout ? 'Grow-out' : isFutureDoc ? 'Upcoming (No records yet)' : 'Pre-stocking'}`
                  : cell.dateStr
              }
            >
              {/* Day Number */}
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="fw-extrabold" style={{ fontSize: '0.95rem', color: textColor }}>
                  {cell.dayNum}
                </span>
                {hasLogs && (
                  <span
                    className="d-inline-flex align-items-center gap-1 px-1.5 py-0.5 rounded-pill"
                    style={{
                      backgroundColor: isDark ? 'rgba(252, 86, 60, 0.2)' : 'rgba(252, 86, 60, 0.12)',
                      color: isDark ? '#FF8A75' : '#FC563C',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                    title="Feeding records logged on this date"
                  >
                    <span className="rounded-circle" style={{ width: 6, height: 6, backgroundColor: '#FC563C' }}></span>
                    Logged
                  </span>
                )}
              </div>

              {/* DOC Tag or Phase Tag */}
              {cell.doc !== null && cell.doc >= 1 && (
                <div className="mt-1">
                  <span
                    className="badge px-2 py-1 rounded-pill fw-bold"
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: docBadgeBg,
                      color: docBadgeText,
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                      lineHeight: 1.1,
                      display: 'inline-block',
                    }}
                  >
                    Day {cell.doc}
                  </span>
                  <div
                    className="extra-small fw-bold mt-1 d-none d-sm-block text-truncate"
                    style={{
                      fontSize: '0.68rem',
                      color: isTransferDay
                        ? (isDark ? '#FBBF24' : '#B45309')
                        : isNursery
                        ? (isDark ? '#34D399' : '#047857')
                        : isGrowout
                        ? (isDark ? '#60A5FA' : '#1D4ED8')
                        : (isDark ? '#94A3B8' : '#9CA3AF'),
                    }}
                  >
                    {isTransferDay ? 'TRANSFER DAY' : isNursery ? 'Nursery Feed' : (isGrowout ? 'Grower Feed' : 'Upcoming')}
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
          className={`pond-cycle-calendar-card pond-cycle-calendar-card-${selectedInfo.stageTone} p-3 p-md-3.5 rounded-3 border transition-all mb-2`}
          style={{
            backgroundColor:
              selectedInfo.stageTone === 'transfer'
                ? (isDark ? 'rgba(245, 158, 11, 0.18)' : '#FFFBEB')
                : selectedInfo.stageTone === 'nursery'
                ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#F0FDF4')
                : selectedInfo.stageTone === 'growout'
                ? (isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF')
                : selectedInfo.stageTone === 'upcoming'
                ? (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F9FAFB')
                : (isDark ? '#172A39' : '#F8FAFC'),
            borderColor:
              selectedInfo.stageTone === 'transfer'
                ? (isDark ? 'rgba(245, 158, 11, 0.45)' : '#FDE68A')
                : selectedInfo.stageTone === 'nursery'
                ? (isDark ? 'rgba(52, 211, 153, 0.45)' : '#BBF7D0')
                : selectedInfo.stageTone === 'growout'
                ? (isDark ? 'rgba(96, 165, 250, 0.45)' : '#BFDBFE')
                : selectedInfo.stageTone === 'upcoming'
                ? (isDark ? 'rgba(255, 255, 255, 0.15)' : '#E5E7EB')
                : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'),
            boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                <span className="calendar-date-title fw-bold fs-6" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>
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
                          ? (isDark ? 'rgba(245, 158, 11, 0.28)' : '#FEF3C7')
                          : selectedInfo.stageTone === 'nursery'
                          ? (isDark ? 'rgba(16, 185, 129, 0.28)' : '#DCFCE7')
                          : selectedInfo.stageTone === 'growout'
                          ? (isDark ? 'rgba(59, 130, 246, 0.28)' : '#DBEAFE')
                          : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6'),
                      color:
                        selectedInfo.stageTone === 'transfer'
                          ? (isDark ? '#FCD34D' : '#92400E')
                          : selectedInfo.stageTone === 'nursery'
                          ? (isDark ? '#4ADE80' : '#14532D')
                          : selectedInfo.stageTone === 'growout'
                          ? (isDark ? '#93C5FD' : '#1E40AF')
                          : (isDark ? '#CBD5E1' : '#334155'),
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.06)',
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
                        ? '#D97706'
                        : selectedInfo.stageTone === 'nursery'
                        ? '#059669'
                        : selectedInfo.stageTone === 'growout'
                        ? '#2563EB'
                        : '#4B5563',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    letterSpacing: '0.03em',
                  }}
                >
                  {selectedInfo.stage}
                </span>
              </div>
              <p className="calendar-feed-desc small mb-0 mt-1" style={{ fontSize: '0.84rem', color: isDark ? '#CBD5E1' : '#334155' }}>
                {selectedInfo.feedDesc}
              </p>
            </div>

            <div className="text-start text-sm-end mt-2 mt-sm-0">
              <span className="extra-small d-block text-uppercase fw-bold" style={{ color: isDark ? '#94A3B8' : '#475569', letterSpacing: '0.04em' }}>
                Required Formulation
              </span>
              <strong
                className="fs-6 fw-bold"
                style={{
                  color:
                    selectedInfo.feedType === 'Starter'
                      ? (isDark ? '#34D399' : '#047857')
                      : selectedInfo.feedType === 'Grower'
                      ? (isDark ? '#60A5FA' : '#1D4ED8')
                      : (isDark ? '#94A3B8' : '#475569'),
                }}
              >
                {selectedInfo.stageTone === 'upcoming'
                  ? 'Upcoming (No Records Yet)'
                  : selectedInfo.feedType !== 'None' && selectedInfo.feedType !== 'Upcoming'
                  ? `Tateh – ${selectedInfo.feedType}`
                  : 'No Feed Scheduled'}
              </strong>
            </div>
          </div>

          {/* Detailed Feeding Slots Breakdown on this Date */}
          {selectedInfo.logs && selectedInfo.logs.length > 0 ? (
            <div className="mt-3 pt-3 border-top" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)' }}>
              <div className="d-flex justify-content-between align-items-center mb-2.5 flex-wrap gap-2">
                <div className="extra-small fw-bold text-uppercase d-flex align-items-center gap-1.5" style={{ color: isDark ? '#CBD5E1' : '#334155', letterSpacing: '0.04em' }}>
                  <FaClock className="text-primary flex-shrink-0" size={12} />
                  <span>Feeding Slots Breakdown ({selectedInfo.logs.length} of 5 slots logged):</span>
                </div>
                <div
                  className="badge rounded-pill border px-3 py-1.5 shadow-xs fw-bold d-inline-flex align-items-center gap-2"
                  style={{
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    color: isDark ? '#F1F5F9' : '#0F172A',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#CBD5E1',
                    fontSize: '0.8rem',
                  }}
                >
                  <span style={{ color: isDark ? '#CBD5E1' : '#475569' }}>Total Daily Mass:</span>
                  <span className="font-mono fw-extrabold" style={{ color: '#FC563C' }}>{selectedInfo.totalDayKg.toFixed(2)} kg</span>
                  <span className="font-mono fw-normal" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>({Math.round(selectedInfo.totalDayGrams).toLocaleString()} g)</span>
                </div>
              </div>

              {/* Mobile scroll hint */}
              <div className="d-block d-md-none text-end extra-small mb-1.5 fst-italic" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                Scroll horizontally to see all columns &rarr;
              </div>

              <div
                className="table-responsive rounded-3 shadow-xs custom-scrollbar"
                style={{
                  overflowX: 'auto',
                  maxWidth: '100%',
                  maxHeight: 290,
                  overflowY: 'auto',
                  backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
                }}
              >
                <table
                  className="table align-middle mb-0"
                  style={{
                    fontSize: '0.83rem',
                    minWidth: '780px',
                    tableLayout: 'auto',
                    backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                    color: isDark ? '#F1F5F9' : '#0F172A',
                  }}
                >
                  <thead style={{ backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }}>
                    <tr className="extra-small text-uppercase">
                      <th className="ps-3 py-2.5" style={{ width: '130px', whiteSpace: 'nowrap', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Time Slot</th>
                      <th className="py-2.5" style={{ width: '160px', whiteSpace: 'nowrap', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Mass (Grams / Kg)</th>
                      <th className="py-2.5" style={{ width: '150px', whiteSpace: 'nowrap', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Feed Formulation</th>
                      <th className="py-2.5" style={{ width: '200px', whiteSpace: 'nowrap', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Vitamins &amp; Supplements</th>
                      <th className="py-2.5" style={{ minWidth: '220px', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Notes / Status</th>
                      <th className="pe-3 py-2.5" style={{ width: '140px', whiteSpace: 'nowrap', backgroundColor: isDark ? '#1E293B' : '#F8FAFC', color: isDark ? '#94A3B8' : '#64748B', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0' }}>Caretaker</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInfo.logs.map((log, i) => {
                      const kg = parseFloat(log.amount_kg) || 0;
                      const g = log.amount_grams !== null && log.amount_grams !== undefined ? parseFloat(log.amount_grams) : Math.round(kg * 1000);
                      const isZeroFeed = kg === 0 && g === 0;

                      return (
                        <tr
                          key={log.id || i}
                          style={{
                            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #F1F5F9',
                            backgroundColor: isDark ? '#172A39' : '#FFFFFF',
                          }}
                        >
                          <td className="ps-3" style={{ backgroundColor: 'transparent' }}>
                            <span
                              className="badge border rounded-pill px-2.5 py-1 font-mono fw-bold d-inline-flex align-items-center"
                              style={{
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                                color: isDark ? '#FFFFFF' : '#0F172A',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                              }}
                            >
                              <FaClock className="text-primary me-1" size={10} />
                              {log.feeding_time}
                            </span>
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            {isZeroFeed ? (
                              <span
                                className="badge border"
                                style={{
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                                  color: isDark ? '#94A3B8' : '#64748B',
                                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                                }}
                              >
                                0 g (No feed logged)
                              </span>
                            ) : (
                              <div>
                                <strong className="font-mono" style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}>{g.toLocaleString()} g</strong>
                                <span className="extra-small font-mono fw-semibold ms-1" style={{ color: '#FC563C' }}>({kg.toFixed(2)} kg)</span>
                              </div>
                            )}
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            <span className="fw-semibold" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>
                              {log.feed_type || log.product_code || 'Starter'}
                            </span>
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            {log.vitamin_name && log.vitamin_name !== 'None' ? (
                              <span
                                className="badge rounded-pill px-2.5 py-1 extra-small fw-bold d-inline-flex align-items-center gap-1"
                                style={{
                                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
                                  color: isDark ? '#34D399' : '#047857',
                                  border: isDark ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid #A7F3D0',
                                }}
                              >
                                <FaCapsules size={9} />
                                {log.vitamin_name}
                              </span>
                            ) : (
                              <span className="extra-small" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>None</span>
                            )}
                          </td>
                          <td style={{ backgroundColor: 'transparent' }}>
                            {renderStructuredNotes(log.notes, isZeroFeed, isDark)}
                          </td>
                          <td className="pe-3" style={{ backgroundColor: 'transparent' }}>
                            <span
                              className="badge border extra-small"
                              style={{
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                                color: isDark ? '#CBD5E1' : '#475569',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                              }}
                            >
                              {log.recorded_by_name || log.recorded_by || 'Caretaker'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-3 pt-2 border-top text-center extra-small py-2" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0', color: isDark ? '#94A3B8' : '#64748B' }}>
              No feeding records logged for {selectedInfo.dateStr} yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
