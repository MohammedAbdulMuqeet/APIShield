import React, { useState } from 'react'
import GatewayForm from '../components/GatewayForm.jsx'
import { api } from '../api.js'
import ClientKeys from '../components/ClientKeys.jsx'
import { GatewayInsights } from '../components/GatewayInsights.jsx'

export default function ManageGateway({ service, config, finish }) {
  const [status, setStatus] = useState(service)
  const [showMaintenance, setShowMaintenance] = useState(false)
  const enabled = status.enabled !== false
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
  async function changeStatus(settings) {
    setStatus(await api(endpoint + '/status', settings, 'PATCH'))
    setShowMaintenance(false)
  }
  function saveMaintenance(event) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const time = fields.get('expectedRecoveryAt')
    act(() =>
      changeStatus({
        enabled: false,
        maintenanceMessage: fields.get('maintenanceMessage'),
        expectedRecoveryAt: time ? new Date(time).toISOString() : null,
      }),
    )
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
        <p role="status">{enabled ? 'Enabled' : 'In maintenance'}</p>
        {!enabled && (
          <>
            <p>{status.maintenanceMessage || 'Gateway paused.'}</p>
            {status.expectedRecoveryAt && (
              <p>
                Expected recovery{' '}
                {new Date(status.expectedRecoveryAt).toLocaleString()}
              </p>
            )}
          </>
        )}
        <div className="gateway-actions">
          <button
            disabled={busy}
            onClick={() => setShowMaintenance((open) => !open)}
            aria-expanded={showMaintenance}
          >
            {enabled ? 'Configure maintenance' : 'Edit maintenance'}
          </button>
          {!enabled && (
            <button
              disabled={busy}
              className="secondary"
              onClick={() => act(() => changeStatus({ enabled: true }))}
            >
              Resume gateway
            </button>
          )}
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
        {showMaintenance && (
          <form className="maintenance-form" onSubmit={saveMaintenance}>
            <label>
              Maintenance message
              <input
                name="maintenanceMessage"
                maxLength={500}
                defaultValue={status.maintenanceMessage}
                placeholder="Gateway paused."
              />
            </label>
            <label>
              Expected recovery (local time)
              <input
                type="datetime-local"
                name="expectedRecoveryAt"
                defaultValue={localDateTime(status.expectedRecoveryAt)}
              />
            </label>
            <small>
              Optional. Resume the gateway manually when maintenance is
              complete.
            </small>
            <button disabled={busy}>
              {enabled ? 'Pause gateway' : 'Save maintenance details'}
            </button>
          </form>
        )}
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

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
