import axios from 'axios'
import dotenv from 'dotenv'
import logger from '../utils/logger.js'
import { retryWithBackoff, retryOnCondition } from '../utils/retry.js'
import CircuitBreaker from '../utils/circuitBreaker.js'

dotenv.config()

const HF_API_KEY = process.env.HF_API_KEY
const HF_API_URL = 'https://router.huggingface.co/models'

if (!HF_API_KEY) {
  logger.warn('HF_API_KEY is not set. AI features will not work.')
}

const hfHeaders = {
  'Authorization': `Bearer ${HF_API_KEY}`,
  'Content-Type': 'application/json'
}

// Circuit breaker for HuggingFace API
const hfCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000
})

// Create axios instance with better defaults
const hfAxios = axios.create({
  timeout: 120000,
  headers: hfHeaders,
  validateStatus: (status) => status < 500
})

const callHuggingFace = async (model, inputs, options = {}) => {
  const shouldRetry = (error) => {
    const status = error.response?.status
    return status === 503 || status === 429 || status === 408 || !error.response
  }

  return await hfCircuitBreaker.execute(async () => {
    return await retryOnCondition(
      async () => {
        try {
          const response = await hfAxios.post(
            `${HF_API_URL}/${model}`,
            { inputs, ...options }
          )

          if (response.status === 503) {
            throw new Error('Model is loading. Please wait a moment and try again.')
          }
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.')
          }
          if (response.status === 410) {
            throw new Error('API endpoint deprecated. Please update the application.')
          }
          if (response.status >= 400) {
            throw new Error(`API error: ${response.status} - ${response.statusText}`)
          }

          if (response.data?.error) {
            throw new Error(response.data.error)
          }

          return response.data
        } catch (error) {
          if (error.response) {
            throw error
          }
          if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout. The model is taking too long to respond.')
          }
          throw new Error(`Network error: ${error.message}`)
        }
      },
      shouldRetry,
      3
    )
  })
}

// Extract key information from text using intelligent parsing
const extractKeyInformation = (text) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50)
  
  // Find introduction/problem statement (usually in first 20% of text)
  const introSection = sentences.slice(0, Math.floor(sentences.length * 0.2))
  
  // Find key concepts and main points
  const words = text.toLowerCase().split(/\s+/)
  const wordFreq = {}
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '')
    if (cleanWord.length > 5 && !['the', 'this', 'that', 'with', 'from', 'which', 'their', 'there'].includes(cleanWord)) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1
    }
  })
  
  const keyTerms = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word)
  
  // Extract sentences containing key terms
  const importantSentences = sentences.filter(sentence => {
    const lowerSentence = sentence.toLowerCase()
    return keyTerms.some(term => lowerSentence.includes(term))
  }).slice(0, 10)
  
  return {
    introSection,
    importantSentences,
    keyTerms,
    paragraphs: paragraphs.slice(0, 5)
  }
}

