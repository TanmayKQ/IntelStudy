import pdfParse from 'pdf-parse'
import logger from '../utils/logger.js'

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB
const MIN_TEXT_LENGTH = 50

export const extractTextFromPDF = async (buffer) => {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF buffer is empty')
  }

  if (buffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF size exceeds maximum allowed size of ${MAX_PDF_SIZE / 1024 / 1024} MB`)
  }

  try {
    logger.info(`Extracting text from PDF (${(buffer.length / 1024).toFixed(2)} KB)`)
    
    const data = await pdfParse(buffer, {
      max: 0, // No page limit
      version: 'v1.10.100'
    })

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('PDF contains no extractable text. The PDF may be image-based or corrupted.')
    }

    logger.info(`Successfully extracted ${data.text.length} characters from PDF`)
    return data.text
  } catch (error) {
    logger.error('PDF extraction error:', {
      error: error.message,
      code: error.code
    })
    
    if (error.message.includes('Invalid PDF')) {
      throw new Error('Invalid PDF file. Please ensure the file is a valid PDF document.')
    }
    if (error.message.includes('password')) {
      throw new Error('PDF is password protected. Please provide an unprotected PDF.')
    }
    
    throw new Error(`Failed to extract text from PDF: ${error.message}`)
  }
}

export const cleanText = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is invalid or not a string')
  }

  const cleaned = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length < MIN_TEXT_LENGTH) {
    throw new Error(`PDF contains insufficient text (minimum ${MIN_TEXT_LENGTH} characters required). The document may be mostly images or empty.`)
  }

  logger.info(`Cleaned text: ${cleaned.length} characters`)
  return cleaned
}

export const chunkText = (text, wordsPerChunk = 600) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is empty')
  }

  const words = text.split(/\s+/)
  
  if (words.length <= wordsPerChunk) {
    return [text]
  }

  const chunks = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ')
    chunks.push(chunk)
  }

  logger.info(`Split text into ${chunks.length} chunks`)
  return chunks
}
