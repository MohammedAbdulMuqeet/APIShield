import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'

test('account lifecycle, workspace isolation and live gateway policies', { timeout: 60000 }, async t => {
  const db = 'apishield_test_' + randomUUID().replaceAll('-', '')
  const uri = 'mongodb://127.0.0.1:27017/' + db
  const connection = await mongoose.createConnection(uri).asPromise()
  t.after(async () => { await connection.dropDatabase(); await connection.close() })
  let unavailable = false
  const origins = []
  for (const name of ['a','b','backup']) {
    const upstream = http.createServer((req, res) => {
      res.statusCode = unavailable && name !== 'backup' ? 503 : 200
      res.end(name + ' ' + req.method + ' ' + req.url)
    })
    upstream.listen(0, '127.0.0.1')
    await once(upstream, 'listening')
    origins.push('http://127.0.0.1:' + upstream.address().port)
    t.after(() => { upstream.closeAllConnections(); upstream.close() })
  }
  const reservation = http.createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const child = spawn(process.execPath, [fileURLToPath(new URL('./server.js', import.meta.url))], {
    env: { ...process.env, PORT: String(port), MONGODB_URI: uri, UPSTREAM_ORIGINS: origins.join(',') }, stdio: ['ignore','pipe','inherit']
  })
  t.after(async () => { if (child.exitCode === null) { const ended = once(child,'exit'); child.kill(); await ended } })
  await once(child.stdout, 'data', { signal: AbortSignal.timeout(10000) })
  const base = 'http://127.0.0.1:' + port
  if (process.env.TEST_BROWSER) {
    const { createServer } = await import('vite')
    const { chromium } = await import('playwright-core')
    const vite = await createServer({
      root: fileURLToPath(new URL('../../frontend/', import.meta.url)), configFile: false,
      server: { port: 0, host: '127.0.0.1', proxy: { '/api': base, '/gateway': base } }
    })
    await vite.listen()
    t.after(() => vite.close())
    const browser = await chromium.launch({ executablePath: process.env.TEST_BROWSER })
    t.after(() => browser.close())
    const page = await browser.newPage()
    await page.goto(vite.resolvedUrls.local[0])
    await page.getByRole('link', {name:'Create an account'}).click()
    await page.getByLabel('Name', {exact:true}).fill('Browser test')
    await page.getByLabel('Email').fill('browser@example.test')
    await page.getByLabel('Password').fill('browser password 123')
    await page.getByRole('button',{name:'Create account'}).click()
    await page.getByLabel('Service name').fill('Browser gateway')
    await page.getByRole('button',{name:'Register gateway'}).click()
    await page.getByRole('heading',{name:'Browser gateway'}).waitFor()
    await page.reload()
    await page.getByRole('heading',{name:'Browser gateway'}).waitFor()
    await page.getByRole('button',{name:'Sign out'}).click()
    await page.getByLabel('Email').fill('browser@example.test')
    await page.getByLabel('Password').fill('browser password 123')
    await page.getByRole('button',{name:'Sign in'}).click()
    await page.getByRole('heading',{name:'Browser gateway'}).waitFor()
  }
  let cookie = ''
  function api(path, body) {
    return fetch(base + '/api/' + path, { method: body ? 'POST' : 'GET', headers: { cookie, 'content-type':'application/json' }, body: body && JSON.stringify(body) })
  }
  const account = { name:'Casey', email:'casey@example.test', password:'test password 123' }
  assert.equal((await api('services')).status,401)
  const signup = await api('auth/signup', account)
  assert.equal(signup.status,201)
  assert.match(signup.headers.get('set-cookie'), /HttpOnly/i)
  cookie = signup.headers.get('set-cookie').split(';')[0]
  assert.equal((await api('auth/me')).status,200)
  assert.equal((await api('auth/signup', account)).status,409)
  assert.equal((await api('auth/logout', {})).status,204)
  assert.equal((await api('auth/me')).status,401)
  assert.equal((await api('auth/login', {...account,password:'wrong'})).status,401)
  const login = await api('auth/login', account)
  assert.equal(login.status,200)
  cookie = login.headers.get('set-cookie').split(';')[0]
  async function register(algorithm, limit, limiter) {
    const res = await api('services', {name:'Demo',algorithm,limit,limiter,nodes:origins.map((origin,i) => ({origin,weight:i===0 ? 2 : 1,backup:i===2}))})
    assert.equal(res.status,201)
    return res.json()
  }
  const weighted = await register('weighted',100)
  function gateway(s, key = s.key, method = 'GET') {
    return fetch(base + '/gateway/' + s.id + '/items?q=one', { method, headers:{'x-api-key':key} })
  }
  for (const expected of ['a','a','b']) assert.equal(await (await gateway(weighted)).text(), expected + ' GET /items?q=one')
  for (let i=0; i<5; i++) assert.equal((await gateway(weighted,'wrong')).status,401)
  unavailable = true
  assert.equal((await gateway(weighted,weighted.key,'POST')).status,503)
  for (let i=0; i<3; i++) assert.equal(await (await gateway(weighted)).text(),'backup GET /items?q=one')
  const services = await (await api('services')).json()
  assert.deepEqual(services[0].nodes.map(n => n.circuit),['open','open','closed'])
  assert.equal(services[0].keyHash,undefined)
  unavailable = false
  for (const policy of ['sliding-window','token-bucket']) {
    const limited = await register('round-robin',2,policy)
    for (const name of ['a','b']) assert.equal(await (await gateway(limited)).text(),name+' GET /items?q=one')
    for(let i=0;i<3;i++) assert.equal((await gateway(limited)).status,429)
  }
  await delay(15100)
  assert.match(await (await gateway(weighted)).text(),/^[ab] GET/)
  const messages = (await (await api('events')).json()).map(event => event.message).join('\n')
  for(const word of ['invalid','rate-limit','backup','opened','recovered']) assert.ok(messages.includes(word))
  const other = await api('auth/signup',{...account,email:'other@example.test'})
  cookie = other.headers.get('set-cookie').split(';')[0]
  assert.deepEqual(await (await api('services')).json(),[])
  assert.deepEqual(await (await api('events')).json(),[])
})
