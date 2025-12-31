import admin from 'firebase-admin'
import logger from '../utils/logger.js'
import config from '../config/env.js'

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey
      })
    })
    logger.info('Firebase Admin initialized successfully')
  } catch (error) {
    logger.error('Firebase Admin initialization error:', error)
    throw error
  }
}

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', { ip: req.ip })
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      })
    }

    const token = authHeader.split('Bearer ')[1]

    if (!token || token.length < 10) {
      logger.warn('Authentication failed: Invalid token format', { ip: req.ip })
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      })
    }

    const decodedToken = await admin.auth().verifyIdToken(token, true)
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    }

    next()
  } catch (error) {
    logger.warn('Token verification error:', {
      error: error.message,
      code: error.code,
      ip: req.ip
    })

    let message = 'Invalid or expired token'
    if (error.code === 'auth/id-token-expired') {
      message = 'Token has expired'
    } else if (error.code === 'auth/argument-error') {
      message = 'Invalid token format'
    }

    return res.status(401).json({
      success: false,
      message
    })
  }
}

