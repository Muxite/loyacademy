/**
 * Lunar Calendar (Thai) circular slide ruler tool config.
 * Same as lunar_en but in Thai language context.
 * PLACEHOLDER calibration — update after visually aligning with the printed ruler.
 */
export default {
  id: 'lunar_th',
  title: 'ปฏิทินจันทรคติ',
  description: 'แปลงวันที่ระหว่างปฏิทินสุริยคติและจันทรคติ',
  lang: 'TH',
  icon: '🌙',
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
        const degreesPerDay = 360 / 365.25  // PLACEHOLDER
        const dayOfYear = Math.round((angleDeg - zeroAngle) / degreesPerDay)
        return { dayOfYear: ((dayOfYear % 365) + 365) % 365 }
      },
      valuesToRotation: (values) => {
        const zeroAngle = 0
        const degreesPerDay = 360 / 365.25  // PLACEHOLDER
        return zeroAngle + (values.dayOfYear ?? 0) * degreesPerDay
      },
    },
    {
      id: 'disc_inner',
      centerX: 0.5,
      centerY: 0.5,
      sizeRatio: 0.6,
      zIndex: 11,
      rotationToValues: (angleDeg) => {
        const degreesPerLunarDay = 360 / 29.53  // PLACEHOLDER
        const lunarDay = Math.round(angleDeg / degreesPerLunarDay)
        return { lunarDay: ((lunarDay % 30) + 30) % 30 }
      },
      valuesToRotation: (values) => {
        const degreesPerLunarDay = 360 / 29.53  // PLACEHOLDER
        return (values.lunarDay ?? 0) * degreesPerLunarDay
      },
    },
  ],

  inputs: [
    { id: 'dayOfYear', label: 'วันในปี', min: 1, max: 365, step: 1, defaultValue: 1 },
    { id: 'lunarDay', label: 'วันจันทร์', min: 1, max: 30, step: 1, defaultValue: 1 },
  ],

  outputs: [
    { id: 'dayOfYear', label: 'วันสุริยคติ', decimals: 0 },
    { id: 'lunarDay', label: 'วันจันทรคติ', decimals: 0 },
  ],

  calculate: (inputs) => inputs,

  notes: 'รอการปรับเทียบ — ปรับค่า degreesPerDay ใน lunar_th.js หลังจากเทียบกับไม้บรรทัดที่พิมพ์',
}
