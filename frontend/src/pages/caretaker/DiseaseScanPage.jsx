import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCamera, FaFilePdf, FaHistory, FaImage, FaSearch, FaSpinner, FaUpload } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

const WSSV_NAME = 'White Spot Syndrome Virus (WSSV)';

export default function DiseaseScanPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageSource, setImageSource] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const params = user?.id ? { user_id: user.id } : {};
      const response = await api.get('/disease_reports.php', { params });
      setHistory(safeArray(response.data).slice(0, 8));
    } catch (error) {
      console.error('Unable to load disease scan history:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (error) {
        setStreaming(false);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    const video = videoRef.current;
    if (!video || !streaming) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    setImage(dataUrl);
    setImageFile(null);
    setImageSource('Captured photo');
    setResult(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setImageSource('Uploaded image');
    setResult(null);
  };

  const dataUrlToFile = async (dataUrl) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], `caretaker-wssv-scan-${Date.now()}.png`, { type: blob.type || 'image/png' });
  };

  const handleScan = async () => {
    if (!image) {
      Swal.fire({ icon: 'warning', title: 'No shrimp image selected' });
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('status', 'Pending');
      if (user?.id) formData.append('user_id', user.id);
      formData.append('caretaker_name', user?.full_name || 'Caretaker');
      formData.append('pond_name', user?.assigned_ponds?.[0]?.pond_name || 'Assigned Pond');
      formData.append('image', imageFile || await dataUrlToFile(image));

      const response = await api.post('/disease_scan.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const prediction = response.data?.prediction;
      if (!prediction) {
        throw new Error(response.data?.message || 'AI model did not return a prediction. Check the Flask model API.');
      }

      setResult(prediction);
      await loadHistory();

      Swal.fire({
        icon: prediction.risk_level === 'High' ? 'warning' : 'success',
        title: 'Scan completed',
        text: `${prediction.disease_name} with ${prediction.confidence_score}% confidence.`,
      });
    } catch (error) {
      const message = error.response?.data?.message
        || error.response?.data?.ai_response?.message
        || error.message
        || 'AI model unavailable.';
      Swal.fire({
        icon: 'error',
        title: 'Scan failed',
        text: message,
      });
    } finally {
      setScanning(false);
    }
  };

  const exportPdf = () => {
    const rows = history.map((item) => `
      <tr>
        <td>${item.created_at || ''}</td>
        <td>${item.disease_name || ''}</td>
        <td>${item.confidence_score || 0}%</td>
        <td>${item.risk_level || ''}</td>
        <td>${item.status || ''}</td>
      </tr>
    `).join('');

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>ShrimPredict Disease Detection History</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #10294A; }
            h1 { font-size: 22px; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d8e0ea; padding: 8px; text-align: left; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>
          <h1>ShrimPredict Disease Detection History</h1>
          <table>
            <thead><tr><th>Date</th><th>Disease</th><th>Confidence</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5">No records</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const confidence = Number(result?.confidence_score || 0);
  const isWssv = result?.disease_name === WSSV_NAME || result?.disease_name?.includes('White Spot');
  const recommendations = String(result?.recommendation || '').split(/\n|;|-/).map((item) => item.trim()).filter(Boolean);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="fw-bold mb-0">Disease Scan</h3>
        <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={exportPdf}>
          <FaFilePdf /> Export PDF
        </button>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap mb-3">
                <button className="btn btn-success d-flex align-items-center gap-2" onClick={captureImage} disabled={!streaming || scanning}>
                  <FaCamera /> Capture
                </button>
                <button className="btn btn-outline-success d-flex align-items-center gap-2" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
                  <FaUpload /> Upload Image
                </button>
                <button className="btn btn-primary d-flex align-items-center gap-2 ms-sm-auto" onClick={handleScan} disabled={!image || scanning}>
                  {scanning ? <FaSpinner className="disease-spin" /> : <FaSearch />} {scanning ? 'Scanning' : 'Scan Image'}
                </button>
              </div>

              <div className="disease-camera-frame border rounded overflow-hidden mb-3">
                <video ref={videoRef} autoPlay playsInline muted className="disease-camera-video" />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
              />

              {image && (
                <div className="mb-3">
                  <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                    <FaImage className="text-success" />
                    <span>{imageSource || 'Selected image'}</span>
                  </div>
                  <img src={image} alt="shrimp preview" className="disease-preview-image" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="fw-bold mb-3">Prediction Result</h5>
              {!result && (
                <div className="disease-empty-result">
                  {scanning ? <FaSpinner className="disease-spin fs-3 text-primary" /> : <FaSearch className="fs-3 text-muted" />}
                </div>
              )}

              {result && (
                <div>
                  <div className={`badge ${isWssv ? 'badge-danger' : 'badge-success'} mb-3`}>
                    {result.risk_level} Risk
                  </div>
                  <h4 className="fw-bold">{result.disease_name}</h4>
                  <div className="d-flex justify-content-between small fw-semibold mb-1">
                    <span>Confidence</span>
                    <span>{confidence.toFixed(2)}%</span>
                  </div>
                  <div className="progress disease-confidence mb-3">
                    <div
                      className={`progress-bar ${isWssv ? 'bg-danger' : 'bg-success'}`}
                      style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                    />
                  </div>
                  <h6 className="fw-bold">Recommendation</h6>
                  <ul className="ps-3 mb-0">
                    {recommendations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-3">
            <FaHistory className="text-primary" />
            <h5 className="fw-bold mb-0">Detection History</h5>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Disease</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan="5" className="text-muted">No disease scans recorded.</td></tr>
                )}
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at}</td>
                    <td>{item.disease_name}</td>
                    <td>{Number(item.confidence_score || 0).toFixed(2)}%</td>
                    <td><span className={`badge ${item.risk_level === 'High' ? 'badge-danger' : 'badge-success'}`}>{item.risk_level}</span></td>
                    <td>{item.status}</td>
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
