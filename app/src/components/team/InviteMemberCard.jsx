import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROLE_OPTIONS } from '@/components/team/roles'

export default function InviteMemberCard({
  email,
  role,
  inviting,
  onEmailChange,
  onRoleChange,
  onSubmit,
}) {
  return (
    <Card className="neon-card bg-card mb-8">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <UserPlus size={20} className="text-primary" />
          Invite New Member
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="Enter email address..."
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="bg-input border-border flex-1"
            required
          />
          <Select value={role} onValueChange={onRoleChange}>
            <SelectTrigger className="bg-input border-border w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.emoji} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={inviting}
            className="bg-primary text-primary-foreground hover:brightness-110"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
