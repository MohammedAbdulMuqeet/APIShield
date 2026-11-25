import { algorithms, allowed } from '../config/gateway.js'
import { Service } from '../models/Service.js'
import { Event } from '../models/Event.js'
import { state, circuit, forgetRuntime } from '../services/routing.js'
import { registerService, validateSettings } from '../services/registration.js'
import { HttpError } from '../middleware/errors.js'
import { issueKey } from '../services/keys.js'
export const config = (_req, res) =>
  res.json({
    origins: allowed,
    algorithms,
    localDemoPorts: !process.env.UPSTREAM_ORIGINS,
  })
export async function listServices(req, res) {
  const services = await Service.find({ owner: req.userId })
  res.json(
    services.map((service) => ({
      ...service.toObject(),
      nodes: state(service).nodes.map((node) => ({
        origin: node.origin,
        backup: node.backup,
        weight: node.weight,
        requests: node.requests,
        active: node.active,
        circuit: circuit(node),
      })),
    })),
  )
}
export async function listEvents(req, res) {
  res.json(await Event.find({ owner: req.userId }).sort({ at: -1 }).limit(50))
}
export async function createService(req, res) {
  res.status(201).json(await registerService(req.userId, req.body || {}))
}

export async function loadOwnedService(req, res, next) {
  const id = req.params.id
  const service =
    /^[a-f\d]{24}$/i.test(id) &&
    (await Service.findOne({ _id: id, owner: req.userId }))
  if (!service) throw new HttpError(404, 'Gateway not found.')
  req.service = service
  next()
}
export function getService(req, res) {
  res.json(req.service)
}
function ownerFilter(req) {
  return { _id: req.service._id, owner: req.userId }
}
export async function editService(req, res) {
  const settings = await validateSettings(req.userId, req.body || {})
  if (!Number.isInteger(req.body.version))
    throw new HttpError(400, 'Gateway version required.')
  const result = await Service.updateOne(
    { ...ownerFilter(req), __v: req.body.version },
    {
      $set: settings,
      $inc: { __v: 1 },
    },
  )
  if (!result.matchedCount)
    throw new HttpError(409, 'Gateway changed. Reload before saving.')
  res.sendStatus(204)
}
export async function setEnabled(req, res) {
  if (typeof req.body?.enabled !== 'boolean')
    throw new HttpError(400, 'Choose enabled or paused.')
  const result = await Service.updateOne(ownerFilter(req), {
    $set: { enabled: req.body.enabled },
  })
  if (!result.matchedCount) throw new HttpError(404, 'Gateway not found.')
  res.json({ enabled: req.body.enabled })
}
export async function rotateKey(req, res) {
  const { key, keyHash } = issueKey()
  const result = await Service.updateOne(ownerFilter(req), {
    $set: { keyHash },
  })
  if (!result.matchedCount) throw new HttpError(404, 'Gateway not found.')
  res.json({ id: req.service.id, key })
}
export async function deleteService(req, res) {
  await Service.deleteOne(ownerFilter(req))
  forgetRuntime(req.service.id)
  res.sendStatus(204)
}
