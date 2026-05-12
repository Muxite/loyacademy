import { useState } from 'react'
import styles from './Configurator.module.css'
import { applyCalibration } from './CircleRuler.jsx'

// ─── Formula mode definitions ────────────────────────────────────────────────
const MODES = {
  linear:      { label: 'Linear (scale)',   formula: 'value = (angle − zeroAngle) / degreesPerUnit',          fields: ['zeroAngle','degreesPerUnit'] },
  affine:      { label: 'Affine',           formula: 'value = a·angle + b',                                   fields: ['a','b'] },
  logscale:    { label: 'Log scale ★',      formula: 'value = a · 10^((angle − zeroAngle) / degreesPerDecade)', fields: ['a','zeroAngle','degreesPerDecade'] },
  exponential: { label: 'Exponential',      formula: 'value = a · eˣ where x = b·angle + c',                 fields: ['a','b','c'] },
  polynomial:  { label: 'Polynomial',       formula: 'value = a·angle² + b·angle + c',                       fields: ['a','b','c'] },
  power:       { label: 'Power law',        formula: 'value = a · ((angle − offset) / scale)ⁿ',              fields: ['a','n','offset','scale'] },
  reciprocal:  { label: 'Reciprocal',       formula: 'value = a / (angle − offset) + b',                     fields: ['a','b','offset'] },
  custom:      { label: 'Custom expr ✏',   formula: 'JS expression using x, a, b, c, n, offset, scale, d',   fields: ['a','b','c','n','offset','scale','d'], hasExpr: true },
}

const SLIDE_MODES = {
  linear:      { label: 'Linear (scale)',   formula: 'value = (px − zeroOffset) × unitsPerPx',               fields: ['zeroOffset','unitsPerPx'] },
  affine:      { label: 'Affine',           formula: 'value = a × px + b',                                   fields: ['a','b'] },
  logscale:    { label: 'Log scale ★',      formula: 'value = a · 10^((px − zeroOffset) / unitsPerDecade)',   fields: ['a','zeroOffset','unitsPerDecade'] },
  exponential: { label: 'Exponential',      formula: 'value = a · eˣ where x = b·px + c',                   fields: ['a','b','c'] },
  polynomial:  { label: 'Polynomial',       formula: 'value = a·px² + b·px + c',                             fields: ['a','b','c'] },
  power:       { label: 'Power law',        formula: 'value = a · ((px − offset) / scale)ⁿ',                 fields: ['a','n','offset','scale'] },
  reciprocal:  { label: 'Reciprocal',       formula: 'value = a / (px − offset) + b',                        fields: ['a','b','offset'] },
  custom:      { label: 'Custom expr ✏',   formula: 'JS expression using x, a, b, c, n, offset, scale, d',   fields: ['a','b','c','n','offset','scale','d'], hasExpr: true },
}

const FIELD_DEFAULTS = {
  zeroAngle:0, degreesPerUnit:1, degreesPerDecade:360, unitsPerDecade:520,
  a:1, b:0, c:0, d:0, n:1, offset:0, scale:1, unitsPerPx:1, zeroOffset:0,
}
const FIELD_RANGES = {
  zeroAngle:        { min:-360,    max:360,    step:0.5    },
  degreesPerUnit:   { min:0.001,   max:360,    step:0.001  },
  degreesPerDecade: { min:1,       max:3600,   step:1      },
  unitsPerDecade:   { min:1,       max:10000,  step:1      },
  a:                { min:-10000,  max:10000,  step:0.001  },
  b:                { min:-10000,  max:10000,  step:0.001  },
  c:                { min:-10000,  max:10000,  step:0.001  },
  d:                { min:-10000,  max:10000,  step:0.001  },
  n:                { min:-10,     max:10,     step:0.01   },
  offset:           { min:-10000,  max:10000,  step:0.5    },
  scale:            { min:0.001,   max:10000,  step:0.1    },
  unitsPerPx:       { min:-100,    max:100,    step:0.0001 },
  zeroOffset:       { min:-10000,  max:10000,  step:1      },
}

