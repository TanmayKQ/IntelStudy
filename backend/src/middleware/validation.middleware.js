import { body, param, validationResult } from 'express-validator'

export const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }
  next()
}

export const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid session ID format'),
  validate
]

export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No PDF file provided'
    })
  }

  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({
      success: false,
      message: 'File must be a PDF'
    })
  }

  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: 'File size must be less than 10 MB'
    })
  }

  if (req.file.size === 0) {
    return res.status(400).json({
      success: false,
      message: 'File is empty'
    })
  }

  next()
}

