/**
 * WHtR (Waist-to-Height Ratio) circular slide ruler tool config.
 * PLACEHOLDER calibration — update after visually aligning with the printed ruler.
 */
export default {
  id: 'whtr',
  title: 'WHtR Calculator',
  description: 'Waist-to-Height Ratio — a simple metabolic risk indicator.',
  lang: 'EN',
  icon: '📏',
  aspectRatio: '1 / 1',

  discs: [
    {
      id: 'disc_outer',
      centerX: 0.5,
      centerY: 0.5,
      sizeRatio: 0.9,
      zIndex: 10,
      rotationToValues: (angleDeg) => {
        const zeroAngle = 0
        const degreesPerCm = 1  // PLACEHOLDER
        const waist = (angleDeg - zeroAngle) / degreesPerCm
        return { waist: Math.max(1, waist) }
      },
      valuesToRotation: (values) => {
        const zeroAngle = 0
        const degreesPerCm = 1  // PLACEHOLDER
        return zeroAngle + (values.waist ?? 80) * degreesPerCm
      },
    },
  ],

  inputs: [
    { id: 'waist', label: 'Waist', unit: 'cm', min: 40, max: 200, step: 0.5, defaultValue: 80 },
    { id: 'height', label: 'Height', unit: 'cm', min: 100, max: 250, step: 1, defaultValue: 170 },
  ],

  outputs: [
    {
      id: 'whtr',
      label: 'WHtR',
      decimals: 3,
      interpret: (val) => {
        if (val < 0.4)  return 'Slim'
        if (val < 0.5)  return 'Healthy'
        if (val < 0.6)  return 'Overweight'
        return 'Obese'
      },
    },
  ],

  calculate: (inputs) => {
    const { waist, height } = inputs
    if (!waist || !height || height === 0) return { whtr: null }
    return { whtr: waist / height }
  },

  notes: 'Calibration pending. Adjust degreesPerCm in whtr.js after visually aligning with the printed ruler.',
}
