import { Router } from 'express'
import { proxy } from '../controllers/gateway.js'
export const gateway = Router()
gateway.use('/:id', proxy)
