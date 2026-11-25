import React, { useState } from 'react'
import { api } from '../api.js'

export default function GatewayForm({ config, saved }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState(() =>
    config.origins.map((origin, index) => ({
      id: index,
      origin,
      role: index === 0 ? 'primary' : 'off',
    })),
  )
  const nextId = React.useRef(config.origins.length)
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const nodes = rows.flatMap(({ id: i }) =>
      data.get('role' + i) === 'off'
        ? []
        : [
            {
              origin: String(data.get('origin' + i)).trim(),
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
      <h2>Gateway settings</h2>
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
        <small>
          Sliding window counts requests over the last 60 seconds. Token bucket
          replenishes capacity gradually and allows short bursts.
        </small>
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
          <p>
            {config.localDemoPorts
              ? 'Enter a local demo server on ports 4100–4199, or a trusted origin approved for your account.'
              : 'Enter a configured server or a trusted origin approved for your account.'}
          </p>
          {rows.map(({ origin, id: i, role }) => (
            <div key={i} className="node">
              <label className="origin-field">
                Server origin
                <input
                  type="url"
                  name={'origin' + i}
                  defaultValue={origin}
                  placeholder="http://127.0.0.1:4110"
                />
              </label>
              <label>
                Role
                <select name={'role' + i} defaultValue={role}>
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
              <button
                className="secondary"
                type="button"
                onClick={() => setRows(rows.filter((row) => row.id !== i))}
              >
                Remove node
              </button>
            </div>
          ))}
          <button
            className="secondary"
            type="button"
            onClick={() =>
              setRows([
                ...rows,
                { id: nextId.current++, origin: '', role: 'primary' },
              ])
            }
          >
            Add upstream node
          </button>
        </fieldset>
        <details>
          <summary>Use another server or port</summary>
          <p>
            On the APIShield host, approve your server for your account once.
            Then enter its origin above.
          </p>
          <code>
            npm run approve-upstream -- YOUR_EMAIL https://api.example.com
          </code>
        </details>
        <button disabled={busy}>Register gateway</button>
        <span role="alert">{error}</span>
      </form>
    </section>
  )
}
