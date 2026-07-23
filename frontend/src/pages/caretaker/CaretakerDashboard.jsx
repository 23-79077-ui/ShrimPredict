import { useAuth } from '../../context/AuthContext';

export default function CaretakerDashboard() {
  const { user } = useAuth();
  const assignedPonds = user?.assigned_ponds || [];

  return (
    <div>
      <h3 className="fw-bold mb-3">Caretaker Dashboard</h3>
      <div className="row g-3">

        {/* Assigned Ponds Card */}
        <div className="col-md-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5>My Assigned Ponds</h5>
              {assignedPonds.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {assignedPonds.map((pond) => (
                    <span key={pond.id} className={`badge fs-6 px-3 py-2 ${pond.status === 'Healthy' ? 'bg-success bg-opacity-10 text-success' : pond.status === 'Warning' ? 'bg-warning bg-opacity-10 text-warning' : 'bg-danger bg-opacity-10 text-danger'}`}>
                      {pond.pond_name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0 mt-2">No ponds assigned yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5>Today's Feeding</h5>
              <p className="text-muted">Feeding schedules for your ponds</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5>Latest Disease Scan</h5>
              <p className="text-muted">No critical issues detected</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5>Latest Alerts</h5>
              <p className="text-muted">Water level is slightly below target</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
