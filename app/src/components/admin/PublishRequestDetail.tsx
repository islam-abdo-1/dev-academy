import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Calendar,
  Tag,
  FileText,
  Video,
  Image,
  Music,
  FileCode,
  Archive,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn, formatDate, formatBytes } from '@/lib/utils';
import { MaterialTypeIcon } from '@/components/material/MaterialTypeIcon';
import { materialFromPersonalFile } from '@/components/material/types';
import { useMaterialViewer } from '@/components/material/MaterialViewerProvider';

interface PublishRequestDetailProps {
  request: any;
  onClose: () => void;
  onApprove: (requestId: string, notes?: string) => void;
  onReject: (requestId: string, notes?: string) => void;
  onNeedsChanges: (requestId: string, notes?: string) => void;
}

export function PublishRequestDetail({
  request,
  onClose,
  onApprove,
  onReject,
  onNeedsChanges,
}: PublishRequestDetailProps) {
  const { openMaterial } = useMaterialViewer();
  const [activeTab, setActiveTab] = useState<'items' | 'details' | 'history'>('items');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [requestFiles, setRequestFiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const ids = (request.items || [])
      .filter((item: any) => item.type === 'personal' && item.id)
      .map((item: any) => item.id);
    if (ids.length === 0) {
      setRequestFiles({});
      return;
    }
    let cancelled = false;
    supabase
      .from('user_personal_files')
      .select('id,title,description,file_url,file_type,file_size,mime_type')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        setRequestFiles(
          Object.fromEntries((data || []).map((file: any) => [String(file.id), file])),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [request.id]);

  const renderItemsTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Items to Review ({request.items?.length || 0})</h3>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {request.items?.map((item: any) => {
          const file = requestFiles[String(item.id)];
          const fileType = file?.file_type || item.file_type;
          return (
            <div key={item.id} className="p-4 bg-card border border-border rounded-xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-muted rounded-lg">
                  <MaterialTypeIcon
                    fileType={fileType}
                    url={file?.file_url}
                    size={24}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium text-foreground truncate">
                      {file?.title || item.title || 'Untitled'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {item.kind || 'item'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.subject && <span>Subject: {item.subject}</span>}
                    {item.chapter && <span>Chapter: {item.chapter}</span>}
                    {fileType && (
                      <span className="px-2 py-0.5 rounded bg-muted/50">
                        {String(fileType).toUpperCase()}
                      </span>
                    )}
                    {file?.file_size ? <span>{formatBytes(file.file_size)}</span> : null}
                    {file && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openMaterial(materialFromPersonalFile(file))}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        معاينة
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDetailsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-foreground mb-3">Request Information</h4>
          <dl className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Request ID</dt>
                <dd className="font-mono text-sm">{request.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className="flex items-center gap-2">
                  <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', request.status === 'approved' && 'bg-green-500/20 text-green-500 border-green-500/30', request.status === 'rejected' && 'bg-red-500/20 text-red-500 border-red-500/30', request.status === 'needs_changes' && 'bg-blue-500/20 text-blue-500 border-blue-500/30', request.status === 'pending' && 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30')}>
                    {request.status.replace('_', ' ').toUpperCase()}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Submitted</dt>
                <dd>{formatDate(request.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Last Updated</dt>
                <dd>{request.updated_at ? formatDate(request.updated_at) : '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Items Count</dt>
                <dd>{request.items?.length || 0}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Reviewed By</dt>
                <dd>{request.reviewed_by ? request.reviewed_by.slice(0, 8) + '...' : '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Reviewed At</dt>
                <dd>{request.reviewed_at ? formatDate(request.reviewed_at) : '—'}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Status History</h3>
      <div className="space-y-4">
        <div className="relative pl-4 border-l-2 border-border">
          <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-yellow-500 border-2 border-background" />
          <div className="ml-4 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">PENDING</span>
              <span className="text-sm text-muted-foreground">{formatDate(request.created_at)}</span>
            </div>
            <p className="text-sm text-muted-foreground ml-4 mt-1">Request submitted by user</p>
          </div>
        </div>
        {request.reviewed_at && (
          <div className="relative pl-4 border-l-2 border-border">
            <div className="absolute left-0 top-0 w-3 h-3 rounded-full border-2 border-background"
              style={{ backgroundColor: request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'blue' }} />
            <div className="ml-4 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium', request.status === 'approved' && 'bg-green-500/20 text-green-500 border-green-500/30', request.status === 'rejected' && 'bg-red-500/20 text-red-500 border-red-500/30', request.status === 'needs_changes' && 'bg-blue-500/20 text-blue-500 border-blue-500/30')}>
                  {request.status.toUpperCase()}
                </span>
                <span className="text-sm text-muted-foreground">{formatDate(request.reviewed_at!)}</span>
              </div>
              {request.admin_notes && (
                <p className="text-sm text-muted-foreground ml-4 mt-1">
                  Admin notes: {request.admin_notes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const runAction = async (
    action: 'approve' | 'reject' | 'needs_changes',
    handler: (requestId: string, notes?: string) => void | Promise<void>,
  ) => {
    if (action !== 'approve' && !adminNotes.trim()) {
      toast.error('اكتب سبب الرفض أو التعديلات المطلوبة');
      return;
    }

    setProcessing(true);
    try {
      await handler(request.id, adminNotes.trim() || undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء');
    } finally {
      setProcessing(false);
    }
  };

  const renderActionButtons = () => {
    if (request.status === 'pending') {
      return (
        <>
          <Button
            variant="outline"
            onClick={() => runAction('needs_changes', onNeedsChanges)}
            disabled={processing}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Needs Changes
          </Button>
          <Button
            variant="destructive"
            onClick={() => runAction('reject', onReject)}
            disabled={processing}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={() => runAction('approve', onApprove)}
            disabled={processing}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {processing ? 'Processing...' : 'Approve'}
          </Button>
        </>
      );
    }

    if (request.status === 'needs_changes') {
      return (
        <>
          <Button
            variant="outline"
            onClick={() => runAction('reject', onReject)}
            disabled={processing}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={() => runAction('approve', onApprove)}
            disabled={processing}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {processing ? 'Processing...' : 'Approve After Changes'}
          </Button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="max-w-4xl max-h-[90vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">Publish Request Details</h2>
          <p className="text-sm text-muted-foreground">Request ID: {request.id.slice(0, 8)}...</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium', request.status === 'approved' && 'bg-green-500/20 text-green-500 border-green-500/30', request.status === 'rejected' && 'bg-red-500/20 text-red-500 border-red-500/30', request.status === 'needs_changes' && 'bg-blue-500/20 text-blue-500 border-blue-500/30', request.status === 'pending' && 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30')}>
            {request.status === 'approved' ? (
              <CheckCircle className="h-4 w-4" />
            ) : request.status === 'rejected' ? (
              <XCircle className="h-4 w-4" />
            ) : request.status === 'needs_changes' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <span className="capitalize">{request.status.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{request.user?.full_name || 'Unknown'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>{request.user_email || request.user_id}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex -mb-px" aria-label="Tabs">
          {['items', 'details', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>

      <div className="space-y-3 border-t border-border p-4">
        {(request.status === 'pending' || request.status === 'needs_changes') && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin Notes (Required for rejection/changes)</label>
            <Textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="اكتب السبب أو ملاحظات المراجعة..."
              className="min-h-[80px]"
              disabled={processing}
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Close
          </Button>
          {renderActionButtons()}
        </div>
      </div>
    </div>
  );
}