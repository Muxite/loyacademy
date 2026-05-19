/**
 * BMI₂ circular slide ruler.
 *
 * Formula: BMI₂ = k · weight / (height/100)^2.5
 *   k = 1.28  unisex default
 *   k = 1.24  male
 *   k = 1.32  female
 *
 * Disc mechanics: height is FIXED; turning the disc changes WEIGHT.
 *
 * ── Angle formulas (all log10) ───────────────────────────────────────────────
 * heightAngle(h) = 360 × (log10(110) − log10(h))  / (log10(205) − log10(95))
 * weightAngle(w) = 360 × (log10(25)  − log10(w))  / (log10(115) − log10(16.8))
 * bmi2Angle(b)   = 360 × (log10(25)  − log10(b))  / (log10(115) − log10(16.8))
 *
 * valuesToRotation:  R = weightAngle(w) − heightAngle(h)
 * rotationToWeight:  effAngle = heightAngle(h) + R
 *                    w = 25 × 10^(−effAngle × (log10(115)−log10(16.8)) / 360)
 *
 * WHiR = waist / height
 * WHiR turning angle (clockwise) = (log10(WHiR)−log10(0.45)) / (log10(1.40)−log10(0.40)) × 360
 *
 * Waist Score (unisex) = (waist / height) × 100 / 0.45
 * Waist Score (men)    = unisex × 0.95
 * Waist Score (women)  = unisex × 1.05
 */

const L10 = Math.log10

const H_REF    = 110    // height where heightAngle = 0
const H_MIN    = 95
const H_MAX    = 205
const W_MIN    = 16.8
const W_MAX    = 115
const W_REF    = 25     // weight where weightAngle = 0

const WEIGHT_LOG_RANGE = L10(W_MAX) - L10(W_MIN)   // log10(115/16.8)

function heightAngle(h) {
  return 360 * (L10(H_REF) - L10(h)) / (L10(H_MAX) - L10(H_MIN))
}

function weightAngle(w) {
  return 360 * (L10(W_REF) - L10(w)) / WEIGHT_LOG_RANGE
}

function angleToWeight(angle) {
  return W_REF * Math.pow(10, -angle * WEIGHT_LOG_RANGE / 360)
}

const K_MALE   = 1.24
const K_FEMALE = 1.32

export default {
  id: 'bmi',
  title: 'BMI₂ Calculator',
  description: 'BMI₂ = k · weight / height^2.5 — rotate disc to align height, weight varies.',
  lang: 'EN',
  icon: '⚖️',
  aspectRatio: '1 / 1',

  discs: [
    {
      id: 'disc_outer',
      centerX: 0.5,
      centerY: 0.5,
      sizeRatio: 0.9,
      zIndex: 10,
      // Disc turned → height stays fixed, derive weight
      rotationToValues: (angleDeg, cur) => {
        const h = cur?.height ?? 170
        const effAngle = heightAngle(h) + angleDeg
        const w = angleToWeight(effAngle)
        const clamped = Math.min(W_MAX, Math.max(W_MIN, w))
        return { weight: Math.round(clamped * 2) / 2 }
      },
      // Move disc to align current weight with fixed height
      valuesToRotation: (values) =>
        weightAngle(values.weight ?? 65) - heightAngle(values.height ?? 170),
    },
  ],

  inputs: [
    { id: 'weight', label: 'Weight', unit: 'kg', min: 20,  max: 250, step: 0.5, defaultValue: 65  },
    { id: 'height', label: 'Height', unit: 'cm', min: 95,  max: 205, step: 0.5, defaultValue: 170 },
    { id: 'waist',  label: 'Waist',  unit: 'cm', min: 40,  max: 200, step: 0.5, defaultValue: 80  },
    {
      id: 'k',
      label: 'Gender / k',
      type: 'select-number',
      defaultValue: 1.28,
      min: 0.5,
      max: 3,
      step: 0.01,
      options: [
        { label: 'Male',   value: K_MALE   },
        { label: 'Unisex', value: 1.28     },
        { label: 'Female', value: K_FEMALE },
      ],
    },
  ],

  outputs: [
    {
      id: 'bmi2',
      label: 'BMI₂',
      decimals: 1,
      interpret: (val) => {
        if (val < 18.5) return 'Underweight'
        if (val < 25)   return 'Normal'
        if (val < 30)   return 'Overweight'
        if (val < 35)   return 'Obese I'
        if (val < 40)   return 'Obese II'
        return 'Obese III'
      },
    },
    {
      id: 'pctExtraWeight',
      label: '% extra fat/muscle',
      unit: '%',
      decimals: 2,
    },
    {
      id: 'whir',
      label: 'WHiR',
      decimals: 3,
      interpret: (val) => {
        if (val < 0.43) return 'Slim'
        if (val < 0.53) return 'Healthy'
        if (val < 0.58) return 'Overweight'
        if (val < 0.63) return 'Obese'
        return 'Highly obese'
      },
    },
    {
      id: 'waistScore',
      label: 'Waist Score',
      decimals: 1,
    },
    {
      id: 'rangeWarning',
      label: 'Range',
    },
  ],

  calculate: ({ weight, height, waist, k = 1.28 }) => {
    if (!weight || !height || height === 0) {
      return { bmi2: null, pctExtraWeight: null, whir: null, waistScore: null, rangeWarning: null }
    }

    const bmi2 = k * weight / Math.pow(height / 100, 2.5)
    const pctExtraWeight = (bmi2 / 20 - 1) * 100

    const whir = waist ? waist / height : null
    const waistScoreUnisex = waist ? (waist / height) * 100 / 0.45 : null
    const waistScore = waistScoreUnisex === null ? null
      : k === K_FEMALE ? waistScoreUnisex * 1.05
      : k === K_MALE   ? waistScoreUnisex * 0.95
      : waistScoreUnisex

    const warnings = []
    if (weight < 45 || weight > 115) warnings.push('weight outside 45–115 kg')
    if (height < 95 || height > 205) warnings.push('height outside 95–205 cm')
    if (bmi2 < 17  || bmi2  > 40)   warnings.push('BMI₂ outside 17–40')
    if (waist && (waist < 40 || waist > 200)) warnings.push('waist outside 40–200 cm')
    if (whir  && (whir  < 0.4 || whir  > 1.4)) warnings.push('WHiR outside 0.40–1.40')
    const rangeWarning = warnings.length === 0 ? 'In range' : 'Out of range: ' + warnings.join(', ')

    return { bmi2, pctExtraWeight, whir, waistScore, rangeWarning }
  },

  // Two indicator dots meet when disc is correctly aligned (weight matches height).
  indicators: (values, rotations) => {
    const weight = values?.weight ?? 65
    const height = values?.height ?? 170
    const R = rotations?.disc_outer ?? 0
    return [
      {
        discId: 'disc_outer',
        worldAngleDeg: weightAngle(weight),                 // weight mark — fixed world position
        radiusFraction: 0.87,
        color: 'rgba(220,30,30,0.9)',
        size: 2.5,
        ring: true,
      },
      {
        discId: 'disc_outer',
        worldAngleDeg: R - heightAngle(height),             // height mark — moves with disc
        radiusFraction: 0.87,
        color: 'rgba(220,30,30,0.9)',
        size: 2.5,
        ring: true,
      },
    ]
  },

  notes: 'Scale ranges: weight 16.8–115 kg, height 95–205 cm, BMI₂ 17–40, waist 40–200 cm.',
}
