export async function api(path, body, method = 'POST') {
  const res = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  const data = res.status === 204 ? null : await res.json()
  if (!res.ok)
    throw Object.assign(Error(data?.error || 'Request failed'), {
      status: res.status,
    })
  return data
}