// Create structured summary from extracted information
const createStructuredSummary = (extracted) => {
  const { introSection, importantSentences, keyTerms, paragraphs } = extracted
  
  let summary = ''
  
  // Introduction/Problem Statement - find the clearest opening
  if (introSection.length > 0) {
    // Look for sentences that indicate problem statement or introduction
    const problemIndicators = ['problem', 'issue', 'challenge', 'aim', 'goal', 'purpose', 'objective', 'propose', 'present', 'introduce', 'study', 'research', 'investigate']
    const problemSentence = introSection.find(s => 
      problemIndicators.some(indicator => s.toLowerCase().includes(indicator))
    ) || introSection[0]
    
    if (problemSentence) {
      summary += problemSentence.trim()
      if (problemSentence.length < 150 && introSection.length > 1) {
        summary += ' ' + introSection[1].trim()
      }
      summary += '\n\n'
    } else {
      const intro = introSection.slice(0, 2).join(' ')
      summary += intro.substring(0, 250)
      if (intro.length > 250) summary += '...'
      summary += '\n\n'
    }
  }
  
  // Main Content - organize by importance and coherence
  if (importantSentences.length > 0) {
    // Group sentences that are related
    const organizedSentences = []
    const used = new Set()
    
    importantSentences.forEach(sentence => {
      if (!used.has(sentence) && sentence.trim().length > 40 && sentence.trim().length < 250) {
        organizedSentences.push(sentence.trim())
        used.add(sentence)
      }
    })
    
    if (organizedSentences.length > 0) {
      summary += 'Main Points:\n'
      organizedSentences.slice(0, 6).forEach((sentence) => {
        // Ensure sentence ends properly
        let cleanSentence = sentence.trim()
        if (!cleanSentence.match(/[.!?]$/)) {
          cleanSentence += '.'
        }
        summary += `• ${cleanSentence}\n`
      })
      summary += '\n'
    }
  }
  
  // Methodology/Approach (look for method-related sentences)
  const methodIndicators = ['method', 'approach', 'technique', 'algorithm', 'system', 'framework', 'model', 'process', 'procedure']
  const methodSentences = importantSentences.filter(s => 
    methodIndicators.some(indicator => s.toLowerCase().includes(indicator))
  )
  
  if (methodSentences.length > 0) {
    summary += 'Approach: '
    summary += methodSentences[0].trim()
    if (!methodSentences[0].match(/[.!?]$/)) summary += '.'
    summary += '\n\n'
  }
  
  // Results/Findings (look for result-related sentences)
  const resultIndicators = ['result', 'finding', 'show', 'demonstrate', 'achieve', 'obtain', 'observe', 'conclude', 'indicate']
  const resultSentences = importantSentences.filter(s => 
    resultIndicators.some(indicator => s.toLowerCase().includes(indicator))
  )
  
  if (resultSentences.length > 0) {
    summary += 'Key Findings: '
    summary += resultSentences[0].trim()
    if (!resultSentences[0].match(/[.!?]$/)) summary += '.'
    summary += '\n\n'
  }
  
  // Conclusion (from last paragraphs)
  if (paragraphs.length > 0) {
    const conclusion = paragraphs[paragraphs.length - 1]
    if (conclusion && conclusion.length > 50) {
      summary += 'Conclusion: '
      const conclusionText = conclusion.trim()
      summary += conclusionText.substring(0, 200)
      if (conclusionText.length > 200) summary += '...'
      if (!conclusionText.match(/[.!?]$/)) summary += '.'
    }
  }
  
  // Ensure summary is coherent
  const finalSummary = summary.trim()
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\.\s*\./g, '.')
    .replace(/^\s+|\s+$/g, '')
  
  return finalSummary
}

export const summarizeText = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is empty or invalid')
  }

  // For shorter texts, use direct summarization
  const wordCount = text.split(/\s+/).length
  
  if (wordCount < 500) {
    // Use extractive summarization for short texts
    const extracted = extractKeyInformation(text)
    return createStructuredSummary(extracted)
  }

  // For longer texts, use best free models with structured prompts
  // Using instruction-tuned models for better quality
  const models = [
    'google/flan-t5-large',           // Best: Instruction-tuned, excellent structured output
    'google/flan-t5-base',            // Fast alternative with good quality
    'Falconsai/text_summarization',   // Specialized for summarization
    'facebook/bart-large-cnn',        // Reliable fallback
    'google/pegasus-xsum',            // Good abstractive summarization
    'sshleifer/distilbart-cnn-12-6'   // Fast fallback
  ]

  // Calculate appropriate summary length (15-25% of original)
  const targetLength = Math.max(150, Math.min(400, Math.floor(wordCount * 0.2)))
  const maxLength = Math.min(512, targetLength + 50)
  const minLength = Math.max(100, Math.floor(targetLength * 0.6))

  // Try to get a good summary from AI models
  for (const model of models) {
    try {
      logger.info(`Attempting summarization with model: ${model}`)
      
      // Create optimized prompt based on model type
      let prompt = text
      let usePrompt = false
      
      // For instruction-tuned models (flan-t5), use structured prompts
      if (model.includes('flan-t5')) {
        usePrompt = true
        prompt = `Summarize the following text in a clear, structured way. Include:
1. Main topic/problem statement
2. Key points and findings  
3. Important conclusions

Text: ${text.substring(0, 2000)}

Summary:`
      } else if (model.includes('Falconsai')) {
        // Specialized summarization model - use direct text
        prompt = text.substring(0, 2000)
      } else {
        // Other models - use direct text
        prompt = text.length > 2000 ? text.substring(0, 2000) : text
      }
      
      const result = await callHuggingFace(model, prompt, {
        parameters: {
          max_length: maxLength,
          min_length: minLength,
          do_sample: !usePrompt, // Use sampling for instruction-tuned models
          temperature: usePrompt ? 0.7 : 0.3, // Higher temp for instruction models
          top_p: usePrompt ? 0.9 : undefined
        }
      })

      let summary = null
      if (Array.isArray(result) && result[0]?.summary_text) {
        summary = result[0].summary_text
      } else if (result.summary_text) {
        summary = result.summary_text
      } else if (Array.isArray(result) && result[0]?.generated_text) {
        summary = result[0].generated_text
      } else if (result.generated_text) {
        summary = result.generated_text
      }

      if (summary && summary.trim().length > 50) {
        logger.info(`Successfully summarized with model: ${model}`)
        // Post-process to ensure quality
        const cleanedSummary = summary.trim()
          .replace(/\s+/g, ' ')
          .replace(/\.\s*\./g, '.')
        
        // If summary is too fragmented, enhance it
        if (cleanedSummary.split(/[.!?]/).length > 10 && cleanedSummary.length < 200) {
          const extracted = extractKeyInformation(text)
          const structured = createStructuredSummary(extracted)
          return structured.length > cleanedSummary.length ? structured : cleanedSummary
        }
        
        return cleanedSummary
      }
    } catch (error) {
      logger.warn(`Model ${model} failed:`, error.message)
      if (model === models[models.length - 1]) {
        // Fallback to intelligent extraction
        logger.info('Using intelligent extraction as fallback')
        const extracted = extractKeyInformation(text)
        return createStructuredSummary(extracted)
      }
      continue
    }
  }

  // Final fallback: intelligent extraction
  logger.info('All models failed, using intelligent extraction')
  const extracted = extractKeyInformation(text)
  return createStructuredSummary(extracted)
}

