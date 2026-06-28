import { useState, useEffect, useRef } from 'react'
import API from '../api/axios'
import styles from './NotificationBell.module.css'

export default function NotificationBell({ onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)
  const pollRef = useRef(null)

  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications/')
      if (Array.isArray(res.data)) setNotifications(res.data)
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchNotifications()
    pollRef.current = setInterval(fetchNotifications, 120000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unread = notifications.filter(n => !n.read).length

  const typeColor = {
    request:   '#f59e0b',
    accepted:  '#10b981',
    rejected:  '#ef4444',
    agreement: '#8b5cf6',
    active:    '#10b981',
    vacating:  '#f97316',
  }

  const handleNotifClick = (notif) => {
    if (onNavigate) onNavigate(notif.action)
    setOpen(false)
  }

  return (
    <div className={styles.wrapper} ref={dropRef}>
      <button className={styles.bell} onClick={() => setOpen(o => !o)}>
        🔔
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span>Notifications</span>
            {unread > 0 && <span className={styles.unreadCount}>{unread} new</span>}
          </div>

          {notifications.length === 0
            ? <div className={styles.empty}>
                <div>🔔</div>
                <p>No notifications yet</p>
              </div>
            : <div className={styles.list}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`${styles.item} ${!n.read ? styles.unread : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className={styles.itemIcon}
                      style={{ background: (typeColor[n.type] || '#667eea') + '20', color: typeColor[n.type] || '#667eea' }}>
                      {n.icon}
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{n.title}</div>
                      <div className={styles.itemMsg}>{n.message}</div>
                    </div>
                    {!n.read && <div className={styles.dot} />}
                  </div>
                ))}
              </div>
          }

          <div className={styles.footer} onClick={fetchNotifications}>
            🔄 Refresh
          </div>
        </div>
      )}
    </div>
  )
}
