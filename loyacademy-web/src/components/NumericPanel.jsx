import styles from './NumericPanel.module.css'

/**
 * NumericPanel — shows numeric inputs for the tool's variables and computed outputs.
 *
 * Props:
 *   tool     — tool config
 *   values   — { [inputId]: number }
 *   outputs  — { [outputId]: number }
 *   onChange — (newValues) => void
 */
export default function NumericPanel({ tool, values, outputs, onChange }) {
  const handleChange = (id, rawValue) => {
    const num = parseFloat(rawValue)
    if (isNaN(num)) return
    onChange({ ...values, [id]: num })
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Inputs</h3>
        {tool.inputs.map(inp => (
          <label key={inp.id} className={styles.field}>
            <span className={styles.label}>{inp.label}</span>
            {inp.type === 'select' ? (
              <select
                value={values[inp.id] ?? inp.defaultValue}
                onChange={e => handleChange(inp.id, e.target.value)}
              >
                {inp.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : inp.type === 'select-number' ? (
              <>
                <select
                  value={inp.options.some(o => o.value === (values[inp.id] ?? inp.defaultValue)) ? (values[inp.id] ?? inp.defaultValue) : ''}
                  onChange={e => { if (e.target.value !== '') handleChange(inp.id, e.target.value) }}
                >
                  {inp.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  <option value=''>Custom</option>
                </select>
                <input
                  type="number"
                  value={values[inp.id] ?? inp.defaultValue}
                  min={inp.min}
                  max={inp.max}
                  step={inp.step ?? 0.01}
                  onChange={e => handleChange(inp.id, e.target.value)}
                />
              </>
            ) : (
              <input
                type="number"
                value={values[inp.id] ?? ''}
                min={inp.min}
                max={inp.max}
                step={inp.step ?? 1}
                onChange={e => handleChange(inp.id, e.target.value)}
              />
            )}
            {inp.unit && <span className={styles.unit}>{inp.unit}</span>}
          </label>
        ))}
      </section>

      {tool.outputs && tool.outputs.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Result</h3>
          {tool.outputs.map(out => {
            const val = outputs[out.id]
            return (
              <div key={out.id} className={styles.output}>
                <span className={styles.label}>{out.label}</span>
                <span className={styles.value}>
                  {val != null
                    ? (typeof val === 'string' ? val : val.toFixed(out.decimals ?? 2))
                    : '—'}
                  {out.unit && typeof val !== 'string' ? ` ${out.unit}` : ''}
                </span>
                {out.interpret && val != null && (
                  <span className={styles.interpretation}>
                    {out.interpret(val)}
                  </span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {tool.notes && (
        <p className={styles.notes}>{tool.notes}</p>
      )}
    </div>
  )
}
