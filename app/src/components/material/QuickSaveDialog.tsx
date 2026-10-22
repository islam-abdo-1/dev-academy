import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSavedLists } from "@/hooks/useSavedLists";
import { useSavedItems } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialTypeIcon } from "@/components/material/MaterialTypeIcon";
import type { Material } from "@/components/material/types";

interface QuickSaveDialogProps {
  open: boolean;
  material: Material | null;
  onClose: () => void;
}

interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
  year?: string | null;
  semester?: string | null;
}

export function QuickSaveDialog({ open, material, onClose }: QuickSaveDialogProps) {
  const { lists, loading: listsLoading, createList } = useSavedLists();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { addItem } = useSavedItems(selectedListId || null);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedListId(lists[0]?.id || "");
    setNewListName("");
    setSelectedSubjectId(material?.save?.subject_id || "");
    setNotes("");
  }, [open, material?.id, lists]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from("subjects")
      .select("id,name,code,year,semester")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setSubjects((data as SubjectOption[]) || []);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !material) return null;

  const handleSubmit = async () => {
    let listId = selectedListId;
    if (!listId) {
      const trimmedName = newListName.trim();
      if (!trimmedName) {
        toast.error("اختر قائمة أو اكتب اسم قائمة جديدة");
        return;
      }
      setCreatingList(true);
      const created = await createList(trimmedName);
      setCreatingList(false);
      if (!created) {
        toast.error("تعذر إنشاء القائمة");
        return;
      }
      listId = created.id;
      setSelectedListId(created.id);
    }

    setSaving(true);
    const baseSave = material.save || {
      content_type: "external" as const,
      external_url: material.url,
      kind: "other" as const,
      title: material.title,
    };

    const result = await addItem(listId, {
      ...baseSave,
      subject_id: selectedSubject?.id || baseSave.subject_id || null,
      year: selectedSubject?.year || baseSave.year || null,
      semester: selectedSubject?.semester || baseSave.semester || null,
      title: baseSave.title || material.title,
      user_notes: notes.trim() || null,
    });
    setSaving(false);

    if (result) {
      window.dispatchEvent(new Event("dev-academy:saved-items-changed"));
      toast.success("تم حفظ المادة في الخزنة");
      onClose();
    } else {
      toast.error("تعذر حفظ المادة");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10030] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`حفظ ${material.title}`}
        dir="rtl"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <MaterialTypeIcon
              fileType={material.fileType}
              mimeType={material.mimeType}
              url={material.url}
              type={material.itemType}
              size={22}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <BookmarkPlus className="h-4 w-4 text-primary" />
              حفظ في الخزنة
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{material.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">القائمة</label>
            {listsLoading ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                جارٍ تحميل القوائم...
              </div>
            ) : lists.length > 0 ? (
              <select
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">لا توجد قوائم بعد. أنشئ قائمتك الأولى.</p>
                <Input
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="اسم القائمة الجديدة"
                />
              </div>
            )}
            {lists.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedListId("");
                  setNewListName("");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                إنشاء قائمة جديدة
              </button>
            )}
            {lists.length > 0 && !selectedListId && (
              <Input
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="اسم القائمة الجديدة"
                autoFocus
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">المادة</label>
            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">بدون مادة محددة</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code ? `${subject.code} - ${subject.name}` : subject.name}
                </option>
              ))}
            </select>
            {selectedSubject && (
              <p className="text-xs text-muted-foreground">
                {[selectedSubject.year, selectedSubject.semester].filter(Boolean).join(" - ") ||
                  "سيتم حفظ بيانات المادة من القائمة"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظة اختيارية / سبب الحفظ"
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || creatingList}>
            {saving || creatingList ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <BookmarkPlus className="h-4 w-4" />
            )}
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}
