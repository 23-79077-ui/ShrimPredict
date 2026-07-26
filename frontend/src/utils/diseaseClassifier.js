const DISEASE_KEYWORDS = {
  'White Spot Syndrome Virus': [
    'white spot',
    'white spots',
    'wssv',
    'white spot syndrome',
    'white spot syndrome virus',
    'white patch',
    'white patches',
    'circular white',
    'spotty',
    'tiny white',
    'sclerotized',
    'lesion',
    'petechiae'
  ],
  'Black Gill Disease': [
    'black gill',
    'dark gill',
    'gill discoloration',
    'gill damage'
  ],
  'Vibriosis': [
    'red discoloration',
    'reddish',
    'red tail',
    'tail rot',
    'necrosis'
  ],
  'Healthy': [
    'clear shell',
    'clean body',
    'normal color',
    'healthy shrimp'
  ]
};

const RECOMMENDATIONS = {
  'White Spot Syndrome Virus': 'Isolate the pond immediately, stop transferring shrimp or water, increase water quality checks, and consult an aquaculture specialist.',
  'Black Gill Disease': 'Improve filtration and water quality, and monitor gill health closely for the next 48 hours.',
  'Vibriosis': 'Reduce stress, improve sanitation, and review feed and water parameters with a specialist.',
  'Healthy': 'No WSSV signs detected; continue standard monitoring and feeding schedules.'
};

