import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill all fields')
      return
    }
    setLoading(true)
    try {
      const res = await API.post('/users/login', {
        email: form.email,
        password: form.password
      })

      if (res.data.access_token) {
        const userRole = res.data.user?.role || 'owner'
        login(res.data.access_token, {
          id:    res.data.user?.id,
          email: form.email,
          role:  userRole,
          name:  res.data.user?.name || form.email.split('@')[0],
          phone: res.data.user?.phone || ''
        })
        toast.success(`Welcome back, ${res.data.user?.name}! 👋`)
        navigate(userRole === 'tenant' ? '/tenant' : '/owner')
      } else {
        toast.error(String(res.data.error || 'Invalid credentials'))
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.authContainer}>
      {/* Left Panel */}
      <div className={styles.leftPanel}>
        <Link to="/" className={styles.backBtn}>← Back to Home</Link>
        <div className={styles.leftContent}>
          <div className={styles.leftLogo}>🏠</div>
          <h2>Rentpro</h2>
          <p>Your complete rental management solution</p>
          <div className={styles.leftFeatures}>
            <div className={styles.leftFeature}><span>✓</span> Manage Properties</div>
            <div className={styles.leftFeature}><span>✓</span> Track Payments</div>
            <div className={styles.leftFeature}><span>✓</span> Digital Agreements</div>
            <div className={styles.leftFeature}><span>✓</span> Tenant Management</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Welcome back</h1>
            <p>Sign in — your role is detected automatically</p>
          </div>

          <div className={styles.roleInfo} style={{ marginBottom: '1.2rem' }}>
            🔐 Owner or Tenant — just enter your credentials and we'll take you to the right place
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>📧</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Sign In →'}
            </button>
          </form>

          <div className={styles.roleCards}>
            <div className={styles.roleHint}>
              <span>👤</span>
              <div>
                <strong>Owner?</strong>
                <p>Manage properties & tenants</p>
              </div>
            </div>
            <div className={styles.roleHint}>
              <span>🏠</span>
              <div>
                <strong>Tenant?</strong>
                <p>Browse & apply for rent</p>
              </div>
            </div>
          </div>

          <p className={styles.switchText}>
            Don't have an account?{' '}
            <Link to="/signup" className={styles.switchLink}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
