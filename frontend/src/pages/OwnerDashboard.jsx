import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import PhotoUploader from '../components/PhotoUploader'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'overview',   icon: '📊', label: 'Overview'   },
  { id: 'properties', icon: '🏢', label: 'Properties'  },
  { id: 'requests',   icon: '📬', label: 'Requests'    },
  { id: 'tenants',    icon: '👥', label: 'Tenants'     },
  { id: 'agreements', icon: '📄', label: 'Agreements'  },
  { id: 'payments',   icon: '💳', label: 'Payments'    },
]

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]   = useState('overview')
  const [properties, setProperties] = useState([])
  const [tenants, setTenants]       = useState([])
  const [payments, setPayments]     = useState([])
  const [agreements, setAgreements] = useState([])
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError]   = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => { fetchAll(true) }, [])

  const fetchAll = async (initial = false, attempt = 0) => {
    if (initial) { setLoading(true); setLoadError(false) }
    else setRefreshing(true)

    const [p, t, pay, ag, req] = await Promise.allSettled([
      API.get('/properties/'),
      API.get('/tenants/'),
      API.get('/payments/'),
      API.get('/agreements/'),
      API.get('/requests/incoming'),
    ])

    const propertiesOk = p.status === 'fulfilled' && Array.isArray(p.value.data)

    if (!propertiesOk && initial && attempt < 3) {
      setRetryCount(attempt + 1)
      setTimeout(() => fetchAll(true, attempt + 1), (attempt + 1) * 5000)
      return
    }

    if (!propertiesOk && initial) {
      setLoadError(true)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setLoadError(false)
    setRetryCount(0)

    // Always update all data — don't skip on partial failures
    if (p.status   === 'fulfilled' && Array.isArray(p.value.data))   setProperties(p.value.data)
    if (t.status   === 'fulfilled' && Array.isArray(t.value.data))   setTenants(t.value.data)
    if (pay.status === 'fulfilled' && Array.isArray(pay.value.data)) setPayments(pay.value.data)
    if (ag.status  === 'fulfilled' && Array.isArray(ag.value.data))  setAgreements(ag.value.data)
    if (req.status === 'fulfilled' && Array.isArray(req.value.data)) setRequests(req.value.data)

    // Log any failures for debugging
    if (ag.status  === 'rejected') console.warn('Agreements fetch failed:', ag.reason)
    if (pay.status === 'rejected') console.warn('Payments fetch failed:', pay.reason)

    setLoading(false)
    setRefreshing(false)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const tabsWithBadge = TABS.map(t =>
    t.id === 'requests' && pendingCount > 0
      ? { ...t, label: `📬 Requests (${pendingCount})` }
      : t
  )

  const ctx = { properties, tenants, payments, agreements, requests, refresh: fetchAll, user }

  return (
    <div className={styles.dashboard}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabsWithBadge} />
      <div className={styles.content}>
        {refreshing && <div className={styles.refreshBar}><span className={styles.spin} /> Refreshing…</div>}
        {loading
          ? <div className={styles.loader}>
              <span className={styles.spin} />
              {retryCount > 0 && (
                <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
                  ⏳ Server is waking up… (attempt {retryCount}/3)<br />
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>This takes ~30 seconds on first load</span>
                </p>
              )}
            </div>
          : loadError
          ? <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😴</div>
              <h3 style={{ color: '#1a202c', marginBottom: '0.5rem' }}>Server took too long to respond</h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                The backend is hosted on Render's free tier and may take up to 60 seconds to wake up.<br />
                Click retry to try again.
              </p>
              <button
                className={styles.addBtn}
                onClick={() => fetchAll(true)}
              >
                🔄 Retry
              </button>
            </div>
          : <>
            {activeTab === 'overview'   && <Overview   {...ctx} setActiveTab={setActiveTab} />}
            {activeTab === 'properties' && <Properties {...ctx} />}
            {activeTab === 'requests'   && <IncomingRequests {...ctx} />}
            {activeTab === 'tenants'    && <Tenants    {...ctx} />}
            {activeTab === 'agreements' && <Agreements {...ctx} />}
            {activeTab === 'payments'   && <Payments   {...ctx} />}
          </>
        }
      </div>
    </div>
  )
}

