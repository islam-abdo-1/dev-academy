import { useEffect, useState } from 'react';
import { Check, Copy, Link2, LoaderCircle, QrCode, Share2, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShareList } from '@/hooks/useShareList';
import { cn } from '@/lib/utils';
import type { ShareScope } from '@/types/user';

interface ShareListDialogProps {
  open: boolean;
  onClose: () => void;
  listId: string | null;
  listName?: string;
  onShare?: () => void;
}

const YEARS = [
  { value: 'year-1', label: 'السنة الأولى' },
  { value: 'year-2', label: 'السنة الثانية' },
  { value: 'year-3', label: 'السنة الثالثة' },
  { value: 'year-4', label: 'السنة الرابعة' },
];

const SEMESTERS = [
  { value: 'sem-1', label: 'الترم الأول' },
  { value: 'sem-2', label: 'الترم الثاني' },
];

const SCOPES: Array<{ value: ShareScope; title: string; description: string }> = [
  { value: 'all', title: 'كل القائمة', description: 'كل العناصر المحفوظة' },
  { value: 'year', title: 'فرقة محددة', description: 'عناصر فرقة دراسية واحدة' },
  { value: 'term', title: 'ترم محدد', description: 'عناصر فرقة وترم محددين' },
];

export function ShareListDialog({ open, onClose, listId, listName, onShare }: ShareListDialogProps) {
  const { creating, error, created, createShareLink, revokeShareLink, reset } = useShareList();
  const [scope, setScope] = useState<ShareScope>('all');
  const [year, setYear] = useState('year-1');
  const [semester, setSemester] = useState('sem-1');
  const [permission, setPermission] = useState<'view' | 'download'>('view');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      reset();
      setCopied(false);
    }
  }, [open, listId, reset]);

  const handleCreate = async () => {
    if (!listId) return;
    const result = await createShareLink({
      resourceType: 'list',
      resourceId: listId,
      scope,
      year: scope === 'all' ? null : year,
      semester: scope === 'term' ? semester : null,
      permission,
    });
    if (result) {
      toast.success('تم إنشاء رابط المشاركة');
      window.dispatchEvent(new Event('dev-academy:shares-changed'));
      onShare?.();
    }
  };

  const handleCopy = async () => {
    if (!created?.url) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    toast.success('تم نسخ الرابط');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!created) return;
    const ok = await revokeShareLink(created.token);
    if (ok) {
      window.dispatchEvent(new Event('dev-academy:shares-changed'));
      toast.success('تم إبطال رابط المشاركة');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            مشاركة {listName ? `"${listName}"` : 'القائمة'}
          </DialogTitle>
          <DialogDescription>
            أنشئ رابطًا عامًا لمشاركة عناصر القائمة. يمكنك تحديد النطاق والصلاحية.
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">نطاق المشاركة</label>
              <div className="grid gap-2">
                {SCOPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      scope === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1 h-4 w-4 rounded-full border',
                        scope === option.value ? 'border-primary bg-primary' : 'border-muted-foreground',
                      )}
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {scope !== 'all' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرقة</label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {scope === 'term' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الترم</label>
                    <Select value={semester} onValueChange={setSemester}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEMESTERS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">الصلاحية</label>
              <Select value={permission} onValueChange={(value) => setPermission(value as 'view' | 'download')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">عرض فقط</SelectItem>
                  <SelectItem value="download">عرض وتحميل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button onClick={handleCreate} disabled={creating || !listId}>
                {creating ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    جارٍ الإنشاء...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    إنشاء رابط
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={created.url} size={208} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4" />
                رابط المشاركة
              </label>
              <div className="flex gap-2">
                <Input value={created.url} readOnly className="flex-1 bg-muted" />
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">الرابط صالح لمدة 30 يومًا من الآن.</p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" className="text-destructive" onClick={handleRevoke}>
                <Trash2 className="mr-2 h-4 w-4" />
                إبطال الرابط
              </Button>
              <Button onClick={onClose}>إغلاق</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
