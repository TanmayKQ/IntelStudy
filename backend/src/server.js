import app from './app.js'
import mongoose from 'mongoose'
import logger from './utils/logger.js'
import config, { validateEnv } from './config/env.js'

// Validate environment variables
validateEnv()

// MongoDB connection options (Mongoose 8.x compatible)
const mongooseOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  // bufferCommands and bufferMaxEntries are deprecated in Mongoose 8.x
  // Mongoose 8.x handles buffering automatically
}

// MongoDB connection with retry logic
const connectDB = async () => {
  // Validate MongoDB URI format
  if (!config.mongoUri || !config.mongoUri.startsWith('mongodb://') && !config.mongoUri.startsWith('mongodb+srv://')) {
    logger.error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://')
    process.exit(1)
  }

  let retries = 5
  while (retries > 0) {
    try {
      logger.info(`Attempting to connect to MongoDB (${6 - retries}/5)...`)
      await mongoose.connect(config.mongoUri, mongooseOptions)
      logger.info('Connected to MongoDB successfully')
      
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', {
          error: err.message,
          code: err.code,
          name: err.name
        })
      })

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected')
      })

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected')
      })

      return
    } catch (error) {
      retries--
      const errorDetails = {
        error: error.message,
        code: error.code || 'UNKNOWN',
        name: error.name || 'Error'
      }
      
      logger.error(`MongoDB connection failed. Retries left: ${retries}`, errorDetails)
      
      if (retries === 0) {
        logger.error('Failed to connect to MongoDB after all retries', errorDetails)
        logger.error('Please check:')
        logger.error('1. MongoDB is running (if local) or MongoDB Atlas cluster is accessible')
        logger.error('2. MONGO_URI is correct in .env file')
        logger.error('3. Network connectivity and firewall settings')
        logger.error(`MONGO_URI format: ${config.mongoUri.substring(0, 20)}...`)
        process.exit(1)
      }
      
      logger.info(`Retrying in 5 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`)
  
  server.close(() => {
    logger.info('HTTP server closed')
    
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed')
      process.exit(0)
    })
  })

  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Start server
const startServer = async () => {
  try {
    await connectDB()
    
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Promise Rejection:', {
        error: err?.message || String(err),
        stack: err?.stack
      })
      gracefulShutdown('unhandledRejection')
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', {
        error: err?.message || String(err),
        stack: err?.stack
      })
      gracefulShutdown('uncaughtException')
    })

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    return server
  } catch (error) {
    logger.error('Failed to start server:', {
      error: error.message,
      code: error.code,
      stack: error.stack
    })
    process.exit(1)
  }
}

const server = await startServer()