/* ── OVERVIEW ─────────────────────────────────────────────────── */
function Overview({ properties, tenants, payments, agreements, setActiveTab, user, refresh }) {
  const paid  = payments.filter(p => p.status === 'paid').length
  const total = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const [thumbs, setThumbs] = useState({})

  useEffect(() => {
    if (!properties.length) return
    API.get('/photos/thumbnails', { params: { ids: properties.map(p => p.id).join(',') } })
      .then(res => { if (res.data && typeof res.data === 'object') setThumbs(res.data) })
      .catch(() => {})
  }, [properties.length])

  const stats = [
    { icon: '🏢', label: 'Properties',  value: properties.length,  color: '#667eea', tab: 'properties' },
    { icon: '👥', label: 'Tenants',      value: tenants.length,     color: '#06b6d4', tab: 'tenants'    },
    { icon: '📄', label: 'Agreements',   value: agreements.length,  color: '#8b5cf6', tab: 'agreements' },
    { icon: '✅', label: 'Paid Rents',   value: paid,               color: '#10b981', tab: 'payments'   },
  ]

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Good day, {user?.name} 👋</h2>
          <p className={styles.subtitle}>Portfolio overview • Total collected ₹{total.toLocaleString()}</p>
        </div>
        <button
          className={styles.sortBtn}
          onClick={() => refresh(false)}
          title="Refresh data"
          style={{ fontSize: '1.1rem', padding: '0.5rem 1rem' }}
        >
          🔄 Refresh
        </button>
      </div>

      <div className={styles.statsGrid}>
        {stats.map((s, i) => (
          <div key={i} className={styles.statCard} onClick={() => setActiveTab(s.tab)} style={{ borderTopColor: s.color }}>
            <div className={styles.statIcon} style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div><div className={styles.statValue}>{s.value}</div><div className={styles.statLabel}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Property cards preview */}
      <h3 className={styles.sectionHeading}>Your Properties</h3>
      {properties.length === 0
        ? <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🏢</div>
            <p>No properties yet. Go to <strong>Properties</strong> tab to add your first one!</p>
          </div>
        : <div className={styles.cardGrid}>
            {properties.slice(0, 6).map(p => <PropCard key={p.id} p={p} thumb={thumbs[p.id] || null} />)}
          </div>      }

      <div className={styles.overviewGrid} style={{ marginTop: '2rem' }}>
        <div className={styles.overviewCard}>
          <h3>Recent Tenants</h3>
          {tenants.slice(0, 5).map(t => (
            <div key={t.id} className={styles.listRow}>
              <div className={styles.miniAvatar}>{t.name?.[0]?.toUpperCase()}</div>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>{t.name}</div>
                <div className={styles.listSub}>{t.email}</div>
              </div>
              <div className={styles.listBadge2}>#{t.property_id}</div>
            </div>
          ))}
          {tenants.length === 0 && <p className={styles.empty}>No tenants yet</p>}
        </div>
        <div className={styles.overviewCard}>
          <h3>Recent Payments</h3>
          {payments.slice(0, 5).map(p => (
            <div key={p.id} className={styles.listRow}>
              <span className={styles.listIcon}>💰</span>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>₹{p.amount?.toLocaleString()}</div>
                <div className={styles.listSub}>{p.date}</div>
              </div>
              <span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status}</span>
            </div>
          ))}
          {payments.length === 0 && <p className={styles.empty}>No payments yet</p>}
        </div>
      </div>
    </div>
  )
}

function PropCard({ p, onDelete, onArchive, showManage = false, thumb = null, onThumbChanged = null }) {
  const [expanded, setExpanded] = useState(false)

  const handlePhotosChanged = (propertyId, photos) => {
    if (!onThumbChanged) return
    // Find the thumbnail photo or fall back to first
    const thumbPhoto = photos.find(ph => ph.is_thumbnail) || photos[0]
    onThumbChanged(propertyId, thumbPhoto?.url || null)
  }

  return (
    <div className={styles.propCard}>
      <div className={styles.propCardPhotoWrap}>
        {thumb
          ? <img src={thumb} alt={p.title} />
          : <div className={styles.propCardPhotoPlaceholder}>🏢</div>
        }
      </div>
      <div className={styles.propCardBody}>
        <div className={styles.propCardHeader}>
          <span />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {onArchive && <button className={styles.archiveBtn} onClick={() => onArchive(p.id)} title="Archive">🗄️</button>}
            {onDelete  && <button className={styles.deleteBtn}  onClick={() => onDelete(p.id)}  title="Delete">🗑️</button>}
          </div>
        </div>
        <h4>{p.title}</h4>
        <p className={styles.propLocation}>📍 {p.location}</p>
        <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
        <div className={styles.propId}>ID #{p.id}</div>
        {showManage && (
          <button className={styles.managePhotosBtn} onClick={() => setExpanded(v => !v)}>
            📸 {expanded ? 'Hide Photos' : 'Manage Photos'}
          </button>
        )}
        {showManage && expanded && (
          <PhotoUploader propertyId={p.id} propertyTitle={p.title} onPhotosChanged={handlePhotosChanged} />
        )}
      </div>
    </div>
  )
}

