import mongoose from 'mongoose'
const { Schema, model } = mongoose
export const User = model(
  'User',
  new Schema({
    email: { type: String, unique: true },
    password: String,
    name: String,
  }),
)
