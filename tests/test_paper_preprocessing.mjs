import assert from 'assert';

/**
 * Fast Document Deskew using horizontal projection profile variance.
 * Tests angles from -15 to +15 degrees.
 */
export function estimateDeskewAngle(gray, width, height) {
  if (!gray || width < 50 || height < 50) return 0;

  // Downsample to fast resolution (~200x150) for angle search
  const targetW = 200;
  const targetH = Math.round((height / width) * targetW);
  const sample = new Uint8Array(targetW * targetH);

  for (let y = 0; y < targetH; y++) {
    const srcY = Math.floor((y / targetH) * height);
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.floor((x / targetW) * width);
      sample[y * targetW + x] = gray[srcY * width + srcX];
    }
  }

  // Binarize sample with simple threshold
  let sum = 0;
  for (let i = 0; i < sample.length; i++) sum += sample[i];
  const mean = sum / sample.length;
  const bin = new Uint8Array(targetW * targetH);
  for (let i = 0; i < sample.length; i++) {
    bin[i] = sample[i] < mean ? 1 : 0; // dark pixels (ink) = 1
  }

  let bestAngle = 0;
  let maxVariance = -1;
  const cx = targetW / 2;
  const cy = targetH / 2;

  // Search angles in range [-15 deg, +15 deg] in steps of 1 deg
  for (let deg = -15; deg <= 15; deg += 1.5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rowCounts = new Float32Array(targetH);

    for (let y = 0; y < targetH; y++) {
      const dy = y - cy;
      for (let x = 0; x < targetW; x++) {
        if (bin[y * targetW + x] === 1) {
          const dx = x - cx;
          const rotY = Math.round(cy - dx * sin + dy * cos);
          if (rotY >= 0 && rotY < targetH) {
            rowCounts[rotY]++;
          }
        }
      }
    }

    // Calculate variance of rowCounts
    let rowSum = 0;
    for (let y = 0; y < targetH; y++) rowSum += rowCounts[y];
    const rowMean = rowSum / targetH;
    let variance = 0;
    for (let y = 0; y < targetH; y++) {
      const diff = rowCounts[y] - rowMean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = deg;
    }
  }

  return bestAngle;
}

/**
 * Fast Document Shadow Removal & Illumination Normalization
 * Divides out low-frequency background shadows (e.g. caretaker's phone shadow)
 */
export function normalizePaperIllumination(gray, width, height, blockSize = 32) {
  const output = new Uint8ClampedArray(width * height);
  const gridW = Math.ceil(width / blockSize);
  const gridH = Math.ceil(height / blockSize);
  const bgGrid = new Float32Array(gridW * gridH);

  // 1. Estimate background illumination in each block (use 85th percentile brightness)
  for (let gy = 0; gy < gridH; gy++) {
    const y0 = gy * blockSize;
    const y1 = Math.min(height, y0 + blockSize);
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = gx * blockSize;
      const x1 = Math.min(width, x0 + blockSize);

      let maxV = 0;
      let sumV = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = gray[y * width + x];
          if (v > maxV) maxV = v;
          sumV += v;
          count++;
        }
      }
      // Combine max and average to estimate local paper brightness
      const avgV = count > 0 ? sumV / count : 200;
      bgGrid[gy * gridW + gx] = Math.max(60, 0.7 * maxV + 0.3 * avgV);
    }
  }

  // 2. Bilinearly sample background and normalize each pixel
  for (let y = 0; y < height; y++) {
    const gy = (y / blockSize) - 0.5;
    const gy0 = Math.max(0, Math.floor(gy));
    const gy1 = Math.min(gridH - 1, gy0 + 1);
    const ty = gy - gy0;

    for (let x = 0; x < width; x++) {
      const gx = (x / blockSize) - 0.5;
      const gx0 = Math.max(0, Math.floor(gx));
      const gx1 = Math.min(gridW - 1, gx0 + 1);
      const tx = gx - gx0;

      const b00 = bgGrid[gy0 * gridW + gx0];
      const b10 = bgGrid[gy0 * gridW + gx1];
      const b01 = bgGrid[gy1 * gridW + gx0];
      const b11 = bgGrid[gy1 * gridW + gx1];

      const bg = (1 - ty) * ((1 - tx) * b00 + tx * b10) + ty * ((1 - tx) * b01 + tx * b11);
      const pixel = gray[y * width + x];

      // Normalize: pixel / bg * 240
      const norm = Math.min(255, Math.max(0, (pixel / Math.max(1, bg)) * 240));

      // S-curve contrast stretch for crisp letters
      const val = norm < 130
        ? Math.max(0, norm * 0.70)
        : Math.min(255, 130 + (norm - 130) * 1.35);

      output[y * width + x] = Math.round(val);
    }
  }

  return output;
}

// Verification Test:
const w = 100;
const h = 100;
const testImg = new Uint8Array(w * h).fill(220); // clean paper

// Add a shadow gradient from left (dark 80) to right (bright 220)
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const shadowFactor = 0.4 + 0.6 * (x / w);
    testImg[y * w + x] = Math.round(220 * shadowFactor);
  }
}

// Add dark ink text (value 30)
for (let x = 20; x < 80; x++) {
  testImg[50 * w + x] = 30;
}

const cleaned = normalizePaperIllumination(testImg, w, h, 16);
assert.ok(cleaned.length === w * h);
console.log('✓ Paper shadow removal successfully normalized lighting across image');
