import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import { User, Session } from './models.js'

export const auth = express.Router()
const secret = process.env.JWT_SECRET || randomBytes(48).toString('hex')
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw Error('Set JWT_SECRET in production')
const options = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api' }
const publicUser = user => ({ name: user.name, email: user.email })
const dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)

export async function signedIn(req, res, next) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1]
  let claims
  try { claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'apishield' }) }
  catch { return res.status(401).json({ error: 'Please sign in.' }) }
  if (!await Session.exists({ _id: claims.jti, user: claims.sub, expires: { $gt: new Date() } })) {
    return res.status(401).json({ error: 'Session expired.' })
  }
  req.userId = claims.sub
  req.sessionId = claims.jti
  next()
}

const throttle = rateLimit({ windowMs: 15 * 60_000, limit: 30, skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again later.' } })
for (const mode of ['signup', 'login']) {
  auth.post('/' + mode, throttle, async (req, res) => {
    const { password, name } = req.body || {}
    const email = typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase()
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || Buffer.byteLength(password) > 72)
      return res.status(400).json({ error: 'Enter a valid email and password (maximum 72 bytes).' })
    let user
    if (mode === 'signup') {
      if (password.length < 10 || typeof name !== 'string' || !name.trim() || name.trim().length > 80)
        return res.status(400).json({ error: 'Enter a name and a password of at least 10 characters.' })
      try { user = await User.create({ email, name: name.trim(), password: await bcrypt.hash(password, 12) }) }
      catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'Email already registered.' }); throw error }
    } else {
      user = await User.findOne({ email })
      if (!await bcrypt.compare(password, user?.password || dummyHash) || !user) return res.status(401).json({ error: 'Incorrect email or password.' })
    }
    const id = randomUUID()
    const ttl = 8 * 3600_000
    await Session.create({ _id: id, user: user._id, expires: new Date(Date.now() + ttl) })
    const token = jwt.sign({}, secret, { subject: String(user._id), jwtid: id, issuer: 'apishield', expiresIn: '8h' })
    res.cookie('session', token, { ...options, maxAge: ttl }).status(mode === 'signup' ? 201 : 200).json(publicUser(user))
  })
}
auth.get('/me', signedIn, async (req, res) => res.json(publicUser(await User.findById(req.userId))))
auth.post('/logout', signedIn, async (req, res) => {
  await Session.deleteOne({ _id: req.sessionId })
  res.clearCookie('session', options).sendStatus(204)
})