import { useCallback, useEffect, useRef, useState } from 'react';
import { FaBug, FaCamera, FaExclamationTriangle, FaFilePdf, FaHistory, FaImage, FaInfoCircle, FaRobot, FaSearch, FaShieldAlt, FaSpinner, FaTimesCircle, FaUpload } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

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
  const [showDebug, setShowDebug] = useState(false);

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

      // Handle Stage 1 Failure (No Shrimp Detected)
      if (prediction.shrimp_detected === false) {
        Swal.fire({
          icon: 'error',
          title: 'No Shrimp Detected',
          text: prediction.message || 'No shrimp was detected in the uploaded image. Please upload a clear image containing a shrimp.',
        });
        return;
      }

      // Handle Stage 2 Failure (Poor Image Quality)
      if (prediction.image_quality === 'Poor Image Quality' || prediction.status === 'Poor Image Quality') {
        Swal.fire({
          icon: 'warning',
          title: 'Poor Image Quality',
          text: prediction.message || 'Please upload a clearer image of a shrimp.',
        });
        return;
      }

      // Handle Stage 4 Confidence Threshold (< 90% Confidence)
      if (prediction.status === 'Uncertain' || !prediction.prediction) {
        Swal.fire({
          icon: 'info',
          title: 'Uncertain Prediction (< 90% Confidence)',
          text: prediction.message || 'Unable to confidently identify the shrimp condition. Please upload a clearer shrimp image.',
        });
        return;
      }

      // Success diagnosis
      const isHealthy = prediction.status === 'Healthy';
      Swal.fire({
        icon: isHealthy ? 'success' : 'warning',
        title: 'Scan Completed',
        text: `${prediction.prediction || prediction.disease_name} (${(prediction.confidence || prediction.confidence_score || 0).toFixed(2)}% confidence via ${prediction.model_used || 'Desktop Model'}).`,
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
        <td>${item.disease_name || 'N/A'}</td>
        <td>${item.confidence_score || 0}%</td>
        <td>${item.model_used || 'Desktop/Shrimp Model'}</td>
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
            <thead><tr><th>Date</th><th>Disease / Condition</th><th>Confidence</th><th>Model Used</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6">No records</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const confidence = Number(result?.confidence || result?.confidence_score || 0);
  const shrimpDetected = result?.shrimp_detected !== false;
  const imageQuality = result?.image_quality || (result?.status === 'Poor Image Quality' ? 'Poor Image Quality' : 'Good Quality');
  const healthStatus = result?.status || 'Pending';
  const diseaseTitle = result?.prediction || result?.disease_name || null;
  const modelUsed = result?.model_used || 'Desktop/Shrimp Trained Model';
  const descriptionText = result?.description || result?.message || '';
  const recommendations = String(result?.recommendation || '').split(/\n|;|-/).map((item) => item.trim()).filter(Boolean);
  const probabilities = result?.probabilities || {};
  const debugInfo = result?.debug || null;

  const getStatusBadgeClass = (status) => {
    if (status === 'Healthy') return 'badge-success';
    if (status === 'Diseased') return 'badge-danger';
    if (status === 'No Shrimp Detected') return 'badge-danger';
    if (status === 'Poor Image Quality') return 'badge-warning';
    return 'badge-warning';
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-0">Multi-Stage AI Disease Scan</h3>
          <p className="text-muted small mb-0">Shrimp Detection $\rightarrow$ Image Quality Check $\rightarrow$ Multi-Model Disease Classification</p>
        </div>
        <div className="d-flex gap-2">
          <button className={`btn btn-sm ${showDebug ? 'btn-dark' : 'btn-outline-dark'} d-flex align-items-center gap-1`} onClick={() => setShowDebug(!showDebug)}>
            <FaBug /> {showDebug ? 'Hide Debug' : 'Debug Info'}
          </button>
          <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2" onClick={exportPdf}>
            <FaFilePdf /> Export PDF
          </button>
        </div>
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
                  {scanning ? <FaSpinner className="disease-spin" /> : <FaSearch />} {scanning ? 'Scanning Pipeline' : 'Scan Image'}
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
              <h5 className="fw-bold mb-3">Pipeline Assessment Result</h5>
              {!result && (
                <div className="disease-empty-result">
                  {scanning ? (
                    <div className="text-center py-4">
                      <FaSpinner className="disease-spin fs-2 text-primary mb-2" />
                      <p className="small text-muted mb-0">Running Stage 1-4 AI Pipeline...</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <FaSearch className="fs-3 text-muted mb-2" />
                      <p className="small text-muted">Upload or capture an image to run the AI diagnosis pipeline.</p>
                    </div>
                  )}
                </div>
              )}

              {result && (
                <div>
                  {/* Stage Status Badges */}
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
                    <span className={`badge ${shrimpDetected ? 'badge-success' : 'badge-danger'} d-flex align-items-center gap-1`}>
                      <FaShieldAlt /> Shrimp Detected: {shrimpDetected ? 'Yes' : 'No'}
                    </span>
                    <span className={`badge ${imageQuality === 'Good Quality' ? 'badge-success' : 'badge-warning'} d-flex align-items-center gap-1`}>
                      Quality: {imageQuality}
                    </span>
                    <span className={`badge ${getStatusBadgeClass(healthStatus)}`}>
                      Status: {healthStatus}
                    </span>
                  </div>

                  {/* Stage 1 Failure UI */}
                  {!shrimpDetected && (
                    <div className="alert alert-danger d-flex align-items-start gap-2 rounded-3 mb-3">
                      <FaTimesCircle className="fs-4 flex-shrink-0 mt-1" />
                      <div>
                        <h6 className="fw-bold mb-1">No Shrimp Detected</h6>
                        <p className="small mb-0">{result.message || 'No shrimp was detected in the uploaded image. Please upload a clear image containing a shrimp.'}</p>
                      </div>
                    </div>
                  )}

                  {/* Stage 2 Failure UI */}
                  {shrimpDetected && imageQuality === 'Poor Image Quality' && (
                    <div className="alert alert-warning d-flex align-items-start gap-2 rounded-3 mb-3">
                      <FaExclamationTriangle className="fs-4 flex-shrink-0 mt-1" />
                      <div>
                        <h6 className="fw-bold mb-1">Poor Image Quality</h6>
                        <p className="small mb-0">{result.message || 'Please upload a clearer image of a shrimp.'}</p>
                      </div>
                    </div>
                  )}

                  {/* Stage 4 Low Confidence / Uncertain UI */}
                  {shrimpDetected && imageQuality === 'Good Quality' && healthStatus === 'Uncertain' && (
                    <div className="alert alert-info d-flex align-items-start gap-2 rounded-3 mb-3">
                      <FaInfoCircle className="fs-4 flex-shrink-0 mt-1" />
                      <div>
                        <h6 className="fw-bold mb-1">Uncertain Prediction (&lt; 90% Confidence)</h6>
                        <p className="small mb-0">{result.message || 'Unable to confidently identify the shrimp condition. Please upload a clearer shrimp image.'}</p>
                      </div>
                    </div>
                  )}

                  {/* Successful Prediction Details */}
                  {diseaseTitle && (
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <h4 className="fw-bold mb-0 text-primary">{diseaseTitle}</h4>
                        <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                          <FaRobot className="text-primary" /> {modelUsed}
                        </span>
                      </div>
                      <p className="small text-muted mb-3">{descriptionText}</p>

                      <div className="d-flex justify-content-between small fw-semibold mb-1">
                        <span>Confidence Score</span>
                        <span>{confidence.toFixed(2)}%</span>
                      </div>
                      <div className="progress disease-confidence mb-3">
                        <div
                          className={`progress-bar ${healthStatus === 'Healthy' ? 'bg-success' : 'bg-danger'}`}
                          style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Disease Class Probabilities Breakdown */}
                  {Object.keys(probabilities).length > 0 && (
                    <div className="card bg-light border-0 mb-3">
                      <div className="card-body p-3">
                        <h6 className="fw-bold small text-uppercase text-muted mb-2">Class Probability Breakdown</h6>
                        {Object.entries(probabilities).map(([diseaseName, probScore]) => (
                          <div key={diseaseName} className="mb-2">
                            <div className="d-flex justify-content-between small mb-1">
                              <span className="fw-semibold">{diseaseName}</span>
                              <span className="text-muted">{Number(probScore).toFixed(2)}%</span>
                            </div>
                            <div className="progress" style={{ height: 6 }}>
                              <div
                                className={`progress-bar ${diseaseName.includes('Healthy') ? 'bg-success' : (diseaseName.includes('White Spot') ? 'bg-danger' : 'bg-warning')}`}
                                style={{ width: `${Math.min(100, Math.max(0, Number(probScore)))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div>
                      <h6 className="fw-bold mb-2">Recommendation</h6>
                      <ul className="ps-3 mb-0 small text-secondary">
                        {recommendations.map((item) => <li key={item} className="mb-1">{item}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Debug Info Panel */}
                  {showDebug && debugInfo && (
                    <div className="card bg-dark text-light border-0 mt-3">
                      <div className="card-body p-3 extra-small font-monospace">
                        <h6 className="fw-bold text-warning mb-2"><FaBug /> AI Model Debug Log</h6>
                        <div><strong>Model Name:</strong> {debugInfo.loaded_model_name}</div>
                        <div><strong>Model Path:</strong> {debugInfo.model_path}</div>
                        <div><strong>Preprocessing:</strong> {debugInfo.preprocessing}</div>
                        <div><strong>Predicted Class:</strong> {debugInfo.predicted_class} ({debugInfo.confidence_percentage}%)</div>
                        <div><strong>Class Labels:</strong> {JSON.stringify(debugInfo.class_labels)}</div>
                        <div><strong>Raw Float Outputs:</strong> {JSON.stringify(debugInfo.raw_probabilities_array)}</div>
                      </div>
                    </div>
                  )}
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
            <h5 className="fw-bold mb-0">Detection & Pipeline History</h5>
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Disease / Outcome</th>
                  <th>Confidence</th>
                  <th>AI Model Used</th>
                  <th>Risk Level</th>
                  <th>Pipeline Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan="6" className="text-muted">No disease scans recorded.</td></tr>
                )}
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at}</td>
                    <td className="fw-semibold">{item.disease_name}</td>
                    <td>{Number(item.confidence_score || 0).toFixed(2)}%</td>
                    <td><small className="text-muted"><FaRobot className="me-1 text-primary" />{item.model_used || 'Desktop/Shrimp Trained Model'}</small></td>
                    <td><span className={`badge ${item.risk_level === 'High' ? 'badge-danger' : (item.risk_level === 'Medium' ? 'badge-warning' : (item.risk_level === 'None' ? 'badge-secondary' : 'badge-success'))}`}>{item.risk_level}</span></td>
                    <td><span className={`badge ${getStatusBadgeClass(item.health_status || item.status)}`}>{item.health_status || item.status}</span></td>
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
