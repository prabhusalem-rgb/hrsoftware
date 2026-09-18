'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { 
  UploadCloud, 
  FileText, 
  FileCheck, 
  Trash2, 
  ExternalLink, 
  Loader2, 
  Image as ImageIcon,
  File,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  value?: string | null;
  fileName?: string | null;
  onChange: (url: string, name: string) => void;
  onRemove: () => void;
  label?: string;
  description?: string;
  accept?: string;
  maxSizeMB?: number;
  bucket?: string;
  folder?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function FileUpload({
  value,
  fileName,
  onChange,
  onRemove,
  label = 'Supporting Document',
  description = 'Upload PDF, image, or document (up to 10MB)',
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 10,
  bucket = 'attachments',
  folder = 'general',
  disabled = false,
  className = '',
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (name?: string | null, url?: string | null) => {
    const target = (name || url || '').toLowerCase();
    if (target.endsWith('.pdf')) {
      return <FileText className="w-8 h-8 text-rose-500" />;
    }
    if (target.endsWith('.png') || target.endsWith('.jpg') || target.endsWith('.jpeg') || target.endsWith('.webp')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    }
    if (target.endsWith('.doc') || target.endsWith('.docx')) {
      return <FileText className="w-8 h-8 text-indigo-500" />;
    }
    return <File className="w-8 h-8 text-slate-500" />;
  };

  const uploadFileToStorage = async (file: File) => {
    // 1. Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Database client not available');
      }

      const fileExt = file.name.split('.').pop() || 'dat';
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniquePath = `${folder}/${Date.now()}_${cleanFileName}`;

      // First attempt primary bucket ('attachments')
      let uploadResult = await supabase.storage
        .from(bucket)
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      let targetBucket = bucket;

      // Fallback if primary bucket not found or permissions issue
      if (uploadResult.error) {
        console.warn(`Upload to ${bucket} failed, trying fallback bucket 'leave-signatures'...`, uploadResult.error);
        uploadResult = await supabase.storage
          .from('leave-signatures')
          .upload(`attachments_${Date.now()}_${cleanFileName}`, file, {
            cacheControl: '3600',
            upsert: true,
          });
        targetBucket = 'leave-signatures';
      }

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      const uploadedKey = uploadResult.data.path;
      const { data: publicUrlData } = supabase.storage
        .from(targetBucket)
        .getPublicUrl(uploadedKey);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Could not retrieve public URL for uploaded file');
      }

      onChange(publicUrlData.publicUrl, file.name);
      toast.success('Document uploaded successfully');
    } catch (err: any) {
      console.error('File upload error:', err);
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileToStorage(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFileToStorage(file);
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {value && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <FileCheck className="w-3 h-3" /> Attached
            </span>
          )}
        </Label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* When a file is already uploaded */}
      {value ? (
        <div className="p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs shrink-0">
              {getFileIcon(fileName, value)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={fileName || 'Attached Document'}>
                {fileName || 'Attached Document'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Document ready & verified
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1 rounded-lg"
              onClick={() => window.open(value, '_blank')}
              title="Open document in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-destructive hover:bg-red-50 dark:hover:bg-red-950/50 gap-1 rounded-lg"
                onClick={onRemove}
                title="Remove attached file"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Upload dropzone when no file uploaded */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 hover:border-primary/60 hover:bg-slate-50 dark:hover:bg-slate-900/40',
            disabled && 'opacity-50 cursor-not-allowed',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="py-2 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{uploadProgress}</p>
            </div>
          ) : (
            <div className="py-2 flex flex-col items-center justify-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <UploadCloud className="w-5 h-5 text-primary" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-primary hover:underline">Click to browse</span> or drag and drop
              </div>
              {description && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
