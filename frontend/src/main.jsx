import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

import Access from './pages/Access.jsx'
import GatewayConsole from './pages/GatewayConsole.jsx'
import { api } from './api.js'
function App() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')
  useEffect(() => {
    api('auth/me')
      .then(setUser)
      .catch((err) =>
        err.status === 401
          ? setUser(null)
          : setError('Unable to reach the backend. Refresh to retry.'),
      )
  }, [])
  function change(next) {
    history.replaceState({}, '', next ? '/' : '/login')
    setUser(next)
  }
  if (user === undefined) return <main>{error || 'Connecting…'}</main>
  return user ? (
    <GatewayConsole user={user} leave={() => change(null)} />
  ) : (
    <Access enter={change} />
  )
}
createRoot(document.getElementById('root')).render(<App />)
