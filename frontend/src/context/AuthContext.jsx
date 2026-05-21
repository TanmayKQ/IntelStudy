import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification
} from 'firebase/auth'
import { auth } from '../services/firebase'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let timeoutId
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          if (isMounted) {
            setCurrentUser(user)
          }
        } else {
          if (isMounted) {
            setCurrentUser(null)
          }
        }
      } catch (error) {
        console.error('Auth error:', error)
        if (isMounted) {
          setCurrentUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    })

    // Timeout fallback to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth check timeout, proceeding anyway')
        setLoading(false)
      }
    }, 5000)

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await sendEmailVerification(credential.user).catch(() => {})
    return credential
  }

  const logout = async () => {
    await signOut(auth)
  }

  const value = {
    currentUser,
    login,
    signup,
    logout
  }

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f172a] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

