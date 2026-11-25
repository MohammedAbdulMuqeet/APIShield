import express from 'express'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Service, Event } from './models.js'
import { signedIn } from './auth.js'

export const management = express.Router()
export const gateway = express.Router()
const allowed = (process.env.UPSTREAM_ORIGINS || 'http://127.0.0.1:4101,http://127.0.0.1:4102,http://127.0.0.1:4103').split(',').map(s => new URL(s.trim()).origin)
const algorithms = ['round-robin', 'weighted', 'least-connections']
const digest = key => createHash('sha256').update(key).digest()
const runtime = new Map()
function state(service) {
  const id = String(service._id)
  if (!runtime.has(id)) runtime.set(id, {
    cursor: 0, windows: new Map(), signals: new Map(), backup: false,
    nodes: service.nodes.map(node => ({ ...node.toObject(), active: 0, requests: 0, failures: 0, until: 0, probing: false }))
  })
  return runtime.get(id)
}
const circuit = n => n.probing ? 'half-open' : n.until > Date.now() ? 'open' : n.until ? 'half-open' : 'closed'
const record = (s, message, severity) => Event.create({ owner: s.owner, service: s.name, message, severity })
management.use(signedIn)
management.get('/config', (_req, res) => res.json({ origins: allowed, algorithms }))
management.get('/services', async (req, res) => {
  const services = await Service.find({ owner: req.userId })
  res.json(services.map(s => ({ ...s.toObject(), nodes: state(s).nodes.map(n => ({
    origin: n.origin, backup: n.backup, weight: n.weight, requests: n.requests, active: n.active, circuit: circuit(n)
  })) })))
})
management.get('/events', async (req, res) => res.json(await Event.find({ owner: req.userId }).sort({ at: -1 }).limit(50)))
management.post('/services', async (req, res) => {
  const { name, nodes, algorithm, limit, limiter = 'sliding-window' } = req.body || {}
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || !algorithms.includes(algorithm) ||
      !['sliding-window','token-bucket'].includes(limiter) || !Number.isInteger(limit) || limit < 1 || limit > 1000 || !Array.isArray(nodes) || !nodes.length ||
      nodes.length > allowed.length || nodes.some(n => !n || !allowed.includes(n.origin) || !Number.isInteger(n.weight) ||
        n.weight < 1 || n.weight > 10 || typeof n.backup !== 'boolean') || nodes.every(n => n.backup) ||
      new Set(nodes.map(n => n.origin)).size !== nodes.length) return res.status(400).json({ error: 'Check the service settings and select a primary node.' })
  const key = randomBytes(32).toString('hex')
  const service = await Service.create({ owner: req.userId, name: name.trim(), nodes, algorithm, limit, limiter, keyHash: digest(key).toString('hex') })
  res.status(201).json({ id: service.id, key })
})
function signal(s, r, kind, threshold) {
  const now = Date.now()
  let bucket = r.signals.get(kind)
  if (!bucket || bucket.start + 60000 <= now) r.signals.set(kind, bucket = { start: now, count: 0 })
  if (++bucket.count === threshold) return record(s, kind, 'High')
}
function consume(r, scope, limit, now, limiter) {
  if (limiter === 'token-bucket') {
    for (const [key, bucket] of r.windows) if (bucket.at <= now - 60000) r.windows.delete(key)
    const last = r.windows.get(scope) || { tokens: limit, at: now }
    const tokens = Math.min(limit, last.tokens + (now - last.at) * limit / 60000)
    if (tokens < 1) return Math.ceil((1 - tokens) * 60 / limit)
    r.windows.set(scope, { tokens: tokens - 1, at: now })
    return 0
  }
  for (const [k, hits] of r.windows) if (hits.at(-1) <= now - 60000) r.windows.delete(k)
  const hits = (r.windows.get(scope) || []).filter(t => t > now - 60000)
  if (hits.length >= limit) return Math.max(1, Math.ceil((hits[0] + 60000 - now) / 1000))
  hits.push(now)
  r.windows.set(scope, hits)
  return 0
}
function pick(r, algorithm, attempted) {
  const available = r.nodes.filter(n => !attempted.has(n) && !n.probing && n.until <= Date.now())
  const primary = available.filter(n => !n.backup)
  const pool = primary.length ? primary : available
  if (!pool.length) return null
  if (algorithm === 'least-connections') return pool.reduce((a,b) => a.active <= b.active ? a : b)
  const sequence = algorithm === 'weighted' ? pool.flatMap(n => Array(n.weight).fill(n)) : pool
  return sequence[r.cursor++ % sequence.length]
}
gateway.use('/:id', async (req, res) => {
  const s = /^[a-f\d]{24}$/i.test(req.params.id) && await Service.findById(req.params.id).select('+keyHash')
  if (!s) return res.status(404).json({ error: 'Unknown gateway.' })
  const r = state(s)
  if (!timingSafeEqual(digest(req.get('x-api-key') || ''), Buffer.from(s.keyHash, 'hex'))) {
    await signal(s, r, 'Repeated invalid gateway keys', 5)
    return res.status(401).json({ error: 'Invalid gateway key.' })
  }
  if (!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(req.method)) return res.sendStatus(405)
  const now = Date.now()
  const delay = consume(r, 'ip:' + req.ip, s.limit, now, s.limiter) || consume(r, 'key', s.limit, now, s.limiter)
  if (delay) {
    await signal(s, r, 'Repeated rate-limit violations', 3)
    return res.set('Retry-After', String(delay)).status(429).json({ error: 'Request limit reached.' })
  }
  const attempted = new Set()
  while (attempted.size < r.nodes.length) {
    const n = pick(r, s.algorithm, attempted)
    if (!n) break
    attempted.add(n)
    const wasProbe = Boolean(n.until)
    if (wasProbe) n.probing = true
    n.active++
    n.requests++
    let result, body
    try {
      const url = new URL(n.origin)
      const path = req.url.split('?')[0]
      url.pathname = path
      url.search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      result = await fetch(url, { method: req.method, redirect: 'manual', signal: AbortSignal.timeout(3000),
        headers: { accept: req.get('accept') || '*/*', 'content-type': req.get('content-type') || 'application/octet-stream' },
        body: ['GET','HEAD'].includes(req.method) ? undefined : req.body })
      if (Number(result.headers.get('content-length')) > 4194304) throw Error('Response too large')
      const chunks = []
      let size = 0
      for await (const chunk of result.body || []) {
        if ((size += chunk.length) > 4194304) throw Error('Response too large')
        chunks.push(chunk)
      }
      body = Buffer.concat(chunks)
    } catch { result = null }
    finally { n.active--; if (wasProbe) n.probing = false }
    const failed = !result || result.status >= 500
    if (failed) {
      if (++n.failures >= 3 || wasProbe) {
        const opening = !n.until || wasProbe
        n.until = Date.now() + 15000
        if (opening) await record(s, 'Circuit opened for ' + n.origin, 'Warning')
      }
      if (['GET','HEAD'].includes(req.method)) continue
    } else {
      if (!n.until || wasProbe) { n.failures = 0; n.until = 0 }
      if (wasProbe) await record(s, 'Circuit recovered for ' + n.origin, 'Info')
      if (r.backup !== n.backup) {
        r.backup = n.backup
        await record(s, n.backup ? 'Traffic switched to backup' : 'Primary service recovered', 'Info')
      }
    }
    if (!result) return res.status(502).json({ error: 'Upstream unavailable.' })
    return res.set('Content-Type', result.headers.get('content-type') || 'application/octet-stream')
      .set('Content-Disposition','attachment').set('Content-Security-Policy',"sandbox; default-src 'none'")
      .status(result.status).end(body)
  }
  res.status(503).json({ error: 'No available upstream.' })
})
