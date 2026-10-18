import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ROLE_OPTIONS } from '@/components/team/roles'

export default function EditRoleDialog({ user, role, savingId, onRoleChange, onSave, onClose }) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Edit Role — {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onRoleChange(option.value)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-all"
                style={{
                  background: role === option.value ? option.color + '22' : 'transparent',
                  borderColor:
                    role === option.value ? option.color + '88' : 'hsl(var(--border))',
                  color:
                    role === option.value ? option.color : 'hsl(var(--muted-foreground))',
                }}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:brightness-110"
              disabled={savingId === user?.id}
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
