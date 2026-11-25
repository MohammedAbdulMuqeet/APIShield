import express from 'express'
import mongoose from 'mongoose'
import helmet from 'helmet'
import { auth } from './routes/auth.js'
import { gateway } from './routes/gateway.js'
import { management } from './routes/management.js'
import { handleError } from './middleware/errors.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use('/gateway', express.raw({ type: () => true, limit: '256kb' }), gateway)
app.use('/api', express.json({ limit: '32kb' }))
app.get('/api/health', async (_req, res) => {
  try {
    await mongoose.connection.db.admin().ping()
    res.json({ database: 'Connected' })
  } catch {
    res.status(503).json({ database: 'Unavailable' })
  }
})
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'GET' && !req.is('application/json'))
    return res.status(415).json({ error: 'JSON required.' })
  next()
})
app.use('/api/auth', auth)
app.use('/api', management)
app.use(handleError)