let pixelModelPromise = null;
let forestModelPromise = null;

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyDiseaseFromText(text = '') {
  const normalized = normalizeText(text);
  const scores = {};

  Object.entries(DISEASE_KEYWORDS).forEach(([disease, keywords]) => {
    const matches = keywords.filter((keyword) => normalized.includes(keyword)).length;
    scores[disease] = matches;
  });

  const wssvScore = scores['White Spot Syndrome Virus'] || 0;
  const healthyScore = scores.Healthy || 0;
  const maxScore = Math.max(...Object.values(scores));

  if (!normalized || maxScore === 0 || healthyScore > wssvScore) {
    return {
      disease_name: 'No WSSV Detected',
      confidence_score: normalized ? 78 : 70,
      risk_level: 'Low',
      recommendation: RECOMMENDATIONS.Healthy,
      source: 'wssv-conservative-fallback'
    };
  }

  const topDisease = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const diseaseName = wssvScore > 0 ? 'White Spot Syndrome Virus' : topDisease?.[0] || 'Healthy';
  const confidenceScore = Math.min(96, 62 + (scores[diseaseName] || 0) * 11);
  const riskLevel = diseaseName === 'White Spot Syndrome Virus' || diseaseName === 'Vibriosis' ? 'High' : diseaseName === 'Black Gill Disease' ? 'Medium' : 'Low';

  return {
    disease_name: diseaseName,
    confidence_score: Math.round(confidenceScore),
    risk_level: riskLevel,
    recommendation: RECOMMENDATIONS[diseaseName] || RECOMMENDATIONS['White Spot Syndrome Virus'],
    source: 'wssv-prioritized-fallback'
  };
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getSaturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

async function loadPixelModel() {
  if (!pixelModelPromise) {
    pixelModelPromise = fetch('/models/shrimp-disease/wssv-pixel-model.json')
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return pixelModelPromise;
}

async function loadForestModel() {
  if (!forestModelPromise) {
    forestModelPromise = fetch('/models/shrimp-disease/wssv-forest-model.json')
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return forestModelPromise;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function imageToPixelVector(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const vector = [];

  for (let index = 0; index < data.length; index += 4) {
    vector.push(data[index] / 255);
    vector.push(data[index + 1] / 255);
    vector.push(data[index + 2] / 255);
  }

  return vector;
}

function getImageData(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

function classifyWithPixelModel(model, image) {
  const vector = imageToPixelVector(image, model.imageSize || 48);
  let logit = model.bias || 0;

  for (let index = 0; index < vector.length; index += 1) {
    const scaled = (vector[index] - model.mean[index]) / (model.scale[index] || 1);
    logit += scaled * model.weights[index];
  }

  const probability = sigmoid(logit);
  return classifyDiseaseFromWssvProbability(probability, Math.max(model.threshold || 0.84, 0.84), 0.68, 'trained-wssv-pixel-model');
}

function extractForestFeatures(image, size = 96, gridSize = 6) {
  const data = getImageData(image, size);
  const pixelCount = size * size;
  const brightness = new Array(pixelCount);
  const saturationValues = new Array(pixelCount);
  const redValues = new Array(pixelCount);
  const greenValues = new Array(pixelCount);
  const blueValues = new Array(pixelCount);
  const channelBins = Array.from({ length: 3 }, () => new Array(12).fill(0));
  const features = [];
  let brightnessSum = 0;
  let brightnessSquaredSum = 0;
  let saturationSum = 0;
  let saturationSquaredSum = 0;
  let darkCount = 0;
  let redCount = 0;
  let pigmentCount = 0;
  let diagnosticDomainCount = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const value = (r + g + b) / 3;
    const sat = getSaturation(r, g, b);

    brightness[pixel] = value;
    saturationValues[pixel] = sat;
    redValues[pixel] = r;
    greenValues[pixel] = g;
    blueValues[pixel] = b;
    brightnessSum += value;
    brightnessSquaredSum += value * value;
    saturationSum += sat;
    saturationSquaredSum += sat * sat;

    if (value < 75) darkCount += 1;
    if (r > 125 && r > g * 1.12 && r > b * 1.12) redCount += 1;
    if (sat >= 0.15 && sat <= 0.70 && value >= 40 && value <= 220) pigmentCount += 1;
    if (sat >= 0.18 && sat <= 0.78 && value >= 35 && value <= 210) diagnosticDomainCount += 1;

    [r, g, b].forEach((channelValue, channelIndex) => {
      const bin = Math.min(11, Math.floor(channelValue / 21.25));
      channelBins[channelIndex][bin] += 1;
    });
  }

  const localSmooth = new Array(pixelCount).fill(0);
  const radius = 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const yy = Math.min(size - 1, Math.max(0, y + dy));
          const xx = Math.min(size - 1, Math.max(0, x + dx));
          sum += brightness[yy * size + xx];
          count += 1;
        }
      }
      localSmooth[y * size + x] = sum / count;
    }
  }

  let punctateSpotCount = 0;
  let broadShellSpotCount = 0;
  let contrastSum = 0;
  let contrastSquaredSum = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const contrast = brightness[pixel] - localSmooth[pixel];
    const sat = saturationValues[pixel];
    const value = brightness[pixel];
    contrastSum += contrast;
    contrastSquaredSum += contrast * contrast;
    if (contrast > 22 && value > 160 && sat < 0.28) punctateSpotCount += 1;
    if (contrast > 10 && value > 135 && sat < 0.45) broadShellSpotCount += 1;
  }

  const brightnessMean = brightnessSum / pixelCount;
  const saturationMean = saturationSum / pixelCount;
  const contrastMean = contrastSum / pixelCount;
  features.push(
    brightnessMean / 255,
    Math.sqrt(Math.max(0, brightnessSquaredSum / pixelCount - brightnessMean * brightnessMean)) / 255,
    saturationMean,
    Math.sqrt(Math.max(0, saturationSquaredSum / pixelCount - saturationMean * saturationMean)),
    punctateSpotCount / pixelCount,
    ((brightness.filter((value, index) => value > 205 && saturationValues[index] < 0.12).length) / pixelCount),
    darkCount / pixelCount,
    redCount / pixelCount,
    pigmentCount / pixelCount,
    Math.sqrt(Math.max(0, contrastSquaredSum / pixelCount - contrastMean * contrastMean)) / 255,
    broadShellSpotCount / pixelCount,
    diagnosticDomainCount / pixelCount
  );

  channelBins.forEach((bins) => {
    bins.forEach((count) => features.push(count / pixelCount / 21.25));
  });

  const cell = Math.floor(size / gridSize);
  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      let cellBrightnessSum = 0;
      let cellWhiteSpotCount = 0;
      let cellBroadSpotCount = 0;
      let cellPixels = 0;

      for (let y = gy * cell; y < (gy + 1) * cell; y += 1) {
        for (let x = gx * cell; x < (gx + 1) * cell; x += 1) {
          const pixel = y * size + x;
          const value = brightness[pixel];
          const sat = saturationValues[pixel];
          const contrast = value - localSmooth[pixel];
          cellBrightnessSum += value;
          cellPixels += 1;
          if (contrast > 22 && value > 160 && sat < 0.28) cellWhiteSpotCount += 1;
          if (contrast > 10 && value > 135 && sat < 0.45) cellBroadSpotCount += 1;
        }
      }

      features.push(cellBrightnessSum / cellPixels / 255);
      features.push(cellWhiteSpotCount / cellPixels);
      features.push(cellBroadSpotCount / cellPixels);
    }
  }

  return features;
}

