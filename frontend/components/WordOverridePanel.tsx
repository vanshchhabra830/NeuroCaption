"use client";

import { WordOverride } from "@/types";
import { useState } from "react";
import { ChevronDown, Plus, Trash2, BookOpen } from "lucide-react";

interface WordOverridePanelProps {
  overrides: WordOverride[];
  onChange: (overrides: WordOverride[]) => void;
}

export default function WordOverridePanel({ overrides, onChange }: WordOverridePanelProps) {
  const [open, setOpen] = useState(false);

  const addEntry = () => {
    onChange([...overrides, { id: crypto.randomUUID(), original: "", replacement: "" }]);
    setOpen(true);
  };

  const updateEntry = (id: string, field: "original" | "replacement", value: string) => {
    onChange(overrides.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const removeEntry = (id: string) => onChange(overrides.filter((o) => o.id !== id));

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
          <BookOpen className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-200">Word Override Dictionary</p>
          <p className="text-xs text-slate-500">
            {overrides.length === 0
              ? "No overrides set"
              : `${overrides.length} override${overrides.length > 1 ? "s" : ""} active`}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/[0.07] px-5 py-4">
          {overrides.length === 0 ? (
            <p className="mb-4 text-sm text-slate-500">
              Add replacements applied before export. e.g.{" "}
              <span className="font-mono text-cyan-400">है → हैं</span>
            </p>
          ) : (
            <div className="mb-3 flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 px-1 text-xs text-slate-600 mb-1">
                <span>Original</span>
                <span />
                <span>Replacement</span>
                <span />
              </div>
              {overrides.map((o) => (
                <div key={o.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <input
                    value={o.original}
                    onChange={(e) => updateEntry(o.id, "original", e.target.value)}
                    placeholder="है"
                    dir="auto"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/50 transition-colors"
                    style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}
                  />
                  <span className="text-slate-500 text-sm">→</span>
                  <input
                    value={o.replacement}
                    onChange={(e) => updateEntry(o.id, "replacement", e.target.value)}
                    placeholder="हैं"
                    dir="auto"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/50 transition-colors"
                    style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}
                  />
                  <button
                    onClick={() => removeEntry(o.id)}
                    className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addEntry}
            className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-4 py-2 text-sm text-slate-500 transition-colors hover:border-cyan-500/40 hover:text-cyan-400"
          >
            <Plus className="h-4 w-4" />
            Add override
          </button>
        </div>
      )}
    </div>
  );
}
