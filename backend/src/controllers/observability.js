import { Service } from '../models/Service.js'
import { User } from '../models/User.js'
import { trendBuckets } from '../services/measurements.js'
import { HttpError } from '../middleware/errors.js'

export async function trends(req, res) {
  const hours = Number(req.query.hours || 1)
  if (![1, 24, 168].includes(hours))
    throw new HttpError(400, 'Choose one hour, one day or seven days.')
  res.json(await trendBuckets(req.service._id, hours))
}
export async function history(req, res) {
  const filter = { owner: req.scopeId }
  if (req.service) filter._id = req.service._id
  const rows = await Service.aggregate([
    {
      $match: {
        ...filter,
        owner: new Service.base.Types.ObjectId(filter.owner),
      },
    },
    { $unwind: '$audit' },
    { $sort: { 'audit.at': -1, 'audit._id': -1 } },
    { $limit: req.service ? 250 : 100 },
    { $project: { name: 1, entry: '$audit' } },
  ])
  const actors = await User.find({
    _id: { $in: rows.map((row) => row.entry.actor) },
  }).select('email')
  const email = new Map(actors.map((user) => [user.id, user.email]))
  res.json(
    rows.map(({ name, entry }) => ({
      ...entry,
      gateway: name,
      actor: email.get(String(entry.actor)) || String(entry.actor),
    })),
  )
}
