import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserSessions, deleteSession } from '../services/api'
import Loader from '../components/Loader'
import Navbar from '../components/Navbar'

// Simple logger for frontend
const logger = {
  error: (...args) => console.error(...args),
  info: (...args) => console.log(...args)
}

const Dashboard = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid or list
  const [sortBy, setSortBy] = useState('recent') // recent, name, date
  const [deletingId, setDeletingId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const fetchSessions = useCallback(async (retries = 2) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        setError('')
        const startTime = Date.now()
        const data = await getUserSessions()
        
        if (data && (data.sessions || Array.isArray(data.sessions))) {
          setSessions(data.sessions || [])
          const duration = Date.now() - startTime
          if (duration > 1000) {
            logger.info(`Sessions loaded in ${duration}ms (slow)`)
          }
          setLoading(false)
          return
        } else {
          throw new Error('Invalid response format')
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load sessions'
        
        if (attempt === retries - 1) {
          // Last attempt failed - show error but don't block UI
          setError(errorMessage)
          setSessions([]) // Set empty array so UI doesn't break
          setLoading(false)
          logger.error('Failed to load sessions after retries:', errorMessage)
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let timeoutId
    
    const loadSessions = async () => {
      if (isMounted) {
        setLoading(true)
        await fetchSessions()
      }
    }
    
    // Set a maximum loading time
    timeoutId = setTimeout(() => {
      if (isMounted) {
        setError('Loading is taking longer than expected. Please refresh the page.')
        setLoading(false)
      }
    }, 15000) // 15 second max loading time
    
    loadSessions()
    
    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [fetchSessions])

  const handleDelete = async (sessionId) => {
    setDeletingId(sessionId)
    try {
      await deleteSession(sessionId)
      setSessions(sessions.filter(s => s._id !== sessionId))
      setShowDeleteConfirm(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete session')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSessionIcon = (index) => {
    const icons = [
      '👓', '📜', '🎓', '📋', '✏️', '⚙️', '📚', '🏗️', '💻', '⚽'
    ]
    return icons[index % icons.length]
  }

  const sortedSessions = [...sessions].sort((a, b) => {
    if (sortBy === 'name') {
      return a.filename.localeCompare(b.filename)
    } else if (sortBy === 'date') {
      return new Date(b.createdAt) - new Date(a.createdAt)
    }
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">My notebooks</h1>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
              <option value="date">Date</option>
            </select>

            <button
              onClick={() => navigate('/upload')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create new
            </button>
          </div>
        </div>

        {loading ? (
          <Loader message="Loading sessions..." />
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-4xl">
              📚
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No notebooks yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first notebook to get started</p>
            <button
              onClick={() => navigate('/upload')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Create new notebook
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Create New Card */}
            <button
              onClick={() => navigate('/upload')}
              className="aspect-[4/3] bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl flex flex-col items-center justify-center hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Create new notebook</p>
            </button>

            {/* Session Cards */}
            {sortedSessions.map((session, index) => (
              <div
                key={session._id}
                className="group relative aspect-[4/3] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer"
              >
                <Link to={`/result/${session._id}`} className="block h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{getSessionIcon(index)}</div>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        setShowDeleteConfirm(session._id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity"
                    >
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {session.filename}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-auto">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>{session.mcqCount || session.mcqs?.length || 0} MCQs</span>
                  </div>
                </Link>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm === session._id && (
                  <div className="absolute inset-0 bg-black/50 dark:bg-black/70 rounded-xl flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 m-4 max-w-xs">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                        Delete this notebook?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDelete(session._id)
                          }}
                          disabled={deletingId === session._id}
                          className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50"
                        >
                          {deletingId === session._id ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setShowDeleteConfirm(null)
                          }}
                          className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSessions.map((session, index) => (
              <div
                key={session._id}
                className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all"
              >
                <div className="text-2xl">{getSessionIcon(index)}</div>
                <Link to={`/result/${session._id}`} className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                    {session.filename}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>{session.mcqs?.length || 0} MCQs</span>
                  </div>
                </Link>
                <button
                  onClick={() => setShowDeleteConfirm(session._id)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Global Delete Confirmation Modal for List View */}
        {showDeleteConfirm && viewMode === 'list' && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete notebook?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(showDeleteConfirm)
                  }}
                  disabled={deletingId === showDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {deletingId === showDeleteConfirm ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
