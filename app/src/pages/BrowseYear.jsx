import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import {
  YEAR_LABELS,
  getMajorInfo,
  isValidYear,
} from "@/components/browse/catalog";
import Breadcrumb from "@/components/browse/Breadcrumb";
import PublicBackground from "@/components/layout/PublicBackground";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicSearchDialog from "@/components/layout/PublicSearchDialog";
import PublicFooter from "@/components/layout/PublicFooter";
import NotFound from "@/pages/NotFound";
import usePublicSearch from "@/components/browse/usePublicSearch";

const SEMESTERS = [
  {
    id: "sem-1",
    label: "First Semester",
    period: "September – January",
    subjects: 4,
    credits: 11,
  },
  {
    id: "sem-2",
    label: "Second Semester",
    period: "February – June",
    subjects: 4,
    credits: 12,
  },
];

export default function BrowseYear() {
  const { major, year } = useParams();
  const search = usePublicSearch();
  const info = getMajorInfo(major);

  if (!info || !isValidYear(year)) return <NotFound />;

  const yearLabel = YEAR_LABELS[year];

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <PublicHeader onSearchOpen={search.onOpen} />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <Breadcrumb
          items={[
            { label: info.label, href: `/${major}` },
            { label: yearLabel },
          ]}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="text-xs font-mono mb-2" style={{ color: info.color }}>
            SELECT SEMESTER
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {yearLabel}
          </h1>
          <p className="text-muted-foreground mt-2">{info.label}</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {SEMESTERS.map((semester, index) => (
            <motion.div
              key={semester.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12 }}
              className="group rounded-xl"
              style={{
                background: "hsl(240, 30%, 7%)",
                border: `1px solid ${info.border}`,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-4px)";
                event.currentTarget.style.boxShadow =
                  "0 0 20px hsla(190,100%,50%,0.2)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow = "none";
              }}
            >
              <Link
                to={`/${major}/${year}/${semester.id}`}
                className="block rounded-xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-foreground">
                    {semester.label}
                  </span>
                  <ChevronRight
                    size={18}
                    style={{ color: info.color }}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {semester.period}
                </p>
                <div className="flex gap-3">
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-mono"
                    style={{
                      background: "hsla(190,100%,50%,0.08)",
                      color: info.color,
                      border: `1px solid ${info.border}`,
                    }}
                  >
                    {semester.subjects} Subjects
                  </span>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-mono"
                    style={{
                      background: "hsla(190,100%,50%,0.08)",
                      color: info.color,
                      border: `1px solid ${info.border}`,
                    }}
                  >
                    {semester.credits} Credits
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
      <PublicFooter />
      <PublicSearchDialog open={search.open} onClose={search.onClose} />
    </div>
  );
}
