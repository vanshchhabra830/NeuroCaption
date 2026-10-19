"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Segment, WordOverride } from "@/types";
import { exportSRT } from "@/lib/api";

interface ExportButtonProps {
  segments: Segment[];
  wordOverrides: WordOverride[];
  disabled?: boolean;
}

export default function ExportButton({ segments, wordOverrides, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const overrideMap = Object.fromEntries(
        wordOverrides
          .filter((o) => o.original.trim() && o.replacement.trim())
          .map((o) => [o.original.trim(), o.replacement.trim()])
      );
      await exportSRT(segments, overrideMap);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleExport}
        disabled={disabled || loading}
        className={`
          group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 font-semibold text-sm
          transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50
          ${success
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/40"
            : "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-cyan-500 hover:shadow-violet-900/50 hover:-translate-y-0.5 active:translate-y-0"
          }
        `}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : success ? (
          <>✓ Downloaded!</>
        ) : (
          <>
            <Download className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
            Export SRT
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  );
}
