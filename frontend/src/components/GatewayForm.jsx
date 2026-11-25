import React, { useState } from 'react'
import { api } from '../api.js'

export default function GatewayForm({ config, saved }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nodes = config.origins.flatMap((origin, i) =>
      data.get('role' + i) === 'off'
        ? []
        : [
            {
              origin,
              backup: data.get('role' + i) === 'backup',
              weight: Number(data.get('weight' + i)),
            },
          ],
    )
    setBusy(true)
    setError('')
    try {
      saved(
        await api('services', {
          name: data.get('name'),
          algorithm: data.get('algorithm'),
          limit: Number(data.get('limit')),
          limiter: data.get('limiter'),
          nodes,
        }),
      )
      form.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section id="registration" className="panel registration">
      <h2>Register a gateway</h2>
      <form onSubmit={submit}>
        <label>
          Service name
          <input name="name" maxLength="80" required />
        </label>
        <label>
          Load balancing
          <select name="algorithm">
            {config.algorithms.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Rate policy
          <select name="limiter">
            <option value="sliding-window">Sliding window</option>
            <option value="token-bucket">Token bucket</option>
          </select>
        </label>
        <label>
          Requests per minute
          <input
            type="number"
            min="1"
            max="1000"
            defaultValue="60"
            name="limit"
            required
          />
        </label>
        <fieldset>
          <legend>Upstream nodes</legend>
          {config.origins.map((o, i) => (
            <div key={o} className="node">
              <strong>{o}</strong>
              <label>
                Role
                <select
                  name={'role' + i}
                  defaultValue={i === 0 ? 'primary' : 'off'}
                >
                  <option value="primary">Primary</option>
                  <option value="backup">Backup</option>
                  <option value="off">Unused</option>
                </select>
              </label>
              <label>
                Weight
                <input
                  name={'weight' + i}
                  type="number"
                  defaultValue="1"
                  min="1"
                  max="10"
                  required
                />
              </label>
            </div>
          ))}
        </fieldset>
        <button disabled={busy}>Register gateway</button>
        <span role="alert">{error}</span>
      </form>
    </section>
  )
}
