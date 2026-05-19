import { useRef, useCallback, useState } from 'react'
import styles from './CircleRuler.module.css'

/** Apply a calibration config to map an angle (degrees) or px offset → a numeric value.
 *  x  = angle in degrees (circle) or pixel offset (slide)
 *  All modes share the same parameter names: a, b, c, n, offset, scale, zeroAngle, degreesPerUnit
 */
export function applyCalibration(x, cal) {
  if (!cal) return x
  const { mode = 'linear', zeroAngle = 0, degreesPerUnit = 1,
          a = 1, b = 0, c = 0, n = 1, offset = 0, scale = 1,
          degreesPerDecade = 360, expr = '' } = cal
  switch (mode) {
    // ── Linear / affine ────────────────────────────────────────────────────
    case 'linear':      return (x - zeroAngle) / degreesPerUnit
    case 'affine':      return a * x + b

    // ── Polynomial ─────────────────────────────────────────────────────────
    case 'polynomial':  return a * x * x + b * x + c
    case 'cubic':       return a * x * x * x + b * x * x + c * x + (cal.d ?? 0)

    // ── Log-scale (most slide rule scales) ─────────────────────────────────
    // value = a · 10^((x − zeroAngle) / degreesPerDecade)
    case 'logscale':    return a * Math.pow(10, (x - zeroAngle) / degreesPerDecade)

    // ── Exponential ────────────────────────────────────────────────────────
    // value = a · e^(b·x + c)
    case 'exponential': return a * Math.exp(b * x + c)

    // ── Power law ──────────────────────────────────────────────────────────
    // value = a · ((x − offset) / scale)^n
    case 'power': {
      const u = (x - offset) / scale
      return a * Math.pow(Math.abs(u), n) * Math.sign(u)
    }

    // ── Reciprocal ─────────────────────────────────────────────────────────
    // value = a / (x − offset) + b
    case 'reciprocal':  return a / (x - offset) + b

    // ── Custom JS expression ────────────────────────────────────────────────
    // Evaluated with: x, a, b, c, n, offset, scale available as variables
    case 'custom': {
      if (!expr) return NaN
      try {
        // eslint-disable-next-line no-new-func
        return new Function('x','a','b','c','n','offset','scale','d',
          `"use strict"; return (${expr})`)(x, a, b, c, n, offset, scale, cal.d ?? 0)
      } catch { return NaN }
    }

    default: return x
  }
}

