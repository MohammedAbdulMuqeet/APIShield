import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true },
  origin: { type: String, required: true },
})
schema.index({ owner: 1, origin: 1 }, { unique: true })
export const UpstreamGrant = mongoose.model('UpstreamGrant', schema)