/* ── PROPERTIES ───────────────────────────────────────────────── */
function Properties({ properties, user, refresh }) {
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('title')
  const [sortDir, setSortDir]   = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm]           = useState({ title: '', location: '', price: '' })
  const [saving, setSaving]       = useState(false)
  const [newPropId, setNewPropId] = useState(null)
  const [thumbs, setThumbs]       = useState({})

  useEffect(() => {
    if (!properties.length) return
    API.get('/photos/thumbnails', { params: { ids: properties.map(p => p.id).join(',') } })
      .then(res => { if (res.data && typeof res.data === 'object') setThumbs(res.data) })
      .catch(() => {})
  }, [properties.length])

  const available = properties.filter(p => (p.status || 'available') === 'available')
  const archived  = properties.filter(p => p.status === 'archived')

  const filtered = available
    .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv||'').toLowerCase() }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const filteredArchived = archived
    .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase()))

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await API.post('/properties/', {
        title: form.title, location: form.location,
        price: parseFloat(form.price), owner_id: user?.id || 1
      })
      const created = res.data?.data?.[0]
      if (created?.id) {
        setNewPropId(created.id)
        toast.success('Property added! 🏢 Add photos below — or skip to finish.')
      } else {
        toast.success('Property added! 🏢')
        setShowForm(false)
      }
      setForm({ title: '', location: '', price: '' })
      refresh()
    } catch { toast.error('Failed to add property') }
    finally { setSaving(false) }
  }

  const handleDoneWithPhotos = () => {
    setNewPropId(null)
    setShowForm(false)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this property? This cannot be undone.')) return
    try { await API.delete(`/properties/${id}`); toast.success('Property deleted'); refresh() }
    catch { toast.error('Failed to delete') }
  }

  const handleArchive = async (id) => {
    try {
      await API.patch(`/properties/${id}/archive`)
      toast.success('Property archived 🗄️'); refresh()
    } catch { toast.error('Failed to archive') }
  }

  const handleUnarchive = async (id) => {
    try {
      await API.patch(`/properties/${id}/unarchive`)
      toast.success('Property available again ✅'); refresh()
    } catch { toast.error('Failed to unarchive') }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>My Properties</h2>
          <p className={styles.subtitle}>{available.length} available · {archived.length} archived</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Property'}</button>
      </div>

      {showForm && (
        <div className={styles.formBox}>
          <h3>📋 Add New Property</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Title (e.g. 2BHK Flat Kothrud)"   value={form.title}    onChange={e => setForm({...form, title: e.target.value})} required />
            <input placeholder="Location (e.g. Pune, Maharashtra)" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required />
            <input type="number" placeholder="Rent per month (₹)"  value={form.price}    onChange={e => setForm({...form, price: e.target.value})} required min="0" />
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : '✓ Add Property'}</button>
          </form>
        </div>
      )}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search title or location…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="title">Sort: Title</option>
          <option value="location">Sort: Location</option>
          <option value="price">Sort: Price</option>
        </select>
        <button className={styles.sortBtn} onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Available Properties */}
      <h3 className={styles.sectionHeading}>✅ Available ({filtered.length})</h3>
      {filtered.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>🏢</div><p>{search ? 'No results.' : 'No available properties. Add one!'}</p></div>
        : <div className={styles.cardGrid}>
            {filtered.map(p => <PropCard key={p.id} p={p} onDelete={handleDelete} onArchive={handleArchive} showManage={true} thumb={thumbs[p.id] || null} onThumbChanged={(pid, url) => setThumbs(t => ({ ...t, [pid]: url }))} />)}
          </div>
      }

      {/* Archived Properties */}
      {archived.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0 1rem' }}>
            <h3 className={styles.sectionHeading} style={{ margin: 0 }}>🗄️ Archived / Occupied ({archived.length})</h3>
            <button className={styles.sortBtn} onClick={() => setShowArchived(v => !v)}>
              {showArchived ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
          {showArchived && (
            <div className={styles.cardGrid}>
              {filteredArchived.map(p => (
                <div key={p.id} className={styles.propCard} style={{ opacity: 0.75, borderStyle: 'dashed' }}>
                  <div className={styles.propCardBody}>
                    <div className={styles.propCardHeader}>
                      <span className={styles.propIcon}>🗄️</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className={styles.unarchiveBtn} onClick={() => handleUnarchive(p.id)} title="Make available again">↩️</button>
                        <button className={styles.deleteBtn}    onClick={() => handleDelete(p.id)}    title="Delete permanently">🗑️</button>
                      </div>
                    </div>
                    <h4>{p.title}</h4>
                    <p className={styles.propLocation}>📍 {p.location}</p>
                    <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
                    <span className={styles.archivedBadge}>Occupied / Archived</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── TENANTS ──────────────────────────────────────────────────── */
function Tenants({ tenants, properties, refresh }) {
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('name')
  const [sortDir, setSortDir]   = useState('asc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', phone: '', email: '', property_id: '' })
  const [saving, setSaving]     = useState(false)

  const filtered = tenants
    .filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search))
    .sort((a, b) => { let av = String(a[sortBy]||'').toLowerCase(), bv = String(b[sortBy]||'').toLowerCase(); return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1) })

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await API.post('/tenants/', { ...form, property_id: parseInt(form.property_id) })
      toast.success('Tenant added!'); refresh(); setShowForm(false); setForm({ name:'',phone:'',email:'',property_id:'' })
    } catch { toast.error('Failed to add') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Tenants</h2><p className={styles.subtitle}>{tenants.length} registered tenants</p></div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Tenant'}</button>
      </div>
      {showForm && (
        <div className={styles.formBox}>
          <h3>👤 Add Tenant</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <input placeholder="Full Name"    value={form.name}  onChange={e => setForm({...form,name:e.target.value})} required />
            <input placeholder="Phone"        value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} required />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required />
            <select value={form.property_id} onChange={e => setForm({...form,property_id:e.target.value})} required>
              <option value="">— Select Property —</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.title} · {p.location}</option>)}
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving?'Saving...':'✓ Add Tenant'}</button>
          </form>
        </div>
      )}
      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search name, email or phone…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option><option value="email">Sort: Email</option>
        </select>
        <button className={styles.sortBtn} onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑ Asc':'↓ Desc'}</button>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Property</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.map(t => {
              const prop = properties.find(p => p.id === t.property_id)
              return (
                <tr key={t.id}>
                  <td><div className={styles.tenantName}><div className={styles.miniAvatar}>{t.name?.[0]?.toUpperCase()}</div>{t.name}</div></td>
                  <td>{t.phone}</td>
                  <td>{t.email}</td>
                  <td><span className={styles.badge}>{prop ? prop.title : `#${t.property_id}`}</span></td>
                  <td>
                    <button
                      className={styles.rejectBtn}
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={async () => {
                        if (!window.confirm(`Remove ${t.name}? This will unarchive their property.`)) return
                        try {
                          await API.delete(`/tenants/${t.id}`)
                          toast.success(`${t.name} removed. Property is available again ✅`)
                          refresh()
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Failed to remove')
                        }
                      }}
                    >
                      🚪 Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length===0 && <p className={styles.empty}>No tenants found.</p>}
      </div>
    </div>
  )
}

