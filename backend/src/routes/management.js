import { Router } from 'express'
import { signedIn } from '../middleware/signedIn.js'
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
export const management = Router()
management.use(signedIn)
management.get('/config', config)
management.get('/services', listServices)
management.get('/events', listEvents)
management.post('/services', createService)
management.use('/services/:id', loadOwnedService)
management.get('/services/:id', getService)
management.put('/services/:id', editService)
management.patch('/services/:id/status', setEnabled)
management.post('/services/:id/key', rotateKey)
management.delete('/services/:id', deleteService)
