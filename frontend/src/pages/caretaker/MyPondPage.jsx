import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaFlask,
  FaLeaf,
  FaPlus,
  FaThermometerHalf,
  FaTint,
  FaUtensils,
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
  const pondStatus = selectedPond?.status || 'Healthy';
  const statusClass = pondStatus === 'Healthy' ? 'healthy' : pondStatus === 'Warning' ? 'warning' : 'danger';

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
        record_date: new Date().toISOString().split('T')[0],
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

      Swal.fire({ icon: 'success', title: 'Feeding logged', text: 'Your feeding record has been saved.' });
      setFormState((prev) => ({
        ...prev,
        [selectedPond.id]: { ...emptyForm },
      }));
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

  return (
    <div className="caretaker-mypond-page">
      <section className="caretaker-dashboard-hero caretaker-mypond-hero">
        <div>
          <span className="caretaker-dashboard-kicker">Pond Feeding Workspace</span>
          <h3>{selectedPond?.pond_name || 'My Pond'}</h3>
          <p>Select an assigned pond, review its latest water details, and submit the correct feeding log.</p>
          <div className="caretaker-hero-meta">
            <span>{assignedPonds.length} assigned pond(s)</span>
            <span>Tateh {currentForm.productCode}</span>
            <span>{currentForm.feedingTime}</span>
          </div>
        </div>
        <div className="caretaker-mypond-selector">
          <label><FaWater /> Select Pond</label>
          <select
            className="form-select form-select-sm fw-semibold"
            value={selectedPondId}
            onChange={(event) => setSelectedPondId(event.target.value)}
          >
            {assignedPonds.map((pond) => (
              <option key={pond.id} value={pond.id}>
                {pond.pond_name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="caretaker-pond-tabs">
        {assignedPonds.map((pond) => (
          <button
            type="button"
            key={pond.id}
            className={String(pond.id) === String(selectedPondId) ? 'active' : ''}
            onClick={() => setSelectedPondId(String(pond.id))}
          >
            {pond.pond_name}
          </button>
        ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className={`card caretaker-pond-metric ${statusClass} h-100`}>
            <div className="card-body">
              <span><FaCheckCircle /> Status</span>
              <strong>{pondStatus}</strong>
              <small>Current pond condition</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-pond-metric h-100">
            <div className="card-body">
              <span><FaThermometerHalf /> Temperature</span>
              <strong>{selectedPond?.temperature ?? '-'} C</strong>
              <small>Recommended: 26 C to 32 C</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-pond-metric h-100">
            <div className="card-body">
              <span><FaFlask /> pH Level</span>
              <strong>{selectedPond?.ph_level ?? '-'}</strong>
              <small>Keep readings stable</small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card caretaker-pond-metric h-100">
            <div className="card-body">
              <span><FaTint /> Salinity / Level</span>
              <strong>{selectedPond?.salinity ?? '-'} ppt</strong>
              <small>Water level: {selectedPond?.water_level ?? '-'} m</small>
            </div>
          </div>
        </div>
      </div>

      <div className="card caretaker-panel-card">
        <div className="card-body">
          <div className="caretaker-panel-header">
            <div>
              <h5>Log Feeding Entry</h5>
              <small className="text-muted">Save a real feeding record for {selectedPond?.pond_name || 'this pond'}.</small>
            </div>
            <div className="caretaker-history-total">
              <FaClipboardList />
              <span>5 scheduled times daily</span>
            </div>
          </div>

          <div className="caretaker-feeding-time-grid mb-4">
            {feedingTimes.map((time) => (
              <button
                type="button"
                key={time}
                className={currentForm.feedingTime === time ? 'active' : ''}
                onClick={() => handleChange('feedingTime', time)}
              >
                <FaClock />
                <span>{time}</span>
              </button>
            ))}
          </div>

          <div className="caretaker-feed-form-grid">
            <div>
              <label className="form-label fw-semibold">Amount (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="form-control"
                value={currentForm.amountKg}
                onChange={(event) => handleChange('amountKg', event.target.value)}
                placeholder="Enter amount in kilograms"
              />
            </div>

            <div>
              <label className="form-label fw-semibold">Product Code</label>
              <select className="form-select" value={currentForm.productCode} onChange={(event) => handleChange('productCode', event.target.value)}>
                {productCodes.map((code) => (
                  <option key={code} value={code}>
                    {code} (Tateh)
                  </option>
                ))}
              </select>
              <small className="text-muted">Starter or Grower only.</small>
            </div>

            <div>
              <label className="form-label fw-semibold">Vitamins</label>
              <select className="form-select" value={currentForm.vitaminName || 'None'} onChange={(event) => handleChange('vitaminName', event.target.value)}>
                {vitaminOptions.map((vit) => (
                  <option key={vit} value={vit}>
                    {vit === 'None' ? 'None (No Vitamin)' : vit}
                  </option>
                ))}
              </select>
              <small className="text-muted">Sanolife PRO-2 or Sano Top-S.</small>
            </div>

            <div>
              <label className="form-label fw-semibold">Selected Pond</label>
              <div className="caretaker-selected-pond-box">
                <FaWater />
                <span>{selectedPond?.pond_name || 'Assigned Pond'}</span>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label fw-semibold">Notes (optional)</label>
            <textarea
              className="form-control"
              rows="3"
              value={currentForm.notes}
              onChange={(event) => handleChange('notes', event.target.value)}
              placeholder="Add a note if needed"
            />
          </div>

          <button type="button" className="btn btn-primary w-100 mt-4 caretaker-log-button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving...' : <><FaPlus /> Log Feeding</>}
          </button>
        </div>
      </div>
    </div>
  );
}
