"use client";

import { Segment } from "@/types";
import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface SegmentEditorProps {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export default function SegmentEditor({ segments, onChange }: SegmentEditorProps) {
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    textareaRefs.current.forEach((el) => { if (el) autoResize(el); });
  }, [segments]);

  const updateText = (idx: number, text: string) => {
    onChange(segments.map((seg, i) => (i === idx ? { ...seg, text } : seg)));
  };

  if (segments.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {segments.map((seg, idx) => (
        <div
          key={seg.id}
          className="group relative rounded-xl border border-white/[0.07] bg-white/[0.04] p-4 transition-all duration-200 hover:border-violet-500/30 hover:bg-white/[0.07]"
        >
          <span className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white shadow-lg shadow-violet-900/50">
            {seg.id}
          </span>

          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            <span className="font-mono text-slate-400">{formatTime(seg.start)}</span>
            <span className="text-slate-600">→</span>
            <span className="font-mono text-slate-400">{formatTime(seg.end)}</span>
            <span className="ml-auto text-slate-600">{(seg.end - seg.start).toFixed(1)}s</span>
          </div>

          <textarea
            ref={(el) => { textareaRefs.current[idx] = el; }}
            value={seg.text}
            onChange={(e) => { updateText(idx, e.target.value); autoResize(e.target); }}
            onFocus={(e) => autoResize(e.target)}
            rows={1}
            dir="auto"
            className="w-full resize-none bg-transparent text-base leading-relaxed text-slate-100 outline-none placeholder:text-slate-600 focus:text-white"
            placeholder="Caption text…"
            style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}
          />
        </div>
      ))}
    </div>
  );
}
