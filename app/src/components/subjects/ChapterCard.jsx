import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Layers, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/api'
import ConfirmDialog from './ConfirmDialog'
import LectureCard from './LectureCard'
import LectureDialog from './LectureDialog'
import SectionCard from './SectionCard'
import SectionDialog from './SectionDialog'

export default function ChapterCard({ chapter, subjectId, index, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('lectures')
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
    if (expanded) loadLectures()
  }, [expanded, loadLectures])

  useEffect(() => {
    if (expanded && activeTab === 'sections') loadSections()
  }, [expanded, activeTab, loadSections])

  const handleCreateLecture = async (data) => {
    await db.create('lectures', { ...data, chapter_id: chapter.id, subject_id: subjectId, order: lectures.length + 1 })
    await loadLectures()
    toast.success('Lecture created')
    setLectureDialogOpen(false)
  }

  const handleUpdateLecture = async (data) => {
    await db.update('lectures', editingLecture.id, data)
    await loadLectures()
    toast.success('Lecture updated')
    setLectureDialogOpen(false)
    setEditingLecture(null)
  }

  const handleDeleteLecture = async () => {
    await db.remove('lectures', deletingLecture.id)
    await loadLectures()
    toast.success('Lecture deleted')
    setDeletingLecture(null)
  }

  const handleCreateSection = async (data) => {
    await db.create('sections', { ...data, chapter_id: chapter.id, subject_id: subjectId, order: sections.length + 1 })
    await loadSections()
    toast.success('Section created')
    setSectionDialogOpen(false)
  }

  const handleUpdateSection = async (data) => {
    await db.update('sections', editingSection.id, data)
    await loadSections()
    toast.success('Section updated')
    setSectionDialogOpen(false)
    setEditingSection(null)
  }

  const handleDeleteSection = async () => {
    await db.remove('sections', deletingSection.id)
    await loadSections()
    toast.success('Section deleted')
    setDeletingSection(null)
  }

  const sortedLectures = [...lectures].sort((a, b) => (a.order || 0) - (b.order || 0))
  const sortedSections = [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))

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
            <h3 className="text-foreground font-semibold">{chapter.title}</h3>
            {chapter.description && (
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{chapter.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
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
          <div className="flex border-b border-border/30">
            <button
              onClick={() => setActiveTab('lectures')}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
              style={{
                color: activeTab === 'lectures' ? 'hsl(190,100%,50%)' : 'hsl(215,20%,55%)',
                borderBottom: activeTab === 'lectures' ? '2px solid hsl(190,100%,50%)' : '2px solid transparent',
              }}
            >
              <Video size={12} /> Lectures
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
              style={{
                color: activeTab === 'sections' ? 'hsl(280,60%,65%)' : 'hsl(215,20%,55%)',
                borderBottom: activeTab === 'sections' ? '2px solid hsl(280,60%,65%)' : '2px solid transparent',
              }}
            >
              <Layers size={12} /> Sections
            </button>
          </div>
          <div className="p-4">
            {activeTab === 'lectures' && (
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
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === 'sections' && (
              <>
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
                      />
                    ))}
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
        onSubmit={(data) => (editingLecture ? handleUpdateLecture(data) : handleCreateLecture(data))}
      />
      <SectionDialog
        open={sectionDialogOpen}
        onClose={() => {
          setSectionDialogOpen(false)
          setEditingSection(null)
        }}
        editing={editingSection}
        onSubmit={(data) => (editingSection ? handleUpdateSection(data) : handleCreateSection(data))}
      />
      <ConfirmDialog
        open={!!deletingSection}
        onOpenChange={() => setDeletingSection(null)}
        title="Delete Section"
        description={`Are you sure you want to delete "${deletingSection?.title}"?`}
        onConfirm={handleDeleteSection}
      />
      <ConfirmDialog
        open={!!deletingLecture}
        onOpenChange={() => setDeletingLecture(null)}
        title="Delete Lecture"
        description={`Are you sure you want to delete "${deletingLecture?.title}"?`}
        onConfirm={handleDeleteLecture}
      />
    </div>
  )
}
