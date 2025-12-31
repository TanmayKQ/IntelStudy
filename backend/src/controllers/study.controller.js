import StudySession from '../models/StudySession.js'
import mongoose from 'mongoose'
import { extractTextFromPDF, cleanText } from '../services/pdf.service.js'
import { processDocument } from '../services/ai.service.js'
import logger from '../utils/logger.js'
import { asyncHandler } from '../middleware/error.middleware.js'

export const uploadPDF = asyncHandler(async (req, res) => {
  const startTime = Date.now()
  const userId = req.user.uid
  const filename = req.file.originalname

  logger.info(`PDF upload started: ${filename} by user ${userId}`)

  try {
    const rawText = await extractTextFromPDF(req.file.buffer)
    const cleanedText = cleanText(rawText)

    logger.info(`Processing document: ${cleanedText.length} characters`)

    const { summary, mcqs } = await processDocument(cleanedText)

    logger.info(`Document processed successfully. Summary: ${summary.length} chars, MCQs: ${mcqs.length}`)

    const session = new StudySession({
      userId,
      filename,
      summary,
      mcqs
    })

    await session.save()

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    logger.info(`PDF upload completed in ${processingTime}s: ${session._id}`)

    res.status(201).json({
      success: true,
      message: 'PDF processed successfully',
      sessionId: session._id,
      processingTime: `${processingTime}s`
    })
  } catch (error) {
    logger.error('PDF upload failed:', {
      error: error.message,
      stack: error.stack,
      userId,
      filename
    })

    const errorMessage = error.message || 'Failed to process PDF'
    
    if (errorMessage.includes('extract') || errorMessage.includes('PDF')) {
      return res.status(400).json({
        success: false,
        message: errorMessage
      })
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('loading')) {
      return res.status(504).json({
        success: false,
        message: 'Processing is taking longer than expected. Please try again in a few moments.'
      })
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    })
  }
})

export const getStudySession = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.uid

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID format'
    })
  }

  const session = await StudySession.findOne({
    _id: id,
    userId
  }).lean()

  if (!session) {
    logger.warn(`Session not found: ${id} for user ${userId}`)
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    })
  }

  logger.info(`Session retrieved: ${id}`)
  res.json({
    success: true,
    session
  })
})

export const getUserSessions = asyncHandler(async (req, res) => {
  const userId = req.user.uid
  const limit = Math.min(parseInt(req.query.limit) || 20, 50) // Reduced default limit
  const skip = parseInt(req.query.skip) || 0

  const startTime = Date.now()

  try {
    // Use Promise.all for parallel queries with timeout
    const queryPromise = Promise.all([
      StudySession.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('_id userId filename createdAt') // Only fetch essential fields - exclude summary and mcqs
        .lean()
        .maxTimeMS(5000), // 5 second timeout
      StudySession.countDocuments({ userId })
        .maxTimeMS(5000)
    ])

    // Add overall timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 6000)
    )

    const [sessions, total] = await Promise.race([queryPromise, timeoutPromise])

    // Add MCQ count - use aggregation for better performance
    const sessionIds = sessions.map(s => s._id.toString())
    let mcqCountMap = {}
    
    if (sessionIds.length > 0) {
      try {
        const mcqCounts = await StudySession.aggregate([
          { $match: { _id: { $in: sessions.map(s => s._id) } } },
          { $project: { _id: 1, mcqCount: { $size: { $ifNull: ['$mcqs', []] } } } }
        ]).maxTimeMS(3000)
        
        mcqCounts.forEach(item => {
          mcqCountMap[item._id.toString()] = item.mcqCount || 0
        })
      } catch (err) {
        logger.warn('Failed to get MCQ counts, using default:', err.message)
      }
    }

    // Add MCQ count to sessions
    const sessionsWithCount = sessions.map(session => ({
      ...session,
      mcqCount: mcqCountMap[session._id.toString()] || 0
    }))

    const duration = Date.now() - startTime
    logger.info(`Retrieved ${sessions.length} sessions for user ${userId} in ${duration}ms`)

    res.json({
      success: true,
      sessions: sessionsWithCount,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + sessions.length < total
      }
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Error fetching user sessions:', {
      error: error.message,
      userId,
      duration
    })
    
    // Return empty array on error instead of failing completely
    res.status(200).json({
      success: true,
      sessions: [],
      pagination: {
        total: 0,
        limit,
        skip,
        hasMore: false
      },
      error: 'Failed to load sessions. Please try refreshing.'
    })
  }
})

export const deleteStudySession = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user.uid

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID format'
    })
  }

  const session = await StudySession.findOneAndDelete({
    _id: id,
    userId
  })

  if (!session) {
    logger.warn(`Session not found for deletion: ${id} for user ${userId}`)
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    })
  }

  logger.info(`Session deleted: ${id} by user ${userId}`)
  res.json({
    success: true,
    message: 'Session deleted successfully'
  })
})
