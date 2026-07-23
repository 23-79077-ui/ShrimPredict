import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Swal from 'sweetalert2';

const feedingTimes = ['06:00 AM', '12:00 PM', '06:00 PM'];
const productCodes = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5'];
const emptyForm = {
  feedingTime: '06:00 AM',
  amountKg: '',
  productCode: 'PO1',
  hasVitamin: false,
  notes: '',
};

export default function MyPondPage() {
  const { user } = useAuth();
  const assignedPonds = user?.assigned_ponds?.length
    ? user.assigned_ponds
    : (user?.pond_id ? [{ id: user.pond_id, pond_name: 'Assigned Pond', status: 'Healthy' }] : []);
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
      const payload = new FormData();
      payload.append('pond_id', String(selectedPond.id));
      payload.append('amount_kg', String(amount));
      payload.append('feeding_time', form.feedingTime);
      payload.append('product_code', form.productCode);
      payload.append('has_vitamin', form.hasVitamin ? '1' : '0');
      payload.append('notes', form.notes || '');
      payload.append('record_date', new Date().toISOString().split('T')[0]);
      payload.append('recorded_by', user?.full_name || 'Caretaker');
      payload.append('recorded_by_name', user?.full_name || 'Caretaker');
      payload.append('user_id', String(user?.id || 0));

      const response = await api.post('/feeding_records.php', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const responseData = response?.data && typeof response.data === 'object' ? response.data : {};
      if (!responseData.success && responseData.message) {
        throw new Error(responseData.message);
      }
      if (!responseData.success) {
        throw new Error('Unable to save feeding record.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('shrim-feed-updated', String(Date.now()));
        window.dispatchEvent(new Event('shrim-feed-updated'));
      }

      Swal.fire({ icon: 'success', title: 'Feeding logged', text: 'Your feeding record has been saved.' });
      setFormState((prev) => ({
        ...prev,
        [selectedPond.id]: {
          ...emptyForm,
        },
      }));
    } catch (error) {
      const backendMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unable to save feeding record.';
      console.error('Feeding save error', error);
      Swal.fire({ icon: 'error', title: 'Save failed', text: backendMessage });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h3 className="fw-bold mb-1">My Ponds</h3>
          <p className="text-muted mb-0">Choose a pond from the dropdown below and log its feeding entry.</p>
        </div>
      </div>

      {assignedPonds.length > 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="mb-4">
              <label className="form-label fw-semibold">Select pond to log</label>
              <select
                className="form-select"
                value={selectedPondId}
                onChange={(e) => setSelectedPondId(e.target.value)}
              >
                {assignedPonds.map((pond) => (
                  <option key={pond.id} value={pond.id}>
                    {pond.pond_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedPond ? (
              <>
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">{selectedPond.pond_name}</h5>
                    <small className="text-muted">Feeding brand: Tateh</small>
                  </div>
                  <span className={`badge ${selectedPond.status === 'Healthy' ? 'bg-success' : selectedPond.status === 'Warning' ? 'bg-warning' : 'bg-danger'}`}>
                    {selectedPond.status}
                  </span>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-6"><div className="border rounded p-3"><small>Temperature</small><div className="fw-bold">{selectedPond.temperature}°C</div></div></div>
                  <div className="col-6"><div className="border rounded p-3"><small>pH</small><div className="fw-bold">{selectedPond.ph_level}</div></div></div>
                  <div className="col-6"><div className="border rounded p-3"><small>Salinity</small><div className="fw-bold">{selectedPond.salinity} ppt</div></div></div>
                  <div className="col-6"><div className="border rounded p-3"><small>Water Level</small><div className="fw-bold">{selectedPond.water_level} m</div></div></div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Feeding time</label>
                  <select className="form-select" value={currentForm.feedingTime} onChange={(e) => handleChange('feedingTime', e.target.value)}>
                    {feedingTimes.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Amount (kg)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="form-control"
                    value={currentForm.amountKg}
                    onChange={(e) => handleChange('amountKg', e.target.value)}
                    placeholder="Enter amount in kilograms"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Product code</label>
                  <select className="form-select" value={currentForm.productCode} onChange={(e) => handleChange('productCode', e.target.value)}>
                    {productCodes.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                  <small className="text-muted">Use Tateh feed product code PO1–PO5.</small>
                </div>

                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`vitamin-${selectedPond.id}`}
                    checked={currentForm.hasVitamin}
                    onChange={(e) => handleChange('hasVitamin', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor={`vitamin-${selectedPond.id}`}>
                    Add vitamin to this feeding
                  </label>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">Notes (optional)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={currentForm.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="Add a note if needed"
                  />
                </div>

                <button type="button" className="btn btn-primary w-100" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? 'Saving…' : 'Log Feeding'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <p className="text-muted mb-0">No ponds assigned to you yet. Please contact your admin.</p>
          </div>
        </div>
      )}
    </div>
  );
}

