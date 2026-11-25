import { Service } from '../models/Service.js'
import { state } from './routing.js'
import { record } from './incidents.js'

async function checkNode(service, node) {
  const url = new URL(node.origin)
  url.pathname = service.healthPath || '/'
  let healthy = false
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    })
    healthy = response.ok
    await response.body?.cancel()
  } catch {
    /* Connection errors and timeouts count as failed probes. */
  }
  const health = healthy ? 'Healthy' : 'Unhealthy'
  const previous =
    node.checkedPath === service.healthPath ? node.health : undefined
  node.health = health
  node.checkedAt = new Date()
  node.checkedPath = service.healthPath
  if (health !== previous && (!healthy || previous === 'Unhealthy')) {
    await record(
      service,
      (healthy ? 'Health check recovered: ' : 'Health check failed: ') +
        node.origin,
      healthy ? 'Info' : 'Warning',
    )
  }
}

export async function runHealthChecks() {
  const pending = []
  for await (const service of Service.find({
    healthChecks: true,
    enabled: { $ne: false },
    deletedAt: null,
  }).cursor()) {
    for (const node of state(service).nodes) {
      pending.push(checkNode(service, node))
      if (pending.length === 4) await Promise.all(pending.splice(0))
    }
  }
  await Promise.all(pending)
}
export function startHealthChecks() {
  const interval = Math.max(
    1000,
    Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000,
  )
  async function tick() {
    try {
      await runHealthChecks()
    } catch (error) {
      console.error('Health check cycle failed:', error.name)
    }
    setTimeout(tick, interval).unref()
  }
  void tick()
}
