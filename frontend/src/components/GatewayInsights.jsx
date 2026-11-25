import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

export function AuditHistory({ entries }) {
  return (
    <section className="panel">
      <h2>Configuration history</h2>
      {entries.length === 0 ? (
        <p>No recorded changes yet.</p>
      ) : (
        entries.map((e) => (
          <article key={e._id}>
            <strong>{e.action}</strong>
            <p>
              {e.gateway} · {e.actor} · {new Date(e.at).toLocaleString()}
            </p>
            {e.detail && (
              <small style={{ overflowWrap: 'anywhere' }}>{e.detail}</small>
            )}
          </article>
        ))
      )}
    </section>
  )
}
const series = [
  { label: 'Request volume', value: (r) => r.requests, unit: '' },
  {
    label: 'Upstream 5xx rate',
    value: (r) => (r.attempts ? (100 * r.errors) / r.attempts : null),
    unit: '%',
  },
  { label: 'p95 gateway latency', value: (r) => r.p95, unit: ' ms' },
]
function Trends({ rows, hours, change }) {
  return (
    <section className="panel">
      <h2>Traffic trends</h2>
      <label>
        Time range
        <select value={hours} onChange={(e) => change(e.target.value)}>
          <option value="1">Last hour · per minute</option>
          <option value="24">Last day · hourly</option>
          <option value="168">Last week · hourly</option>
        </select>
      </label>
      {series.map(({ label, value, unit }) => {
        const values = rows.map(value),
          max = Math.max(1, ...values.filter(Number.isFinite))
        return (
          <figure key={label}>
            <figcaption>{label}</figcaption>
            <div className="trend-bars" aria-hidden="true">
              {rows.map((row, i) => (
                <i
                  key={row.at}
                  title={
                    new Date(row.at).toLocaleString() +
                    ' · ' +
                    (values[i] === null
                      ? 'No samples'
                      : values[i].toFixed(1) + unit)
                  }
                  style={{
                    height:
                      values[i] === null
                        ? '0'
                        : Math.max(2, (100 * values[i]) / max) + '%',
                  }}
                />
              ))}
            </div>
          </figure>
        )
      })}
      <details>
        <summary>Measurements by interval</summary>
        <table>
          <thead>
            <tr>
              <th>Interval start</th>
              {series.map((s) => (
                <th key={s.label}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.at}>
                <td>{new Date(r.at).toLocaleString()}</td>
                {series.map((s) => (
                  <td key={s.label}>
                    {s.value(r) === null
                      ? '—'
                      : Number(s.value(r).toFixed(1)) + s.unit}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <small>
        Volume counts completed gateway requests. Errors count upstream HTTP 5xx
        responses across forwarding attempts, including retries. Health probes
        are excluded.
      </small>
    </section>
  )
}
export function GatewayInsights({ endpoint, tab }) {
  const [hours, setHours] = useState('1'),
    [snapshot, setSnapshot] = useState(null),
    [error, setError] = useState('')
  const path =
    endpoint + (tab === 'History' ? '/audit' : '/trends?hours=' + hours)
  useEffect(() => {
    let live = true,
      timer
    async function refresh() {
      try {
        const rows = await api(path)
        if (live) {
          setSnapshot({ path, rows })
          setError('')
        }
      } catch (err) {
        if (live) setError(err.message)
      }
      if (live) timer = setTimeout(refresh, 10000)
    }
    refresh()
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [path])
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {snapshot?.path === path ? (
        tab === 'History' ? (
          <AuditHistory entries={snapshot.rows} />
        ) : (
          <Trends rows={snapshot.rows} hours={hours} change={setHours} />
        )
      ) : (
        <p>Loading measurements…</p>
      )}
    </>
  )
}
