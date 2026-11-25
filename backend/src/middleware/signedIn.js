import { verifySession } from '../services/sessions.js'
export async function signedIn(req, _res, next) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1]
  const session = await verifySession(token)
  req.userId = session.userId
  req.sessionId = session.sessionId
  next()
}
