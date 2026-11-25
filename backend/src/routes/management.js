import { Router } from 'express'
import { signedIn } from '../middleware/signedIn.js'
import {
  listClients,
  createClient,
  revokeClient,
} from '../controllers/clients.js'
import { trends, history } from '../controllers/observability.js'
import {
  config,
  listServices,
  listEvents,
  createService,
  loadOwnedService,
  getService,
  editService,
  setEnabled,
  rotateKey,
  deleteService,
} from '../controllers/management.js'
import { workspaces, scopeWorkspace } from './workspaces.js'
export const management = Router()
management.use(signedIn)
management.use('/workspaces', workspaces)
management.use(scopeWorkspace)
management.get('/config', config)
management.get('/services', listServices)
management.get('/events', listEvents)
management.get('/audit', history)
management.post('/services', createService)
management.use('/services/:id', loadOwnedService)
management.get('/services/:id', getService)
management.get('/services/:id/clients', listClients)
management.post('/services/:id/clients', createClient)
management.delete('/services/:id/clients/:client', revokeClient)
management.get('/services/:id/trends', trends)
management.get('/services/:id/audit', history)
management.put('/services/:id', editService)
management.patch('/services/:id/status', setEnabled)
management.post('/services/:id/key', rotateKey)
management.delete('/services/:id', deleteService)
