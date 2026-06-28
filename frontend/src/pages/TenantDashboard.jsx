import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import API from '../api/axios'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import PhotoGallery from '../components/PhotoGallery'
import styles from './Dashboard.module.css'
import cartStyles from './Cart.module.css'

const TABS = [
  { id: 'overview',   icon: '📊', label: 'Overview'        },
  { id: 'browse',     icon: '🏢', label: 'Browse'          },
  { id: 'cart',       icon: '🛒', label: 'My Cart'         },
  { id: 'requests',   icon: '📬', label: 'My Requests'     },
  { id: 'agreements', icon: '📄', label: 'My Agreements'   },
  { id: 'payments',   icon: '💳', label: 'My Payments'     },
]

export default function TenantDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]   = useState('overview')
  const [properties, setProperties] = useState([])
  const [payments, setPayments]     = useState([])
  const [agreements, setAgreements] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [cart, setCart]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError]   = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    fetchAll(true)
    const saved = localStorage.getItem('pd_cart')
    if (saved) try { setCart(JSON.parse(saved)) } catch {}
  }, [])

  const fetchAll = async (initial = false, attempt = 0) => {
    if (initial) { setLoading(true); setLoadError(false) }
    else setRefreshing(true)

    const [p, pay, ag, reqs] = await Promise.allSettled([
      API.get('/properties/all'),
      API.get('/payments/my'),
      API.get('/agreements/my'),
      API.get('/requests/my'),
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

    if (p.status    === 'fulfilled' && Array.isArray(p.value.data))    setProperties(p.value.data)
    if (pay.status  === 'fulfilled' && Array.isArray(pay.value.data))  setPayments(pay.value.data)
    if (ag.status   === 'fulfilled' && Array.isArray(ag.value.data))   setAgreements(ag.value.data)
    if (reqs.status === 'fulfilled' && Array.isArray(reqs.value.data)) setMyRequests(reqs.value.data)

    setLoading(false)
    setRefreshing(false)
  }

  const saveCart = (items) => {
    setCart(items)
    localStorage.setItem('pd_cart', JSON.stringify(items))
  }

  const addToCart = (property) => {
    if (cart.find(c => c.property.id === property.id)) {
      toast.error('Already in your cart!')
      return
    }
    const updated = [...cart, { property, phone: user?.phone || '', startDate: '', endDate: '' }]
    saveCart(updated)
    toast.success(`${property.title} added to cart! 🛒`)
    setActiveTab('cart')
  }

  const removeFromCart = (propertyId) => {
    saveCart(cart.filter(c => c.property.id !== propertyId))
    toast.success('Removed from cart')
  }

  const updateCartItem = (propertyId, field, value) => {
    saveCart(cart.map(c => c.property.id === propertyId ? { ...c, [field]: value } : c))
  }

  const cartCount = cart.length

  const tabsWithBadge = TABS.map(t =>
    t.id === 'cart' && cartCount > 0
      ? { ...t, label: `🛒 Cart (${cartCount})` }
      : t
  )

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
            {activeTab === 'overview'   && <TenantOverview properties={properties} payments={payments} agreements={agreements} myRequests={myRequests} user={user} setActiveTab={setActiveTab} cartCount={cartCount} refresh={fetchAll} />}
            {activeTab === 'browse'     && <BrowseProperties properties={properties} agreements={agreements} myRequests={myRequests} addToCart={addToCart} cart={cart} />}
            {activeTab === 'cart'       && <CartPage cart={cart} removeFromCart={removeFromCart} updateCartItem={updateCartItem} saveCart={saveCart} user={user} refresh={fetchAll} setActiveTab={setActiveTab} />}
            {activeTab === 'requests'   && <MyRequests myRequests={myRequests} agreements={agreements} refresh={fetchAll} />}
            {activeTab === 'agreements' && <MyAgreements agreements={agreements} properties={properties} refresh={fetchAll} />}
            {activeTab === 'payments'   && <MyPayments payments={payments} />}
          </>
        }
      </div>
    </div>
  )
}

