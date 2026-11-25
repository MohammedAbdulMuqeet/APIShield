export const workspaceId = new URLSearchParams(location.search).get('workspace')
export const workspacePath = path => workspaceId ? path + '?workspace=' + encodeURIComponent(workspaceId) : path

export async function api(path, body, method = 'POST') {
  const headers = {}
  if (workspaceId && /^(services|events|config|audit)([/?]|$)/.test(path))
    headers['X-Workspace-Id'] = workspaceId
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : method,
    headers, body: JSON.stringify(body),
  })
  const data = res.status === 204 ? null : await res.json()
  if (!res.ok) throw Object.assign(Error(data?.error || 'Request failed'), { status: res.status })
  return data
}
