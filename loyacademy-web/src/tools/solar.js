/**
 * Solar Eternality circular slide ruler tool config.
 * Used to calculate solar calendar conversions or sun-related dates.
 * PLACEHOLDER calibration — update after inspecting the PDF and visually aligning.
 */
export default {
  id: 'solar',
  title: 'Solar Eternality',
  description: 'Solar calendar calculations and eternality date system.',
  lang: 'EN',
  icon: '☀️',
  aspectRatio: '1 / 1',

  discs: [
    {
      id: 'disc_outer',
      centerX: 0.5,
      centerY: 0.5,
      sizeRatio: 0.9,
      zIndex: 10,
      rotationToValues: (angleDeg) => {
        // PLACEHOLDER
        return { year: Math.round(angleDeg) }
      },
      valuesToRotation: (values) => {
        return values.year ?? 0  // PLACEHOLDER
      },
    },
    {
      id: 'disc_inner',
      centerX: 0.5,
      centerY: 0.5,
      sizeRatio: 0.6,
      zIndex: 11,
      rotationToValues: (angleDeg) => {
        return { month: Math.round(angleDeg / 30) % 12 }  // PLACEHOLDER
      },
      valuesToRotation: (values) => {
        return (values.month ?? 0) * 30  // PLACEHOLDER
      },
    },
  ],

  inputs: [
    { id: 'year', label: 'Year (BE)', min: 2500, max: 2600, step: 1, defaultValue: 2568 },
    { id: 'month', label: 'Month', min: 1, max: 12, step: 1, defaultValue: 1 },
    { id: 'day', label: 'Day', min: 1, max: 31, step: 1, defaultValue: 1 },
  ],

  outputs: [
    { id: 'solarResult', label: 'Solar Result', decimals: 0 },
  ],

  calculate: (inputs) => {
    // PLACEHOLDER: real formula depends on the PDF's calculation system
    return { solarResult: inputs.year * 12 + inputs.month }
  },

  notes: 'Calibration pending. Inspect SolarEternality1.1.pdf to determine the exact calculation and fill in formulas.',
}
