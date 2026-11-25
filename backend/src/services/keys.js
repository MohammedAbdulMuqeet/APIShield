import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
const digest = (key) => createHash('sha256').update(key).digest()

export function issueKey() {
  const key = randomBytes(32).toString('hex')
  return { key, keyHash: digest(key).toString('hex') }
}
export function matchesKey(key, hash) {
  return timingSafeEqual(digest(key), Buffer.from(hash, 'hex'))
}

export function identifyClient(service, credential) {
  if (!credential) return null
  if (credential.includes('.')) {
    const match = credential.match(/^([a-f0-9]{24})\.([a-f0-9]{64})$/)
    const client = match && service.clientKeys.id(match[1])
    return client && matchesKey(match[2], client.hash) ? client.id : null
  }
  return !service.defaultKeyRevoked &&
    service.keyHash &&
    matchesKey(credential, service.keyHash)
    ? 'default'
    : null
}
