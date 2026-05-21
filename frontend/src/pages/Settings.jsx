import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateProfile, deleteUser } from 'firebase/auth'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { getUserSessions } from '../services/api'
import Navbar from '../components/Navbar'

const Settings = () => {
  const { theme, toggleTheme } = useTheme()
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState('')

  const [sessionCount, setSessionCount] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    getUserSessions()
      .then(data => setSessionCount(data.sessions?.length ?? 0))
      .catch(() => setSessionCount(null))
  }, [])

  const handleSaveName = async (e) => {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setNameError('Display name cannot be empty.')
      return
    }
    setNameSaving(true)
    setNameError('')
    setNameSuccess(false)
    try {
      await updateProfile(currentUser, { displayName: trimmed })
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    } catch {
      setNameError('Failed to update display name. Please try again.')
    } finally {
      setNameSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteUser(currentUser)
      try { await logout() } catch { /* already deleted */ }
      navigate('/login')
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError('Please log out and log back in before deleting your account.')
      } else {
        setDeleteError(err.message || 'Failed to delete account. Please try again.')
      }
      setDeleteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
            <div className="space-y-5">
              {/* Email — read-only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {currentUser?.email}
                </div>
              </div>

              {/* Display name */}
              <form onSubmit={handleSaveName}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display name
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    maxLength={50}
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={nameSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {nameSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {nameSuccess && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">Display name updated.</p>
                )}
                {nameError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{nameError}</p>
                )}
              </form>

              {/* Session count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notebooks
                </label>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {sessionCount === null ? 'Loading...' : `${sessionCount} notebook${sessionCount !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Theme</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {theme} mode
                </p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">Danger zone</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Permanently delete your account. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
            >
              Delete account
            </button>
          </div>

          {/* About */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About</h2>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p>IntelStudy — AI-Powered Study Assistant</p>
              <p>Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete your account?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your account and all notebooks will be permanently deleted. This action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteError('') }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
