export const allowed = (
  process.env.UPSTREAM_ORIGINS ||
  'http://127.0.0.1:4101,http://127.0.0.1:4102,http://127.0.0.1:4103'
)
  .split(',')
  .map((s) => new URL(s.trim()).origin)
export const algorithms = ['round-robin', 'weighted', 'least-connections']
