import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

async function api(path, body) {
  const res = await fetch('/api/' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
  const data = res.status === 204 ? null : await res.json()
  if (!res.ok) throw Object.assign(Error(data?.error || 'Request failed'), { status: res.status })
  return data
}

function Access({ enter }) {
  const [signup, setSignup] = useState(location.pathname === '/signup')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { enter(await api('auth/' + (signup ? 'signup' : 'login'), Object.fromEntries(new FormData(e.target)))) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <main className="access"><div className="brand">APIShield</div><section><h1>{signup ? 'Create an account' : 'Welcome back'}</h1>
    <form onSubmit={submit}>{signup && <label>Name<input name="name" maxLength="80" autoComplete="name" required/></label>}
    <label>Email<input type="email" name="email" autoComplete="email" required/></label>
    <label>Password<input type="password" name="password" minLength={signup ? 10 : 1} autoComplete={signup ? 'new-password' : 'current-password'} required/></label>
    {signup && <small>Use at least 10 characters.</small>}
    <button disabled={busy}>{signup ? 'Create account' : 'Sign in'}</button></form>
    <a href={signup ? '/login' : '/signup'}>{signup ? 'Already registered? Sign in' : 'Create an account'}</a>
    <p role="alert">{error}</p></section></main>
}

function Setup({ config, saved }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nodes = config.origins.flatMap((origin, i) => data.get('role'+i) === 'off' ? [] : [{
      origin, backup: data.get('role'+i) === 'backup', weight: Number(data.get('weight'+i))
    }])
    setBusy(true); setError('')
    try {
      saved(await api('services', { name: data.get('name'), algorithm: data.get('algorithm'), limit: Number(data.get('limit')), limiter: data.get('limiter'), nodes }))
      form.reset()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <section><h2>Register a gateway</h2><form onSubmit={submit}><label>Service name<input name="name" maxLength="80" required/></label>
    <label>Load balancing<select name="algorithm">{config.algorithms.map(a => <option key={a}>{a}</option>)}</select></label>
    <label>Rate policy<select name="limiter"><option value="sliding-window">Sliding window</option><option value="token-bucket">Token bucket</option></select></label>
    <label>Requests per minute<input type="number" min="1" max="1000" defaultValue="60" name="limit" required/></label>
    <fieldset><legend>Upstream nodes</legend>{config.origins.map((o,i) => <div key={o} className="node"><strong>{o}</strong>
      <label>Role<select name={'role'+i} defaultValue={i===0 ? 'primary' : 'off'}><option value="primary">Primary</option><option value="backup">Backup</option><option value="off">Unused</option></select></label>
      <label>Weight<input name={'weight'+i} type="number" defaultValue="1" min="1" max="10" required/></label></div>)}</fieldset>
    <button disabled={busy}>Register gateway</button><span role="alert">{error}</span></form></section>
}

function Console({ user, leave }) {
  const [snapshot, setSnapshot] = useState(null)
  const [secret, setSecret] = useState(null)
  const [error, setError] = useState('')
  const [revision, update] = useState(0)
  useEffect(() => {
    let active = true, timer
    async function refresh() {
      try {
        const [config, services, events] = await Promise.all(['config','services','events'].map(path => api(path)))
        if (active) { setSnapshot({ config, services, events }); setError('') }
      } catch (err) { if (active) { if (err.status === 401) leave(); else setError(err.message) } }
      if (active) timer = setTimeout(refresh, 4000)
    }
    refresh()
    return () => { active = false; clearTimeout(timer) }
  }, [revision])
  return <main><header><b className="brand">APIShield</b><span>{user.name}</span><button className="secondary" onClick={async () => {
    try { await api('auth/logout', {}); leave() } catch (err) { setError(err.message) }
  }}>Sign out</button></header><h1>Gateway console</h1><p role="alert">{error}</p>
  {snapshot ? <div className="grid"><div><h2>Your gateways</h2>{!snapshot.services.length && <p>Register a service to start routing traffic.</p>}
  {secret && <section><h3>Save your gateway key</h3><p>Shown once. Send it in the X-API-Key header.</p><code>{secret.key}</code><button onClick={() => setSecret(null)}>Dismiss</button></section>}
  {snapshot.services.map(s => <section key={s._id}><h3>{s.name}</h3><code>/gateway/{s._id}/</code><p>{s.algorithm} · {s.limit} requests/min</p>
    {s.nodes.map(n => <div className="metric" key={n.origin}><strong>{n.origin}</strong><span>{n.backup ? 'Backup' : 'Primary'} · {n.circuit} · {n.requests} attempts · {n.active} active</span></div>)}</section>)}
  <h2>Incident and recovery history</h2>{snapshot.events.length ? snapshot.events.map(e => <article key={e._id}><b>{e.severity} · {e.service}</b><p>{e.message}</p><small>{new Date(e.at).toLocaleString()}</small></article>) : <p>No events recorded.</p>}</div>
  <Setup config={snapshot.config} saved={result => { setSecret(result); update(v => v + 1) }}/></div> : <p>Loading workspace…</p>}</main>
}
function App() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  useEffect(() => { api('auth/me').then(setUser).catch(err => err.status === 401 ? setUser(null) : setError('Unable to reach the backend. Refresh to retry.')) }, [])
  function change(next) { history.replaceState({}, '', next ? '/' : '/login'); setUser(next) }
  if (user === undefined) return <main>{error || 'Connecting…'}</main>
  return user ? <Console user={user} leave={() => change(null)}/> : <Access enter={change}/>
}
createRoot(document.getElementById('root')).render(<App/>)
