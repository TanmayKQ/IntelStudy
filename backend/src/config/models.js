// AI Model Configuration
// You can customize which models to use for summarization and MCQ generation

export const SUMMARIZATION_MODELS = [
  // Best for academic/technical papers
  'facebook/bart-large-cnn',           // High quality, good for structured summaries
  'google/pegasus-xsum',               // Excellent for abstractive summarization
  'pszemraj/led-large-book-summary',   // Great for long documents
  'sshleifer/distilbart-cnn-12-6',    // Faster, lighter version
  
  // Alternative models (uncomment to use)
  // 'microsoft/DialoGPT-large',       // Good for conversational summaries
  // 't5-base',                        // General purpose
  // 't5-small',                      // Faster, lighter
  // 'google/flan-t5-base',            // Instruction-tuned, good for structured output
  // 'Falconsai/text_summarization',   // Specialized summarization
  // 'csebuetnlp/mT5_multilingual_XLSum', // Multilingual support
]

export const MCQ_GENERATION_MODELS = [
  // Text generation models that can be used for MCQ generation
  'gpt2',                              // General purpose
  'distilgpt2',                        // Faster version
  
  // Alternative models (uncomment to use)
  // 'google/flan-t5-base',            // Instruction-tuned, better for structured output
  // 'google/flan-t5-large',           // Larger, better quality
  // 'microsoft/DialoGPT-medium',     // Conversational, good for questions
  // 'EleutherAI/gpt-neo-125M',       // Open source alternative
  // 'EleutherAI/gpt-neo-1.3B',       // Larger, better quality
]

// Model configuration from environment variables (optional)
// Set HF_SUMMARIZATION_MODELS and HF_MCQ_MODELS in .env to override defaults
export const getSummarizationModels = () => {
  if (process.env.HF_SUMMARIZATION_MODELS) {
    return process.env.HF_SUMMARIZATION_MODELS.split(',').map(m => m.trim())
  }
  return SUMMARIZATION_MODELS
}

export const getMCQModels = () => {
  if (process.env.HF_MCQ_MODELS) {
    return process.env.HF_MCQ_MODELS.split(',').map(m => m.trim())
  }
  return MCQ_GENERATION_MODELS
}

// Model recommendations by use case
export const MODEL_RECOMMENDATIONS = {
  summarization: {
    academic: [
      'facebook/bart-large-cnn',
      'google/pegasus-xsum',
      'pszemraj/led-large-book-summary'
    ],
    general: [
      'facebook/bart-large-cnn',
      'sshleifer/distilbart-cnn-12-6'
    ],
    fast: [
      'sshleifer/distilbart-cnn-12-6',
      't5-small'
    ],
    multilingual: [
      'csebuetnlp/mT5_multilingual_XLSum',
      'google/mt5-base'
    ]
  },
  mcq: {
    structured: [
      'google/flan-t5-base',
      'google/flan-t5-large'
    ],
    general: [
      'gpt2',
      'distilgpt2'
    ],
    fast: [
      'distilgpt2',
      'EleutherAI/gpt-neo-125M'
    ]
  }
}

