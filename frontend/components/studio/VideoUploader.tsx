"use client";

import { useRef, useState, useCallback } from "react";
import { Film, Upload } from "lucide-react";

interface VideoUploaderProps {
  onFileSelected: (file: File, objectUrl: string) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

export default function VideoUploader({ onFileSelected, selectedFile, disabled }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) {
        alert("Please select a video file (MP4, MOV, MKV, WebM).");
        return;
      }
      const url = URL.createObjectURL(file);
      onFileSelected(file, url);
    },
    [onFileSelected]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer select-none ${
        disabled
          ? "cursor-not-allowed opacity-50 border-white/10"
          : dragging
          ? "border-violet-400/60 bg-violet-500/10 scale-[1.01]"
          : selectedFile
          ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/8"
          : "border-white/10 bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/5"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
        selectedFile ? "bg-emerald-500/15" : "bg-white/[0.06]"
      }`}>
        <Film className={`h-7 w-7 ${selectedFile ? "text-emerald-400" : "text-slate-500"}`} />
      </div>

      {selectedFile ? (
        <>
          <p className="text-sm font-semibold text-emerald-300 max-w-[200px] truncate">{selectedFile.name}</p>
          <p className="text-xs text-slate-500">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB · Click to replace
          </p>
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold text-slate-300">Drop video here</p>
            <p className="text-xs text-slate-500 mt-1">MP4, MOV, MKV, WebM</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
            <Upload className="h-3 w-3" />
            Browse file
          </div>
        </>
      )}
    </div>
  );
}
