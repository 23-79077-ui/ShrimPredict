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
  FaClock,
  FaLock,
  FaKey,
  FaShieldAlt,
  FaSync
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
    return 'linear-gradient(135deg, #071733 0%, #0B2C5F 100%)';
  }
  const id = Number(user.id) || 1;
  const gradients = [
    'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
    'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)',
    'linear-gradient(135deg, #FF7A00 0%, #FBBF24 100%)',
    'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
    'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)'
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
          Swal.fire({
            icon: 'warning',
            title: 'Quota Reached',
            text: 'Maximum quota of 3 active production ponds per caretaker.',
            confirmButtonColor: '#0B2C5F'
          });
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
        Swal.fire({ icon: 'error', title: 'Password Mismatch', text: 'Passwords do not match. Please verify.', confirmButtonColor: '#0B2C5F' });
        return;
      }
      if (formData.password.length < 6) {
        Swal.fire({ icon: 'error', title: 'Weak Password', text: 'Password must be at least 6 characters.', confirmButtonColor: '#0B2C5F' });
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
          Swal.fire({
            icon: 'success',
            title: 'Caretaker Updated',
            text: 'Account details and basin assignments updated successfully.',
            timer: 1800,
            showConfirmButton: false
          });
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

          Swal.fire({
            icon: 'success',
            title: 'Caretaker Registered',
            text: 'New caretaker credentials and pond assignments saved successfully.',
            timer: 1800,
            showConfirmButton: false
          });
          setShowCreateModal(false);
          loadUsers();
        } else {
          throw new Error(res.data?.message || 'Creation failed');
        }
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || err.message || 'Operation failed.',
        confirmButtonColor: '#0B2C5F'
      });
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
      confirmButtonColor: '#E11D48',
      cancelButtonColor: '#64748B',
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

  // Archive Caretaker Handler (Resigned / Inactive)
  const handleArchiveCaretaker = (userToArchive) => {
    Swal.fire({
      title: `Archive Caretaker`,
      html: `
        <div style="text-align: left; font-family: 'Poppins', sans-serif;">
          <p style="color: #64748B; font-size: 0.85rem; margin-bottom: 12px;">Archive <strong>${toTitleCase(userToArchive.full_name)}</strong> to the historical caretaker repository in Settings.</p>
          <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 6px; color: #1E293B;">Reason for Archiving:</label>
          <select id="archive-reason-select" class="form-select rounded-3 py-2" style="font-size: 0.85rem;">
            <option value="Resigned">Resigned</option>
            <option value="Career Transition">Career Transition</option>
            <option value="Health Reason">Health Reason</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
            <option value="Other">Other</option>
          </select>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Archive Caretaker',
      confirmButtonColor: '#FF7A00',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const reasonSelect = document.getElementById('archive-reason-select');
        return reasonSelect ? reasonSelect.value : 'Resigned';
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await api.post('/users.php', {
            action: 'archive_caretaker',
            user_id: userToArchive.id,
            archive_reason: result.value || 'Resigned'
          });
          if (res.data && res.data.success) {
            Swal.fire('Archived!', `${toTitleCase(userToArchive.full_name)} has been moved to Archived Caretakers repository in Settings.`, 'success');
            loadUsers();
          } else {
            Swal.fire('Error', res.data?.message || 'Failed to archive caretaker.', 'error');
          }
        } catch (err) {
          Swal.fire('Error', err.response?.data?.message || err.message, 'error');
        }
      }
    });
  };

  return (
    <div className="users-page-container pb-5" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* 🌟 1. HERO INTELLIGENCE & CONTROL BANNER */}
      <div className="user-hero-banner d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center shadow-sm flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
              color: '#FFFFFF',
              fontSize: '1.35rem'
            }}
          >
            <FaUsers />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h4 className="fw-extrabold text-dark mb-0 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Team & Caretaker Operations
              </h4>
              <span className="tag-green-safe d-inline-flex align-items-center gap-1">
                <span className="rounded-circle" style={{ width: 6, height: 6, background: '#16A34A' }}></span>
                Role-Based Access Active
              </span>
            </div>
            <p className="text-muted mb-0 small" style={{ fontSize: '0.84rem' }}>
              Manage farm supervisor credentials, assign active production basins, and audit caretaker telemetry records.
            </p>
          </div>
        </div>

        {/* Action Controls: Refresh, Export & Create */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-2 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={loadUsers}
          >
            <FaSync size={12} className={loading ? 'fa-spin text-primary' : 'text-primary'} /> Refresh
          </button>

          <button
            type="button"
            className="btn btn-sm rounded-pill bg-white border text-dark fw-semibold px-3 py-2 d-flex align-items-center gap-1.5 shadow-xs"
            style={{ fontSize: '0.82rem', height: 40 }}
            onClick={handleExportCSV}
          >
            <FaFileCsv size={13} style={{ color: '#16A34A' }} /> Export CSV
          </button>

          <button
            type="button"
            className="btn btn-sm rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold text-white shadow-xs"
            style={{
              height: 40,
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
              border: 'none'
            }}
            onClick={openCreateModal}
          >
            <FaPlus size={12} /> Register Caretaker
          </button>
        </div>
      </div>

      {/* 🌟 2. 4 MODERN ENTERPRISE TELEMETRY KPI CARDS */}
      <div className="row g-3 mb-4">
        {/* Card 1: Total Users */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Total Directory</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284C7' }}
                >
                  <FaUsers />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {summary.total_users}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-cyan-active">Active Directory</span>
                <span className="text-muted extra-small">All Roles</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Admins */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">System Admins</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(11, 44, 95, 0.10)', color: '#0B2C5F' }}
                >
                  <FaUserShield />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {summary.admin_count}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '40%', background: 'linear-gradient(90deg, #0B2C5F, #0284C7)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-cyan-active" style={{ background: '#F8FAFC', color: '#0B2C5F', borderColor: '#CBD5E1' }}>Full Authority</span>
                <span className="text-muted extra-small">Root Access</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Caretakers */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Field Caretakers</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(255, 122, 0, 0.12)', color: '#FF7A00' }}
                >
                  <FaUserTie />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-dark" style={{ letterSpacing: '-0.03em' }}>
                {summary.caretaker_count}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '80%', background: 'linear-gradient(90deg, #FF7A00, #FBBF24)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-orange-maintenance">Field Operations</span>
                <span className="text-muted extra-small">Basin Supervisors</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Active Accounts */}
        <div className="col-12 col-sm-6 col-md-3">
          <div className="feeding-kpi-card h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <span className="text-muted extra-small text-uppercase fw-bold tracking-wider">Operational Health</span>
                <div
                  className="feeding-kpi-icon-wrap"
                  style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}
                >
                  <FaCheckCircle />
                </div>
              </div>
              <h2 className="fw-extrabold mb-1 text-success" style={{ letterSpacing: '-0.03em' }}>
                {summary.active_count}
              </h2>
            </div>
            <div>
              <div className="feeding-progress-track my-2">
                <div
                  className="feeding-progress-bar"
                  style={{ width: '100%', background: 'linear-gradient(90deg, #16A34A, #4ADE80)' }}
                ></div>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="tag-green-safe">100% Operational</span>
                <span className="text-muted extra-small">Zero Locked</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. UNIFIED SEARCH, FILTER & SORT CONTROL STRIP */}
      <div className="asymmetric-card p-4 mb-4">
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
          {/* Quick Search */}
          <div className="position-relative flex-grow-1" style={{ maxWidth: 420 }}>
            <input
              type="text"
              className="form-control form-control-sm rounded-pill ps-4 pe-4"
              style={{ fontSize: '0.82rem', height: 38, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              placeholder="Search user name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FaSearch
              size={12}
              className="position-absolute text-muted"
              style={{ left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn btn-link p-0 position-absolute text-muted"
                style={{ right: 12, top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
                onClick={() => setSearchQuery('')}
              >
                <FaTimes size={11} />
              </button>
            )}
          </div>

          {/* Pill Role Quick Filters */}
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className={`pill-filter-btn ${roleFilter === 'All' ? 'active' : ''}`}
              onClick={() => setRoleFilter('All')}
            >
              All Personnel ({users.length})
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${roleFilter === 'admin' ? 'active' : ''}`}
              onClick={() => setRoleFilter('admin')}
            >
              Admins ({summary.admin_count})
            </button>
            <button
              type="button"
              className={`pill-filter-btn ${roleFilter === 'caretaker' ? 'active' : ''}`}
              onClick={() => setRoleFilter('caretaker')}
            >
              Caretakers ({summary.caretaker_count})
            </button>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="row g-3">
          {/* Filter 1: Status */}
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1 tracking-wider">
              Status Filter
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ fontSize: '0.82rem', height: 36, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">🟢 Active</option>
              <option value="Inactive">🔴 Inactive</option>
            </select>
          </div>

          {/* Filter 2: Assigned Pond */}
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1 tracking-wider">
              Assigned Basin
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ fontSize: '0.82rem', height: 36, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={pondFilter}
              onChange={(e) => setPondFilter(e.target.value)}
            >
              <option value="All">All Assigned Basins</option>
              {ponds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pond_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Sort By */}
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label extra-small fw-bold text-muted text-uppercase mb-1 tracking-wider">
              Sort Order
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              style={{ fontSize: '0.82rem', height: 36, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First ⬇</option>
              <option value="name">Name (A - Z)</option>
              <option value="role">Role Classification</option>
            </select>
          </div>
        </div>
      </div>

      {/* 🌟 4. USERS TABLE MATRIX */}
      <div className="asymmetric-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
          <div>
            <h5 className="fw-extrabold text-dark mb-0 tracking-tight">System Personnel Directory</h5>
            <p className="text-muted small mb-0" style={{ fontSize: '0.82rem' }}>
              Authorized administrator profiles and operational field farm caretakers.
            </p>
          </div>
          <span className="tag-cyan-active">
            Showing {sortedUsers.length} of {users.length} Users
          </span>
        </div>

        <div className="table-responsive rounded-4 border" style={{ maxHeight: '560px', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-5 text-muted">
              <FaSync className="fa-spin text-primary me-2" /> Loading System Personnel Directory...
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-5 text-muted">No personnel records found matching filter criteria.</div>
          ) : (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <tr className="text-muted extra-small text-uppercase fw-bold">
                  <th className="border-0 ps-3 py-3" style={{ minWidth: 220 }}>User Profile</th>
                  <th className="border-0 py-3" style={{ minWidth: 190 }}>Contact Email</th>
                  <th className="border-0 py-3" style={{ minWidth: 140 }}>Mobile Number</th>
                  <th className="border-0 py-3" style={{ minWidth: 120 }}>Access Role</th>
                  <th className="border-0 py-3" style={{ minWidth: 110 }}>Status</th>
                  <th className="border-0 py-3" style={{ minWidth: 200 }}>Assigned Basins</th>
                  <th className="border-0 pe-3 py-3 text-end" style={{ minWidth: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const formattedName = toTitleCase(user.full_name);
                  const roleSubtitle = user.role === 'admin' ? 'System Administrator' : 'Pond Caretaker';

                  return (
                    <tr key={user.id} className="border-bottom">
                      {/* Name & Avatar */}
                      <td className="ps-3 py-3">
                        <div
                          className="d-flex align-items-center gap-2.5 cursor-pointer"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setViewingUser(user)}
                        >
                          <div
                            className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs flex-shrink-0"
                            style={{
                              width: 42,
                              height: 42,
                              fontSize: '1rem',
                              background: getAvatarBg(user)
                            }}
                          >
                            {formattedName ? formattedName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <strong className="d-block text-dark">{formattedName}</strong>
                            <span className="text-muted extra-small">{roleSubtitle}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-secondary">
                        <span className="d-flex align-items-center gap-1.5">
                          <FaEnvelope size={11} className="text-muted" /> {user.email}
                        </span>
                      </td>

                      <td className="py-3 text-secondary">
                        <span className="d-flex align-items-center gap-1.5">
                          <FaPhone size={11} className="text-muted" /> {user.phone || '09123456789'}
                        </span>
                      </td>

                      <td className="py-3">
                        <span
                          className="badge rounded-pill fw-bold px-2.5 py-1"
                          style={
                            user.role === 'admin'
                              ? { background: 'rgba(11, 44, 95, 0.08)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.2)' }
                              : { background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }
                          }
                        >
                          {user.role === 'admin' ? (
                            <>
                              <FaUserShield className="me-1" size={11} /> Admin
                            </>
                          ) : (
                            <>
                              <FaUserTie className="me-1" size={11} /> Caretaker
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3">
                        <span
                          className="badge rounded-pill px-2.5 py-1 fw-bold extra-small"
                          style={
                            user.status === 'Active'
                              ? { background: '#ECFDF5', color: '#16A34A', border: '1px solid #BBF7D0' }
                              : { background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3' }
                          }
                        >
                          {user.status === 'Active' ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                      </td>

                      {/* ASSIGNED PONDS */}
                      <td className="py-3">
                        {user.assigned_ponds && user.assigned_ponds.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {user.assigned_ponds.map((p) => (
                              <span
                                key={p.id}
                                className="badge rounded-pill fw-bold px-2.5 py-1"
                                style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.75rem' }}
                              >
                                <FaWater className="me-1" size={10} /> {p.pond_name}
                              </span>
                            ))}
                          </div>
                        ) : user.pond_name ? (
                          <span
                            className="badge rounded-pill fw-bold px-2.5 py-1"
                            style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.75rem' }}
                          >
                            <FaWater className="me-1" size={10} /> {user.pond_name}
                          </span>
                        ) : (
                          <span className="text-muted extra-small italic">— Unassigned</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="pe-3 py-3 text-end">
                        <div className="d-flex align-items-center justify-content-end gap-1.5">
                          {/* View Profile */}
                          <button
                            type="button"
                            className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                            style={{ width: 34, height: 34, background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}
                            title="Inspect Profile & Telemetry Performance"
                            onClick={() => setViewingUser(user)}
                          >
                            <FaEye size={13} />
                          </button>

                          {/* Edit Caretaker */}
                          <button
                            type="button"
                            className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                            style={{ width: 34, height: 34, background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
                            title="Edit User Credentials & Basin Assignments"
                            onClick={() => openEditModal(user)}
                          >
                            <FaEdit size={13} />
                          </button>

                          {/* Delete & Archive Buttons */}
                          {user.role !== 'admin' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                                style={{ width: 34, height: 34, background: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
                                title="Archive Caretaker (Resigned / Inactive)"
                                onClick={() => handleArchiveCaretaker(user)}
                              >
                                <FaCalendarCheck size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 shadow-xs"
                                style={{ width: 34, height: 34, background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3' }}
                                title="Delete Caretaker Account"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <FaTrashAlt size={12} />
                              </button>
                            </>
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

      {/* 🌟 5. RADICAL REDESIGN: CREATE & EDIT CARETAKER MODAL */}
      {(showCreateModal || editingUser) && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header with Luxury Navy Gradient & Shrimp Orange Emblem */}
              <div className="caretaker-modal-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                    style={{
                      width: 48,
                      height: 48,
                      background: 'rgba(255, 122, 0, 0.18)',
                      color: '#FF7A00',
                      fontSize: '1.25rem',
                      border: '1px solid rgba(255, 122, 0, 0.35)'
                    }}
                  >
                    {editingUser ? <FaEdit /> : <FaUserTie />}
                  </div>
                  <div>
                    <h5 className="fw-extrabold text-white mb-0 tracking-tight" style={{ fontSize: '1.2rem' }}>
                      {editingUser ? 'Update Caretaker Credentials' : 'Register New Caretaker'}
                    </h5>
                    <p className="text-white text-opacity-75 mb-0 small" style={{ fontSize: '0.8rem' }}>
                      Assign field basin permissions and configure mobile telemetry credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center text-white p-0"
                  style={{ width: 34, height: 34, background: 'rgba(255, 255, 255, 0.12)', border: 'none' }}
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingUser(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveUser}>
                <div className="modal-body p-4 bg-white">
                  {/* Section 1: Personal & Contact Information */}
                  <div className="mb-4">
                    <span className="extra-small text-muted text-uppercase fw-bold tracking-wider d-block mb-2">
                      1. Personal & Contact Details
                    </span>

                    <div className="row g-3">
                      {/* Full Name */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold text-dark mb-1">Full Name</label>
                        <div className="input-icon-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Juan Dela Cruz"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            required
                          />
                          <FaUser className="input-icon" />
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-bold text-dark mb-1">Mobile Contact</label>
                        <div className="input-icon-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 09123456789"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                          <FaPhone className="input-icon" />
                        </div>
                      </div>

                      {/* Email Address */}
                      <div className="col-12">
                        <label className="form-label small fw-bold text-dark mb-1">Email Address</label>
                        <div className="input-icon-group">
                          <input
                            type="email"
                            className="form-control"
                            placeholder="caretaker@shrimpredict.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                          <FaEnvelope className="input-icon" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Security Credentials / Status */}
                  <div className="mb-4 pt-3 border-top">
                    <span className="extra-small text-muted text-uppercase fw-bold tracking-wider d-block mb-2">
                      2. Security & Account Status
                    </span>

                    {!editingUser ? (
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-bold text-dark mb-1">Password</label>
                          <div className="input-icon-group">
                            <input
                              type="password"
                              className="form-control"
                              placeholder="Minimum 6 characters"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                              minLength={6}
                            />
                            <FaLock className="input-icon" />
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-bold text-dark mb-1">Confirm Password</label>
                          <div className="input-icon-group">
                            <input
                              type="password"
                              className="form-control"
                              placeholder="Repeat password"
                              value={formData.confirm_password}
                              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                              required
                              minLength={6}
                            />
                            <FaKey className="input-icon" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-bold text-dark mb-1">Account Operational Status</label>
                          <select
                            className="form-select form-control"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            style={{ borderRadius: 12, height: 42, fontSize: '0.88rem' }}
                          >
                            <option value="Active">Active Operational 🟢</option>
                            <option value="Inactive">Inactive Suspended 🔴</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Basin Fleet Permissions (Visual Interactive Pond Cards) */}
                  <div className="pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span className="extra-small text-muted text-uppercase fw-bold tracking-wider d-block">
                          3. Basin Fleet Assignments
                        </span>
                        <p className="text-muted extra-small mb-0">
                          Select up to 3 active production basins this caretaker will monitor daily.
                        </p>
                      </div>
                      <span
                        className="badge rounded-pill fw-bold"
                        style={{
                          background: formData.selected_ponds.length === 3 ? '#FFF7ED' : '#F0F9FF',
                          color: formData.selected_ponds.length === 3 ? '#EA580C' : '#0284C7',
                          border: formData.selected_ponds.length === 3 ? '1px solid #FFEDD5' : '1px solid #BAE6FD',
                          fontSize: '0.78rem'
                        }}
                      >
                        Selected: {formData.selected_ponds.length} / 3 Max
                      </span>
                    </div>

                    <div className="row g-2.5 mt-1">
                      {ponds.map((pond, idx) => {
                        const { isAssignedToOther, assignedUserName } = getAssignedInfo(pond);
                        const isChecked = formData.selected_ponds.includes(pond.id);

                        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                        const lIdx = Math.floor(idx / 3);
                        const nIdx = (idx % 3) + 1;
                        const defaultPondCode = `Pond ${letters[lIdx % 26]}${nIdx}`;
                        const displayName = pond.pond_name && !/^Pond\s+\d+$/i.test(pond.pond_name) ? pond.pond_name : defaultPondCode;

                        return (
                          <div key={pond.id} className="col-12 col-sm-6 col-md-4">
                            <div
                              className={`pond-select-card ${isChecked ? 'selected' : ''} ${isAssignedToOther ? 'disabled' : ''}`}
                              onClick={() => !isAssignedToOther && handlePondToggle(pond.id)}
                              title={isAssignedToOther ? `Assigned to ${assignedUserName}` : 'Click to assign pond'}
                            >
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                  <div
                                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{
                                      width: 32,
                                      height: 32,
                                      background: isChecked ? '#0284C7' : isAssignedToOther ? '#E2E8F0' : 'rgba(2, 132, 199, 0.1)',
                                      color: isChecked ? '#FFFFFF' : isAssignedToOther ? '#94A3B8' : '#0284C7'
                                    }}
                                  >
                                    <FaWater size={13} />
                                  </div>
                                  <div>
                                    <strong className="d-block text-dark" style={{ fontSize: '0.85rem' }}>
                                      {displayName}
                                    </strong>
                                    <span className="extra-small text-muted" style={{ fontSize: '0.72rem' }}>
                                      {isAssignedToOther ? `Assigned: ${assignedUserName}` : 'Active Basin'}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  {isAssignedToOther ? (
                                    <FaLock size={12} className="text-muted opacity-50" />
                                  ) : isChecked ? (
                                    <FaCheckCircle size={16} style={{ color: '#0284C7' }} />
                                  ) : (
                                    <div
                                      className="rounded-circle border"
                                      style={{ width: 16, height: 16, borderColor: '#CBD5E1' }}
                                    ></div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-sm rounded-pill px-3 py-2 text-secondary fw-semibold border bg-white"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingUser(null);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-sm rounded-pill px-4 py-2 d-flex align-items-center gap-2 fw-bold text-white shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  >
                    <FaCheckCircle size={13} />
                    {editingUser ? 'Save Changes' : 'Register Caretaker'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 6. USER PROFILE & PERFORMANCE MODAL */}
      {viewingUser && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(7, 23, 51, 0.65)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="caretaker-modal-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle text-white d-flex align-items-center justify-content-center shadow fw-bold fs-4 flex-shrink-0"
                    style={{ width: 56, height: 56, background: getAvatarBg(viewingUser) }}
                  >
                    {viewingUser.full_name ? viewingUser.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <h4 className="fw-extrabold text-white mb-0 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                        {toTitleCase(viewingUser.full_name)}
                      </h4>
                      <span
                        className="badge rounded-pill fw-bold extra-small"
                        style={{ background: '#ECFDF5', color: '#16A34A', border: '1px solid #BBF7D0' }}
                      >
                        🟢 {viewingUser.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-white text-opacity-75 mb-0 small" style={{ fontSize: '0.82rem' }}>
                      Role: <strong>{viewingUser.role === 'admin' ? 'System Administrator' : 'Pond Caretaker'}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm rounded-circle d-flex align-items-center justify-content-center text-white p-0"
                  style={{ width: 34, height: 34, background: 'rgba(255, 255, 255, 0.12)', border: 'none' }}
                  onClick={() => setViewingUser(null)}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 bg-white">
                {/* Basic Info Chips */}
                <h6 className="fw-extrabold text-dark mb-3">User Profile Details</h6>
                <div className="row g-2.5 mb-4">
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <span className="extra-small text-muted text-uppercase fw-bold d-block mb-1">Email Address</span>
                      <strong className="text-dark small d-flex align-items-center gap-1.5" style={{ wordBreak: 'break-all' }}>
                        <FaEnvelope className="text-primary flex-shrink-0" /> {viewingUser.email}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <span className="extra-small text-muted text-uppercase fw-bold d-block mb-1">Mobile Contact</span>
                      <strong className="text-dark small d-flex align-items-center gap-1.5">
                        <FaPhone className="text-primary flex-shrink-0" /> {viewingUser.phone || '09123456789'}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-light border">
                      <span className="extra-small text-muted text-uppercase fw-bold d-block mb-1">Assigned Basins</span>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {viewingUser.assigned_ponds && viewingUser.assigned_ponds.length > 0 ? (
                          viewingUser.assigned_ponds.map((p) => (
                            <span key={p.id} className="badge rounded-pill fw-bold" style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.72rem' }}>
                              <FaWater className="me-1" size={10} /> {p.pond_name}
                            </span>
                          ))
                        ) : viewingUser.pond_name ? (
                          <span className="badge rounded-pill fw-bold" style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '0.72rem' }}>
                            <FaWater className="me-1" size={10} /> {viewingUser.pond_name}
                          </span>
                        ) : (
                          <span className="text-muted extra-small">None Assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Caretaker Performance Section */}
                {viewingUser.performance ? (
                  <div className="p-4 rounded-4 bg-light border border-primary border-opacity-25 mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                      <h6 className="fw-extrabold text-primary mb-0 d-flex align-items-center gap-2">
                        <FaChartLine /> Caretaker Telemetry & Performance
                      </h6>
                      <span className="text-warning fs-6">
                        <FaStar /> <FaStar /> <FaStar /> <FaStar /> <FaStar />
                      </span>
                    </div>

                    {/* Perfectly Aligned Equal Height Metric Cards */}
                    <div className="row g-2.5 mb-3 text-center align-items-stretch">
                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Feed Logs</span>
                          <strong className="fs-5 text-primary d-block mt-1">{viewingUser.performance.submitted_feeding_logs}</strong>
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Disease Rep.</span>
                          <strong className="fs-5 text-dark d-block mt-1">{viewingUser.performance.disease_reports_submitted}</strong>
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Images</span>
                          <strong className="fs-5 text-dark d-block mt-1">{viewingUser.performance.shrimp_images_uploaded}</strong>
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Activity</span>
                          <strong className="small text-dark d-block mt-1 fw-bold">{viewingUser.performance.last_activity}</strong>
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border border-success h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Attendance</span>
                          <strong className="fs-5 text-success d-block mt-1">{viewingUser.performance.attendance_pct}%</strong>
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <div className="p-2.5 rounded-3 bg-white border border-primary h-100 d-flex flex-column justify-content-between">
                          <span className="extra-small text-muted text-uppercase fw-bold d-block">Score</span>
                          <strong className="fs-5 text-primary d-block mt-1">{viewingUser.performance.performance_score}%</strong>
                        </div>
                      </div>
                    </div>

                    {/* Progress Breakdown */}
                    <div className="d-flex flex-column gap-2.5">
                      <div>
                        <div className="d-flex justify-content-between small fw-bold text-dark mb-1">
                          <span>Task Completion</span>
                          <span className="text-primary">{viewingUser.performance.breakdown.task_completion}%</span>
                        </div>
                        <div className="feeding-progress-track">
                          <div
                            className="feeding-progress-bar"
                            style={{ width: `${viewingUser.performance.breakdown.task_completion}%`, background: '#0284C7' }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="d-flex justify-content-between small fw-bold text-dark mb-1">
                          <span>Feeding Schedule Adherence</span>
                          <span className="text-success">{viewingUser.performance.breakdown.feeding_logs}%</span>
                        </div>
                        <div className="feeding-progress-track">
                          <div
                            className="feeding-progress-bar"
                            style={{ width: `${viewingUser.performance.breakdown.feeding_logs}%`, background: '#16A34A' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-3 bg-light text-center text-muted small">
                    System Administrator Profile (Full Administrative Authority Active).
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="modal-footer p-3 bg-light border-top d-flex justify-content-between">
                <div>
                  {viewingUser.role === 'caretaker' && (
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5"
                      style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD' }}
                      onClick={() => {
                        const userToEdit = viewingUser;
                        setViewingUser(null);
                        openEditModal(userToEdit);
                      }}
                    >
                      <FaEdit size={12} /> Edit Account
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm rounded-pill px-4 py-2 text-secondary fw-semibold border bg-white"
                  onClick={() => setViewingUser(null)}
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