export const generateMCQs = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is empty or invalid')
  }

  // Use best free models for MCQ generation - instruction-tuned models work much better
  const models = [
    'google/flan-t5-large',        // Best: Excellent at following instructions and structured output
    'google/flan-t5-base',         // Fast alternative with good quality
    'microsoft/DialoGPT-large',    // Good for question generation
    'gpt2',                        // Fallback
    'distilgpt2'                   // Fast fallback
  ]

  const prompt = `You are an expert educator. Create exactly 5 diverse multiple-choice questions (mix what/why/how/which/identify) based on the text below. Each question must be clear and concise. Vary structure and avoid revealing answers in the question. Return ONLY valid JSON array with objects: {"question": "...", "options": ["A","B","C","D"], "answer": "one of the options"}.

Text:
${text.substring(0, 1500)}

JSON Array:`

  for (const model of models) {
    try {
      logger.info(`Attempting MCQ generation with model: ${model}`)
      
      // Optimize parameters based on model type
      const isFlanModel = model.includes('flan-t5')
      const isDialoGPT = model.includes('DialoGPT')
      
      const result = await callHuggingFace(model, prompt, {
        parameters: {
          max_length: isFlanModel ? 800 : 500, // More tokens for instruction models
          temperature: isFlanModel ? 0.7 : 0.8,
          top_p: isFlanModel ? 0.9 : undefined,
          do_sample: true
        }
      })

      let mcqText = ''
      if (Array.isArray(result) && result[0]?.generated_text) {
        mcqText = result[0].generated_text
      } else if (result.generated_text) {
        mcqText = result.generated_text
      } else if (typeof result === 'string') {
        mcqText = result
      }

      // Try to extract JSON from response (instruction models are better at this)
      if (mcqText) {
        const jsonMatch = mcqText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          try {
            const mcqs = JSON.parse(jsonMatch[0])
            if (Array.isArray(mcqs) && mcqs.length > 0) {
              logger.info(`Successfully generated MCQs using model: ${model}`)
              return mcqs.slice(0, 5).map(mcq => ({
                question: mcq.question || 'Question not generated',
                options: Array.isArray(mcq.options) && mcq.options.length === 4
                  ? mcq.options
                  : ['Option A', 'Option B', 'Option C', 'Option D'],
                answer: mcq.answer || mcq.options?.[0] || 'Option A'
              }))
            }
          } catch (parseError) {
            logger.warn(`Failed to parse JSON from ${model}, trying next model`)
            if (model !== models[models.length - 1]) {
              continue
            }
          }
        }
      }
      
      // If we got a response but couldn't parse it, try next model
      if (model !== models[models.length - 1]) {
        logger.warn(`Model ${model} response not parseable, trying next model`)
        continue
      }
    } catch (error) {
      // 404 or other errors - continue to next model or fallback
      if (error.response?.status === 404 || error.message.includes('404')) {
        logger.warn(`Model ${model} not available (404), trying next model`)
      } else {
        logger.warn(`Model ${model} error:`, error.message)
      }
      
      // If this is the last model, fall through to intelligent fallback
      if (model === models[models.length - 1]) {
        logger.info('All MCQ models failed, using intelligent fallback')
      }
    }
  }

  // If all models failed, use intelligent fallback
  return generateIntelligentMCQs(text)
}

