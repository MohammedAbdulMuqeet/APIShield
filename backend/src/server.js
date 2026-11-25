import mongoose from 'mongoose'
import { app } from './app.js'
import { User } from './models/User.js'
import { Session } from './models/Session.js'
import { Event } from './models/Event.js'
await mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apishield',
  { serverSelectionTimeoutMS: 5000 },
)
await Promise.all([User.init(), Session.init(), Event.init()])
app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () =>
  console.log('APIShield listening on', process.env.PORT || 3001),
)
