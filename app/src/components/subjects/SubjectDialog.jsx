import { useEffect, useState } from 'react'
import { ChevronRight, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MAJOR_LABELS, YEAR_LABELS, SEMESTER_LABELS } from './labels'

const EMPTY_FORM = { name: '', description: '', major: '', year: '', semester: '', credits: '' }

export default function SubjectDialog({ open, onClose, editing, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    setForm(
      editing
        ? {
            name: editing.name || '',
            description: editing.description || '',
            major: editing.major || '',
            year: editing.year || '',
            semester: editing.semester || '',
            credits: editing.credits || '',
          }
        : EMPTY_FORM
    )
  }, [editing, open])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editing ? 'Edit Subject' : 'New Subject'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Subject name *"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            className="bg-input border-border"
          />
          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            className="bg-input border-border"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.major} onValueChange={(value) => setField('major', value)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Major" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Credits"
              value={form.credits}
              onChange={(e) => setField('credits', e.target.value)}
              className="bg-input border-border"
              min={1}
              max={20}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.year} onValueChange={(value) => setField('year', value)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="year-1">Year 1</SelectItem>
                <SelectItem value="year-2">Year 2</SelectItem>
                <SelectItem value="year-3">Year 3</SelectItem>
                <SelectItem value="year-4">Year 4</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.semester} onValueChange={(value) => setField('semester', value)}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="sem-1">Semester 1</SelectItem>
                <SelectItem value="sem-2">Semester 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(form.major || form.year || form.semester) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <MapPin size={12} className="text-primary flex-shrink-0" />
                <span className="text-muted-foreground">المسار:</span>
                {form.major && (
                  <>
                    <span className="font-semibold text-primary">{MAJOR_LABELS[form.major] || form.major}</span>
                  </>
                )}
                {form.year && (
                  <>
                    <ChevronRight size={10} className="text-muted-foreground" />
                    <span className="font-semibold text-primary">{YEAR_LABELS[form.year] || form.year}</span>
                  </>
                )}
                {form.semester && (
                  <>
                    <ChevronRight size={10} className="text-muted-foreground" />
                    <span className="font-semibold text-primary">{SEMESTER_LABELS[form.semester] || form.semester}</span>
                  </>
                )}
                {form.name && (
                  <>
                    <ChevronRight size={10} className="text-muted-foreground" />
                    <span className="font-semibold text-foreground">{form.name}</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:brightness-110">
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
