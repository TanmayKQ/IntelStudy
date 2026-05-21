import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStudySession, saveScore } from '../services/api'
import Loader from '../components/Loader'
import Navbar from '../components/Navbar'

const Result = () => {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const scoreSavedRef = useRef(false)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await getStudySession(id)
        setSession(data.session)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load session')
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [id])

  // Computed before early returns so hooks are never called conditionally
  const totalMCQs = session?.mcqs?.length || 0
  const answeredCount = Object.keys(selectedAnswers).length
  const isQuizComplete = totalMCQs > 0 && answeredCount === totalMCQs
  const correctCount = isQuizComplete
    ? Object.keys(selectedAnswers).filter(
        (i) => session.mcqs[Number(i)].options[selectedAnswers[Number(i)]] === session.mcqs[Number(i)].answer
      ).length
    : 0
  const scorePercent = isQuizComplete ? Math.round((correctCount / totalMCQs) * 100) : 0

  // Auto-save score once per quiz attempt
  useEffect(() => {
    if (!session || !isQuizComplete || scoreSavedRef.current) return
    scoreSavedRef.current = true
    saveScore(id, correctCount, totalMCQs).catch(() => {})
  }, [isQuizComplete, session, id, correctCount, totalMCQs])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Loader message="Loading results..." />
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
            {error || 'Session not found'}
          </div>
          <Link to="/dashboard" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const resetQuiz = () => {
    setSelectedAnswers({})
    scoreSavedRef.current = false
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">{session.filename}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generated on {new Date(session.createdAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Summary
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{session.summary}</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Multiple Choice Questions
            </h2>

            {isQuizComplete && (
              <div className={`mb-6 rounded-xl p-6 border ${
                scorePercent >= 70
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : scorePercent >= 50
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={`text-xl font-semibold mb-1 ${
                      scorePercent >= 70 ? 'text-green-700 dark:text-green-300'
                        : scorePercent >= 50 ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {scorePercent >= 70 ? 'Great job!' : scorePercent >= 50 ? 'Good effort!' : 'Keep studying!'}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      You scored <span className="font-bold">{correctCount}/{totalMCQs}</span> ({scorePercent}%)
                    </p>
                  </div>
                  <button
                    onClick={resetQuiz}
                    className="shrink-0 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {session.mcqs && session.mcqs.length > 0 ? (
                session.mcqs.map((mcq, index) => {
                  const userSelection = selectedAnswers[index]
                  const isAnswered = userSelection !== undefined
                  const isCorrect = isAnswered && mcq.options[userSelection] === mcq.answer

                  return (
                    <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {index + 1}. {mcq.question}
                      </h3>
                      <div className="space-y-2">
                        {mcq.options.map((option, optIndex) => {
                          const isUserChoice = userSelection === optIndex
                          const showCorrect = isAnswered && option === mcq.answer
                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => !isAnswered && setSelectedAnswers(prev => ({ ...prev, [index]: optIndex }))}
                              disabled={isAnswered}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                isAnswered
                                  ? showCorrect
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                                    : isUserChoice
                                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
                                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-300 hover:border-indigo-400 cursor-pointer'
                              } ${isAnswered ? 'cursor-default' : ''}`}
                            >
                              <span className="font-medium mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                              {option}
                              {isAnswered && showCorrect && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded">Correct</span>
                              )}
                              {isAnswered && isUserChoice && !showCorrect && (
                                <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded">Incorrect</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {isAnswered && (
                        <div className={`mt-3 text-sm font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isCorrect ? '✓ Great job! That is correct.' : '✗ Not quite. Review the summary and try again.'}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center shadow-sm">
                  <p className="text-gray-600 dark:text-gray-400">No MCQs generated for this session.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Result
