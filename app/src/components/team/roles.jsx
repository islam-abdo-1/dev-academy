import { Badge } from '@/components/ui/badge'

export const ROLE_OPTIONS = [
  {
    value: 'user',
    label: 'طالب',
    emoji: '👤',
    color: 'hsl(var(--muted-foreground))',
  },
  { value: 'admin', label: 'أدمن', emoji: '🛡', color: 'hsl(160,60%,50%)' },
  { value: 'doctor', label: 'دكتور', emoji: '🎓', color: 'hsl(280,60%,65%)' },
  {
    value: 'assistant',
    label: 'معيد',
    emoji: '📚',
    color: 'hsl(20,100%,60%)',
  },
]

export function getRoleLevel(user) {
  if (user.role === 'super_admin') return 'SUPER_ADMIN'
  if (user.role === 'admin') return 'ADMIN'
  return user.role?.toUpperCase() || 'USER'
}

const ROLE_ORDER = { SUPER_ADMIN: 0, ADMIN: 1, DOCTOR: 2, ASSISTANT: 3, USER: 4 }

export function sortUsersByRole(users) {
  return [...users].sort(
    (a, b) => (ROLE_ORDER[getRoleLevel(a)] ?? 5) - (ROLE_ORDER[getRoleLevel(b)] ?? 5)
  )
}

export function RoleBadge({ user }) {
  const level = getRoleLevel(user)
  if (level === 'SUPER_ADMIN') {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/40 text-xs">
        ⚡ SUPER ADMIN
      </Badge>
    )
  }
  if (level === 'ADMIN') {
    return (
      <Badge className="bg-secondary/20 text-secondary border border-secondary/30 text-xs">
        🛡 أدمن
      </Badge>
    )
  }
  const option = ROLE_OPTIONS.find((role) => role.value === user.role)
  return option ? (
    <Badge
      variant="outline"
      className="text-xs"
      style={{ color: option.color, borderColor: option.color + '55' }}
    >
      {option.emoji} {option.label}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      👤 طالب
    </Badge>
  )
}

export function MemberAvatar({ name }) {
  return (
    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
      {name ? name[0].toUpperCase() : '?'}
    </div>
  )
}
