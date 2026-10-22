import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  LoaderCircle,
  MoreVertical,
  Search,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn, formatDate } from '@/lib/utils';

const PAGE_SIZE = 20;

export type PublishReviewAction = 'approve' | 'reject' | 'needs_changes';

interface PublishRequestsTableProps {
  onViewRequest: (request: any) => void;
  onReviewRequest: (requestId: string, action: PublishReviewAction, notes?: string) => Promise<void>;
  refreshToken?: number;
}

export function PublishRequestsTable({
  onViewRequest,
  onReviewRequest,
  refreshToken = 0,
}: PublishRequestsTableProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    request: any;
    action: PublishReviewAction;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        let userIds: string[] | null = null;
        const term = searchQuery.trim();

        if (term) {
          const safeTerm = term.replace(/[,()]/g, ' ').trim();
          const { data: matchedProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`)
            .limit(100);

          if (profileError) throw profileError;
          userIds = (matchedProfiles || []).map((profile: any) => profile.id);
          if (userIds.length === 0) {
            if (!cancelled) {
              setRequests([]);
              setTotal(0);
            }
            return;
          }
        }

        const from = (page - 1) * PAGE_SIZE;
        let query = supabase
          .from('publish_requests')
          .select('*, profiles!publish_requests_user_id_fkey!inner(full_name, email)', { count: 'exact' })
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .range(from, from + PAGE_SIZE - 1);

        if (userIds) query = query.in('user_id', userIds);
        if (statusFilter !== 'all') query = query.eq('status', statusFilter);

        const { data, error, count } = await query;
        if (error) throw error;
        if (cancelled) return;

        setRequests(data || []);
        setTotal(count || 0);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch publish requests:', err);
          toast.error('تعذر تحميل طلبات النشر');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, statusFilter, sortBy, sortOrder, refreshToken]);

  const openAction = (request: any, action: PublishReviewAction) => {
    setNotes('');
    setPendingAction({ request, action });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.action !== 'approve' && !notes.trim()) {
      toast.error('اكتب سبب الرفض أو التعديلات المطلوبة');
      return;
    }

    setProcessing(true);
    try {
      await onReviewRequest(pendingAction.request.id, pendingAction.action, notes.trim() || undefined);
      setPendingAction(null);
      setNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-500 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-500 border-red-500/30',
      needs_changes: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    };
    return styles[status] || 'bg-gray-500/20 text-gray-500 border-gray-500/30';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'needs_changes':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const actionLabel =
    pendingAction?.action === 'approve'
      ? 'الموافقة على الطلب'
      : pendingAction?.action === 'reject'
        ? 'رفض الطلب'
        : 'طلب تعديلات';

  const hasMore = page * PAGE_SIZE < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو البريد..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-border bg-input py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
            <SelectItem value="approved">تمت الموافقة</SelectItem>
            <SelectItem value="rejected">مرفوض</SelectItem>
            <SelectItem value="needs_changes">مطلوب تعديلات</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'created_at' | 'updated_at')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">تاريخ الإنشاء</SelectItem>
            <SelectItem value="updated_at">تاريخ التحديث</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((previous) => (previous === 'asc' ? 'desc' : 'asc'))}
          className="h-9"
          title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
        >
          {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                المستخدم
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                العناصر
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                الحالة
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                أُنشئ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                روجع
              </th>
              <th className="px-4 py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد طلبات نشر مطابقة
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {request.profiles?.full_name || 'غير معروف'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {request.profiles?.email || request.user_id}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {request.items?.length || 0} عنصر
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
                        getStatusBadge(request.status),
                      )}
                    >
                      {getStatusIcon(request.status)}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(request.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {request.reviewed_at ? formatDate(request.reviewed_at) : '—'}
                  </td>
                  <td className="px-4 py-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          onClick={() =>
                            onViewRequest({
                              ...request,
                              user: request.profiles,
                              user_email: request.profiles?.email,
                            })
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          عرض التفاصيل
                        </DropdownMenuItem>
                        {request.status === 'pending' && (
                          <>
                            <DropdownMenuItem onClick={() => openAction(request, 'approve')}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              موافقة
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAction(request, 'needs_changes')}>
                              <AlertCircle className="mr-2 h-4 w-4 text-blue-500" />
                              طلب تعديلات
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openAction(request, 'reject')}
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              رفض
                            </DropdownMenuItem>
                          </>
                        )}
                        {request.status === 'needs_changes' && (
                          <>
                            <DropdownMenuItem onClick={() => openAction(request, 'approve')}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              موافقة بعد التعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openAction(request, 'reject')}
                              className="text-destructive focus:text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              رفض
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-muted-foreground">
          الصفحة {page} • {total} طلب
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasMore || loading}
          >
            التالي
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !processing) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
            <DialogDescription>
              {pendingAction?.action === 'approve'
                ? 'ستتم إضافة الملفات المحددة إلى الكتالوج العام فور الموافقة.'
                : 'سيتم إبلاغ المستخدم بالسبب قبل إعادة الإرسال.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={
              pendingAction?.action === 'approve'
                ? 'ملاحظات اختيارية...'
                : 'اكتب السبب بالتفصيل...'
            }
            className="min-h-[110px]"
            disabled={processing}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingAction(null)}
              disabled={processing}
            >
              إلغاء
            </Button>
            <Button onClick={confirmAction} disabled={processing}>
              {processing ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  جارٍ التنفيذ...
                </>
              ) : (
                'تأكيد'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
