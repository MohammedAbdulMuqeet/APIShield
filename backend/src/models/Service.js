import mongoose from 'mongoose'
const { Schema, model } = mongoose
export const Service = model(
  'Service',
  new Schema({
    owner: Schema.Types.ObjectId,
    name: String,
    algorithm: String,
    limit: Number,
    enabled: { type: Boolean, default: true },
    limiter: { type: String, default: 'sliding-window' },
    nodes: [{ _id: false, origin: String, weight: Number, backup: Boolean }],
    keyHash: { type: String, select: false },
  }),
)
