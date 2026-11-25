import React, { useState } from 'react'
import { api } from '../api.js'

export default function Access({ enter }) {
  const signup = location.pathname === '/signup'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      enter(
        await api(
          'auth/' + (signup ? 'signup' : 'login'),
          Object.fromEntries(new FormData(e.target)),
        ),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="access">
      <div className="brand">APIShield</div>
      <section>
        <h1>{signup ? 'Create an account' : 'Welcome back'}</h1>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Name
              <input name="name" maxLength="80" autoComplete="name" required />
            </label>
          )}
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              minLength={signup ? 10 : 1}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {signup && <small>Use at least 10 characters.</small>}
          <button disabled={busy}>
            {signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <a href={signup ? '/login' : '/signup'}>
          {signup ? 'Already registered? Sign in' : 'Create an account'}
        </a>
        <p role="alert">{error}</p>
      </section>
    </main>
  )
}
