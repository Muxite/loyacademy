/**
 * ปฏิทินล้านปี Gregorian & Julian — 4 horizontal sliding strip ruler.
 *
 * type: 'slide' tells ToolPage to render SlideRuler instead of CircleRuler.
 *
 * Each strip:
 *   heightRatio  — relative flex height (strips are stacked vertically)
 *   unitsPerPx   — PLACEHOLDER: calibrate by sliding to a known value and
 *                  noting how many pixels it moved in the debug readout
 *   zeroOffset   — PLACEHOLDER: px offset where the reference arrow = value 0
 *
 * Strip period info (from the PDF image at 400dpi, 4678px wide):
 *   The number strips repeat roughly every ~520px (10 digits × ~52px/digit).
 *   Calibrate by dragging 10 full positions and noting the pixel delta.
 */
export default {
  id: 'pin_calendar',
  title: 'ปฏิทินล้านปี',
  description: 'ปฏิทิน Gregorian & Julian — เลื่อนแถบซ้าย/ขวาเพื่ออ่านวันที่',
  lang: 'TH/EN',
  icon: '📌',
  type: 'slide',     // ← tells ToolPage to use SlideRuler

  strips: [
    {
      id: 'strip_julian',
      label: 'Julian +7',
      heightRatio: 1,
      unitsPerPx: 1,    // PLACEHOLDER — units per pixel of travel
      zeroOffset: 0,    // PLACEHOLDER — px offset for value = 0
    },
    {
      id: 'strip_gregorian',
      label: 'Gregorian +4',
      heightRatio: 1,
      unitsPerPx: 1,    // PLACEHOLDER
      zeroOffset: 0,    // PLACEHOLDER
    },
    {
      id: 'strip_month_en',
      label: 'Month (EN)',
      heightRatio: 1.4,
      unitsPerPx: 1,    // PLACEHOLDER
      zeroOffset: 0,    // PLACEHOLDER
    },
    {
      id: 'strip_day_en',
      label: 'Day of Week (EN)',
      heightRatio: 2.9,
      unitsPerPx: 1,    // PLACEHOLDER
      zeroOffset: 0,    // PLACEHOLDER
    },
  ],

  // Numeric panel inputs — user types a Gregorian date, strips jump to position
  inputs: [
    { id: 'year',  label: 'Year (CE)',    min: 1752, max: 9999, step: 1,  defaultValue: 2025 },
    { id: 'month', label: 'Month',        min: 1,    max: 12,   step: 1,  defaultValue: 1 },
    { id: 'day',   label: 'Day',          min: 1,    max: 31,   step: 1,  defaultValue: 1 },
  ],

  outputs: [
    { id: 'dayOfWeek', label: 'Day of Week', decimals: 0 },
  ],

  // Calculate day of week from Gregorian date (Zeller's congruence)
  calculate: (inputs) => {
    const { year, month, day } = inputs
    if (!year || !month || !day) return { dayOfWeek: null }
    let m = month, y = year
    if (m < 3) { m += 12; y -= 1 }
    const k = y % 100, j = Math.floor(y / 100)
    const h = (day + Math.floor(13*(m+1)/5) + k + Math.floor(k/4) + Math.floor(j/4) - 2*j) % 7
    // h: 0=Sat,1=Sun,2=Mon,...,6=Fri
    const names = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri']
    return { dayOfWeek: ((h % 7) + 7) % 7, dayName: names[((h % 7) + 7) % 7] }
  },

  // Offsets from numeric values — PLACEHOLDER until calibration coefficients are filled in
  stripFromValues: (inputs, stripId) => {
    // Once unitsPerPx and zeroOffset are calibrated, implement proper inverse here
    return null  // null means don't auto-position this strip from numeric input
  },

  notes: 'เลื่อนแต่ละแถบอิสระ จนลูกศรอ้างอิงสีเหลืองชี้ตรงค่าที่ต้องการ — ปรับ unitsPerPx / zeroOffset ใน Configurator → Export',
}
