import { pick } from './routing.js'
import { record } from './incidents.js'
const canRetry = (method) => method === 'GET' || method === 'HEAD'
async function requestNode(node, req, sample) {
  const url = new URL(node.origin)
  const path = req.url.split('?')[0]
  url.pathname = path
  url.search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const result = await fetch(url, {
    method: req.method,
    redirect: 'manual',
    signal: AbortSignal.timeout(3000),
    headers: {
      accept: req.get('accept') || '*/*',
      'content-type': req.get('content-type') || 'application/octet-stream',
    },
    body: canRetry(req.method) ? undefined : req.body,
  })
  if (result.status >= 500) sample.upstream5xx++
  if (Number(result.headers.get('content-length')) > 4194304)
    throw Error('Response too large')
  const chunks = []
  let size = 0
  for await (const chunk of result.body || []) {
    if ((size += chunk.length) > 4194304) throw Error('Response too large')
    chunks.push(chunk)
  }
  return {
    status: result.status,
    contentType: result.headers.get('content-type'),
    body: Buffer.concat(chunks),
  }
}
async function trackResult(service, runtime, node, wasProbe, failed) {
  if (failed) {
    if (++node.failures >= 3 || wasProbe) {
      const opening = !node.until || wasProbe
      node.until = Date.now() + 15000
      if (opening)
        await record(service, 'Circuit opened for ' + node.origin, 'Warning')
    }
  } else {
    if (!node.until || wasProbe) {
      node.failures = 0
      node.until = 0
    }
    if (wasProbe)
      await record(service, 'Circuit recovered for ' + node.origin, 'Info')
    if (runtime.backup !== node.backup) {
      runtime.backup = node.backup
      await record(
        service,
        node.backup
          ? 'Traffic switched to backup'
          : 'Primary service recovered',
        'Info',
      )
    }
  }
}
export async function forward(service, runtime, req, sample) {
  const attempted = new Set()
  while (attempted.size < runtime.nodes.length) {
    const node = pick(runtime, service.algorithm, attempted)
    if (!node) break
    attempted.add(node)
    const wasProbe = Boolean(node.until)
    if (wasProbe) node.probing = true
    node.active++
    node.requests++
    sample.attempts++
    let result
    try {
      result = await requestNode(node, req, sample)
    } catch {
      result = null
    } finally {
      node.active--
      if (wasProbe) node.probing = false
    }
    const failed = !result || result.status >= 500
    await trackResult(service, runtime, node, wasProbe, failed)
    if (failed && canRetry(req.method)) continue
    return result || { status: 502, error: 'Upstream unavailable.' }
  }
  return { status: 503, error: 'No available upstream.' }
}
