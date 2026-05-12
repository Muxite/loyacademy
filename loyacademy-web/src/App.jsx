import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import ToolPage from './pages/ToolPage.jsx'
import bmi from './tools/bmi.js'
import whtr from './tools/whtr.js'
import lunarEn from './tools/lunar_en.js'
import lunarTh from './tools/lunar_th.js'
import solar from './tools/solar.js'
import athikamas from './tools/athikamas.js'
import pinCalendar from './tools/pin_calendar.js'

const tools = [bmi, whtr, lunarEn, lunarTh, solar, athikamas, pinCalendar]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home tools={tools} />} />
      {tools.map(tool => (
        <Route
          key={tool.id}
          path={`/${tool.id}`}
          element={<ToolPage tool={tool} />}
        />
      ))}
    </Routes>
  )
}
