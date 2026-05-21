import StudySession from '../models/StudySession.js'
import mongoose from 'mongoose'
import { randomUUID } from 'crypto'
import { extractTextFromPDF, cleanText } from '../services/pdf.service.js'
import { processDocument } from '../services/ai.service.js'
import { createJob, getJob, emitJobEvent } from '../utils/jobStore.js'
import logger from '../utils/logger.js'
import { asyncHandler } from '../middleware/error.middleware.js'

// Runs async after uploadPDF returns 202; pushes SSE events via jobStore
const processUploadJob = async (jobId, userId, filename, cleanedText) => {
  try {
    const { summary, mcqs } = await processDocument(cleanedText, (progress) => {
      emitJobEvent(jobId, progress)
    })

    emitJobEvent(jobId, { stage: 'saving', message: 'Saving your notebook...' })

    const session = new StudySession({ userId, filename, summary, mcqs })
    await session.save()

    logger.info(`Upload job ${jobId} complete: session ${session._id}`)
    emitJobEvent(jobId, { stage: 'complete', sessionId: session._id.toString() })
  } catch (error) {
    logger.error(`Upload job ${jobId} failed:`, { error: error.message })
    emitJobEvent(jobId, { stage: 'error', message: error.message || 'Processing failed' })
  }
}

export const uploadPDF = asyncHandler(async (req, res) => {
  const userId = req.user.uid
  const filename = req.file.originalname

  logger.info(`PDF upload started: ${filename} by user ${userId}`)

  // Fast synchronous path: validate + extract text (<1s for most PDFs)
  let cleanedText
  try {
    const rawText = await extractTextFromPDF(req.file.buffer)
    cleanedText = cleanText(rawText)
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message })
  }

  const jobId = randomUUID()
  createJob(jobId)

  // Return immediately — client subscribes to SSE for AI progress
  res.status(202).json({ success: true, jobId })

  // Fire-and-forget (errors emitted as SSE events)
  processUploadJob(jobId, userId, filename, cleanedText)
})

// SSE endpoint — no auth needed; jobId is an unguessable UUID
export const getUploadProgress = (req, res) => {
  const { jobId } = req.params
  const job = getJob(jobId)

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found or expired' })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.flushHeaders()

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  // Replay buffered events so late-connecting clients don't miss anything
  for (const event of job.events) {
    send(event)
  }

  if (job.done) {
    res.end()
    return
  }

  const onEvent = (data) => {
    send(data)
    if (data.stage === 'complete' || data.stage === 'error') res.end()
  }

  job.emitter.on('event', onEvent)
  req.on('close', () => job.emitter.off('event', onEvent))
}

export const saveScore = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.uid
  const { correct, total } = req.body

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID' })
  }

  if (
    typeof correct !== 'number' || typeof total !== 'number' ||
    !Number.isInteger(correct) || !Number.isInteger(total) ||
    correct < 0 || total <= 0 || correct > total
  ) {
    return res.status(400).json({ success: false, message: 'Invalid score data' })
  }

  const session = await StudySession.findOneAndUpdate(
    { _id: id, userId },
    { $push: { scores: { correct, total, takenAt: new Date() } } },
    { new: true, select: 'scores' }
  )

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' })
  }

  res.json({ success: true, scores: session.scores })
})

export const getStudySession = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.uid

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID format' })
  }

  const session = await StudySession.findOne({ _id: id, userId }).lean()

  if (!session) {
    logger.warn(`Session not found: ${id} for user ${userId}`)
    return res.status(404).json({ success: false, message: 'Session not found' })
  }

  logger.info(`Session retrieved: ${id}`)
  res.json({ success: true, session })
})

export const getUserSessions = asyncHandler(async (req, res) => {
  const userId = req.user.uid
  const limit = Math.min(parseInt(req.query.limit) || 20, 50)
  const skip = parseInt(req.query.skip) || 0

  const startTime = Date.now()

  try {
    const queryPromise = Promise.all([
      StudySession.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('_id userId filename createdAt scores')
        .lean()
        .maxTimeMS(5000),
      StudySession.countDocuments({ userId }).maxTimeMS(5000)
    ])

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), 6000)
    )

    const [sessions, total] = await Promise.race([queryPromise, timeoutPromise])

    // Attach MCQ count via aggregation
    let mcqCountMap = {}
    if (sessions.length > 0) {
      try {
        const mcqCounts = await StudySession.aggregate([
          { $match: { _id: { $in: sessions.map(s => s._id) } } },
          { $project: { _id: 1, mcqCount: { $size: { $ifNull: ['$mcqs', []] } } } }
        ]).maxTimeMS(3000)
        mcqCounts.forEach(item => {
          mcqCountMap[item._id.toString()] = item.mcqCount || 0
        })
      } catch (err) {
        logger.warn('Failed to get MCQ counts:', err.message)
      }
    }

    const sessionsWithCount = sessions.map(session => ({
      ...session,
      mcqCount: mcqCountMap[session._id.toString()] || 0
    }))

    const duration = Date.now() - startTime
    logger.info(`Retrieved ${sessions.length} sessions for user ${userId} in ${duration}ms`)

    res.json({
      success: true,
      sessions: sessionsWithCount,
      pagination: { total, limit, skip, hasMore: skip + sessions.length < total }
    })
  } catch (error) {
    logger.error('Error fetching user sessions:', { error: error.message, userId })
    res.status(200).json({
      success: true,
      sessions: [],
      pagination: { total: 0, limit, skip, hasMore: false },
      error: 'Failed to load sessions. Please try refreshing.'
    })
  }
})

export const deleteStudySession = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.uid

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID format' })
  }

  const session = await StudySession.findOneAndDelete({ _id: id, userId })

  if (!session) {
    logger.warn(`Session not found for deletion: ${id} for user ${userId}`)
    return res.status(404).json({ success: false, message: 'Session not found' })
  }

  logger.info(`Session deleted: ${id} by user ${userId}`)
  res.json({ success: true, message: 'Session deleted successfully' })
})
