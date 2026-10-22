import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  BookOpen,
  FileText,
  Video,
  Image,
  Music,
  FileCode,
  Archive,
  ExternalLink,
  LoaderCircle,
  Filter,
  Search,
  Upload,
  Link2,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';
import { MaterialTypeIcon } from '@/components/material/MaterialTypeIcon';
import { PersonalUploadZone } from '@/components/user/PersonalUploadZone';

interface SearchAndAddDialogProps {
  open: boolean;
  onClose: () => void;
  onAddItems: (items: any[]) => void;
  targetListId?: string;
}

export function SearchAndAddDialog({ open, onClose, onAddItems, targetListId }: SearchAndAddDialogProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'official' | 'personal'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterFileType, setFilterFileType] = useState<string>('');
  const [subjects, setSubjects] = useState<
    Array<{ id: string; name: string; year?: string | null; semester?: string | null }>
  >([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mode, setMode] = useState<'search' | 'upload' | 'link'>('search');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSubjectId, setLinkSubjectId] = useState('');
  const [linkNotes, setLinkNotes] = useState('');

  const PER_PAGE = 20;

  const performSearch = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = (pageNum - 1) * PER_PAGE;
      const formatted: any[] = [];

      if (filterType !== 'personal') {
        let officialQuery = supabase
          .from('lecture_items')
          .select(`
            id,
            title,
            file_type,
            url,
            type,
            subject_id,
            chapter_id,
            lecture_id,
            subjects!inner(name, major, year, semester),
            chapters(title),
            lectures(title)
          `)
          .order('created_date', { ascending: false })
          .range(offset, offset + PER_PAGE - 1);

        if (query.trim()) officialQuery = officialQuery.ilike('title', `%${query}%`);
        if (filterSubject) officialQuery = officialQuery.eq('subject_id', filterSubject);
        if (filterFileType) officialQuery = officialQuery.eq('file_type', filterFileType);

        const { data, error } = await officialQuery;
        if (error) throw error;

        formatted.push(
          ...(data || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            type: 'official',
            file_type: item.file_type,
            url: item.url,
            subject: item.subjects?.name,
            subject_id: item.subject_id,
            year: item.subjects?.year || null,
            semester: item.subjects?.semester || null,
            chapter: item.chapters?.title,
            lecture: item.lectures?.title,
            preview_url: item.url,
          })),
        );
      }

      if (filterType !== 'official' && user) {
        let personalQuery = supabase
          .from('user_personal_files')
          .select('id,title,file_type,file_url,file_size,mime_type,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + PER_PAGE - 1);

        if (query.trim()) personalQuery = personalQuery.ilike('title', `%${query}%`);
        if (filterFileType) personalQuery = personalQuery.eq('file_type', filterFileType);

        const { data, error } = await personalQuery;
        if (error) throw error;

        formatted.push(
          ...(data || []).map((item: any) => ({
            id: item.id,
            title: item.title,
            type: 'personal',
            file_type: item.file_type,
            url: item.file_url,
            file_size: item.file_size,
            subject: 'ملفاتي',
            kind: 'other',
          })),
        );
      }

      setResults(prev => (pageNum === 1 ? formatted : [...prev, ...formatted]));
      setHasMore(formatted.length >= PER_PAGE);
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('تعذر تحميل نتائج البحث');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, filterType, filterSubject, filterFileType, user]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      performSearch(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, filterType, filterSubject, filterFileType]);

  useEffect(() => {
    if (!open) return;
    setMode('search');
    setSelectedItems(new Set());
    setLinkTitle('');
    setLinkUrl('');
    setLinkSubjectId('');
    setLinkNotes('');
    supabase
      .from('subjects')
      .select('id,name,year,semester')
      .order('name')
      .then(({ data }) => setSubjects(data || []));
  }, [open]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage(p => p + 1);
    }
  };

  useEffect(() => {
    if (page > 1) {
      performSearch(page, true);
    }
  }, [page]);

  const toggleItemSelection = (itemId: string) => {
    const next = new Set(selectedItems);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelectedItems(next);
  };

  const selectedSubject = subjects.find((subject) => subject.id === linkSubjectId);

  const handleAddLink = () => {
    const url = linkUrl.trim();
    if (!url) {
      toast.error('أدخل رابطًا صالحًا');
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error('الرابط غير صالح');
      return;
    }
    onAddItems([
      {
        type: 'external',
        id: crypto.randomUUID(),
        title: linkTitle.trim() || url,
        url,
        subject_id: selectedSubject?.id || null,
        year: selectedSubject?.year || null,
        semester: selectedSubject?.semester || null,
        user_notes: linkNotes.trim() || null,
      },
    ]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Search & Add Materials</DialogTitle>
          <DialogDescription>
            Search the catalog and add materials to your list
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
              mode === 'search' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Search className="h-3.5 w-3.5" />
            بحث
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
              mode === 'upload' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            رفع ملف
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors',
              mode === 'link' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Link2 className="h-3.5 w-3.5" />
            إضافة رابط
          </button>
        </div>

        {mode === 'search' && (
        <>
        <div className="flex flex-col h-full">
          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search materials..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-sm"
              />
            </div>
            <Filter className="h-5 w-5 text-muted-foreground self-center mr-2" />
            <Select
              value={filterType}
              onValueChange={(value) =>
                setFilterType(value as 'all' | 'official' | 'personal')
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="official">Official Materials</SelectItem>
                <SelectItem value="personal">My Files</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvancedFilters && 'rotate-180')} />
            Advanced Filters
          </button>

          {showAdvancedFilters && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <Select
                value={filterSubject || 'all'}
                onValueChange={(value) => setFilterSubject(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterFileType || 'all'}
                onValueChange={(value) => setFilterFileType(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="File Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                  <SelectItem value="pptx">PPTX</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                  <SelectItem value="zip">ZIP</SelectItem>
                  <SelectItem value="code">Code (PY, JS, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading && results.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <svg className="h-8 w-8 text-primary animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-4 text-lg">No materials found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <>
              <div className="space-y-2">
                {results.map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      'group flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors',
                      selectedItems.has(item.id) && 'bg-primary/5 border-primary/30'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={e => {
                        const next = new Set(selectedItems);
                        if (e.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        setSelectedItems(next);
                      }}
                      className="h-4 w-4 text-primary border-border rounded"
                    />
                    <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
                      <MaterialTypeIcon
                        fileType={item.file_type}
                        url={item.url}
                        type={item.type}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted text-xs">{item.type}</span>
                        {item.subject && <span>• {item.subject}</span>}
                        {item.chapter && <span>• {item.chapter}</span>}
                        {item.file_type && <span className="px-1.5 py-0.5 rounded bg-muted/50">{item.file_type.toUpperCase()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading more...
                    </>
                  ) : (
                    <>
                      <span>Load more ({results.length} results)</span>
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const items = Array.from(selectedItems).map(id => results.find(r => r.id === id)).filter(Boolean);
              onAddItems(items);
              onClose();
            }}
            disabled={selectedItems.size === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
        </>
        )}

        {mode === 'upload' && (
          <div className="max-h-[62vh] overflow-y-auto px-1">
            <PersonalUploadZone
              onFileUploaded={(file) => {
                onAddItems([{ type: 'personal', ...file }]);
              }}
            />
          </div>
        )}

        {mode === 'link' && (
          <>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">عنوان الرابط</label>
                <Input
                  value={linkTitle}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder="مثال: محاضرة يوتيوب أو ملف درايف"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">الرابط</label>
                <Input
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">المادة</label>
                <select
                  value={linkSubjectId}
                  onChange={(event) => setLinkSubjectId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">بدون مادة محددة</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">ملاحظات</label>
                <Input
                  value={linkNotes}
                  onChange={(event) => setLinkNotes(event.target.value)}
                  placeholder="اختياري"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button onClick={handleAddLink} disabled={!linkUrl.trim()}>
                <Link2 className="ml-2 h-4 w-4" />
                إضافة الرابط
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}