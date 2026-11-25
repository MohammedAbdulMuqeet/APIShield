import React, { useState } from 'react'
import GatewayForm from '../components/GatewayForm.jsx'
import { api } from '../api.js'
import ClientKeys from '../components/ClientKeys.jsx'
import { GatewayInsights } from '../components/GatewayInsights.jsx'

export default function ManageGateway({ service, config, finish }) {
  const [enabled, setEnabled] = useState(service.enabled !== false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const endpoint = 'services/' + service._id
  const [tab, setTab] = useState('Settings')
  async function act(action) {
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
  async function toggle() {
    const result = await api(
      endpoint + '/status',
      { enabled: !enabled },
      'PATCH',
    )
    setEnabled(result.enabled)
  }
  async function rotate() {
    if (
      window.confirm(
        'Replace the API key for ' +
          service.name +
          '? Clients will need the new key.',
      )
    ) {
      finish(await api(endpoint + '/key', {}))
    }
  }
  async function remove() {
    if (
      window.confirm(
        'Permanently delete ' +
          service.name +
          '? Its gateway URL will stop working.',
      )
    ) {
      await api(endpoint, {}, 'DELETE')
      finish()
    }
  }
  return (
    <>
      <section className="panel registration">
        <h2>{service.name}</h2>
        <p role="status">{enabled ? 'Enabled' : 'Paused'}</p>
        <div className="gateway-actions">
          <button disabled={busy} onClick={() => act(toggle)}>
            {enabled ? 'Pause gateway' : 'Resume gateway'}
          </button>
          <button
            disabled={busy}
            className="secondary"
            onClick={() => act(rotate)}
          >
            Rotate default API key
          </button>
          <button
            disabled={busy}
            className="secondary"
            onClick={() => act(remove)}
          >
            Delete gateway
          </button>
        </div>
        <p role="alert">{error}</p>
      </section>
      <nav className="gateway-actions" aria-label="Gateway tools">
        {['Settings', 'Client keys', 'History', 'Trends'].map((name) => (
          <button
            className="secondary"
            aria-pressed={name === tab}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'Settings' ? (
        <GatewayForm service={service} config={config} saved={() => finish()} />
      ) : tab === 'Client keys' ? (
        <ClientKeys service={service} endpoint={endpoint} />
      ) : (
        <GatewayInsights endpoint={endpoint} tab={tab} />
      )}
    </>
  )
}