function runForestTree(tree, features) {
  let node = 0;
  while (tree.childrenLeft[node] !== -1) {
    const featureIndex = tree.feature[node];
    node = features[featureIndex] <= tree.threshold[node] ? tree.childrenLeft[node] : tree.childrenRight[node];
  }
  const counts = tree.value[node];
  const total = counts[0] + counts[1];
  return total > 0 ? counts[1] / total : 0;
}

function classifyWithForestModel(model, image) {
  const features = extractForestFeatures(image, model.imageSize || 96, model.gridSize || 6);
  const probability = model.trees.reduce((sum, tree) => sum + runForestTree(tree, features), 0) / model.trees.length;
  const highRiskThreshold = model.threshold || 0.48;
  const punctateSpotRatio = features[4] || 0;
  const uniformBrightRatio = features[5] || 0;
  const shrimpPigmentRatio = features[8] || 0;
  const spotContrastStd = features[9] || 0;
  const broadShellSpotRatio = features[10] || 0;
  const diagnosticDomainRatio = features[11] || 0;
  const hasDiagnosticShrimpCloseup = diagnosticDomainRatio >= 0.30 || shrimpPigmentRatio >= 0.30;
  const hasLocalizedWhiteSpotPattern = (
    (punctateSpotRatio >= 0.018 && punctateSpotRatio <= 0.14)
    || broadShellSpotRatio >= 0.055
  ) && uniformBrightRatio < 0.30;

  if (!hasDiagnosticShrimpCloseup && hasLocalizedWhiteSpotPattern) {
    return {
      disease_name: 'Needs Review',
      confidence_score: 55,
      wssv_probability: Math.round(Math.max(probability, 0.45) * 100),
      risk_level: 'Medium',
      recommendation: 'Image is not a clear diagnostic shrimp close-up. Retake a close-up photo of the shell under good lighting before confirming WSSV.',
      source: 'trained-wssv-forest-model + image-quality-check'
    };
  }

  if (hasDiagnosticShrimpCloseup && hasLocalizedWhiteSpotPattern && probability >= 0.32 && spotContrastStd >= 0.052) {
    const boostedProbability = Math.min(0.92, Math.max(probability, 0.58 + Math.max(punctateSpotRatio * 2.8, broadShellSpotRatio * 1.8)));
    return classifyDiseaseFromWssvProbability(boostedProbability, 0.48, 0.36, 'trained-wssv-forest-model + white-spot-check');
  }

  if (hasLocalizedWhiteSpotPattern && probability >= 0.22) {
    return {
      disease_name: 'Needs Review',
      confidence_score: Math.round(probability * 100),
      wssv_probability: Math.round(probability * 100),
      risk_level: 'Medium',
      recommendation: 'White spot-like marks are visible but model confidence is not strong. Retake a close-up photo under good light and keep the shrimp batch under observation.',
      source: 'trained-wssv-forest-model + white-spot-check'
    };
  }

  return classifyDiseaseFromWssvProbability(probability, highRiskThreshold, highRiskThreshold - 0.12, 'trained-wssv-forest-model');
}

