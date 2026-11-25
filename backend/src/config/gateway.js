export const allowed = (
  process.env.UPSTREAM_ORIGINS ||
  'http://127.0.0.1:4101,http://127.0.0.1:4102,http://127.0.0.1:4103'
)
  .split(',')
  .map((s) => new URL(s.trim()).origin)
export const algorithms = [
  'round-robin',
  'weighted',
  'least-connections',
  'random',
  'power-of-two',
]

export function normalizeOrigin(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
    return url.origin
  } catch {
    return null
  }
}

export function isPermittedOrigin(origin) {
  if (allowed.some((value) => normalizeOrigin(value) === origin)) return true
  // The default local workspace reserves these ports for user-run demo servers.
  return (
    !process.env.UPSTREAM_ORIGINS &&
    /^http:\/\/127\.0\.0\.1:41\d{2}$/.test(origin)
  )
}