/* ── OVERVIEW ─────────────────────────────────────────────── */
function TenantOverview({ properties, payments, agreements, user, setActiveTab, cartCount, refresh }) {
  const paid    = payments.filter(p => p.status === 'paid').length
  const [thumbs, setThumbs] = useState({})

  useEffect(() => {
    if (!properties.length) return
    API.get('/photos/thumbnails', { params: { ids: properties.map(p => p.id).join(',') } })
      .then(res => { if (res.data && typeof res.data === 'object') setThumbs(res.data) })
      .catch(() => {})
  }, [properties.length])

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2>Welcome, {user?.name} 🏡</h2>
          <p className={styles.subtitle}>Your rental dashboard</p>
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
        {[
          { icon: '🏢', label: 'Available Props',  value: properties.length, color: '#667eea', tab: 'browse'     },
          { icon: '📄', label: 'My Agreements',     value: agreements.length, color: '#8b5cf6', tab: 'agreements' },
          { icon: '✅', label: 'Paid',               value: paid,             color: '#10b981', tab: 'payments'   },
          { icon: '🛒', label: 'Cart Items',         value: cartCount,        color: '#f59e0b', tab: 'cart'       },
        ].map((s, i) => (
          <div key={i} className={styles.statCard} onClick={() => setActiveTab(s.tab)} style={{ borderTopColor: s.color }}>
            <div className={styles.statIcon} style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div><div className={styles.statValue}>{s.value}</div><div className={styles.statLabel}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionHeading}>Available Properties</h3>
      {properties.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>🏢</div><p>No properties available yet.</p></div>
        : <div className={styles.cardGrid}>
            {properties.slice(0, 6).map(p => (
              <div key={p.id} className={styles.propCard}>
                <div className={styles.propCardPhotoWrap}>
                  {thumbs[p.id]
                    ? <img src={thumbs[p.id]} alt={p.title} />
                    : <div className={styles.propCardPhotoPlaceholder}>🏢</div>
                  }
                </div>
                <div className={styles.propCardBody}>
                  <div className={styles.propCardHeader}>
                    <span className={styles.availBadge}>Available</span>
                  </div>
                  <h4>{p.title}</h4>
                  <p className={styles.propLocation}>📍 {p.location}</p>
                  <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
                  <button className={styles.contactBtn} onClick={() => setActiveTab('browse')}>View Details →</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

/* ── BROWSE PROPERTIES ────────────────────────────────────── */
function BrowseProperties({ properties, agreements, myRequests, addToCart, cart }) {
  const [search, setSearch]       = useState('')
  const [maxPrice, setMaxPrice]   = useState('')
  const [sortBy, setSortBy]       = useState('price')
  const [sortDir, setSortDir]     = useState('asc')
  const [selected, setSelected]   = useState(null)
  const [thumbs, setThumbs]       = useState({})  // propertyId -> thumbnail url

  // Properties with an active agreement OR a pending/accepted request
  const alreadyRequested = [
    ...agreements.map(a => a.property_id),
    ...myRequests.map(r => r.property_id)
  ]
  const inCart = cart.map(c => c.property.id)

  // Fetch thumbnails for all properties in ONE call
  useEffect(() => {
    if (!properties.length) return
    const propIds = properties.map(p => p.id)
    // Batch fetch all thumbnails at once
    API.get('/photos/thumbnails', { params: { ids: propIds.join(',') } })
      .then(res => {
        if (res.data && typeof res.data === 'object') setThumbs(res.data)
      })
      .catch(() => {
        // Silently fail — no thumbnails shown
      })
  }, [properties.length])

  const filtered = properties
    .filter(p => {
      const matchSearch = p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.location?.toLowerCase().includes(search.toLowerCase())
      const matchPrice = !maxPrice || p.price <= parseFloat(maxPrice)
      return matchSearch && matchPrice
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv||'').toLowerCase() }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>Browse Properties</h2><p className={styles.subtitle}>{filtered.length} of {properties.length} available</p></div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="🔍  Search title or location…" value={search} onChange={e => setSearch(e.target.value)} />
        <input className={styles.search} style={{ maxWidth: 180 }} type="number" placeholder="Max Rent ₹" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="price">Sort: Price</option>
          <option value="title">Sort: Title</option>
          <option value="location">Sort: Location</option>
        </select>
        <button className={styles.sortBtn} onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'asc' ? '↑ Low→High' : '↓ High→Low'}
        </button>
      </div>

      <div className={styles.cardGrid}>
        {filtered.map(p => {
          const requested = alreadyRequested.includes(p.id)
          const carted    = inCart.includes(p.id)
          return (
            <div key={p.id} className={styles.propCard}>
              <div className={styles.propCardPhotoWrap}>
                {thumbs[p.id]
                  ? <img src={thumbs[p.id]} alt={p.title} />
                  : <div className={styles.propCardPhotoPlaceholder}>🏢</div>
                }
              </div>
              <div className={styles.propCardBody}>
                <div className={styles.propCardHeader}>
                  <span className={styles.availBadge} style={
                    requested ? { background: '#d1fae5', color: '#065f46' } :
                    carted    ? { background: '#fef3c7', color: '#92400e' } : {}
                  }>
                    {requested ? '✅ Requested' : carted ? '🛒 In Cart' : 'Available'}
                  </span>
                </div>
                <h4>{p.title}</h4>
                <p className={styles.propLocation}>📍 {p.location}</p>
                <div className={styles.propPrice}>₹{p.price?.toLocaleString()}<span>/month</span></div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.3rem 0' }}>Deposit: ₹{(p.price * 2)?.toLocaleString()}</p>
                <div className={styles.propActions}>
                  <button className={styles.detailBtn} onClick={() => setSelected(p)}>View Details</button>
                  {!requested && !carted &&
                    <button className={styles.cartBtn} onClick={() => addToCart(p)}>🛒 Add to Cart</button>
                  }
                  {carted && !requested &&
                    <button className={styles.cartedBtn} disabled>🛒 In Cart</button>
                  }
                  {requested &&
                    <button className={styles.requestedBtn} disabled>✅ Applied</button>
                  }
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className={styles.emptyState}><div className={styles.emptyIcon}>🔍</div><p>No properties match your search.</p></div>}
      </div>

      {/* Property Detail Modal */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelected(null)}>✕</button>
            {/* Photo Gallery */}
            <PhotoGallery propertyId={selected.id} />
            <h2 style={{ marginTop: '1rem' }}>{selected.title}</h2>
            <p className={styles.modalLocation}>📍 {selected.location}</p>
            <div className={styles.modalDetails}>
              <div className={styles.modalRow}><span>Monthly Rent</span><strong>₹{selected.price?.toLocaleString()}</strong></div>
              <div className={styles.modalRow}><span>Security Deposit</span><strong>₹{(selected.price * 2)?.toLocaleString()}</strong></div>
              <div className={styles.modalRow}><span>Property ID</span><strong>#{selected.id}</strong></div>
            </div>
            <div className={styles.modalActions}>
              {!alreadyRequested.includes(selected.id) && !inCart.includes(selected.id) &&
                <button className={styles.cartBtn} style={{ width: '100%' }} onClick={() => { addToCart(selected); setSelected(null) }}>
                  🛒 Add to Cart & Apply for Rent
                </button>
              }
              {inCart.includes(selected.id) && <p style={{ color: '#f59e0b', fontWeight: 700 }}>🛒 Already in your cart</p>}
              {alreadyRequested.includes(selected.id) && <p style={{ color: '#10b981', fontWeight: 700 }}>✅ Rental request already submitted</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── CART PAGE ────────────────────────────────────────────── */
function CartPage({ cart, removeFromCart, updateCartItem, saveCart, user, refresh, setActiveTab }) {
  const [submitting, setSubmitting] = useState({})

  const handleSubmitOne = async (item) => {
    if (!item.startDate || !item.endDate) { toast.error('Select start and end date for ' + item.property.title); return }
    if (!item.phone) { toast.error('Enter your phone number'); return }
    if (new Date(item.endDate) <= new Date(item.startDate)) { toast.error('End date must be after start date'); return }

    setSubmitting(s => ({ ...s, [item.property.id]: true }))
    try {
      const res = await API.post('/requests/', {
        property_id: item.property.id,
        phone:       item.phone,
        start_date:  item.startDate,
        end_date:    item.endDate,
        message:     ''
      })
      const ownerContact = res.data?.owner_contact
      toast.success(`Request sent for "${item.property.title}"! 🎉`)
      if (ownerContact?.phone) {
        toast.success(`Owner contact: ${ownerContact.name} — 📞 ${ownerContact.phone}`, { duration: 6000 })
      } else if (ownerContact?.email) {
        toast.success(`Owner email: ${ownerContact.email}`, { duration: 5000 })
      }
      removeFromCart(item.property.id)
      refresh()
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Failed to submit request'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) msg = detail[0]?.msg || JSON.stringify(detail)
      else if (detail) msg = JSON.stringify(detail)
      console.error('Request error:', err.response?.data)
      toast.error(msg)
    } finally {
      setSubmitting(s => ({ ...s, [item.property.id]: false }))
    }
  }

  const handleSubmitAll = async () => {
    const valid = cart.filter(c => c.startDate && c.endDate && c.phone)
    if (valid.length === 0) { toast.error('Fill in dates and phone for all items'); return }
    for (const item of valid) await handleSubmitOne(item)
  }

  if (cart.length === 0) {
    return (
      <div>
        <div className={styles.pageHeader}><div><h2>My Cart</h2><p className={styles.subtitle}>Properties you want to rent</p></div></div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛒</div>
          <p>Your cart is empty.<br />Browse properties and click <strong>"Add to Cart"</strong>!</p>
          <button className={styles.addBtn} style={{ marginTop: '1rem' }} onClick={() => setActiveTab('browse')}>Browse Properties →</button>
        </div>
      </div>
    )
  }

  const totalRent = cart.reduce((s, c) => s + (c.property.price || 0), 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div><h2>My Cart 🛒</h2><p className={styles.subtitle}>{cart.length} properties · ₹{totalRent.toLocaleString()}/month total</p></div>
        <button className={styles.addBtn} onClick={handleSubmitAll}>✅ Submit All Requests</button>
      </div>

      <div className={cartStyles.cartList}>
        {cart.map(item => (
          <div key={item.property.id} className={cartStyles.cartCard}>
            <div className={cartStyles.cartLeft}>
              <div className={cartStyles.cartIcon}>🏢</div>
              <div>
                <h3>{item.property.title}</h3>
                <p>📍 {item.property.location}</p>
                <div className={cartStyles.cartPrice}>₹{item.property.price?.toLocaleString()}<span>/month</span></div>
                <p className={cartStyles.cartDeposit}>Deposit: ₹{(item.property.price * 2)?.toLocaleString()}</p>
              </div>
            </div>
            <div className={cartStyles.cartRight}>
              <div className={cartStyles.cartField}>
                <label>📱 Phone</label>
                <input
                  type="tel"
                  placeholder="Your phone number"
                  value={item.phone}
                  onChange={e => updateCartItem(item.property.id, 'phone', e.target.value)}
                />
              </div>
              <div className={cartStyles.cartField}>
                <label>📅 Move-in Date</label>
                <input
                  type="date"
                  value={item.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => updateCartItem(item.property.id, 'startDate', e.target.value)}
                />
              </div>
              <div className={cartStyles.cartField}>
                <label>📅 Move-out Date</label>
                <input
                  type="date"
                  value={item.endDate}
                  min={item.startDate || new Date().toISOString().split('T')[0]}
                  onChange={e => updateCartItem(item.property.id, 'endDate', e.target.value)}
                />
              </div>
              <div className={cartStyles.cartBtns}>
                <button
                  className={cartStyles.submitBtn}
                  onClick={() => handleSubmitOne(item)}
                  disabled={submitting[item.property.id]}
                >
                  {submitting[item.property.id] ? 'Submitting…' : '✅ Apply for Rent'}
                </button>
                <button className={cartStyles.removeBtn} onClick={() => removeFromCart(item.property.id)}>🗑️ Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={cartStyles.cartSummary}>
        <div>Total Monthly Rent: <strong>₹{totalRent.toLocaleString()}</strong></div>
        <div>Total Deposit: <strong>₹{(totalRent * 2).toLocaleString()}</strong></div>
      </div>
    </div>
  )
}

/* ── MY AGREEMENTS ────────────────────────────────────────── */
function MyAgreements({ agreements, properties, refresh }) {
  const [approving, setApproving]   = useState({})
  const [leaving, setLeaving]       = useState({})

  const handleApprove = async (agId) => {
    setApproving(s => ({ ...s, [agId]: true }))
    try {
      const res = await API.post(`/requests/agreements/${agId}/tenant-approve`)
      toast.success(res.data.message); refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve')
    } finally { setApproving(s => ({ ...s, [agId]: false })) }
  }

  const handleLeave = async (agId, propTitle) => {
    if (!window.confirm(`Are you sure you want to leave "${propTitle}"?\n\nA leave request will be sent to the owner for confirmation.`)) return
    setLeaving(s => ({ ...s, [agId]: true }))
    try {
      const res = await API.post('/tenants/leave')
      toast.success(res.data.message || 'Leave request sent to owner! 🚪')
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send leave request')
    } finally { setLeaving(s => ({ ...s, [agId]: false })) }
  }

  const statusColor = {
    active:           '#10b981',
    pending_approval: '#f59e0b',
    vacating_pending: '#f97316',
    terminated:       '#94a3b8',
    rejected:         '#ef4444'
  }
  const statusLabel = {
    active:           '✅ Active',
    pending_approval: '⏳ Pending Approval',
    vacating_pending: '🚪 Leave Requested',
    terminated:       '🔴 Terminated',
    rejected:         '❌ Rejected'
  }

  return (
    <div>
      <div className={styles.pageHeader}><div><h2>My Agreements</h2><p className={styles.subtitle}>{agreements.length} agreements</p></div></div>
      {agreements.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>📄</div><p>No agreements yet. Apply for a property!</p></div>
        : <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>Property</th><th>Move-in</th><th>Move-out</th><th>Rent</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {agreements.map((ag, i) => {
                  const p  = properties.find(p => p.id === ag.property_id)
                  const st = ag.status || 'active'
                  return (
                    <tr key={ag.id}>
                      <td>{i + 1}</td>
                      <td><strong>{p?.title || `#${ag.property_id}`}</strong><br /><small>📍 {p?.location}</small></td>
                      <td>{ag.start_date}</td>
                      <td>{ag.end_date}</td>
                      <td>₹{ag.rent?.toLocaleString()}/mo</td>
                      <td><span className={styles.statusBadge} style={{ background: (statusColor[st]||'#94a3b8')+'20', color: statusColor[st]||'#94a3b8' }}>{statusLabel[st]||st}</span></td>
                      <td>
                        {st === 'pending_approval' && !ag.tenant_approved &&
                          <button className={styles.approveBtn} onClick={() => handleApprove(ag.id)} disabled={approving[ag.id]}>
                            {approving[ag.id] ? '...' : '✅ Sign'}
                          </button>
                        }
                        {st === 'active' &&
                          <button
                            className={styles.leaveBtn}
                            onClick={() => handleLeave(ag.id, p?.title || 'property')}
                            disabled={leaving[ag.id]}
                          >
                            {leaving[ag.id] ? '...' : '🚪 Leave'}
                          </button>
                        }
                        {st === 'vacating_pending' &&
                          <span style={{ fontSize: '0.78rem', color: '#f97316' }}>Waiting for owner…</span>
                        }
                        {(st === 'terminated' || st === 'rejected') &&
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Ended</span>
                        }
                        {st === 'pending_approval' && ag.tenant_approved &&
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Signed ✓</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}

/* ── MY REQUESTS ──────────────────────────────────────────── */
function MyRequests({ myRequests, agreements, refresh }) {
  const statusColor = { pending: '#f59e0b', accepted: '#10b981', rejected: '#ef4444' }
  const statusIcon  = { pending: '⏳', accepted: '✅', rejected: '❌' }

  return (
    <div>
      <div className={styles.pageHeader}><div><h2>My Rental Requests</h2><p className={styles.subtitle}>{myRequests.length} requests sent</p></div></div>
      {myRequests.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>📬</div><p>No requests yet. Browse properties and add to cart!</p></div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myRequests.map(r => (
              <div key={r.id} className={styles.requestCard}>
                <div className={styles.requestLeft}>
                  <span className={styles.propIcon}>🏢</span>
                  <div>
                    <h4>{r.property?.title || `Property #${r.property_id}`}</h4>
                    <p>📍 {r.property?.location}</p>
                    <p>📅 {r.start_date} → {r.end_date}</p>
                    <p>💰 ₹{r.property?.price?.toLocaleString()}/month</p>
                  </div>
                </div>
                <div className={styles.requestRight}>
                  <span className={styles.statusBadge} style={{ background: statusColor[r.status] + '20', color: statusColor[r.status], fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
                    {statusIcon[r.status]} {r.status?.toUpperCase()}
                  </span>
                  {r.status === 'accepted' && r.owner_contact && (
                    <div className={styles.ownerContact}>
                      <p><strong>🎉 Request Accepted!</strong></p>
                      <p>Owner: <strong>{r.owner_contact.name}</strong></p>
                      {r.owner_contact.phone && <p>📞 <strong>{r.owner_contact.phone}</strong></p>}
                      <p>📧 {r.owner_contact.email}</p>
                    </div>
                  )}
                  {r.status === 'rejected' && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>Request was declined by owner.</p>}
                  {r.status === 'pending'  && <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>Waiting for owner to respond…</p>}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

/* ── MY PAYMENTS ──────────────────────────────────────────── */
function MyPayments({ payments }) {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter)
  const total    = filtered.reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div>
      <div className={styles.pageHeader}><div><h2>My Payments</h2><p className={styles.subtitle}>Total: ₹{total.toLocaleString()}</p></div></div>
      <div className={styles.toolbar}>
        <select className={styles.select} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="paid">✅ Paid</option>
          <option value="pending">⏳ Pending</option>
          <option value="overdue">❌ Overdue</option>
        </select>
      </div>
      {filtered.length === 0
        ? <div className={styles.emptyState}><div className={styles.emptyIcon}>💳</div><p>No payment records yet.</p></div>
        : <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead><tr><th>#</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>₹{p.amount?.toLocaleString()}</td>
                    <td>{p.date}</td>
                    <td><span className={`${styles.statusBadge} ${styles[p.status]}`}>{p.status === 'paid' ? '✅' : p.status === 'pending' ? '⏳' : '❌'} {p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}
