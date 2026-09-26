export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

/** Quote requests expire 7 days after they were submitted. */
export function quoteExpiresAt(createdAt?: string) {
  const date = createdAt ? new Date(createdAt) : new Date()
  date.setDate(date.getDate() + 7)
  date.setHours(23, 59, 0, 0)
  return date.toISOString()
}
