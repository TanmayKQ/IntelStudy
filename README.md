# IntelStudy - AI-Powered Study Assistant

A full-stack web application that helps students upload PDF documents and receive AI-generated summaries and multiple-choice questions using HuggingFace pre-trained language models. (Project is still under development)

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- Firebase Authentication (Email/Password)
- Axios for API calls

### Backend
- Node.js
- Express.js
- Multer (file uploads)
- pdf-parse (PDF text extraction)
- Axios (HuggingFace API calls)
- Winston (logging)
- Helmet (security)
- Compression (performance)
- Express Rate Limit (DDoS protection)
- Express Validator (input validation)

### Database
- MongoDB (Mongoose ODM)
- Connection pooling
- Optimized indexes

### AI
- HuggingFace Inference API
- Circuit breaker pattern
- Retry logic with exponential backoff
- Models:
  - `facebook/bart-large-cnn` (summarization)
  - `google/pegasus-xsum` (summarization)
  - Multiple fallback models


## Features

-  User authentication with Firebase
-  PDF upload with drag & drop
-  AI-powered text summarization
-  Automatic MCQ generation (5 questions per document)
-  Session history
-  Dark and light themed modern UI
-  Responsive design
-  Protected routes
-  Error handling

