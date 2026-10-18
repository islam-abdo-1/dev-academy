import { MAJORS } from "@/lib/majors";

const MAJOR_INFO = Object.fromEntries(
  MAJORS.map((major) => [
    major.id,
    { label: major.title, color: major.color, border: major.border },
  ]),
);

export function getMajorInfo(majorId) {
  return MAJOR_INFO[majorId] || null;
}

export const YEAR_LABELS = {
  "year-1": "Year 1",
  "year-2": "Year 2",
  "year-3": "Year 3",
  "year-4": "Year 4",
};

export const SEM_LABELS = {
  "sem-1": "Semester 1",
  "sem-2": "Semester 2",
};

export function isValidYear(year) {
  return Object.keys(YEAR_LABELS).includes(year);
}

export function isValidSem(sem) {
  return Object.keys(SEM_LABELS).includes(sem);
}
