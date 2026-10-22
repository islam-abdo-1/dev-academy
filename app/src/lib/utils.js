import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatBytes } from '@/lib/formatBytes'

export { formatDate } from '@/lib/formatDate'
export { formatBytes }

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
