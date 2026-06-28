import axios from 'axios'

// Local dev: set VITE_API_URL=http://localhost:8000 in frontend/.env.local
// Production: defaults to the Render backend
const BASE_URL = import.meta.env.VITE_API_URL || 'https://property-dekho-becho.onrender.com'

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach token to every request if available
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('pd_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Pre-warm the backend on load (only for production)
if (!import.meta.env.VITE_API_URL) {
  axios.get(`${BASE_URL}/health`).catch(() => {})
}

export default API