/** SVG debug overlay drawn on top of the disc images */
function DebugOverlay({ tool, rotations, discOverrides, calibration, flags }) {
  const DISC_COLORS = ['rgba(0,120,255,0.85)', 'rgba(0,180,80,0.85)', 'rgba(180,0,200,0.85)']

  return (
    <svg viewBox="0 0 100 100" className={styles.debugSvg} preserveAspectRatio="none">
      {/* Normalised grid */}
      {flags.grid && (
        <g>
          {[10,20,30,40,50,60,70,80,90].map(p => (
            <g key={p}>
              <line x1={p} y1={0} x2={p} y2={100} stroke="rgba(0,0,200,0.15)" strokeWidth={0.2} />
              <line x1={0} y1={p} x2={100} y2={p} stroke="rgba(0,0,200,0.15)" strokeWidth={0.2} />
              <text x={p} y={2.5} fontSize={1.8} fill="rgba(0,0,180,0.5)" textAnchor="middle">{(p/100).toFixed(1)}</text>
              <text x={1.2} y={p+0.6} fontSize={1.8} fill="rgba(0,0,180,0.5)">{(p/100).toFixed(1)}</text>
            </g>
          ))}
        </g>
      )}

      {tool.discs.map((disc, di) => {
        const color = DISC_COLORS[di % DISC_COLORS.length]
        const cx  = (discOverrides[disc.id]?.centerX  ?? disc.centerX)  * 100
        const cy  = (discOverrides[disc.id]?.centerY  ?? disc.centerY)  * 100
        const sr  = (discOverrides[disc.id]?.sizeRatio ?? disc.sizeRatio)
        const r   = sr / 2 * 100
        const angle = rotations[disc.id] ?? 0
        const cal   = calibration[disc.id] ?? {}
        const zeroAngle = cal.zeroAngle ?? 0

        const pt = (deg, radius) => ({
          x: cx + radius * Math.cos(deg * Math.PI / 180),
          y: cy + radius * Math.sin(deg * Math.PI / 180),
        })

        const pointer = pt(angle, r)
        const zeroRef = pt(zeroAngle, r)
        const liveVal = applyCalibration(angle, cal)

        // Tick spacing: every 15° minor, every 45° major
        const ticks = Array.from({ length: 24 }, (_, i) => i * 15)

        return (
          <g key={disc.id}>
            {/* Disc ring outline */}
            {flags.ring && (
              <circle cx={cx} cy={cy} r={r}
                fill="none" stroke={color} strokeWidth={0.35} strokeDasharray="1.2 0.8" opacity={0.7} />
            )}

            {/* Centre crosshair */}
            {flags.crosshair && (
              <g>
                <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={color} strokeWidth={0.35} />
                <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={color} strokeWidth={0.35} />
                <circle cx={cx} cy={cy} r={0.7} fill={color} />
                <text x={cx + 1.2} y={cy - 1.2} fontSize={2.2} fill={color} fontWeight="bold">{disc.id}</text>
              </g>
            )}

            {/* Tick marks + value labels */}
            {flags.ticks && ticks.map(deg => {
              const isMajor = deg % 45 === 0
              const inner = pt(deg, r - (isMajor ? 4 : 2))
              const outer = pt(deg, r)
              const labelPt = pt(deg, r + 5.5)
              const valPt   = pt(deg, r + 10)
              const val     = applyCalibration(deg, cal)
              return (
                <g key={deg}>
                  <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                    stroke="rgba(200,100,0,0.75)" strokeWidth={isMajor ? 0.5 : 0.25} />
                  {isMajor && (
                    <>
                      <text x={labelPt.x} y={labelPt.y} fontSize={2} fill="rgba(120,60,0,0.85)"
                        textAnchor="middle" dominantBaseline="middle">{deg}°</text>
                      {flags.valueLabels && (
                        <text x={valPt.x} y={valPt.y} fontSize={2.2} fill="rgba(180,50,0,0.9)"
                          textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
                          {isFinite(val) ? val.toFixed(2) : '∞'}
                        </text>
                      )}
                    </>
                  )}
                </g>
              )
            })}

            {/* Zero-angle reference line */}
            {flags.zeroRef && (
              <g>
                <line x1={cx} y1={cy} x2={zeroRef.x} y2={zeroRef.y}
                  stroke="rgba(160,0,220,0.85)" strokeWidth={0.5} strokeDasharray="1 0.5" />
                <circle cx={zeroRef.x} cy={zeroRef.y} r={0.9} fill="rgba(160,0,220,0.85)" />
                <text x={zeroRef.x + 1} y={zeroRef.y - 1.5} fontSize={1.8} fill="rgba(130,0,180,0.9)">0</text>
              </g>
            )}

            {/* Live rotation pointer */}
            {flags.pointer && (
              <g>
                <line x1={cx} y1={cy} x2={pointer.x} y2={pointer.y}
                  stroke="rgba(220,20,20,0.9)" strokeWidth={0.6} />
                <circle cx={pointer.x} cy={pointer.y} r={1} fill="rgba(220,20,20,0.9)" />
              </g>
            )}

            {/* Live angle readout — always shown in debug mode, pinned to top-left corner per disc index */}
            <g>
              <rect x={1} y={1 + di * 16} width={flags.readout ? 65 : 32} height={13}
                rx={1.5} fill="rgba(0,0,0,0.82)" />
              <text x={3.5} y={10 + di * 16} fontSize={3} fill="#ffd700"
                fontFamily="monospace" fontWeight="bold">
                {disc.id}: {angle.toFixed(1)}°{flags.readout ? ` → ${isFinite(liveVal) ? liveVal.toFixed(3) : '∞'}` : ''}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * CircleRuler — renders a PDF background image with one or two rotatable disc layers.
 *
 * Props:
 *   tool          — tool config object (see src/tools/*.js)
 *   rotations     — { [discId]: angleDeg }
 *   onRotate      — (discId, angleDeg) => void
 *   discOverrides — { [discId]: { centerX, centerY, sizeRatio } } from Configurator
 *   debug         — { enabled, calibration, flags: { grid, crosshair, ring, pointer, zeroRef, ticks, valueLabels, readout } }
 */
export default function CircleRuler({ tool, rotations, onRotate, discOverrides = {}, debug = {}, values = {} }) {
  const containerRef = useRef(null)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [bgError, setBgError] = useState(false)

  const dragState = useRef({})

  const getDiscProps = (disc) => ({
    centerX:   discOverrides[disc.id]?.centerX   ?? disc.centerX,
    centerY:   discOverrides[disc.id]?.centerY   ?? disc.centerY,
    sizeRatio: discOverrides[disc.id]?.sizeRatio ?? disc.sizeRatio,
  })

  const getAngleFromPointer = useCallback((e, discProps, containerEl) => {
    const rect = containerEl.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const cx = rect.left + discProps.centerX * rect.width
    const cy = rect.top  + discProps.centerY * rect.height
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI)
  }, [])

  const startDrag = useCallback((discId, disc, e) => {
    e.preventDefault()
    const container = containerRef.current
    const discProps = getDiscProps(disc)
    const startPointerAngle = getAngleFromPointer(e, discProps, container)
    const startRotation = rotations[discId] ?? 0
    dragState.current[discId] = { startPointerAngle, startRotation }

    const onMove = (mv) => {
      const cur = getAngleFromPointer(mv, discProps, container)
      onRotate(discId, dragState.current[discId].startRotation + (cur - dragState.current[discId].startPointerAngle))
    }
    const onEnd = () => {
      delete dragState.current[discId]
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotations, onRotate, getAngleFromPointer, discOverrides])

  const showDebug = debug.enabled && (bgLoaded || bgError)

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ '--aspect': tool.aspectRatio || '1 / 1' }}
    >
      <img
        src={`/assets/${tool.id}/background.png`}
        className={styles.background}
        alt={`${tool.title} background`}
        draggable={false}
        onLoad={() => setBgLoaded(true)}
        onError={() => setBgError(true)}
      />

      {tool.discs.map(disc => {
        const angle = rotations[disc.id] ?? 0
        const p = getDiscProps(disc)
        return (
          <img
            key={disc.id}
            src={`/assets/${tool.id}/${disc.id}.png`}
            className={styles.disc}
            alt={`${disc.id} disc`}
            draggable={false}
            style={{
              left: `${p.centerX * 100}%`,
              top:  `${p.centerY * 100}%`,
              width: `${p.sizeRatio * 100}%`,
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              cursor: 'grab',
              zIndex: disc.zIndex ?? 10,
            }}
            onMouseDown={e => startDrag(disc.id, disc, e)}
            onTouchStart={e => startDrag(disc.id, disc, e)}
            onError={e => { e.target.style.display = 'none' }}
          />
        )
      })}

      {/* Indicator dots (always visible when tool defines indicators) */}
      {tool.indicators && (() => {
        const indicators = tool.indicators(values, rotations)
        return indicators.length > 0 && (
          <svg viewBox="0 0 100 100" className={styles.indicatorSvg} preserveAspectRatio="none">
            {indicators.map((ind, i) => {
              const disc = tool.discs.find(d => d.id === ind.discId) ?? tool.discs[0]
              const cx  = (discOverrides[disc.id]?.centerX  ?? disc.centerX)  * 100
              const cy  = (discOverrides[disc.id]?.centerY  ?? disc.centerY)  * 100
              const sr  = (discOverrides[disc.id]?.sizeRatio ?? disc.sizeRatio)
              const r   = sr / 2 * 100 * (ind.radiusFraction ?? 0.93)
              const rad = ind.worldAngleDeg * Math.PI / 180
              const x   = cx + r * Math.cos(rad)
              const y   = cy + r * Math.sin(rad)
              return ind.ring
                ? <circle key={i} cx={x} cy={y} r={ind.size ?? 1.8} fill="none" stroke={ind.color ?? 'red'} strokeWidth="0.7" />
                : <circle key={i} cx={x} cy={y} r={ind.size ?? 1.8} fill={ind.color ?? 'red'} />
            })}
          </svg>
        )
      })()}

      {/* SVG debug overlay */}
      {showDebug && (
        <DebugOverlay
          tool={tool}
          rotations={rotations}
          discOverrides={discOverrides}
          calibration={debug.calibration ?? {}}
          flags={debug.flags ?? {}}
        />
      )}

      {(bgError || !bgLoaded) && (
        <div className={styles.placeholder}>
          <span>Waiting for processed images in</span>
          <code>/public/assets/{tool.id}/</code>
          <span>Run: <code>python scripts/process_all.py --tool {tool.id}</code></span>
        </div>
      )}
    </div>
  )
}
