import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, HardDrive, RefreshCw, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface TopUser {
  user_id: string;
  full_name?: string | null;
  used_bytes: number;
  reserved_bytes: number;
  month_uploaded_bytes: number;
}

interface StorageSummary {
  globalUsedBytes: number;
  globalLimitBytes: number;
  globalReservedBytes: number;
  perUserLimitBytes: number;
  monthlyLimitBytes: number;
  maxFileBytes: number;
  usersCount: number;
  topUsers: TopUser[];
}

interface StorageMonitorProps {
  className?: string;
}

const EMPTY_SUMMARY: StorageSummary = {
  globalUsedBytes: 0,
  globalLimitBytes: 0,
  globalReservedBytes: 0,
  perUserLimitBytes: 0,
  monthlyLimitBytes: 0,
  maxFileBytes: 0,
  usersCount: 0,
  topUsers: [],
};

function toNumber(value: string, unit: 'MB' | 'GB'): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * (unit === 'GB' ? 1024 ** 3 : 1024 ** 2));
}

function asMb(bytes: number): string {
  return bytes > 0 ? String(Math.round((bytes / 1024 ** 2) * 10) / 10) : '0';
}

function asGb(bytes: number): string {
  return bytes > 0 ? String(Math.round((bytes / 1024 ** 3) * 10) / 10) : '0';
}

export function StorageMonitor({ className }: StorageMonitorProps) {
  const [summary, setSummary] = useState<StorageSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalGb, setGlobalGb] = useState('90');
  const [perUserMb, setPerUserMb] = useState('800');
  const [monthlyMb, setMonthlyMb] = useState('100');
  const [maxFileMb, setMaxFileMb] = useState('90');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_storage_admin_summary');
      if (rpcError) throw rpcError;
      const next = (data || EMPTY_SUMMARY) as StorageSummary;
      setSummary({
        ...EMPTY_SUMMARY,
        ...next,
        topUsers: Array.isArray(next.topUsers) ? next.topUsers : [],
      });
      setGlobalGb(asGb(next.globalLimitBytes || 0));
      setPerUserMb(asMb(next.perUserLimitBytes || 0));
      setMonthlyMb(asMb(next.monthlyLimitBytes || 0));
      setMaxFileMb(asMb(next.maxFileBytes || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات التخزين');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const saveLimits = async () => {
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_storage_settings', {
        p_global_limit_bytes: toNumber(globalGb, 'GB'),
        p_per_user_limit_bytes: toNumber(perUserMb, 'MB'),
        p_monthly_limit_bytes: toNumber(monthlyMb, 'MB'),
        p_max_file_bytes: toNumber(maxFileMb, 'MB'),
      });
      if (rpcError) throw rpcError;
      toast.success('تم تحديث حدود التخزين');
      await fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تحديث حدود التخزين');
    } finally {
      setSaving(false);
    }
  };

  const used = summary.globalUsedBytes + summary.globalReservedBytes;
  const percentage =
    summary.globalLimitBytes > 0
      ? Math.min(100, Math.round((used / summary.globalLimitBytes) * 100))
      : 0;
  const critical = percentage >= 95;

  return (
    <div dir="rtl" className={cn('space-y-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">مراقبة التخزين</h2>
          <p className="text-sm text-muted-foreground">
            الحدود العالمية، حصة كل مستخدم، وأكثر الملفات استهلاكًا
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading}>
          <RefreshCw className={cn('ml-2 h-4 w-4', loading && 'animate-spin')} />
          تحديث
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">تعذر تحميل البيانات</p>
            <p className="mt-1 opacity-80">{error}</p>
            <p className="mt-1 text-xs opacity-70">
              تأكد من تطبيق migration 0026 على قاعدة البيانات.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">المستخدم عالميًا</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatBytes(used)}
              </p>
            </div>
            <HardDrive className="h-9 w-9 text-primary/40" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            من {formatBytes(summary.globalLimitBytes)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">محجوز مؤقتًا</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">
            {formatBytes(summary.globalReservedBytes)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">عدد المستخدمين</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users className="h-5 w-5 text-primary/60" />
            {summary.usersCount.toLocaleString('ar-EG')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">حد الملف الواحد</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatBytes(summary.maxFileBytes)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">السعة العالمية</span>
          <span className={critical ? 'font-bold text-destructive' : 'text-muted-foreground'}>
            {percentage}%
          </span>
        </div>
        <Progress value={percentage} className="h-3" />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>مستخدم: {formatBytes(summary.globalUsedBytes)}</span>
          <span>محجوز: {formatBytes(summary.globalReservedBytes)}</span>
          <span>متاح: {formatBytes(Math.max(0, summary.globalLimitBytes - used))}</span>
        </div>
        {percentage >= 80 && (
          <p className={cn('mt-3 text-sm', critical ? 'text-destructive' : 'text-amber-500')}>
            {critical
              ? 'التحذير: السعة العالمية على وشك النفاد. أوقف الرفع أو ارفع الحد.'
              : 'تنبيه: تجاوزت السعة العالمية 80%. تابع الاستخدام.'}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-semibold text-foreground">حدود التخزين</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">السعة العالمية (GB)</span>
            <Input value={globalGb} onChange={(event) => setGlobalGb(event.target.value)} inputMode="decimal" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">حد المستخدم (MB)</span>
            <Input value={perUserMb} onChange={(event) => setPerUserMb(event.target.value)} inputMode="decimal" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">الحد الشهري (MB)</span>
            <Input value={monthlyMb} onChange={(event) => setMonthlyMb(event.target.value)} inputMode="decimal" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">حد الملف (MB)</span>
            <Input value={maxFileMb} onChange={(event) => setMaxFileMb(event.target.value)} inputMode="decimal" />
          </label>
        </div>
        <Button className="mt-4" onClick={saveLimits} disabled={saving}>
          <Save className="ml-2 h-4 w-4" />
          {saving ? 'جارٍ الحفظ...' : 'حفظ الحدود'}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 font-semibold text-foreground">أكثر المستخدمين استهلاكًا</h3>
        {summary.topUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات استخدام بعد.</p>
        ) : (
          <div className="space-y-3">
            {summary.topUsers.map((user) => {
              const userUsed = Number(user.used_bytes) + Number(user.reserved_bytes);
              const pct =
                summary.perUserLimitBytes > 0
                  ? Math.min(100, Math.round((userUsed / summary.perUserLimitBytes) * 100))
                  : 0;
              return (
                <div key={user.user_id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-foreground">
                      {user.full_name || user.user_id.slice(0, 8)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatBytes(userUsed)} / {formatBytes(summary.perUserLimitBytes)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
