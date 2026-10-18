import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { db } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import ChapterAccordion from './ChapterAccordion'

export default function SubjectCard({ subject, info }) {
  const [expanded, setExpanded] = useState(false)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (!expanded || loaded.current) return
    let cancelled = false
    setLoading(true)
    db.filter('chapters', { subject_id: subject.id })
      .then((data) => {
        if (cancelled) return
        loaded.current = true
        setChapters(data || [])
      })
      .catch(() => {
        if (!cancelled) setChapters([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [expanded, subject.id])

  const sorted = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{ background: 'hsl(240, 30%, 7%)', border: `1px solid ${info.border}` }}
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="p-2 rounded-lg flex-shrink-0" style={{ background: 'hsla(190,100%,50%,0.1)' }}>
          <BookOpen size={18} style={{ color: info.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-semibold">{subject.name}</p>
          {subject.description && (
            <p className="text-muted-foreground text-sm truncate mt-0.5">{subject.description}</p>
          )}
        </div>
        {subject.credits && (
          <span
            className="text-xs font-mono px-2 py-1 rounded"
            style={{ color: info.color, background: 'hsla(190,100%,50%,0.08)' }}
          >
            {subject.credits}cr
          </span>
        )}
        {expanded ? (
          <ChevronUp size={16} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t" style={{ borderColor: info.border }}>
              {subject.description && (
                <p className="text-muted-foreground text-sm pt-3 mb-4">{subject.description}</p>
              )}
              {loading ? (
                <div className="space-y-2 pt-2">
                  {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-10 bg-muted rounded-lg" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <p className="text-muted-foreground text-sm italic pt-2">
                  No chapters available yet.
                </p>
              ) : (
                <div className="pt-2">
                  {sorted.map((chapter) => (
                    <ChapterAccordion key={chapter.id} chapter={chapter} info={info} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
