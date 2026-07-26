const path = require('path');
const fs = require('fs');

// Resolve tfjs and sharp — try normal require first, then project-local node_modules
const projectNodeModules = path.resolve(__dirname, 'node_modules');
const resolveModule = (name) => {
  try {
    return require(name);
  } catch (err) {
    return require(require.resolve(name, { paths: [projectNodeModules] }));
  }
};

const tf = resolveModule('@tensorflow/tfjs');
const sharp = resolveModule('sharp');

const MODEL_DIR = path.resolve(__dirname, '../artifacts/desktop_shrimp');
const METADATA_PATH = path.join(MODEL_DIR, 'metadata.json');
const MODEL_JSON_PATH = path.join(MODEL_DIR, 'model.json');
const WEIGHTS_PATH = path.join(MODEL_DIR, 'weights.bin');

let loadedModel = null;
let labelDefinitions = ['Healthy', 'Black_Gill', 'White_Spot_Syndrome_Virus'];

function getCustomIOHandler() {
  return {
    async load() {
      const rawModelJson = fs.readFileSync(MODEL_JSON_PATH, 'utf8');
      const modelJson = JSON.parse(rawModelJson);
      const weightSpecs = [];
      for (const entry of modelJson.weightsManifest || []) {
        for (const w of entry.weights || []) {
          weightSpecs.push(w);
        }
      }
      const weightsBuffer = fs.readFileSync(WEIGHTS_PATH);
      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs,
        weightData: weightsBuffer.buffer,
      };
    },
  };
}

async function getModel() {
  if (loadedModel) return loadedModel;

  if (fs.existsSync(METADATA_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
      if (Array.isArray(meta.labels) && meta.labels.length > 0) {
        labelDefinitions = meta.labels;
      }
    } catch (e) {
      // Use defaults if metadata read fails
    }
  }

  loadedModel = await tf.loadLayersModel(getCustomIOHandler());
  return loadedModel;
}

const DISEASE_DETAILS = {
  Healthy: {
    prediction: 'Healthy Shrimp',
    status: 'Healthy',
    risk_level: 'Low',
    description: 'No disease symptoms detected. Shrimp appears healthy.',
    recommendation: 'Continue routine pond monitoring, balanced feeding, and water quality checks.',
  },
  Black_Gill: {
    prediction: 'Black Gill Disease',
    status: 'Diseased',
    risk_level: 'High',
    description: 'Black Gill Disease detected with high confidence. Gills show dark discoloration and damage.',
    recommendation: 'Isolate affected shrimp, inspect water quality (ammonia/nitrite levels), improve aeration, and adjust feeding.',
  },
  White_Spot_Syndrome_Virus: {
    prediction: 'White Spot Syndrome Virus (WSSV)',
    status: 'Diseased',
    risk_level: 'High',
    description: 'White Spot Syndrome Virus (WSSV) detected with high confidence. Distinct white spot lesions observed.',
    recommendation: 'Isolate infected shrimp immediately. Improve water quality, reduce stocking stress, and monitor remaining ponds closely.',
  },
  Shell_Disease: {
    prediction: 'Shell Disease',
    status: 'Diseased',
    risk_level: 'Medium',
    description: 'Shell Disease detected. Chitinoclastic shell lesions observed.',
    recommendation: 'Improve water quality, maintain proper mineral balance, and prevent physical handling injuries.',
  },
  Vibriosis: {
    prediction: 'Vibriosis',
    status: 'Diseased',
    risk_level: 'High',
    description: 'Vibriosis bacterial infection detected.',
    recommendation: 'Monitor bacterial loads, apply strict biosecurity protocols, and adjust feeding regimes.',
  },
};

async function predict(imagePath) {
  const model = await getModel();

  const imageBuffer = fs.readFileSync(imagePath);
  const resized = await sharp(imageBuffer)
    .resize(224, 224)
    .removeAlpha()
    .raw()
    .toBuffer();

  const imgTensor = tf.tensor3d(new Uint8Array(resized), [224, 224, 3], 'int32');

  // PREPROCESSING FIX: Teachable Machine / MobileNet normalization requires [-1.0, 1.0] range
  // Formula: (pixel / 127.5) - 1.0
  const normalized = imgTensor.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1.0));
  const batched = normalized.expandDims(0);

  const predictions = model.predict(batched);
  const data = await predictions.data();

  imgTensor.dispose();
  normalized.dispose();
  batched.dispose();
  predictions.dispose();

  const probsArray = Array.from(data);
  let bestIdx = 0;
  for (let i = 1; i < probsArray.length; i++) {
    if (probsArray[i] > probsArray[bestIdx]) bestIdx = i;
  }

  const rawLabel = labelDefinitions[bestIdx] || 'Healthy';
  const confidence = Math.round((probsArray[bestIdx] || 0) * 10000) / 100;

  const details = DISEASE_DETAILS[rawLabel] || {
    prediction: rawLabel.replace(/_/g, ' '),
    status: rawLabel.toLowerCase().includes('healthy') ? 'Healthy' : 'Diseased',
    risk_level: rawLabel.toLowerCase().includes('healthy') ? 'Low' : 'High',
    description: `${rawLabel.replace(/_/g, ' ')} detected with high confidence.`,
    recommendation: 'Monitor shrimp pond closely and consult an aquaculture specialist.',
  };

  const probabilitiesMap = {};
  labelDefinitions.forEach((lbl, idx) => {
    const formattedName = DISEASE_DETAILS[lbl]?.prediction || lbl.replace(/_/g, ' ');
    probabilitiesMap[formattedName] = Math.round((probsArray[idx] || 0) * 10000) / 100;
  });

  const debugLog = {
    loaded_model_name: 'tm-my-image-model',
    model_path: MODEL_JSON_PATH,
    preprocessing: 'MobileNet [-1.0, 1.0] range: (pixel / 127.5) - 1.0',
    predicted_class: details.prediction,
    confidence_percentage: confidence,
    raw_probabilities_array: probsArray,
    class_labels: labelDefinitions,
    probabilities_map: probabilitiesMap,
  };

  return {
    success: true,
    prediction: details.prediction,
    disease_name: details.prediction,
    confidence: confidence,
    confidence_score: confidence,
    status: details.status,
    risk_level: details.risk_level,
    model_used: 'Desktop/Shrimp Trained Model',
    description: details.description,
    recommendation: details.recommendation,
    probabilities: probabilitiesMap,
    raw_label: rawLabel,
    debug: debugLog,
  };
}

async function main() {
  const imageArg = process.argv[2];
  if (!imageArg) {
    console.error(JSON.stringify({ success: false, message: 'Image path required.' }));
    process.exit(1);
  }

  try {
    const result = await predict(imageArg);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(JSON.stringify({ success: false, message: err.message || String(err) }));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { predict };
