import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

export default function Signup() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState(searchParams.get('role') || 'owner')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const r = searchParams.get('role')
    if (r) setRole(r)
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all fields')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const res = await API.post('/users/register', {
        name:     form.name,
        email:    form.email,
        password: form.password,
        role:     role,
        phone:    form.phone || ''
      })

      if (res.data.error) {
        toast.error(String(res.data.error))
        setLoading(false)
        return
      }

      // Auto-login after register
      const loginRes = await API.post('/users/login', {
        email: form.email,
        password: form.password
      })

      if (loginRes.data.access_token) {
        login(loginRes.data.access_token, {
          id:    loginRes.data.user?.id,
          email: form.email,
          role:  loginRes.data.user?.role || role,
          name:  form.name,
          phone: form.phone || ''
        })
        toast.success(`Welcome ${form.name}! 🎉`)
        navigate(role === 'owner' ? '/owner' : '/tenant')
      } else {
        toast.error(String(loginRes.data.error || 'Login after signup failed'))
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const getStrength = (pass) => {
    if (!pass) return 0
    let s = 0
    if (pass.length >= 6) s++
    if (/[A-Z]/.test(pass)) s++
    if (/[0-9]/.test(pass)) s++
    if (/[^A-Za-z0-9]/.test(pass)) s++
    return s
  }
  const strength = getStrength(form.password)
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981']

  return (
    <div className={styles.authContainer}>
      {/* Left Panel */}
      <div className={styles.leftPanel}>
        <Link to="/" className={styles.backBtn}>← Back to Home</Link>
        <div className={styles.leftContent}>
          <div className={styles.leftLogo}>🏠</div>
          <h2>Join Property Dekho</h2>
          <p>Start managing your properties today</p>
          <div className={styles.leftFeatures}>
            <div className={styles.leftFeature}><span>✓</span> Free to get started</div>
            <div className={styles.leftFeature}><span>✓</span> No credit card needed</div>
            <div className={styles.leftFeature}><span>✓</span> Secure & encrypted</div>
            <div className={styles.leftFeature}><span>✓</span> Setup in 2 minutes</div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Create account</h1>
            <p>Join thousands of users today</p>
          </div>

          {/* Role Toggle */}
          <div className={styles.roleToggle}>
            <button
              className={role === 'owner' ? styles.roleActiveBtn : styles.roleInactiveBtn}
              onClick={() => setRole('owner')}
              type="button"
            >
              👤 Owner
            </button>
            <button
              className={role === 'tenant' ? styles.roleActiveBtn : styles.roleInactiveBtn}
              onClick={() => setRole('tenant')}
              type="button"
            >
              🏠 Tenant
            </button>
          </div>

          <div className={styles.roleInfo}>
            {role === 'owner'
              ? '🏢 Registering as a Property Owner'
              : '🏡 Registering as a Tenant'}
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Full Name</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>👤</span>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
            </div>

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
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Phone Number {role === 'tenant' ? '' : '(Optional)'}</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>📱</span>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  required={role === 'tenant'}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {form.password && (
                <div className={styles.strengthBar}>
                  {[1,2,3,4].map(i => (
                    <div key={i} className={styles.strengthSegment}
                      style={{ background: i <= strength ? strengthColors[strength] : '#e2e8f0' }}
                    />
                  ))}
                  <span style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</span>
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label>Confirm Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  required
                />
              </div>
              {form.confirm && form.password !== form.confirm && (
                <p className={styles.errorText}>Passwords do not match</p>
              )}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : `Create ${role === 'owner' ? 'Owner' : 'Tenant'} Account`}
            </button>
          </form>

          <p className={styles.switchText}>
            Already have an account?{' '}
            <Link to={`/login?role=${role}`} className={styles.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
