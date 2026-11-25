import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { User } from '../models/User.js'
import { HttpError } from '../middleware/errors.js'
const BCRYPT_COST = 12
const dummyHash = await bcrypt.hash(
  randomBytes(32).toString('hex'),
  BCRYPT_COST,
)
export const publicUser = ({ name, email }) => ({ name, email })
function credentials(body) {
  const { password } = body
  const email =
    typeof body?.email === 'string' && body.email.trim().toLowerCase()
  if (
    !email ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof password !== 'string' ||
    Buffer.byteLength(password) > 72
  )
    throw new HttpError(
      400,
      'Enter a valid email and password (maximum 72 bytes).',
    )

  return { email, password }
}
export async function register(body) {
  const { email, password } = credentials(body)
  const name = body.name
  if (
    password.length < 10 ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 80
  )
    throw new HttpError(
      400,
      'Enter a name and a password of at least 10 characters.',
    )
  try {
    return await User.create({
      email,
      name: name.trim(),
      password: await bcrypt.hash(password, BCRYPT_COST),
    })
  } catch (error) {
    if (error.code === 11000)
      throw new HttpError(409, 'Email already registered.')
    throw error
  }
}
export async function authenticate(body) {
  const { email, password } = credentials(body)
  const user = await User.findOne({ email })
  const matches = await bcrypt.compare(password, user?.password || dummyHash)
  if (!matches || !user)
    throw new HttpError(401, 'Incorrect email or password.')
  return user
}
