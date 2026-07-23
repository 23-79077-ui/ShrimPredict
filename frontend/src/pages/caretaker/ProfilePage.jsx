import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <h3 className="fw-bold mb-3">Profile</h3>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <p>Manage personal profile details and notification preferences.</p>
          <div className="mt-3">
            <label className="form-label">Full Name</label>
            <input className="form-control" value={user?.full_name || user?.name || ''} readOnly />
          </div>
          <div className="mt-3">
            <label className="form-label">Email</label>
            <input className="form-control" value={user?.email || ''} readOnly />
          </div>
          <div className="mt-3">
            <label className="form-label">Phone</label>
            <input className="form-control" value={user?.phone || 'Not provided'} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
}
