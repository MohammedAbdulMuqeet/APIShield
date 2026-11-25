import React, { useState } from 'react'
import { api } from '../api.js'

export function selectWorkspace(id) {
  location.assign(id ? '/?workspace=' + encodeURIComponent(id) : '/')
}

export default function Workspaces({ current, reload }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  async function act(fn) {
    setError('')
    try { await fn() } catch (err) { setError(err.message) }
  }
  function submit(fn) {
    return e => {
      e.preventDefault()
      const form = e.currentTarget
      const values = Object.fromEntries(new FormData(form))
      act(async () => { await fn(values); form.reset() })
    }
  }
  const membersPath = 'workspaces/' + current?.id + '/members/'
  return <details className="workspace-management">
    <summary>Manage workspaces</summary>
    <form onSubmit={submit(async data => selectWorkspace((await api('workspaces', data)).id))}>
      <label>Organization name<input name="name" required maxLength={80} /></label>
      <button>Create workspace</button>
    </form>
    <form onSubmit={submit(async data => selectWorkspace((await api('workspaces/join', data)).id))}>
      <label>Invitation code<input name="token" required /></label><button>Join workspace</button>
    </form>
    {current?.role === 'owner' && <>
      <h2>Team members</h2>
      <form onSubmit={submit(async data => {
        const result = await api('workspaces/' + current.id + '/invitations', data)
        setCode(result.token)
        await reload()
      })}>
        <label>Member email<input type="email" name="email" required /></label>
        <label>Invitation role<select name="role"><option>viewer</option><option>editor</option></select></label>
        <button>Create invitation</button>
      </form>
      {code && <p>Share this single-use code privately with the invitee. It expires in seven days. <code>{code}</code></p>}
      {current.members.map(m => <div className="metric" key={m.id}>
        <span>{m.email} ({m.status})</span>
        <select aria-label={'Role for ' + m.email} value={m.role} onChange={e => {
          const role = e.target.value
          act(async () => { await api(membersPath + m.id, { role }, 'PATCH'); await reload() })
        }}><option>viewer</option><option>editor</option></select>
        <button onClick={() => act(async () => {
          await api(membersPath + m.id, {}, 'DELETE')
          setCode('')
          await reload()
        })}>Remove</button>
      </div>)}
    </>}
    {error && <p role="alert">{error}</p>}
  </details>
}
