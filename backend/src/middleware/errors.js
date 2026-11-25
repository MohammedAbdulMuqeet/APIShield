export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function handleError(error, _req, res, _next) {
  const status = error.status || 500
  const fallback = { 400: 'Invalid request.', 413: 'Payload too large.' }
  res
    .status(status)
    .json({
      error:
        error instanceof HttpError
          ? error.message
          : fallback[status] || 'Service temporarily unavailable.',
    })
}
