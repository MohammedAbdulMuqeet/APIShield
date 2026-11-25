import {
  algorithms,
  normalizeOrigin,
  isPermittedOrigin,
} from '../config/gateway.js'
import { issueKey } from './keys.js'
import { UpstreamGrant } from '../models/UpstreamGrant.js'
import { Service } from '../models/Service.js'
import { HttpError } from '../middleware/errors.js'
import { auditEntry } from './audit.js'
const inRange = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max
function validNodes(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return false
  const valid = nodes.every(
    (node) =>
      node &&
      node.origin &&
      inRange(node.weight, 1, 10) &&
      typeof node.backup === 'boolean',
  )
  return (
    valid &&
    nodes.some((node) => !node.backup) &&
    new Set(nodes.map((node) => node.origin)).size === nodes.length
  )
}
export async function validateSettings(owner, settings) {
  const { name, algorithm, limit, limiter = 'sliding-window' } = settings
  const nodes =
    Array.isArray(settings.nodes) &&
    settings.nodes.map((node) => ({
      origin: normalizeOrigin(node?.origin),
      weight: node?.weight,
      backup: node?.backup,
    }))
  const validName = typeof name === 'string' && name.trim() && name.length <= 80
  if (
    !validName ||
    !algorithms.includes(algorithm) ||
    !['sliding-window', 'token-bucket'].includes(limiter) ||
    !inRange(limit, 1, 1000) ||
    !validNodes(nodes)
  )
    throw new HttpError(
      400,
      'Check the service settings and select a primary node.',
    )
  const custom = nodes
    .map((node) => node.origin)
    .filter((origin) => !isPermittedOrigin(origin))
  if (
    custom.length &&
    (await UpstreamGrant.countDocuments({ owner, origin: { $in: custom } })) !==
      custom.length
  ) {
    throw new HttpError(
      400,
      'This upstream needs approval for your account. See the custom server instructions below.',
    )
  }
  const { healthChecks = false, healthPath = '/' } = settings
  if (
    typeof healthChecks !== 'boolean' ||
    typeof healthPath !== 'string' ||
    !/^\/(?!\/)[A-Za-z0-9_./~-]{0,199}$/.test(healthPath)
  )
    throw new HttpError(400, 'Enter a health check path such as /health.')
  return {
    name: name.trim(),
    nodes,
    algorithm,
    limit,
    limiter,
    healthChecks,
    healthPath,
  }
}
export async function registerService(owner, settings, actor = owner) {
  const config = await validateSettings(owner, settings)
  const { key, keyHash } = issueKey()
  const service = await Service.create({
    ...config,
    owner,
    keyHash,
    audit: [auditEntry(actor, 'Gateway created', config.name)],
  })
  return { id: service.id, key }
}
