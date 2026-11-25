import jwt from 'jsonwebtoken'
import { randomBytes, randomUUID } from 'node:crypto'
import { Session } from '../models/Session.js'
import { HttpError } from '../middleware/errors.js'
const lifetimeSeconds = 8 * 60 * 60
export const sessionLifetime = lifetimeSeconds * 1000
const secret = process.env.JWT_SECRET || randomBytes(48).toString('hex')
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET)
  throw Error('Set JWT_SECRET in production')

export async function startSession(user) {
  const id = randomUUID()
  await Session.create({
    _id: id,
    user: user._id,
    expires: new Date(Date.now() + sessionLifetime),
  })
  return jwt.sign({}, secret, {
    subject: String(user._id),
    jwtid: id,
    issuer: 'apishield',
    expiresIn: lifetimeSeconds,
  })
}
export async function verifySession(token) {
  let claims
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'apishield',
    })
  } catch {
    throw new HttpError(401, 'Please sign in.')
  }
  if (
    !(await Session.exists({
      _id: claims.jti,
      user: claims.sub,
      expires: { $gt: new Date() },
    }))
  )
    throw new HttpError(401, 'Session expired.')
  return { userId: claims.sub, sessionId: claims.jti }
}
export const revokeSession = (id) => Session.deleteOne({ _id: id })