const DEFAULT_FLAGS = {
  grid: true, crosshair: true, ring: true, pointer: true,
  zeroRef: true, ticks: true, valueLabels: true, readout: true,
}

// ─── Reference-point solvers ──────────────────────────────────────────────────
function leastSquares(xs, ys) {
  const n = xs.length
  let sx=0, sy=0, sxx=0, sxy=0
  for (let i=0;i<n;i++) { sx+=xs[i]; sy+=ys[i]; sxx+=xs[i]*xs[i]; sxy+=xs[i]*ys[i] }
  const det = n*sxx - sx*sx
  if (Math.abs(det) < 1e-14) return null
  const a = (n*sxy - sx*sy) / det
  const b = (sy - a*sx) / n
  return { a, b }
}

function rSquared(xs, ys, predict) {
  const mean = ys.reduce((s,v)=>s+v,0) / ys.length
  const ssTot = ys.reduce((s,v)=>s+(v-mean)**2, 0)
  const ssRes = xs.reduce((s,x,i)=>s+(ys[i]-predict(x))**2, 0)
  return ssTot < 1e-14 ? 1 : Math.max(0, 1 - ssRes/ssTot)
}

// Returns array of {label, mode, params, r2} sorted by R²
function solveAll(points, isSlide) {
  if (points.length < 2) return []
  const xs = points.map(p => p.angle)
  const ys = points.map(p => p.value)
  const results = []

  // Linear / affine fit  →  value = a*x + b
  const lin = leastSquares(xs, ys)
  if (lin) {
    const { a, b } = lin
    const r2 = rSquared(xs, ys, x => a*x+b)
    if (isSlide) {
      results.push({ label:'Linear', mode:'linear', r2,
        params: Math.abs(a) < 1e-10 ? null : { unitsPerPx: a, zeroOffset: -b/a } })
    } else {
      results.push({ label:'Linear', mode:'linear', r2,
        params: Math.abs(a) < 1e-10 ? null : { degreesPerUnit: 1/a, zeroAngle: -b/a } })
    }
  }

  // Exponential fit:  ln(y) = ln(a) + b*x  (requires all y > 0)
  if (ys.every(v => v > 0)) {
    const lnYs = ys.map(v => Math.log(v))
    const exp = leastSquares(xs, lnYs)
    if (exp) {
      const a = Math.exp(exp.b), b = exp.a
      const r2 = rSquared(xs, ys, x => a*Math.exp(b*x))
      results.push({ label:'Exponential', mode:'exponential', r2, params: { a, b, c:0 } })
    }

    // Log-scale fit: log10(y) = log10(a) + x/D  →  y = a · 10^(x/D)
    const log10Ys = ys.map(v => Math.log10(v))
    const lg = leastSquares(xs, log10Ys)
    if (lg) {
      const a = Math.pow(10, lg.b), invD = lg.a
      if (Math.abs(invD) > 1e-10) {
        const D = 1/invD
        const r2 = rSquared(xs, ys, x => a*Math.pow(10, x/D))
        if (isSlide) {
          results.push({ label:'Log scale', mode:'logscale', r2, params: { a, zeroOffset: 0, unitsPerDecade: D } })
        } else {
          results.push({ label:'Log scale', mode:'logscale', r2, params: { a, zeroAngle: 0, degreesPerDecade: D } })
        }
      }
    }
  }

  // Power law fit:  ln(|y|) = ln(a) + n·ln(|x|)  (requires x,y ≠ 0)
  if (xs.every(v => Math.abs(v)>0.001) && ys.every(v => Math.abs(v)>0.001)) {
    const lnXs = xs.map(v => Math.log(Math.abs(v)))
    const lnYs = ys.map(v => Math.log(Math.abs(v)))
    const pw = leastSquares(lnXs, lnYs)
    if (pw) {
      const a = Math.exp(pw.b), n = pw.a
      const sign = xs[0]*ys[0] > 0 ? 1 : -1
      const r2 = rSquared(xs, ys, x => sign*a*Math.pow(Math.abs(x),n))
      results.push({ label:'Power law', mode:'power', r2, params: { a: sign*a, n, offset:0, scale:1 } })
    }
  }

  // Quadratic polynomial (requires ≥3 points)
  if (points.length >= 3) {
    // Solve [a,b,c] for y = a*x² + b*x + c via normal equations
    let s0=0,s1=0,s2=0,s3=0,s4=0, t0=0,t1=0,t2=0
    for (let i=0;i<xs.length;i++) {
      const x=xs[i],y=ys[i],x2=x*x
      s0+=1; s1+=x; s2+=x2; s3+=x2*x; s4+=x2*x2
      t0+=y; t1+=x*y; t2+=x2*y
    }
    // 3×3 system  M·[a,b,c] = rhs
    const M = [[s4,s3,s2],[s3,s2,s1],[s2,s1,s0]]
    const rhs = [t2,t1,t0]
    const sol = solve3x3(M, rhs)
    if (sol) {
      const [pa,pb,pc] = sol
      const r2 = rSquared(xs, ys, x => pa*x*x + pb*x + pc)
      results.push({ label:'Polynomial', mode:'polynomial', r2, params: { a:pa, b:pb, c:pc } })
    }
  }

  return results.filter(r => r.params).sort((a,b) => b.r2 - a.r2)
}

