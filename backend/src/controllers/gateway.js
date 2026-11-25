import { Service } from '../models/Service.js'
import { identifyClient } from '../services/keys.js'
import { observeRequest } from '../services/measurements.js'
import { signal } from '../services/incidents.js'
import { retryAfter } from '../services/rateLimit.js'
import { state } from '../services/routing.js'
import { forward } from '../services/forward.js'
export async function proxy(req, res) {
  const started = performance.now()
  const service =
    /^[a-f\d]{24}$/i.test(req.params.id) &&
    (await Service.findOne({ _id: req.params.id, deletedAt: null }).select(
      '+keyHash +clientKeys',
    ))
  if (!service) return res.status(404).json({ error: 'Unknown gateway.' })
  const runtime = state(service)
  const sample = observeRequest(service, res, started)
  sample.client = identifyClient(service, req.get('x-api-key'))
  if (!sample.client) {
    await signal(service, runtime, 'Repeated invalid gateway keys', 5)
    return res.status(401).json({ error: 'Invalid gateway key.' })
  }
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
    return res.sendStatus(405)
  if (!service.enabled)
    return res.status(503).json({ error: 'Gateway paused.' })
  const delay = retryAfter(service, runtime, req.ip)
  if (delay) {
    await signal(service, runtime, 'Repeated rate-limit violations', 3)
    return res
      .set('Retry-After', String(delay))
      .status(429)
      .json({ error: 'Request limit reached.' })
  }

  const result = await forward(service, runtime, req, sample)
  if (result.error)
    return res.status(result.status).json({ error: result.error })
  res
    .set('Content-Type', result.contentType || 'application/octet-stream')
    .set('Content-Disposition', 'attachment')
    .set('Content-Security-Policy', "sandbox; default-src 'none'")
    .status(result.status)
    .end(result.body)
}
