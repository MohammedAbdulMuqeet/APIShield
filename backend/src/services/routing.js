const runtime = new Map()
export function state(service) {
  const id = String(service._id)
  if (!runtime.has(id))
    runtime.set(id, {
      cursor: 0,
      windows: new Map(),
      signals: new Map(),
      backup: false,
      nodes: service.nodes.map((node) => ({
        ...node.toObject(),
        active: 0,
        requests: 0,
        failures: 0,
        until: 0,
        probing: false,
      })),
    })
  return runtime.get(id)
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
  if (algorithm === 'least-connections')
    return pool.reduce((a, b) => (a.active <= b.active ? a : b))
  const sequence =
    algorithm === 'weighted'
      ? pool.flatMap((node) => Array(node.weight).fill(node))
      : pool
  return sequence[runtime.cursor++ % sequence.length]
}
