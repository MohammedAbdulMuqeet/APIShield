import { Router } from 'express'
import { signedIn } from '../middleware/signedIn.js'
import {
  config,
  listServices,
  listEvents,
  createService,
} from '../controllers/management.js'
export const management = Router()
management.use(signedIn)
management.get('/config', config)
management.get('/services', listServices)
management.get('/events', listEvents)
management.post('/services', createService)
