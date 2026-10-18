import { useEffect, useState } from 'react'
import { FileText, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import FileUpload from './FileUpload'

export default function ItemDialog({ open, onClose, editing, onSubmit }) {
  const [form, setForm] = useState({ title: '', type: 'video', url: '', file_type: 'pdf' })

  useEffect(() => {
    setForm(
      editing
        ? {
            title: editing.title,
            type: editing.type,
            url: editing.url || '',
            file_type: editing.file_type || 'pdf',
          }
        : { title: '', type: 'video', url: '', file_type: 'pdf' }
    )
  }, [editing, open])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editing ? 'Edit Item' : 'Add Video / File'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="bg-input border-border"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'video' })}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all text-sm font-medium ${
                form.type === 'video'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              <Video size={16} /> Video
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'file' })}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-all text-sm font-medium ${
                form.type === 'file'
                  ? 'border-secondary bg-secondary/10 text-secondary'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              <FileText size={16} /> File
            </button>
          </div>
          {form.type === 'video' ? (
            <Input
              placeholder="Video URL (YouTube, direct link...)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="bg-input border-border"
            />
          ) : (
            <div className="space-y-3">
              <Select value={form.file_type} onValueChange={(value) => setForm({ ...form, file_type: value })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FileUpload
                onFileUploaded={(url, fileType) =>
                  setForm((prev) => ({ ...prev, url, file_type: fileType || prev.file_type }))
                }
              />
              {form.url && <p className="text-xs text-secondary truncate">✓ File uploaded</p>}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:brightness-110">
              {editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
