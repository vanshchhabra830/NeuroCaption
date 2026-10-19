"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic2, ArrowLeft, Globe, AlignJustify, Wand2, Loader2, RotateCcw, Sparkles, Check } from "lucide-react";
import VideoUploader from "@/components/studio/VideoUploader";
import VideoPreview from "@/components/studio/VideoPreview";
import CaptionStylePanel from "@/components/studio/CaptionStylePanel";
import StudioExportButton from "@/components/studio/StudioExportButton";
import { Segment, CaptionStyle } from "@/types";
import { transcribeAudio, convertHinglish } from "@/lib/api";
import { splitByWordCount } from "@/lib/segmentUtils";
import { WHISPER_LANGUAGES } from "@/lib/languages";
import { DEFAULT_STYLE } from "@/lib/captionStyles";

type StudioState = "upload" | "transcribing" | "editing";

function useSimulatedProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const complete = useCallback(() => setProgress(100), []);

  useEffect(() => {
    if (active) {
      setProgress(0);
      ref.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 88) { clearInterval(ref.current!); return p; }
          return Math.min(88, p + Math.max(0.3, (88 - p) * 0.025));
        });
      }, 300);
    } else {
      if (ref.current) clearInterval(ref.current);
      setProgress(0);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);

  return { progress, complete };
}

