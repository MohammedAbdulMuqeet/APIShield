import express from 'express'
import mongoose from 'mongoose'
import helmet from 'helmet'
import { auth } from './auth.js'
import { gateway, management } from './gateway.js'
import { User, Session, Event } from './models.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use('/gateway', express.raw({ type: () => true, limit: '256kb' }), gateway)
app.use('/api', express.json({ limit: '32kb' }))
app.get('/api/health', async (_req, res) => {
  try { await mongoose.connection.db.admin().ping(); res.json({ database: 'Connected' }) }
  catch { res.status(503).json({ database: 'Unavailable' }) }
})
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'JSON required.' })
  next()
})
app.use('/api/auth', auth)
app.use('/api', management)
app.use((error, _req, res, _next) => {
  res.status(error.status || 500).json({ error: error.status === 413 ? 'Payload too large.' : error.status === 400 ? 'Invalid request.' : 'Service temporarily unavailable.' })
})
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apishield', { serverSelectionTimeoutMS: 5000 })
await Promise.all([User.init(), Session.init(), Event.init()])
app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('APIShield listening on', process.env.PORT || 3001))