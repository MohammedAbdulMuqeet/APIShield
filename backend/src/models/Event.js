import mongoose from 'mongoose'
const { Schema, model } = mongoose
export const Event = model(
  'Event',
  new Schema({
    owner: { type: Schema.Types.ObjectId, index: true },
    service: String,
    message: String,
    severity: String,
    at: { type: Date, default: Date.now, expires: '7d' },
  }),
)