/* ── PAYMENTS ─────────────────────────────────────────────────── */
function Payments({ payments, tenants, refresh }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ tenant_id:'', amount:'', date:'', status:'paid' })
  const [saving, setSaving]             = useState(false)

  const filtered = payments.filter(p => {
    const t = tenants.find(t=>t.id===p.tenant_id)
    return (statusFilter==='all'||p.status===statusFilter) &&
      (t?.name?.toLowerCase().includes(search.toLowerCase()) || String(p.tenant_id).includes(search))
  })
  const total = filtered.reduce((s,p)=>s+(p.amount||0),0)

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await API.post('/payments/', { tenant_id:parseInt(form.tenant_id), amount:parseFloat(form.amount), date:form.date, status:form.status })
      toast.success('Payment recorded!'); refresh(); setShowForm(false); setForm({tenant_id:'',amount:'',date:'',status:'paid'})
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Payments</h2><p className={styles.subtitle}>{payments.length} total · ₹{total.toLocaleString()} shown</p></div>
        <button className={styles.addBtn} onClick={()=>setShowForm(v=>!v)}>{showForm?'✕ Cancel':'+ Record Payment'}</button>
      </div>
      {showForm && (
        <div className={styles.formBox}>
          <h3>💳 Record Payment</h3>
          <form onSubmit={handleAdd} className={styles.inlineForm}>
            <select value={form.tenant_id} onChange={e=>setForm({...form,tenant_id:e.target.value})} required><option value="">— Tenant —</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <input type="number" placeholder="Amount ₹" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required />
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required />
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="paid">✅ Paid</option><option value="pending">⏳ Pending</option><option value="overdue">❌ Overdue</option>
            </select>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving?'Saving...':'✓ Record'}</button>
          </form>
        </div>
      )}
      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search tenant…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className={styles.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">All</option><option value="paid">✅ Paid</option><option value="pending">⏳ Pending</option><option value="overdue">❌ Overdue</option>
        </select>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Tenant</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((p,i)=>{
              const t=tenants.find(t=>t.id===p.tenant_id)
              return <tr key={p.id}><td>{i+1}</td><td><div className={styles.tenantName}><div className={styles.miniAvatar}>{t?.name?.[0]?.toUpperCase()||'?'}</div>{t?.name||`#${p.tenant_id}`}</div></td><td>₹{p.amount?.toLocaleString()}</td><td>{p.date}</td><td><span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status==='paid'?'✅':p.status==='pending'?'⏳':'❌'} {p.status}</span></td></tr>
            })}
          </tbody>
        </table>
        {filtered.length===0 && <p className={styles.empty}>No payments found.</p>}
      </div>
    </div>
  )
}

