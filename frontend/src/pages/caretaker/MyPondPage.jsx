import { useEffect, useMemo, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaPlus,
  FaWater,
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const feedingTimes = ['6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM'];
const productCodes = ['Starter', 'Grower'];
const vitaminOptions = ['None', 'Sanolife PRO-2', 'Sano Top-S'];
const emptyForm = {
  feedingTime: '6:00 AM',
  amountKg: '',
  productCode: 'Starter',
  vitaminName: 'None',
  notes: '',
};

export default function MyPondPage() {
  const { user } = useAuth();
  const assignedPonds = useMemo(() => (
    user?.assigned_ponds?.length
      ? user.assigned_ponds
      : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : [])
  ), [user?.assigned_ponds, user?.pond_id]);

  const [selectedPondId, setSelectedPondId] = useState('');
  const [formState, setFormState] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!assignedPonds.length) {
      setSelectedPondId('');
      return;
    }

    const currentPondExists = assignedPonds.some((pond) => String(pond.id) === String(selectedPondId));
    if (!currentPondExists) {
      setSelectedPondId(String(assignedPonds[0].id));
    }
  }, [assignedPonds, selectedPondId]);

  const selectedPond = assignedPonds.find((pond) => String(pond.id) === String(selectedPondId)) || assignedPonds[0] || null;
  const currentForm = formState[selectedPondId] || emptyForm;

  // Fetch today's feeding logs for the active pond
  const fetchTodayLogs = useCallback(async (pondId) => {
    if (!pondId) return;
    try {
      const res = await api.get('/feeding_records.php', {
        params: {
          pond_id: pondId,
          date: todayDateStr,
        },
      });
      if (Array.isArray(res.data)) {
        setTodayLogs(res.data);
      } else {
        setTodayLogs([]);
      }
    } catch (e) {
      console.error('Error fetching today feeding logs:', e);
      setTodayLogs([]);
    }
  }, [todayDateStr]);

  useEffect(() => {
    if (!selectedPondId) return;
    fetchTodayLogs(selectedPondId);

    const handleUpdate = () => fetchTodayLogs(selectedPondId);
    window.addEventListener('shrim-feed-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('shrim-feed-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedPondId, fetchTodayLogs]);

  // Extract list of feeding_time strings logged today for the active pond
  const loggedTimesForPond = useMemo(() => {
    return todayLogs.map((log) => log.feeding_time);
  }, [todayLogs]);

  // Auto-select first un-logged feeding time slot when changing pond or after log submission
  useEffect(() => {
    if (!selectedPondId) return;
    const availableSlot = feedingTimes.find((time) => !loggedTimesForPond.includes(time));
    if (availableSlot) {
      setFormState((prev) => ({
        ...prev,
        [selectedPondId]: {
          ...(prev[selectedPondId] || emptyForm),
          feedingTime: availableSlot,
        },
      }));
    }
  }, [selectedPondId, loggedTimesForPond]);

  const handleChange = (field, value) => {
    if (!selectedPondId) return;

    setFormState((prev) => ({
      ...prev,
      [selectedPondId]: {
        ...(prev[selectedPondId] || emptyForm),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedPond) return;

    const form = formState[selectedPondId] || emptyForm;
    const amount = parseFloat(form.amountKg);
    if (!amount || amount <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid amount', text: 'Please enter a valid feeding amount in kilograms.' });
      return;
    }

    if (loggedTimesForPond.includes(form.feedingTime)) {
      Swal.fire({ icon: 'warning', title: 'Time Slot Already Logged', text: `Feeding record for ${form.feedingTime} has already been logged today for ${selectedPond.pond_name}.` });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pond_id: Number(selectedPond.id),
        amount_kg: amount,
        feeding_time: form.feedingTime || '6:00 AM',
        product_code: form.productCode || 'Starter',
        vitamin_name: form.vitaminName || 'None',
        has_vitamin: form.vitaminName && form.vitaminName !== 'None' ? 1 : 0,
        notes: form.notes || '',
        record_date: todayDateStr,
        recorded_by: user?.full_name || 'Caretaker',
        recorded_by_name: user?.full_name || 'Caretaker',
        user_id: Number(user?.id || 0),
      };

      const response = await api.post('/feeding_records.php', payload);
      const responseData = response?.data && typeof response.data === 'object' ? response.data : {};
      if (!responseData.success && responseData.message) throw new Error(responseData.message);
      if (!responseData.success) throw new Error('Unable to save feeding record.');

      if (typeof window !== 'undefined') {
        localStorage.setItem('shrim-feed-updated', String(Date.now()));
        localStorage.setItem('shrim-notification-updated', String(Date.now()));
        window.dispatchEvent(new Event('shrim-feed-updated'));
        window.dispatchEvent(new Event('shrim-notification-updated'));
      }

      Swal.fire({ icon: 'success', title: 'Feeding Logged!', text: `Successfully saved ${amount} kg feeding record for ${selectedPond.pond_name} at ${form.feedingTime}.` });

      setFormState((prev) => ({
        ...prev,
        [selectedPond.id]: { ...emptyForm, amountKg: '', notes: '' },
      }));

      // Immediately refresh today's feeding logs to cross out the newly logged slot
      await fetchTodayLogs(selectedPond.id);
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unable to save feeding record.';
      console.error('Feeding save error', error);
      Swal.fire({ icon: 'error', title: 'Save failed', text: backendMessage });
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignedPonds.length) {
    return (
      <div className="caretaker-mypond-page">
        <div className="caretaker-empty-state">
          <p className="text-muted mb-0">No ponds assigned to you yet. Please contact your admin.</p>
        </div>
      </div>
    );
  }

  const allSlotsCompleted = feedingTimes.every((time) => loggedTimesForPond.includes(time));

  return (
    <div className="caretaker-mypond-page">
      {/* Hero Workspace Header */}
      <section className="caretaker-dashboard-hero caretaker-mypond-hero mb-4">
        <div>
          <span className="caretaker-dashboard-kicker">Pond Feeding Workspace</span>
          <h3>{selectedPond?.pond_name || 'My Pond'}</h3>
          <p>Select an assigned pond tab below to log real feeding records and manage daily schedules.</p>
          <div className="caretaker-hero-meta">
            <span>{assignedPonds.length} assigned pond(s)</span>
            <span>Tateh {currentForm.productCode}</span>
            <span>{currentForm.feedingTime}</span>
          </div>
        </div>
      </section>

      {/* 3 Pond Selector Tabs (Pond A1, Pond A2, Pond A3) */}
      <div className="caretaker-pond-tabs mb-4">
        {assignedPonds.map((pond) => (
          <button
            type="button"
            key={pond.id}
            className={String(pond.id) === String(selectedPondId) ? 'active' : ''}
            onClick={() => setSelectedPondId(String(pond.id))}
          >
            <FaWater className="me-1.5" />
            {pond.pond_name}
          </button>
        ))}
      </div>

      {/* Main Feeding Form Panel Card */}
      <div className="card caretaker-panel-card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="caretaker-panel-header d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-1">Log Feeding Entry</h5>
              <p className="text-muted small mb-0">
                Save a real feeding record for <strong className="text-primary">{selectedPond?.pond_name || 'this pond'}</strong>.
              </p>
            </div>
            <div className="caretaker-history-total d-flex align-items-center gap-2 bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill extra-small fw-semibold">
              <FaClipboardList />
              <span>{loggedTimesForPond.length} of 5 scheduled times completed today</span>
            </div>
          </div>

          {/* Time Slot Buttons with Cross-Out / Disabled Logic for Completed Daily Slots */}
          <div className="caretaker-feeding-time-grid mb-4">
            {feedingTimes.map((time) => {
              const isLoggedToday = loggedTimesForPond.includes(time);
              const isSelected = currentForm.feedingTime === time;

              return (
                <button
                  type="button"
                  key={time}
                  disabled={isLoggedToday}
                  className={`btn-time-slot ${isSelected ? 'active' : ''} ${isLoggedToday ? 'logged-crossed-out' : ''}`}
                  style={
                    isLoggedToday
                      ? {
                          textDecoration: 'line-through',
                          opacity: 0.65,
                          cursor: 'not-allowed',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          borderColor: '#cbd5e1',
                          pointerEvents: 'none',
                        }
                      : {}
                  }
                  onClick={() => !isLoggedToday && handleChange('feedingTime', time)}
                  title={isLoggedToday ? `${time} already logged today` : `Select ${time}`}
                >
                  {isLoggedToday ? (
                    <FaCheckCircle className="text-success me-1 fs-6" />
                  ) : (
                    <FaClock className="me-1 opacity-75" />
                  )}
                  <span className={isLoggedToday ? 'text-decoration-line-through text-muted fw-bold' : 'fw-bold'}>
                    {time}
                  </span>
                </button>
              );
            })}
          </div>

          {allSlotsCompleted && (
            <div className="alert alert-success d-flex align-items-center gap-2 p-3 mb-4 rounded-3">
              <FaCheckCircle className="fs-5 text-success flex-shrink-0" />
              <div>
                <strong className="d-block">All Daily Feeding Slots Logged!</strong>
                <span className="small">All 5 scheduled daily feeding times for {selectedPond?.pond_name} have been recorded for today.</span>
              </div>
            </div>
          )}

          {/* 3-Column Responsive Grid Form (Amount kg, Product Code, Vitamins) - Selected Pond Removed */}
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Amount (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="form-control form-control-lg fs-6"
                value={currentForm.amountKg}
                onChange={(event) => handleChange('amountKg', event.target.value)}
                placeholder="Enter amount in kilograms"
                disabled={allSlotsCompleted}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Product Code</label>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.productCode}
                onChange={(event) => handleChange('productCode', event.target.value)}
                disabled={allSlotsCompleted}
              >
                {productCodes.map((code) => (
                  <option key={code} value={code}>
                    {code} (Tateh)
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small">Starter or Grower only.</small>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold text-dark">Vitamins</label>
              <select
                className="form-select form-select-lg fs-6"
                value={currentForm.vitaminName || 'None'}
                onChange={(event) => handleChange('vitaminName', event.target.value)}
                disabled={allSlotsCompleted}
              >
                {vitaminOptions.map((vit) => (
                  <option key={vit} value={vit}>
                    {vit === 'None' ? 'None (No Vitamin)' : vit}
                  </option>
                ))}
              </select>
              <small className="text-muted extra-small">Sanolife PRO-2 or Sano Top-S.</small>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold text-dark">Notes (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={currentForm.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              placeholder="Add a note if needed"
              disabled={allSlotsCompleted}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg w-100 py-3 fw-bold caretaker-log-button d-flex align-items-center justify-content-center gap-2"
            disabled={submitting || allSlotsCompleted}
            onClick={handleSubmit}
          >
            {submitting ? (
              'Saving...'
            ) : (
              <>
                <FaPlus /> Log Feeding for {selectedPond?.pond_name || 'Selected Pond'} ({currentForm.feedingTime})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