const generateIntelligentMCQs = (text) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
  const words = text.toLowerCase().split(/\s+/)
  
  const wordFreq = {}
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '')
    if (cleanWord.length > 4) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1
    }
  })
  
  const importantWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)

  const mcqs = []
  const questionTypes = [
    (phrase) => `What is mentioned about "${phrase}"?`,
    (phrase) => `According to the text, which statement is true regarding "${phrase}"?`,
    (phrase) => `How does the text describe "${phrase}"?`,
    (phrase) => `Why is "${phrase}" important according to the document?`,
    (phrase) => `Identify the key aspect of "${phrase}" mentioned in the text.`
  ]
  
  for (let i = 0; i < Math.min(5, sentences.length); i++) {
    const sentence = sentences[i].trim()
    if (sentence.length < 30) continue
    
    const keyPhrase = sentence.substring(0, Math.min(60, sentence.length))
    const wordsInSentence = sentence.toLowerCase().split(/\s+/)
    
    const keyTerm = wordsInSentence.find(w => 
      importantWords.includes(w.replace(/[^\w]/g, '')) && w.length > 4
    ) || wordsInSentence.find(w => w.length > 5) || 'the topic'
    
    const questionType = questionTypes[i % questionTypes.length]
    const question = questionType(keyPhrase.substring(0, 40) + (keyPhrase.length > 40 ? '...' : ''))
    
    const options = [
      sentence.substring(0, Math.min(80, sentence.length)) + (sentence.length > 80 ? '...' : ''),
      'It is not discussed in the text',
      'The text provides conflicting information',
      'Further research is needed on this topic'
    ]
    
    mcqs.push({
      question,
      options: options.slice(0, 4),
      answer: options[0]
    })
  }

  while (mcqs.length < 5) {
    const topics = importantWords.slice(0, 4)
    mcqs.push({
      question: `What is the main focus regarding "${topics[0] || 'the subject'}" in this document?`,
      options: [
        'It is the primary topic discussed',
        'It is mentioned briefly',
        'It is not relevant to the document',
        'It requires additional context'
      ],
      answer: 'It is the primary topic discussed'
    })
  }

  return mcqs.slice(0, 5)
}

export const processDocument = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Document text is empty or invalid')
  }

  const wordCount = text.split(/\s+/).length
  logger.info(`Processing document: ${wordCount} words`)

  let finalSummary = ''

  // For very long documents, use a smarter approach
  if (wordCount > 3000) {
    logger.info('Document is very long, using multi-stage summarization')
    
    // Stage 1: Extract key sections
    const { chunkText } = await import('./pdf.service.js')
    const chunks = chunkText(text, 1000) // Larger chunks for better context
    
    logger.info(`Processing ${chunks.length} sections`)
    
    // Process first, middle, and last sections with priority
    const priorityChunks = [
      chunks[0], // Introduction
      chunks[Math.floor(chunks.length / 2)], // Middle
      chunks[chunks.length - 1] // Conclusion
    ].filter(Boolean)
    
    const sectionSummaries = []
    for (const chunk of priorityChunks) {
      try {
        const summary = await summarizeText(chunk)
        if (summary && summary.length > 50) {
          sectionSummaries.push(summary)
        }
      } catch (error) {
        logger.warn('Section summarization failed:', error.message)
      }
    }
    
    // Combine and create final summary
    if (sectionSummaries.length > 0) {
      const combined = sectionSummaries.join('\n\n')
      if (combined.length > 500) {
        finalSummary = await summarizeText(combined)
      } else {
        finalSummary = combined
      }
    } else {
      // Fallback to full document summarization
      finalSummary = await summarizeText(text.substring(0, 3000))
    }
  } else {
    // For shorter documents, summarize directly
    logger.info('Summarizing entire document')
    finalSummary = await summarizeText(text)
  }

  // Ensure summary has minimum quality
  if (!finalSummary || finalSummary.trim().length < 100) {
    logger.warn('Summary too short, enhancing with extraction')
    const extracted = extractKeyInformation(text)
    const enhanced = createStructuredSummary(extracted)
    if (enhanced.length > finalSummary.length) {
      finalSummary = enhanced
    }
  }

  logger.info(`Summary generated: ${finalSummary.length} characters`)
  logger.info('Generating MCQs')
  const mcqs = await generateMCQs(text)

  return {
    summary: finalSummary.trim(),
    mcqs: mcqs.slice(0, 5)
  }
}
