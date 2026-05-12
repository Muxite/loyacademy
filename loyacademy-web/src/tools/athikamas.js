/**
 * Athikamas (Thai leap month) circular slide ruler tool config.
 * Athikamas = the intercalary month in the Thai lunar calendar.
 * PLACEHOLDER calibration — update after inspecting the PDF.
 */
export default {
  id: 'athikamas',
  title: 'อธิกมาส',
  description: 'คำนวณอธิกมาสและอธิกวาร ในปฏิทินจันทรคติไทย',
  lang: 'TH',
  icon: '📅',
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
        const yearCycle = ((angleDeg % 360) + 360) % 360
        return { cycleAngle: yearCycle }
      },
      valuesToRotation: (values) => {
        return values.cycleAngle ?? 0  // PLACEHOLDER
      },
    },
  ],

  inputs: [
    { id: 'beYear', label: 'พ.ศ.', min: 2500, max: 2700, step: 1, defaultValue: 2568 },
  ],

  outputs: [
    { id: 'isAthikamas', label: 'อธิกมาส', decimals: 0 },
    { id: 'isAthikawat', label: 'อธิกวาร', decimals: 0 },
  ],

  calculate: (inputs) => {
    const { beYear } = inputs
    // PLACEHOLDER: Thai lunar leap rules (simplified)
    // Real calculation derived from the PDF coefficients
    const remainder = beYear % 19
    const isAthikamas = [2, 5, 7, 10, 13, 16, 18].includes(remainder) ? 1 : 0
    const isAthikawat = beYear % 4 === 0 ? 1 : 0
    return { isAthikamas, isAthikawat }
  },

  notes: 'การปรับเทียบยังไม่เสร็จสมบูรณ์ กรุณาตรวจสอบไฟล์ PDF เพื่อดูสูตรที่ถูกต้อง',
}
