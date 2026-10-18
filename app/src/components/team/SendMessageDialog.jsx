import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export default function SendMessageDialog({
  user,
  body,
  sending,
  onBodyChange,
  onSend,
  onClose,
}) {
  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Send Message to {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">To: {user?.email}</p>
          <Textarea
            placeholder="Write your message..."
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            className="bg-input border-border min-h-[100px]"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:brightness-110"
              disabled={sending || !body.trim()}
              onClick={onSend}
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
