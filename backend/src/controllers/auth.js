import { register, authenticate, publicUser } from '../services/accounts.js'
import {
  startSession,
  sessionLifetime,
  revokeSession,
} from '../services/sessions.js'
import { User } from '../models/User.js'
const options = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
}
async function sendSession(res, user, status) {
  const token = await startSession(user)
  res
    .cookie('session', token, { ...options, maxAge: sessionLifetime })
    .status(status)
    .json(publicUser(user))
}
export async function signup(req, res) {
  await sendSession(res, await register(req.body || {}), 201)
}
export async function login(req, res) {
  await sendSession(res, await authenticate(req.body || {}), 200)
}
export async function me(req, res) {
  res.json(publicUser(await User.findById(req.userId)))
}
export async function logout(req, res) {
  await revokeSession(req.sessionId)
  res.clearCookie('session', options).sendStatus(204)
}
