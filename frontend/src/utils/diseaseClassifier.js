const DISEASE_KEYWORDS = {
  'White Spot Syndrome': [
    'white spot',
    'white spots',
    'white patch',
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
  'White Spot Syndrome': 'Isolate the pond immediately, increase water quality checks, and consult a veterinarian for treatment.',
  'Black Gill Disease': 'Improve filtration and water quality, and monitor gill health closely for the next 48 hours.',
  'Vibriosis': 'Reduce stress, improve sanitation, and review feed and water parameters with a specialist.',
  'Healthy': 'No disease signs detected; continue standard monitoring and feeding schedules.'
};

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

  const topDisease = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const diseaseName = topDisease?.[0] || 'White Spot Syndrome';
  const confidenceScore = Math.min(96, 58 + (topDisease?.[1] || 0) * 12);
  const riskLevel = diseaseName === 'White Spot Syndrome' || diseaseName === 'Vibriosis' ? 'High' : diseaseName === 'Black Gill Disease' ? 'Medium' : 'Low';

  return {
    disease_name: diseaseName,
    confidence_score: `${Math.round(confidenceScore)}%`,
    risk_level: riskLevel,
    recommendation: RECOMMENDATIONS[diseaseName] || RECOMMENDATIONS['White Spot Syndrome'],
    source: 'heuristic-image-signs'
  };
}
