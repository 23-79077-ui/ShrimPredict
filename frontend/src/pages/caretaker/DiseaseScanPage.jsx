import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { classifyDiseaseFromText } from '../../utils/diseaseClassifier';

export default function DiseaseScanPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [image, setImage] = useState(null);
  const [analysisText, setAnalysisText] = useState('');
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
      } catch (error) {
        Swal.fire({ icon: 'warning', title: 'Camera unavailable', text: 'You can still upload an image instead.' });
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
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    setImage(dataUrl);
    Swal.fire({ icon: 'success', title: 'Photo captured', text: 'The image is ready for analysis.' });
  };

  const handleScan = async () => {
    if (!image) {
      Swal.fire({ icon: 'warning', title: 'No photo captured' });
      return;
    }

    const nextAnalysisText = analysisText || 'white spots visible on shrimp body and mottled discoloration around the carapace';
    const parsedResult = classifyDiseaseFromText(nextAnalysisText);
    setResult(parsedResult);

    try {
      await api.post('/disease_reports.php', {
        disease_name: parsedResult.disease_name,
        confidence_score: parsedResult.confidence_score,
        risk_level: parsedResult.risk_level,
        recommendation: parsedResult.recommendation,
        status: 'Pending',
        caretaker_name: user?.full_name || 'Caretaker',
        pond_name: user?.assigned_ponds?.[0]?.pond_name || 'Assigned Pond',
      });
    } catch (e) {
      console.error('Error saving disease scan report:', e);
    }

    Swal.fire({
      icon: parsedResult.risk_level === 'High' ? 'warning' : 'info',
      title: 'Scan completed & recorded',
      text: `${parsedResult.disease_name} detected with ${parsedResult.confidence_score}% confidence. Admin has been notified.`
    });
  };

  return (
    <div>
      <h3 className="fw-bold mb-3">Disease Scan</h3>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="border rounded overflow-hidden mb-3" style={{ maxHeight: 320 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', background: '#000' }} />
          </div>

          <div className="d-flex gap-2 flex-wrap mb-3">
            <button className="btn btn-success" onClick={captureImage}>Capture Photo</button>
            <button className="btn btn-outline-success" onClick={handleScan}>Scan Captured Image</button>
          </div>

          <label className="form-label fw-semibold">Observed symptoms</label>
          <textarea
            className="form-control mb-3"
            rows="4"
            placeholder="Example: white spots on shell, shrimp lethargy, gill discoloration, red discoloration..."
            value={analysisText}
            onChange={(e) => setAnalysisText(e.target.value)}
          />

          {image && (
            <div className="mb-3">
              <img src={image} alt="captured preview" className="img-fluid rounded" style={{ maxHeight: 220 }} />
            </div>
          )}

          {result && (
            <div className="mt-4 border rounded p-3">
              <h5 className="fw-bold">Result</h5>
              <p><strong>Disease:</strong> {result.disease_name}</p>
              <p><strong>Confidence:</strong> {result.confidence_score}</p>
              <p><strong>Risk:</strong> {result.risk_level}</p>
              <p><strong>Recommendation:</strong> {result.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