// ─── Inline segment editor with active-highlighting ─────────────────────────
function StudioSegmentEditor({
  segments,
  onChange,
  activeSegmentId,
}: {
  segments: Segment[];
  onChange: (segs: Segment[]) => void;
  activeSegmentId: number | null;
}) {
  const activeRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSegmentId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toFixed(1).padStart(4, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {segments.map((seg) => {
        const isActive = seg.id === activeSegmentId;
        const isEditing = seg.id === editingId;
        return (
          <div
            key={seg.id}
            ref={isActive ? activeRef : null}
            className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
              isActive
                ? "border-violet-500/60 bg-violet-500/10 shadow-sm shadow-violet-900/20"
                : "border-white/[0.05] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
            }`}
          >
            {/* Timestamp */}
            <div className="flex flex-col gap-0.5 shrink-0 pt-0.5 w-12">
              <span className={`font-mono text-[10px] ${isActive ? "text-violet-400" : "text-slate-600"}`}>
                {formatTime(seg.start)}
              </span>
              <span className="font-mono text-[10px] text-slate-700">{formatTime(seg.end)}</span>
            </div>

            {/* Pulse dot */}
            {isActive && (
              <span className="block h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse shrink-0 mt-2" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0" onClick={() => setEditingId(seg.id)}>
              {isEditing ? (
                <textarea
                  autoFocus
                  value={seg.text}
                  onChange={(e) =>
                    onChange(segments.map((s) => s.id === seg.id ? { ...s, text: e.target.value } : s))
                  }
                  onBlur={() => setEditingId(null)}
                  rows={2}
                  className="w-full resize-none rounded-lg bg-white/10 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-violet-500/50 focus:ring-violet-400/70"
                />
              ) : (
                <p className={`text-sm leading-snug cursor-text ${isActive ? "text-slate-100" : "text-slate-400"}`}>
                  {seg.text || <span className="italic text-slate-600">empty</span>}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function CaptionStudioPage() {
  const router = useRouter();

  // Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Transcription
  const [state, setState] = useState<StudioState>("upload");
  const [language, setLanguage] = useState("");
  const [maxWords, setMaxWords] = useState(7);
  const [rawSegments, setRawSegments] = useState<Segment[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active segment highlighting
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  // Hinglish (direct replace — no modal in Studio)
  const [hinglishState, setHinglishState] = useState<"idle" | "loading" | "done">("idle");
  const [isHinglish, setIsHinglish] = useState(false); // whether current captions are hinglish
  const originalSegmentsRef = useRef<Segment[]>([]); // backup for revert

  // Style
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_STYLE);

  const { progress, complete } = useSimulatedProgress(state === "transcribing");

  useEffect(() => {
    if (rawSegments.length === 0) return;
    setSegments(splitByWordCount(rawSegments, maxWords));
  }, [maxWords, rawSegments]);

  const handleVideoSelected = (file: File, url: string) => {
    setVideoFile(file);
    setVideoUrl(url);
    setRawSegments([]);
    setSegments([]);
    setDetectedLanguage(null);
    setError(null);
    setIsHinglish(false);
    setHinglishState("idle");
    setState("upload");
  };

  const handleTranscribe = async () => {
    if (!videoFile) return;
    setError(null);
    setState("transcribing");
    try {
      const result = await transcribeAudio(videoFile, language);
      complete();
      await new Promise((r) => setTimeout(r, 400));
      setRawSegments(result.segments);
      setDetectedLanguage(result.language);
      setIsHinglish(false);
      setHinglishState("idle");
      setState("editing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
      setState("upload");
    }
  };

  // In Studio: Hinglish REPLACES segments directly (no modal)
  const handleConvertHinglish = async () => {
    if (hinglishState === "loading") return;
    if (isHinglish) {
      // Revert to original
      setSegments(splitByWordCount(originalSegmentsRef.current, maxWords));
      setIsHinglish(false);
      setHinglishState("idle");
      return;
    }
    setHinglishState("loading");
    try {
      // Use rawSegments (full sentences) for best context, then re-chunk
      const hinglishRaw = await convertHinglish(rawSegments);
      originalSegmentsRef.current = rawSegments; // backup for revert
      setRawSegments(hinglishRaw); // triggers the useEffect → re-chunks with maxWords
      setIsHinglish(true);
      setHinglishState("done");
      setTimeout(() => setHinglishState("idle"), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hinglish conversion failed.");
      setHinglishState("idle");
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setVideoUrl("");
    setRawSegments([]);
    setSegments([]);
    setDetectedLanguage(null);
    setError(null);
    setActiveSegmentId(null);
    setIsHinglish(false);
    setHinglishState("idle");
    setState("upload");
  };

  const isTranscribing = state === "transcribing";
  const isEditing = state === "editing";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080811] text-white">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-900/15 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[400px] rounded-full bg-cyan-900/10 blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#080811]/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Home
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/20">
              <Mic2 className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className="font-bold tracking-tight text-slate-100 text-sm">
              Neuro<span className="text-violet-400">Caption</span>
            </span>
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
              Caption Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hinglish — replaces captions directly */}
          {isEditing && detectedLanguage === "hi" && (
            <button
              onClick={handleConvertHinglish}
              disabled={hinglishState === "loading"}
              className={`group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                isHinglish
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  : "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:border-violet-500/50 hover:bg-violet-500/20"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {hinglishState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : hinglishState === "done" ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isHinglish ? "Revert to Hindi" : hinglishState === "loading" ? "Converting…" : "Convert to Hinglish"}
              {!isHinglish && hinglishState === "idle" && (
                <span className="absolute -top-2 -right-2 rounded-full border border-violet-500/30 bg-[#080811] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-400">
                  AI
                </span>
              )}
            </button>
          )}

          {isEditing && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              New video
            </button>
          )}
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* LEFT: Controls */}
        <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] bg-white/[0.02] p-4" style={{ width: "17rem" }}>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Video File</p>
            <VideoUploader onFileSelected={handleVideoSelected} selectedFile={videoFile} disabled={isTranscribing} />
          </div>

          {!isEditing && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Language</p>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Globe className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isTranscribing}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-slate-200 outline-none focus:border-violet-500/50 disabled:opacity-50"
                >
                  {WHISPER_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#1a1a24]">{l.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {!isEditing && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleTranscribe}
                disabled={!videoFile || isTranscribing}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-all duration-300 hover:from-violet-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTranscribing
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Transcribing…</>
                  : <><Wand2 className="h-4 w-4 transition-transform group-hover:rotate-12 duration-300" />Generate Captions</>
                }
              </button>
              {isTranscribing && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-center text-[10px] text-slate-500">{progress < 88 ? `Processing… ${Math.round(progress)}%` : "Almost done…"}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <p className="text-xs font-medium text-red-400">⚠ {error}</p>
            </div>
          )}

          {isEditing && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlignJustify className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-slate-200 flex-1">Words / Segment</span>
                <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                  {maxWords === 0 ? "∞" : maxWords}
                </span>
              </div>
              <input type="range" min={1} max={20} value={maxWords === 0 ? 20 : maxWords} onChange={(e) => setMaxWords(Number(e.target.value))} className="w-full accent-violet-500" />
            </div>
          )}

          {isEditing && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
                <p className="text-lg font-bold text-slate-200">{segments.length}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">Segments</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
                <p className="text-lg font-bold text-slate-200">
                  {segments.reduce((a, s) => a + s.text.trim().split(/\s+/).filter(Boolean).length, 0)}
                </p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">Words</p>
              </div>
            </div>
          )}

          {isEditing && videoFile && (
            <div className="mt-auto">
              <StudioExportButton videoFile={videoFile} segments={segments} captionStyle={captionStyle} />
            </div>
          )}
        </aside>

        {/* ── EDITING MODE: 3-pane split ── */}
        {isEditing && videoUrl ? (
          <>
            {/* CENTRE-LEFT: Full-height segment editor */}
            <div className="flex flex-col min-h-0 border-r border-white/[0.06]" style={{ width: "22rem" }}>
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Captions</h2>
                  {activeSegmentId !== null && (
                    <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-400">
                      <span className="h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
                      #{activeSegmentId}
                    </span>
                  )}
                  {isHinglish && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                      Hinglish
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-600">Click to edit</span>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <StudioSegmentEditor segments={segments} onChange={setSegments} activeSegmentId={activeSegmentId} />
              </div>
            </div>

            {/* CENTRE-RIGHT: Video preview — must be overflow-hidden so VideoPreview's flex-1 h-full resolves */}
            <main className="flex flex-1 overflow-hidden p-4">
              <VideoPreview
                videoUrl={videoUrl}
                segments={segments}
                captionStyle={captionStyle}
                videoRef={videoRef}
                onActiveSegmentChange={setActiveSegmentId}
              />
            </main>
          </>
        ) : (
          /* IDLE / TRANSCRIBING empty state */
          <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            {isTranscribing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="block h-2 w-2 rounded-full bg-violet-400"
                      style={{ animation: `pulse-dot 1s ease-in-out ${i * 0.12}s infinite` }} />
                  ))}
                </div>
                <p className="text-lg font-semibold text-violet-300">Transcribing video…</p>
                <p className="max-w-xs text-sm text-slate-500">Whisper is processing the audio track.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <Wand2 className="h-9 w-9 text-slate-600" />
                </div>
                <p className="text-lg font-semibold text-slate-400">{videoFile ? "Ready to transcribe" : "Upload a video to start"}</p>
                <p className="max-w-xs text-sm text-slate-600">
                  {videoFile ? "Click Generate Captions to analyse the audio track." : "Drop your video file in the panel on the left."}
                </p>
              </div>
            )}
          </main>
        )}

        {/* RIGHT: Style panel — always visible */}
        {/* overflow-hidden was killing scroll — removed. min-h-0 prevents flex blowout */}
        <aside className="flex w-64 shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.02] p-4 min-h-0">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 shrink-0">Caption Style</p>
          <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
            <CaptionStylePanel style={captionStyle} onChange={setCaptionStyle} />
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-7px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
