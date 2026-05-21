import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="text-8xl font-bold text-gray-200 dark:text-gray-800 mb-4 select-none">404</div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3">Page not found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you are looking for does not exist.
        </p>
        <Link
          to="/dashboard"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors inline-block"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
