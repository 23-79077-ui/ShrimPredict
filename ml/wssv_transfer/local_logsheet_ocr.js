const fs = require('fs');
const path = require('path');
const { createWorker } = require(path.resolve(__dirname, '../../node_modules/tesseract.js'));

function parseParams(rawText) {
  const txt = String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/,/g, '.')
    .replace(/[—–]/g, '-');

  const pick = (patterns, minVal, maxVal) => {
    for (const re of patterns) {
      const m = txt.match(re);
      if (m && m[1] !== undefined) {
        const val = parseFloat(m[1]);
        if (Number.isFinite(val) && val >= minVal && val <= maxVal) {
          return val;
        }
      }
    }
    return null;
  };

  const dissolved_oxygen = pick(
    [
      /(?:dissolved\s*oxygen|d\.?\s*o\.?)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i,
      /\bDO\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i,
    ],
    0.5,
    30.0
  );
  const water_temp = pick(
    [
      /(?:water\s*)?(?:temp|temperature)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i,
      /\b(\d{2}(?:\.\d+)?)\s*°?\s*C\b/i,
    ],
    10.0,
    50.0
  );
  const ph_balance = pick(
    [
      /(?:p\.?\s*h\.?(?:\s*balance|\s*level)?)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i,
    ],
    0.0,
    14.0
  );
  const salinity = pick(
    [
      /(?:salinity|sal|slnty)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i,
      /\b(\d+(?:\.\d+)?)\s*ppt\b/i,
    ],
    0.0,
    50.0
  );

  return { dissolved_oxygen, water_temp, ph_balance, salinity };
}

(async () => {
  const imgPath = process.argv[2];
  if (!imgPath || !fs.existsSync(imgPath)) {
    console.error(JSON.stringify({ success: false, message: 'Image file missing.' }));
    process.exit(1);
  }
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const res = await worker.recognize(imgPath);
    const rawText = res?.data?.text || '';
    const conf = Number(res?.data?.confidence || 0);
    const parsed = parseParams(rawText);
    const foundCount = Object.values(parsed).filter((v) => v !== null).length;
    console.log(
      JSON.stringify({
        success: foundCount >= 2,
        data: parsed,
        raw_text: rawText,
        confidence: Math.round(conf * 10) / 10,
      })
    );
  } finally {
    await worker.terminate();
  }
})();

