import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserSessions, deleteSession } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Loader from '../components/Loader'
import Navbar from '../components/Navbar'

const logger = { error: (...a) => console.error(...a), info: (...a) => console.log(...a) }

const getLastScore = (session) => {
  if (!session.scores?.length) return null
  const last = session.scores[session.scores.length - 1]
  return Math.round((last.correct / last.total) * 100)
}

const scoreColorClass = (pct) =>
  pct >= 70
    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    : pct >= 50
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'

const scoreBarColor = (pct) => (pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444')

const Dashboard = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Auto-dismiss errors after 5 s
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 5000)
    return () => clearTimeout(id)
  }, [error])

  const fetchSessions = useCallback(async (retries = 2) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        setError('')
        const data = await getUserSessions()
        if (data && (data.sessions || Array.isArray(data.sessions))) {
          setSessions(data.sessions || [])
          setLoading(false)
          return
        }
        throw new Error('Invalid response format')
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to load sessions'
        if (attempt === retries - 1) {
          setError(msg)
          setSessions([])
          setLoading(false)
          logger.error('Failed to load sessions after retries:', msg)
        } else {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setError('Loading is taking longer than expected. Please refresh the page.')
        setLoading(false)
      }
    }, 15000)

    setLoading(true)
    fetchSessions().finally(() => mounted && clearTimeout(timeoutId))

    return () => { mounted = false; clearTimeout(timeoutId) }
  }, [fetchSessions])

  const handleDelete = async (sessionId) => {
    setDeletingId(sessionId)
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s._id !== sessionId))
      setShowDeleteConfirm(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete session')
    } finally {
      setDeletingId(null)
    }
  }

  const sortedSessions = useMemo(() =>
    [...sessions].sort((a, b) => {
      if (sortBy === 'name') return a.filename.localeCompare(b.filename)
      return new Date(b.createdAt) - new Date(a.createdAt)
    }),
    [sessions, sortBy]
  )

  const filteredSessions = useMemo(() =>
    searchQuery.trim()
      ? sortedSessions.filter(s => s.filename.toLowerCase().includes(searchQuery.toLowerCase()))
      : sortedSessions,
    [sortedSessions, searchQuery]
  )

  const chartData = useMemo(() =>
    sortedSessions
      .filter(s => s.scores?.length > 0)
      .slice(0, 10)
      .reverse()
      .map(s => {
        const last = s.scores[s.scores.length - 1]
        const pct = Math.round((last.correct / last.total) * 100)
        const name = s.filename.length > 18 ? s.filename.slice(0, 15) + '…' : s.filename
        return { name, score: pct, correct: last.correct, total: last.total }
      }),
    [sortedSessions]
  )

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const ICONS = ['👓', '📜', '🎓', '📋', '✏️', '⚙️', '📚', '🏗️', '💻', '⚽']
  const getIcon = (i) => ICONS[i % ICONS.length]

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">My notebooks</h1>
        </div>

        {/* Score overview chart */}
        {chartData.length >= 2 && (
          <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">Score overview</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value, _name, props) =>
                    [`${value}% (${props.payload.correct}/${props.payload.total})`, 'Score']
                  }
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={scoreBarColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search notebooks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error" className="shrink-0 text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : filteredSessions.length === 0 && searchQuery ? (
          <p className="text-center py-16 text-gray-500 dark:text-gray-400">
            No notebooks match &ldquo;{searchQuery}&rdquo;
          </p>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-4xl">📚</div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No notebooks yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first notebook to get started</p>
            <button onClick={() => navigate('/upload')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
              Create new notebook
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/upload')}
              className="aspect-[4/3] bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl flex flex-col items-center justify-center hover:border-indigo-500 transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Create new notebook</p>
            </button>

            {filteredSessions.map((session, index) => {
              const lastScore = getLastScore(session)
              return (
                <div key={session._id} className="group relative aspect-[4/3] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer">
                  <Link to={`/result/${session._id}`} className="block h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{getIcon(index)}</div>
                      <button
                        onClick={(e) => { e.preventDefault(); setShowDeleteConfirm(session._id) }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-opacity"
                        aria-label="Delete notebook"
                      >
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                      {session.filename}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-auto">
                      <span>{formatDate(session.createdAt)}</span>
                      <span>{session.mcqCount || 0} MCQs</span>
                      {lastScore !== null && (
                        <span className={`px-1.5 py-0.5 rounded font-medium ${scoreColorClass(lastScore)}`}>
                          {lastScore}%
                        </span>
                      )}
                    </div>
                  </Link>

                  {showDeleteConfirm === session._id && (
                    <div className="absolute inset-0 bg-black/50 dark:bg-black/70 rounded-xl flex items-center justify-center z-10">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 m-4 max-w-xs">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-4">Delete this notebook?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(session._id) }}
                            disabled={deletingId === session._id}
                            className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50"
                          >
                            {deletingId === session._id ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeleteConfirm(null) }}
                            className="flex-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((session, index) => {
              const lastScore = getLastScore(session)
              return (
                <div key={session._id} className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
                  <div className="text-2xl">{getIcon(index)}</div>
                  <Link to={`/result/${session._id}`} className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">{session.filename}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span>{formatDate(session.createdAt)}</span>
                      <span>{session.mcqs?.length || 0} MCQs</span>
                      {lastScore !== null && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${scoreColorClass(lastScore)}`}>
                          {lastScore}%
                        </span>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(session._id)}
                    aria-label="Delete notebook"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation modal for list view */}
        {showDeleteConfirm && viewMode === 'list' && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete notebook?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deletingId === showDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {deletingId === showDeleteConfirm ? 'Deleting…' : 'Delete'}
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
