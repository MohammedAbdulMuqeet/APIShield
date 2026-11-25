import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
export default function ClientKeys({ endpoint, service }) {
  const [clients, setClients] = useState(null),
    [secret, setSecret] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [defaultActive, setDefaultActive] = useState(!service.defaultKeyRevoked)
  useEffect(() => {
    let live = true
    api(endpoint + '/clients')
      .then((data) => {
        if (live) setClients(data)
      })
      .catch((err) => {
        if (live) setError(err.message)
      })
    return () => {
      live = false
    }
  }, [endpoint])
  async function perform(action) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  function create(e) {
    e.preventDefault()
    const form = e.currentTarget,
      name = new FormData(form).get('client')
    perform(async () => {
      const result = await api(endpoint + '/clients', { name })
      setSecret(result)
      setClients((current) => [
        ...current,
        { id: result.id, name: result.name },
      ])
      form.reset()
    })
  }
  function revoke(id, name) {
    if (!window.confirm('Revoke the key for ' + name + '?')) return
    perform(async () => {
      await api(endpoint + '/clients/' + id, {}, 'DELETE')
      if (id === 'default') setDefaultActive(false)
      else setClients((current) => current.filter((c) => c.id !== id))
      if (secret?.id === id) setSecret(null)
    })
  }
  return (
    <section className="panel registration">
      <h2>Client API keys</h2>
      <form onSubmit={create}>
        <label>
          Client name
          <input name="client" required maxLength="80" />
        </label>
        <button disabled={busy || !clients}>Issue client key</button>
      </form>
      {secret && (
        <section>
          <h3>Save the key for {secret.name}</h3>
          <p>Shown once. Send it in the X-API-Key header.</p>
          <code>{secret.key}</code>
          <button onClick={() => setSecret(null)}>Dismiss</button>
        </section>
      )}
      {defaultActive && (
        <article>
          <strong>Default gateway key</strong>{' '}
          <button
            disabled={busy}
            onClick={() => revoke('default', 'the default gateway client')}
          >
            Revoke default key
          </button>
        </article>
      )}
      {clients?.map((c) => (
        <article key={c.id}>
          <strong>{c.name}</strong>{' '}
          <button disabled={busy} onClick={() => revoke(c.id, c.name)}>
            Revoke {c.name}
          </button>
        </article>
      ))}
      <p role="alert">{error}</p>
    </section>
  )
}
