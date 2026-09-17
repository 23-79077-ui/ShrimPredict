import fs from 'fs';
import { parseMeterTelemetry } from '../tests/test_water_quality_scan.mjs';

// Table of 7-segment representations: a, b, c, d, e, f, g
// a: top, b: top-right, c: bot-right, d: bottom, e: bot-left, f: top-left, g: middle
const SEVENSEG = {
  '1111110': '0',
  '0110000': '1',
  '1101101': '2',
  '1111001': '3',
  '0110011': '4',
  '1011011': '5',
  '1011111': '6',
  '1110000': '7',
  '1111111': '8',
  '1111011': '9',
  // Common 7-segment tolerances on LCDs
  '1110010': '7',
  '1110001': '7',
  '0110001': '1',
  '1011101': '5',
  '0011111': '6',
  '1110110': '0', // Zero with slight bottom segment variance
  '1111100': '0', // Zero variant
  '1001111': 'E', // Error
};

export function decodeLcdFromGrayscale(gray, width, height) {
  // Handheld water quality meters (PH-80, JPB-70, AP-2, etc.) have their LCD display 
  // located in the upper 20% to 50% of the vertical frame.
  const yStart = Math.round(height * 0.20);
  const yEnd = Math.round(height * 0.45);
  const searchHeight = yEnd - yStart;

  // Find dynamic threshold for LCD strokes
  // Background inside LCD is grayish (~130-180), dark strokes are < 120
  let minVal = 255, maxVal = 0, sumVal = 0;
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
      sumVal += v;
    }
  }
  const meanVal = sumVal / (searchHeight * width);
  const thresh = Math.max(minVal + 15, Math.min(130, meanVal - 20));

  // 1. Row projection to find Line 1 and Line 2
  const rowCounts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < thresh) rowCounts[y]++;
    }
  }

  // Find two distinct peak clusters in row counts
  // Line 1 peak around y = 0.24 .. 0.32 of height
  // Line 2 peak around y = 0.33 .. 0.42 of height
  let bestL1Y = -1, maxL1 = 0;
  for (let y = Math.round(height * 0.22); y <= Math.round(height * 0.32); y++) {
    if (rowCounts[y] > maxL1) {
      maxL1 = rowCounts[y];
      bestL1Y = y;
    }
  }

  let bestL2Y = -1, maxL2 = 0;
  for (let y = Math.round(height * 0.33); y <= Math.round(height * 0.44); y++) {
    if (rowCounts[y] > maxL2) {
      maxL2 = rowCounts[y];
      bestL2Y = y;
    }
  }

  // Fallback if not detected via absolute heights
  if (bestL1Y === -1 || bestL2Y === -1) {
    return { line1: null, line2: null };
  }

  // Determine span for Line 1 (primary) and Line 2 (temp)
  const l1Half = Math.round(height * 0.015);
  const l2Half = Math.round(height * 0.012);

  const l1Y0 = Math.max(0, bestL1Y - l1Half);
  const l1Y1 = Math.min(height - 1, bestL1Y + l1Half);

  const l2Y0 = Math.max(0, bestL2Y - l2Half);
  const l2Y1 = Math.min(height - 1, bestL2Y + l2Half);

  // Helper to decode a line slice
  function decodeSlice(y0, y1, isLine2 = false) {
    const sliceH = y1 - y0 + 1;
    // Column projection
    const colCounts = new Int32Array(width);
    for (let x = 0; x < width; x++) {
      for (let y = y0; y <= y1; y++) {
        if (gray[y * width + x] < thresh) colCounts[x]++;
      }
    }

    // Identify character column spans (clusters with > 20% active height)
    const minColHeight = Math.max(2, Math.round(sliceH * 0.20));
    const spans = [];
    let inSpan = false, startX = 0;

    for (let x = 0; x < width; x++) {
      if (colCounts[x] >= minColHeight) {
        if (!inSpan) { inSpan = true; startX = x; }
      } else {
        if (inSpan) {
          inSpan = false;
          // Filter out full-width bezels (e.g. wider than 60px) or tiny specs (< 3px)
          const spanW = x - startX;
          if (spanW >= 3 && spanW <= width * 0.35) {
            spans.push({ x0: startX, x1: x - 1 });
          }
        }
      }
    }
    if (inSpan && (width - 1 - startX) >= 3 && (width - 1 - startX) <= width * 0.35) {
      spans.push({ x0: startX, x1: width - 1 });
    }

    // Sample each span
    let text = '';
    for (const span of spans) {
      const sw = span.x1 - span.x0 + 1;
      const sample = (rx, ry) => {
        const sx = Math.min(span.x1, Math.max(span.x0, Math.round(span.x0 + rx * sw)));
        const sy = Math.min(y1, Math.max(y0, Math.round(y0 + ry * sliceH)));
        // 3x3 window check
        for (let dy = -1; dy <= 1; dy++) {
          const cy = sy + dy;
          if (cy < 0 || cy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const cx = sx + dx;
            if (cx < 0 || cx >= width) continue;
            if (gray[cy * width + cx] < thresh) return 1;
          }
        }
        return 0;
      };

      const a = sample(0.50, 0.10);
      const b = sample(0.85, 0.28);
      const c = sample(0.85, 0.72);
      const d = sample(0.50, 0.90);
      const e = sample(0.15, 0.72);
      const f = sample(0.15, 0.28);
      const g = sample(0.50, 0.50);

      const bits = `${a}${b}${c}${d}${e}${f}${g}`;
      let digit = SEVENSEG[bits];

      if (!digit) {
        if (a === 1 && b === 1 && c === 1 && e === 0) digit = '7';
        else if (g === 0 && a === 1 && b === 1 && c === 1 && d === 1 && e === 1) digit = '0';
        else if (b === 1 && c === 1 && a === 0 && d === 0 && e === 0 && f === 0) digit = '1';
        else if (a === 1 && b === 1 && g === 1 && e === 1 && d === 1) digit = '2';
        else if (a === 1 && b === 1 && g === 1 && c === 1 && d === 1) digit = '3';
      }

      if (digit) text += digit;
    }

    return text;
  }

  const rawL1 = decodeSlice(l1Y0, l1Y1, false);
  const rawL2 = decodeSlice(l2Y0, l2Y1, true);

  return {
    line1: rawL1,
    line2: rawL2,
    l1Y: bestL1Y,
    l2Y: bestL2Y,
  };
}

console.log('Geometric LCD decoder function compiled successfully!');
