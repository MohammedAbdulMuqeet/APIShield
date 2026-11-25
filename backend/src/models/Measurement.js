import mongoose from 'mongoose'
const schema = new mongoose.Schema({
  service: mongoose.Schema.Types.ObjectId,
  at: { type: Date, expires: 7 * 86400 },
  client: String,
  elapsedMs: Number,
  attempts: Number,
  upstream5xx: Number,
  status: Number,
})
schema.index({ service: 1, at: 1 })
export const Measurement = mongoose.model('Measurement', schema)
