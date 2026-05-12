/**
 * BMI₂ circular slide ruler.
 *
 * Formula: BMI₂ = k · weight / (height/100)^2.5
 *   k = 1.28  unisex default
 *   k = 1.24  male
 *   k = 1.32  female
 *
 * Height scale on moving disc: logarithmic, 95–205 cm spans exactly 360°.
 * The disc rotates CLOCKWISE as height increases (angle decreases).
 * Weight scale on static background: read manually and entered as input.
 *
 * ── Height scale calibration (12-point log fit, RMS 0.18°) ─────────────────
 * Fit:  angle = 1930.44 − 468.11 × ln(height)
 *       span 95→205 = −360.04° ≈ −360° ✓  (disc rotates clockwise)
 *
 * BOUNDARY_ROTATION = −201.26°  →  disc angle when height=95 is at the pointer
 *   (height=95 and height=205 share the same physical mark)
 *
 * Pointer positions (reference line for each k):
 *   male   (k=1.24): −265.4°
 *   unisex (k=1.28): −271.3°
 *   female (k=1.32): −277.5°
 *
 * Height calibration data (cm → disc angle °):
 *   95→−201.5  100→−225.3  110→−269.7  130→−348.1  135→−365.8
 *   145→−398.8  155→−430.6  165→−459.5  175→−487.2
 *   185→−513.4  195→−537.8  205→−561.5
 *
 * ── Weight scale calibration (15-point log fit, RMS 0.14°) ──────────────────
 * Fit:  angle = −692.89 + 187.24 × ln(weight)
 *       187.24 deg/ln-unit  ≡  360 / ln(115/16.8)  (scale: 16.8→115 kg per circle)
 *
 * Weight calibration data (kg → background angle °):
 *   40→−2.2  45→20.0  50→39.5  55→57.4  60→73.8  65→88.9  70→102.4
 *   75→115.7  80→127.3  85→138.8  90→149.6  95→160.0
 *   100→169.4  105→178.5  110→187.3
 *
 * ── Turning angle ────────────────────────────────────────────────────────────
 * The BMI₂ output scale on the disc uses the same 187.24 deg/ln-unit spacing.
 * turning_angle = 187.24 × ln(25 / BMI₂)
 *   = angular distance on the output scale from the "normal" (BMI₂=25) mark
 *     to the current reading.  Positive = below normal, negative = above.
 */

const LOG_MIN              = Math.log(95)
const LOG_RANGE            = Math.log(205) - Math.log(95)  // ln(205/95) ≈ 0.7691
const BOUNDARY_ROTATION    = -201.26  // disc angle (°) where height=95 is at the pointer
const WEIGHT_A             = -692.89  // weight scale offset  (angle = A + B·ln(w))
const WEIGHT_B             =  187.24  // weight/BMI2 scale degrees per ln-unit
const BMI2_A               = -603.88  // BMI2 output scale offset (angle = A + B·ln(bmi2))
// BMI2 output scale B ≈ 187.18 ≈ WEIGHT_B — same log spacing

// Height disc: rotates clockwise → angle DECREASES as height increases.
// fraction runs 0→1 as height runs 95→205.

function rotationToHeight(angleDeg) {
  const fraction = ((BOUNDARY_ROTATION - angleDeg) % 360 + 360) % 360 / 360
  return Math.exp(LOG_MIN + fraction * LOG_RANGE)        // = 95 × (205/95)^fraction
}

function heightToRotation(height) {
  const clamped  = Math.max(95, Math.min(205, height))
  const fraction = (Math.log(clamped) - LOG_MIN) / LOG_RANGE
  return BOUNDARY_ROTATION - fraction * 360
}

// Weight mark angular position on the static background.
function weightToAngle(weight) {
  return WEIGHT_A + WEIGHT_B * Math.log(Math.max(1, weight))
}

export default {
  id: 'bmi',
  title: 'BMI₂ Calculator',
  description: 'BMI₂ = k · weight / height^2.5 — rotate disc to align height, read weight from static ring.',
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
      // When disc is at angleDeg, the height mark aligned with the weight mark is:
      //   rotationToHeight(angleDeg - weightMarkAngle)
      // because: alpha_H + R = phi_W  →  H = rotationToHeight(R - phi_W)
      rotationToValues: (angleDeg, cur) => {
        const phi = weightToAngle(cur?.weight ?? 65)
        return { height: rotationToHeight(angleDeg - phi) }
      },
      // To align height H with weight W, disc must be at:
      //   R = heightToRotation(H) + weightToAngle(W)
      valuesToRotation: (values) => (
        heightToRotation(values.height ?? 170) + weightToAngle(values.weight ?? 65)
      ),
    },
  ],

  inputs: [
    { id: 'weight', label: 'Weight', unit: 'kg', min: 20,  max: 250, step: 0.5, defaultValue: 65  },
    { id: 'height', label: 'Height', unit: 'cm', min: 95,  max: 205, step: 0.5, defaultValue: 170 },
    {
      id: 'k',
      label: 'Gender',
      type: 'select',
      defaultValue: 1.28,
      options: [
        { label: 'Male',   value: 1.24 },
        { label: 'Unisex', value: 1.28 },
        { label: 'Female', value: 1.32 },
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
      label: '% extra weight',
      unit: '%',
      decimals: 2,
    },
    {
      id: 'rangeWarning',
      label: 'Range',
    },
  ],

  calculate: ({ weight, height, k = 1.28 }) => {
    if (!weight || !height || height === 0) return { bmi2: null, pctExtraWeight: null, rangeWarning: null }
    const bmi2 = k * weight / Math.pow(height / 100, 2.5)
    const pctExtraWeight = (bmi2 / 20 - 1) * 100

    const warnings = []
    if (weight < 45 || weight > 115) warnings.push(`weight outside 45–115 kg`)
    if (height < 95 || height > 205) warnings.push(`height outside 95–205 cm`)
    if (bmi2 < 17  || bmi2  > 40)   warnings.push(`BMI₂ outside 17–40`)
    const rangeWarning = warnings.length === 0 ? 'In range' : 'Out of range: ' + warnings.join(', ')

    return { bmi2, pctExtraWeight, rangeWarning }
  },

  notes: 'Scale ranges: weight 45–115 kg, height 95–205 cm, BMI₂ 17–40.',
}
