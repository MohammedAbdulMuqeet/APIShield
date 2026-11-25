import mongoose from 'mongoose'
import { normalizeOrigin } from './config/gateway.js'
import { UpstreamGrant } from './models/UpstreamGrant.js'
import { Workspace } from './models/Workspace.js'
import { User } from './models/User.js'

const [target, address] = process.argv.slice(2)
const origin = normalizeOrigin(address)
if (!target || !origin)
  throw Error('Usage: npm run approve-upstream -- EMAIL_OR_workspace:ID HTTP_OR_HTTPS_ORIGIN')
try {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apishield',
  )
  const owner = /^workspace:[a-f0-9]{24}$/i.test(target)
    ? await Workspace.findById(target.slice(10))
    : await User.findOne({ email: target.trim().toLowerCase() })
  if (!owner) throw Error('Account or workspace not found.')
  await UpstreamGrant.init()
  await UpstreamGrant.updateOne(
    { owner: owner._id, origin },
    { $setOnInsert: { origin } },
    { upsert: true },
  )
  console.log('Approved', origin, 'for', target)
} finally {
  await mongoose.disconnect()
}
