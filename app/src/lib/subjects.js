import { db } from "@/lib/api";

export function sortPlacements(placements = []) {
  return [...placements].sort((a, b) => {
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) {
      return a.is_primary ? -1 : 1;
    }
    return (
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.major || "").localeCompare(String(b.major || ""))
    );
  });
}

export function placementsForSubject(subject, placements = []) {
  if (!subject) return [];
  const rows = placements.filter((placement) => placement.subject_id === subject.id);
  if (rows.length) return sortPlacements(rows);
  if (subject.major && subject.year && subject.semester) {
    return [
      {
        id: `legacy-${subject.id}`,
        subject_id: subject.id,
        major: subject.major,
        year: subject.year,
        semester: subject.semester,
        code: subject.code || "",
        is_primary: true,
        sort_order: 1,
      },
    ];
  }
  return [];
}

export async function listSubjectsWithPlacements() {
  const [subjects, placements] = await Promise.all([
    db.list("subjects"),
    db
      .list("subject_placements", { order: "sort_order", asc: true })
      .catch(() => []),
  ]);

  return (subjects || []).map((subject) => ({
    ...subject,
    placements: placementsForSubject(subject, placements || []),
  }));
}

export function isSharedSubject(subject) {
  return (subject?.placements?.length || 0) > 1;
}

export function placementPath(placement) {
  if (!placement?.major || !placement?.year || !placement?.semester) return "";
  return `/${placement.major}/${placement.year}/${placement.semester}`;
}

export function primaryPlacement(subject) {
  const placements = subject?.placements || [];
  return placements.find((placement) => placement.is_primary) || placements[0] || null;
}
