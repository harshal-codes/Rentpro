import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const AuthContext = createContext()

// Decode JWT expiry without a library
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null  // convert to ms
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [token, setToken]   = useState(null)
  const [ready, setReady]   = useState(false)
  const logoutTimer         = useRef(null)

  const clearTimer = () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
  }

  const scheduleAutoLogout = (tokenValue, logoutFn) => {
    clearTimer()
    const expiry = getTokenExpiry(tokenValue)
    if (!expiry) return
    const msLeft = expiry - Date.now()
    if (msLeft <= 0) {
      logoutFn()
      return
    }
    // Warn user 2 minutes before expiry
    const warnAt = msLeft - 2 * 60 * 1000
    if (warnAt > 0) {
      setTimeout(() => {
        toast('⏰ Your session expires in 2 minutes. Save your work!', {
          duration: 8000,
          icon: '⚠️'
        })
      }, warnAt)
    }
    logoutTimer.current = setTimeout(() => {
      toast.error('Session expired. Please log in again.')
      logoutFn()
    }, msLeft)
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('pd_token')
    const savedUser  = localStorage.getItem('pd_user')
    if (savedToken && savedUser) {
      try {
        // Check if token is already expired
        const expiry = getTokenExpiry(savedToken)
        if (expiry && expiry < Date.now()) {
          // Token expired — clear storage
          localStorage.removeItem('pd_token')
          localStorage.removeItem('pd_user')
          localStorage.removeItem('pd_cart')
        } else {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
          scheduleAutoLogout(savedToken, doLogout)
        }
      } catch {
        localStorage.removeItem('pd_token')
        localStorage.removeItem('pd_user')
      }
    }
    setReady(true)
    return () => clearTimer()
  }, [])

  const doLogout = () => {
    clearTimer()
    localStorage.removeItem('pd_token')
    localStorage.removeItem('pd_user')
    localStorage.removeItem('pd_cart')
    setToken(null)
    setUser(null)
  }

  const login = (tokenValue, userData) => {
    localStorage.setItem('pd_token', tokenValue)
    localStorage.setItem('pd_user', JSON.stringify(userData))
    setToken(tokenValue)
    setUser(userData)
    scheduleAutoLogout(tokenValue, doLogout)
  }

  const logout = doLogout

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