/* ── INCOMING REQUESTS ────────────────────────────────────────── */
function IncomingRequests({ requests, refresh }) {
  const [acting, setActing] = useState({})

  const handle = async (id, action) => {
    setActing(s => ({ ...s, [id]: action }))
    try {
      await API.post(`/requests/${id}/${action}`)
      toast.success(action === 'accept' ? '✅ Request accepted! Agreement created.' : '❌ Request rejected.')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setActing(s => ({ ...s, [id]: null }))
    }
  }

  const pending      = requests.filter(r => r.status === 'pending')
  const others       = requests.filter(r => r.status !== 'pending')
  const statusColor  = { pending: '#f59e0b', accepted: '#10b981', rejected: '#ef4444' }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Rental Requests 📬</h2>
          <p className={styles.subtitle}>{pending.length} pending · {requests.length} total</p>
        </div>
      </div>

      {pending.length > 0 && <h3 className={styles.sectionHeading}>⏳ Pending Requests</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {pending.map(r => (
          <div key={r.id} className={styles.requestCard}>
            <div className={styles.requestLeft}>
              <div className={styles.miniAvatar}>{r.tenant?.name?.[0]?.toUpperCase() || '?'}</div>
              <div>
                <h4>{r.tenant?.name || 'Unknown Tenant'}</h4>
                <p>📧 {r.tenant?.email}</p>
                <p>📞 {r.tenant?.phone || r.phone}</p>
                <p>🏢 <strong>{r.property?.title}</strong> · 📍{r.property?.location}</p>
                <p>📅 {r.start_date} → {r.end_date}</p>
              </div>
            </div>
            <div className={styles.requestRight}>
              <button
                className={styles.acceptBtn}
                onClick={() => handle(r.id, 'accept')}
                disabled={acting[r.id]}
              >
                {acting[r.id] === 'accept' ? '...' : '✅ Accept'}
              </button>
              <button
                className={styles.rejectBtn}
                onClick={() => handle(r.id, 'reject')}
                disabled={acting[r.id]}
              >
                {acting[r.id] === 'reject' ? '...' : '❌ Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {others.length > 0 && (
        <>
          <h3 className={styles.sectionHeading}>History</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>Tenant</th><th>Property</th><th>Dates</th><th>Status</th></tr></thead>
              <tbody>
                {others.map(r => (
                  <tr key={r.id}>
                    <td><div className={styles.tenantName}><div className={styles.miniAvatar}>{r.tenant?.name?.[0]?.toUpperCase()}</div>{r.tenant?.name}</div></td>
                    <td>{r.property?.title}</td>
                    <td>{r.start_date} → {r.end_date}</td>
                    <td><span className={styles.statusBadge} style={{ background: statusColor[r.status]+'20', color: statusColor[r.status] }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {requests.length === 0 && (
        <div className={styles.emptyState}><div className={styles.emptyIcon}>📬</div><p>No rental requests yet. Tenants will appear here when they apply.</p></div>
      )}
    </div>
  )
}

/* ── AGREEMENTS (with approve + vacate handling) ─────────────── */
function Agreements({ properties, tenants, agreements, refresh }) {
  const [approving, setApproving]   = useState({})
  const [confirming, setConfirming] = useState({})

  const statusColor = {
    active:           '#10b981',
    pending_approval: '#f59e0b',
    vacating_pending: '#f97316',
    terminated:       '#94a3b8',
    rejected:         '#ef4444'
  }
  const statusLabel = {
    active:           '✅ Active',
    pending_approval: '⏳ Pending',
    vacating_pending: '🚪 Leaving',
    terminated:       '🔴 Terminated',
    rejected:         '❌ Rejected'
  }

  const handleApprove = async (agId) => {
    setApproving(s => ({ ...s, [agId]: true }))
    try {
      const res = await API.post(`/requests/agreements/${agId}/owner-approve`)
      toast.success(res.data.message); refresh()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setApproving(s => ({ ...s, [agId]: false })) }
  }

  const handleConfirmVacate = async (agId) => {
    if (!window.confirm('Confirm tenant has left? Property will become available again.')) return
    setConfirming(s => ({ ...s, [agId]: 'confirm' }))
    try {
      await API.post(`/requests/confirm-vacate/${agId}`)
      toast.success('Confirmed! Property is now available ✅'); refresh()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setConfirming(s => ({ ...s, [agId]: null })) }
  }

  const handleRejectVacate = async (agId) => {
    setConfirming(s => ({ ...s, [agId]: 'reject' }))
    try {
      await API.post(`/requests/reject-vacate/${agId}`)
      toast.success('Vacating rejected. Tenant stays.'); refresh()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setConfirming(s => ({ ...s, [agId]: null })) }
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Rental Agreements</h2><p className={styles.subtitle}>{agreements.length} total</p></div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Tenant</th><th>Property</th><th>Dates</th><th>Rent</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {agreements.map((ag, i) => {
              const t  = tenants.find(t => t.id === ag.tenant_id)
              const p  = properties.find(p => p.id === ag.property_id)
              const st = ag.status || 'active'
              // Use enriched fields from backend if available
              const tname  = ag.tenant_name  || t?.name  || `#${ag.tenant_id}`
              const ptitle = ag.property_title || p?.title || `#${ag.property_id}`
              const tletter = tname[0]?.toUpperCase() || '?'
              return (
                <tr key={ag.id}>
                  <td>{i + 1}</td>
                  <td><div className={styles.tenantName}><div className={styles.miniAvatar}>{tletter}</div>{tname}</div></td>
                  <td>{ptitle}</td>
                  <td style={{ fontSize:'0.82rem' }}>{ag.start_date} → {ag.end_date}</td>
                  <td>₹{ag.rent?.toLocaleString()}</td>
                  <td><span className={styles.statusBadge} style={{ background:(statusColor[st]||'#94a3b8')+'20', color:statusColor[st]||'#94a3b8' }}>{statusLabel[st]||st}</span></td>
                  <td>
                    {st === 'pending_approval' && !ag.owner_approved &&
                      <button className={styles.approveBtn} onClick={() => handleApprove(ag.id)} disabled={approving[ag.id]}>
                        {approving[ag.id] ? '...' : '✅ Approve'}
                      </button>
                    }
                    {st === 'vacating_pending' &&
                      <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                        <button className={styles.acceptBtn} style={{ padding:'0.3rem 0.7rem', fontSize:'0.78rem' }}
                          onClick={() => handleConfirmVacate(ag.id)} disabled={!!confirming[ag.id]}>
                          {confirming[ag.id]==='confirm' ? '...' : '✅ Confirm'}
                        </button>
                        <button className={styles.rejectBtn} style={{ padding:'0.3rem 0.7rem', fontSize:'0.78rem' }}
                          onClick={() => handleRejectVacate(ag.id)} disabled={!!confirming[ag.id]}>
                          {confirming[ag.id]==='reject' ? '...' : '❌ Reject'}
                        </button>
                      </div>
                    }
                    {st === 'active' && ag.owner_approved &&
                      <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>Active ✓</span>
                    }
                    {(st === 'terminated' || st === 'rejected') &&
                      <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>Ended</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {agreements.length===0 && <p className={styles.empty}>No agreements yet. Accept a rental request to create one.</p>}
      </div>
    </div>
  )
}
