import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { reviewPublishRequest } from '@/lib/publishReview'
import { PublishRequestsTable } from '@/components/admin/PublishRequestsTable'
import { PublishRequestDetail } from '@/components/admin/PublishRequestDetail'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

export default function DashboardPublishRequests() {
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const handleReview = async (requestId, action, notes) => {
    await reviewPublishRequest(requestId, action, notes)
    toast.success(
      action === 'approve'
        ? 'تمت الموافقة ونشر العناصر في الكتالوج'
        : action === 'reject'
          ? 'تم رفض الطلب'
          : 'تم إرسال طلب التعديلات',
    )
    setSelectedRequest(null)
    setRefreshToken((current) => current + 1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          طلبات النشر
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          راجع ملفات المستخدمين قبل نشرها في الكتالوج العام.
        </p>
      </div>

      <PublishRequestsTable
        onViewRequest={setSelectedRequest}
        onReviewRequest={handleReview}
        refreshToken={refreshToken}
      />

      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null)
        }}
      >
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">تفاصيل طلب النشر</DialogTitle>
          {selectedRequest && (
            <PublishRequestDetail
              request={selectedRequest}
              onClose={() => setSelectedRequest(null)}
              onApprove={(requestId, notes) => handleReview(requestId, 'approve', notes)}
              onReject={(requestId, notes) => handleReview(requestId, 'reject', notes)}
              onNeedsChanges={(requestId, notes) => handleReview(requestId, 'needs_changes', notes)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
