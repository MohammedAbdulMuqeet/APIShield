import { Measurement } from '../models/Measurement.js'

export function observeRequest(service, res, started) {
  const sample = {
    service: service._id,
    at: new Date(),
    attempts: 0,
    upstream5xx: 0,
  }
  res.once('finish', () => {
    Measurement.create({
      ...sample,
      status: res.statusCode,
      elapsedMs: performance.now() - started,
    }).catch((error) =>
      console.error('Gateway measurement write failed:', error.name),
    )
  })
  return sample
}
export async function trendBuckets(id, hours) {
  const width = hours === 1 ? 60000 : 3600000
  const count = hours === 1 ? 60 : hours
  const last = Math.floor(Date.now() / width) * width
  const start = last - (count - 1) * width
  const rows = await Measurement.aggregate([
    {
      $match: {
        service: id,
        at: { $gte: new Date(start), $lt: new Date(last + width) },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$at', unit: hours === 1 ? 'minute' : 'hour' },
        },
        requests: { $sum: 1 },
        attempts: { $sum: '$attempts' },
        errors: { $sum: '$upstream5xx' },
        p95: {
          $percentile: {
            input: '$elapsedMs',
            p: [0.95],
            method: 'approximate',
          },
        },
      },
    },
  ])
  const indexed = new Map(rows.map((row) => [+row._id, row]))
  return Array.from({ length: count }, (_, i) => {
    const at = start + i * width,
      row = indexed.get(at)
    return {
      at: new Date(at),
      requests: row?.requests || 0,
      attempts: row?.attempts || 0,
      errors: row?.errors || 0,
      p95: row?.p95[0] ?? null,
    }
  })
}
