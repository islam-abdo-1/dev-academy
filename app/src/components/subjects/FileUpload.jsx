import { useRef, useState } from "react";
import {
  FileText,
  Image,
  LayoutTemplate,
  LoaderCircle,
  Presentation,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";

const ACCEPTED = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".html",
  ".docx",
  ".pptx",
];
const WARN_SIZE = 10 * 1024 * 1024;
const MAX_SIZE = 45 * 1024 * 1024;

function formatSize(size) {
  return size < 1024
    ? size + " B"
    : size < 1024 * 1024
      ? (size / 1024).toFixed(1) + " KB"
      : (size / (1024 * 1024)).toFixed(1) + " MB";
}

function classify(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  return "image";
}

function sanitizeName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function sha256Hex(file) {
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
  } catch {
    return Date.now().toString(36);
  }
}

export default function FileUpload({ onFileUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) upload(file);
  };

  const upload = async (file) => {
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      toast.error(
        "نوع الملف غير مسموح — المسموح: PDF, PNG, JPG, WEBP, HTML, DOCX, PPTX",
      );
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(
        `حجم الملف كبير جدًا (${formatSize(file.size)}) — الحد الأقصى 45MB`,
      );
      return;
    }
    if (file.size > WARN_SIZE) {
      toast.warning("الملف أكبر من 10MB — التحميل للطلاب ممكن يكون بطيء");
    }
    setUploading(true);
    setProgress(10);
    const interval = setInterval(() => {
      setProgress((value) => Math.min(value + 15, 85));
    }, 200);
    try {
      const hash = await sha256Hex(file);
      const path = `lectures/${crypto.randomUUID()}/${hash}_${sanitizeName(file.name)}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      setProgress(100);
      const fileType = classify(file.name);
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: fileType,
        url: data.publicUrl,
      });
      onFileUploaded(data.publicUrl, fileType);
    } catch {
      toast.error("فشل رفع الملف — حاول تاني");
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  const handleRemove = () => {
    setUploadedFile(null);
    onFileUploaded("", "");
  };

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
        {uploadedFile.type === "pdf" ? (
          <FileText size={24} className="text-red-400" />
        ) : uploadedFile.type === "html" ? (
          <LayoutTemplate size={24} className="text-emerald-400" />
        ) : uploadedFile.type === "docx" ? (
          <FileText size={24} className="text-sky-400" />
        ) : uploadedFile.type === "pptx" ? (
          <Presentation size={24} className="text-amber-400" />
        ) : (
          <Image size={24} className="text-blue-400" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">
            {uploadedFile.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSize(uploadedFile.size)}
          </p>
        </div>
        <button
          onClick={handleRemove}
          className="p-2 text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all ${
        dragging
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border hover:border-primary/50"
      }`}
      style={
        dragging
          ? { boxShadow: "0 0 20px hsla(190, 100%, 50%, 0.2)" }
          : undefined
      }
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED.join(",")}
        onChange={handleChange}
      />
      {uploading ? (
        <div className="space-y-3">
          <LoaderCircle
            size={32}
            className="text-primary animate-spin mx-auto"
          />
          <p className="text-sm text-muted-foreground">Uploading...</p>
          <Progress value={progress} className="max-w-xs mx-auto h-2" />
        </div>
      ) : (
        <>
          <Upload size={32} className="text-primary mx-auto mb-3" />
          <p className="text-sm text-foreground mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, PNG, JPG, WEBP, HTML, DOCX, PPTX
          </p>
        </>
      )}
    </div>
  );
}
