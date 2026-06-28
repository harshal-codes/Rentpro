import { useNavigate } from 'react-router-dom'
import styles from './Landing.module.css'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          🏠 <span>Rentpro</span>
        </div>
        <div className={styles.navLinks}>
          <button onClick={() => navigate('/login')} className={styles.loginBtn}>Login</button>
          <button onClick={() => navigate('/signup')} className={styles.signupBtn}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>🚀 Property Rental Management</div>
          <h1 className={styles.heroTitle}>
            Manage Properties<br />
            <span className={styles.gradient}>the Smart Way</span>
          </h1>
          <p className={styles.heroSubtitle}>
            All-in-one platform for property owners and tenants.
            List properties, manage agreements, track payments — all in one place.
          </p>
          <div className={styles.heroCTA}>
            <button onClick={() => navigate('/signup')} className={styles.primaryBtn}>
              Get Started Free →
            </button>
            <button onClick={() => navigate('/login')} className={styles.outlineBtn}>
              Sign In
            </button>
          </div>
        </div>
        <div className={styles.heroImage}>
          <div className={styles.floatingCard}>
            <div className={styles.cardIcon}>🏢</div>
            <div>
              <div className={styles.cardTitle}>Properties Listed</div>
              <div className={styles.cardValue}>10+</div>
            </div>
          </div>
          <div className={styles.floatingCard2}>
            <div className={styles.cardIcon}>✅</div>
            <div>
              <div className={styles.cardTitle}>Active Agreements</div>
              <div className={styles.cardValue}>8+</div>
            </div>
          </div>
          <div className={styles.heroIllustration}>
            <div className={styles.building}>🏙️</div>
          </div>
        </div>
      </section>

      {/* Role Selection */}
      <section className={styles.roles}>
        <h2 className={styles.sectionTitle}>Choose your role</h2>
        <p className={styles.sectionSub}>Different experience tailored for you</p>
        <div className={styles.roleCards}>
          <div className={styles.roleCard} onClick={() => navigate('/signup?role=owner')}>
            <div className={styles.roleIcon}>👤</div>
            <h3>I'm an Owner</h3>
            <p>List your properties, add tenants, create rental agreements, and track payments easily.</p>
            <ul className={styles.roleFeatures}>
              <li>✓ Add & manage properties</li>
              <li>✓ Create rental agreements</li>
              <li>✓ Track rent payments</li>
              <li>✓ Manage tenants</li>
            </ul>
            <button className={styles.roleBtn}>Join as Owner →</button>
          </div>
          <div className={`${styles.roleCard} ${styles.roleCardHighlight}`} onClick={() => navigate('/signup?role=tenant')}>
            <div className={styles.popularBadge}>Popular</div>
            <div className={styles.roleIcon}>🏠</div>
            <h3>I'm a Tenant</h3>
            <p>Find your perfect rental, view your agreements, and manage your rent payments digitally.</p>
            <ul className={styles.roleFeatures}>
              <li>✓ Browse properties</li>
              <li>✓ View your agreement</li>
              <li>✓ Pay rent online</li>
              <li>✓ Payment history</li>
            </ul>
            <button className={styles.roleBtnHighlight}>Join as Tenant →</button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything you need</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: '🔍', title: 'Smart Search', desc: 'Find properties by location, price, or title instantly' },
            { icon: '📄', title: 'Digital Agreements', desc: 'Create and manage rental agreements paperlessly' },
            { icon: '💳', title: 'Payment Tracking', desc: 'Track all rent payments with status updates' },
            { icon: '👥', title: 'Tenant Management', desc: 'Manage all tenants from a single dashboard' },
            { icon: '📊', title: 'Dashboard Overview', desc: 'Get insights at a glance with live stats' },
            { icon: '🔒', title: 'Secure & Private', desc: 'JWT authentication keeps your data safe' },
          ].map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>🏠 Rentpro</div>
        <p>© 2024 Rentpro. Built with ❤️</p>
      </footer>
    </div>
  )
}
