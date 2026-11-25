function consume(runtime, scope, limit, now, limiter) {
  if (limiter === 'token-bucket') {
    for (const [key, bucket] of runtime.windows)
      if (bucket.at <= now - 60000) runtime.windows.delete(key)
    const last = runtime.windows.get(scope) || { tokens: limit, at: now }
    const tokens = Math.min(
      limit,
      last.tokens + ((now - last.at) * limit) / 60000,
    )
    if (tokens < 1) return Math.ceil(((1 - tokens) * 60) / limit)
    runtime.windows.set(scope, { tokens: tokens - 1, at: now })
    return 0
  }
  for (const [key, hits] of runtime.windows)
    if (hits.at(-1) <= now - 60000) runtime.windows.delete(key)
  const hits = (runtime.windows.get(scope) || []).filter((t) => t > now - 60000)
  if (hits.length >= limit)
    return Math.max(1, Math.ceil((hits[0] + 60000 - now) / 1000))
  hits.push(now)
  runtime.windows.set(scope, hits)
  return 0
}

export function retryAfter(service, runtime, ip) {
  const now = Date.now()
  const check = (scope) =>
    consume(runtime, scope, service.limit, now, service.limiter)
  return check('ip:' + ip) || check('key')
}
