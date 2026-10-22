import type { PersonalFile, SavedItem, ShareScope } from "@/types/user";
import { safeHttpUrl } from "@/lib/materialPreview";

export type MaterialSource =
  | "official"
  | "personal"
  | "external"
  | "resource"
  | "shared"
  | "archive";

export type ShareResourceType =
  | "file"
  | "list"
  | "course"
  | "lecture_item"
  | "section_item"
  | "resource"
  | "external";

export interface MaterialShareTarget {
  resourceType: Exclude<ShareResourceType, "list" | "course">;
  resourceId: string;
}

export interface MaterialSaveTarget {
  content_type: "official" | "personal" | "external";
  official_material_id?: string | null;
  personal_file_id?: string | null;
  external_url?: string | null;
  kind?: "lecture" | "section" | "course" | "other" | null;
  subject_id?: string | null;
  year?: string | null;
  semester?: string | null;
  title?: string | null;
  user_notes?: string | null;
}

export interface Material {
  id: string;
  source: MaterialSource;
  title: string;
  description?: string | null;
  url: string;
  downloadUrl?: string | null;
  fileType?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  itemType?: string | null;
  kind?: "lecture" | "section" | "course" | "other" | null;
  subjectId?: string | null;
  year?: string | null;
  semester?: string | null;
  driveFileName?: string | null;
  driveMimeType?: string | null;
  canDownload?: boolean;
  canShare?: boolean;
  canSave?: boolean;
  share?: MaterialShareTarget | null;
  save?: MaterialSaveTarget | null;
  revokeOnClose?: boolean;
  permission?: "view" | "download";
  scope?: ShareScope;
}

const cleanUrl = (value?: string | null) => safeHttpUrl(value);

export function materialFromOfficial(
  item: any,
  kind: "lecture" | "section" = "lecture",
): Material {
  const resourceType = kind === "section" ? "section_item" : "lecture_item";
  return {
    id: String(item.id),
    source: "official",
    title: item.title || "مادة بدون عنوان",
    description: item.description || null,
    url: cleanUrl(item.url),
    fileType: item.file_type || null,
    mimeType: item.drive_mime_type || null,
    itemType: item.type || null,
    kind,
    subjectId: item.subject_id || null,
    year: item.year || null,
    semester: item.semester || null,
    driveFileName: item.drive_file_name || null,
    driveMimeType: item.drive_mime_type || null,
    canDownload: true,
    canShare: true,
    canSave: true,
    share: { resourceType, resourceId: String(item.id) },
    save: {
      content_type: "official",
      official_material_id: String(item.id),
      kind,
      subject_id: item.subject_id || null,
      year: item.year || null,
      semester: item.semester || null,
      title: item.title || null,
    },
  };
}

export function materialFromPersonalFile(file: PersonalFile | any): Material {
  return {
    id: String(file.id),
    source: "personal",
    title: file.title || "ملف شخصي",
    description: file.description || null,
    url: cleanUrl(file.file_url || file.url),
    fileType: file.file_type || null,
    mimeType: file.mime_type || null,
    fileSize: file.file_size ?? null,
    kind: "other",
    canDownload: true,
    canShare: true,
    canSave: true,
    share: { resourceType: "file", resourceId: String(file.id) },
    save: {
      content_type: "personal",
      personal_file_id: String(file.id),
      kind: "other",
      title: file.title || null,
    },
  };
}

export function materialFromExternal(
  file: {
    id?: string;
    title?: string | null;
    url?: string | null;
    subjectId?: string | null;
    year?: string | null;
    semester?: string | null;
    description?: string | null;
  },
  savedItemId?: string,
): Material {
  return {
    id: String(savedItemId || file.id || file.url || "external"),
    source: "external",
    title: file.title || file.url || "رابط خارجي",
    description: file.description || null,
    url: cleanUrl(file.url),
    fileType: "link",
    kind: "other",
    subjectId: file.subjectId || null,
    year: file.year || null,
    semester: file.semester || null,
    canDownload: false,
    canShare: Boolean(savedItemId),
    canSave: true,
    share: savedItemId
      ? { resourceType: "external", resourceId: savedItemId }
      : null,
    save: {
      content_type: "external",
      external_url: cleanUrl(file.url),
      kind: "other",
      subject_id: file.subjectId || null,
      year: file.year || null,
      semester: file.semester || null,
      title: file.title || file.url || null,
    },
  };
}

export function materialFromSavedItem(item: SavedItem | any): Material {
  if (item.content_type === "official" && item.official_material) {
    const material = materialFromOfficial(
      {
        ...item.official_material,
        subject_id:
          item.official_material.subject_id ?? item.subject_id ?? null,
        year: item.year || null,
        semester: item.semester || null,
      },
      item.kind === "section" ? "section" : "lecture",
    );
    material.save = {
      ...(material.save || { content_type: "official" }),
      subject_id: item.subject_id ?? material.save?.subject_id ?? null,
      year: item.year ?? null,
      semester: item.semester ?? null,
    };
    return material;
  }

  if (item.content_type === "personal" && item.personal_file) {
    const material = materialFromPersonalFile(item.personal_file);
    material.save = {
      ...(material.save || { content_type: "personal" }),
      subject_id: item.subject_id ?? null,
      year: item.year ?? null,
      semester: item.semester ?? null,
    };
    return material;
  }

  return materialFromExternal(
    {
      title: item.title,
      url: item.external_url,
      subjectId: item.subject_id,
      year: item.year,
      semester: item.semester,
      description: item.user_notes,
    },
    String(item.id),
  );
}

export function materialFromResource(resource: any): Material {
  const fileType = resource.type || "link";
  return {
    id: String(resource.id),
    source: "resource",
    title: resource.title || "مورد",
    description: resource.description || null,
    url: cleanUrl(resource.url),
    fileType,
    itemType: fileType === "video" ? "video" : null,
    subjectId: resource.subject_id || null,
    canDownload: true,
    canShare: true,
    canSave: true,
    share: { resourceType: "resource", resourceId: String(resource.id) },
    save: {
      content_type: "external",
      external_url: cleanUrl(resource.url),
      kind: "other",
      subject_id: resource.subject_id || null,
      title: resource.title || null,
    },
  };
}

export function materialFromSharedItem(
  item: any,
  permission: "view" | "download",
): Material {
  return {
    id: String(item.id),
    source: "shared",
    title: item.title || "ملف",
    url: cleanUrl(item.url),
    fileType: item.file_type || null,
    fileSize: item.file_size ?? null,
    itemType: item.type || null,
    kind: null,
    canDownload: permission === "download",
    canShare: false,
    canSave: false,
    permission,
  };
}

export function materialFromAny(
  item: any,
  source: MaterialSource = "official",
): Material {
  if (source === "personal") return materialFromPersonalFile(item);
  if (source === "resource") return materialFromResource(item);
  return materialFromOfficial(item, "lecture");
}

export function materialShareLabel(resourceType: ShareResourceType): string {
  switch (resourceType) {
    case "file":
      return "ملف";
    case "lecture_item":
    case "section_item":
      return "مادة رسمية";
    case "resource":
      return "مورد";
    case "external":
      return "رابط خارجي";
    case "course":
      return "كورس";
    default:
      return "قائمة";
  }
}
