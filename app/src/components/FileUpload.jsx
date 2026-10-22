import { useRef, useState } from "react";
import {
  FileText,
  Image,
  LayoutTemplate,
  LoaderCircle,
  Presentation,
  Upload,
  X,
  Video,
  Music,
  FileCode,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { compressStudyImage } from "@/lib/images/compress";
import {
  MAX_HF_FILE_BYTES,
  uploadStudyFile,
} from "@/lib/storage/hfWorker";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".html",
  ".htm",
  ".docx",
  ".pptx",
  ".doc",
  ".ppt",
  ".xlsx",
  ".xls",
  ".zip",
  ".rar",
  ".7z",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".m4a",
  ".py",
  ".txt",
  ".md",
  ".csv",
  ".json",
];
const WARN_SIZE = 10 * 1024 * 1024;
const MAX_SIZE = MAX_HF_FILE_BYTES;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function classify(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "zip" || ext === "rar" || ext === "7z") return "archive";
  if (ext === "mp4" || ext === "webm") return "video";
  if (ext === "mp3" || ext === "wav" || ext === "m4a") return "audio";
  if (ext === "py" || ext === "txt" || ext === "md" || ext === "csv" || ext === "json") return "code";
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp" || ext === "gif") return "image";
  return "other";
}

function getIconForType(type) {
  switch (type) {
    case "pdf":
      return <FileText size={24} className="text-red-400" />;
    case "html":
      return <LayoutTemplate size={24} className="text-emerald-400" />;
    case "docx":
      return <FileText size={24} className="text-sky-400" />;
    case "pptx":
      return <Presentation size={24} className="text-amber-400" />;
    case "xlsx":
      return <FileText size={24} className="text-emerald-400" />;
    case "archive":
      return <Archive size={24} className="text-orange-400" />;
    case "video":
      return <Video size={24} className="text-purple-400" />;
    case "audio":
      return <Music size={24} className="text-pink-400" />;
    case "code":
      return <FileCode size={24} className="text-green-400" />;
    case "image":
      return <Image size={24} className="text-blue-400" />;
    default:
      return <FileText size={24} className="text-muted-foreground" />;
  }
}

function getUploadErrorMessage(error) {
  if (!error) return "فشل رفع الملف — حاول تاني";
  const msg = error.message || String(error);
  if (msg.includes("90MB") || msg.includes("large") || msg.includes("413")) {
    return "حجم الملف يتجاوز الحد المسموح 90MB";
  }
  if (msg.includes("quota") || msg.includes("مساحة") || msg.includes("507")) {
    return "تم تجاوز حد التخزين المتاح — تواصل مع الإدارة";
  }
  if (msg.includes("الجلسة") || msg.includes("مصرح") || msg.includes("401")) {
    return "غير مصرح — سجل دخولك مجدداً وحاول مرة أخرى";
  }
  if (msg.includes("مهيأة") || msg.includes("الاتصال")) {
    return msg;
  }
  return `فشل رفع الملف: ${msg}`;
}

export default function FileUpload({ onFileUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  const uploadFile = async (selected) => {
    const ext = "." + (selected.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      toast.error(
        "نوع الملف غير مسموح — المسموح: PDF, HTML, DOCX/PPTX/DOC/PPT/XLSX, صور, ZIP/RAR/7Z, MP4/MP3, PY/TXT/MD/CSV/JSON",
      );
      return;
    }
    if (selected.size > MAX_SIZE) {
      toast.error(
        `حجم الملف كبير جدًا (${formatSize(selected.size)}) — الحد الأقصى 45MB`,
      );
      return;
    }
    if (selected.size > WARN_SIZE) {
      toast.warning("الملف أكبر من 10MB — التحميل للطلاب ممكن يكون بطيء");
    }
    setUploading(true);
    setProgress(0);
    try {
      const compressed = selected.type.startsWith("image/")
        ? await compressStudyImage(selected)
        : null;
      const uploadFile = compressed?.file || selected;
      if (uploadFile.size > MAX_SIZE) {
        throw new Error("حجم الملف يتجاوز الحد المسموح 90MB");
      }
      const result = await uploadStudyFile(uploadFile, {
        onProgress: setProgress,
      });
      setProgress(100);
      const type = classify(uploadFile.name);
      setFile({
        name: selected.name,
        size: uploadFile.size,
        type,
        url: result.url,
      });
      onFileUploaded(result.url, type);
      toast.success("تم رفع الملف بنجاح");
    } catch (err) {
      toast.error(getUploadErrorMessage(err));
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) uploadFile(dropped);
  };

  const handleChange = (event) => {
    const selected = event.target.files[0];
    if (selected) uploadFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    onFileUploaded("", "");
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
        {getIconForType(file.type)}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(file.size)}
          </p>
        </div>
        <button
          onClick={clearFile}
          className="p-2 text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  const acceptedList = ACCEPTED_EXTENSIONS.join(", ").replace(/\./g, "").toUpperCase();

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
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleChange}
      />
      {uploading ? (
        <div className="space-y-3">
          <LoaderCircle
            size={32}
            className="text-primary animate-spin mx-auto"
          />
          <p className="text-sm text-muted-foreground">
            جاري الرفع... {progress}%
          </p>
          <p className="text-xs text-muted-foreground">
            لا تغلق النافذة أثناء الرفع — الحد الأقصى 90MB
          </p>
        </div>
      ) : (
        <>
          <Upload size={32} className="text-primary mx-auto mb-3" />
          <p className="text-sm text-foreground mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            {ACCEPTED_EXTENSIONS.join(", ").replace(/\./g, "").toUpperCase()}
          </p>
        </>
      )}
    </div>
  );
}