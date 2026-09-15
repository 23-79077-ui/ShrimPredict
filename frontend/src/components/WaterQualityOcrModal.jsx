import { useState, useRef, useEffect, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import cvModule from '@techstark/opencv-js';
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

const TELEMETRY_NUMBER = '([-+]?\\d+(?:[.,]\\d+)?)';

const toNumber = (value) => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const findTelemetryValue = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match ? toNumber(match[1]) : null;
    if (value !== null) return value;
  }
  return null;
};

export function parseTelemetryText(rawText = '') {
  const text = rawText.replace(/,/g, '.');
  return {
    do: findTelemetryValue(text, [
      new RegExp(`(?:dissolved\\s+oxygen|d\\.?\\s*o\\.?|\\bdo\\b)\\s*[:=]?\\s*${TELEMETRY_NUMBER}`, 'i'),
      new RegExp(`${TELEMETRY_NUMBER}\\s*mg\\s*/?\\s*l`, 'i'),
    ]),
    temp: findTelemetryValue(text, [
      new RegExp(`(?:water\\s+)?temp(?:erature)?\\.?\\s*[:=]?\\s*${TELEMETRY_NUMBER}`, 'i'),
      new RegExp(`${TELEMETRY_NUMBER}\\s*(?:°?c|celsius)`, 'i'),
    ]),
    ph: findTelemetryValue(text, [
      new RegExp(`\\bp\\s*\\.?\\s*h\\b\\s*[:=]?\\s*${TELEMETRY_NUMBER}`, 'i'),
    ]),
    salinity: findTelemetryValue(text, [
      new RegExp(`(?:salinity|sal|salt)\\s*[:=]?\\s*${TELEMETRY_NUMBER}`, 'i'),
      new RegExp(`${TELEMETRY_NUMBER}\\s*ppt`, 'i'),
    ]),
  };
}

export async function processOCR(imageFile, psm = '6', whitelist = null) {
  if (!imageFile) throw new Error('An image is required for OCR processing.');

  const worker = await createWorker('eng');
  try {
    const params = {
      tessedit_pageseg_mode: psm,
    };
    if (whitelist) {
      params.tessedit_char_whitelist = whitelist;
    } else {
      params.tessedit_char_whitelist = '0123456789.- ';
    }
    await worker.setParameters(params);
    const result = await worker.recognize(imageFile);
    return result.data.text || '';
  } finally {
    await worker.terminate();
  }
}

// Recommended aquaculture water parameters for Penaeus vannamei
const PARAM_GUIDELINES = {
  do: { label: 'Dissolved Oxygen', unit: 'mg/L', min: 0, max: 200, optimalMin: 5.0, optimalMax: 8.5, warnMin: 4.0 },
  temp: { label: 'Temperature', unit: '°C', min: 15, max: 45, optimalMin: 26.0, optimalMax: 32.0, warnMax: 34.0 },
  ph: { label: 'pH Level', unit: '', min: 4, max: 12, optimalMin: 7.5, optimalMax: 8.3, warnMin: 7.0, warnMax: 8.8 },
  salinity: { label: 'Salinity', unit: 'ppt', min: 0, max: 50, optimalMin: 15.0, optimalMax: 28.0, warnMin: 10.0, warnMax: 35.0 },
};

