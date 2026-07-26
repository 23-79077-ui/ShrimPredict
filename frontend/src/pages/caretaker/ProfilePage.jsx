import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { FaCamera, FaEnvelope, FaPhone, FaSave, FaTrash, FaUser } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const getInitials = (name = 'Caretaker') => name
  .split(' ')
  .map((part) => part.charAt(0))
  .join('')
  .slice(0, 2)
  .toUpperCase();

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState({
    id: user?.id || '',
    full_name: user?.full_name || user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    position: user?.position || 'Pond Caretaker',
    avatar_path: user?.avatar_path || '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/profile.php', { params: { user_id: user.id } });
        if (res.data?.success && res.data.profile) {
          const nextProfile = {
            id: res.data.profile.id,
            full_name: res.data.profile.full_name || '',
            email: res.data.profile.email || '',
            phone: res.data.profile.phone || '',
            position: res.data.profile.position || 'Pond Caretaker',
            avatar_path: res.data.profile.avatar_path || '',
          };
          setProfile(nextProfile);
          updateUser?.(nextProfile);
        }
      } catch (error) {
        console.error('Unable to load caretaker profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.id]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: 'Invalid file', text: 'Please choose an image file.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Image too large', text: 'Please upload an image below 2 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((current) => ({ ...current, avatar_path: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/profile.php', {
        action: 'update_profile',
        user_id: profile.id || user?.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        position: profile.position || 'Pond Caretaker',
        avatar_path: profile.avatar_path,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Unable to save profile.');
      }

      const nextUser = res.data.user || profile;
      updateUser?.({
        ...nextUser,
        assigned_ponds: user?.assigned_ponds || [],
        pond_id: user?.pond_id,
      });

      Swal.fire({
        icon: 'success',
        title: 'Profile Updated',
        text: 'Your caretaker profile has been saved.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Save failed',
        text: error.response?.data?.message || error.message || 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = () => {
    setProfile((current) => ({ ...current, avatar_path: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const initials = getInitials(profile.full_name || user?.full_name || 'Caretaker');

  return (
    <div className="caretaker-profile-page">
      <section className="caretaker-dashboard-hero caretaker-profile-hero">
        <div>
          <span className="caretaker-dashboard-kicker">Caretaker Account</span>
          <h3>Profile</h3>
          <p>Manage your contact details and upload your own profile picture.</p>
        </div>
      </section>

      <form className="card caretaker-panel-card" onSubmit={saveProfile}>
        <div className="card-body">
          <div className="caretaker-profile-grid">
            <div className="caretaker-profile-photo-panel">
              <div className="caretaker-profile-avatar">
                {profile.avatar_path ? (
                  <img src={profile.avatar_path} alt="Caretaker profile" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept="image/*"
                onChange={handleAvatarChange}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
                <FaCamera /> Upload Picture
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={removePhoto} disabled={!profile.avatar_path}>
                <FaTrash /> Remove Picture
              </button>
              <small className="text-muted text-center">No default picture is shown. Upload JPG, PNG, or GIF below 2 MB.</small>
            </div>

            <div className="caretaker-profile-form">
              <div className="caretaker-panel-title">
                <h5>Personal Details</h5>
                <span>{loading ? 'Loading' : 'Editable'}</span>
              </div>

              <label className="form-label">Full Name</label>
              <div className="input-group mb-3">
                <span className="input-group-text"><FaUser /></span>
                <input
                  className="form-control"
                  value={profile.full_name}
                  onChange={(event) => setProfile((current) => ({ ...current, full_name: event.target.value }))}
                  required
                />
              </div>

              <label className="form-label">Email</label>
              <div className="input-group mb-3">
                <span className="input-group-text"><FaEnvelope /></span>
                <input
                  type="email"
                  className="form-control"
                  value={profile.email}
                  onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>

              <label className="form-label">Phone</label>
              <div className="input-group mb-4">
                <span className="input-group-text"><FaPhone /></span>
                <input
                  className="form-control"
                  value={profile.phone}
                  onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>

              <button className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" disabled={saving || loading}>
                <FaSave /> {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
