const path = require('path');
const fs = require('fs');

// Resolve tfjs, sharp, and mobilenet — try normal require first, then project-local node_modules
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
let mobilenet = null;
try {
  mobilenet = resolveModule('@tensorflow-models/mobilenet');
} catch (e) {
  mobilenet = null;
}

let loadedMobileNet = null;

async function getMobileNet() {
  if (!mobilenet) return null;
  if (loadedMobileNet) return loadedMobileNet;
  try {
    loadedMobileNet = await mobilenet.load({ version: 2, alpha: 1.0 });
    return loadedMobileNet;
  } catch (err) {
    return null;
  }
}

const NON_SHRIMP_KEYWORDS = [
  'person', 'man', 'woman', 'child', 'face', 'suit', 'jersey', 't-shirt', 'shirt',
  'dog', 'cat', 'car', 'computer', 'keyboard', 'screen', 'laptop', 'table', 'chair',
  'cup', 'mug', 'paper', 'envelope', 'book', 'clock', 'digital clock', 'spotlight',
  'building', 'house', 'shoe', 'boot', 'apple', 'banana', 'orange', 'pizza'
];

async function classifyImage(imagePath) {
  const model = await getMobileNet();
  if (!model) {
    return { is_shrimp: true, message: 'Classifier fallback.' };
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const resized = await sharp(imageBuffer)
    .resize(224, 224)
    .removeAlpha()
    .raw()
    .toBuffer();

  const tensor = tf.tensor3d(new Uint8Array(resized), [224, 224, 3], 'int32');
  const predictions = await model.classify(tensor);
  tensor.dispose();

  if (!predictions || predictions.length === 0) {
    return { is_shrimp: true };
  }

  const topClass = (predictions[0].className || '').toLowerCase();
  const topProb = predictions[0].probability || 0;

  const isNonShrimp = NON_SHRIMP_KEYWORDS.some((kw) => topClass.includes(kw));

  if (isNonShrimp && topProb > 0.25) {
    return {
      is_shrimp: false,
      top_class: predictions[0].className,
      probability: topProb,
      message: `No shrimp detected in uploaded image (Detected: ${predictions[0].className}).`,
    };
  }

  return {
    is_shrimp: true,
    top_class: predictions[0].className,
    probability: topProb,
  };
}

async function main() {
  const imageArg = process.argv[2];
  if (!imageArg) {
    console.log(JSON.stringify({ is_shrimp: true }));
    return;
  }

  try {
    const res = await classifyImage(imageArg);
    console.log(JSON.stringify(res));
  } catch (e) {
    console.log(JSON.stringify({ is_shrimp: true, error: e.message }));
  }
}

if (require.main === module) {
  main();
}
