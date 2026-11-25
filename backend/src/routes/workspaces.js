import { Router } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { Workspace } from '../models/Workspace.js'
import { User } from '../models/User.js'
import { HttpError } from '../middleware/errors.js'

export const workspaces = Router()
const hash = token => createHash('sha256').update(token).digest('hex')
const validId = id => /^[a-f\d]{24}$/i.test(id)
const validRole = role => ['editor', 'viewer'].includes(role)

workspaces.get('/', async (req, res) => {
  const rows = await Workspace.find({ $or: [{ owner: req.userId }, { 'members.user': req.userId }] })
  res.json(rows.map(row => {
    const owner = String(row.owner) === req.userId
    return {
      id: row.id, name: row.name,
      role: owner ? 'owner' : row.members.find(m => String(m.user) === req.userId).role,
      members: owner ? row.members.map(m => ({
        id: m.id, email: m.email, role: m.role,
        status: m.user ? 'Active' : m.expires > new Date() ? 'Invited' : 'Expired',
      })) : undefined,
    }
  }))
})

workspaces.post('/', async (req, res) => {
  const name = req.body?.name
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80)
    throw new HttpError(400, 'Enter a workspace name of up to 80 characters.')
  const row = await Workspace.create({ name: name.trim(), owner: req.userId })
  res.status(201).json({ id: row.id })
})

workspaces.post('/join', async (req, res) => {
  const token = req.body?.token
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(400, 'Enter the invitation code.')
  const { email } = await User.findById(req.userId).select('email')
  const row = await Workspace.findOneAndUpdate({
    members: { $elemMatch: { email, digest: hash(token), expires: { $gt: new Date() }, user: null } },
  }, { $set: { 'members.$.user': req.userId }, $unset: { 'members.$.digest': '', 'members.$.expires': '' } })
  if (!row) throw new HttpError(404, 'Invitation invalid, expired, or issued to another email.')
  res.json({ id: row.id })
})

workspaces.use('/:id', async (req, res, next) => {
  if (!validId(req.params.id) || !await Workspace.exists({ _id: req.params.id, owner: req.userId }))
    throw new HttpError(403, 'Workspace owner access required.')
  next()
})

workspaces.post('/:id/invitations', async (req, res) => {
  const email = typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase()
  const role = req.body?.role
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) || !validRole(role))
    throw new HttpError(400, 'Choose an email and member role.')
  if (await User.exists({ _id: req.userId, email })) throw new HttpError(409, 'Already the owner.')
  const token = randomBytes(32).toString('hex')
  const result = await Workspace.updateOne({ _id: req.params.id, owner: req.userId, 'members.email': { $ne: email } }, {
    $push: { members: { email, role, digest: hash(token), expires: new Date(Date.now() + 7 * 86400000) } },
  })
  if (!result.modifiedCount) throw new HttpError(409, 'Already a member or invited. Remove the existing entry to invite again.')
  res.status(201).json({ token })
})

workspaces.patch('/:id/members/:member', async (req, res) => {
  if (!validRole(req.body?.role)) throw new HttpError(400, 'Choose a member role.')
  const result = validId(req.params.member) && await Workspace.updateOne(
    { _id: req.params.id, owner: req.userId, 'members._id': req.params.member },
    { $set: { 'members.$.role': req.body.role } })
  if (!result.matchedCount) throw new HttpError(404, 'Member not found.')
  res.sendStatus(204)
})

workspaces.delete('/:id/members/:member', async (req, res) => {
  const result = validId(req.params.member) && await Workspace.updateOne(
    { _id: req.params.id, owner: req.userId }, { $pull: { members: { _id: req.params.member } } })
  if (!result.modifiedCount) throw new HttpError(404, 'Member not found.')
  res.sendStatus(204)
})

export async function scopeWorkspace(req, res, next) {
  const id = req.get('X-Workspace-Id')
  req.scopeId = req.userId
  if (id !== undefined) {
    const row = validId(id) && await Workspace.findById(id)
    const role = row && (String(row.owner) === req.userId ? 'owner' : row.members.find(m => String(m.user) === req.userId)?.role)
    if (!role) throw new HttpError(403, 'Workspace access required.')
    if (role === 'viewer' && !['GET', 'HEAD'].includes(req.method))
      throw new HttpError(403, 'Editor access required.')
    req.scopeId = row._id
  }
  next()
}
