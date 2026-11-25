import mongoose from 'mongoose'
const { Schema, model } = mongoose
export const Session = model(
  'Session',
  new Schema({
    _id: String,
    user: Schema.Types.ObjectId,
    expires: { type: Date, expires: 0 },
  }),
)
