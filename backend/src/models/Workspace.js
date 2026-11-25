import mongoose from 'mongoose'
const { Schema, model } = mongoose
const schema = new Schema({
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, required: true, index: true },
  members: [{
    email: String,
    user: Schema.Types.ObjectId,
    role: { type: String, enum: ['editor', 'viewer'] },
    digest: String,
    expires: Date,
  }],
})
schema.index({ 'members.user': 1 })
export const Workspace = model('Workspace', schema)
