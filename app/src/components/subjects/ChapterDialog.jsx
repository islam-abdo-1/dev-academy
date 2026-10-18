import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default function ChapterDialog({ open, onClose, editing, onSubmit }) {
  const [form, setForm] = useState({ title: '', description: '' })

  useEffect(() => {
    setForm(editing ? { title: editing.title, description: editing.description || '' } : { title: '', description: '' })
  }, [editing, open])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editing ? 'Edit Chapter' : 'New Chapter'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Chapter title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="bg-input border-border"
          />
          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-input border-border"
          />
          <div className="flex justify-end gap-3">
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
