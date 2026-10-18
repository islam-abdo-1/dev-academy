import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/api'
import { useAsyncGuard } from '@/lib/useAsyncGuard'
import ConfirmDialog from './ConfirmDialog'
import ItemsManager from './ItemsManager'
import LectureCard from './LectureCard'
import LectureDialog from './LectureDialog'
import SectionCard from './SectionCard'
import SectionDialog from './SectionDialog'

const KIND_LABELS = { lectures: 'محاضرات', sections: 'سكاشن', files: 'ملفات' }
const KIND_COLORS = { lectures: 'hsl(160,60%,50%)', sections: 'hsl(280,60%,65%)', files: 'hsl(190,100%,50%)' }

export default function ChapterCard({ chapter, subjectId, index, onEdit, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const kind = chapter.kind || 'lectures'
  const [expanded, setExpanded] = useState(false)
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false)
  const [editingLecture, setEditingLecture] = useState(null)
  const [deletingLecture, setDeletingLecture] = useState(null)
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [deletingSection, setDeletingSection] = useState(null)
  const [lectures, setLectures] = useState([])
  const [lecturesLoading, setLecturesLoading] = useState(false)
  const [sections, setSections] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const { run, busy } = useAsyncGuard()

  const loadLectures = useCallback(async () => {
    setLecturesLoading(true)
    const data = await db.filter('lectures', { chapter_id: chapter.id })
    setLectures(data)
    setLecturesLoading(false)
  }, [chapter.id])

  const loadSections = useCallback(async () => {
    setSectionsLoading(true)
    const data = await db.filter('sections', { chapter_id: chapter.id })
    setSections(data)
    setSectionsLoading(false)
  }, [chapter.id])

  useEffect(() => {
    if (!expanded || kind === 'files') return
    if (kind === 'lectures') loadLectures()
    loadSections()
  }, [expanded, kind, loadLectures, loadSections])

  const handleCreateLecture = (data) =>
    run(async () => {
      await db.create('lectures', { ...data, chapter_id: chapter.id, subject_id: subjectId, order: lectures.length + 1 })
      await loadLectures()
      toast.success('Lecture created')
      setLectureDialogOpen(false)
    })

  const handleUpdateLecture = (data) =>
    run(async () => {
      await db.update('lectures', editingLecture.id, data)
      await loadLectures()
      toast.success('Lecture updated')
      setLectureDialogOpen(false)
      setEditingLecture(null)
    })

  const handleDeleteLecture = () =>
    run(async () => {
      await db.remove('lectures', deletingLecture.id)
      await loadLectures()
      toast.success('Lecture deleted')
      setDeletingLecture(null)
    })

  const handleCreateSection = (data) =>
    run(async () => {
      await db.create('sections', { ...data, chapter_id: chapter.id, subject_id: subjectId, order: sections.length + 1 })
      await loadSections()
      toast.success('Section created')
      setSectionDialogOpen(false)
    })

  const handleUpdateSection = (data) =>
    run(async () => {
      await db.update('sections', editingSection.id, data)
      await loadSections()
      toast.success('Section updated')
      setSectionDialogOpen(false)
      setEditingSection(null)
    })

  const handleDeleteSection = () =>
    run(async () => {
      await db.remove('sections', deletingSection.id)
      await loadSections()
      toast.success('Section deleted')
      setDeletingSection(null)
    })

  const sortedLectures = [...lectures].sort((a, b) => (a.order || 0) - (b.order || 0))
  const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))

  const moveEntry = async (table, list, entry, delta, reload) => {
    const i = list.findIndex((row) => row.id === entry.id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= list.length) return
    await Promise.all([
      db.update(table, list[i].id, { order: j + 1 }),
      db.update(table, list[j].id, { order: i + 1 }),
    ])
    await reload()
  }

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      style={{ borderLeft: '3px solid hsl(190, 100%, 50%)' }}
    >
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
            CH {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-foreground font-semibold">{chapter.title}</h3>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ color: KIND_COLORS[kind], background: 'rgba(255,255,255,0.05)' }}
              >
                {KIND_LABELS[kind]}
              </span>
            </div>
            {chapter.description && (
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{chapter.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp()
              }}
              disabled={!canMoveUp}
              aria-label="تحريك لأعلى"
              className="p-2 text-muted-foreground hover:text-primary min-w-[36px] min-h-[36px] flex items-center justify-center rounded disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <ArrowUp size={13} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              disabled={!canMoveDown}
              aria-label="تحريك لأسفل"
              className="p-2 text-muted-foreground hover:text-primary min-w-[36px] min-h-[36px] flex items-center justify-center rounded disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <ArrowDown size={13} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-2 text-muted-foreground hover:text-primary min-w-[36px] min-h-[36px] flex items-center justify-center rounded"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 text-muted-foreground hover:text-destructive min-w-[36px] min-h-[36px] flex items-center justify-center rounded"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground ml-1" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground ml-1" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 bg-background/30">
          <div className="p-4">
            {kind === 'files' ? (
              <ItemsManager
                active={expanded}
                table="lecture_items"
                chapterId={chapter.id}
                subjectId={subjectId}
                label="الملفات والفيديوهات"
                addLabel="إضافة ملف"
                buttonClassName="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30"
              />
            ) : (
              <>
                {kind === 'lectures' && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground font-medium">Lectures</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingLecture(null)
                          setLectureDialogOpen(true)
                        }}
                        className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 h-7 text-xs px-3"
                      >
                        <Plus size={12} className="mr-1" /> Add Lecture
                      </Button>
                    </div>
                    {lecturesLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((n) => (
                          <Skeleton key={n} className="h-14 bg-muted rounded" />
                        ))}
                      </div>
                    ) : sortedLectures.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No lectures yet</p>
                    ) : (
                      <div className="space-y-2">
                        {sortedLectures.map((lecture, lectureIndex) => (
                          <LectureCard
                            key={lecture.id}
                            lecture={lecture}
                            index={lectureIndex}
                            onEdit={() => {
                              setEditingLecture(lecture)
                              setLectureDialogOpen(true)
                            }}
                            onDelete={() => setDeletingLecture(lecture)}
                            onMoveUp={() => moveEntry('lectures', sortedLectures, lecture, -1, loadLectures)}
                            onMoveDown={() => moveEntry('lectures', sortedLectures, lecture, 1, loadLectures)}
                            canMoveUp={lectureIndex > 0}
                            canMoveDown={lectureIndex < sortedLectures.length - 1}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
                {(kind === 'sections' || sortedSections.length > 0) && (
                  <div className={kind === 'lectures' ? 'mt-5 pt-4 border-t border-border/30' : ''}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground font-medium">Sections</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingSection(null)
                          setSectionDialogOpen(true)
                        }}
                        className="h-7 text-xs px-3 border"
                        style={{
                          background: 'hsla(280,60%,65%,0.15)',
                          color: 'hsl(280,60%,65%)',
                          borderColor: 'hsla(280,60%,65%,0.3)',
                        }}
                      >
                        <Plus size={12} className="mr-1" /> Add Section
                      </Button>
                    </div>
                    {sectionsLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((n) => (
                          <Skeleton key={n} className="h-14 bg-muted rounded" />
                        ))}
                      </div>
                    ) : sortedSections.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-4">No sections yet</p>
                    ) : (
                      <div className="space-y-2">
                        {sortedSections.map((section, sectionIndex) => (
                          <SectionCard
                            key={section.id}
                            section={section}
                            index={sectionIndex}
                            onEdit={() => {
                              setEditingSection(section)
                              setSectionDialogOpen(true)
                            }}
                            onDelete={() => setDeletingSection(section)}
                            onMoveUp={() => moveEntry('sections', sortedSections, section, -1, loadSections)}
                            onMoveDown={() => moveEntry('sections', sortedSections, section, 1, loadSections)}
                            canMoveUp={sectionIndex > 0}
                            canMoveDown={sectionIndex < sortedSections.length - 1}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <LectureDialog
        open={lectureDialogOpen}
        onClose={() => {
          setLectureDialogOpen(false)
          setEditingLecture(null)
        }}
        editing={editingLecture}
        submitting={busy}
        onSubmit={(data) => (editingLecture ? handleUpdateLecture(data) : handleCreateLecture(data))}
      />
      <SectionDialog
        open={sectionDialogOpen}
        onClose={() => {
          setSectionDialogOpen(false)
          setEditingSection(null)
        }}
        editing={editingSection}
        submitting={busy}
        onSubmit={(data) => (editingSection ? handleUpdateSection(data) : handleCreateSection(data))}
      />
      <ConfirmDialog
        open={!!deletingSection}
        onOpenChange={() => setDeletingSection(null)}
        title="Delete Section"
        description={`Are you sure you want to delete "${deletingSection?.title}"?`}
        onConfirm={handleDeleteSection}
        busy={busy}
      />
      <ConfirmDialog
        open={!!deletingLecture}
        onOpenChange={() => setDeletingLecture(null)}
        title="Delete Lecture"
        description={`Are you sure you want to delete "${deletingLecture?.title}"?`}
        onConfirm={handleDeleteLecture}
        busy={busy}
      />
    </div>
  )
}
