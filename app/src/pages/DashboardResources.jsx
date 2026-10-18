import { useCallback, useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  LayoutTemplate,
  Link,
  Pencil,
  Plus,
  Presentation,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUpload from "@/components/FileUpload";
import HtmlViewer from "@/components/browse/HtmlViewer";
import {
  downloadHref,
  isHtmlItem,
  isStorageFile,
} from "@/components/browse/ItemRow";

const TYPE_META = {
  pdf: { label: "PDF", icon: FileText, color: "text-red-400" },
  image: { label: "Image", icon: Image, color: "text-blue-400" },
  link: { label: "Link", icon: Link, color: "text-sky-400" },
  html: { label: "HTML", icon: LayoutTemplate, color: "text-emerald-400" },
  docx: { label: "DOCX", icon: FileText, color: "text-sky-400" },
  pptx: { label: "PPTX", icon: Presentation, color: "text-amber-400" },
};

function typeMeta(type) {
  return (
    TYPE_META[type] || {
      label: type || "file",
      icon: File,
      color: "text-muted-foreground",
    }
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ResourceIcon({ type }) {
  const meta = typeMeta(type);
  const Icon = meta.icon;
  return <Icon size={20} className={meta.color} />;
}

export default function DashboardResources() {
  const { user, profile, isSuperAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    url: "",
    subject_id: "",
    type: "pdf",
  });
  const [resources, setResources] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerResource, setViewerResource] = useState(null);

  const email = profile?.email || user?.email || "";
  const canManageAll = isSuperAdmin;

  const loadResources = useCallback(async () => {
    const rows = await db.list("resources");
    setResources(rows);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([db.list("resources"), db.list("subjects")])
      .then(([resourceRows, subjectRows]) => {
        if (!active) return;
        setResources(resourceRows);
        setSubjects(subjectRows);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      url: "",
      subject_id: "",
      type: "pdf",
    });
    setDialogOpen(true);
  };

  const openEdit = (resource) => {
    setEditing(resource);
    setForm({
      title: resource.title,
      description: resource.description || "",
      url: resource.url || "",
      subject_id: resource.subject_id || "",
      type: resource.type || "pdf",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.url.trim()) {
      toast.error("Upload a file or paste a URL first");
      return;
    }
    const payload = { ...form, subject_id: form.subject_id || null };
    try {
      if (editing) {
        await db.update("resources", editing.id, payload);
        await loadResources();
        closeDialog();
        toast.success("Resource updated");
      } else {
        await db.create("resources", {
          ...payload,
          created_by: email,
          created_by_id: profile?.id || user?.id || null,
        });
        try {
          await db.create("activity_logs", {
            action: "Created resource",
            entity_type: "Resource",
            entity_name: form.title,
            performed_by: email,
          });
        } catch {}
        await loadResources();
        closeDialog();
        toast.success("Resource created");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to save resource");
    }
  };

  const handleDelete = async () => {
    const target = deleting;
    try {
      await db.remove("resources", target.id);
    } catch (error) {
      toast.error(error?.message || "Failed to delete resource");
      return;
    }
    try {
      await db.create("activity_logs", {
        action: "Deleted resource",
        entity_type: "Resource",
        entity_name: target.title,
        performed_by: email,
      });
    } catch {}
    await loadResources();
    setDeleting(null);
    toast.success("Resource deleted");
  };

  const canManage = (resource) => canManageAll || resource.created_by === email;

  const subjectName = (id) =>
    subjects.find((subject) => subject.id === id)?.name || "Unassigned";

  const filtered = resources.filter((resource) => {
    const matchesSearch =
      resource.title?.toLowerCase().includes(search.toLowerCase()) ||
      resource.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || resource.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Resources
        </h1>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:brightness-110"
        >
          <Plus size={18} className="mr-2" />
          {" Add Resource"}
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search || typeFilter !== "all"
            ? "No resources match your filter"
            : "No resources yet. Upload your first one!"}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((resource) => (
            <Card key={resource.id} className="neon-card bg-card group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ResourceIcon type={resource.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-foreground font-medium truncate">
                    {resource.title}
                  </h3>
                  {resource.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {resource.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {typeMeta(resource.type).label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {subjectName(resource.subject_id)}
                    </span>
                    {resource.created_date && (
                      <span className="text-xs text-muted-foreground">
                        · {formatDate(resource.created_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {resource.url &&
                    (isHtmlItem({
                      file_type: resource.type,
                      url: resource.url,
                    }) ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setViewerResource(resource);
                        }}
                        title="فتح تفاعلي"
                        aria-label={`فتح ${resource.title}`}
                        className="p-2 text-muted-foreground hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <LayoutTemplate size={14} />
                      </button>
                    ) : (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-muted-foreground hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  {resource.url && isStorageFile(resource) && (
                    <a
                      href={downloadHref(resource)}
                      download
                      title="تحميل الملف"
                      aria-label={`تحميل ${resource.title}`}
                      className="p-2 text-muted-foreground hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {canManage(resource) && (
                    <>
                      <button
                        onClick={() => openEdit(resource)}
                        className="p-2 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleting(resource)}
                        className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="bg-card border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editing ? "Edit Resource" : "New Resource"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Resource title"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              required
              className="bg-input border-border"
            />
            <Textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              className="bg-input border-border"
            />
            <Select
              value={form.subject_id}
              onValueChange={(value) => setForm({ ...form, subject_id: value })}
            >
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Assign to subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload a file or paste a URL
              </p>
              <FileUpload
                onFileUploaded={(url, uploadedType) =>
                  setForm({ ...form, url, type: uploadedType || "pdf" })
                }
              />
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <div className="flex-1 border-t border-border" />
                <span>or</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <Input
                placeholder="Paste URL..."
                value={form.url}
                onChange={(event) =>
                  setForm({ ...form, url: event.target.value, type: "link" })
                }
                className="bg-input border-border"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:brightness-110"
              >
                {editing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete Resource
            </AlertDialogTitle>
            <AlertDialogDescription>
              {'Are you sure you want to delete "'}
              {deleting?.title}
              {'"? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <HtmlViewer
        open={!!viewerResource}
        url={viewerResource?.url}
        title={viewerResource?.title}
        onClose={() => setViewerResource(null)}
      />
    </div>
  );
}
