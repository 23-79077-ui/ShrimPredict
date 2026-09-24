import { useCallback, useEffect, useRef, useState } from 'react';
import { FaBug, FaCamera, FaCheck, FaExclamationTriangle, FaFilePdf, FaHistory, FaImage, FaInfoCircle, FaQrcode, FaRobot, FaSearch, FaShieldAlt, FaSpinner, FaTimesCircle, FaUpload, FaWater } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api, { safeArray } from '../../services/api';

function isPrimaryDiagnosisLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  return label === 'healthy'
    || label === 'healthy shrimp'
    || label === 'white spot syndrome virus'
    || label === 'white spot syndrome virus (wssv)'
    || label === 'wssv'
    || label === 'black gill'
    || label === 'black gill disease';
}

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
  const [additionalScanEnabled, setAdditionalScanEnabled] = useState(false);
  const [showAdditionalPrompt, setShowAdditionalPrompt] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const [assignedPonds, setAssignedPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refreshShrimpPreview = useCallback(async (file) => {
    if (!file) {
      setPreviewCount(null);
      return;
    }

    try {
      setPreviewLoading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/shrimp_count.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const isCooked = Boolean(response?.data?.is_cooked === true || response?.data?.is_cooked === 1 || response?.data?.is_cooked === '1' || response?.data?.is_cooked === 'true');
      const detected = [response?.data?.shrimp_detected, response?.data?.valid_shrimp_present]
        .some((value) => value === true || value === 1 || value === '1' || value === 'true')
        || response?.data?.status === 'success'
        || response?.data?.status === 'cooked_shrimp';
      const parsedCount = Number(response?.data?.shrimp_count);
      const count = detected ? Math.max(1, Number.isFinite(parsedCount) ? parsedCount : 1) : 0;
      setPreviewCount({
        count,
        detected,
        is_cooked: isCooked,
        status: isCooked ? 'Unavailable to scan: Cooked Shrimp' : (detected ? 'Ready for Scan' : 'No shrimp detected'),
        message: response?.data?.message || 'Preview result unavailable.',
      });
    } catch (error) {
      setPreviewCount({
        count: 0,
        detected: false,
        status: 'Preview unavailable',
        message: error?.response?.data?.message || 'Unable to count shrimp in this image.',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, []);

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
    setAdditionalScanEnabled(false);
    setShowAdditionalPrompt(false);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setImageSource('Uploaded image');
    setResult(null);
    setAdditionalScanEnabled(false);
    setShowAdditionalPrompt(false);
  };

  const handleDroppedImage = useCallback(async (file) => {
    if (!file) return;
    setImageFile(file);
    setImage(URL.createObjectURL(file));
    setImageSource('Dropped image');
    setResult(null);
    setAdditionalScanEnabled(false);
    setShowAdditionalPrompt(false);
  }, [refreshShrimpPreview]);

  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleDroppedImage(file);
    }
  }, [handleDroppedImage]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  const scanReady = Boolean(
    image
    && !scanning
    && !previewLoading
    && (!imageFile || (previewCount?.detected && !previewCount?.is_cooked))
    && !previewCount?.is_cooked
  );

  useEffect(() => {
    if (!imageFile) {
      setPreviewCount(null);
      return;
    }
    refreshShrimpPreview(imageFile);
  }, [imageFile, refreshShrimpPreview]);

  const clearSelectedImage = () => {
    setImage(null);
    setImageFile(null);
    setImageSource('');
    setResult(null);
    setAdditionalScanEnabled(false);
    setShowAdditionalPrompt(false);
    setPreviewCount(null);
  };

  const dataUrlToFile = async (dataUrl) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], `caretaker-wssv-scan-${Date.now()}.png`, { type: blob.type || 'image/png' });
  };

  const handleScan = async (enableAdditional = false) => {
    if (!image) {
      Swal.fire({ icon: 'warning', title: 'No shrimp image selected' });
      return;
    }

    if (previewCount?.is_cooked) {
      Swal.fire({
        icon: 'error',
        title: 'Unavailable to scan',
        text: 'Shrimp was detected, but it appears to be cooked. Please upload raw uncooked shrimp for diagnosis.',
      });
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
      formData.append('enable_additional', enableAdditional ? 'true' : 'false');
      formData.append('image', imageFile || await dataUrlToFile(image));

      const response = await api.post('/disease_scan.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const isCookedResult = Boolean(response.data?.is_cooked === true || response.data?.is_cooked === 1 || response.data?.is_cooked === '1' || response.data?.is_cooked === 'true');
      if (isCookedResult) {
        Swal.fire({
          icon: 'error',
          title: 'Unavailable to scan',
          text: 'Shrimp was detected, but it appears to be cooked. Please upload raw uncooked shrimp for diagnosis.',
        });
        setResult({
          shrimp_detected: true,
          is_cooked: true,
          status: 'Error',
          message: 'Shrimp was detected, but it appears to be cooked.',
        });
        return;
      }

      const prediction = response.data?.prediction;
      if (!prediction) {
        throw new Error(response.data?.message || 'AI model did not return a prediction. Check the Flask model API.');
      }

      const predictionName = String(prediction.prediction || prediction.disease_name || '').trim().toLowerCase();
      const isPrimaryDiagnosis = isPrimaryDiagnosisLabel(predictionName);

      setResult(prediction);
      setAdditionalScanEnabled(enableAdditional);
      setShowAdditionalPrompt(!enableAdditional && !isPrimaryDiagnosis);
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
      if (prediction.status === 'Uncertain' || !prediction.prediction || (!enableAdditional && !isPrimaryDiagnosis)) {
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

  const handleAdditionalDetection = () => {
    if (result?.prediction || result?.disease_name) {
      setAdditionalScanEnabled(true);
      setShowAdditionalPrompt(false);
      return;
    }

    handleScan(true);
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
  const resultName = String(result?.prediction || result?.disease_name || '').trim().toLowerCase();
  const isPrimaryResult = isPrimaryDiagnosisLabel(resultName);
  const shouldShowAdditionalPrompt = Boolean(result && !additionalScanEnabled && (showAdditionalPrompt || !isPrimaryResult));

  const renderedProbabilities = (() => {
    const entries = Object.entries(probabilities).filter(([diseaseName]) => {
      const label = String(diseaseName || '').trim().toLowerCase();
      return !label.includes('black gill');
    });

    if (entries.length === 0) return [];

    const lowerResultName = String(result?.prediction || result?.disease_name || '').trim().toLowerCase();
    const isWssvResult = lowerResultName.includes('white spot') || lowerResultName.includes('wssv');
    const isHealthyResult = lowerResultName.includes('healthy');

    const wssvKey = entries.find(([diseaseName]) => {
      const label = String(diseaseName || '').trim().toLowerCase();
      return label.includes('white spot') || label.includes('wssv');
    });

    const healthyKey = entries.find(([diseaseName]) => {
      const label = String(diseaseName || '').trim().toLowerCase();
      return label.includes('healthy');
    });

    if ((wssvKey || healthyKey) && (isWssvResult || isHealthyResult)) {
      const safeConfidence = Math.min(100, Math.max(0, Number(confidence || 0)));
      const wssvValue = isWssvResult ? safeConfidence : Math.max(0, 100 - safeConfidence);
      const healthyValue = isHealthyResult ? safeConfidence : Math.max(0, 100 - safeConfidence);

      return entries.map(([diseaseName, probScore]) => {
        const label = String(diseaseName || '').trim().toLowerCase();
        if (label.includes('white spot') || label.includes('wssv')) {
          return [diseaseName, wssvValue];
        }
        if (label.includes('healthy')) {
          return [diseaseName, healthyValue];
        }
        return [diseaseName, Number(probScore)];
      });
    }

    return entries;
  })();

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
    <div className="caretaker-diseasescan-hub">
      {/* 🌟 PAGE HEADER HERO BAR */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span
              className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
              style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}
            >
              <FaRobot className="me-1" /> AI Computer Vision
            </span>
            <span
              className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
              style={{ backgroundColor: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
            >
              WSSV &amp; Health Pipeline
            </span>
          </div>
          <h3 className="fw-extrabold text-dark mb-1 tracking-tight">Disease Scan &amp; Diagnostics</h3>
          <p className="text-muted small mb-0">
            Real-time optical AI inspection for White Spot Syndrome Virus (WSSV), cooked shrimp detection, and health diagnosis.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill extra-small fw-bold"
            style={{ backgroundColor: '#FFFFFF', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)', boxShadow: '0 2px 6px rgba(11,44,95,0.04)' }}
          >
            <span className="rounded-circle bg-success" style={{ width: 8, height: 8 }} />
            <span>AI Pipeline Active (EfficientNet / CNN)</span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* 📸 LEFT CARD: SCANNER & CONTROLS */}
        <div className="col-12 col-lg-7">
          <div className="tri-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              {/* Card Sub-Header */}
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <FaCamera style={{ color: '#0B2C5F' }} /> Live Scanner &amp; Image Ingestion
                  </h6>
                  <small className="text-muted">Target pond for diagnostic logging</small>
                </div>
              </div>

              {/* Pond Selection Pills */}
              <div
                className="p-2.5 rounded-3 mb-3 d-flex align-items-center gap-2 flex-wrap"
                style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.1)' }}
              >
                <span className="extra-small fw-bold text-uppercase d-flex align-items-center gap-1 ps-1" style={{ color: '#0B2C5F' }}>
                  <FaWater /> Pond:
                </span>
                {assignedPonds.map((pond) => {
                  const pName = pond.pond_name || pond.name || `Pond ${pond.id}`;
                  const isSelected = selectedPond === pName;
                  return (
                    <button
                      key={pond.id || pName}
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 extra-small fw-bold transition-all d-inline-flex align-items-center gap-1.5 ${
                        isSelected ? 'btn-tri-navy shadow-xs' : 'btn-tri-outline'
                      }`}
                      onClick={() => setSelectedPond(pName)}
                    >
                      {isSelected && <FaCheck size={9} />} {pName}
                    </button>
                  );
                })}
              </div>

              {/* 📸 CAMERA / IMAGE PREVIEW FRAME */}
              <div
                className="rounded-4 overflow-hidden mb-3 position-relative d-flex align-items-center justify-content-center"
                style={{
                  minHeight: 330,
                  maxHeight: 400,
                  backgroundColor: '#071733',
                  border: '1px solid rgba(11, 44, 95, 0.15)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)',
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {image ? (
                  <div className="w-100 h-100 position-relative d-flex align-items-center justify-content-center bg-black">
                    <img
                      src={image}
                      alt="shrimp scan target"
                      className="w-100 h-100 object-fit-contain"
                      style={{ maxHeight: 380 }}
                    />
                    <div
                      className="position-absolute top-0 start-0 end-0 p-3 text-white d-flex align-items-center justify-content-between"
                      style={{ background: 'linear-gradient(180deg, rgba(7, 23, 51, 0.85) 0%, transparent 100%)' }}
                    >
                      <span className="extra-small fw-bold d-flex align-items-center gap-1.5">
                        <FaImage style={{ color: '#EA580C' }} /> {imageSource || 'Selected Image'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-dark bg-opacity-75 rounded-pill px-2.5 py-0.5 extra-small fw-bold"
                        onClick={clearSelectedImage}
                      >
                        <FaTimesCircle className="me-1" /> Retake
                      </button>
                    </div>
                    <div
                      className="position-absolute bottom-0 start-0 end-0 p-3 text-white d-flex justify-content-between align-items-center gap-2"
                      style={{ background: 'linear-gradient(0deg, rgba(7, 23, 51, 0.9) 0%, transparent 100%)' }}
                    >
                      <span className="small fw-semibold">
                        {previewLoading ? 'Inspecting shrimp geometry…' : (previewCount?.is_cooked ? 'Cooked shrimp detected' : 'Detected Shrimp Target')}
                      </span>
                      <span
                        className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                        style={{
                          backgroundColor: previewCount?.is_cooked
                            ? '#FEF2F2'
                            : (previewCount?.detected ? '#F0FDF4' : '#FFF7ED'),
                          color: previewCount?.is_cooked
                            ? '#DC2626'
                            : (previewCount?.detected ? '#16A34A' : '#EA580C'),
                          border: `1px solid ${
                            previewCount?.is_cooked
                              ? '#FCA5A5'
                              : (previewCount?.detected ? '#BBF7D0' : '#FFEDD5')
                          }`,
                        }}
                      >
                        {previewLoading ? 'Checking…' : (previewCount?.is_cooked ? 'Unavailable to scan: Cooked Shrimp' : (previewCount?.status || 'No shrimp detected'))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-100 h-100 object-fit-cover"
                      style={{ minHeight: 330, maxHeight: 400 }}
                    />
                    {!streaming && (
                      <div className="position-absolute text-center text-white-50 p-4">
                        <FaCamera size={36} className="mb-2 opacity-50" />
                        <p className="small mb-1 text-white">Camera not available or permission required.</p>
                        <p className="extra-small text-white-50 mb-0">You can upload or drag-and-drop a photo below.</p>
                      </div>
                    )}
                  </>
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

              {/* 🎛️ ACTION BUTTONS TOOLBAR */}
              <div className="d-flex align-items-center justify-content-between gap-2 pt-1 w-100 flex-wrap flex-sm-nowrap caretaker-scan-toolbar">
                <div className="d-flex align-items-center gap-2 flex-grow-1">
                  <button
                    type="button"
                    className="btn btn-tri-outline px-3 py-2 fw-bold extra-small flex-grow-1"
                    onClick={captureImage}
                    disabled={!streaming || scanning}
                  >
                    <FaCamera /> Capture Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-tri-outline px-3 py-2 fw-bold extra-small flex-grow-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scanning}
                  >
                    <FaUpload /> Upload Image
                  </button>
                  {image && (
                    <button
                      type="button"
                      className="btn btn-tri-outline-orange px-3 py-2 fw-bold extra-small"
                      onClick={clearSelectedImage}
                      disabled={scanning}
                      title="Clear selected image"
                    >
                      <FaTimesCircle /> Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-tri-navy px-4 py-2 fw-bold extra-small flex-shrink-0 shadow-sm caretaker-scan-submit-btn"
                  style={{ minWidth: 130 }}
                  onClick={() => handleScan(false)}
                  disabled={!scanReady}
                >
                  {scanning ? <FaSpinner className="disease-spin" /> : <FaQrcode />}
                  {scanning ? 'Analyzing…' : 'Scan Shrimp'}
                </button>
              </div>
            </div>

            {/* Literature Benchmark Accordion */}
            <div
              className="mt-4 rounded-3 overflow-hidden"
              style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.1)' }}
            >
              <details>
                <summary className="fw-bold p-3 extra-small" style={{ cursor: 'pointer', listStyle: 'none', color: '#0B2C5F' }}>
                  <FaInfoCircle className="me-2 text-primary" />
                  View Model Accuracy Literature &amp; Research Baselines
                </summary>
                <div className="p-3 pt-0 border-top" style={{ fontSize: '0.82rem' }}>
                  <p className="mb-2 text-muted extra-small">Current AI detection baselines established by scientific literature:</p>
                  <ul className="mb-0 text-dark extra-small ps-3">
                    <li className="mb-1.5">
                      <strong>Advanced CNN (LeNet) Precision:</strong> Up to 96.1% Precision for <i>Penaeus vannamei</i> disease classification.
                      <a href="https://doi.org/10.1016/j.aquaeng.2022.102296" target="_blank" rel="noopener noreferrer" className="ms-1 fw-bold" style={{ color: '#0B2C5F' }}>
                        (Read Study)
                      </a>
                    </li>
                    <li className="mb-1.5">
                      <strong>Deep Learning (YOLOv8):</strong> 92.0% mean Average Precision (mAP) for healthy vs. diseased classification.
                      <a href="https://scholar.google.com/scholar?q=Video-Based+Disease+Detection+in+Vannamei+Shrimp+Using+YOLOv8" target="_blank" rel="noopener noreferrer" className="ms-1 fw-bold" style={{ color: '#0B2C5F' }}>
                        (Search Scholar)
                      </a>
                    </li>
                    <li className="mb-0">
                      <strong>WSSV Specific Detection (ANN/DL):</strong> 90.0% Accuracy Rate.
                      <a href="https://scholar.google.com/scholar?q=Shrimp+disease+detection+using+deep+learning+techniques" target="_blank" rel="noopener noreferrer" className="ms-1 fw-bold" style={{ color: '#0B2C5F' }}>
                        (Search Scholar)
                      </a>
                    </li>
                  </ul>
                  <p className="mt-2 mb-0 extra-small text-muted fst-italic">
                    *Our system utilizes an EfficientNet/CNN transfer learning pipeline targeted to perform within or above these literature baselines.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* 🧪 RIGHT CARD: PIPELINE ASSESSMENT RESULT */}
        <div className="col-12 col-lg-5">
          <div className="tri-card p-4 h-100 d-flex flex-column">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <FaShieldAlt style={{ color: '#0B2C5F' }} /> Pipeline Assessment Result
              </h6>
              {result && (
                <span
                  className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                  style={{
                    backgroundColor: healthStatus === 'Healthy' ? '#F0FDF4' : '#FFF7ED',
                    color: healthStatus === 'Healthy' ? '#16A34A' : '#EA580C',
                    border: `1px solid ${healthStatus === 'Healthy' ? '#BBF7D0' : '#FFEDD5'}`,
                  }}
                >
                  {healthStatus}
                </span>
              )}
            </div>

            {shouldShowAdditionalPrompt ? (
              <div
                className="p-3.5 rounded-3 mb-0"
                style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5' }}
              >
                <div className="d-flex align-items-center gap-2 mb-2" style={{ color: '#EA580C' }}>
                  <FaExclamationTriangle size={18} />
                  <strong className="text-dark">Additional Disease Detection</strong>
                </div>
                <p className="small text-muted mb-3">
                  No WSSV detected and the shrimp is not classified as healthy. Would you like to enable secondary disease detection features?
                </p>
                <button
                  type="button"
                  className="btn btn-tri-orange btn-sm px-3.5 py-1.5 extra-small fw-bold"
                  onClick={handleAdditionalDetection}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning…' : 'Yes, Run Extended Diagnosis'}
                </button>
              </div>
            ) : (
              <>
                  {!result && (
                    <div
                      className="d-flex flex-column align-items-center justify-content-center text-center p-4 rounded-3 flex-grow-1"
                      style={{ backgroundColor: '#F8FAFD', border: '1px dashed rgba(11, 44, 95, 0.16)', minHeight: 280 }}
                    >
                      {scanning ? (
                        <>
                          <FaSpinner className="disease-spin fs-1 mb-3" style={{ color: '#0B2C5F' }} />
                          <h6 className="fw-bold mb-1" style={{ color: '#0B2C5F' }}>Running AI Pipeline</h6>
                          <p className="extra-small text-muted mb-0">Executing Stages 1–4 Computer Vision Diagnostics…</p>
                        </>
                      ) : (
                        <>
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                            style={{ width: 56, height: 56, backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}
                          >
                            <FaSearch size={22} />
                          </div>
                          <h6 className="fw-bold text-dark mb-1">Awaiting Shrimp Target</h6>
                          <p className="extra-small text-muted mb-0" style={{ maxWidth: 260 }}>
                            Capture or upload an image to run the automated WSSV and health assessment pipeline.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {result && (
                    <div className="d-flex flex-column gap-3">
                      {/* Stage Status Badges */}
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span
                          className="badge rounded-pill extra-small fw-bold px-2.5 py-1.5 d-inline-flex align-items-center gap-1.5"
                          style={
                            shrimpDetected
                              ? { backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
                              : { backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                          }
                        >
                          <FaShieldAlt /> Shrimp Detected: {shrimpDetected ? 'Yes' : 'No'}
                        </span>
                        <span
                          className="badge rounded-pill extra-small fw-bold px-2.5 py-1.5 d-inline-flex align-items-center gap-1.5"
                          style={
                            imageQuality === 'Good Quality'
                              ? { backgroundColor: 'rgba(11, 44, 95, 0.07)', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }
                              : { backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }
                          }
                        >
                          Quality: {imageQuality}
                        </span>
                        <span
                          className="badge rounded-pill extra-small fw-bold px-2.5 py-1.5"
                          style={
                            healthStatus === 'Healthy'
                              ? { backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
                              : healthStatus === 'Diseased'
                              ? { backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                              : { backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }
                          }
                        >
                          Status: {healthStatus}
                        </span>
                      </div>

                      {/* Stage 1 Failure UI */}
                      {!shrimpDetected && (
                        <div
                          className="p-3 rounded-3 d-flex align-items-start gap-2.5"
                          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
                        >
                          <FaTimesCircle className="fs-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="fw-bold mb-1">No Shrimp Detected</h6>
                            <p className="extra-small mb-0 opacity-90">
                              {result.message || 'No shrimp was detected in the uploaded image. Please upload a clear image containing a shrimp.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stage 2 Failure UI */}
                      {shrimpDetected && imageQuality === 'Poor Image Quality' && (
                        <div
                          className="p-3 rounded-3 d-flex align-items-start gap-2.5"
                          style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', color: '#C2410C' }}
                        >
                          <FaExclamationTriangle className="fs-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="fw-bold mb-1">Poor Image Quality</h6>
                            <p className="extra-small mb-0 opacity-90">
                              {result.message || 'Please upload a clearer image of a shrimp.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stage 4 Low Confidence / Uncertain UI */}
                      {shrimpDetected && imageQuality === 'Good Quality' && healthStatus === 'Uncertain' && (
                        <div
                          className="p-3 rounded-3 d-flex align-items-start gap-2.5"
                          style={{ backgroundColor: 'rgba(11, 44, 95, 0.05)', border: '1px solid rgba(11, 44, 95, 0.16)', color: '#0B2C5F' }}
                        >
                          <FaInfoCircle className="fs-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <h6 className="fw-bold mb-1">Uncertain Prediction (&lt; 90% Confidence)</h6>
                            <p className="extra-small mb-0 opacity-90">
                              {result.message || 'Unable to confidently identify the shrimp condition. Please upload a clearer shrimp image.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Successful Prediction Details */}
                      {diseaseTitle && (
                        <div
                          className="p-3.5 rounded-3"
                          style={{
                            backgroundColor: healthStatus === 'Healthy' ? '#F0FDF4' : '#FFF7ED',
                            border: healthStatus === 'Healthy' ? '1px solid #BBF7D0' : '1px solid #FFEDD5',
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                            <div>
                              <span
                                className="extra-small fw-bold text-uppercase tracking-wider d-block mb-0.5"
                                style={{ color: healthStatus === 'Healthy' ? '#15803D' : '#EA580C' }}
                              >
                                Primary Diagnosis
                              </span>
                              <h4
                                className="fw-extrabold mb-0 tracking-tight"
                                style={{ color: healthStatus === 'Healthy' ? '#166534' : '#9A3412' }}
                              >
                                {diseaseTitle}
                              </h4>
                            </div>
                            <span
                              className="badge rounded-pill extra-small fw-bold px-2.5 py-1 d-inline-flex align-items-center gap-1.5"
                              style={{ backgroundColor: '#FFFFFF', color: '#0B2C5F', border: '1px solid rgba(11, 44, 95, 0.16)' }}
                            >
                              <FaRobot style={{ color: '#0B2C5F' }} /> {modelUsed}
                            </span>
                          </div>

                          {descriptionText && (
                            <p className="small text-muted mb-3" style={{ lineHeight: 1.5 }}>
                              {descriptionText}
                            </p>
                          )}

                          <div className="d-flex justify-content-between extra-small fw-bold mb-1.5">
                            <span style={{ color: '#0B2C5F' }}>AI Confidence Score</span>
                            <span className="fw-extrabold" style={{ color: healthStatus === 'Healthy' ? '#15803D' : '#EA580C' }}>
                              {confidence.toFixed(2)}%
                            </span>
                          </div>
                          <div className="tri-progress-track mb-1" style={{ height: 10 }}>
                            <div
                              className={healthStatus === 'Healthy' ? 'tri-progress-bar-green' : 'tri-progress-bar-orange'}
                              style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Disease Class Probabilities Breakdown */}
                      {renderedProbabilities.length > 0 && (
                        <div
                          className="p-3 rounded-3"
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(11, 44, 95, 0.1)' }}
                        >
                          <div className="d-flex align-items-center justify-content-between mb-2.5">
                            <h6 className="fw-bold extra-small text-uppercase tracking-wider mb-0" style={{ color: '#0B2C5F' }}>
                              Class Probability Breakdown
                            </h6>
                            <span className="badge rounded-pill extra-small" style={{ backgroundColor: 'rgba(11, 44, 95, 0.06)', color: '#0B2C5F' }}>
                              Softmax Output
                            </span>
                          </div>
                          <div className="d-flex flex-column gap-2.5">
                            {renderedProbabilities.map(([diseaseName, probScore]) => {
                              const isHealthy = diseaseName.toLowerCase().includes('healthy');
                              const isWssv = diseaseName.toLowerCase().includes('white spot') || diseaseName.toLowerCase().includes('wssv');
                              return (
                                <div key={diseaseName}>
                                  <div className="d-flex justify-content-between extra-small mb-1">
                                    <span className="fw-semibold text-dark">{diseaseName}</span>
                                    <span className="fw-bold" style={{ color: '#0B2C5F' }}>{Number(probScore).toFixed(2)}%</span>
                                  </div>
                                  <div className="tri-progress-track" style={{ height: 6 }}>
                                    <div
                                      className={isHealthy ? 'tri-progress-bar-green' : isWssv ? 'tri-progress-bar-orange' : 'tri-progress-bar-navy'}
                                      style={{ width: `${Math.min(100, Math.max(0, Number(probScore)))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recommendation Box */}
                      {recommendations.length > 0 && (
                        <div
                          className="p-3 rounded-3"
                          style={{ backgroundColor: '#F8FAFD', border: '1px solid rgba(11, 44, 95, 0.08)' }}
                        >
                          <h6 className="fw-bold extra-small text-uppercase tracking-wider mb-2" style={{ color: '#0B2C5F' }}>
                            Action Protocol &amp; Recommendations
                          </h6>
                          <ul className="ps-3 mb-0 extra-small text-secondary d-flex flex-column gap-1">
                            {recommendations.map((item) => (
                              <li key={item} className="fw-medium">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      {/* 📜 DETECTION & PIPELINE HISTORY TABLE WITH FILTER TOOLSTRIP & EXPORT PDF */}
      <div className="tri-card p-4 mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-3">
          <div>
            <h5 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
              <FaHistory style={{ color: '#0B2C5F' }} /> Detection &amp; Pipeline History
            </h5>
            <small className="text-muted">History of AI disease scan assessments for assigned ponds</small>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
            {/* Search Bar */}
            <div
              className="d-flex align-items-center px-3 rounded-pill"
              style={{
                width: 210,
                height: 38,
                backgroundColor: '#F8FAFD',
                border: '1px solid rgba(11, 44, 95, 0.16)',
              }}
            >
              <FaSearch className="text-muted extra-small me-2" />
              <input
                type="text"
                className="form-control form-control-sm border-0 shadow-none bg-transparent p-0 extra-small fw-medium"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ height: '100%' }}
              />
            </div>

            {/* Status Filter */}
            <select
              className="form-select form-select-sm rounded-pill fw-semibold extra-small px-3 shadow-none cursor-pointer"
              style={{
                height: 38,
                width: 'auto',
                minWidth: 135,
                backgroundColor: '#F8FAFD',
                border: '1px solid rgba(11, 44, 95, 0.16)',
                color: '#0B2C5F',
              }}
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              aria-label="Filter scan history by status"
            >
              <option value="all">All Statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Diseased">Diseased</option>
              <option value="Uncertain">Uncertain</option>
              <option value="Poor Image Quality">Poor Quality</option>
            </select>

            {/* Export PDF Button */}
            <button
              className="btn btn-tri-outline btn-sm px-3.5 extra-small fw-bold d-inline-flex align-items-center gap-1.5 text-nowrap"
              style={{ height: 38 }}
              onClick={exportPdf}
            >
              <FaFilePdf style={{ color: '#EA580C' }} /> Export PDF
            </button>
          </div>
        </div>

        <div className="table-responsive rounded-3" style={{ border: '1px solid rgba(11, 44, 95, 0.08)' }}>
          <table className="table tri-table align-middle mb-0">
            <thead>
              <tr>
                <th className="ps-3 py-3">Date &amp; Time</th>
                <th className="py-3">Pond</th>
                <th className="py-3">Disease / Outcome</th>
                <th className="py-3">Confidence</th>
                <th className="py-3">AI Model Used</th>
                <th className="py-3">Risk Level</th>
                <th className="py-3 pe-3 text-end">Pipeline Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted extra-small fw-medium">
                    {historySearch
                      ? `No scan logs matching "${historySearch}".`
                      : 'No disease scans recorded yet.'}
                  </td>
                </tr>
              )}
              {filteredHistory.map((item) => {
                const status = item.health_status || item.status;
                const isHealthy = status === 'Healthy' || String(item.disease_name).toLowerCase().includes('healthy');
                const isDiseased = status === 'Diseased' || String(item.risk_level).toLowerCase() === 'high';
                return (
                  <tr key={item.id}>
                    <td className="ps-3 font-mono extra-small text-muted">{item.created_at}</td>
                    <td className="fw-bold" style={{ color: '#0B2C5F' }}>{item.pond_name || 'Assigned Pond'}</td>
                    <td>
                      <span className="fw-bold" style={{ color: isHealthy ? '#047857' : isDiseased ? '#EA580C' : '#0B2C5F' }}>
                        {item.disease_name}
                      </span>
                    </td>
                    <td className="fw-extrabold" style={{ color: '#0B2C5F' }}>
                      {Number(item.confidence_score || 0).toFixed(2)}%
                    </td>
                    <td>
                      <span className="extra-small text-muted d-inline-flex align-items-center gap-1">
                        <FaRobot style={{ color: '#0B2C5F' }} /> {item.model_used || 'Desktop Model'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                        style={
                          item.risk_level === 'High'
                            ? { backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                            : item.risk_level === 'Medium'
                            ? { backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }
                            : { backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
                        }
                      >
                        {item.risk_level || 'Low'}
                      </span>
                    </td>
                    <td className="pe-3 text-end">
                      <span
                        className="badge rounded-pill extra-small fw-bold px-2.5 py-1"
                        style={
                          status === 'Healthy'
                            ? { backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
                            : status === 'Diseased' || status === 'No Shrimp Detected'
                            ? { backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
                            : { backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }
                        }
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
