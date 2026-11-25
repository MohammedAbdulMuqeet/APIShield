import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from './models/User.js'
import { Workspace } from './models/Workspace.js'
import { Service } from './models/Service.js'
import { Event } from './models/Event.js'
import { Measurement } from './models/Measurement.js'
import { issueKey } from './services/keys.js'
import { auditEntry } from './services/audit.js'

const email = 'demo@apishield.example'
const password = 'APIShield-Demo-2026!'
const fixtures = [
  { name: 'Demo Orders', algorithm: 'round-robin', port: 4101 },
  { name: 'Demo Inventory', algorithm: 'least-connections', port: 4102 },
  { name: 'Shared Checkout', algorithm: 'round-robin', port: 4101, team: 'Store Team' },
  { name: 'Shared Status API', algorithm: 'least-connections', port: 4102, team: 'Operations Team' },
]
const id = (label) => new mongoose.Types.ObjectId(
  createHash('sha256').update('apishield-local-demo:' + label).digest('hex').slice(0, 24),
)
const upsert = (key, values) => ({
  updateOne: { filter: { _id: key }, update: { $set: values }, upsert: true },
})

await mongoose.connect('mongodb://127.0.0.1:27017/apishield', { serverSelectionTimeoutMS: 5000 })
try {
  const owner = id('account')
  const passwordHash = await bcrypt.hash(password, 12)
  await User.updateOne({ _id: owner }, {
    $setOnInsert: { name: 'APIShield Demo', email, password: passwordHash },
  }, { upsert: true })
  const members = []
  for (const role of ['editor', 'viewer']) {
    const user = id('account:' + role)
    const email = role + '@apishield.example'
    await User.updateOne({ _id: user }, {
      $setOnInsert: { name: 'Demo ' + role, email, password: passwordHash },
    }, { upsert: true })
    members.push({ user, email, role })
  }
  for (const name of ['Store Team', 'Operations Team']) {
    const workspaceId = id('workspace:' + name)
    await Workspace.updateOne({ _id: workspaceId, owner }, {
      $setOnInsert: { name, members },
    }, { upsert: true })
    console.log(name + ' /?workspace=' + workspaceId)
  }
  const now = Date.now()
  for (const [index, fixture] of fixtures.entries()) {
    const scope = fixture.team ? id('workspace:' + fixture.team) : owner
    const service = id(fixture.name)
    await Service.updateOne({ _id: service, owner: scope }, {
      $setOnInsert: {
        name: fixture.name, algorithm: fixture.algorithm, limit: 60,
        nodes: [fixture.port, 4103].map((port, i) => ({
          origin: 'http://127.0.0.1:' + port, weight: 1, backup: i === 1,
        })),
        keyHash: issueKey().keyHash,
        audit: fixture.team ? [
          auditEntry(owner, 'Gateway created', fixture.name),
          auditEntry(members[0].user, 'Gateway settings saved', 'Configured the upstream pool'),
        ] : [auditEntry(owner, 'Gateway created', fixture.name)],
      },
    }, { upsert: true })

    const events = [
      { message: 'Circuit opened for http://127.0.0.1:' + fixture.port, severity: 'Warning' },
      { message: 'Traffic switched to backup', severity: 'Info' },
      { message: 'Primary service recovered', severity: 'Info' },
    ]
    await Event.bulkWrite(events.map((event, i) => upsert(id(fixture.name + ':event:' + i), {
      ...event, owner: scope, service: fixture.name, at: new Date(now - (22 - i * 4) * 60000),
    })))
    const measurements = []
    for (let minute = 0; minute < 60; minute++) {
      const volume = 4 + (minute * 7 + index * 5) % 9
      for (let request = 0; request < volume; request++) {
        const degraded = minute >= 16 && minute <= 22
        const errors = Number(degraded && request % 3 === 0)
        measurements.push(upsert(id(fixture.name + ':request:' + minute + ':' + request), {
          service, at: new Date(now - minute * 60000 - request * 250),
          client: 'default', status: 200, attempts: 1 + errors, upstream5xx: errors,
          elapsedMs: 26 + (minute * 17 + request * 19) % 90 + (degraded ? 130 : 0),
        }))
      }
    }
    await Measurement.bulkWrite(measurements)
    console.log(fixture.name + ' /manage/' + service)
  }
  console.log('Demo sign-in:', email)
} finally {
  await mongoose.disconnect()
}
