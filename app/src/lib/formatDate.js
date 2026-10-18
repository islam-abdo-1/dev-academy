const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatDate(value, pattern) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (input) => String(input).padStart(2, '0')
  const tokens = {
    MMM: MONTHS[date.getMonth()],
    yyyy: String(date.getFullYear()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    d: String(date.getDate()),
  }
  return pattern.replace(/MMM|yyyy|HH|mm|d/g, (token) => tokens[token])
}
