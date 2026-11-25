import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import GatewayForm from '../components/GatewayForm.jsx'
import { Brand, GatewayGraphic } from '../components/Identity.jsx'

export default function GatewayConsole({ user, leave }) {
  const [snapshot, setSnapshot] = useState(null)
  const [secret, setSecret] = useState(null)
  const [error, setError] = useState('')
  const [revision, update] = useState(0)
  useEffect(() => {
    let active = true,
      timer
    async function refresh() {
      try {
        const [config, services, events] = await Promise.all(
          ['config', 'services', 'events'].map((path) => api(path)),
        )
        if (active) {
          setSnapshot({ config, services, events })
          setError('')
        }
      } catch (err) {
        if (active) {
          if (err.status === 401) leave()
          else setError(err.message)
        }
      }
      if (active) timer = setTimeout(refresh, 4000)
    }
    refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [revision])
  return (
    <main>
      <header className="topbar">
        <Brand />
        <nav aria-label="Workspace"><a href="#gateways">Gateways</a><a href="#incidents">Incidents</a><a href="#registration">Register</a></nav>
        <span className="account">{user.name}</span>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await api('auth/logout', {})
              leave()
            } catch (err) {
              setError(err.message)
            }
          }}
        >
          Sign out
        </button>
      </header>
      <div className="hero"><h1>Gateway console</h1><GatewayGraphic /></div>
      <p role="alert">{error}</p>
      {snapshot ? (
        <>
        <dl className="summary">
          <div><dt>Registered gateways</dt><dd>{snapshot.services.length}</dd></div>
          <div><dt>Upstream assignments</dt><dd>{snapshot.services.reduce((count, service) => count + service.nodes.length, 0)}</dd></div>
          <div><dt>Active requests</dt><dd>{snapshot.services.reduce((count, service) => count + service.nodes.reduce((total, node) => total + node.active, 0), 0)}</dd></div>
        </dl>
        <div className="grid">
          <div>
            <h2 id="gateways">Your gateways</h2>
            {!snapshot.services.length && (
              <p>Register a service to start routing traffic.</p>
            )}
            {secret && (
              <section className="panel key-panel">
                <h3>Save your gateway key</h3>
                <p>Shown once. Send it in the X-API-Key header.</p>
                <code>{secret.key}</code>
                <button onClick={() => setSecret(null)}>Dismiss</button>
              </section>
            )}
            {snapshot.services.map((s) => (
              <section className="panel service" key={s._id}>
                <h3>{s.name}</h3>
                <code>/gateway/{s._id}/</code>
                <p>
                  {s.algorithm} · {s.limit} requests/min
                </p>
                {s.nodes.map((n) => (
                  <div className="metric" key={n.origin}>
                    <strong>{n.origin}</strong>
                    <div className="node-stats"><span>{n.backup ? 'Backup' : 'Primary'}</span>
                      <span className={'circuit ' + n.circuit}>{n.circuit}</span>
                      <span>{n.requests} attempts</span><span>{n.active} active</span></div>
                  </div>
                ))}
              </section>
            ))}
            <h2 id="incidents">Incident and recovery history</h2>
            {snapshot.events.length ? (
              snapshot.events.map((e) => (
                <article key={e._id}>
                  <b>
                    {e.severity} · {e.service}
                  </b>
                  <p>{e.message}</p>
                  <small>{new Date(e.at).toLocaleString()}</small>
                </article>
              ))
            ) : (
              <p>No events recorded.</p>
            )}
          </div>
          <GatewayForm
            config={snapshot.config}
            saved={(result) => {
              setSecret(result)
              update((v) => v + 1)
            }}
          />
        </div>
        </>
      ) : (
        <p>Loading workspace…</p>
      )}
    </main>
  )
}
