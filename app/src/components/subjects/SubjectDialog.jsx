import { useEffect, useState } from 'react'
import { Check, ChevronRight, MapPin, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MAJOR_LABELS, YEAR_LABELS, SEMESTER_LABELS } from './labels'

const MAJOR_OPTIONS = ['ai', 'cybersecurity']

const EMPTY_FORM = {
  name: '',
  english_name: '',
  description: '',
  credits: '',
  placements: [],
}

function normalizePlacements(subject) {
  if (!subject) return []
  if (Array.isArray(subject.placements) && subject.placements.length) {
    return subject.placements.map((placement) => ({
      major: placement.major,
      year: placement.year || '',
      semester: placement.semester || '',
      code: placement.code || '',
      is_primary: Boolean(placement.is_primary),
    }))
  }
  if (subject.major && subject.year && subject.semester) {
    return [
      {
        major: subject.major,
        year: subject.year,
        semester: subject.semester,
        code: subject.code || '',
        is_primary: true,
      },
    ]
  }
  return []
}

function sortWithPrimary(placements) {
  const primary = placements.find((placement) => placement.is_primary)
  const rest = placements.filter((placement) => placement !== primary)
  return primary ? [primary, ...rest] : placements
}

export default function SubjectDialog({ open, onClose, editing, onSubmit, submitting = false }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (editing) {
      setForm({
        name: editing.name || '',
        english_name: editing.english_name || '',
        description: editing.description || '',
        credits: editing.credits || '',
        placements: sortWithPrimary(normalizePlacements(editing)),
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [editing, open])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const toggleMajor = (major) => {
    setError('')
    setForm((prev) => {
      const exists = prev.placements.some((placement) => placement.major === major)
      if (exists) {
        const next = prev.placements.filter((placement) => placement.major !== major)
        if (next.length && !next.some((placement) => placement.is_primary)) {
          next[0] = { ...next[0], is_primary: true }
        }
        return { ...prev, placements: next }
      }
      const first = prev.placements[0]
      return {
        ...prev,
        placements: [
          ...prev.placements,
          {
            major,
            year: first?.year || '',
            semester: first?.semester || '',
            code: '',
            is_primary: prev.placements.length === 0,
          },
        ],
      }
    })
  }

  const updatePlacement = (major, field, value) => {
    setError('')
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.map((placement) =>
        placement.major === major ? { ...placement, [field]: value } : placement,
      ),
    }))
  }

  const setPrimary = (major) => {
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.map((placement) => ({
        ...placement,
        is_primary: placement.major === major,
      })),
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('اسم المادة مطلوب.')
      return
    }
    if (form.placements.length === 0) {
      setError('اختر قسمًا واحدًا على الأقل (AI أو Cybersecurity).')
      return
    }
    if (form.placements.some((placement) => !placement.year || !placement.semester)) {
      setError('حدد السنة والترم لكل قسم مختار.')
      return
    }

    const slots = new Set()
    for (const placement of form.placements) {
      const key = `${placement.major}|${placement.year}|${placement.semester}`
      if (slots.has(key)) {
        setError('لا يمكن تكرار نفس القسم بنفس السنة والترم.')
        return
      }
      slots.add(key)
    }

    const hasPrimary = form.placements.some((placement) => placement.is_primary)
    const placements = form.placements.map((placement, index) => ({
      major: placement.major,
      year: placement.year,
      semester: placement.semester,
      code: placement.code.trim(),
      is_primary: hasPrimary ? placement.is_primary : index === 0,
    }))

    onSubmit({
      name: form.name.trim(),
      english_name: form.english_name.trim(),
      description: form.description.trim(),
      credits: form.credits === '' ? null : Number(form.credits),
      placements,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {editing ? 'Edit Subject' : 'New Subject'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Subject name *"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            required
            className="bg-input border-border"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="English name (اختياري)"
              value={form.english_name}
              onChange={(event) => setField('english_name', event.target.value)}
              className="bg-input border-border"
            />
            <Input
              type="number"
              placeholder="Credits"
              value={form.credits}
              onChange={(event) => setField('credits', event.target.value)}
              className="bg-input border-border"
              min={1}
              max={20}
            />
          </div>
          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(event) => setField('description', event.target.value)}
            className="bg-input border-border"
          />

          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">الأقسام والمسارات</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                اختر قسمًا واحدًا أو أكثر. لكل قسم سنة وترم وكود مستقل، والمحتوى يبقى واحدًا.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MAJOR_OPTIONS.map((major) => {
                const selected = form.placements.some((placement) => placement.major === major)
                return (
                  <button
                    key={major}
                    type="button"
                    onClick={() => toggleMajor(major)}
                    aria-pressed={selected}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <span className="font-medium">{MAJOR_LABELS[major] || major}</span>
                    {selected ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                )
              })}
            </div>

            {form.placements.map((placement) => (
              <div
                key={placement.major}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {MAJOR_LABELS[placement.major] || placement.major}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrimary(placement.major)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        placement.is_primary
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      title="المسار الرئيسي"
                    >
                      {placement.is_primary ? 'Primary' : 'اجعله Primary'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMajor(placement.major)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    aria-label={`إزالة ${MAJOR_LABELS[placement.major] || placement.major}`}
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={placement.year}
                    onValueChange={(value) => updatePlacement(placement.major, 'year', value)}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {Object.entries(YEAR_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={placement.semester}
                    onValueChange={(value) => updatePlacement(placement.major, 'semester', value)}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Semester" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {Object.entries(SEMESTER_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Input
                  placeholder={`Code for ${MAJOR_LABELS[placement.major] || placement.major} (مثال: CS207)`}
                  value={placement.code}
                  onChange={(event) => updatePlacement(placement.major, 'code', event.target.value)}
                  className="bg-input border-border"
                />
              </div>
            ))}

            {form.placements.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <MapPin size={12} className="text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">هتظهر في:</span>
                  {form.placements.map((placement, index) => (
                    <span key={placement.major} className="inline-flex items-center gap-1">
                      {index > 0 && <span className="text-muted-foreground">+</span>}
                      <span className="font-semibold text-primary">
                        {MAJOR_LABELS[placement.major] || placement.major}
                      </span>
                      {placement.year && (
                        <>
                          <ChevronRight size={10} className="text-muted-foreground" />
                          <span className="text-foreground">
                            {YEAR_LABELS[placement.year] || placement.year}
                          </span>
                        </>
                      )}
                      {placement.semester && (
                        <>
                          <ChevronRight size={10} className="text-muted-foreground" />
                          <span className="text-foreground">
                            {SEMESTER_LABELS[placement.semester] || placement.semester}
                          </span>
                        </>
                      )}
                      {placement.code && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          ({placement.code})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:brightness-110"
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
