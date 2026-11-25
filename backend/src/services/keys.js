import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
const digest = (key) => createHash('sha256').update(key).digest()

export function issueKey() {
  const key = randomBytes(32).toString('hex')
  return { key, keyHash: digest(key).toString('hex') }
}
export function matchesKey(key, hash) {
  return timingSafeEqual(digest(key), Buffer.from(hash, 'hex'))
}
