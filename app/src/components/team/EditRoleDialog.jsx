import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MAJOR_LABELS,
  SEMESTER_LABELS,
  YEAR_LABELS,
} from '@/components/subjects/labels'
import { ROLE_OPTIONS } from '@/components/team/roles'

export default function EditRoleDialog({
  user,
  role,
  major,
  year,
  semester,
  savingId,
  onRoleChange,
  onTrackChange,
  onSave,
  onClose,
}) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Edit Role & Track — {user?.full_name || user?.email}
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

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              المسار
            </p>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">التخصص</label>
              <Select
                value={major || 'none'}
                onValueChange={(value) => onTrackChange('major', value === 'none' ? '' : value)}
              >
                <SelectTrigger className="border-border bg-input">
                  <SelectValue placeholder="التخصص" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="none">غير محدد</SelectItem>
                  <SelectItem value="ai">{MAJOR_LABELS.ai}</SelectItem>
                  <SelectItem value="cybersecurity">{MAJOR_LABELS.cybersecurity}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">السنة</label>
              <Select
                value={year || 'none'}
                onValueChange={(value) => onTrackChange('year', value === 'none' ? '' : value)}
              >
                <SelectTrigger className="border-border bg-input">
                  <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="none">غير محدد</SelectItem>
                  {Object.entries(YEAR_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">الترم</label>
              <Select
                value={semester || 'none'}
                onValueChange={(value) =>
                  onTrackChange('semester', value === 'none' ? '' : value)
                }
              >
                <SelectTrigger className="border-border bg-input">
                  <SelectValue placeholder="الترم" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="none">غير محدد</SelectItem>
                  {Object.entries(SEMESTER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