export async function classifyDiseaseFromImage(imageSrc, symptomsText = '') {
  const textResult = classifyDiseaseFromText(symptomsText);
  const hasWssvText = textResult.disease_name === 'White Spot Syndrome Virus';

  if (hasWssvText) return textResult;

  try {
    const image = await loadImageElement(imageSrc);
    const forestModel = await loadForestModel();
    if (forestModel?.type === 'wssv_forest_classifier') {
      return classifyWithForestModel(forestModel, image);
    }

    const pixelModel = await loadPixelModel();
    if (pixelModel?.type === 'wssv_pixel_logistic_regression') {
      return classifyWithPixelModel(pixelModel, image);
    }

    const canvas = document.createElement('canvas');
    const size = 192;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);

    const { data } = ctx.getImageData(0, 0, size, size);
    let inspected = 0;
    let smallWhiteSpotPixels = 0;
    let veryWhitePixels = 0;

    for (let y = 16; y < size - 16; y += 1) {
      for (let x = 16; x < size - 16; x += 1) {
        const index = (y * size + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const brightness = (r + g + b) / 3;
        const saturation = getSaturation(r, g, b);

        inspected += 1;
        if (brightness > 235 && saturation < 0.12) veryWhitePixels += 1;
        if (brightness > 205 && brightness < 245 && saturation < 0.18) smallWhiteSpotPixels += 1;
      }
    }

    const spotRatio = smallWhiteSpotPixels / inspected;
    const glareOrBackgroundRatio = veryWhitePixels / inspected;

    if (spotRatio >= 0.018 && spotRatio <= 0.11 && glareOrBackgroundRatio < 0.2) {
      return classifyDiseaseFromWssvProbability(Math.min(0.82, 0.5 + spotRatio * 3.2));
    }

    return {
      disease_name: 'No WSSV Detected',
      confidence_score: glareOrBackgroundRatio >= 0.2 ? 68 : 82,
      risk_level: 'Low',
      recommendation: RECOMMENDATIONS.Healthy,
      source: 'conservative-image-check'
    };
  } catch (error) {
    console.error('Image analysis failed:', error);
    return textResult;
  }
}

export function classifyDiseaseFromWssvProbability(probability = 0, highRiskThreshold = 0.6, mediumRiskThreshold = 0.4, source = 'trained-wssv-model') {
  const score = Number.isFinite(probability) ? probability : 0;
  const confidenceScore = Math.round(score * 100);

  if (score >= highRiskThreshold) {
    return {
      disease_name: 'White Spot Syndrome Virus',
      confidence_score: confidenceScore,
      wssv_probability: confidenceScore,
      risk_level: 'High',
      recommendation: RECOMMENDATIONS['White Spot Syndrome Virus'],
      source
    };
  }

  if (score >= mediumRiskThreshold) {
    return {
      disease_name: 'Needs Review',
      confidence_score: confidenceScore,
      wssv_probability: confidenceScore,
      risk_level: 'Medium',
      recommendation: 'Retake a clearer close-up photo before reporting WSSV. Keep monitoring the pond and check for visible white shell spots or sudden mortality.',
      source
    };
  }

  return {
    disease_name: 'No WSSV Detected',
    confidence_score: Math.round((1 - score) * 100),
    wssv_probability: confidenceScore,
    risk_level: 'Low',
    recommendation: RECOMMENDATIONS.Healthy,
    source
  };
}
