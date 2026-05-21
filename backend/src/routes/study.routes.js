import express from 'express'
import multer from 'multer'
import { verifyToken } from '../middleware/auth.middleware.js'
import { validateFileUpload } from '../middleware/validation.middleware.js'
import {
  uploadPDF,
  getUploadProgress,
  saveScore,
  getStudySession,
  getUserSessions,
  deleteStudySession
} from '../controllers/study.controller.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'), false)
    }
  }
})

router.post('/upload', verifyToken, upload.single('pdf'), validateFileUpload, uploadPDF)
router.get('/upload-progress/:jobId', getUploadProgress)   // no auth — jobId is the secret
router.get('/user', verifyToken, getUserSessions)
router.post('/scores/:id', verifyToken, saveScore)
router.delete('/:id', verifyToken, deleteStudySession)
router.get('/:id', verifyToken, getStudySession)

export default router
