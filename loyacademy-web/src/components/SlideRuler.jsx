import { useRef, useCallback, useState } from 'react'
import styles from './SlideRuler.module.css'

/**
 * SlideRuler — horizontally sliding strip ruler.
 *
 * Each strip is a wide image that tiles (repeat-x) and is offset via
 * background-position-x as the user drags it left/right.
 *
 * Props:
 *   tool          — tool config (type:'slide', strips:[...])
 *   offsets       — { [stripId]: px }  current pixel offset per strip
 *   onSlide       — (stripId, px) => void
 *   stripOverrides — { [stripId]: { heightRatio } }  from Configurator
 *   debug         — { enabled, flags, calibration }
 */
export default function SlideRuler({ tool, offsets, onSlide, stripOverrides = {}, debug = {} }) {
  const containerRef = useRef(null)
  const dragState    = useRef({})
  const [loaded, setLoaded]   = useState({})  // { [id]: bool }
  const [errored, setErrored] = useState({})  // { [id]: bool }

  const startDrag = useCallback((stripId, e) => {
    e.preventDefault()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    dragState.current[stripId] = { startClientX: clientX, startOffset: offsets[stripId] ?? 0 }

    const onMove = (mv) => {
      const x = mv.touches ? mv.touches[0].clientX : mv.clientX
      const delta = x - dragState.current[stripId].startClientX
      onSlide(stripId, dragState.current[stripId].startOffset + delta)
    }
    const onEnd = () => {
      delete dragState.current[stripId]
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [offsets, onSlide])

  const strips = tool.strips ?? []
  const showDebug = debug.enabled

  return (
    <div ref={containerRef} className={styles.ruler}>

      {/* Fixed centre reference line (always shown) */}
      <div className={styles.refLine} />

      {strips.map((strip, i) => {
        const offset    = offsets[strip.id] ?? 0
        const imgSrc    = `/assets/${tool.id}/${strip.id}.png`
        const hRatio    = stripOverrides[strip.id]?.heightRatio ?? strip.heightRatio ?? 1
        const cal       = debug.calibration?.[strip.id] ?? {}
        const unitsPerPx = cal.unitsPerPx ?? strip.unitsPerPx ?? 1
        const zeroOffset = cal.zeroOffset ?? strip.zeroOffset ?? 0
        const value      = (offset - zeroOffset) * unitsPerPx

        const isLoaded  = loaded[strip.id]
        const isErrored = errored[strip.id]

        return (
          <div
            key={strip.id}
            className={styles.stripWrapper}
            style={{ flex: hRatio }}
            onMouseDown={e => startDrag(strip.id, e)}
            onTouchStart={e => startDrag(strip.id, e)}
          >
            {/* The strip image tiled via background */}
            <div
              className={styles.strip}
              style={{
                backgroundImage: isLoaded && !isErrored ? `url(${imgSrc})` : 'none',
                backgroundPositionX: `${offset}px`,
                cursor: 'grab',
              }}
            />

            {/* Hidden img used only to trigger load/error events */}
            <img
              src={imgSrc}
              style={{ display: 'none' }}
              onLoad={() => setLoaded(p => ({ ...p, [strip.id]: true }))}
              onError={() => setErrored(p => ({ ...p, [strip.id]: true }))}
              alt=""
            />

            {/* Strip label on the left edge */}
            <div className={styles.stripLabel}>{strip.label}</div>

            {/* Placeholder when image not ready */}
            {(!isLoaded || isErrored) && (
              <div className={styles.stripPlaceholder}>
                {strip.label} — awaiting <code>{strip.id}.png</code>
              </div>
            )}

            {/* Debug overlay for this strip */}
            {showDebug && (
              <div className={styles.debugLayer}>
                {/* Centre tick */}
                {debug.flags?.ticks !== false && (
                  <div className={styles.dbgCentreTick} />
                )}
                {/* Displacement readout — always shown in debug mode */}
                <div className={styles.dbgReadout}>
                  <strong>{offset.toFixed(1)}px</strong>
                  {debug.flags?.readout !== false && (
                    <> → {isFinite(value) ? value.toFixed(3) : '∞'}</>
                  )}
                </div>
                {/* Grid lines at regular pixel intervals */}
                {debug.flags?.grid && (
                  <GridLines offset={offset} unitsPerPx={unitsPerPx} />
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Bottom label row */}
      <div className={styles.footer}>
        <span>← drag strips left/right →</span>
        <span className={styles.refLabel}>▲ reference</span>
        <span />
      </div>
    </div>
  )
}

/** Render vertical grid lines spaced by 1/unitsPerPx pixels, repeating across the strip */
function GridLines({ offset, unitsPerPx }) {
  if (!unitsPerPx || unitsPerPx <= 0) return null
  const spacing = Math.abs(1 / unitsPerPx)  // px per unit
  if (spacing < 4 || spacing > 500) return null  // too dense or too sparse

  const lines = []
  // Generate enough lines to fill a 2000px viewport
  const viewW = 2000
  const phase = ((offset % spacing) + spacing) % spacing
  for (let x = phase; x < viewW; x += spacing) {
    lines.push(
      <div key={x} className={styles.dbgGridLine} style={{ left: `${x}px` }} />
    )
  }
  return <>{lines}</>
}
