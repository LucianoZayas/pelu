'use client';

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  onFileReady: (file: File) => void;
  isPending?: boolean;
  /** Reset to initial state externally (e.g., after successful parse + redirect). */
  fileNameDisplay?: string;
}

export function DropzoneXlsx({ onFileReady, isPending = false, fileNameDisplay }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = (f: File): string | null => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) return 'El archivo debe ser .xlsx (Excel moderno).';
    if (f.size > MAX_BYTES) return `El archivo supera 5 MB (pesa ${(f.size / 1024 / 1024).toFixed(1)} MB).`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); return; }
    setError(null);
    setFile(f);
    onFileReady(f);
  };

  const displayName = fileNameDisplay ?? file?.name;
  const displaySize = file ? (file.size / 1024).toFixed(0) + ' KB' : null;

  return (
    <div className="w-full">
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        {displayName ? (
          <>
            <FileSpreadsheet className="size-10 text-primary" aria-hidden />
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted-foreground">
              {displaySize ? `${displaySize} · ` : ''}{isPending ? 'Analizando…' : 'Listo'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFile(null); setError(null); if (inputRef.current) inputRef.current.value = ''; }}
              disabled={isPending}
            >
              <X className="size-4" aria-hidden /> Quitar
            </Button>
          </>
        ) : (
          <>
            <Upload className="size-10 text-muted-foreground" aria-hidden />
            <div className="text-base font-medium">Arrastrá un Excel acá</div>
            <div className="text-sm text-muted-foreground">o</div>
            <Button onClick={() => inputRef.current?.click()}>Seleccionar archivo</Button>
            <div className="text-xs text-muted-foreground">.xlsx · hasta 5 MB</div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
