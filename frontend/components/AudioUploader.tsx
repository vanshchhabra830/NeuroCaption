"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, X, FileAudio } from "lucide-react";

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".m4a"];
const MAX_BYTES = 500 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioUploader({
  onFileSelected,
  selectedFile,
  disabled,
}: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    const extOk = ACCEPTED_EXTENSIONS.some((e) => file.name.toLowerCase().endsWith(e));
    if (!extOk) return `Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(", ")}.`;
    if (file.size > MAX_BYTES) return "File exceeds 500 MB limit.";
    if (file.size === 0) return "File is empty.";
    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) { setError(err); return; }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearFile = () => {
    setError(null);
    onFileSelected(null as unknown as File);
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`
            relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center
            transition-all duration-300 cursor-pointer select-none
            ${isDragging
              ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
              : "border-white/10 bg-white/5 hover:border-violet-500/50 hover:bg-white/[0.07]"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <div className={`rounded-full p-4 transition-all duration-300 ${isDragging ? "bg-violet-500/20" : "bg-white/5"}`}>
            <UploadCloud className={`h-10 w-10 transition-colors duration-300 ${isDragging ? "text-violet-400" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-200">
              {isDragging ? "Drop it here!" : "Drag & drop your audio file"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or <span className="text-violet-400 hover:text-violet-300 transition-colors">click to browse</span>
            </p>
            <p className="mt-3 text-xs text-slate-600">.mp3 · .wav · .m4a · max 500 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
            <FileAudio className="h-6 w-6 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-slate-200">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
          </div>
          {!disabled && (
            <button
              onClick={clearFile}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">⚠ {error}</p>}
    </div>
  );
}
