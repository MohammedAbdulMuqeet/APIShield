import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import GatewayForm from '../components/GatewayForm.jsx'
import { Brand, GatewayGraphic } from '../components/Identity.jsx'

import GatewayHome from './GatewayHome.jsx'
import Incidents from './Incidents.jsx'
const pages = {
  '/': { title: 'Gateway console', label: 'Home', resource: 'services' },
  '/register': {
    title: 'Register a gateway',
    label: 'Register gateway',
    resource: 'config',
  },
  '/incidents': {
    title: 'Incident history',
    label: 'Incidents',
    resource: 'events',
  },
}
export default function GatewayConsole({ user, leave }) {
  const [snapshot, setSnapshot] = useState(null)
  const [secret, setSecret] = useState(null)
  const [error, setError] = useState('')
  const [path, setPath] = useState(location.pathname)
  const page = pages[path] || pages['/']
  useEffect(() => {
    const sync = () => setPath(location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  function navigate(destination) {
    history.pushState({}, '', destination)
    setPath(destination)
  }
  useEffect(() => {
    let active = true,
      timer
    async function refresh() {
      try {
        const data = await api(page.resource)
        if (active) {
          setSnapshot({ path, data })
          setError('')
        }
      } catch (err) {
        if (active) {
          if (err.status === 401) leave()
          else setError(err.message)
        }
      }
      if (active && path !== '/register') timer = setTimeout(refresh, 4000)
    }
    refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [path])
  return (
    <main>
      <header className="topbar">
        <Brand />
        <nav aria-label="Workspace">
          {Object.entries(pages).map(([url, item]) => (
            <a
              key={url}
              href={url}
              aria-current={url === path ? 'page' : undefined}
              onClick={(event) => {
                if (
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault()
                  if (path !== url) navigate(url)
                }
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
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
      <div className="hero">
        <h1>{page.title}</h1>
        <GatewayGraphic />
      </div>
      <p role="alert">{error}</p>
      {snapshot?.path !== path ? (
        <p>Loading workspace…</p>
      ) : path === '/register' ? (
        <GatewayForm
          config={snapshot.data}
          saved={(result) => {
            setSecret(result)
            navigate('/')
          }}
        />
      ) : path === '/incidents' ? (
        <Incidents events={snapshot.data} />
      ) : (
        <GatewayHome
          services={snapshot.data}
          secret={secret}
          dismiss={() => setSecret(null)}
        />
      )}
    </main>
  )
}
