import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Breadcrumb from '@/components/subjects/Breadcrumb'
import ChapterCard from '@/components/subjects/ChapterCard'
import ChapterDialog from '@/components/subjects/ChapterDialog'
import ConfirmDialog from '@/components/subjects/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/api'

export default function SubjectDetail() {
  const { subjectId } = useParams()
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false)
  const [editingChapter, setEditingChapter] = useState(null)
  const [deletingChapter, setDeletingChapter] = useState(null)
  const [subject, setSubject] = useState(null)
  const [subjectLoading, setSubjectLoading] = useState(true)
  const [chapters, setChapters] = useState([])
  const [chaptersLoading, setChaptersLoading] = useState(true)

  const loadSubject = useCallback(async () => {
    if (!subjectId) return
    setSubjectLoading(true)
    const data = await db.get('subjects', subjectId)
    setSubject(data)
    setSubjectLoading(false)
  }, [subjectId])

  const loadChapters = useCallback(async () => {
    if (!subjectId) return
    setChaptersLoading(true)
    const data = await db.filter('chapters', { subject_id: subjectId })
    setChapters(data)
    setChaptersLoading(false)
  }, [subjectId])

  useEffect(() => {
    loadSubject()
  }, [loadSubject])

  useEffect(() => {
    loadChapters()
  }, [loadChapters])

  const handleCreateChapter = async (data) => {
    await db.create('chapters', { ...data, subject_id: subjectId, order: chapters.length + 1 })
    await loadChapters()
    toast.success('Chapter created')
    setChapterDialogOpen(false)
  }

  const handleUpdateChapter = async (data) => {
    await db.update('chapters', editingChapter.id, data)
    await loadChapters()
    toast.success('Chapter updated')
    setChapterDialogOpen(false)
    setEditingChapter(null)
  }

  const handleDeleteChapter = async () => {
    await db.remove('chapters', deletingChapter.id)
    await loadChapters()
    toast.success('Chapter deleted')
    setDeletingChapter(null)
  }

  const handleAddChapter = () => {
    setEditingChapter(null)
    setChapterDialogOpen(true)
  }

  const sortedChapters = [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0))

  if (subjectLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Subjects', href: '/dashboard/subjects' },
          { label: subject?.name || '...' },
        ]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{subject?.name}</h1>
          {subject?.description && <p className="text-muted-foreground mt-1">{subject.description}</p>}
        </div>
        <Button onClick={handleAddChapter} className="bg-primary text-primary-foreground hover:brightness-110">
          <Plus size={18} className="mr-2" /> Add Chapter
        </Button>
      </div>
      {chaptersLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : sortedChapters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p>No chapters yet. Add your first chapter!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedChapters.map((chapter, index) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              subjectId={subjectId}
              index={index}
              onEdit={() => {
                setEditingChapter(chapter)
                setChapterDialogOpen(true)
              }}
              onDelete={() => setDeletingChapter(chapter)}
            />
          ))}
        </div>
      )}
      <ChapterDialog
        open={chapterDialogOpen}
        onClose={() => {
          setChapterDialogOpen(false)
          setEditingChapter(null)
        }}
        editing={editingChapter}
        onSubmit={(data) => (editingChapter ? handleUpdateChapter(data) : handleCreateChapter(data))}
      />
      <ConfirmDialog
        open={!!deletingChapter}
        onOpenChange={() => setDeletingChapter(null)}
        title="Delete Chapter"
        description={`Are you sure you want to delete "${deletingChapter?.title}"?`}
        onConfirm={handleDeleteChapter}
      />
    </div>
  )
}
