import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import Landing        from './pages/Landing'
import Login          from './pages/Login'
import Signup         from './pages/Signup'
import OwnerDashboard  from './pages/OwnerDashboard'
import TenantDashboard from './pages/TenantDashboard'

function ProtectedRoute({ children, role }) {
  const { user, ready } = useAuth()

  // Wait until localStorage is read — don't redirect prematurely
  if (!ready) return <div style={splashStyle}><span style={spinStyle} /></div>

  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'tenant' ? '/tenant' : '/owner'} replace />
  return children
}

function AppRoutes() {
  const { user, ready } = useAuth()

  // Show splash while restoring session
  if (!ready) return <div style={splashStyle}><span style={spinStyle} /></div>

  return (
    <Routes>
      <Route path="/"       element={<Landing />} />
      <Route path="/login"  element={user ? <Navigate to={user.role === 'tenant' ? '/tenant' : '/owner'} replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to={user.role === 'tenant' ? '/tenant' : '/owner'} replace /> : <Signup />} />
      <Route path="/owner/*" element={
        <ProtectedRoute role="owner">
          <OwnerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/tenant/*" element={
        <ProtectedRoute role="tenant">
          <TenantDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const splashStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f0f4f8'
}

const spinStyle = {
  display: 'inline-block',
  width: 40,
  height: 40,
  border: '4px solid #e2e8f0',
  borderTopColor: '#667eea',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite'
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '10px',
              fontSize: '14px'
            }
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
