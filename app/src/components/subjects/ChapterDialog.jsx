import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const EMPTY_FORM = { title: '', description: '', kind: 'lectures' }

export default function ChapterDialog({ open, onClose, editing, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    setForm(
      editing
        ? { title: editing.title, description: editing.description || '', kind: editing.kind || 'lectures' }
        : EMPTY_FORM
    )
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
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">نوع المحتوى</label>
            <Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="lectures">محاضرات — محتوى على شكل محاضرات</SelectItem>
                <SelectItem value="sections">سكاشن — محتوى على شكل سكاشن</SelectItem>
                <SelectItem value="files">ملفات مباشرة — كتاب / ملخصات / فيديوهات</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
