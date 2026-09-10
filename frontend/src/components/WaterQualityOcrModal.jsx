import { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import {
  FaCamera,
  FaFileAlt,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSync,
  FaWater,
  FaThermometerHalf,
  FaFlask,
  FaVial,
  FaUpload,
  FaMicrochip,
  FaSlidersH,
  FaEye,
  FaInfoCircle
} from 'react-icons/fa';
import Swal from 'sweetalert2';
import api from '../services/api';

// Recommended aquaculture water parameters for Penaeus vannamei
const PARAM_GUIDELINES = {
  do: { label: 'Dissolved Oxygen', unit: 'mg/L', min: 0, max: 20, optimalMin: 5.0, optimalMax: 8.5, warnMin: 4.0 },
  temp: { label: 'Temperature', unit: '°C', min: 15, max: 42, optimalMin: 26.0, optimalMax: 32.0, warnMax: 34.0 },
  ph: { label: 'pH Level', unit: '', min: 4, max: 12, optimalMin: 7.5, optimalMax: 8.3, warnMin: 7.0, warnMax: 8.8 },
  salinity: { label: 'Salinity', unit: 'ppt', min: 0, max: 50, optimalMin: 15.0, optimalMax: 28.0, warnMin: 10.0, warnMax: 35.0 },
};

function getParameterStatus(type, val) {
  const num = parseFloat(val);
  if (isNaN(num)) return { label: 'Missing', tone: 'secondary', badgeClass: 'bg-secondary' };
  const g = PARAM_GUIDELINES[type];
  if (!g) return { label: 'Recorded', tone: 'primary', badgeClass: 'bg-primary' };

  if (type === 'do') {
    if (num < g.warnMin) return { label: 'Critical Anoxia (<4.0)', tone: 'danger', badgeClass: 'tag-coral-critical' };
    if (num < g.optimalMin) return { label: 'Warning: Low (<5.0)', tone: 'warning', badgeClass: 'tag-orange-maintenance' };
    return { label: 'Optimal Safe (≥5.0)', tone: 'success', badgeClass: 'tag-green-safe' };
  }
  if (type === 'temp') {
    if (num >= g.warnMax || num < 22) return { label: 'Critical Temp', tone: 'danger', badgeClass: 'tag-coral-critical' };
    if (num > g.optimalMax || num < g.optimalMin) return { label: 'Elevated Temp', tone: 'warning', badgeClass: 'tag-orange-maintenance' };
    return { label: 'Optimal (26-32°C)', tone: 'success', badgeClass: 'tag-green-safe' };
  }
  if (type === 'ph') {
    if (num < g.warnMin || num > g.warnMax) return { label: 'Critical pH Range', tone: 'danger', badgeClass: 'tag-coral-critical' };
    if (num < g.optimalMin || num > g.optimalMax) return { label: 'Sub-Optimal pH', tone: 'warning', badgeClass: 'tag-orange-maintenance' };
    return { label: 'Optimal (7.5-8.3)', tone: 'success', badgeClass: 'tag-green-safe' };
  }
  if (type === 'salinity') {
    if (num < g.warnMin || num > g.warnMax) return { label: 'Extreme Salinity', tone: 'danger', badgeClass: 'tag-coral-critical' };
    if (num < g.optimalMin || num > g.optimalMax) return { label: 'Sub-Optimal Salinity', tone: 'warning', badgeClass: 'tag-orange-maintenance' };
    return { label: 'Optimal (15-28 ppt)', tone: 'success', badgeClass: 'tag-green-safe' };
  }

  return { label: 'Recorded', tone: 'primary', badgeClass: 'tag-cyan-active' };
}

export default function WaterQualityOcrModal({
  isOpen,
  onClose,
  assignedPonds = [],
  initialPondId = '',
  caretakerName = 'Caretaker',
  caretakerId = null,
  onSuccess = () => {},
}) {
  const [selectedPondId, setSelectedPondId] = useState(initialPondId);
  const [captureMode, setCaptureMode] = useState('device_screen'); // 'device_screen' | 'data_sheet'
  const [activeParamTarget, setActiveParamTarget] = useState('all'); // 'do' | 'temp' | 'ph' | 'salinity' | 'all'

  // Image & Camera States
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // OCR Processing States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [rawOcrText, setRawOcrText] = useState('');

  // Verified Data Form States
  const [verifiedValues, setVerifiedValues] = useState({
    do: '',
    temp: '',
    ph: '',
    salinity: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selected pond with initialPondId
  useEffect(() => {
    if (initialPondId) {
      setSelectedPondId(String(initialPondId));
    } else if (assignedPonds.length > 0) {
      setSelectedPondId(String(assignedPonds[0].id));
    }
  }, [initialPondId, assignedPonds]);

  // Clean up camera stream when modal closes
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  }, [cameraStream]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setImageFile(null);
      setPreviewUrl('');
      setIsScanning(false);
      setRawOcrText('');
      setOcrConfidence(null);
      setVerifiedValues({ do: '', temp: '', ph: '', salinity: '', notes: '' });
    }
  }, [isOpen, stopCamera]);

  // Start Live Smartphone Camera
  const startCamera = async () => {
    try {
      stopCamera();
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access unavailable:', err);
      Swal.fire({
        icon: 'info',
        title: 'Camera Access',
        text: 'Direct webcam/phone camera stream is unavailable or blocked. You can upload or snap a photo directly using the Upload Photo option.',
        confirmButtonColor: '#0B2C5F',
      });
      setIsCameraActive(false);
    }
  };

  // Capture Snapshot from Camera Feed
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `meter_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setImageFile(file);
      setPreviewUrl(canvas.toDataURL('image/jpeg'));
      stopCamera();
      // Run OCR automatically upon snapshot
      processImageWithOcr(canvas.toDataURL('image/jpeg'));
    }, 'image/jpeg', 0.95);
  };

  // Handle Photo File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    stopCamera();
    processImageWithOcr(url);
  };

  // Preprocess Image on Canvas for LCD and Paper Text Contrast
  const preprocessImageCanvas = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
          scale = Math.min(maxDim / img.width, maxDim / img.height);
        }
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Enhance contrast and binarize for digital LCD & handwriting
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // Contrast stretch
          const contrast = 1.35;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  // Intelligent OCR Parsing for Handheld Meter Displays & Logsheets
  const parseOcrExtractedText = (text, targetParam, mode) => {
    const cleaned = text.replace(/,/g, '.');
    const numbersFound = [];
    // Extract floating point or integer numbers
    const numRegex = /\b\d+(?:\.\d+)?\b/g;
    let match;
    while ((match = numRegex.exec(cleaned)) !== null) {
      const n = parseFloat(match[0]);
      if (!isNaN(n)) numbersFound.push(n);
    }

    const updates = {};

    // 1. Direct LCD Single Parameter Mode
    if (mode === 'device_screen' && targetParam !== 'all') {
      const candidate = numbersFound.find((num) => {
        const g = PARAM_GUIDELINES[targetParam];
        return g ? num >= g.min && num <= g.max : true;
      });
      if (candidate !== undefined) {
        updates[targetParam] = candidate.toFixed(targetParam === 'temp' || targetParam === 'ph' ? 1 : 2);
      } else if (numbersFound.length > 0) {
        updates[targetParam] = numbersFound[0].toString();
      }
      return updates;
    }

    // 2. Multi-Parameter Meter or Physical Daily Log Sheet Parsing
    // Look for contextual keywords first (e.g. DO, D.O., mg/L, Temp, °C, pH, Sal, ppt)
    const lines = cleaned.split('\n');
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      const lineNums = (line.match(numRegex) || []).map(Number).filter((n) => !isNaN(n));
      if (!lineNums.length) return;

      if (lower.includes('do') || lower.includes('dissolved') || lower.includes('mg/l') || lower.includes('d.o')) {
        const doVal = lineNums.find((n) => n >= 1.0 && n <= 15.0);
        if (doVal !== undefined && !updates.do) updates.do = doVal.toFixed(2);
      }
      if (lower.includes('temp') || lower.includes('°c') || lower.includes('cel') || lower.includes('c')) {
        const tempVal = lineNums.find((n) => n >= 20.0 && n <= 39.0);
        if (tempVal !== undefined && !updates.temp) updates.temp = tempVal.toFixed(1);
      }
      if (lower.includes('ph') || lower.includes('p.h')) {
        const phVal = lineNums.find((n) => n >= 5.5 && n <= 10.0);
        if (phVal !== undefined && !updates.ph) updates.ph = phVal.toFixed(2);
      }
      if (lower.includes('sal') || lower.includes('ppt') || lower.includes('salt')) {
        const salVal = lineNums.find((n) => n >= 5.0 && n <= 45.0);
        if (salVal !== undefined && !updates.salinity) updates.salinity = salVal.toFixed(1);
      }
    });

    // Heuristic fallback for numbers based on typical physiological bounds
    numbersFound.forEach((num) => {
      if (!updates.do && num >= 3.0 && num <= 12.0) {
        updates.do = num.toFixed(2);
      } else if (!updates.temp && num >= 24.0 && num <= 36.0) {
        updates.temp = num.toFixed(1);
      } else if (!updates.ph && num >= 6.8 && num <= 9.2 && num !== parseFloat(updates.do)) {
        updates.ph = num.toFixed(2);
      } else if (!updates.salinity && num >= 10.0 && num <= 38.0 && num !== parseFloat(updates.temp)) {
        updates.salinity = num.toFixed(1);
      }
    });

    return updates;
  };

  // Run Tesseract.js Worker
  const processImageWithOcr = async (imageSrc) => {
    setIsScanning(true);
    setScanProgress(10);
    setOcrStatusText('Preprocessing image contrast & thresholding...');

    try {
      const processedSrc = await preprocessImageCanvas(imageSrc);
      setScanProgress(30);
      setOcrStatusText('Initializing Optical Character Recognition (OCR)...');

      const worker = await createWorker('eng');
      setScanProgress(55);
      setOcrStatusText('Detecting LCD digits & data patterns...');

      // Whitelist common digits, decimals, and parameter symbols
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.DOdoTEMPtemppHSALsalmgLCPT%:/- \n',
      });

      const ret = await worker.recognize(processedSrc);
      await worker.terminate();

      setScanProgress(90);
      setOcrStatusText('Parsing extracted telemetry values...');

      const text = ret.data.text || '';
      const conf = ret.data.confidence || 85;

      setRawOcrText(text);
      setOcrConfidence(conf);

      // Parse values according to mode
      const extractedUpdates = parseOcrExtractedText(text, activeParamTarget, captureMode);

      setVerifiedValues((prev) => ({
        ...prev,
        ...extractedUpdates,
      }));

      setScanProgress(100);
      setOcrStatusText('Extraction complete. Please verify values below.');

      // Toast notification for extracted data
      const extractedCount = Object.keys(extractedUpdates).length;
      if (extractedCount > 0) {
        Swal.fire({
          icon: 'success',
          title: 'Digits Extracted!',
          text: `OCR successfully parsed ${extractedCount} field(s). Review and correct below.`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Review Required',
          text: 'OCR ran, but values could not be auto-aligned. You can quickly enter or adjust them in the form below.',
          timer: 2500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
        });
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      setOcrStatusText('OCR processing failed or timed out. Please input parameters manually.');
      Swal.fire({
        icon: 'warning',
        title: 'OCR Extraction Notice',
        text: 'Could not auto-read text from image due to glare or angle. You can manually enter the verified values.',
        confirmButtonColor: '#0B2C5F',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Commit & Submit Verified Record
  const handleCommitRecord = async (e) => {
    e.preventDefault();

    if (!selectedPondId) {
      Swal.fire({ icon: 'warning', title: 'Select Pond', text: 'Please select an assigned pond.', confirmButtonColor: '#0B2C5F' });
      return;
    }

    const doVal = parseFloat(verifiedValues.do);
    const tempVal = parseFloat(verifiedValues.temp);
    const phVal = parseFloat(verifiedValues.ph);
    const salVal = parseFloat(verifiedValues.salinity);

    if (isNaN(doVal) || isNaN(tempVal) || isNaN(phVal) || isNaN(salVal)) {
      Swal.fire({
        icon: 'warning',
        title: 'Incomplete Parameters',
        text: 'All 4 core water quality parameters (Dissolved Oxygen, Temperature, pH, and Salinity) are mandatory for pond verification.',
        confirmButtonColor: '#0B2C5F',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pond_id', selectedPondId);
      if (caretakerId) formData.append('caretaker_id', caretakerId);
      formData.append('recorded_by_name', caretakerName);
      formData.append('dissolved_oxygen', doVal);
      formData.append('temperature', tempVal);
      formData.append('ph_level', phVal);
      formData.append('salinity', salVal);
      formData.append('capture_mode', captureMode);
      if (ocrConfidence) formData.append('ocr_confidence', ocrConfidence);
      if (rawOcrText) formData.append('raw_ocr_text', rawOcrText);
      if (verifiedValues.notes) formData.append('notes', verifiedValues.notes);
      if (imageFile) formData.append('image', imageFile);

      const res = await api.post('/water_quality_records.php', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Pond Water Quality Verified!',
          html: `<b>${res.data?.data?.pond_name || 'Assigned Pond'}</b> is now unlocked for today's monitoring and feeding operations.`,
          confirmButtonColor: '#0B2C5F',
        });

        // Fire global update event
        window.dispatchEvent(
          new CustomEvent('shrim-water-quality-updated', {
            detail: { pond_id: selectedPondId, record: res.data?.data },
          })
        );

        onSuccess(res.data?.data);
        onClose();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: res.data?.message || 'Unable to record water quality data.',
          confirmButtonColor: '#0B2C5F',
        });
      }
    } catch (err) {
      console.error('Error committing water quality record:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || err.message || 'Network error while recording water quality.',
        confirmButtonColor: '#0B2C5F',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentPondObj = assignedPonds.find((p) => String(p.id) === String(selectedPondId));

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(7, 23, 51, 0.82)', backdropFilter: 'blur(10px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow-xl overflow-hidden bg-white">
          {/* 🌟 1. HERO HEADER */}
          <div
            className="p-3.5 px-4 text-white position-relative"
            style={{
              background: 'linear-gradient(135deg, #071733 0%, #0B2C5F 55%, #0E3D7D 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0 shadow-sm"
                  style={{
                    width: 46,
                    height: 46,
                    background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
                    color: '#FFFFFF',
                    fontSize: '1.25rem',
                  }}
                >
                  <FaCamera />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <h5 className="fw-extrabold mb-0 tracking-tight">
                      Dual-Mode OCR Water Quality Ingestion
                    </h5>
                    <span className="badge bg-info bg-opacity-25 text-white border border-info border-opacity-50 rounded-pill extra-small">
                      O & B Aqua Farm Protocol
                    </span>
                  </div>
                  <p className="mb-0 text-white text-opacity-75 small">
                    Direct Device LCD Screen & Physical Paper Logsheet Digitization
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-light rounded-circle p-2 d-flex align-items-center justify-content-center"
                style={{ width: 34, height: 34 }}
                onClick={onClose}
              >
                <FaTimes size={14} />
              </button>
            </div>
          </div>

          <div className="modal-body p-4 bg-light">
            {/* 🌟 2. POND SELECTOR & DUAL-MODE SWITCHER STRIP */}
            <div className="bg-white p-3 rounded-3 border mb-3 shadow-xs">
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <label className="extra-small text-uppercase fw-bold text-muted d-block mb-1">
                    Target Pond Basin
                  </label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light text-primary border-end-0">
                      <FaWater />
                    </span>
                    <select
                      className="form-select fw-bold text-dark border-start-0"
                      value={selectedPondId}
                      onChange={(e) => setSelectedPondId(e.target.value)}
                    >
                      {assignedPonds.length > 0 ? (
                        assignedPonds.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.pond_name || `Pond ${p.id}`} {p.location ? `(${p.location})` : ''}
                          </option>
                        ))
                      ) : (
                        <option value="1">Pond A1 (Northern Bay)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="extra-small text-uppercase fw-bold text-muted d-block mb-1">
                    Optical Capture Mode
                  </label>
                  <div className="btn-group w-100 btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn fw-bold d-flex align-items-center justify-content-center gap-1.5 ${
                        captureMode === 'device_screen' ? 'btn-primary' : 'btn-outline-secondary bg-white'
                      }`}
                      onClick={() => setCaptureMode('device_screen')}
                    >
                      <FaMicrochip size={13} /> 1. Meter Screen (LCD)
                    </button>
                    <button
                      type="button"
                      className={`btn fw-bold d-flex align-items-center justify-content-center gap-1.5 ${
                        captureMode === 'data_sheet' ? 'btn-primary' : 'btn-outline-secondary bg-white'
                      }`}
                      onClick={() => setCaptureMode('data_sheet')}
                    >
                      <FaFileAlt size={13} /> 2. Paper Data Sheet
                    </button>
                  </div>
                </div>
              </div>

              {/* Mode 1: Targeted Parameter Selector Pills */}
              {captureMode === 'device_screen' && (
                <div className="mt-3 pt-2.5 border-top d-flex align-items-center gap-2 flex-wrap">
                  <span className="extra-small text-muted fw-bold text-uppercase me-1">Meter Target:</span>
                  {[
                    { id: 'all', label: 'Multi-Parameter / Auto', icon: <FaSlidersH size={11} /> },
                    { id: 'do', label: 'Dissolved Oxygen (DO)', icon: <FaWater size={11} /> },
                    { id: 'temp', label: 'Temperature (°C)', icon: <FaThermometerHalf size={11} /> },
                    { id: 'ph', label: 'pH Level', icon: <FaFlask size={11} /> },
                    { id: 'salinity', label: 'Salinity (ppt)', icon: <FaVial size={11} /> },
                  ].map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      className={`btn btn-xs rounded-pill px-2.5 py-1 extra-small fw-semibold d-flex align-items-center gap-1 ${
                        activeParamTarget === target.id
                          ? 'btn-dark text-white'
                          : 'btn-outline-secondary bg-light text-secondary'
                      }`}
                      onClick={() => setActiveParamTarget(target.id)}
                    >
                      {target.icon} {target.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 🌟 3. IMAGE VIEWFINDER & OPTICAL RECOGNITION CONTAINER */}
            <div className="bg-white p-3 rounded-3 border mb-3 shadow-xs">
              <div
                className="rounded-3 position-relative overflow-hidden d-flex flex-column align-items-center justify-content-center"
                style={{
                  background: '#0B1528',
                  minHeight: 280,
                  maxHeight: 380,
                  border: '2px dashed rgba(2, 132, 199, 0.4)',
                }}
              >
                {/* A. Live Video Stream */}
                {isCameraActive && (
                  <div className="w-100 h-100 position-relative d-flex justify-content-center align-items-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      style={{ maxHeight: 360, width: '100%', objectFit: 'contain' }}
                    />
                    {/* Viewfinder HUD Target Reticle */}
                    <div
                      className="position-absolute border border-2 border-cyan rounded-3 pointer-events-none"
                      style={{
                        width: captureMode === 'device_screen' ? '65%' : '85%',
                        height: captureMode === 'device_screen' ? '55%' : '80%',
                        borderColor: '#38BDF8',
                        boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)',
                      }}
                    >
                      <span className="position-absolute top-0 start-50 translate-middle badge bg-primary extra-small">
                        {captureMode === 'device_screen' ? 'Align Digital LCD Display Here' : 'Align Table Sheet Row Here'}
                      </span>
                    </div>
                  </div>
                )}

                {/* B. Image Snapshot Preview */}
                {!isCameraActive && previewUrl && (
                  <div className="w-100 text-center p-2 position-relative">
                    <img
                      src={previewUrl}
                      alt="Captured Meter / Sheet"
                      className="img-fluid rounded-2 shadow-sm"
                      style={{ maxHeight: 320, objectFit: 'contain' }}
                    />
                    {ocrConfidence && (
                      <span className="position-absolute top-0 end-0 m-3 badge bg-success shadow-sm extra-small">
                        ✓ OCR Read Confidence: {Math.round(ocrConfidence)}%
                      </span>
                    )}
                  </div>
                )}

                {/* C. Empty Initial State Placeholder */}
                {!isCameraActive && !previewUrl && (
                  <div className="text-center p-4 text-white text-opacity-75">
                    <div
                      className="rounded-circle d-inline-flex p-3 mb-2"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <FaCamera size={32} className="text-info" />
                    </div>
                    <h6 className="fw-bold text-white mb-1">
                      {captureMode === 'device_screen'
                        ? 'Capture Handheld Digital Meter LCD'
                        : 'Capture Daily Water Quality Log Table'}
                    </h6>
                    <p className="small text-white text-opacity-65 mb-0" style={{ maxWidth: 420 }}>
                      Point your phone camera directly at the meter screen or logsheet to automatically extract DO, Temp, pH, and Salinity.
                    </p>
                  </div>
                )}

                {/* Hidden canvas for processing */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Scanning Spinner Overlay */}
                {isScanning && (
                  <div
                    className="position-absolute inset-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                    style={{ background: 'rgba(7, 23, 51, 0.88)', zIndex: 10 }}
                  >
                    <FaSync size={36} className="fa-spin text-warning mb-2" />
                    <strong className="text-white small mb-1">{ocrStatusText}</strong>
                    <div className="progress w-50" style={{ height: 6 }}>
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated bg-warning"
                        style={{ width: `${scanProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Viewfinder Controls Strip */}
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
                <div className="d-flex align-items-center gap-2">
                  {!isCameraActive ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary rounded-pill px-3 py-1.5 fw-bold d-flex align-items-center gap-1.5"
                      onClick={startCamera}
                    >
                      <FaCamera size={12} /> Open Smartphone Camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-success rounded-pill px-3.5 py-1.5 fw-bold d-flex align-items-center gap-1.5 shadow-sm"
                      onClick={captureSnapshot}
                    >
                      <FaCheckCircle size={13} /> Capture & Run OCR
                    </button>
                  )}

                  <label className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1.5 fw-semibold bg-white mb-0 cursor-pointer d-flex align-items-center gap-1.5">
                    <FaUpload size={12} /> Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="d-none"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {previewUrl && !isCameraActive && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1.5 extra-small fw-bold d-flex align-items-center gap-1"
                    onClick={() => processImageWithOcr(previewUrl)}
                    disabled={isScanning}
                  >
                    <FaSync size={11} className={isScanning ? 'fa-spin' : ''} /> Re-scan Image
                  </button>
                )}
              </div>
            </div>

            {/* 🌟 4. INLINE VERIFICATION & CORRECTION FORM */}
            <form onSubmit={handleCommitRecord}>
              <div className="bg-white p-3.5 rounded-3 border shadow-xs mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <FaCheckCircle className="text-success" /> Verified Telemetry Fields
                    </h6>
                    <span className="text-muted extra-small">
                      Values extracted via OCR. Verify or manually adjust any parameter before committing.
                    </span>
                  </div>
                  <span className="badge bg-light text-dark border extra-small">
                    4 of 4 Parameters Mandatory
                  </span>
                </div>

                <div className="row g-3">
                  {/* DO Field */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="p-2.5 rounded-3 bg-light border h-100">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label className="extra-small text-uppercase fw-bold text-dark mb-0">
                          Dissolved Oxygen
                        </label>
                        <span className="text-muted extra-small">mg/L</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="20"
                        required
                        className="form-control form-control-sm fw-extrabold text-dark"
                        placeholder="e.g. 6.50"
                        value={verifiedValues.do}
                        onChange={(e) => setVerifiedValues({ ...verifiedValues, do: e.target.value })}
                      />
                      <div className="mt-2">
                        <span className={`badge ${getParameterStatus('do', verifiedValues.do).badgeClass} extra-small w-100 text-truncate`}>
                          {getParameterStatus('do', verifiedValues.do).label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Temp Field */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="p-2.5 rounded-3 bg-light border h-100">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label className="extra-small text-uppercase fw-bold text-dark mb-0">
                          Water Temp
                        </label>
                        <span className="text-muted extra-small">°C</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="15"
                        max="45"
                        required
                        className="form-control form-control-sm fw-extrabold text-dark"
                        placeholder="e.g. 28.5"
                        value={verifiedValues.temp}
                        onChange={(e) => setVerifiedValues({ ...verifiedValues, temp: e.target.value })}
                      />
                      <div className="mt-2">
                        <span className={`badge ${getParameterStatus('temp', verifiedValues.temp).badgeClass} extra-small w-100 text-truncate`}>
                          {getParameterStatus('temp', verifiedValues.temp).label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* pH Field */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="p-2.5 rounded-3 bg-light border h-100">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label className="extra-small text-uppercase fw-bold text-dark mb-0">
                          pH Balance
                        </label>
                        <span className="text-muted extra-small">Range</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="4"
                        max="12"
                        required
                        className="form-control form-control-sm fw-extrabold text-dark"
                        placeholder="e.g. 7.85"
                        value={verifiedValues.ph}
                        onChange={(e) => setVerifiedValues({ ...verifiedValues, ph: e.target.value })}
                      />
                      <div className="mt-2">
                        <span className={`badge ${getParameterStatus('ph', verifiedValues.ph).badgeClass} extra-small w-100 text-truncate`}>
                          {getParameterStatus('ph', verifiedValues.ph).label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Salinity Field */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <div className="p-2.5 rounded-3 bg-light border h-100">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <label className="extra-small text-uppercase fw-bold text-dark mb-0">
                          Salinity
                        </label>
                        <span className="text-muted extra-small">ppt</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        required
                        className="form-control form-control-sm fw-extrabold text-dark"
                        placeholder="e.g. 20.0"
                        value={verifiedValues.salinity}
                        onChange={(e) => setVerifiedValues({ ...verifiedValues, salinity: e.target.value })}
                      />
                      <div className="mt-2">
                        <span className={`badge ${getParameterStatus('salinity', verifiedValues.salinity).badgeClass} extra-small w-100 text-truncate`}>
                          {getParameterStatus('salinity', verifiedValues.salinity).label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Input */}
                <div className="mt-3">
                  <label className="extra-small text-muted fw-bold text-uppercase d-block mb-1">
                    Caretaker Field Remarks & Aerator Status (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Paddlewheel aerator #2 active; slight rain observed at 6:30 AM."
                    value={verifiedValues.notes}
                    onChange={(e) => setVerifiedValues({ ...verifiedValues, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="d-flex justify-content-between align-items-center pt-2">
                <span className="text-muted extra-small d-none d-sm-inline">
                  Recorded by: <strong>{caretakerName}</strong> • Date: <strong>{new Date().toLocaleDateString()}</strong>
                </span>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-2 fw-semibold"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm rounded-pill px-4 py-2 fw-bold text-white shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #0B2C5F 0%, #0284C7 100%)',
                      border: 'none',
                    }}
                    disabled={isSubmitting || isScanning}
                  >
                    {isSubmitting ? (
                      <>
                        <FaSync size={12} className="fa-spin me-1.5" /> Committing Record...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle size={13} className="me-1.5" /> Confirm & Unlock {currentPondObj?.pond_name || 'Pond'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
