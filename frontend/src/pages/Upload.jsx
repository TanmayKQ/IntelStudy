import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadPDF, connectUploadProgress } from '../services/api'
import Navbar from '../components/Navbar'

const Upload = () => {
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [stageMessage, setStageMessage] = useState('')
  const navigate = useNavigate()

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    if (dropped.type === 'application/pdf') { setFile(dropped); setError('') }
    else setError('Please upload a PDF file')
  }

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.type === 'application/pdf') { setFile(selected); setError('') }
    else setError('Please upload a PDF file')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please select a PDF file'); return }
    if (file.size > 10 * 1024 * 1024) { setError('File size must be less than 10 MB'); return }

    setLoading(true)
    setError('')
    setUploadProgress(0)
    setStageMessage('')

    let closeSSE = null

    try {
      const { jobId } = await uploadPDF(file, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setUploadProgress(pct)
      })

      const sessionId = await new Promise((resolve, reject) => {
        closeSSE = connectUploadProgress(jobId, (event) => {
          if (event.stage === 'complete') resolve(event.sessionId)
          else if (event.stage === 'error') reject(new Error(event.message || 'Processing failed'))
          else if (event.message) setStageMessage(event.message)
        })
      })

      navigate(`/result/${sessionId}`)
    } catch (err) {
      setError(err.message || 'Failed to process PDF. Please try again.')
      setLoading(false)
      setUploadProgress(0)
      setStageMessage('')
    } finally {
      if (closeSSE) closeSSE()
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f172a] transition-colors">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">Create new notebook</h1>
          <p className="text-gray-600 dark:text-gray-400">Upload a PDF document to generate AI summaries and MCQs</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {file ? file.name : 'Drag and drop your PDF here'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">or click to browse</p>
                  <p className="text-gray-500 dark:text-gray-500 text-xs">Max file size: 10 MB</p>
                </div>
              </label>
            </div>

            {file && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">{file.name}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={loading}
                  aria-label="Remove file"
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3 py-1">
                {uploadProgress < 100 ? (
                  <>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Uploading PDF...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-cyan-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="text-sm">{stageMessage || 'Processing...'}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 pl-8">
                      This may take up to 2 minutes while AI processes your document.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <button
                type="submit"
                disabled={!file}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload and Generate
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default Upload
