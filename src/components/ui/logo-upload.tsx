'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Image from 'next/image';

interface LogoUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove: () => void;
  label?: string;
  bucket?: string;
  folder?: string;
  className?: string;
}

export function LogoUpload({
  value,
  onChange,
  onRemove,
  label = "Upload Logo",
  bucket = "logos",
  folder = "logos",
  className = ""
}: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</label>
      
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center group">
          {value ? (
            <>
              <Image 
                src={value} 
                alt="Logo" 
                fill 
                className="object-contain p-2"
                unoptimized // Since it's a Supabase URL, unoptimized is safer or use proper loader
              />
              <button
                type="button"
                onClick={onRemove}
                className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-300">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[8px] font-bold uppercase tracking-tighter">Preview</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept="image/*"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 rounded-xl border-2 hover:border-primary hover:text-primary transition-all text-[10px] font-black uppercase tracking-widest"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-2" />
            )}
            {value ? 'Change' : 'Select File'}
          </Button>
          <p className="text-[9px] text-slate-400 font-medium">PNG, JPG or SVG up to 2MB</p>
        </div>
      </div>
    </div>
  );
}