function solve3x3(M, rhs) {
  // Gaussian elimination
  const A = M.map((r,i) => [...r, rhs[i]])
  for (let col=0;col<3;col++) {
    let pivot = col
    for (let row=col+1;row<3;row++) if (Math.abs(A[row][col])>Math.abs(A[pivot][col])) pivot=row;
    [A[col],A[pivot]] = [A[pivot],A[col]]
    if (Math.abs(A[col][col]) < 1e-12) return null
    for (let row=col+1;row<3;row++) {
      const f = A[row][col]/A[col][col]
      for (let k=col;k<=3;k++) A[row][k] -= f*A[col][k]
    }
  }
  const x = [0,0,0]
  for (let i=2;i>=0;i--) {
    x[i] = A[i][3]
    for (let j=i+1;j<3;j++) x[i] -= A[i][j]*x[j]
    x[i] /= A[i][i]
  }
  return x
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * Configurator — floating dev panel.
 *
 * Props:
 *   tool             — tool config
 *   discOverrides    — { [discId]: { centerX, centerY, sizeRatio } }
 *   calibration      — { [discId]: { mode, zeroAngle, degreesPerUnit, a, b, c, n, offset, scale } }
 *   pdfCrop          — { [discId]: { cx, cy, r } }
 *   debug            — { enabled, flags }
 *   currentRotations — { [discId]: angleDeg }
 *   onChange         — ({ discOverrides, calibration, pdfCrop, debug }) => void
 */
export default function Configurator({
  tool, discOverrides, stripOverrides = {}, calibration, pdfCrop, debug,
  currentRotations, currentOffsets = {}, onChange,
}) {
  const isSlide = tool.type === 'slide'
  const items   = isSlide ? (tool.strips ?? []) : (tool.discs ?? [])

  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState('layout')
  const [copied, setCopied] = useState(false)
  // Reference points per item: [{ position, value }]  (position = angle for circle, px for slide)
  const [refPoints, setRefPoints] = useState(() =>
    Object.fromEntries(items.map(d => [d.id, []]))
  )
  const [refAngle, setRefAngle]   = useState('')
  const [refValue, setRefValue]   = useState('')
  const [refDisc, setRefDisc]     = useState(items[0]?.id ?? '')

  // ── helpers ────────────────────────────────────────────────────────────────
  const base = () => ({ discOverrides, stripOverrides, calibration, pdfCrop, debug })

  const STRING_FIELDS = new Set(['mode', 'expr'])
  const updateSection = (section, itemId, field, rawValue) => {
    const value = STRING_FIELDS.has(field) ? rawValue : parseFloat(rawValue)
    if (!STRING_FIELDS.has(field) && isNaN(value)) return
    const sections = { discOverrides, stripOverrides, calibration, pdfCrop, debug }
    onChange({
      ...base(),
      [section]: {
        ...sections[section],
        [itemId]: { ...(sections[section][itemId] ?? {}), [field]: value },
      },
    })
  }

  const updateFlag = (flag, value) => {
    onChange({ ...base(), debug: { ...debug, flags: { ...(debug.flags ?? DEFAULT_FLAGS), [flag]: value } } })
  }

  const toggleDebug = () => {
    onChange({ ...base(), debug: { ...debug, enabled: !debug.enabled } })
  }

  // ── export JSON ────────────────────────────────────────────────────────────
  const configOutput = isSlide
    ? JSON.stringify({
        strips: (tool.strips ?? []).map(s => {
          const cal = calibration[s.id] ?? {}
          const ov  = stripOverrides[s.id] ?? {}
          return {
            id: s.id,
            heightRatio: ov.heightRatio ?? s.heightRatio ?? 1,
            calibration: {
              mode:        cal.mode        ?? 'linear',
              zeroOffset:  cal.zeroOffset  ?? s.zeroOffset  ?? 0,
              unitsPerPx:  cal.unitsPerPx  ?? s.unitsPerPx  ?? 1,
              a: cal.a ?? 1, b: cal.b ?? 0,
            },
          }
        }),
        pdfCrop: (tool.strips ?? []).reduce((acc, s) => {
          acc[s.id] = { x: pdfCrop[s.id]?.x ?? 0, y: pdfCrop[s.id]?.y ?? 0, w: pdfCrop[s.id]?.w ?? 1, h: pdfCrop[s.id]?.h ?? 0.1 }
          return acc
        }, {}),
      }, null, 2)
    : JSON.stringify({
        discs: (tool.discs ?? []).map(d => {
          const cal = calibration[d.id] ?? {}
          const ov  = discOverrides[d.id] ?? {}
          return {
            id: d.id,
            centerX:   ov.centerX   ?? d.centerX,
            centerY:   ov.centerY   ?? d.centerY,
            sizeRatio: ov.sizeRatio ?? d.sizeRatio,
            calibration: {
              mode:           cal.mode           ?? 'linear',
              zeroAngle:      cal.zeroAngle      ?? 0,
              degreesPerUnit: cal.degreesPerUnit ?? 1,
              a: cal.a ?? 1, b: cal.b ?? 0, c: cal.c ?? 0,
              n: cal.n ?? 1, offset: cal.offset ?? 0, scale: cal.scale ?? 1,
            },
          }
        }),
        pdfCrop: (tool.discs ?? []).reduce((acc, d) => {
          acc[d.id] = { cx: pdfCrop[d.id]?.cx ?? 0.5, cy: pdfCrop[d.id]?.cy ?? 0.5, r: pdfCrop[d.id]?.r ?? 0.45 }
          return acc
        }, {}),
      }, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(configOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── reference point solver ─────────────────────────────────────────────────
  const [fitResults, setFitResults] = useState({})  // { [itemId]: [{label,mode,params,r2}] }

  const addRefPoint = () => {
    const a = parseFloat(refAngle), v = parseFloat(refValue)
    if (isNaN(a) || isNaN(v)) return
    setRefPoints(prev => ({ ...prev, [refDisc]: [...(prev[refDisc]??[]), { angle: a, value: v }] }))
    setRefAngle(''); setRefValue('')
  }

  const capturePosition = () => {
    const pos = isSlide ? (currentOffsets[refDisc] ?? 0) : (currentRotations[refDisc] ?? 0)
    setRefAngle(pos.toFixed(2))
  }

  const runSolver = (itemId) => {
    const pts = refPoints[itemId] ?? []
    const results = solveAll(pts, isSlide)
    setFitResults(prev => ({ ...prev, [itemId]: results }))
    // Auto-apply best fit
    if (results.length > 0) {
      const best = results[0]
      onChange({
        ...base(),
        calibration: { ...calibration, [itemId]: { ...(calibration[itemId]??{}), mode: best.mode, ...best.params } },
      })
    }
  }

  const applyFit = (itemId, fit) => {
    onChange({
      ...base(),
      calibration: { ...calibration, [itemId]: { ...(calibration[itemId]??{}), mode: fit.mode, ...fit.params } },
    })
  }

  const TABS = ['layout','calibration','reference','pdf crop','debug','export']
  const flags = debug.flags ?? DEFAULT_FLAGS

  return (
    <div className={styles.wrapper}>
      {/* Debug badge */}
      {debug.enabled && <span className={styles.debugBadge}>DEBUG</span>}

      <button
        className={`${styles.toggle} ${debug.enabled ? styles.toggleActive : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Open configurator"
      >⚙</button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Configurator</span>
            <label className={styles.debugToggle}>
              <input type="checkbox" checked={!!debug.enabled} onChange={toggleDebug} />
              <span>Debug overlay</span>
            </label>
            <button className={styles.close} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={styles.tabs}>
            {TABS.map(t => (
              <button key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t)}
              >{t}</button>
            ))}
          </div>

          <div className={styles.body}>

            {/* ── LAYOUT ── */}
            {tab === 'layout' && (
              <>
                {isSlide ? (
                  <>
                    <p className={styles.hint}>Adjust relative height of each strip row. Changes are live.</p>
                    {(tool.strips ?? []).map(strip => (
                      <div key={strip.id} className={styles.discGroup}>
                        <div className={styles.discLabel}>{strip.label ?? strip.id}</div>
                        <SliderRow label="Height ratio"
                          value={stripOverrides[strip.id]?.heightRatio ?? strip.heightRatio ?? 1}
                          min={0.2} max={6} step={0.05}
                          onChange={v => updateSection('stripOverrides', strip.id, 'heightRatio', v)} />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <p className={styles.hint}>Adjust disc position and size on the canvas. Changes are live.</p>
                    {(tool.discs ?? []).map(disc => (
                      <div key={disc.id} className={styles.discGroup}>
                        <div className={styles.discLabel}>{disc.id}</div>
                        <SliderRow label="Center X"   value={discOverrides[disc.id]?.centerX   ?? disc.centerX}   min={0}    max={1}   step={0.005} onChange={v => updateSection('discOverrides', disc.id, 'centerX',   v)} />
                        <SliderRow label="Center Y"   value={discOverrides[disc.id]?.centerY   ?? disc.centerY}   min={0}    max={1}   step={0.005} onChange={v => updateSection('discOverrides', disc.id, 'centerY',   v)} />
                        <SliderRow label="Size ratio" value={discOverrides[disc.id]?.sizeRatio ?? disc.sizeRatio} min={0.05} max={1.5} step={0.005} onChange={v => updateSection('discOverrides', disc.id, 'sizeRatio', v)} />
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── CALIBRATION ── */}
            {tab === 'calibration' && items.map(item => {
              const cal   = calibration[item.id] ?? {}
              const modeMap = isSlide ? SLIDE_MODES : MODES
              const mode  = cal.mode ?? 'linear'
              const pos   = isSlide ? (currentOffsets[item.id] ?? 0) : (currentRotations[item.id] ?? 0)
              const val   = isSlide
                ? (mode === 'affine' ? (cal.a??1)*pos + (cal.b??0) : (pos - (cal.zeroOffset??0)) * (cal.unitsPerPx??1))
                : applyCalibration(pos, cal)
              const fields = modeMap[mode]?.fields ?? []
              const posLabel = isSlide ? 'px' : '°'
              return (
                <div key={item.id} className={styles.discGroup}>
                  <div className={styles.discLabel}>
                    {item.label ?? item.id}
                    <span className={styles.liveAngle}>{pos.toFixed(1)}{posLabel} → {isFinite(val) ? val.toFixed(3) : '∞'}</span>
                  </div>
                  <label className={styles.selectRow}>
                    <span className={styles.rowLabel}>Formula</span>
                    <select className={styles.select} value={mode}
                      onChange={e => updateSection('calibration', item.id, 'mode', e.target.value)}>
                      {Object.entries(modeMap).map(([k, m]) => (
                        <option key={k} value={k}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.formulaBox}>{modeMap[mode]?.formula}</div>
                  {modeMap[mode]?.hasExpr && (
                    <label className={styles.row}>
                      <span className={styles.rowLabel}>expr</span>
                      <input
                        type="text"
                        className={styles.exprInput}
                        value={cal.expr ?? ''}
                        placeholder="e.g. a * Math.pow(x, n) + b"
                        onChange={e => updateSection('calibration', item.id, 'expr', e.target.value)}
                      />
                    </label>
                  )}
                  {fields.map(field => {
                    const range = FIELD_RANGES[field]
                    if (!range) return null
                    return (
                      <SliderRow key={field} label={field}
                        value={cal[field] ?? FIELD_DEFAULTS[field]}
                        min={range.min} max={range.max} step={range.step}
                        onChange={v => updateSection('calibration', item.id, field, v)} />
                    )
                  })}
                  <div className={styles.liveFormula}>
                    At {pos.toFixed(1)}{posLabel}: <strong>{isFinite(val) ? val.toFixed(4) : '∞'}</strong>
                  </div>
                </div>
              )
            })}

            {/* ── REFERENCE POINTS ── */}
            {tab === 'reference' && (
              <>
                <p className={styles.hint}>
                  Drag the disc/strip to a known marking, hit <strong>Capture</strong> to fill the position,
                  enter the real value, then <strong>Add</strong>. With ≥2 points, <strong>Solve all</strong>
                  tries multiple curve fits and applies the best one automatically.
                </p>
                <div className={styles.discGroup}>
                  <label className={styles.selectRow}>
                    <span className={styles.rowLabel}>{isSlide ? 'Strip' : 'Disc'}</span>
                    <select className={styles.select} value={refDisc} onChange={e => setRefDisc(e.target.value)}>
                      {items.map(d => <option key={d.id} value={d.id}>{d.label ?? d.id}</option>)}
                    </select>
                  </label>
                  <div className={styles.refRow}>
                    <button className={styles.captureBtn} onClick={capturePosition} title="Fill current position">
                      ⊕ Capture
                    </button>
                    <input type="number" placeholder={isSlide ? 'px offset' : 'angle °'} value={refAngle}
                      onChange={e => setRefAngle(e.target.value)} className={styles.refInput} />
                    <span className={styles.refArrow}>→</span>
                    <input type="number" placeholder="real value" value={refValue}
                      onChange={e => setRefValue(e.target.value)} className={styles.refInput} />
                    <button className={styles.addBtn} onClick={addRefPoint}>Add</button>
                  </div>
                  {(refPoints[refDisc]??[]).length > 0 && (
                    <table className={styles.refTable}>
                      <thead><tr><th>{isSlide ? 'px' : '°'}</th><th>Value</th><th></th></tr></thead>
                      <tbody>
                        {(refPoints[refDisc]??[]).map((pt, i) => (
                          <tr key={i}>
                            <td>{pt.angle}</td>
                            <td>{pt.value}</td>
                            <td>
                              <button className={styles.delBtn} onClick={() =>
                                setRefPoints(prev => ({ ...prev, [refDisc]: prev[refDisc].filter((_,j) => j!==i) }))
                              }>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {(refPoints[refDisc]??[]).length >= 2 && (
                    <button className={styles.solveBtn} onClick={() => runSolver(refDisc)}>
                      Solve all fits → auto-apply best
                    </button>
                  )}
                  {(refPoints[refDisc]??[]).length < 2 && (
                    <p className={styles.hint}>Add at least 2 points to solve.</p>
                  )}
                  {/* Fit results */}
                  {(fitResults[refDisc]??[]).length > 0 && (
                    <div className={styles.fitResults}>
                      <div className={styles.fitHeader}>Curve fit results (best first):</div>
                      {(fitResults[refDisc]).map((fit, i) => (
                        <div key={i} className={`${styles.fitRow} ${i===0 ? styles.fitBest : ''}`}>
                          <span className={styles.fitLabel}>{fit.label}</span>
                          <span className={styles.fitR2}>R²={fit.r2.toFixed(4)}</span>
                          <button className={styles.fitApply} onClick={() => applyFit(refDisc, fit)}>Apply</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── PDF CROP ── */}
            {tab === 'pdf crop' && (
              <>
                <p className={styles.hint}>
                  {isSlide
                    ? 'Adjust rect crop (x,y,w,h) per strip for pdf_config.json.'
                    : 'Adjust circle crop (cx,cy,r) per disc for pdf_config.json.'}
                  {' '}Re-run <code>python scripts/process_all.py --tool {tool.id}</code> after changes.
                </p>
                {items.map(item => (
                  <div key={item.id} className={styles.discGroup}>
                    <div className={styles.discLabel}>{item.label ?? item.id}</div>
                    {isSlide ? (<>
                      <SliderRow label="x (0–1)" value={pdfCrop[item.id]?.x ?? 0}    min={0} max={1}    step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'x', v)} />
                      <SliderRow label="y (0–1)" value={pdfCrop[item.id]?.y ?? 0}    min={0} max={1}    step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'y', v)} />
                      <SliderRow label="w (0–1)" value={pdfCrop[item.id]?.w ?? 1}    min={0} max={1}    step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'w', v)} />
                      <SliderRow label="h (0–1)" value={pdfCrop[item.id]?.h ?? 0.1}  min={0.01} max={0.5} step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'h', v)} />
                    </>) : (<>
                      <SliderRow label="cx (0–1)" value={pdfCrop[item.id]?.cx ?? 0.5}  min={0}    max={1}    step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'cx', v)} />
                      <SliderRow label="cy (0–1)" value={pdfCrop[item.id]?.cy ?? 0.5}  min={0}    max={1}    step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'cy', v)} />
                      <SliderRow label="r (0–1)"  value={pdfCrop[item.id]?.r  ?? 0.45} min={0.05} max={0.75} step={0.005} onChange={v => updateSection('pdfCrop', item.id, 'r',  v)} />
                    </>)}
                  </div>
                ))}
              </>
            )}

            {/* ── DEBUG OVERLAY FLAGS ── */}
            {tab === 'debug' && (
              <>
                <p className={styles.hint}>Toggle individual debug markers. Enable the overlay with the checkbox in the header.</p>
                {(isSlide ? [
                  ['grid',    'Unit grid lines (1/unitsPerPx spacing)'],
                  ['ticks',   'Centre tick mark per strip'],
                  ['readout', 'Live px → value readout per strip'],
                ] : [
                  ['grid',        'Normalised grid (0.1 intervals)'],
                  ['crosshair',   'Disc centre crosshair + label'],
                  ['ring',        'Disc boundary ring'],
                  ['pointer',     'Live rotation pointer'],
                  ['zeroRef',     'Zero-angle reference line'],
                  ['ticks',       'Degree tick marks (every 15°)'],
                  ['valueLabels', 'Calibrated values at major ticks'],
                  ['readout',     'Live angle → value readout'],
                ]).map(([key, label]) => (
                  <label key={key} className={styles.flagRow}>
                    <input type="checkbox" checked={flags[key] ?? true}
                      onChange={e => updateFlag(key, e.target.checked)} />
                    <span>{label}</span>
                  </label>
                ))}
              </>
            )}

            {/* ── EXPORT ── */}
            {tab === 'export' && (
              <>
                <p className={styles.hint}>
                  Paste into <code>src/tools/{tool.id}.js</code> and <code>scripts/pdf_config.json</code>.
                </p>
                <pre className={styles.code}>{configOutput}</pre>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? '✓ Copied!' : 'Copy to clipboard'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <label className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <input type="range"   min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)} className={styles.slider} />
      <input type="number"  min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)} className={styles.numInput} />
    </label>
  )
}
