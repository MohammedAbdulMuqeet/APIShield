import mongoose from 'mongoose'
import { normalizeOrigin } from './config/gateway.js'
import { UpstreamGrant } from './models/UpstreamGrant.js'
import { User } from './models/User.js'

const [email, address] = process.argv.slice(2)
const origin = normalizeOrigin(address)
if (!email || !origin)
  throw Error('Usage: npm run approve-upstream -- EMAIL HTTP_OR_HTTPS_ORIGIN')
try {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apishield',
  )
  const owner = await User.findOne({ email: email.trim().toLowerCase() })
  if (!owner) throw Error('No registered account with that email.')
  await UpstreamGrant.init()
  await UpstreamGrant.updateOne(
    { owner: owner._id, origin },
    { $setOnInsert: { origin } },
    { upsert: true },
  )
  console.log('Approved', origin, 'for', owner.email)
} finally {
  await mongoose.disconnect()
}
