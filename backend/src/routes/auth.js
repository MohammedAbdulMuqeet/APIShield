import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { signedIn } from '../middleware/signedIn.js'
import { signup, login, me, logout } from '../controllers/auth.js'
export const auth = Router()
const throttle = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again later.' },
})

auth.post('/signup', throttle, signup)
auth.post('/login', throttle, login)
auth.get('/me', signedIn, me)
auth.post('/logout', signedIn, logout)
