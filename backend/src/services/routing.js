const runtime = new Map()
export const forgetRuntime = (id) => runtime.delete(String(id))
export function state(service) {
  const id = String(service._id)
  const previous = runtime.get(id)
  if (previous && previous.version === service.__v) return previous
  const stale = previous && previous.version > service.__v
  const retained = new Map(
    (stale ? [] : previous?.nodes || []).map((node) => [node.origin, node]),
  )
  const ratePolicy = service.limiter + ':' + service.limit
  const current = {
    version: service.__v,
    ratePolicy,
    cursor: 0,
    windows:
      !stale && previous?.ratePolicy === ratePolicy
        ? previous.windows
        : new Map(),
    signals: previous?.signals || new Map(),
    backup: previous?.backup || false,
    nodes: service.nodes.map((node) => {
      const entry = retained.get(node.origin) || {
        active: 0,
        requests: 0,
        failures: 0,
        until: 0,
        probing: false,
      }
      return Object.assign(entry, node.toObject())
    }),
  }
  if (!stale) runtime.set(id, current)
  return current
}
export const circuit = (node) =>
  node.probing
    ? 'half-open'
    : node.until > Date.now()
      ? 'open'
      : node.until
        ? 'half-open'
        : 'closed'
export function pick(runtime, algorithm, attempted) {
  const available = runtime.nodes.filter(
    (node) => !attempted.has(node) && !node.probing && node.until <= Date.now(),
  )
  const primary = available.filter((node) => !node.backup)
  const pool = primary.length ? primary : available
  if (!pool.length) return null
  if (algorithm === 'random')
    return pool[Math.floor(Math.random() * pool.length)]
  if (algorithm === 'power-of-two' && pool.length > 1) {
    const first = Math.floor(Math.random() * pool.length)
    const second =
      (first + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
    return pool[first].active <= pool[second].active
      ? pool[first]
      : pool[second]
  }
  if (algorithm === 'least-connections')
    return pool.reduce((a, b) => (a.active <= b.active ? a : b))
  const sequence =
    algorithm === 'weighted'
      ? pool.flatMap((node) => Array(node.weight).fill(node))
      : pool
  return sequence[runtime.cursor++ % sequence.length]
}
