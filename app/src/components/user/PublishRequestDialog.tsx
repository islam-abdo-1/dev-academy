import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, FileText, LoaderCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePersonalFiles } from '@/hooks/usePersonalFiles';
import { usePublishRequests } from '@/hooks/usePublishRequests';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';
import { MaterialTypeIcon } from '@/components/material/MaterialTypeIcon';
import type { PublishRequestItem } from '@/types/user';

interface PublishRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

interface Option {
  id: string;
  name: string;
}

export function PublishRequestDialog({ open, onClose, onSubmitted }: PublishRequestDialogProps) {
  const { files, loading, refresh } = usePersonalFiles();
  const { createRequest } = usePublishRequests();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [chapters, setChapters] = useState<Option[]>([]);
  const [sections, setSections] = useState<Option[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    refresh();
    setSelectedIds(new Set());
    setSubjectId('');
    setChapterId('');
    setSectionId('');
    setChapters([]);
    setSections([]);
    supabase
      .from('subjects')
      .select('id,name')
      .order('name')
      .then(({ data }) => setSubjects(data || []));
  }, [open, refresh]);

  useEffect(() => {
    setChapterId('');
    setSectionId('');
    setSections([]);
    if (!subjectId) {
      setChapters([]);
      return;
    }
    supabase
      .from('chapters')
      .select('id,title')
      .eq('subject_id', subjectId)
      .order('order')
      .then(({ data }) => setChapters((data || []).map((row: any) => ({ id: row.id, name: row.title }))));
  }, [subjectId]);

  useEffect(() => {
    setSectionId('');
    if (!subjectId) {
      setSections([]);
      return;
    }
    let query = supabase
      .from('sections')
      .select('id,title')
      .eq('subject_id', subjectId)
      .order('order');
    if (chapterId) query = query.eq('chapter_id', chapterId);
    query.then(({ data }) =>
      setSections((data || []).map((row: any) => ({ id: row.id, name: row.title }))),
    );
  }, [subjectId, chapterId]);

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedIds.has(file.id)),
    [files, selectedIds],
  );

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      toast.error('اختر ملفًا واحدًا على الأقل');
      return;
    }
    if (!subjectId) {
      toast.error('اختر المادة التي ستُنشر فيها الملفات');
      return;
    }

    setSubmitting(true);
    try {
      const items: PublishRequestItem[] = selectedFiles.map((file) => ({
        type: 'personal',
        id: file.id,
        kind: sectionId ? 'section' : 'lecture',
        target_subject_id: subjectId,
        target_chapter_id: chapterId || undefined,
        target_section_id: sectionId || undefined,
        title: file.title,
      }));

      const created = await createRequest(items);
      if (!created) throw new Error('تعذر إنشاء طلب النشر');

      toast.success('تم إرسال طلب النشر للمراجعة');
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            طلب نشر مواد في الكتالوج
          </DialogTitle>
          <DialogDescription>
            اختر ملفاتك الشخصية والمادة المستهدفة. ستتم مراجعة الطلب من الإدارة قبل النشر.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">الملفات الشخصية</label>
            {loading && files.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">جارٍ تحميل الملفات...</div>
            ) : files.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                لا توجد ملفات شخصية. ارفع ملفاتك أولًا من تبويب «ملفاتي».
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {files.map((file) => (
                  <label
                    key={file.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-accent/50',
                      selectedIds.has(file.id) && 'bg-primary/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(file.id)}
                      onChange={() => toggleFile(file.id)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <MaterialTypeIcon
                      fileType={file.file_type}
                      mimeType={file.mime_type}
                      url={file.file_url}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{file.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {(file.file_type || 'file').toUpperCase()} • {formatBytes(file.file_size || 0)}
                      </span>
                    </span>
                    {file.is_public && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">المادة *</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المادة" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">الفصل (اختياري)</label>
              <Select value={chapterId || 'none'} onValueChange={(value) => setChapterId(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون فصل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فصل</SelectItem>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">القسم (اختياري)</label>
              <Select value={sectionId || 'none'} onValueChange={(value) => setSectionId(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="نشر كمحاضرة / مادة عامة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم (محاضرة)</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            عند الموافقة ستُنشر الملفات المحددة داخل الكتالوج وتصبح عامة. يمكنك متابعة حالة الطلب من
            تبويب «ملفاتي».
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || selectedFiles.length === 0 || !subjectId}>
            {submitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                جارٍ الإرسال...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                إرسال الطلب ({selectedFiles.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
