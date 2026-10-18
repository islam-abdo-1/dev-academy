import { Code, FileText, Image, Presentation, Video } from "lucide-react";

export default function ItemTypeIcon({ item }) {
  if (item.type === "video")
    return <Video size={14} className="text-blue-400" />;
  if (item.file_type === "pdf")
    return <FileText size={14} className="text-red-400" />;
  if (item.file_type === "html")
    return <Code size={14} className="text-orange-400" />;
  if (item.file_type === "image")
    return <Image size={14} className="text-green-400" />;
  if (item.file_type === "pptx")
    return <Presentation size={14} className="text-amber-400" />;
  if (item.file_type === "docx")
    return <FileText size={14} className="text-sky-400" />;
  return <FileText size={14} className="text-muted-foreground" />;
}
