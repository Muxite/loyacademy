import { Link } from 'react-router-dom'
import styles from './Home.module.css'

export default function Home({ tools }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Loy Academy</h1>
        <p className={styles.subtitle}>Interactive circular slide rule calculators</p>
      </header>
      <main className={styles.grid}>
        {tools.map(tool => (
          <Link key={tool.id} to={`/${tool.id}`} className={styles.card}>
            <div className={styles.cardIcon}>
              {tool.icon || '⊙'}
            </div>
            <h2 className={styles.cardTitle}>{tool.title}</h2>
            <p className={styles.cardDesc}>{tool.description}</p>
            <span className={styles.cardLang}>{tool.lang || 'EN'}</span>
          </Link>
        ))}
      </main>
    </div>
  )
}
