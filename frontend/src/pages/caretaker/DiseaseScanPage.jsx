import { useCallback, useEffect, useRef, useState } from 'react';
import { FaBug, FaCamera, FaCheck, FaExclamationTriangle, FaFilePdf, FaHistory, FaImage, FaInfoCircle, FaQrcode, FaRobot, FaSearch, FaShieldAlt, FaSpinner, FaTimesCircle, FaUpload, FaWater } from 'react-icons/fa';
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

  const [assignedPonds, setAssignedPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');

  useEffect(() => {
    const fetchPonds = async () => {
      let pondsList = user?.assigned_ponds?.length ? user.assigned_ponds : [];
      if (!pondsList.length && user?.pond_id) {
        pondsList = [{ id: user.pond_id, pond_name: 'Assigned Pond' }];
      }
      if (!pondsList.length) {
        try {
          const response = await api.get('/ponds.php');
          pondsList = safeArray(response.data);
        } catch (e) {
          console.error('Unable to fetch ponds:', e);
        }
      }
      if (!pondsList.length) {
        pondsList = [
          { id: 1, pond_name: 'Pond A1' },
          { id: 2, pond_name: 'Pond A2' },
          { id: 3, pond_name: 'Pond A3' },
        ];
      }
      setAssignedPonds(pondsList);
      if (pondsList.length > 0 && !selectedPond) {
        setSelectedPond(pondsList[0].pond_name || pondsList[0].name || `Pond ${pondsList[0].id}`);
      }
    };
    fetchPonds();
  }, [user]);

  const loadHistory = useCallback(async () => {
    try {
      const params = user?.id ? { user_id: user.id } : {};
      const response = await api.get('/disease_reports.php', { params });
      setHistory(safeArray(response.data));
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

  const clearSelectedImage = () => {
    setImage(null);
    setImageFile(null);
    setImageSource('');
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
      formData.append('pond_name', selectedPond || user?.assigned_ponds?.[0]?.pond_name || 'Assigned Pond');
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
    const rows = filteredHistory.map((item) => `
      <tr>
        <td>${item.created_at || ''}</td>
        <td>${item.pond_name || item.disease_name || 'N/A'}</td>
        <td>${item.disease_name || 'N/A'}</td>
        <td>${item.confidence_score || 0}%</td>
        <td>${item.model_used || 'Desktop/Shrimp Model'}</td>
        <td>${item.risk_level || ''}</td>
        <td>${item.health_status || item.status || ''}</td>
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
            <thead><tr><th>Date</th><th>Pond</th><th>Disease / Condition</th><th>Confidence</th><th>Model Used</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7">No records</td></tr>'}</tbody>
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

  const getStatusBadgeClass = (status) => {
    if (status === 'Healthy') return 'badge-success';
    if (status === 'Diseased') return 'badge-danger';
    if (status === 'No Shrimp Detected') return 'badge-danger';
    if (status === 'Poor Image Quality') return 'badge-warning';
    return 'badge-warning';
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch = !historySearch || [
      item.disease_name,
      item.pond_name,
      item.caretaker_name,
      item.model_used,
      item.risk_level,
      item.health_status,
      item.status,
      item.created_at,
    ].some((val) => String(val || '').toLowerCase().includes(historySearch.toLowerCase()));

    const matchesStatus = historyStatusFilter === 'all'
      || (item.health_status || item.status) === historyStatusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="row g-4">
        {/* 📸 LEFT CARD: SCANNER & CONTROLS */}
        <div className="col-lg-7">
          <div
            className="card border border-primary border-opacity-25 shadow-sm rounded-4 position-relative overflow-hidden transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(13, 110, 253, 0.02) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-primary" style={{ height: 4 }} />
            <div className="card-body p-4">
              {/* 🌊 POND SELECTOR BUTTONS (INLINE HEADER) */}
              <div className="mb-3 p-3 bg-white rounded-4 border border-secondary border-opacity-15 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-xs">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="fw-bold text-dark extra-small text-uppercase d-flex align-items-center gap-1.5 me-1 text-nowrap">
                    <FaWater className="text-primary" /> Select Pond:
                  </span>
                  {assignedPonds.map((pond) => {
                    const pName = pond.pond_name || pond.name || `Pond ${pond.id}`;
                    const isSelected = selectedPond === pName;
                    return (
                      <button
                        key={pond.id || pName}
                        type="button"
                        className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold extra-small transition-all d-inline-flex align-items-center gap-1.5 ${
                          isSelected
                            ? 'btn-primary shadow-xs'
                            : 'btn-outline-secondary bg-white text-dark border-opacity-25'
                        }`}
                        onClick={() => setSelectedPond(pName)}
                      >
                        {isSelected && <FaCheck size={10} />} 🌊 {pName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 📸 CAMERA / IMAGE PREVIEW FRAME */}
              <div
                className="disease-camera-frame border border-secondary border-opacity-25 rounded-4 overflow-hidden mb-3 position-relative bg-dark d-flex align-items-center justify-content-center"
                style={{ minHeight: 320, maxHeight: 420 }}
              >
                {image ? (
                  <div className="w-100 h-100 position-relative d-flex align-items-center justify-content-center bg-black">
                    <img src={image} alt="shrimp scan target" className="w-100 h-100 object-fit-contain" style={{ maxHeight: 400 }} />
                    <div className="position-absolute top-0 start-0 end-0 p-3 bg-dark bg-opacity-50 text-white d-flex align-items-center">
                      <span className="extra-small fw-bold d-flex align-items-center gap-1.5">
                        <FaImage className="text-success" /> {imageSource || 'Selected Image'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="disease-camera-video w-100 h-100 object-fit-cover" />
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
              />

              {/* 🎛️ ACTION BUTTONS */}
              <div className="d-flex align-items-center justify-content-between gap-2 pt-1 w-100 flex-nowrap">
                <div className="d-flex align-items-center gap-2 flex-grow-1 flex-nowrap">
                  <button
                    className="btn btn-success rounded-pill px-3 py-1.5 fw-bold text-nowrap d-inline-flex align-items-center justify-content-center gap-1.5 shadow-xs flex-grow-1"
                    style={{ height: 38, minWidth: 95, fontSize: '0.8rem' }}
                    onClick={captureImage}
                    disabled={!streaming || scanning}
                  >
                    <FaCamera size={13} /> Capture
                  </button>
                  <button
                    className="btn btn-outline-success rounded-pill px-3 py-1.5 fw-bold text-nowrap d-inline-flex align-items-center justify-content-center gap-1.5 flex-grow-1"
                    style={{ height: 38, minWidth: 95, fontSize: '0.8rem' }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning}
                  >
                    <FaUpload size={13} /> Upload
                  </button>
                  <button
                    className={`btn rounded-pill px-3 py-1.5 fw-bold text-nowrap d-inline-flex align-items-center justify-content-center gap-1.5 flex-grow-1 transition-all ${
                      image
                        ? 'btn-outline-danger'
                        : 'btn-outline-secondary opacity-50 cursor-not-allowed'
                    }`}
                    style={{ height: 38, minWidth: 95, fontSize: '0.8rem' }}
                    onClick={clearSelectedImage}
                    disabled={!image || scanning}
                    title={image ? 'Clear selected image' : 'No image to clear'}
                  >
                    <FaTimesCircle size={13} /> Clear
                  </button>
                </div>
                <button
                  className="btn btn-primary rounded-pill px-4 py-1.5 fw-bold text-nowrap d-inline-flex align-items-center justify-content-center gap-1.5 shadow-xs flex-shrink-0"
                  style={{ height: 38, minWidth: 95, fontSize: '0.8rem' }}
                  onClick={handleScan}
                  disabled={!image || scanning}
                >
                  {scanning ? <FaSpinner className="disease-spin" size={13} /> : <FaQrcode size={13} />}
                  {scanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 🧪 RIGHT CARD: PIPELINE ASSESSMENT RESULT */}
        <div className="col-lg-5">
          <div
            className="card border border-info border-opacity-25 shadow-sm rounded-4 position-relative overflow-hidden h-100 transition-all hover-shadow"
            style={{ background: 'linear-gradient(180deg, rgba(13, 202, 240, 0.02) 0%, #ffffff 100%)' }}
          >
            <div className="position-absolute top-0 start-0 end-0 bg-info" style={{ height: 4 }} />
            <div className="card-body p-4">
              <h5 className="fw-bold mb-3 text-dark">Pipeline Assessment Result</h5>
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
                    <div className="card bg-light border-0 mb-3 rounded-4">
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
                      <h6 className="fw-bold mb-2 text-dark">Recommendation</h6>
                      <ul className="ps-3 mb-0 small text-secondary">
                        {recommendations.map((item) => <li key={item} className="mb-1">{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📜 DETECTION & PIPELINE HISTORY TABLE WITH FILTER TOOLSTRIP & EXPORT PDF */}
      <div className="card border-0 shadow-sm rounded-4 mt-4">
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                <FaHistory className="text-primary" /> Detection & Pipeline History
              </h5>
              <small className="text-muted">History of AI disease scan assessments for assigned ponds</small>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
              {/* Search Bar */}
              <div
                className="input-group bg-white border border-secondary border-opacity-25 rounded-pill shadow-xs overflow-hidden d-flex align-items-center px-3"
                style={{ width: 190, height: 36 }}
              >
                <span className="text-muted extra-small me-2 d-flex align-items-center"><FaSearch /></span>
                <input
                  type="text"
                  className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-medium text-dark"
                  placeholder="Search history..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  style={{ height: '100%' }}
                />
              </div>

              {/* Status Filter */}
              <select
                className="form-select form-select-sm rounded-pill fw-bold border-primary border-opacity-25 bg-primary bg-opacity-10 text-primary px-3 py-1 shadow-xs cursor-pointer"
                style={{ height: 36, width: 'auto', minWidth: 130, fontSize: '0.81rem' }}
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                aria-label="Filter scan history by status"
              >
                <option value="all" className="bg-white text-dark">All Statuses</option>
                <option value="Healthy" className="bg-white text-dark">Healthy</option>
                <option value="Diseased" className="bg-white text-dark">Diseased</option>
                <option value="Uncertain" className="bg-white text-dark">Uncertain</option>
                <option value="Poor Image Quality" className="bg-white text-dark">Poor Quality</option>
              </select>

              {/* Export PDF Button */}
              <button
                className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5 fw-bold extra-small d-inline-flex align-items-center gap-1.5 shadow-xs text-nowrap"
                style={{ height: 36 }}
                onClick={exportPdf}
              >
                <FaFilePdf /> Export PDF
              </button>
            </div>
          </div>

          <div className="table-responsive border rounded-3 shadow-xs">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3 py-3 text-secondary text-uppercase extra-small fw-bold">Date & Time</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Pond</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Disease / Outcome</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Confidence</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">AI Model Used</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Risk Level</th>
                  <th className="py-3 text-secondary text-uppercase extra-small fw-bold">Pipeline Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted extra-small fw-medium">
                      {historySearch
                        ? `No scan logs matching "${historySearch}".`
                        : 'No disease scans recorded.'}
                    </td>
                  </tr>
                )}
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="ps-3 font-mono extra-small text-muted">{item.created_at}</td>
                    <td className="fw-bold text-dark">{item.pond_name || 'Assigned Pond'}</td>
                    <td className="fw-semibold text-primary">{item.disease_name}</td>
                    <td className="fw-bold">{Number(item.confidence_score || 0).toFixed(2)}%</td>
                    <td>
                      <small className="text-muted"><FaRobot className="me-1 text-primary" />{item.model_used || 'Desktop Model'}</small>
                    </td>
                    <td>
                      <span className={`badge ${item.risk_level === 'High' ? 'bg-danger' : (item.risk_level === 'Medium' ? 'bg-warning text-dark' : 'bg-success')}`}>
                        {item.risk_level || 'Low'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(item.health_status || item.status)}`}>
                        {item.health_status || item.status}
                      </span>
                    </td>
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
