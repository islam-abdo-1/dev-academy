import { EllipsisVertical, Mail, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { MemberAvatar, RoleBadge } from '@/components/team/roles'

function isProtectedUser(user, currentUserEmail) {
  return (
    user.role === 'super_admin' ||
    user.email?.toLowerCase() === currentUserEmail?.toLowerCase()
  )
}

export default function MemberList({
  users,
  loading,
  currentUserEmail,
  onEdit,
  onMessage,
  onRemove,
}) {
  return (
    <Card className="neon-card bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <Users size={20} className="text-primary" />
          All Members
          <span className="text-xs text-muted-foreground font-normal ml-1">
            ({users.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-14 bg-muted rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => {
              const protectedUser = isProtectedUser(user, currentUserEmail)
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <MemberAvatar name={user.full_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">
                      {user.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <RoleBadge user={user} />
                  {!protectedUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          <EllipsisVertical size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => onEdit(user)}
                        >
                          <Pencil size={14} /> Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => onMessage(user)}
                        >
                          <Mail size={14} /> Send Message
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => onRemove(user)}
                        >
                          <Trash2 size={14} /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
