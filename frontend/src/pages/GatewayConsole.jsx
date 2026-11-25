import React, { useEffect, useState } from 'react'
import Workspaces, { selectWorkspace } from '../components/Workspaces.jsx'
import { api, workspaceId, workspacePath } from '../api.js'
import GatewayForm from '../components/GatewayForm.jsx'
import { Brand, GatewayGraphic } from '../components/Identity.jsx'

import GatewayHome from './GatewayHome.jsx'
import Incidents from './Incidents.jsx'
import ManageGateway from './ManageGateway.jsx'
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
  const [spaces, setSpaces] = useState([])
  const reloadSpaces = () => api('workspaces').then(setSpaces)
  useEffect(() => { reloadSpaces().catch(err => setError(err.message)) }, [])
  const current = spaces.find(space => space.id === workspaceId)
  const writable = !workspaceId || ['owner', 'editor'].includes(current?.role)
  const [snapshot, setSnapshot] = useState(null)
  const [secret, setSecret] = useState(null)
  const [error, setError] = useState('')
  const [path, setPath] = useState(location.pathname)
  const manageId = path.match(/^\/manage\/([a-f\d]{24})\/?$/i)?.[1]
  const page = manageId
    ? { title: 'Manage gateway' }
    : pages[path] || pages['/']
  useEffect(() => {
    const sync = () => setPath(location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  function navigate(destination) {
    history.pushState({}, '', workspacePath(destination))
    setPath(destination)
  }
  useEffect(() => {
    let active = true,
      timer
    async function refresh() {
      try {
        const data = manageId
          ? await Promise.all([api('services/' + manageId), api('config')])
          : await api(page.resource)
        if (active) {
          setSnapshot({ path, data })
          setError('')
        }
      } catch (err) {
        if (active) {
          if (err.status === 401) leave()
          else { setSnapshot(null); setError(err.message) }
        }
      }
      if (active && !manageId && path !== '/register')
        timer = setTimeout(refresh, 4000)
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
          {Object.entries(pages).filter(([url]) => writable || url !== '/register').map(([url, item]) => (
            <a
              key={url}
              href={workspacePath(url)}
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
        <details className="workspace-menu">
          <summary className="secondary">Workspace</summary>
          <div className="workspace-menu-content">
            <label>
              Switch workspace
              <select value={workspaceId || ''} onChange={event => selectWorkspace(event.target.value)}>
                <option value="">Personal workspace</option>
                {workspaceId && !current && <option value={workspaceId}>Selected workspace</option>}
                {spaces.map(space => <option key={space.id} value={space.id}>{space.name} ({space.role})</option>)}
              </select>
            </label>
            <Workspaces current={current} reload={reloadSpaces} />
          </div>
        </details>
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
      {!writable && (manageId || path === '/register') ? <p>Editor access required.</p> : snapshot?.path !== path ? (
        !error && <p>Loading workspace…</p>
      ) : manageId ? (
        <ManageGateway
          service={snapshot.data[0]}
          config={snapshot.data[1]}
          finish={(result) => {
            setSecret(result || null)
            navigate('/')
          }}
        />
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
          writable={writable} services={snapshot.data}
          secret={secret}
          dismiss={() => setSecret(null)}
        />
      )}
    </main>
  )
}
