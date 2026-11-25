import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'

test(
  'account lifecycle, workspace isolation and live gateway policies',
  { timeout: 60000 },
  async (t) => {
    const db = 'apishield_test_' + randomUUID().replaceAll('-', '')
    const uri = 'mongodb://127.0.0.1:27017/' + db
    const connection = await mongoose.createConnection(uri).asPromise()
    t.after(async () => {
      await connection.dropDatabase()
      await connection.close()
    })
    let unavailable = false
    const origins = []
    for (const name of ['a', 'b', 'backup']) {
      const upstream = http.createServer((req, res) => {
        res.statusCode = unavailable && name !== 'backup' ? 503 : 200
        res.end(name + ' ' + req.method + ' ' + req.url)
      })
      upstream.listen(0, '127.0.0.1')
      await once(upstream, 'listening')
      origins.push('http://127.0.0.1:' + upstream.address().port)
      t.after(() => {
        upstream.closeAllConnections()
        upstream.close()
      })
    }
    const reservation = http.createServer().listen(0, '127.0.0.1')
    await once(reservation, 'listening')
    const port = reservation.address().port
    await new Promise((resolve) => reservation.close(resolve))
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../src/server.js', import.meta.url))],
      {
        env: {
          ...process.env,
          PORT: String(port),
          MONGODB_URI: uri,
          UPSTREAM_ORIGINS: origins.join(','),
          HEALTH_CHECK_INTERVAL_MS: '1000',
        },
        stdio: ['ignore', 'pipe', 'inherit'],
      },
    )
    t.after(async () => {
      if (child.exitCode === null) {
        const ended = once(child, 'exit')
        child.kill()
        await ended
      }
    })
    await once(child.stdout, 'data', { signal: AbortSignal.timeout(10000) })
    const base = 'http://127.0.0.1:' + port
    if (process.env.TEST_BROWSER) {
      const { createServer } = await import('vite')
      const { chromium } = await import('playwright-core')
      const vite = await createServer({
        root: fileURLToPath(new URL('../../frontend/', import.meta.url)),
        configFile: false,
        server: {
          port: 0,
          host: '127.0.0.1',
          proxy: { '/api': base, '/gateway': base },
        },
      })
      await vite.listen()
      t.after(() => vite.close())
      const browser = await chromium.launch({
        executablePath: process.env.TEST_BROWSER,
      })
      t.after(() => browser.close())
      const page = await browser.newPage()
      await page.goto(vite.resolvedUrls.local[0])
      await page.getByRole('link', { name: 'Create an account' }).click()
      await page.getByLabel('Name', { exact: true }).fill('Browser test')
      await page.getByLabel('Email').fill('browser@example.test')
      await page.getByLabel('Password').fill('browser password 123')
      await page.getByRole('button', { name: 'Create account' }).click()
      await page.getByRole('link', { name: 'Register gateway' }).click()
      await page.getByLabel('Service name').fill('Browser gateway')
      await page.getByRole('button', { name: 'Add upstream node' }).click()
      await page.getByLabel('Server origin').last().fill(origins[1])
      await page.getByLabel('Load balancing').selectOption('power-of-two')
      await page.getByRole('button', { name: 'Register gateway' }).click()
      await page.getByRole('heading', { name: 'Browser gateway' }).waitFor()
      assert.equal(await page.getByLabel('Service name').count(), 0)
      await page.getByRole('link', { name: 'Incidents' }).click()
      await page.getByText('No events recorded.').waitFor()
      await page.goBack()
      await page.reload()
      await page.getByRole('heading', { name: 'Browser gateway' }).waitFor()
      await page.getByRole('button', { name: 'Sign out' }).click()
      await page.getByLabel('Email').fill('browser@example.test')
      await page.getByLabel('Password').fill('browser password 123')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await page.getByRole('heading', { name: 'Browser gateway' }).waitFor()
      await page.getByRole('link', { name: 'Manage gateway' }).click()
      await page
        .getByRole('button', { name: 'Client keys', exact: true })
        .click()
      await page.getByLabel('Client name').fill('Browser consumer')
      await page.getByRole('button', { name: 'Issue client key' }).click()
      await page
        .getByRole('heading', { name: 'Save the key for Browser consumer' })
        .waitFor()
      await page.getByRole('button', { name: 'History', exact: true }).click()
      await page.getByText('Client key issued', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Trends', exact: true }).click()
      await page.getByLabel('Time range').selectOption('24')
      await page.getByRole('heading', { name: 'Traffic trends' }).waitFor()
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      assert.equal(
        await page.getByLabel('Service name').inputValue(),
        'Browser gateway',
      )
      await page.getByRole('button', { name: 'Pause gateway' }).click()
      await page.getByRole('button', { name: 'Resume gateway' }).click()
      await page.getByLabel('Service name').fill('Updated browser gateway')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await page
        .getByRole('heading', { name: 'Updated browser gateway' })
        .waitFor()
    }
    let cookie = ''
    let scope = {}
    function api(path, body, method = body ? 'POST' : 'GET') {
      return fetch(base + '/api/' + path, {
        method,
        headers: { ...scope, cookie, 'content-type': 'application/json' },
        body: body && JSON.stringify(body),
      })
    }
    const account = {
      name: 'Casey',
      email: 'casey@example.test',
      password: 'test password 123',
    }
    assert.equal((await api('services')).status, 401)
    const signup = await api('auth/signup', account)
    assert.equal(signup.status, 201)
    assert.match(signup.headers.get('set-cookie'), /HttpOnly/i)
    cookie = signup.headers.get('set-cookie').split(';')[0]
    assert.equal((await api('auth/me')).status, 200)
    assert.equal((await api('auth/signup', account)).status, 409)
    assert.equal((await api('auth/logout', {})).status, 204)
    assert.equal((await api('auth/me')).status, 401)
    assert.equal(
      (await api('auth/login', { ...account, password: 'wrong' })).status,
      401,
    )
    const login = await api('auth/login', account)
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]
    async function register(algorithm, limit, limiter) {
      const res = await api('services', {
        name: 'Demo',
        algorithm,
        limit,
        limiter,
        nodes: origins.map((origin, i) => ({
          origin,
          weight: i === 0 ? 2 : 1,
          backup: i === 2,
        })),
      })
      assert.equal(res.status, 201)
      return res.json()
    }
    const weighted = await register('weighted', 100)
    function gateway(s, key = s.key, method = 'GET') {
      return fetch(base + '/gateway/' + s.id + '/items?q=one', {
        method,
        headers: { 'x-api-key': key },
      })
    }
    for (const expected of ['a', 'a', 'b'])
      assert.equal(
        await (await gateway(weighted)).text(),
        expected + ' GET /items?q=one',
      )
    for (let i = 0; i < 5; i++)
      assert.equal((await gateway(weighted, 'wrong')).status, 401)
    unavailable = true
    assert.equal((await gateway(weighted, weighted.key, 'POST')).status, 503)
    for (let i = 0; i < 3; i++)
      assert.equal(
        await (await gateway(weighted)).text(),
        'backup GET /items?q=one',
      )
    const services = await (await api('services')).json()
    assert.deepEqual(
      services[0].nodes.map((n) => n.circuit),
      ['open', 'open', 'closed'],
    )
    assert.equal(services[0].keyHash, undefined)
    unavailable = false
    for (const algorithm of ['random', 'power-of-two']) {
      const service = await register(algorithm, 100)
      assert.match(await (await gateway(service)).text(), /^[ab] GET/)
    }
    const custom = {
      name: 'Custom',
      algorithm: 'random',
      limit: 60,
      nodes: [
        { origin: 'https://orders.example.test', weight: 1, backup: false },
      ],
    }
    assert.equal((await api('services', custom)).status, 400)
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('../src/approve-upstream.js', import.meta.url)),
        account.email,
        custom.nodes[0].origin,
      ],
      { env: { ...process.env, MONGODB_URI: uri } },
    )
    assert.equal((await api('services', custom)).status, 201)
    for (const policy of ['sliding-window', 'token-bucket']) {
      const limited = await register('round-robin', 2, policy)
      for (const name of ['a', 'b'])
        assert.equal(
          await (await gateway(limited)).text(),
          name + ' GET /items?q=one',
        )
      for (let i = 0; i < 3; i++)
        assert.equal((await gateway(limited)).status, 429)
    }
    await delay(15100)
    assert.match(await (await gateway(weighted)).text(), /^[ab] GET/)
    const messages = (await (await api('events')).json())
      .map((event) => event.message)
      .join('\n')
    for (const word of [
      'invalid',
      'rate-limit',
      'backup',
      'opened',
      'recovered',
    ])
      assert.ok(messages.includes(word))
    const endpoint = 'services/' + weighted.id
    const original = await (await api(endpoint)).json()
    const edit = {
      ...original,
      version: original.__v,
      nodes: [{ origin: origins[1], weight: 1, backup: false }],
    }
    assert.equal((await api(endpoint, edit, 'PUT')).status, 204)
    assert.equal((await api(endpoint, edit, 'PUT')).status, 409)
    assert.match(await (await gateway(weighted)).text(), /^b GET/)
    assert.equal(
      (await api(endpoint + '/status', { enabled: false }, 'PATCH')).status,
      200,
    )
    assert.equal((await gateway(weighted)).status, 503)
    await api(endpoint + '/status', { enabled: true }, 'PATCH')
    const renewed = await (await api(endpoint + '/key', {})).json()
    assert.equal((await gateway(weighted)).status, 401)
    assert.equal((await gateway(renewed)).status, 200)
    const clients = endpoint + '/clients'
    const firstClient = await (await api(clients, { name: 'Mobile' })).json()
    const secondClient = await (await api(clients, { name: 'Web' })).json()
    const requestAs = (key) => gateway(weighted, key)
    assert.equal((await requestAs(firstClient.key)).status, 200)
    assert.equal(
      (await api(clients + '/' + firstClient.id, {}, 'DELETE')).status,
      204,
    )
    assert.equal((await requestAs(firstClient.key)).status, 401)
    assert.equal((await requestAs(secondClient.key)).status, 200)
    const history = await (await api(endpoint + '/audit')).json()
    for (const action of [
      'Gateway settings saved',
      'Gateway paused',
      'Default key rotated',
      'Client key revoked',
    ]) {
      assert.ok(
        history.some(
          (entry) =>
            entry.action === action &&
            entry.actor === account.email &&
            entry.at,
        ),
      )
    }
    assert.ok(!JSON.stringify(history).includes(firstClient.key))
    const latest = await (await api(endpoint)).json()
    assert.equal(
      (
        await api(
          endpoint,
          {
            ...latest,
            version: latest.__v,
            healthChecks: true,
            healthPath: '/health',
          },
          'PUT',
        )
      ).status,
      204,
    )
    async function waitForHealth(expected) {
      for (let attempt = 0; attempt < 35; attempt++) {
        const rows = await (await api('services')).json()
        const node = rows.find((row) => row._id === weighted.id).nodes[0]
        if (node.health === expected && node.checkedAt) return
        await delay(150)
      }
      assert.fail('Expected idle upstream health ' + expected)
    }
    await waitForHealth('Healthy')
    unavailable = true
    await waitForHealth('Unhealthy')
    unavailable = false
    await waitForHealth('Healthy')
    const trends = await (await api(endpoint + '/trends?hours=1')).json()
    assert.equal(trends.length, 60)
    assert.ok(trends.some((bucket) => bucket.requests > 0 && bucket.errors > 0))
    assert.ok(trends.some((bucket) => bucket.p95 > 0))
    const ownerCookie = cookie
    const other = await api('auth/signup', {
      ...account,
      email: 'other@example.test',
    })
    cookie = other.headers.get('set-cookie').split(';')[0]
    assert.equal((await api('services', custom)).status, 400)
    assert.deepEqual(await (await api('services')).json(), [])
    assert.deepEqual(await (await api('events')).json(), [])
    assert.equal((await api(endpoint)).status, 404)
    assert.equal((await api(endpoint, edit, 'PUT')).status, 404)
    assert.equal((await api(endpoint + '/key', {})).status, 404)
    assert.equal(
      (await api(endpoint + '/status', { enabled: false }, 'PATCH')).status,
      404,
    )
    assert.equal((await api(endpoint, {}, 'DELETE')).status, 404)
    const memberCookie = cookie
    cookie = ownerCookie
    const team = await (await api('workspaces', { name: 'Operations' })).json()
    scope = { 'X-Workspace-Id': team.id }
    assert.deepEqual(await (await api('services')).json(), [])
    assert.deepEqual(await (await api('events')).json(), [])
    const shared = await register('random', 100)
    const invite = await (
      await api('workspaces/' + team.id + '/invitations', {
        email: 'other@example.test',
        role: 'viewer',
      })
    ).json()
    assert.equal((await api('workspaces/join', invite)).status, 404)
    cookie = memberCookie
    assert.equal((await api('services')).status, 403)
    assert.equal((await api('workspaces/join', invite)).status, 200)
    assert.equal((await api('workspaces/join', invite)).status, 404)
    assert.equal((await api('services/' + shared.id)).status, 200)
    const sharedHistory = await (await api('audit')).json()
    assert.equal(sharedHistory.length, 1)
    assert.equal(sharedHistory[0].action, 'Gateway created')
    assert.equal((await api(endpoint + '/audit')).status, 404)
    assert.equal((await api(endpoint)).status, 404)
    assert.equal((await api('services/' + shared.id + '/key', {})).status, 403)
    assert.equal(
      (await api('workspaces/' + team.id + '/invitations', {})).status,
      403,
    )
    cookie = ownerCookie
    const [workspace] = await (await api('workspaces')).json()
    const memberPath =
      'workspaces/' + team.id + '/members/' + workspace.members[0].id
    assert.equal(
      (await api(memberPath, { role: 'editor' }, 'PATCH')).status,
      204,
    )
    cookie = memberCookie
    assert.equal((await api('services/' + shared.id + '/key', {})).status, 200)
    cookie = ownerCookie
    assert.equal((await api(memberPath, {}, 'DELETE')).status, 204)
    cookie = memberCookie
    assert.equal((await api('services')).status, 403)
    cookie = ownerCookie
    scope = {}
    assert.equal((await api(endpoint, {}, 'DELETE')).status, 204)
    assert.equal((await gateway(renewed)).status, 404)
  },
)
