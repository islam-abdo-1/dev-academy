import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/subjects/ConfirmDialog";
import SubjectDialog from "@/components/subjects/SubjectDialog";
import {
  MAJOR_LABELS,
  YEAR_LABELS,
  SEMESTER_LABELS,
} from "@/components/subjects/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { searchSubjects } from "@/lib/subjectSearch";
import { useAsyncGuard } from "@/lib/useAsyncGuard";

export default function DashboardSubjects() {
  const { user, isStaff } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { run, busy } = useAsyncGuard();

  const canEdit = isStaff;

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.list("subjects");
      setSubjects(data);
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error?.message || "Failed to load subjects");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const logActivity = (action, entityName) => {
    db.create("activity_logs", {
      action,
      entity_type: "Subject",
      entity_name: entityName,
      performed_by: user?.email,
    }).catch(() => {});
  };

  const handleSave = (data) =>
    run(async () => {
      const payload = {
        ...data,
        credits: data.credits ? Number(data.credits) : undefined,
      };
      if (editingSubject) {
        await db.update("subjects", editingSubject.id, payload);
        await loadSubjects();
        logActivity("Updated subject", payload.name);
        closeDialog();
        toast.success("Subject updated");
      } else {
        await db.create("subjects", payload);
        await loadSubjects();
        logActivity("Created subject", payload.name);
        closeDialog();
        toast.success("Subject created");
      }
    });

  const handleDelete = () =>
    run(async () => {
      await db.remove("subjects", deletingSubject.id);
      await loadSubjects();
      logActivity("Deleted subject", deletingSubject.name);
      setDeletingSubject(null);
      toast.success("Subject deleted");
    });

  const handleAdd = () => {
    setEditingSubject(null);
    setDialogOpen(true);
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSubject(null);
  };

  const filteredSubjects = searchSubjects(subjects, search);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Subjects
        </h1>
        {canEdit && (
          <Button
            onClick={handleAdd}
            className="bg-primary text-primary-foreground hover:brightness-110"
          >
            <Plus size={18} className="mr-2" /> Add Subject
          </Button>
        )}
      </div>
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search subjects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search
            ? "No subjects match your search"
            : "No subjects yet. Create your first one!"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((subject) => (
            <Card
              key={subject.id}
              className="neon-card bg-card group"
              style={{ borderTop: "2px solid hsl(190, 100%, 50%)" }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen size={20} className="text-primary" />
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(subject)}
                        className="p-2 text-muted-foreground hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingSubject(subject)}
                        className="p-2 text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-foreground font-semibold mb-1">
                  {subject.name}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                  {subject.description}
                </p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {subject.major && (
                    <Badge variant="outline" className="text-xs">
                      {MAJOR_LABELS[subject.major] || subject.major}
                    </Badge>
                  )}
                  {subject.year && (
                    <Badge variant="outline" className="text-xs">
                      {YEAR_LABELS[subject.year] || subject.year}
                    </Badge>
                  )}
                  {subject.semester && (
                    <Badge variant="outline" className="text-xs">
                      {SEMESTER_LABELS[subject.semester] || subject.semester}
                    </Badge>
                  )}
                  {subject.credits && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                      {subject.credits} cr
                    </Badge>
                  )}
                </div>
                <Link
                  to={`/dashboard/subjects/${subject.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open <ChevronRight size={12} />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SubjectDialog
        open={dialogOpen}
        onClose={closeDialog}
        editing={editingSubject}
        submitting={busy}
        onSubmit={handleSave}
      />
      <ConfirmDialog
        open={!!deletingSubject}
        onOpenChange={() => setDeletingSubject(null)}
        title="Delete Subject"
        description={`Are you sure you want to delete "${deletingSubject?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmClassName="hover:bg-destructive/90"
        busy={busy}
      />
    </div>
  );
}
