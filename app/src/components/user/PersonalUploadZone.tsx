import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  File,
  X,
  LoaderCircle,
  CheckCircle,
  AlertCircle,
  Trash2,
  Eye,
  Share2,
  Globe,
} from 'lucide-react';
import { usePersonalFiles } from '@/hooks/usePersonalFiles';
import { useStorageUsage } from '@/hooks/useStorageUsage';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';

interface PersonalUploadZoneProps {
  className?: string;
  onFileUploaded?: (file: any) => void;
  refreshKey?: number;
}

export function PersonalUploadZone({ className, onFileUploaded, refreshKey = 0 }: PersonalUploadZoneProps) {
  const { user } = useAuth();
  const { uploadFile, uploading, uploadProgress } = usePersonalFiles();
  const { usage, refresh: refreshUsage } = useStorageUsage();

  useEffect(() => {
    refreshUsage();
  }, [refreshKey, refreshUsage]);

  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
    result?: any;
  }>>([]);

  useEffect(() => {
    if (uploadedFiles.length === 0) return undefined;
    if (!uploadedFiles.every((file) => file.status === 'completed')) return undefined;
    const timer = setTimeout(() => setUploadedFiles([]), 2500);
    return () => clearTimeout(timer);
  }, [uploadedFiles]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const id = crypto.randomUUID();
      setUploadedFiles(prev => [...prev, {
        id,
        file,
        progress: 0,
        status: 'pending',
      }]);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    multiple: true,
  });

  const uploadFiles = async () => {

    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    for (const upload of pendingFiles) {
      try {
        setUploadedFiles(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'uploading' } : u));

        const result = await uploadFile(upload.file, {
          onProgress: (progress) => {
            setUploadedFiles(prev => prev.map(u =>
              u.id === upload.id ? { ...u, progress } : u
            ));
          },
        });

        if (result) {
          setUploadedFiles(prev => prev.map(u =>
            u.id === upload.id ? { ...u, status: 'completed', progress: 100, result } : u
          ));
          onFileUploaded?.(result);
          toast.success(`${upload.file.name} uploaded successfully`);
          await refreshUsage();
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        setUploadedFiles(prev => prev.map(u =>
          u.id === upload.id ? { ...u, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : u
        ));
      }
    }
  };

  const removeUpload = (id: string) => {
    setUploadedFiles(prev => prev.filter(u => u.id !== id));
  };

  const retryUpload = (id: string) => {
    setUploadedFiles(prev => prev.map(u => u.id === id ? { ...u, status: 'pending', error: undefined, progress: 0 } : u));
  };

  if (!user) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-muted-foreground">Please sign in to upload files</p>
      </div>
    );
  }

  const hasPendingUploads = uploadedFiles.some(f => f.status === 'pending' || f.status === 'uploading');

  return (
    <div className={cn('space-y-6', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-border hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-3 text-lg text-foreground">
          Drag & drop files here, or click to browse
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          PDF, HTML, DOCX, PPTX, DOC, PPT, XLSX, Images, ZIP, RAR, 7Z, MP4, MP3, PY, TXT, MD, CSV, JSON
          <br />
          Max size: 90MB per file
        </p>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          الملفات المرفوعة هنا مواد دراسة عامة. لا ترفع إيميلات أو بيانات شخصية.
        </p>
      </div>

      {usage && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">مساحة الملفات المستخدمة</span>
            <span className="font-medium text-foreground">
              {formatBytes(usage.userUsedBytes + usage.userReservedBytes)} / {formatBytes(usage.userLimitBytes)}
            </span>
          </div>
          <Progress
            value={usage.userLimitBytes > 0 ? Math.min(100, Math.round(((usage.userUsedBytes + usage.userReservedBytes) / usage.userLimitBytes) * 100)) : 0}
            className="h-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            هذا الشهر: {formatBytes(usage.monthlyUploadedBytes)} من {formatBytes(usage.monthlyLimitBytes)}
          </p>
        </div>
      )}

      {/* Upload Queue */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Upload Queue</h3>
          <div className="space-y-2">
            {uploadedFiles.map(upload => (
              <div
                key={upload.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <File className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(upload.file.size)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress
                      value={upload.progress}
                      className="flex-1 h-2"
                    />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {upload.progress}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {upload.status === 'uploading' && (
                    <LoaderCircle className="h-5 w-5 text-primary animate-spin" />
                  )}
                  {upload.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {upload.status === 'pending' && (
                    <button
                      onClick={() => removeUpload(upload.id)}
                      className="p-1 text-muted-foreground hover:text-red-500 rounded hover:bg-accent"
                      title="Cancel"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {upload.status === 'error' && (
                    <>
                      <button
                        onClick={() => retryUpload(upload.id)}
                        className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-accent"
                        title="Retry"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeUpload(upload.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 rounded hover:bg-accent"
                        title="Remove"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {uploadedFiles.some(f => f.status === 'pending') && (
        <Button
          onClick={uploadFiles}
          className="w-full"
          size="lg"
        >
          Upload All Files
        </Button>
      )}

      {/* Stats */}
      {uploadedFiles.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {uploadedFiles.filter(f => f.status === 'completed').length} / {uploadedFiles.length} uploaded
          </span>
          <span className="flex-1" />
          <span>{uploadedFiles.filter(f => f.status === 'error').length} failed</span>
        </div>
      )}
    </div>
  );
}
