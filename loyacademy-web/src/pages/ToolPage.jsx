import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import CircleRuler from '../components/CircleRuler.jsx'
import SlideRuler from '../components/SlideRuler.jsx'
import NumericPanel from '../components/NumericPanel.jsx'
import Configurator from '../components/Configurator.jsx'
import styles from './ToolPage.module.css'

const DEFAULT_DEBUG_FLAGS = {
  grid: true, crosshair: true, ring: true, pointer: true,
  zeroRef: true, ticks: true, valueLabels: true, readout: true,
}

export default function ToolPage({ tool }) {
  const isSlide = tool.type === 'slide'

  // ── Circle ruler state ────────────────────────────────────────────────────
  const [rotations, setRotations] = useState(() =>
    Object.fromEntries((tool.discs ?? []).map(d => [d.id, 0]))
  )

  // ── Slide ruler state ─────────────────────────────────────────────────────
  const [offsets, setOffsets] = useState(() =>
    Object.fromEntries((tool.strips ?? []).map(s => [s.id, 0]))
  )

  // ── Shared numeric inputs ─────────────────────────────────────────────────
  const [numerics, setNumerics] = useState(() => {
    const init = {}
    ;(tool.inputs ?? []).forEach(inp => { init[inp.id] = inp.defaultValue ?? inp.min ?? 0 })
    return init
  })

  // ── Configurator overrides ────────────────────────────────────────────────
  const [configState, setConfigState] = useState({
    discOverrides: {},  // circle: { [discId]: { centerX, centerY, sizeRatio } }
    stripOverrides: {}, // slide:  { [stripId]: { heightRatio } }
    calibration: {},    // both:   { [id]: { ...coefficients } }
    pdfCrop: {},        // { [id]: { x, y, w, h } or { cx, cy, r } }
    debug: { enabled: false, flags: DEFAULT_DEBUG_FLAGS },
  })

  // ── Circle ruler handlers ─────────────────────────────────────────────────
  const effectiveDiscs = (tool.discs ?? []).map(disc => {
    const cal = configState.calibration[disc.id]
    if (!cal) return disc
    return {
      ...disc,
      rotationToValues: disc.rotationToValues
        ? (a, cur) => disc.rotationToValues(a, cur)
        : () => ({}),
      valuesToRotation: disc.valuesToRotation
        ? (v) => disc.valuesToRotation(v)
        : () => cal.zeroAngle ?? 0,
    }
  })

  const handleDiscRotate = useCallback((discId, angleDeg) => {
    setRotations(prev => ({ ...prev, [discId]: angleDeg }))
    const disc = effectiveDiscs.find(d => d.id === discId)
    if (disc?.rotationToValues) {
      const derived = disc.rotationToValues(angleDeg, numerics)
      setNumerics(prev => ({ ...prev, ...derived }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, numerics, configState])

  const handleNumericChange = useCallback((values) => {
    setNumerics(values)
    effectiveDiscs.forEach(disc => {
      if (disc.valuesToRotation) {
        setRotations(prev => ({ ...prev, [disc.id]: disc.valuesToRotation(values) }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, configState])

  // ── Slide ruler handlers ──────────────────────────────────────────────────
  const handleSlide = useCallback((stripId, px) => {
    setOffsets(prev => ({ ...prev, [stripId]: px }))
  }, [])

  const handleSlideNumericChange = useCallback((values) => {
    setNumerics(values)
    if (tool.stripFromValues) {
      ;(tool.strips ?? []).forEach(strip => {
        const px = tool.stripFromValues(values, strip.id)
        if (px !== null && px !== undefined) {
          setOffsets(prev => ({ ...prev, [strip.id]: px }))
        }
      })
    }
  }, [tool])

  // ── Outputs ───────────────────────────────────────────────────────────────
  const outputs = tool.calculate ? tool.calculate(numerics) : {}

  // ── Configurator state needs strip awareness for slide tools ──────────────
  const configuratorCalibration = configState.calibration

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.back}>← All Tools</Link>
        <span className={styles.lang}>{tool.lang || 'EN'}</span>
      </nav>

      <header className={styles.header}>
        <h1>{tool.title}</h1>
        {tool.description && <p className={styles.desc}>{tool.description}</p>}
      </header>

      <div className={isSlide ? styles.layoutSlide : styles.layout}>
        <section className={isSlide ? styles.rulerSectionSlide : styles.rulerSection}>
          {isSlide ? (
            <SlideRuler
              tool={tool}
              offsets={offsets}
              onSlide={handleSlide}
              stripOverrides={configState.stripOverrides}
              debug={{ ...configState.debug, calibration: configuratorCalibration }}
            />
          ) : (
            <CircleRuler
              tool={tool}
              rotations={rotations}
              onRotate={handleDiscRotate}
              discOverrides={configState.discOverrides}
              debug={{ ...configState.debug, calibration: configuratorCalibration }}
              values={numerics}
            />
          )}
        </section>

        <aside className={styles.panel}>
          <NumericPanel
            tool={tool}
            values={numerics}
            outputs={outputs}
            onChange={isSlide ? handleSlideNumericChange : handleNumericChange}
          />
        </aside>
      </div>

      <Configurator
        tool={tool}
        discOverrides={configState.discOverrides}
        stripOverrides={configState.stripOverrides}
        calibration={configState.calibration}
        pdfCrop={configState.pdfCrop}
        debug={configState.debug}
        currentRotations={rotations}
        currentOffsets={offsets}
        onChange={setConfigState}
      />
    </div>
  )
}
