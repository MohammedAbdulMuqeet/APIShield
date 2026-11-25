import { algorithms, allowed } from '../config/gateway.js'
import { Service } from '../models/Service.js'
import { Event } from '../models/Event.js'
import { state, circuit } from '../services/routing.js'
import { registerService } from '../services/registration.js'
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
