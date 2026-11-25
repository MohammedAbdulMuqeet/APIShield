import mongoose from 'mongoose'
import { Service } from '../models/Service.js'
import { issueKey } from '../services/keys.js'
import { auditPush } from '../services/audit.js'
import { HttpError } from '../middleware/errors.js'
import { ownerFilter } from './management.js'

export async function listClients(req, res) {
  const service = await Service.findOne(ownerFilter(req)).select('+clientKeys')
  if (!service) throw new HttpError(404, 'Gateway not found.')
  res.json(
    service.clientKeys.map(({ id, name, createdAt }) => ({
      id,
      name,
      createdAt,
    })),
  )
}
export async function createClient(req, res) {
  const name = req.body?.name?.trim?.()
  if (typeof name !== 'string' || !name || name.length > 80)
    throw new HttpError(400, 'Enter a client name of 1–80 characters.')
  const id = new mongoose.Types.ObjectId()
  const { key, keyHash } = issueKey()
  const result = await Service.updateOne(
    {
      ...ownerFilter(req),
      'clientKeys.name': { $ne: name },
      'clientKeys.99': { $exists: false },
    },
    {
      $push: {
        clientKeys: { _id: id, name, hash: keyHash, createdAt: new Date() },
        ...auditPush(req.userId, 'Client key issued', name),
      },
    },
  )
  if (!result.modifiedCount)
    throw new HttpError(
      409,
      'Choose a unique client name. Each gateway supports 100 active client keys.',
    )
  res.status(201).json({ id, name, key: id + '.' + key })
}
export async function revokeClient(req, res) {
  const id = req.params.client
  const filter = ownerFilter(req)
  if (id === 'default') {
    const result = await Service.updateOne(
      { ...filter, defaultKeyRevoked: { $ne: true } },
      {
        $unset: { keyHash: 1 },
        $set: { defaultKeyRevoked: true },
        $push: auditPush(req.userId, 'Default key revoked'),
      },
    )
    if (!result.modifiedCount) throw new HttpError(404, 'Key already revoked.')
  } else {
    if (!mongoose.isObjectIdOrHexString(id))
      throw new HttpError(404, 'Client key not found.')
    const service = await Service.findOne(filter).select('+clientKeys')
    const client = service?.clientKeys.id(id)
    if (!client) throw new HttpError(404, 'Client key not found.')
    const result = await Service.updateOne(
      { ...filter, 'clientKeys._id': id },
      {
        $pull: { clientKeys: { _id: id } },
        $push: auditPush(req.userId, 'Client key revoked', client.name),
      },
    )
    if (!result.modifiedCount)
      throw new HttpError(404, 'Client key already revoked.')
  }
  res.sendStatus(204)
}
