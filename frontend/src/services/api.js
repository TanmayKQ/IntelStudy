import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
})

api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('firebaseToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export const uploadPDF = async (file) => {
  const formData = new FormData()
  formData.append('pdf', file)
  
  const token = localStorage.getItem('firebaseToken')
  const response = await axios.post(`${API_BASE_URL}/study/upload`, formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
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

export default api

