export function auditEntry(actor, action, detail = '') {
  return { actor, action, detail, at: new Date() }
}
export function auditPush(actor, action, detail) {
  return { audit: { $each: [auditEntry(actor, action, detail)], $slice: -250 } }
}
