import { Event } from '../models/Event.js'
export const record = (service, message, severity) =>
  Event.create({
    owner: service.owner,
    service: service.name,
    message,
    severity,
  })
export function signal(service, runtime, kind, threshold) {
  const now = Date.now()
  let bucket = runtime.signals.get(kind)
  if (!bucket || bucket.start + 60000 <= now)
    runtime.signals.set(kind, (bucket = { start: now, count: 0 }))
  if (++bucket.count === threshold) return record(service, kind, 'High')
}
