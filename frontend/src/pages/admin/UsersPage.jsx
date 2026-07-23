import { useEffect, useState } from 'react';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    selected_ponds: [],
  });

  const loadUsers = async () => {
    try {
      const res = await api.get('/users.php');
      const data = res.data;
      setUsers(safeArray(data.users || data));
      setPonds(safeArray(data.ponds || []));
    } catch (error) {
      setUsers([]);
      setPonds([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getAssignedInfo = (pond) => {
    let assignedUserId = pond.assigned_user_id ? Number(pond.assigned_user_id) : null;
    let assignedUserName = pond.assigned_user_name || null;

    for (const u of users) {
      if (u.role === 'caretaker') {
        const ids = (u.assigned_pond_ids || []).map(Number);
        if (u.pond_id) ids.push(Number(u.pond_id));
        if (ids.includes(Number(pond.id))) {
          assignedUserId = Number(u.id);
          assignedUserName = u.full_name;
          break;
        }
      }
    }

    if (!assignedUserId) return { isAssignedToOther: false, assignedUserName: null };

    const isOther = editingUser ? Number(editingUser.id) !== assignedUserId : true;
    return {
      isAssignedToOther: isOther,
      assignedUserName: isOther ? assignedUserName : null,
    };
  };

  const handlePondToggle = (pondId) => {
    const targetPond = ponds.find((p) => p.id === pondId);
    if (targetPond) {
      const { isAssignedToOther } = getAssignedInfo(targetPond);
      if (isAssignedToOther) return;
    }

    setFormData((prev) => {
      const selected = [...prev.selected_ponds];
      const index = selected.indexOf(pondId);
      if (index > -1) {
        selected.splice(index, 1);
      } else {
        if (selected.length >= 3) {
          Swal.fire({ icon: 'warning', title: 'Limit reached', text: 'Maximum of 3 ponds per caretaker only.' });
          return prev;
        }
        selected.push(pondId);
      }
      return { ...prev, selected_ponds: selected };
    });
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ full_name: '', email: '', password: '', confirm_password: '', selected_ponds: [] });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: '',
      confirm_password: '',
      selected_ponds: user.assigned_pond_ids || [],
    });
    setShowModal(true);
  };

  const handleCreateCaretaker = async (e) => {
    e.preventDefault();

    if (!editingUser && formData.password !== formData.confirm_password) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Passwords do not match.' });
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Password must be at least 6 characters.' });
      return;
    }

    try {
      let userId;

      if (editingUser) {
        // Update existing caretaker - just update pond assignments
        userId = editingUser.id;
      } else {
        // Create new caretaker
        const firstPondId = formData.selected_ponds.length > 0 ? formData.selected_ponds[0] : null;
        const res = await api.post('/users.php', {
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          pond_id: firstPondId,
        });

        if (!res.data.success) {
          throw new Error(res.data.message || 'Failed to create caretaker');
        }
        userId = res.data.user.id;
      }

      // Assign ponds via caretaker_ponds.php
      if (userId) {
        await api.post('/caretaker_ponds.php', {
          user_id: userId,
          pond_ids: formData.selected_ponds,
        });
      }

      Swal.fire({
        icon: 'success',
        title: editingUser ? 'Updated!' : 'Success!',
        text: editingUser ? 'Caretaker pond assignments updated!' : 'Caretaker account created successfully!',
      });

      setShowModal(false);
      loadUsers();
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Operation failed.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }
  };

  return (
    <div>
      <div className="table-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="card-title">User Accounts</h5>
              <p className="text-muted mb-0">Administrators and pond caretakers.</p>
            </div>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Create Caretaker
            </button>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Assigned Ponds</th><th>Action</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td><span className="badge bg-primary bg-opacity-10 text-primary">{user.role}</span></td>
                    <td><span className={`badge ${user.status === 'Active' ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}`}>{user.status}</span></td>
                    <td>
                      {user.assigned_ponds && user.assigned_ponds.length > 0
                        ? user.assigned_ponds.map(p => p.pond_name).join(', ')
                        : user.pond_name || '—'}
                    </td>
                    <td>
                      {user.role === 'caretaker' && (
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(user)}>
                          Assign Ponds
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan="6" className="text-center text-muted py-4">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Caretaker Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-bold mb-0">{editingUser ? 'Assign Ponds to Caretaker' : 'Create Caretaker Account'}</h4>
              <button className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <form onSubmit={handleCreateCaretaker}>
              {!editingUser && (
                <>
                  <div className="mb-3">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-control" name="full_name" value={formData.full_name} onChange={handleInputChange} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email Address</label>
                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input type="password" className="form-control" name="password" value={formData.password} onChange={handleInputChange} required minLength={6} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirm Password</label>
                    <input type="password" className="form-control" name="confirm_password" value={formData.confirm_password} onChange={handleInputChange} required minLength={6} />
                  </div>
                </>
              )}
              {editingUser && (
                <div className="mb-3 p-3 bg-light rounded-3">
                  <p className="fw-bold mb-1">{editingUser.full_name}</p>
                  <p className="text-muted small mb-0">{editingUser.email}</p>
                </div>
              )}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  Assign Ponds <span className="text-muted fw-normal">(max 3)</span>
                </label>
                <div className="pond-checkbox-grid">
                  {ponds.map((pond) => {
                    const { isAssignedToOther, assignedUserName } = getAssignedInfo(pond);
                    const isChecked = formData.selected_ponds.includes(pond.id);

                    return (
                      <label
                        key={pond.id}
                        className={`pond-checkbox-item ${isChecked ? 'checked' : ''} ${isAssignedToOther ? 'disabled-assigned' : ''}`}
                        title={isAssignedToOther ? `Assigned to ${assignedUserName || 'another caretaker'}` : ''}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={isChecked}
                          disabled={isAssignedToOther}
                          onChange={() => !isAssignedToOther && handlePondToggle(pond.id)}
                        />
                        <span className={`pond-label-text ${isAssignedToOther ? 'crossed-out' : ''}`}>
                          {pond.pond_name}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <small className="text-muted">
                    Selected: {formData.selected_ponds.length}/3 ponds
                  </small>
                </div>
              </div>
              <div className="d-flex gap-3 justify-content-end">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Save Assignments' : 'Create Caretaker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal + Grid Styles */}
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1050;
          padding: 1rem;
        }
        .modal-content {
          background: white;
          border-radius: 1.5rem;
          padding: 2rem;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 40px 100px rgba(0,0,0,0.2);
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content .btn-close {
          font-size: 1.2rem;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .pond-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .pond-checkbox-item {
          display: flex;
          align-items: center;
          padding: 0.65rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(11,44,95,0.14);
          background: #fbfcfe;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.9rem;
        }
        .pond-checkbox-item:hover {
          border-color: var(--primary);
          background: rgba(11,44,95,0.04);
        }
        .pond-checkbox-item.checked {
          border-color: var(--primary);
          background: rgba(11,44,95,0.08);
          font-weight: 600;
        }
        .pond-checkbox-item.disabled-assigned {
          background: #f1f3f5;
          border-color: #dee2e6;
          cursor: not-allowed;
          opacity: 0.65;
        }
        .pond-checkbox-item.disabled-assigned:hover {
          border-color: #dee2e6;
          background: #f1f3f5;
        }
        .pond-label-text.crossed-out {
          text-decoration: line-through;
          color: #8c98a4;
        }
        .pond-checkbox-item input {
          margin: 0;
        }
        @media (max-width: 500px) {
          .pond-checkbox-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
