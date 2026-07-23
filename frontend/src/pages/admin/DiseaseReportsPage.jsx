import { useEffect, useState } from 'react';
import { FaUpload, FaShieldVirus, FaClipboardCheck, FaChartBar } from 'react-icons/fa';
import api, { safeArray } from '../../services/api';
import Swal from 'sweetalert2';

export default function DiseaseReportsPage() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);

  const loadReports = async () => {
    try {
      const res = await api.get('/disease_reports.php');
      setReports(safeArray(res.data));
    } catch (error) {
      setReports([]);
    }
  };

  useEffect(() => { loadReports(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setSelectedImage({ file, preview });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage?.file) return;
    const formData = new FormData();
    formData.append('image', selectedImage.file);
    formData.append('disease_name', 'White Spot Syndrome');
    formData.append('confidence_score', '93');
    formData.append('risk_level', 'High');
    formData.append('recommendation', 'Improve water quality and isolate affected pond.');
    formData.append('status', 'Pending');
    try {
      await api.post('/disease_reports.php', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Swal.fire({ icon: 'success', title: 'Report saved', text: 'Disease report has been uploaded.' });
      setSelectedImage(null);
      loadReports();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Failed', text: error.message });
    }
  };

  const filtered = reports.filter((report) => {
    const matchesSearch = `${report.disease_name} ${report.recommendation}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || report.risk_level.toLowerCase() === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <div className="dashboard-header mb-4">
        <div>
          <h1 className="mb-1">Disease Detection</h1>
          <p className="text-muted mb-0">Upload shrimp imagery and review AI-driven detection results.</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-6">
          <div className="upload-card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                  <h5 className="card-title">Upload Image</h5>
                  <p className="text-muted mb-0">Drag or select an image for disease analysis.</p>
                </div>
                <FaUpload className="text-muted" />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <input type="file" className="form-control" accept="image/*" onChange={handleFileChange} />
                </div>
                <button className="btn btn-primary px-4" type="submit">Scan Disease</button>
              </form>
            </div>
          </div>

          <div className="status-card mt-4">
            <div className="card-body">
              <h5 className="card-title">Detection Result</h5>
              <div className="row g-3 mt-3">
                <div className="col-6">
                  <div className="metric-card p-3">
                    <p className="text-muted small mb-1">Disease</p>
                    <h4 className="mb-0">White Spot Syndrome</h4>
                  </div>
                </div>
                <div className="col-6">
                  <div className="metric-card p-3">
                    <p className="text-muted small mb-1">Confidence</p>
                    <h4 className="mb-0">93%</h4>
                  </div>
                </div>
                <div className="col-6">
                  <div className="metric-card p-3">
                    <p className="text-muted small mb-1">Risk Level</p>
                    <span className="badge badge-danger">High</span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="metric-card p-3">
                    <p className="text-muted small mb-1">Recommendation</p>
                    <p className="mb-0 text-muted">Improve water quality and isolate the pond.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-6">
          <div className="panel-card h-100">
            <div className="panel-body">
              <h5 className="card-title mb-3">Preview</h5>
              {selectedImage ? (
                <img src={selectedImage.preview} alt="Selected" className="admin-preview-image" />
              ) : (
                <div className="admin-preview-empty">
                  <p className="text-muted mb-0">Image preview appears here after selection.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-4">
            <div>
              <h5 className="card-title">Detection History</h5>
              <p className="text-muted mb-0">Previous scans and risk summaries.</p>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <input className="form-control" placeholder="Search reports" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
              <select className="form-select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="all">All risks</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Disease</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => (
                  <tr key={report.id}>
                    <td className="text-muted">IMG</td>
                    <td>{report.disease_name}</td>
                    <td>{report.confidence_score}%</td>
                    <td><span className={`badge ${report.risk_level === 'High' ? 'badge-danger' : report.risk_level === 'Medium' ? 'badge-warning' : 'badge-success'}`}>{report.risk_level}</span></td>
                    <td>{report.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