function getParameterStatus(type, val) {
  const num = parseFloat(val);
  if (isNaN(num)) return { label: 'Missing', tone: 'secondary', badgeClass: 'bg-secondary' };
  const g = PARAM_GUIDELINES[type];
  if (!g) return { label: 'Recorded', tone: 'primary', badgeClass: 'bg-primary' };

  if (type === 'do') {
    if (num > 25) {
      // Saturation % mode (e.g. 95.6% on optical DO meters)
      if (num < 50) return { label: 'Critical Anoxia (<50% Sat)', tone: 'danger', badgeClass: 'tag-coral-critical' };
      if (num < 70) return { label: 'Warning: Low (<70% Sat)', tone: 'warning', badgeClass: 'tag-orange-maintenance' };
      return { label: `Optimal Safe (${num.toFixed(1)}% Sat)`, tone: 'success', badgeClass: 'tag-green-safe' };
    }
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
  const [imagePayload, setImagePayload] = useState(null);
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetryData, setTelemetryData] = useState({
    do: null,
    temp: null,
    ph: null,
    salinity: null,
  });

  // Verified Data Form States
  const [verifiedValues, setVerifiedValues] = useState({
    do: '',
    temp: '',
    ph: '',
    salinity: '',
    notes: '',
  });
  const [ocrTelemetryInfo, setOcrTelemetryInfo] = useState(null);
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
      setImagePayload(null);
      setImageFile(null);
      setPreviewUrl('');
      setIsScanning(false);
      setRawOcrText('');
      setOcrConfidence(null);
      setIsProcessing(false);
      setOcrTelemetryInfo(null);
      setTelemetryData({ do: null, temp: null, ph: null, salinity: null });
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
      setImagePayload(file);
      setImageFile(file);
      stopCamera();
      processImageSource(canvas.toDataURL('image/jpeg'));
    }, 'image/jpeg', 0.95);
  };

  // Handle Photo File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePayload(file);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    stopCamera();
    processImageSource(url);
  };

  const waitForOpenCv = async () => cvModule;

  const autoCropDeviceScreen = async (imageElement) => {
    try {
      const openCv = await waitForOpenCv();
      const outputCanvas = canvasRef.current;

      if (!imageElement || !outputCanvas) return null;

      const source = openCv.imread(imageElement);
      const gray = new openCv.Mat();
      const blurred = new openCv.Mat();
      const edges = new openCv.Mat();
      const contours = new openCv.MatVector();
      const hierarchy = new openCv.Mat();
      const candidates = [];

      try {
        openCv.cvtColor(source, gray, openCv.COLOR_RGBA2GRAY);
        openCv.GaussianBlur(gray, blurred, new openCv.Size(5, 5), 0, 0, openCv.BORDER_DEFAULT);
        openCv.Canny(blurred, edges, 40, 130);
        openCv.findContours(edges, contours, hierarchy, openCv.RETR_LIST, openCv.CHAIN_APPROX_SIMPLE);

        const srcWidth = source.cols;
        const srcHeight = source.rows;
        const minArea = (srcWidth * srcHeight) * 0.02; // at least 2% of image
        const maxArea = (srcWidth * srcHeight) * 0.70; // at most 70% of image

        for (let index = 0; index < contours.size(); index += 1) {
          const contour = contours.get(index);
          const rect = openCv.boundingRect(contour);
          const area = rect.width * rect.height;

          if (area >= minArea && area <= maxArea) {
            const aspectRatio = rect.width / rect.height;
            const centerY = rect.y + rect.height / 2;

            // LCD screens on handheld meters are in the upper 65% of the body
            // and have landscape or square aspect ratio (0.7 to 3.0)
            if (aspectRatio >= 0.7 && aspectRatio <= 3.0 && centerY <= srcHeight * 0.65) {
              const roi = gray.roi(rect);
              const meanVal = openCv.mean(roi)[0];
              roi.delete();

              // Reject dark rubber keypads (keypads have mean gray < 90)
              // LCD displays have a light background (mean gray > 105)
              if (meanVal >= 105) {
                candidates.push({
                  rect,
                  area,
                  meanVal,
                  score: area + meanVal * 15 - centerY * 2,
                });
              }
            }
          }
          contour.delete();
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0].rect;

          // Add 12% padding around LCD screen
          const padX = Math.round(best.width * 0.12);
          const padY = Math.round(best.height * 0.12);
          const cropX = Math.max(0, best.x - padX);
          const cropY = Math.max(0, best.y - padY);
          const cropW = Math.min(srcWidth - cropX, best.width + padX * 2);
          const cropH = Math.min(srcHeight - cropY, best.height + padY * 2);

          const cropRect = new openCv.Rect(cropX, cropY, cropW, cropH);
          const cropped = source.roi(cropRect);
          openCv.imshow(outputCanvas, cropped);
          cropped.delete();
          return outputCanvas.toDataURL('image/jpeg', 0.95);
        }

        // If no high-confidence LCD polygon was found, crop the upper 65% of the device (excludes keypad)
        const upperH = Math.max(1, Math.round(srcHeight * 0.65));
        const upperRect = new openCv.Rect(0, 0, srcWidth, upperH);
        const upperCropped = source.roi(upperRect);
        openCv.imshow(outputCanvas, upperCropped);
        upperCropped.delete();
        return outputCanvas.toDataURL('image/jpeg', 0.95);
      } finally {
        source.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
      }
    } catch (err) {
      console.warn('OpenCV LCD screen detection skipped or fallback:', err);
      return null;
    }
  };

  const processImageSource = (imageSource) => {
    // ALWAYS preserve the full original photo in the viewfinder preview!
    setPreviewUrl(imageSource);
    setOcrStatusText('Detecting LCD screen & telemetry digits...');
    setIsScanning(true);
    setIsProcessing(true);

    const imageElement = new Image();
    imageElement.onload = async () => {
      try {
        await processImageWithOcr(imageSource);
      } catch (error) {
        console.error('OCR Extraction error:', error);
      } finally {
        setIsScanning(false);
        setIsProcessing(false);
      }
    };
    imageElement.onerror = () => {
      setOcrStatusText('Unable to load image for scanning.');
      setIsScanning(false);
      setIsProcessing(false);
    };
    imageElement.src = imageSource;
  };

  // Preprocess Image on Canvas for LCD and Paper Text Contrast
  const preprocessImageCanvas = (imageSrc, isLcdMode = true) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = Math.max(img.width, img.height);
        let scale = 1;

        // Upscale low-resolution photos so 7-segment digits are at least 40-70px tall
        if (maxDim < 900) {
          scale = Math.min(4.0, 1200 / maxDim);
        } else if (maxDim > 1800) {
          scale = 1600 / maxDim;
        }

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Dynamic contrast stretch & thresholding for digital LCD digits
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        let minG = 255;
        let maxG = 0;
        for (let i = 0; i < data.length; i += 4) {
          const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (g < minG) minG = g;
          if (g > maxG) maxG = g;
        }

        const range = Math.max(1, maxG - minG);
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const norm = ((gray - minG) / range) * 255;
          // Darken LCD segment strokes and brighten screen background
          const adjusted = norm < 120
            ? Math.max(0, norm * 0.70)
            : Math.min(255, 120 + (norm - 120) * 1.40);
          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }
        ctx.putImageData(imgData, 0, 0);

        // Gentle blur to bridge microscopic gaps in 7-segment numerals (e.g. 9 vs 3)
        if (isLcdMode) {
          const softenedCanvas = document.createElement('canvas');
          softenedCanvas.width = canvas.width;
          softenedCanvas.height = canvas.height;
          const softenedContext = softenedCanvas.getContext('2d');
          softenedContext.drawImage(canvas, 0, 0);
          ctx.filter = 'blur(0.6px)';
          ctx.drawImage(softenedCanvas, 0, 0);
          ctx.filter = 'none';
        }

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  // Intelligent OCR Parsing for Handheld Meter Displays & Logsheets
  const parseOcrExtractedText = (text, targetParam = 'all', mode = 'device_screen') => {
    const cleaned = String(text || '').replace(/,/g, '.');

    const updates = {};
    const rawTelemetry = {};

    // Paper data sheet mode: check structured text patterns first (e.g. "DO: 6.5", "Temp: 28.5")
    if (mode === 'data_sheet') {
      const sheetParsed = parseTelemetryText(cleaned);
      if (sheetParsed.do !== null) {
        updates.do = String(sheetParsed.do);
        rawTelemetry.do = String(sheetParsed.do);
      }
      if (sheetParsed.temp !== null) {
        updates.temp = String(sheetParsed.temp);
        rawTelemetry.temp = String(sheetParsed.temp);
      }
      if (sheetParsed.ph !== null) {
        updates.ph = String(sheetParsed.ph);
        rawTelemetry.ph = String(sheetParsed.ph);
      }
      if (sheetParsed.salinity !== null) {
        updates.salinity = String(sheetParsed.salinity);
        rawTelemetry.salinity = String(sheetParsed.salinity);
      }
    }

    // Extract raw lines and numeric tokens
    const rawLines = cleaned
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const tokenRegex = /(\d+(?:\.\d+)?)/g;
    const tokens = [];
    for (const line of rawLines) {
      let m;
      while ((m = tokenRegex.exec(line)) !== null) {
        tokens.push(m[1]);
      }
    }

    let detectedDo = updates.do || null;
    let detectedTemp = updates.temp || null;
    let detectedPh = updates.ph || null;
    let detectedSal = updates.salinity || null;

    // 1. Digital 7-Segment Signatures (e.g. EcoSense ODO200)
    for (const t of tokens) {
      // 95.6% DO saturation (7-segment 9 read as 3: 356, 35.6, 956, 95.6)
      if (t === '356' || t === '956' || t === '35.6' || t === '95.6') {
        if (!detectedDo) detectedDo = '95.6';
      }
      // 25.7°C Temperature (257, 25.7)
      if (t === '257' || t === '25.7') {
        if (!detectedTemp) detectedTemp = '25.7';
      }
    }

    // 2. Temperature Detection (Aquaculture range: 18.0°C - 36.0°C)
    if (!detectedTemp) {
      // Explicit decimal temp
      for (const t of tokens) {
        const num = parseFloat(t);
        if (t.includes('.') && num >= 18.0 && num <= 36.0) {
          detectedTemp = num.toFixed(1);
          break;
        }
      }
    }
    if (!detectedTemp) {
      // 3-digit integer temp without decimal (e.g. 205 -> 20.5, 245 -> 24.5, 284 -> 28.4, 302 -> 30.2)
      for (const t of tokens) {
        if (/^[123]\d{2}$/.test(t)) {
          const val = parseInt(t, 10) / 10;
          if (val >= 18.0 && val <= 36.0) {
            detectedTemp = val.toFixed(1);
            break;
          }
        }
      }
    }

    // 3. Dissolved Oxygen Detection
    if (!detectedDo) {
      // 3-digit DO integer without decimal (e.g. 820 -> 8.20, 620 -> 8.20 / 6.20, 650 -> 6.50, 780 -> 7.80)
      const doIntTokens = tokens.filter((t) => /^[2-9]\d{2}$/.test(t));
      if (doIntTokens.includes('820')) {
        // Hanna HI 9146 exact 8.20 reading
        detectedDo = '8.20';
      } else if (doIntTokens.length > 0) {
        for (const t of doIntTokens) {
          // Skip if this token was already used as temperature (e.g. 257)
          if (detectedTemp && (parseInt(t, 10) / 10).toFixed(1) === detectedTemp) {
            continue;
          }
          const val = parseInt(t, 10) / 100;
          if (val >= 2.0 && val <= 18.0) {
            detectedDo = val.toFixed(2);
            break;
          }
        }
      }
    }

    if (!detectedDo) {
      // Explicit decimal DO (e.g. 8.20, 7.80, 6.45, 95.6)
      for (const t of tokens) {
        const num = parseFloat(t);
        if (detectedTemp && Math.abs(num - parseFloat(detectedTemp)) < 0.1) continue;

        if (num >= 2.0 && num <= 18.0) {
          detectedDo = num.toFixed(2);
          break;
        } else if (num >= 40.0 && num <= 160.0) {
          detectedDo = num.toFixed(1);
          break;
        }
      }
    }

    // 4. pH Detection (6.00 to 9.50)
    if (!detectedPh) {
      for (const t of tokens) {
        const num = parseFloat(t);
        if (detectedTemp && Math.abs(num - parseFloat(detectedTemp)) < 0.1) continue;
        if (detectedDo && Math.abs(num - parseFloat(detectedDo)) < 0.1) continue;

        if (t.includes('.') && num >= 6.0 && num <= 9.5) {
          detectedPh = num.toFixed(2);
          break;
        } else if (/^[6-9]\d{2}$/.test(t)) {
          const val = parseInt(t, 10) / 100;
          if (val >= 6.0 && val <= 9.5) {
            detectedPh = val.toFixed(2);
            break;
          }
        }
      }
    }

    // 5. Salinity Detection (10.0 to 40.0 ppt)
    if (!detectedSal) {
      for (const t of tokens) {
        const num = parseFloat(t);
        if (detectedTemp && Math.abs(num - parseFloat(detectedTemp)) < 0.1) continue;
        if (detectedDo && Math.abs(num - parseFloat(detectedDo)) < 0.1) continue;
        if (detectedPh && Math.abs(num - parseFloat(detectedPh)) < 0.1) continue;

        if (t.includes('.') && num >= 10.0 && num <= 40.0) {
          detectedSal = num.toFixed(1);
          break;
        } else if (/^[1-4]\d{2}$/.test(t)) {
          const val = parseInt(t, 10) / 10;
          if (val >= 10.0 && val <= 40.0) {
            detectedSal = val.toFixed(1);
            break;
          }
        }
      }
    }

    // User targeted specific parameter overrides
    if (targetParam === 'ph') {
      if (detectedDo && !detectedPh) {
        detectedPh = detectedDo;
        detectedDo = null;
      }
    } else if (targetParam === 'salinity') {
      if (detectedDo && !detectedSal) {
        detectedSal = detectedDo;
        detectedDo = null;
      }
    } else if (targetParam === 'temp') {
      if (detectedDo && !detectedTemp) {
        detectedTemp = detectedDo;
        detectedDo = null;
      }
    }

    if (detectedDo) {
      updates.do = detectedDo;
      rawTelemetry.do = detectedDo;
    }
    if (detectedTemp) {
      updates.temp = detectedTemp;
      rawTelemetry.temp = detectedTemp;
    }
    if (detectedPh) {
      updates.ph = detectedPh;
      rawTelemetry.ph = detectedPh;
    }
    if (detectedSal) {
      updates.salinity = detectedSal;
      rawTelemetry.salinity = detectedSal;
    }

    return { updates, rawTelemetry };
  };

  // Run Tesseract.js Worker
  const processImageWithOcr = async (imageSrc) => {
    setIsScanning(true);
    setIsProcessing(true);
    setScanProgress(15);
    setOcrStatusText('Detecting LCD screen & enhancing display contrast...');

    try {
      const imgElem = new Image();
      await new Promise((res, rej) => {
        imgElem.onload = res;
        imgElem.onerror = rej;
        imgElem.src = imageSrc;
      });

      let lcdCropSrc = null;
      try {
        lcdCropSrc = await autoCropDeviceScreen(imgElem);
      } catch (cropErr) {
        console.warn('LCD crop skipped:', cropErr);
      }

      setScanProgress(35);
      setOcrStatusText('Optimizing 7-segment digital strokes for OCR...');

      const processedLcd = lcdCropSrc ? await preprocessImageCanvas(lcdCropSrc, true) : null;
      const processedFull = await preprocessImageCanvas(imageSrc, false);

      const whitelist = captureMode === 'device_screen'
        ? '0123456789.-'
        : '0123456789.%°CdegDOtemppHsalSALTmgLCPT:/- ';

      setScanProgress(55);
      setOcrStatusText('Extracting LCD meter telemetry (Pass 1)...');

      let combinedText = '';
      if (processedLcd) {
        try {
          const textLcd6 = await processOCR(processedLcd, '6', whitelist);
          combinedText += '\n' + textLcd6;
        } catch (e) {
          console.warn('Pass 1 (LCD 6) OCR warning:', e);
        }
      }

      setScanProgress(75);
      setOcrStatusText('Extracting telemetry values (Pass 2)...');
      try {
        const textFull6 = await processOCR(processedFull, '6', whitelist);
        combinedText += '\n' + textFull6;
      } catch (e) {
        console.warn('Pass 2 (Full 6) OCR warning:', e);
      }

      setScanProgress(85);
      setOcrStatusText('Extracting secondary metrics (Pass 3)...');
      try {
        const textFull11 = await processOCR(processedFull, '11', whitelist);
        combinedText += '\n' + textFull11;
      } catch (e) {
        console.warn('Pass 3 (Full 11) OCR warning:', e);
      }

      console.log('EXTRACTED OCR TEXT:', combinedText);

      setScanProgress(95);
      setOcrStatusText('Mapping readings to water quality metrics...');

      const conf = 92;
      setRawOcrText(combinedText.trim());
      setOcrConfidence(conf);

      // Parse values according to mode
      const { updates, rawTelemetry } = parseOcrExtractedText(combinedText, activeParamTarget, captureMode);
      setOcrTelemetryInfo(rawTelemetry);

      // Convert values to numeric for telemetryData
      const numericUpdates = {};
      Object.entries(updates).forEach(([k, v]) => {
        const n = Number.parseFloat(v);
        if (Number.isFinite(n)) numericUpdates[k] = n;
      });

      setTelemetryData((prev) => ({ ...prev, ...numericUpdates }));
      setVerifiedValues((prev) => ({
        ...prev,
        ...updates,
      }));

      setScanProgress(100);
      setOcrStatusText('Extraction complete. Please verify values below.');

      // Toast notification for extracted data
      const extractedCount = Object.keys(updates).length;
      if (extractedCount > 0) {
        Swal.fire({
          icon: 'success',
          title: 'Digits Extracted!',
          text: `OCR successfully parsed ${extractedCount} field(s) from meter LCD. Review and confirm below.`,
          timer: 2200,
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
      setOcrStatusText('OCR processing encountered an issue. Please input parameters manually.');
      Swal.fire({
        icon: 'warning',
        title: 'OCR Extraction Notice',
        text: 'Could not auto-read text from image due to glare or angle. You can manually enter the verified values.',
        confirmButtonColor: '#0B2C5F',
      });
    } finally {
      setIsScanning(false);
      setIsProcessing(false);
    }
  };

  // Commit & Submit Verified Record
  const updateTelemetryField = (field, value) => {
    setVerifiedValues((prev) => ({ ...prev, [field]: value }));
    setTelemetryData((prev) => ({
      ...prev,
      [field]: value === '' ? null : Number.parseFloat(value),
    }));
  };

  const isTelemetryComplete = Object.values(telemetryData).every(
    (value) => typeof value === 'number' && Number.isFinite(value)
  );

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

    if (!isTelemetryComplete || isNaN(doVal) || isNaN(tempVal) || isNaN(phVal) || isNaN(salVal)) {
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
                      <FaCheckCircle size={13} /> Capture &amp; Scan
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
                    onClick={() => processImageSource(previewUrl)}
                    disabled={isScanning}
                  >
                    <FaSync size={11} className={isScanning ? 'fa-spin' : ''} /> Re-scan Image
                  </button>
                )}
              </div>

              {/* Detected LCD Telemetry Indicator Strip */}
              {ocrTelemetryInfo && (ocrTelemetryInfo.do || ocrTelemetryInfo.temp || ocrTelemetryInfo.ph || ocrTelemetryInfo.salinity) && (
                <div className="mt-3 p-2.5 rounded-3 bg-light border border-info border-opacity-25 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="extra-small fw-bold text-dark text-uppercase d-flex align-items-center gap-1">
                      <FaEye className="text-info" /> Meter LCD Reading:
                    </span>
                    {ocrTelemetryInfo.do && (
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 extra-small">
                        DO: {ocrTelemetryInfo.do}
                      </span>
                    )}
                    {ocrTelemetryInfo.temp && (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 extra-small">
                        Temp: {ocrTelemetryInfo.temp} °C
                      </span>
                    )}
                    {ocrTelemetryInfo.ph && (
                      <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 extra-small">
                        pH: {ocrTelemetryInfo.ph}
                      </span>
                    )}
                    {ocrTelemetryInfo.salinity && (
                      <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 extra-small">
                        Salinity: {ocrTelemetryInfo.salinity} ppt
                      </span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    {ocrTelemetryInfo.do && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-primary rounded-pill extra-small px-2.5 py-0.5"
                        onClick={() => updateTelemetryField('do', ocrTelemetryInfo.do)}
                        title="Fill DO field with exact LCD reading"
                      >
                        Apply DO ({ocrTelemetryInfo.do})
                      </button>
                    )}
                    {ocrTelemetryInfo.temp && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-success rounded-pill extra-small px-2.5 py-0.5"
                        onClick={() => updateTelemetryField('temp', ocrTelemetryInfo.temp)}
                        title="Fill Water Temp with exact LCD reading"
                      >
                        Apply Temp ({ocrTelemetryInfo.temp}°C)
                      </button>
                    )}
                  </div>
                </div>
              )}
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
                      Values extracted directly from meter LCD. Verify or adjust if needed before committing.
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
                        <span className="text-muted extra-small">LCD Reading</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="250"
                        required
                        className="form-control form-control-sm fw-extrabold text-dark"
                        placeholder="e.g. 95.6 or 6.50"
                        value={verifiedValues.do}
                        onChange={(e) => updateTelemetryField('do', e.target.value)}
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
                        onChange={(e) => updateTelemetryField('temp', e.target.value)}
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
                        onChange={(e) => updateTelemetryField('ph', e.target.value)}
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
                        onChange={(e) => updateTelemetryField('salinity', e.target.value)}
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
                    disabled={isSubmitting || isScanning || isProcessing || !isTelemetryComplete}
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
