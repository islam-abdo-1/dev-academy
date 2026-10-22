import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PublishActionsProps {
  request: any;
  onApprove: (requestId: string, notes?: string) => void;
  onReject: (requestId: string, notes?: string) => void;
  onNeedsChanges: (requestId: string, notes?: string) => void;
}

export function PublishActions({ request, onApprove, onReject, onNeedsChanges }: PublishActionsProps) {
  const { user } = useAuth();
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'needs_changes' | null>(null);

  const handleAction = async (actionType: 'approve' | 'reject' | 'needs_changes') => {
    if (!adminNotes.trim() && actionType !== 'approve') {
      toast.error('Please provide a reason for rejection or changes needed');
      return;
    }

    setProcessing(true);
    try {
      switch (actionType) {
        case 'approve':
          await onApprove(request.id, adminNotes);
          break;
        case 'reject':
          await onReject(request.id, adminNotes);
          break;
        case 'needs_changes':
          await onNeedsChanges(request.id, adminNotes);
          break;
      }
      toast.success(`Request ${actionType}d successfully`);
    } catch (error) {
      toast.error(`Failed to ${actionType} request`);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusConfig = () => {
    switch (request.status) {
      case 'approved':
        return { label: 'Approved', color: 'text-green-500', bg: 'bg-green-500/20 border-green-500/30', icon: CheckCircle2 };
      case 'rejected':
        return { label: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/20 border-red-500/30', icon: XCircle };
      case 'needs_changes':
        return { label: 'Needs Changes', color: 'text-blue-500', bg: 'bg-blue-500/20 border-blue-500/30', icon: AlertTriangle };
      default:
        return { label: 'Pending Review', color: 'text-yellow-500', bg: 'bg-yellow-500/20 border-yellow-500/30', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('px-3 py-1.5 rounded-full text-sm font-medium border inline-flex items-center gap-1.5', statusConfig.color, statusConfig.bg)}>
              <StatusIcon className="h-4 w-4" />
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Admin Notes (Required for rejection/changes)</label>
        <Textarea
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="Enter reason for approval/rejection/changes..."
          className="min-h-[100px]"
          disabled={processing}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setAction('needs_changes')}
          disabled={processing || request.status === 'rejected'}
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Needs Changes
        </Button>

        <Button
          variant="destructive"
          onClick={() => setAction('reject')}
          disabled={processing || request.status === 'rejected'}
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reject
        </Button>

        <Button
          onClick={() => setAction('approve')}
          disabled={processing || request.status === 'approved'}
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Approve
        </Button>
      </div>

      {/* Action Confirmation */}
      {action ? (
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <span className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {action === 'approve' && <CheckCircle2 className="h-5 w-5" />}
              {action === 'reject' && <XCircle className="h-5 w-5" />}
              {action === 'needs_changes' && (
                <AlertTriangle className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="font-medium">
                Confirm {action === 'approve' ? 'Approval' : action === 'reject' ? 'Rejection' : 'Needs Changes'}
              </p>
              <p className="text-sm text-muted-foreground">
                This action will notify the user and update the request status
              </p>
            </div>
          </div>
          <Textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder={`Reason for ${action}...`}
            className="min-h-[80px]"
            required={action !== 'approve'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleAction(action)}
              disabled={processing || (action !== 'approve' && !adminNotes.trim())}
            >
              {processing ? 'Processing...' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}