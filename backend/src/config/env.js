import dotenv from 'dotenv'
import logger from '../utils/logger.js'

dotenv.config()

const requiredEnvVars = [
  'MONGO_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
]

const optionalEnvVars = [
  'HF_API_KEY',
  'PORT',
  'NODE_ENV',
  'LOG_LEVEL',
  'FRONTEND_URL'
]

export const validateEnv = () => {
  const missing = []
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  })

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  logger.info('Environment variables validated successfully')
  
  // Log optional vars that are set
  optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
      logger.debug(`${varName} is set`)
    }
  })
}

export default {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  huggingface: {
    apiKey: process.env.HF_API_KEY
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info'
}

