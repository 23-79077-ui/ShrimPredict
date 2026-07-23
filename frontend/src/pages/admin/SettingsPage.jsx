export default function SettingsPage() {
  return (
    <div>
      <div className="info-card admin-compact-card">
        <div className="card-body">
          <h5 className="card-title mb-2">System Preferences</h5>
          <p className="text-muted mb-4">Configure alert rules and notification behavior.</p>
          <div className="admin-setting-list">
            <label className="admin-setting-row">
              <span>
                <strong>Disease notifications</strong>
                <small>Send alerts when new disease risk is detected.</small>
              </span>
              <input className="form-check-input" type="checkbox" defaultChecked />
            </label>
            <label className="admin-setting-row">
              <span>
                <strong>Feeding reminders</strong>
                <small>Notify caretakers before scheduled feeding windows.</small>
              </span>
              <input className="form-check-input" type="checkbox" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
