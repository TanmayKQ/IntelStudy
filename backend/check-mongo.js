import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI

console.log('MongoDB Connection Diagnostic Tool\n')
console.log('=' .repeat(50))

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not set in .env file')
  process.exit(1)
}

console.log(`✓ MONGO_URI is set: ${MONGO_URI.substring(0, 30)}...`)

if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
  console.error('❌ Invalid MONGO_URI format. Must start with mongodb:// or mongodb+srv://')
  process.exit(1)
}

console.log('✓ MONGO_URI format is valid')
console.log('\nAttempting to connect to MongoDB...\n')

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => {
    console.log('✅ Successfully connected to MongoDB!')
    console.log(`   Database: ${mongoose.connection.name}`)
    console.log(`   Host: ${mongoose.connection.host}`)
    console.log(`   Port: ${mongoose.connection.port || 'N/A'}`)
    mongoose.connection.close()
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed to connect to MongoDB')
    console.error(`   Error: ${error.message}`)
    console.error(`   Code: ${error.code || 'N/A'}`)
    console.error('\nTroubleshooting:')
    console.error('1. If using local MongoDB:')
    console.error('   - Ensure MongoDB is running: mongod or mongodb service')
    console.error('   - Check if MongoDB is on default port 27017')
    console.error('   - Try: mongodb://localhost:27017/intelstudy')
    console.error('\n2. If using MongoDB Atlas:')
    console.error('   - Check your connection string in Atlas dashboard')
    console.error('   - Ensure your IP is whitelisted')
    console.error('   - Verify database user credentials')
    console.error('\n3. Network issues:')
    console.error('   - Check firewall settings')
    console.error('   - Verify network connectivity')
    process.exit(1)
  })

