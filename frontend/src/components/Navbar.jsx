import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import NotificationBell from './NotificationBell'
import styles from './Navbar.module.css'

export default function Navbar({ activeTab, setActiveTab, tabs }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo}>🏠 <span>Rentpro</span></div>
        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.right}>
        {/* Live Notification Bell */}
        <NotificationBell onNavigate={(tab) => setActiveTab(tab)} />

        <div className={styles.userInfo}>
          <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userRole}>{user?.role === 'owner' ? '👤 Owner' : '🏠 Tenant'}</div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  )
}
