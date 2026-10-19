"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic2, Loader2, Wand2, AlignJustify, RotateCcw, Globe, Sparkles, Film, ArrowRight
} from "lucide-react";
import AudioUploader from "@/components/AudioUploader";
import SegmentEditor from "@/components/SegmentEditor";
import WordOverridePanel from "@/components/WordOverridePanel";
import ExportButton from "@/components/ExportButton";
import { Segment, WordOverride } from "@/types";
import { transcribeAudio } from "@/lib/api";
import { splitByWordCount } from "@/lib/segmentUtils";
import { WHISPER_LANGUAGES } from "@/lib/languages";
import HinglishModal from "@/components/HinglishModal";

type AppState = "idle" | "transcribing" | "editing";
type AppMode = "home" | "audio-srt";

const DEFAULT_MAX_WORDS = 7;

/* ─── Simulated progress bar ──────────────────────────────────────────────── */
function useSimulatedProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setProgress(0);
      // Ease from 0 → ~88 % over ~40 s, then stall until done
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 88) { clearInterval(intervalRef.current!); return p; }
          // Slow down as we approach 88 %
          const step = Math.max(0.3, (88 - p) * 0.025);
          return Math.min(88, p + step);
        });
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const complete = useCallback(() => setProgress(100), []);
  return { progress, complete };
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<AppMode>("home");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<AppState>("idle");
  const [rawSegments, setRawSegments] = useState<Segment[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [wordOverrides, setWordOverrides] = useState<WordOverride[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [maxWordsPerSegment, setMaxWordsPerSegment] = useState<number>(DEFAULT_MAX_WORDS);
  const [language, setLanguage] = useState<string>("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isHinglishModalOpen, setIsHinglishModalOpen] = useState(false);
  const [transcriptionTime, setTranscriptionTime] = useState<number | null>(null); // seconds
  const startTimeRef = useRef<number>(0);

  const { progress, complete } = useSimulatedProgress(state === "transcribing");

  /* Re-split whenever slider or raw segments change */
  useEffect(() => {
    if (rawSegments.length === 0) return;
    setSegments(splitByWordCount(rawSegments, maxWordsPerSegment));
  }, [maxWordsPerSegment, rawSegments]);

  const handleFileSelected = (f: File) => {
    setFile(f || null);
    setRawSegments([]);
    setSegments([]);
    setError(null);
    setState("idle");
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setError(null);
    setTranscriptionTime(null);
    setState("transcribing");
    startTimeRef.current = Date.now();
    try {
      const result = await transcribeAudio(file, language);
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      complete();
      await new Promise((r) => setTimeout(r, 400));
      setTranscriptionTime(elapsed);
      setRawSegments(result.segments);
      setDetectedLanguage(result.language);
      setState("editing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
      setState("idle");
    }
  };

  const handleReset = () => {
    setFile(null);
    setRawSegments([]);
    setSegments([]);
    setWordOverrides([]);
    setError(null);
    setTranscriptionTime(null);
    setDetectedLanguage(null);
    setIsHinglishModalOpen(false);
    setState("idle");
  };

  /* Format seconds → "1m 23s" or "45s" */
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const isTranscribing = state === "transcribing";
  const isEditing = state === "editing";

  return (
    <>
    {/* ═══════════════════════════════════ HOME SCREEN ═══════════════════════════════════ */}
    {mode === "home" && (
      <div className="flex h-screen flex-col overflow-hidden bg-[#080811] text-white">
        {/* Glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/3 h-[600px] w-[600px] rounded-full bg-violet-900/20 blur-[130px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-900/10 blur-[100px]" />
        </div>

        {/* Header */}
        <header className="relative z-10 flex shrink-0 items-center gap-2.5 border-b border-white/[0.06] bg-[#080811]/80 px-6 py-3.5 backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20">
            <Mic2 className="h-4 w-4 text-violet-400" />
          </div>
          <span className="font-bold tracking-tight text-slate-100">
            Neuro<span className="text-violet-400">Caption</span>
          </span>
          <span className="ml-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
            Whisper Large v2
          </span>
        </header>

        {/* Hero */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-12 px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">
              Choose your <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">workflow</span>
            </h1>
            <p className="mt-3 text-slate-500 max-w-md mx-auto">
              Generate accurate captions from any audio or video — completely local, no data leaves your machine.
            </p>
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">

            {/* Audio to SRT card */}
            <button
              onClick={() => setMode("audio-srt")}
              className="group relative flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 text-left transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/5 hover:shadow-xl hover:shadow-violet-900/20 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15 ring-1 ring-violet-500/20 transition-colors group-hover:bg-violet-600/25">
                  <Mic2 className="h-7 w-7 text-violet-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-600 transition-all duration-300 group-hover:text-violet-400 group-hover:translate-x-0.5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Audio to SRT</h2>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                  Upload any audio file and receive a perfectly timestamped SRT subtitle file. Supports 99+ languages.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["MP3", "WAV", "M4A", "FLAC", "OGG"].map((ext) => (
                  <span key={ext} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">{ext}</span>
                ))}
              </div>
            </button>

            {/* CaptionStudio card */}
            <button
              onClick={() => router.push("/caption-studio")}
              className="group relative flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 text-left transition-all duration-300 hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:shadow-xl hover:shadow-cyan-900/20 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600/15 ring-1 ring-cyan-500/20 transition-colors group-hover:bg-cyan-600/25">
                  <Film className="h-7 w-7 text-cyan-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                    New
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600 transition-all duration-300 group-hover:text-cyan-400 group-hover:translate-x-0.5" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Caption Studio</h2>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                  Upload a video, generate captions, pick styles & animations, preview live, and export a captioned MP4 — all in-browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Live Preview", "Custom Styles", "Animations", "MP4 Export"].map((tag) => (
                  <span key={tag} className="rounded-md border border-cyan-500/10 bg-cyan-500/5 px-2 py-0.5 text-[10px] text-cyan-600">{tag}</span>
                ))}
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-700">Powered by Whisper Large v2 · FFmpeg.wasm · Gemini 2.5 Flash</p>
        </div>
      </div>
    )}

    {/* ═══════════════════════════════════ AUDIO TO SRT ═══════════════════════════════════ */}
    {mode === "audio-srt" && (
    /* Full-viewport flex column — no page scroll */
    <div className="flex h-screen flex-col overflow-hidden bg-[#080811] text-white">

      {/* ── Top ambient glow (decorative, pointer-events-none) ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[500px] w-[500px] rounded-full bg-violet-900/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-cyan-900/10 blur-[100px]" />
      </div>

      {/* ── Header bar ── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#080811]/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { handleReset(); setMode("home"); }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <ArrowRight className="h-3 w-3 rotate-180" />
            Home
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20">
            <Mic2 className="h-4 w-4 text-violet-400" />
          </div>
          <span className="font-bold tracking-tight text-slate-100">
            Neuro<span className="text-violet-400">Caption</span>
          </span>
          <span className="ml-2 hidden rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 sm:inline">
            Whisper Large v2
          </span>
          </div>
        </div>

        {isEditing && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            New file
          </button>
        )}
      </header>

      {/* ── Main: two-column layout ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* ═══ LEFT SIDEBAR: Controls ═══ */}
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] bg-white/[0.02] p-5">

          {/* Upload zone */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Audio File
            </p>
            <AudioUploader
              onFileSelected={handleFileSelected}
              selectedFile={file}
              disabled={isTranscribing || isEditing}
            />
          </div>

          {/* Language Selection */}
          {!isEditing && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
                Language
              </p>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Globe className="h-4 w-4 text-slate-500" />
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isTranscribing}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-slate-200 outline-none transition-colors focus:border-violet-500/50 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {WHISPER_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-[#1a1a24] text-slate-200">
                      {lang.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Transcribe button + progress */}
          {!isEditing && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleTranscribe}
                disabled={!file || isTranscribing}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition-all duration-300 hover:from-violet-500 hover:to-cyan-500 hover:shadow-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 transition-transform group-hover:rotate-12 duration-300" />
                    Generate Captions
                  </>
                )}
              </button>

              {/* Animated progress bar */}
              {isTranscribing && (
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    {progress < 88
                      ? `Processing… ${Math.round(progress)}%`
                      : "Almost done…"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-xs font-medium text-red-400">⚠ {error}</p>
              <p className="mt-1 text-[11px] text-red-500/60">
                Make sure backend is running at{" "}
                <code className="font-mono">localhost:8000</code>
              </p>
            </div>
          )}

          {/* Controls — only shown in editing state */}
          {isEditing && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                  <p className="text-xl font-bold text-slate-200">{segments.length}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Segments</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                  <p className="text-xl font-bold text-slate-200">
                    {segments.reduce((a, s) => a + s.text.trim().split(/\s+/).filter(Boolean).length, 0)}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Words</p>
                </div>
              </div>
              {transcriptionTime !== null && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-400">{formatDuration(transcriptionTime)}</p>
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Transcription time</p>
                </div>
              )}

              {/* Words-per-segment slider */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlignJustify className="h-4 w-4 text-violet-400 shrink-0" />
                  <span className="text-sm font-semibold text-slate-200 flex-1">Words / Segment</span>
                  <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-bold text-violet-300">
                    {maxWordsPerSegment === 0 ? "∞" : maxWordsPerSegment}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={maxWordsPerSegment === 0 ? 20 : maxWordsPerSegment}
                  onChange={(e) => setMaxWordsPerSegment(Number(e.target.value))}
                  className="w-full accent-violet-500 cursor-pointer"
                />
                <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
                  <span>1 word</span>
                  <button
                    onClick={() => setMaxWordsPerSegment(0)}
                    className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                      maxWordsPerSegment === 0
                        ? "bg-violet-500/20 text-violet-300"
                        : "text-slate-600 hover:text-violet-400"
                    }`}
                  >
                    No limit
                  </button>
                  <span>20 words</span>
                </div>
              </div>

              {/* Word overrides */}
              <WordOverridePanel overrides={wordOverrides} onChange={setWordOverrides} />

              {/* Convert to Hinglish AI */}
              {detectedLanguage === "hi" && (
                <button
                  onClick={() => setIsHinglishModalOpen(true)}
                  className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 font-semibold text-sm text-violet-300 transition-all duration-300 hover:border-violet-500/50 hover:bg-violet-500/20"
                >
                  <Sparkles className="h-4 w-4" />
                  Convert to Hinglish
                  <span className="absolute -top-2 -right-2 rounded-full border border-violet-500/30 bg-[#080811] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-400">
                    AI Experimental
                  </span>
                </button>
              )}

              {/* Export */}
              <div className="mt-auto pt-2">
                <ExportButton
                  segments={segments}
                  wordOverrides={wordOverrides}
                  disabled={segments.length === 0}
                />
              </div>
            </>
          )}
        </aside>

        {/* ═══ RIGHT PANEL: Segment list or empty state ═══ */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {!isEditing ? (
            /* Empty / idle state */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
              {isTranscribing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="block h-2 w-2 rounded-full bg-violet-400"
                        style={{ animation: `pulse-dot 1s ease-in-out ${i * 0.12}s infinite` }}
                      />
                    ))}
                  </div>
                  <p className="text-lg font-semibold text-violet-300">Processing audio…</p>
                  <p className="max-w-sm text-sm text-slate-500">
                    Whisper is transcribing your audio. This may take a while depending on file length and hardware.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <Mic2 className="h-7 w-7 text-slate-600" />
                  </div>
                  <p className="text-lg font-semibold text-slate-400">No captions yet</p>
                  <p className="max-w-xs text-sm text-slate-600">
                    Upload a Hindi audio file and click{" "}
                    <span className="text-violet-400">Generate Captions</span> to get started.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Segment list — this panel scrolls, nothing else does */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  Captions
                </h2>
                <span className="text-xs text-slate-600">Click any segment to edit text</span>
              </div>
              {/* Scrollable segment list — fixed within the panel */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <SegmentEditor segments={segments} onChange={setSegments} />
              </div>
            </div>
          )}
        </main>
      </div>

      <HinglishModal
        isOpen={isHinglishModalOpen}
        onClose={() => setIsHinglishModalOpen(false)}
        rawSegments={rawSegments}
        maxWordsPerSegment={maxWordsPerSegment}
      />

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { transform: translateY(0);   opacity: 0.4; }
          50%       { transform: translateY(-7px); opacity: 1;   }
        }
      `}</style>
    </div>
    )}
    </>
  );
}
