import { useState } from 'react';
import {
  Download,
  FileText,
  Check,
  X,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Table,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ExportListDialogProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
  listItems: any[];
  onExport: (format: string, options: ExportOptions) => void;
}

type ExportFormat = 'json' | 'csv' | 'md';

interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeFileUrls: boolean;
  includeDescriptions: boolean;
  includeFileSizes: boolean;
  filterByType?: string[];
  dateRange?: { from: Date; to: Date };
}

export function ExportListDialog({ open, onClose, listId, listName, listItems, onExport }: ExportListDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeFileUrls, setIncludeFileUrls] = useState(true);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeFileSizes, setIncludeFileSizes] = useState(true);
  const [filterByType, setFilterByType] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    const options: ExportOptions = {
      format,
      includeMetadata,
      includeFileUrls,
      includeDescriptions,
      includeFileSizes,
      filterByType: filterByType.length > 0 ? filterByType : undefined,
    };
    onExport(format, options);
    onClose();
  };

  const filteredItems = listItems.filter(item => {
    if (filterByType.length === 0) return true;
    const type = item.content_type || 'unknown';
    return filterByType.includes(type);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Export "{listName}"</DialogTitle>
          <DialogDescription>
            Choose export format and options for your list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'json', label: 'JSON', icon: Database, desc: 'Structured data' },
                { value: 'csv', label: 'CSV', icon: Table, desc: 'Spreadsheet compatible' },
                { value: 'md', label: 'Markdown', icon: FileText, desc: 'Documentation' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className="relative flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    className="sr-only peer"
                  />
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <opt.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium peer-checked:text-primary">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Content Options */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-sm font-medium">Content to Include</label>
            <div className="space-y-2">
              {[
                { key: 'includeMetadata', label: 'Metadata (dates, IDs, etc.)', value: includeMetadata, set: setIncludeMetadata },
                { key: 'includeFileUrls', label: 'File URLs', value: includeFileUrls, set: setIncludeFileUrls },
                { key: 'includeDescriptions', label: 'Descriptions & Notes', value: includeDescriptions, set: setIncludeDescriptions },
                { key: 'includeFileSizes', label: 'File Sizes', value: includeFileSizes, set: setIncludeFileSizes },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={e => opt.set(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filter by Type */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-sm font-medium">Filter by Content Type</label>
            <div className="flex flex-wrap gap-2">
              {['official', 'personal', 'external'].map(type => (
                <label
                  key={type}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filterByType.includes(type)}
                    onChange={e => setFilterByType(prev =>
                      e.target.checked ? [...prev, type] : prev.filter(t => t !== type)
                    )}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-sm font-medium">Date Range (Optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm"
                placeholder="From"
              />
              <input
                type="date"
                className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm"
                placeholder="To"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export as {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}