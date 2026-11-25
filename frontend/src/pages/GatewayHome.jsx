import React from 'react'
import { workspacePath } from '../api.js'
const circuitLabels = {
  closed: 'Closed (routing allowed)',
  open: 'Open (temporarily skipped)',
  'half-open': 'Half-open (recovery probe)',
}
export default function GatewayHome({ services, secret, dismiss, writable }) {
  return (
    <>
      <dl className="summary">
        <div>
          <dt>Registered gateways</dt>
          <dd>{services.length}</dd>
        </div>
        <div>
          <dt>Upstream assignments</dt>
          <dd>
            {services.reduce(
              (count, service) => count + service.nodes.length,
              0,
            )}
          </dd>
        </div>
        <div>
          <dt>Active requests</dt>
          <dd>
            {services.reduce(
              (count, service) =>
                count +
                service.nodes.reduce((total, node) => total + node.active, 0),
              0,
            )}
          </dd>
        </div>
      </dl>
      <div>
        <div>
          <h2 id="gateways">Your gateways</h2>
          {!services.length && (
            <p>Register a service to start routing traffic.</p>
          )}
          {secret && (
            <section className="panel key-panel">
              <h3>Save your gateway key</h3>
              <p>Shown once. Send it in the X-API-Key header.</p>
              <code>{secret.key}</code>
              <button onClick={() => dismiss()}>Dismiss</button>
            </section>
          )}
          {services.map((s) => (
            <section className="panel service" key={s._id}>
              <h3>{s.name}</h3>
              <p>
                {s.enabled === false ? 'Paused' : 'Enabled'} ·{' '}
                {writable && <a href={workspacePath('/manage/' + s._id)}>Manage gateway</a>}
              </p>
              <code>/gateway/{s._id}/</code>
              <p>
                {s.algorithm} · {s.limit} requests/min
              </p>
              {s.nodes.map((n) => (
                <div className="metric" key={n.origin}>
                  <strong>{n.origin}</strong>
                  <div className="node-stats">
                    <span>{n.backup ? 'Backup' : 'Primary'}</span>
                    <span className={'circuit ' + n.circuit}>
                      {circuitLabels[n.circuit]}
                    </span>
                    <span>{n.requests} attempts</span>
                    <span>{n.active} active</span>
                    {s.healthChecks && <span>Probe: {n.health}{n.checkedAt && ' · '+new Date(n.checkedAt).toLocaleTimeString()}</span>}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
