import mongoose from 'mongoose'

const mcqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 4 && v.every(opt => typeof opt === 'string' && opt.trim().length > 0)
      },
      message: 'MCQ must have exactly 4 non-empty options'
    }
  },
  answer: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false })

const studySessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  filename: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  summary: {
    type: String,
    required: true,
    trim: true
  },
  mcqs: {
    type: [mcqSchema],
    required: true,
    default: [],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length <= 10
      },
      message: 'Maximum 10 MCQs allowed per session'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Compound index for efficient queries (most important for getUserSessions)
studySessionSchema.index({ userId: 1, createdAt: -1 }, { background: true })

// Index on userId alone for faster lookups
studySessionSchema.index({ userId: 1 }, { background: true })

// Text index for search (if needed in future) - disabled to improve performance
// studySessionSchema.index({ filename: 'text', summary: 'text' })

export default mongoose.model('StudySession', studySessionSchema)

