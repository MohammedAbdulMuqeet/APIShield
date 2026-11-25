import mongoose from 'mongoose'
const { Schema, model } = mongoose
export const User = model('User', new Schema({
  email: { type: String, unique: true }, password: String, name: String
}))
export const Session = model('Session', new Schema({
  _id: String, user: Schema.Types.ObjectId, expires: { type: Date, expires: 0 }
}))
export const Service = model('Service', new Schema({
  owner: Schema.Types.ObjectId, name: String, algorithm: String, limit: Number,
  limiter: { type: String, default: 'sliding-window' },
  nodes: [{ _id: false, origin: String, weight: Number, backup: Boolean }],
  keyHash: { type: String, select: false }
}))
export const Event = model('Event', new Schema({
  owner: { type: Schema.Types.ObjectId, index: true }, service: String,
  message: String, severity: String, at: { type: Date, default: Date.now, expires: '7d' }
}))
