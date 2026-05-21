import { EventEmitter } from 'events'
import logger from './logger.js'

const jobs = new Map()
const JOB_TTL_MS = 10 * 60 * 1000 // 10 minutes

export const createJob = (jobId) => {
  const job = {
    emitter: new EventEmitter(),
    events: [],
    done: false
  }
  jobs.set(jobId, job)
  setTimeout(() => {
    jobs.delete(jobId)
    logger.debug(`Job ${jobId} expired`)
  }, JOB_TTL_MS)
  return job
}

export const getJob = (jobId) => jobs.get(jobId)

export const emitJobEvent = (jobId, data) => {
  const job = jobs.get(jobId)
  if (!job) return
  job.events.push(data)
  job.emitter.emit('event', data)
  if (data.stage === 'complete' || data.stage === 'error') {
    job.done = true
  }
}
