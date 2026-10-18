import { Badge } from '@/components/ui/badge'

export default function RoleBadge({ role }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
        ⚡ SUPER ADMIN
      </Badge>
    )
  }
  if (role === 'ADMIN') {
    return (
      <Badge className="bg-secondary/20 text-secondary border border-secondary/30 text-xs">
        🛡 ADMIN
      </Badge>
    )
  }
  if (role === 'STUDENT') {
    return (
      <Badge className="bg-muted/60 text-muted-foreground border border-border text-xs">
        👤 STUDENT
      </Badge>
    )
  }
  return null
}
