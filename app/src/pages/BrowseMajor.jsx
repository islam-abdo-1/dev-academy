import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getMajorInfo } from "@/components/browse/catalog";
import Breadcrumb from "@/components/browse/Breadcrumb";
import PublicBackground from "@/components/layout/PublicBackground";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicSearchDialog from "@/components/layout/PublicSearchDialog";
import PublicFooter from "@/components/layout/PublicFooter";
import NotFound from "@/pages/NotFound";
import usePublicSearch from "@/components/browse/usePublicSearch";

const YEARS = [
  {
    id: "year-1",
    label: "Year 1",
    desc: "Build your foundation in core concepts and fundamentals.",
    semesters: 2,
    subjects: 8,
  },
  {
    id: "year-2",
    label: "Year 2",
    desc: "Deepen your expertise with intermediate topics and labs.",
    semesters: 2,
    subjects: 8,
  },
  {
    id: "year-3",
    label: "Year 3",
    desc: "Advanced topics in specialization tracks and research.",
    semesters: 2,
    subjects: 8,
  },
  {
    id: "year-4",
    label: "Year 4",
    desc: "Capstone projects, thesis, and industry preparation.",
    semesters: 2,
    subjects: 8,
  },
];

export default function BrowseMajor() {
  const { major } = useParams();
  const navigate = useNavigate();
  const search = usePublicSearch();
  const info = getMajorInfo(major);

  if (!info) return <NotFound />;

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <PublicHeader onSearchOpen={search.onOpen} />
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <Breadcrumb items={[{ label: info.label }]} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="text-xs font-mono mb-2" style={{ color: info.color }}>
            SELECT YEAR
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            {info.label}
          </h1>
          <p className="text-muted-foreground mt-2">
            Choose your academic year to continue
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {YEARS.map((year, index) => (
            <motion.div
              key={year.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/${major}/${year.id}`)}
              className="group cursor-pointer rounded-xl p-5"
              style={{
                background: "hsl(240, 30%, 7%)",
                border: `1px solid ${info.border}`,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-4px)";
                event.currentTarget.style.boxShadow =
                  "0 0 20px hsla(190,100%,50%,0.15)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-bold text-foreground">
                  {year.label}
                </span>
                <ChevronRight
                  size={18}
                  style={{ color: info.color }}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </div>
              <p className="text-muted-foreground text-sm mb-4">{year.desc}</p>
              <div className="flex gap-3">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-mono"
                  style={{
                    background: "hsla(190,100%,50%,0.08)",
                    color: info.color,
                    border: `1px solid ${info.border}`,
                  }}
                >
                  {year.semesters} Semesters
                </span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-mono"
                  style={{
                    background: "hsla(190,100%,50%,0.08)",
                    color: info.color,
                    border: `1px solid ${info.border}`,
                  }}
                >
                  {year.subjects} Subjects
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <PublicFooter />
      <PublicSearchDialog open={search.open} onClose={search.onClose} />
    </div>
  );
}
