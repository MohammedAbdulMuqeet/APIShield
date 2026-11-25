import React from 'react'
export default function Incidents({ events }) {
  return (
    <section className="page-content">
      <p>
        Security alerts, failovers and circuit recovery events from your
        gateways.
      </p>
      {events.length ? (
        events.map((e) => (
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
    </section>
  )
}
