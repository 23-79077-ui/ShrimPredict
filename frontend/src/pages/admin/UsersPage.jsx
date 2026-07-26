import { useEffect, useState } from 'react';
import {
  FaUsers,
  FaUserShield,
  FaUserTie,
  FaCheckCircle,
  FaSearch,
  FaFilter,
  FaFileCsv,
  FaEye,
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaStar,
  FaUtensils,
  FaBug,
  FaCamera,
  FaCalendarCheck,
  FaChartLine,
  FaTimes,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaWater,
  FaCalendarAlt,
  FaClock
} from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

// Helper to format string to Title Case
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Avatar Gradient Color Palette Generator
function getAvatarBg(user) {
  if (user.role === 'admin') {
    return 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
  }
  const id = Number(user.id) || 1;
  const gradients = [
    'linear-gradient(135deg, #047857 0%, #10b981 100%)',
    'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)',
    'linear-gradient(135deg, #be185d 0%, #f43f5e 100%)'
  ];
  return gradients[id % gradients.length];
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [summary, setSummary] = useState({
    total_users: 5,
    admin_count: 1,
    caretaker_count: 4,
    active_count: 5
  });

  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pondFilter, setPondFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  // Modal States
  const [viewingUser, setViewingUser] = useState(null); // User Profile Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // Edit Caretaker Modal

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '09123456789',
    password: '',
    confirm_password: '',
    status: 'Active',
    selected_ponds: []
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users.php');
      const data = res.data;
      if (data && data.success) {
        setUsers(safeArray(data.users));
        setPonds(safeArray(data.ponds));
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter & Sort Logic
  const filteredUsers = users.filter((u) => {
    // 1. Search Query (Name, Email, Phone)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (u.full_name || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      const phoneMatch = (u.phone || '').toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !phoneMatch) return false;
    }

    // 2. Role Filter
    if (roleFilter !== 'All') {
      if (u.role !== roleFilter) return false;
    }

    // 3. Status Filter
    if (statusFilter !== 'All') {
      if (u.status !== statusFilter) return false;
    }

    // 4. Assigned Pond Filter
    if (pondFilter !== 'All') {
      const assignedIds = (u.assigned_pond_ids || []).map(Number);
      if (u.pond_id) assignedIds.push(Number(u.pond_id));
      if (!assignedIds.includes(Number(pondFilter))) return false;
    }

    return true;
  });

  // Sorting
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.full_name || '').localeCompare(b.full_name || '');
    }
    if (sortBy === 'role') {
      return (a.role || '').localeCompare(b.role || '');
    }
    return b.id - a.id; // Newest first by ID
  });

  // Export CSV Handler
  const handleExportCSV = () => {
    if (sortedUsers.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Data', text: 'No user data available to export.' });
      return;
    }

    const headers = ['Full Name', 'Email Address', 'Phone Number', 'Role', 'Status', 'Assigned Ponds', 'Date Created', 'Last Login'];
    const rows = sortedUsers.map((u) => {
      const pondsStr = u.assigned_ponds && u.assigned_ponds.length > 0
        ? u.assigned_ponds.map((p) => p.pond_name).join('; ')
        : u.pond_name || 'None';
      return [
        `"${toTitleCase(u.full_name) || ''}"`,
        `"${u.email || ''}"`,
        `"${u.phone || ''}"`,
        `"${u.role || ''}"`,
        `"${u.status || ''}"`,
        `"${pondsStr}"`,
        `"${u.date_created || ''}"`,
        `"${u.last_login || 'Today'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ShrimpPredict_Users_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      icon: 'success',
      title: 'CSV Exported',
      text: 'User list exported successfully.',
      timer: 1800,
      showConfirmButton: false
    });
  };

  // Helper for assigned pond availability check
  const getAssignedInfo = (pond) => {
    let assignedUserId = pond.assigned_user_id ? Number(pond.assigned_user_id) : null;
    let assignedUserName = pond.assigned_user_name || null;

    for (const u of users) {
      if (u.role === 'caretaker') {
        const ids = (u.assigned_pond_ids || []).map(Number);
        if (u.pond_id) ids.push(Number(u.pond_id));
        if (ids.includes(Number(pond.id))) {
          assignedUserId = Number(u.id);
          assignedUserName = toTitleCase(u.full_name);
          break;
        }
      }
    }

    if (!assignedUserId) return { isAssignedToOther: false, assignedUserName: null };
    const isOther = editingUser ? Number(editingUser.id) !== assignedUserId : true;
    return {
      isAssignedToOther: isOther,
      assignedUserName: isOther ? assignedUserName : null
    };
  };

  const handlePondToggle = (pondId) => {
    const targetPond = ponds.find((p) => Number(p.id) === Number(pondId));
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
          Swal.fire({ icon: 'warning', title: 'Limit Reached', text: 'Maximum of 3 ponds per caretaker only.' });
          return prev;
        }
        selected.push(pondId);
      }
      return { ...prev, selected_ponds: selected };
    });
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '09123456789',
      password: '',
      confirm_password: '',
      status: 'Active',
      selected_ponds: []
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      full_name: toTitleCase(user.full_name),
      email: user.email,
      phone: user.phone || '09123456789',
      password: '',
      confirm_password: '',
      status: user.status || 'Active',
      selected_ponds: user.assigned_pond_ids || []
    });
  };

  // Handle Save (Create or Update Caretaker)
  const handleSaveUser = async (e) => {
    e.preventDefault();

    if (!editingUser) {
      if (formData.password !== formData.confirm_password) {
        Swal.fire({ icon: 'error', title: 'Password Mismatch', text: 'Passwords do not match.' });
        return;
      }
      if (formData.password.length < 6) {
        Swal.fire({ icon: 'error', title: 'Weak Password', text: 'Password must be at least 6 characters.' });
        return;
      }
    }

    try {
      if (editingUser) {
        // Update User
        const res = await api.post('/users.php', {
          action: 'update_user',
          user_id: editingUser.id,
          full_name: toTitleCase(formData.full_name),
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          selected_ponds: formData.selected_ponds
        });

        if (res.data && res.data.success) {
          Swal.fire({ icon: 'success', title: 'User Updated', text: 'Caretaker account details updated successfully.', timer: 1800, showConfirmButton: false });
          setEditingUser(null);
          loadUsers();
        } else {
          throw new Error(res.data?.message || 'Update failed');
        }
      } else {
        // Create User
        const firstPondId = formData.selected_ponds.length > 0 ? formData.selected_ponds[0] : null;
        const res = await api.post('/users.php', {
          full_name: toTitleCase(formData.full_name),
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          pond_id: firstPondId
        });

        if (res.data && res.data.success) {
          const newUserId = res.data.user.id;
          if (newUserId && formData.selected_ponds.length > 0) {
            await api.post('/caretaker_ponds.php', {
              user_id: newUserId,
              pond_ids: formData.selected_ponds
            });
          }

          Swal.fire({ icon: 'success', title: 'Caretaker Created', text: 'New caretaker account registered successfully.', timer: 1800, showConfirmButton: false });
          setShowCreateModal(false);
          loadUsers();
        } else {
          throw new Error(res.data?.message || 'Creation failed');
        }
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || err.message || 'Operation failed.' });
    }
  };

  // Delete Caretaker Handler
  const handleDeleteUser = (user) => {
    if (user.role === 'admin') {
      Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'System administrator account cannot be deleted.' });
      return;
    }

    Swal.fire({
      title: `Delete Caretaker "${toTitleCase(user.full_name)}"?`,
      text: 'This action will permanently delete the caretaker account and revoke assigned pond permissions.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e04848',
      cancelButtonColor: '#627591',
      confirmButtonText: 'Yes, Delete Account'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/users.php', {
            action: 'delete_user',
            user_id: user.id
          });

          if (res.data && res.data.success) {
            Swal.fire({ icon: 'success', title: 'Deleted', text: 'Caretaker account removed successfully.', timer: 1800, showConfirmButton: false });
            loadUsers();
          } else {
            throw new Error(res.data?.message || 'Failed to delete user');
          }
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'Delete Error', text: err.response?.data?.message || err.message || 'Error deleting caretaker.' });
        }
      }
    });
  };

  return (
    <div className="pb-5">
      {/* 📊 SUMMARY CARDS (Dashboard style metric-card layout) */}
      <div className="row g-3 mb-4">
        {/* Total Users */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Total Users</span>
              <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary">
                <FaUsers size={18} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.total_users}</h3>
            <small className="text-muted extra-small">Registered Accounts</small>
          </div>
        </div>

        {/* Admins */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Admins</span>
              <div className="p-2 rounded-circle bg-info bg-opacity-10 text-info">
                <FaUserShield size={18} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.admin_count}</h3>
            <small className="text-muted extra-small">System Administrators</small>
          </div>
        </div>

        {/* Caretakers */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Caretakers</span>
              <div className="p-2 rounded-circle bg-secondary bg-opacity-10 text-secondary">
                <FaUserTie size={18} />
              </div>
            </div>
            <h3 className="fw-bold text-dark mb-0">{summary.caretaker_count}</h3>
            <small className="text-muted extra-small">Field Farm Caretakers</small>
          </div>
        </div>

        {/* Active Users */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="metric-card p-3.5 h-100 d-flex flex-column justify-content-between border-start border-4 border-success">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Active Accounts</span>
              <span className="badge bg-success bg-opacity-10 text-success rounded-pill">🟢 Active</span>
            </div>
            <h3 className="fw-bold text-success mb-0">{summary.active_count}</h3>
            <small className="text-muted extra-small">Operational Status</small>
          </div>
        </div>
      </div>

      {/* 🛠 UNIFIED FILTER & ACTION TOOLBAR */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
          {/* Quick Search */}
          <div className="position-relative flex-grow-1" style={{ maxWidth: 450 }}>
            <FaSearch className="position-absolute top-50 translate-middle-y text-primary" style={{ left: 16 }} size={14} />
            <input
              type="text"
              className="form-control ps-5 pe-4 py-2.5 rounded-pill shadow-xs"
              placeholder="Search User Name, Email, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.92rem' }}
            />
            {searchQuery && (
              <button
                className="btn btn-sm btn-link position-absolute top-50 translate-middle-y text-muted text-decoration-none"
                style={{ right: 12 }}
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-success px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-semibold shadow-xs"
              onClick={handleExportCSV}
            >
              <FaFileCsv size={16} /> Export CSV
            </button>

            <button
              type="button"
              className="btn btn-settings-primary px-3.5 py-2 rounded-3 d-flex align-items-center gap-2 fw-bold shadow-sm"
              onClick={openCreateModal}
            >
              <FaPlus size={13} /> Create Caretaker
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="row g-3">
          {/* Filter 1: Role */}
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Role Filter
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="admin">Admin</option>
              <option value="caretaker">Caretaker</option>
            </select>
          </div>

          {/* Filter 2: Status */}
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Status Filter
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active 🟢</option>
              <option value="Inactive">Inactive 🔴</option>
            </select>
          </div>

          {/* Filter 3: Assigned Pond */}
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Assigned Pond
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={pondFilter}
              onChange={(e) => setPondFilter(e.target.value)}
            >
              <option value="All">All Assigned Ponds</option>
              {ponds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Sort By */}
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1.5 tracking-wider">
              Sort By
            </label>
            <select
              className="form-select rounded-3 py-2 shadow-xs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="name">Name (A - Z)</option>
              <option value="role">Role</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📋 USERS TABLE CARD */}
      <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <div>
            <h5 className="fw-bold text-dark mb-0">System Users List</h5>
            <small className="text-muted">Manage administrator and caretaker accounts.</small>
          </div>
          <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-1.5 rounded-pill fw-semibold">
            Showing {sortedUsers.length} of {users.length} Users
          </span>
        </div>

        <div className="table-responsive">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2">Loading System Accounts...</p>
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-5 text-muted">No user accounts found matching filter criteria.</div>
          ) : (
            <table className="table align-middle mb-0" style={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <thead className="table-light">
                <tr>
                  <th style={{ minWidth: 220, padding: '12px 16px' }}>User Name</th>
                  <th style={{ minWidth: 200, padding: '12px 16px' }}>Email Address</th>
                  <th style={{ minWidth: 130, padding: '12px 16px' }}>Phone Number</th>
                  <th style={{ minWidth: 120, padding: '12px 16px' }}>Role</th>
                  <th style={{ minWidth: 110, padding: '12px 16px' }}>Status</th>
                  <th style={{ minWidth: 220, padding: '12px 16px' }}>Assigned Ponds</th>
                  <th style={{ minWidth: 120, padding: '12px 16px' }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const formattedName = toTitleCase(user.full_name);
                  const roleSubtitle = user.role === 'admin' ? 'System Administrator' : 'Pond Caretaker';

                  return (
                    <tr key={user.id} className="bg-white border-bottom shadow-xs">
                      {/* Name Clickable to open Profile (WITH GENEROUS SPACING BETWEEN AVATAR AND NAME!) */}
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          className="d-flex align-items-center gap-3 cursor-pointer"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setViewingUser(user)}
                        >
                          <div
                            className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs flex-shrink-0 me-2"
                            style={{
                              width: 44,
                              height: 44,
                              fontSize: '1.05rem',
                              background: getAvatarBg(user)
                            }}
                          >
                            {formattedName ? formattedName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <strong className="d-block text-dark text-primary-hover">{formattedName}</strong>
                            <small className="text-muted extra-small">{roleSubtitle}</small>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', color: '#475569' }}>{user.email}</td>

                      <td style={{ padding: '14px 16px', color: '#475569' }}>{user.phone || '09123456789'}</td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className={`badge ${
                            user.role === 'admin'
                              ? 'bg-primary bg-opacity-10 text-primary'
                              : 'bg-secondary bg-opacity-10 text-secondary'
                          } px-2.5 py-1.5 rounded-pill fw-semibold`}
                        >
                          {user.role === 'admin' ? '🛡 Admin' : '👨‍🌾 Caretaker'}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className={`badge ${
                            user.status === 'Active'
                              ? 'bg-success bg-opacity-10 text-success'
                              : 'bg-danger bg-opacity-10 text-danger'
                          } px-2.5 py-1.5 rounded-pill fw-semibold`}
                        >
                          {user.status === 'Active' ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                      </td>

                      {/* ASSIGNED PONDS DISPLAY WITH SLEEK PILL BADGES */}
                      <td style={{ padding: '14px 16px' }}>
                        {user.assigned_ponds && user.assigned_ponds.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {user.assigned_ponds.map((p) => (
                              <span
                                key={p.id}
                                className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill fw-semibold"
                              >
                                <FaWater className="me-1 text-primary" size={11} /> {p.pond_name}
                              </span>
                            ))}
                          </div>
                        ) : user.pond_name ? (
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill fw-semibold">
                            <FaWater className="me-1 text-primary" size={11} /> {user.pond_name}
                          </span>
                        ) : (
                          <span className="text-muted small italic">— None Assigned</span>
                        )}
                      </td>

                      {/* 👁 View / ✏ Edit / 🗑 Delete Actions */}
                      <td style={{ padding: '14px 16px' }}>
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          {/* 👁 View Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary p-2 rounded-3"
                            title="👁 View User Profile & Performance"
                            onClick={() => setViewingUser(user)}
                          >
                            <FaEye size={14} />
                          </button>

                          {/* ✏ Edit Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary p-2 rounded-3"
                            title="✏ Edit User & Pond Assignments"
                            onClick={() => openEditModal(user)}
                          >
                            <FaEdit size={14} />
                          </button>

                          {/* 🗑 Delete Button */}
                          {user.role !== 'admin' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger p-2 rounded-3"
                              title="🗑 Delete Caretaker Account"
                              onClick={() => handleDeleteUser(user)}
                            >
                              <FaTrashAlt size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 👤 USER PROFILE & CARETAKER PERFORMANCE MODAL */}
      {viewingUser && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header p-4 bg-primary text-white border-0">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle text-white d-flex align-items-center justify-content-center shadow fw-bold fs-3"
                    style={{ width: 64, height: 64, background: getAvatarBg(viewingUser) }}
                  >
                    {viewingUser.full_name ? viewingUser.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                      {toTitleCase(viewingUser.full_name)}
                      <span className="badge bg-success text-white fs-6 font-normal px-3 py-1 rounded-pill">
                        🟢 {viewingUser.status || 'Active'}
                      </span>
                    </h3>
                    <p className="mb-0 opacity-90 small">
                      Role: <strong>{viewingUser.role === 'admin' ? 'System Administrator' : 'Pond Caretaker'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setViewingUser(null)}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-white">
                {/* Basic Info Grid */}
                <h6 className="fw-bold text-dark mb-3">User Profile Details</h6>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Email Address</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-1.5">
                        <FaEnvelope className="text-primary" /> {viewingUser.email}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Phone Number</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-1.5">
                        <FaPhone className="text-primary" /> {viewingUser.phone || '09123456789'}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Assigned Ponds</small>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {viewingUser.assigned_ponds && viewingUser.assigned_ponds.length > 0 ? (
                          viewingUser.assigned_ponds.map((p) => (
                            <span key={p.id} className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill">
                              <FaWater className="me-1" size={11} /> {p.pond_name}
                            </span>
                          ))
                        ) : viewingUser.pond_name ? (
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2.5 py-1 rounded-pill">
                            <FaWater className="me-1" size={11} /> {viewingUser.pond_name}
                          </span>
                        ) : (
                          <span className="text-muted small">None Assigned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-6">
                    <div className="p-3 rounded-3 bg-light border">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Date Created</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-1.5">
                        <FaCalendarAlt className="text-secondary" /> {viewingUser.date_created || 'April 2026'}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-6">
                    <div className="p-3 rounded-3 bg-light border">
                      <small className="text-muted text-uppercase extra-small fw-bold d-block mb-1">Last Login</small>
                      <strong className="fs-6 text-dark d-flex align-items-center gap-1.5">
                        <FaClock className="text-success" /> {viewingUser.last_login || 'Today'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 🌟 CARETAKER PERFORMANCE SECTION (PERFECTLY ALIGNED EQUAL HEIGHT METRIC CARDS!) */}
                {viewingUser.performance ? (
                  <div className="p-4 rounded-4 bg-light border border-primary border-opacity-25 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                      <h5 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                        <FaChartLine /> Caretaker Performance
                      </h5>
                      <span className="text-warning fs-5">
                        <FaStar /> <FaStar /> <FaStar /> <FaStar /> <FaStar />
                      </span>
                    </div>

                    {/* Perfectly Aligned 6 Equal-Height Metric Cards */}
                    <div className="row g-3 mb-4 text-center align-items-stretch">
                      {/* Card 1: Feeding Logs */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Submitted Feeding Logs
                          </small>
                          <strong className="fs-4 text-primary d-block mt-2">{viewingUser.performance.submitted_feeding_logs}</strong>
                        </div>
                      </div>

                      {/* Card 2: Disease Reports */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Disease Reports
                          </small>
                          <strong className="fs-4 text-dark d-block mt-2">{viewingUser.performance.disease_reports_submitted}</strong>
                        </div>
                      </div>

                      {/* Card 3: Images Uploaded */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Images Uploaded
                          </small>
                          <strong className="fs-4 text-dark d-block mt-2">{viewingUser.performance.shrimp_images_uploaded}</strong>
                        </div>
                      </div>

                      {/* Card 4: Last Activity */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Last Activity
                          </small>
                          <strong className="fs-6 text-dark d-block mt-2 fw-bold">{viewingUser.performance.last_activity}</strong>
                        </div>
                      </div>

                      {/* Card 5: Attendance */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border border-success shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Attendance
                          </small>
                          <strong className="fs-4 text-success d-block mt-2">{viewingUser.performance.attendance_pct}%</strong>
                        </div>
                      </div>

                      {/* Card 6: Performance Score */}
                      <div className="col-6 col-md-4 col-lg-2">
                        <div className="card p-3 rounded-4 bg-white border border-primary shadow-xs h-100 d-flex flex-column justify-content-between">
                          <small className="text-muted extra-small fw-bold text-uppercase d-flex align-items-center justify-content-center" style={{ minHeight: 34, lineHeight: 1.2 }}>
                            Performance Score
                          </small>
                          <strong className="fs-4 text-primary d-block mt-2">{viewingUser.performance.performance_score}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Performance Breakdown Progress Bars */}
                    <h6 className="fw-bold text-dark mb-3">Performance Breakdown</h6>
                    <div className="d-flex flex-column gap-3">
                      {/* Task Completion */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center small fw-bold text-dark mb-1">
                          <span>Task Completion</span>
                          <span className="text-primary">{viewingUser.performance.breakdown.task_completion}%</span>
                        </div>
                        <div className="progress" style={{ height: 12, borderRadius: 6 }}>
                          <div
                            className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                            style={{ width: `${viewingUser.performance.breakdown.task_completion}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Feeding Logs */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center small fw-bold text-dark mb-1">
                          <span>Feeding Logs</span>
                          <span className="text-info">{viewingUser.performance.breakdown.feeding_logs}%</span>
                        </div>
                        <div className="progress" style={{ height: 12, borderRadius: 6 }}>
                          <div
                            className="progress-bar bg-info progress-bar-striped progress-bar-animated"
                            style={{ width: `${viewingUser.performance.breakdown.feeding_logs}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Image Upload */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center small fw-bold text-dark mb-1">
                          <span>Image Upload</span>
                          <span className="text-success">{viewingUser.performance.breakdown.image_upload}%</span>
                        </div>
                        <div className="progress" style={{ height: 12, borderRadius: 6 }}>
                          <div
                            className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                            style={{ width: `${viewingUser.performance.breakdown.image_upload}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Attendance */}
                      <div>
                        <div className="d-flex justify-content-between align-items-center small fw-bold text-dark mb-1">
                          <span>Attendance</span>
                          <span className="text-warning">{viewingUser.performance.breakdown.attendance}%</span>
                        </div>
                        <div className="progress" style={{ height: 12, borderRadius: 6 }}>
                          <div
                            className="progress-bar bg-warning progress-bar-striped progress-bar-animated"
                            style={{ width: `${viewingUser.performance.breakdown.attendance}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-3 bg-light text-center text-muted small">
                    System Administrator Account (Performance tracking active for Caretaker roles).
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                <div>
                  {viewingUser.role === 'caretaker' && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm rounded-3"
                      onClick={() => {
                        const userToEdit = viewingUser;
                        setViewingUser(null);
                        openEditModal(userToEdit);
                      }}
                    >
                      <FaEdit className="me-1" /> Edit Account
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary px-4 rounded-3"
                  onClick={() => setViewingUser(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ➕ CREATE / ✏ EDIT CARETAKER MODAL */}
      {(showCreateModal || editingUser) && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header p-4 bg-primary text-white border-0">
                <h4 className="fw-bold mb-0">
                  {editingUser ? 'Edit Caretaker Account' : 'Create Caretaker Account'}
                </h4>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingUser(null);
                  }}
                ></button>
              </div>

              <form onSubmit={handleSaveUser}>
                <div className="modal-body p-4 bg-white">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Full Name</label>
                    <input
                      type="text"
                      className="form-control py-2 rounded-3"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email Address</label>
                    <input
                      type="email"
                      className="form-control py-2 rounded-3"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Phone Number</label>
                    <input
                      type="text"
                      className="form-control py-2 rounded-3"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  {!editingUser && (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Password</label>
                        <input
                          type="password"
                          className="form-control py-2 rounded-3"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                          minLength={6}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-semibold">Confirm Password</label>
                        <input
                          type="password"
                          className="form-control py-2 rounded-3"
                          value={formData.confirm_password}
                          onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                          required
                          minLength={6}
                        />
                      </div>
                    </>
                  )}

                  {editingUser && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Account Status</label>
                      <select
                        className="form-select py-2 rounded-3"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Active">Active 🟢</option>
                        <option value="Inactive">Inactive 🔴</option>
                      </select>
                    </div>
                  )}

                  {/* Assign Ponds Grid */}
                  <div className="mb-3">
                    <label className="form-label fw-bold d-flex justify-content-between align-items-center">
                      <span>Assign Ponds</span>
                      <small className="text-muted fw-normal">Selected: {formData.selected_ponds.length}/3 max</small>
                    </label>

                    <div className="row g-2">
                      {ponds.map((pond, idx) => {
                        const { isAssignedToOther, assignedUserName } = getAssignedInfo(pond);
                        const isChecked = formData.selected_ponds.includes(pond.id);

                        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                        const lIdx = Math.floor(idx / 3);
                        const nIdx = (idx % 3) + 1;
                        const defaultPondCode = `Pond ${letters[lIdx % 26]}${nIdx}`;
                        const displayName = pond.pond_name && !/^Pond\s+\d+$/i.test(pond.pond_name) ? pond.pond_name : defaultPondCode;

                        return (
                          <div key={pond.id} className="col-4">
                            <div
                              className={`p-2 rounded-3 border text-center transition-all ${
                                isChecked
                                  ? 'bg-primary bg-opacity-10 border-primary text-primary fw-bold'
                                  : isAssignedToOther
                                  ? 'bg-light text-muted opacity-50'
                                  : 'bg-white text-dark hover-bg-light'
                              }`}
                              style={{ cursor: isAssignedToOther ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                              onClick={() => !isAssignedToOther && handlePondToggle(pond.id)}
                              title={isAssignedToOther ? `Assigned to ${assignedUserName}` : ''}
                            >
                              <div className="form-check form-check-inline m-0">
                                <input
                                  type="checkbox"
                                  className="form-check-input me-1.5"
                                  checked={isChecked}
                                  disabled={isAssignedToOther}
                                  onChange={() => {}}
                                />
                                <span>{displayName}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="modal-footer p-3 bg-light border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-3"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingUser(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4 rounded-3 shadow-sm">
                    {editingUser ? 'Save Changes' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
