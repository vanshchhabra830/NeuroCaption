"use client";

import { useState, useEffect } from "react";
import { Segment } from "@/types";
import { convertHinglish, exportSRT } from "@/lib/api";
import { X, Sparkles, Download, Loader2, Copy, Check } from "lucide-react";
import SegmentEditor from "./SegmentEditor";

import { splitByWordCount } from "@/lib/segmentUtils";

interface HinglishModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawSegments: Segment[];
  maxWordsPerSegment: number;
}

export default function HinglishModal({ isOpen, onClose, rawSegments, maxWordsPerSegment }: HinglishModalProps) {
  const [rawTranslatedSegments, setRawTranslatedSegments] = useState<Segment[]>([]);
  const [translatedSegments, setTranslatedSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && rawTranslatedSegments.length === 0 && !loading && !error) {
      handleConvert();
    }
  }, [isOpen, rawTranslatedSegments.length, loading, error]);

  useEffect(() => {
    if (rawTranslatedSegments.length === 0) return;
    setTranslatedSegments(splitByWordCount(rawTranslatedSegments, maxWordsPerSegment));
  }, [rawTranslatedSegments, maxWordsPerSegment]);

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await convertHinglish(rawSegments);
      setRawTranslatedSegments(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (translatedSegments.length === 0) return;
    setExporting(true);
    try {
      await exportSRT(translatedSegments, {});
    } catch (err) {
      alert("Failed to export: " + err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = () => {
    const text = translatedSegments.map((s) => s.text).join(" ");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-violet-500/30 bg-[#080811] shadow-2xl shadow-violet-900/40">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Hinglish Conversion
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  AI Experimental
                </span>
              </h2>
              <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
                <Sparkles className="h-8 w-8 animate-pulse text-violet-400" />
              </div>
              <p className="text-lg font-medium text-slate-200">Translating to Hinglish…</p>
              <p className="mt-2 text-sm text-slate-500 max-w-sm">
                Gemini is processing your {rawSegments.length} segments. This keeps your exact timeframes perfectly synced.
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
              <p className="text-sm font-medium text-red-400">⚠ {error}</p>
              <button
                onClick={handleConvert}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
              >
                Try Again
              </button>
            </div>
          ) : translatedSegments.length > 0 ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3 text-sm text-emerald-200/90">
                <Check className="h-5 w-5 shrink-0 text-emerald-400" />
                <p>Conversion successful! Your original Hindi captions are safe and untouched. You can edit the Hinglish text below or download it directly as an SRT.</p>
              </div>
              <SegmentEditor segments={translatedSegments} onChange={setTranslatedSegments} />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {translatedSegments.length > 0 && !loading && !error && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/[0.06] bg-[#080811]/80 px-6 py-4 backdrop-blur-md">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy All Text"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-all hover:from-violet-500 hover:to-cyan-500 hover:shadow-violet-900/50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download SRT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
