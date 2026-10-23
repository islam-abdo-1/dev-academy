import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  FolderOpen,
  Edit,
  Trash2,
  Share2,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  MoreVertical,
} from 'lucide-react';
import { useSavedLists } from '@/hooks/useSavedLists';
import { useAuth } from '@/lib/AuthContext';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SavedListsSidebarProps {
  className?: string;
  onSelectList?: (listId: string | null) => void;
  onShareList?: (listId: string) => void;
}

export function SavedListsSidebar({ className, onSelectList, onShareList }: SavedListsSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lists, loading, error, createList, updateList, deleteList, refresh } = useSavedLists();
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const list = await createList(newListName.trim(), newListDescription.trim() || undefined);
    if (list) {
      toast.success('List created successfully');
      setCreatingList(false);
      setNewListName('');
      setNewListDescription('');
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list? All items in it will be removed.')) return;

    const ok = await deleteList(listId);
    if (ok) {
      toast.success('List deleted');
      if (expandedListId === listId) setExpandedListId(null);
      onSelectList?.(null);
    } else {
      toast.error('Failed to delete list');
    }
  };

  const toggleExpand = (listId: string) => {
    setExpandedListId(prev => prev === listId ? null : listId);
  };

  const handleShareList = (listId: string) => {
    onShareList?.(listId);
  };

  const handleEditList = async (listId: string) => {
    const list = lists.find(item => item.id === listId);
    if (!list) return;
    const name = prompt('List name', list.name)?.trim();
    if (!name || name === list.name) return;
    const ok = await updateList(listId, { name });
    if (ok) toast.success('List renamed');
    else toast.error('Failed to rename list');
  };

  if (!user) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to create and manage saved lists
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-foreground">My Saved Lists</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCreatingList(true)}
          className="h-8 px-3"
        >
          <Plus className="h-4 w-4 mr-1" />
          New List
        </Button>
      </div>

      {/* Create List Dialog */}
      <Dialog open={creatingList} onOpenChange={setCreatingList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>Give your list a name and optional description</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateList}>
            <div className="space-y-4 py-4">
              <Input
                placeholder="List name"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={newListDescription}
                onChange={e => setNewListDescription(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background text-foreground resize-none"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingList(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newListName.trim()}>
                Create List
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading lists...
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-destructive">تعذر تحميل القوائم</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : lists.length === 0 ? (
          <div className="p-4 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No saved lists yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Create your first list to save materials
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {lists.map(list => (
              <li key={list.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex flex-1 items-center gap-2 rounded-lg p-2 text-left hover:bg-primary/10 transition-colors cursor-pointer"
                    onClick={() => {
                      toggleExpand(list.id);
                      onSelectList?.(list.id);
                    }}
                  >
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        expandedListId === list.id ? 'rotate-180' : ''
                      )}
                    />
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground truncate flex-1">
                      {list.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {list.items?.length || 0}
                    </span>
                    {list.is_public && (
                      <span title="Public list">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-1 rounded hover:bg-accent">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEditList(list.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareList(list.id)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingListId(list.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded items */}
                {expandedListId === list.id && (
                  <div className="ml-6 mt-2 space-y-1 border-l-2 border-border/50 pl-3">
                    {list.items && list.items.length > 0 ? (
                      list.items.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1 rounded hover:bg-accent cursor-pointer"
                          onClick={() => {
                            // Navigate to item
                          }}
                        >
                          <span className="text-xs text-muted-foreground/50">{index + 1}.</span>
                          <span className="truncate flex-1">
                            {item.title ||
                              item.official_material?.title ||
                              item.personal_file?.title ||
                              item.external_url ||
                              'Untitled'}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {item.kind || 'item'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground/70 py-2">
                        No items in this list yet
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => onSelectList?.(list.id)}
                    >
                      عرض كل العناصر
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}