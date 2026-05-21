import axios from 'axios'
import { auth } from './firebase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
})

// Attach a fresh Firebase token to every request
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// On 401, force-refresh the token and retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const user = auth.currentUser
        if (user) {
          const token = await user.getIdToken(true)
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        }
      } catch {
        // Token refresh failed — fall through to reject
      }
    }
    return Promise.reject(error)
  }
)

export const uploadPDF = async (file, onUploadProgress) => {
  const formData = new FormData()
  formData.append('pdf', file)
  const response = await api.post('/study/upload', formData, {
    headers: { 'Content-Type': undefined }, // let browser set multipart boundary
    timeout: 180000, // 3 min — HF cold-start can be slow
    onUploadProgress
  })
  return response.data
}

export const getStudySession = async (sessionId) => {
  const response = await api.get(`/study/${sessionId}`)
  return response.data
}

export const getUserSessions = async () => {
  const response = await api.get('/study/user')
  return response.data
}

export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/study/${sessionId}`)
  return response.data
}

export const saveScore = async (sessionId, correct, total) => {
  const response = await api.post(`/study/scores/${sessionId}`, { correct, total })
  return response.data
}

// Returns a cleanup function. onEvent receives { stage, message?, sessionId?, error? }
export const connectUploadProgress = (jobId, onEvent) => {
  const url = `${API_BASE_URL}/study/upload-progress/${jobId}`
  const es = new EventSource(url)

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      onEvent(data)
      if (data.stage === 'complete' || data.stage === 'error') es.close()
    } catch { /* ignore malformed frames */ }
  }

  es.onerror = () => {
    es.close()
    onEvent({ stage: 'error', message: 'Lost connection to server.' })
  }

  return () => es.close()
}

export default api
