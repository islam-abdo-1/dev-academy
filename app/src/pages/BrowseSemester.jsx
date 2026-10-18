import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ExternalLink, GraduationCap } from "lucide-react";
import { db } from "@/lib/api";
import ConnectionError from "@/components/ConnectionError";
import {
  SEM_LABELS,
  YEAR_LABELS,
  getMajorInfo,
  isValidSem,
  isValidYear,
} from "@/components/browse/catalog";
import Breadcrumb from "@/components/browse/Breadcrumb";
import SubjectCard from "@/components/browse/SubjectCard";
import PublicBackground from "@/components/layout/PublicBackground";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicSearchDialog from "@/components/layout/PublicSearchDialog";
import PublicFooter from "@/components/layout/PublicFooter";
import NotFound from "@/pages/NotFound";
import usePublicSearch from "@/components/browse/usePublicSearch";
import { Skeleton } from "@/components/ui/skeleton";

export default function BrowseSemester() {
  const { major, year, sem } = useParams();
  const search = usePublicSearch();
  const info = getMajorInfo(major);
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSubjects = useCallback(() => {
    setLoading(true);
    setError(false);
    return db
      .list("subjects")
      .then((data) => setSubjects(data || []))
      .catch(() => {
        setSubjects([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    db.list("subjects")
      .then((data) => {
        if (!cancelled) setSubjects(data || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSubjects([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    db.list("resources")
      .then((rows) => {
        if (!cancelled) setCourses((rows || []).filter((row) => !row.subject_id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info || !isValidYear(year) || !isValidSem(sem)) return <NotFound />;

  const yearLabel = YEAR_LABELS[year];
  const semLabel = SEM_LABELS[sem];

  const filtered = subjects.filter(
    (subject) =>
      subject.major === major &&
      subject.year === year &&
      subject.semester === sem,
  );

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <PublicHeader onSearchOpen={search.onOpen} />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <Breadcrumb
          items={[
            { label: info.label, href: `/${major}` },
            { label: yearLabel, href: `/${major}/${year}` },
            { label: semLabel },
          ]}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-xs font-mono mb-1" style={{ color: info.color }}>
            SUBJECTS
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            {yearLabel} · {semLabel}
          </h1>
          <p className="text-muted-foreground mt-1">{info.label}</p>
        </motion.div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-16 bg-muted rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <ConnectionError
            message="تعذّر تحميل المواد — تأكد من اتصالك بالإنترنت وحاول تاني"
            onRetry={loadSubjects}
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen
              size={40}
              className="text-muted-foreground mx-auto mb-3"
            />
            <p className="text-muted-foreground">No subjects found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((subject, index) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <SubjectCard subject={subject} info={info} />
              </motion.div>
            ))}
          </div>
        )}
        {courses.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-10"
          >
            <p className="text-xs font-mono mb-1" style={{ color: info.color }}>
              EXTRA COURSES
            </p>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              كورسات إضافية
            </h2>
            <div className="space-y-3">
              {courses.map((course) => (
                <a
                  key={course.id}
                  href={course.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:bg-white/5"
                  style={{
                    background: "hsl(240, 30%, 7%)",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ background: "hsla(190,100%,50%,0.1)" }}
                  >
                    <GraduationCap size={18} style={{ color: info.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-semibold">
                      {course.title.replace(/\s*-\s*كورس كامل\s*$/, "")}
                    </p>
                    <p className="text-muted-foreground text-sm mt-0.5">
                      كورس كامل — فيديوهات مسجلة
                    </p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </a>
              ))}
            </div>
          </motion.section>
        )}
      </main>
      <PublicFooter />
      <PublicSearchDialog open={search.open} onClose={search.onClose} />
    </div>
  );
}
