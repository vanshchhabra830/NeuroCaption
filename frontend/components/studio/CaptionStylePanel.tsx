"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CaptionStyle } from "@/types";
import { PRESET_STYLES, hexToRgba } from "@/lib/captionStyles";

// ─── Accordion helpers ────────────────────────────────────────────────────────
function Section({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="flex flex-col gap-3.5 px-3 pb-3.5 pt-1">{children}</div>}
    </div>
  );
}

function Label({ text, value }: { text: string; value?: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{text}</span>
      {value !== undefined && <span className="text-xs font-bold text-violet-300">{value}</span>}
    </div>
  );
}

function Slider({
  min, max, step = 1, value, onChange, label, unit = "",
}: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; label: string; unit?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label text={label} value={`${value}${unit}`} />
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-violet-500"
      />
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-slate-600">{value}</span>
        <input
          type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
        />
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg border py-1.5 text-xs transition-colors ${
              value === o.id
                ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
interface Props {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
}

const ALL_SECTIONS = ["presets", "text", "outline", "shadow", "background", "position", "animation"] as const;
type SectionId = typeof ALL_SECTIONS[number];

// Grouped by vibe — shown as optgroup in select
const FONT_GROUPS = [
  {
    label: "🎬 Reels Favourites",
    fonts: [
      { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
      { value: "'Anton', sans-serif", label: "Anton" },
      { value: "'Oswald', sans-serif", label: "Oswald" },
      { value: "'Poppins', sans-serif", label: "Poppins" },
      { value: "'Montserrat', sans-serif", label: "Montserrat" },
    ],
  },
  {
    label: "✨ Clean & Modern",
    fonts: [
      { value: "Inter, sans-serif", label: "Inter" },
      { value: "'DM Sans', sans-serif", label: "DM Sans" },
      { value: "'Space Grotesk', sans-serif", label: "Space Grotesk" },
      { value: "'Raleway', sans-serif", label: "Raleway" },
    ],
  },
  {
    label: "💎 Elegant & Serif",
    fonts: [
      { value: "'Playfair Display', serif", label: "Playfair Display" },
      { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
      { value: "Georgia, serif", label: "Georgia" },
    ],
  },
  {
    label: "😂 Fun & Expressive",
    fonts: [
      { value: "'Bangers', sans-serif", label: "Bangers" },
      { value: "'Pacifico', cursive", label: "Pacifico" },
      { value: "'Permanent Marker', cursive", label: "Permanent Marker" },
      { value: "'Righteous', sans-serif", label: "Righteous" },
    ],
  },
  {
    label: "🕹️ Retro & Niche",
    fonts: [
      { value: "'Press Start 2P', monospace", label: "Press Start 2P" },
      { value: "Impact, sans-serif", label: "Impact" },
      { value: "'Courier New', monospace", label: "Courier New" },
    ],
  },
];

const ANIMATIONS: { id: CaptionStyle["animation"]; label: string; emoji: string }[] = [
  { id: "none",       label: "None",         emoji: "✗" },
  { id: "fadeIn",     label: "Fade In",       emoji: "🌅" },
  { id: "pop",        label: "Pop",           emoji: "💥" },
  { id: "bounceIn",   label: "Bounce In",     emoji: "🏀" },
  { id: "slideUp",    label: "Slide Up",      emoji: "⬆" },
  { id: "slideLeft",  label: "Slide Left",    emoji: "⬅" },
  { id: "slideRight", label: "Slide Right",   emoji: "➡" },
  { id: "wipeReveal", label: "Wipe Reveal",   emoji: "🔓" },
  { id: "blurFocus",  label: "Blur Focus",    emoji: "🔍" },
  { id: "zoomPulse",  label: "Zoom Pulse",    emoji: "🫀" },
  { id: "glitch",     label: "Glitch",        emoji: "⚡" },
  { id: "typewriter", label: "Typewriter",    emoji: "⌨" },
];

export default function CaptionStylePanel({ style, onChange }: Props) {
  const [open, setOpen] = useState<Set<SectionId>>(new Set(["presets", "text"]));

  const toggle = (id: SectionId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const set = <K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]) =>
    onChange({ ...style, [key]: value });

  const isOpen = (id: SectionId) => open.has(id);

  return (
    <div className="flex flex-col gap-2 pb-2">

      {/* ── Presets ── */}
      <Section id="presets" title="Presets" open={isOpen("presets")} onToggle={() => toggle("presets")}>
        <div className="grid grid-cols-1 gap-1.5">
          {PRESET_STYLES.map((preset) => {
            const isSelected = style.id === preset.id;
            const previewBg =
              preset.backgroundOpacity > 0
                ? hexToRgba(preset.backgroundColor, preset.backgroundOpacity)
                : "transparent";
            return (
              <button
                key={preset.id}
                onClick={() => onChange({ ...preset })}
                className={`relative flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "border-violet-500/60 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                }`}
              >
                {/* Mini preview swatch */}
                <div
                  className="shrink-0 flex h-8 w-12 items-center justify-center rounded-md overflow-hidden"
                  style={{ background: previewBg || "#111" }}
                >
                  <span
                    className="text-[9px] font-bold leading-none truncate px-0.5"
                    style={{
                      color: preset.color,
                      fontFamily: preset.fontFamily,
                      WebkitTextStroke: preset.outlineWidth > 0 ? `${preset.outlineWidth * 0.3}px ${preset.outlineColor}` : undefined,
                      textTransform: preset.textTransform === "none" ? undefined : preset.textTransform,
                    }}
                  >
                    Aa
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{preset.name}</p>
                  <p className="text-[10px] text-slate-600 capitalize">
                    {preset.animation !== "none" ? preset.animation : "static"} ·{" "}
                    {preset.outlineWidth > 0 ? "outlined" : preset.backgroundOpacity > 0 ? "box" : "plain"}
                  </p>
                </div>
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Text ── */}
      <Section id="text" title="Text" open={isOpen("text")} onToggle={() => toggle("text")}>
        {/* Font family — grouped select */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-slate-400">Font Family</span>
          <select
            value={style.fontFamily}
            onChange={(e) => set("fontFamily", e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500/50"
          >
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label} className="bg-[#0f0f1a] text-slate-400">
                {group.fonts.map((f) => (
                  <option key={f.value} value={f.value} className="bg-[#0f0f1a]">{f.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* Size + weight */}
        <Slider label="Font Size" min={8} max={200} value={style.fontSize} onChange={(v) => set("fontSize", v)} unit="px" />

        <ToggleGroup
          label="Weight"
          options={[{ id: "normal", label: "Regular" }, { id: "bold", label: "Bold" }]}
          value={style.fontWeight}
          onChange={(v) => set("fontWeight", v as CaptionStyle["fontWeight"])}
        />

        {/* Color + opacity */}
        <ColorRow label="Text Color" value={style.color} onChange={(v) => set("color", v)} />

        <Slider label="Opacity" min={0} max={1} step={0.05} value={style.opacity} onChange={(v) => set("opacity", v)} />

        {/* Transform + align */}
        <ToggleGroup
          label="Transform"
          options={[
            { id: "none", label: "Abc" },
            { id: "uppercase", label: "ABC" },
            { id: "lowercase", label: "abc" },
            { id: "capitalize", label: "Ab C" },
          ]}
          value={style.textTransform}
          onChange={(v) => set("textTransform", v as CaptionStyle["textTransform"])}
        />

        <ToggleGroup
          label="Alignment"
          options={[
            { id: "left", label: "⬅ Left" },
            { id: "center", label: "⬛ Center" },
            { id: "right", label: "Right ➡" },
          ]}
          value={style.textAlign}
          onChange={(v) => set("textAlign", v as CaptionStyle["textAlign"])}
        />

        {/* Spacing + line height */}
        <Slider label="Letter Spacing" min={-2} max={12} step={0.5} value={style.letterSpacing} onChange={(v) => set("letterSpacing", v)} unit="px" />
        <Slider label="Line Height" min={1} max={2.5} step={0.05} value={style.lineHeight} onChange={(v) => set("lineHeight", v)} unit="×" />
      </Section>

      {/* ── Outline ── */}
      <Section id="outline" title="Outline / Stroke" open={isOpen("outline")} onToggle={() => toggle("outline")}>
        <Slider label="Outline Width" min={0} max={12} step={0.5} value={style.outlineWidth} onChange={(v) => set("outlineWidth", v)} unit="px" />
        <ColorRow label="Outline Color" value={style.outlineColor} onChange={(v) => set("outlineColor", v)} />
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Outline is drawn behind the fill. Use white text + black outline (or vice-versa) for maximum readability on any background.
        </p>
      </Section>

      {/* ── Shadow ── */}
      <Section id="shadow" title="Drop Shadow" open={isOpen("shadow")} onToggle={() => toggle("shadow")}>
        <Slider label="Offset X" min={-20} max={20} step={1} value={style.shadowX} onChange={(v) => set("shadowX", v)} unit="px" />
        <Slider label="Offset Y" min={-20} max={20} step={1} value={style.shadowY} onChange={(v) => set("shadowY", v)} unit="px" />
        <Slider label="Blur" min={0} max={40} step={1} value={style.shadowBlur} onChange={(v) => set("shadowBlur", v)} unit="px" />
        <ColorRow label="Shadow Color" value={style.shadowColor.startsWith("rgba") ? "#000000" : style.shadowColor} onChange={(v) => set("shadowColor", v)} />
      </Section>

      {/* ── Background ── */}
      <Section id="background" title="Background Box" open={isOpen("background")} onToggle={() => toggle("background")}>
        <Slider label="Opacity" min={0} max={1} step={0.05} value={style.backgroundOpacity} onChange={(v) => set("backgroundOpacity", v)} />
        <ColorRow label="Color" value={style.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
        <Slider label="Corner Radius" min={0} max={32} value={style.borderRadius} onChange={(v) => set("borderRadius", v)} unit="px" />
        <Slider label="Padding X" min={0} max={40} value={style.paddingX} onChange={(v) => set("paddingX", v)} unit="px" />
        <Slider label="Padding Y" min={0} max={40} value={style.paddingY} onChange={(v) => set("paddingY", v)} unit="px" />

        {/* Live preview swatch */}
        <div className="flex items-center justify-center rounded-xl overflow-hidden h-10 bg-[#555]">
          <span
            className="px-4 py-1 text-sm font-bold"
            style={{
              color: style.color,
              background: style.backgroundOpacity > 0 ? hexToRgba(style.backgroundColor, style.backgroundOpacity) : "transparent",
              borderRadius: style.borderRadius,
              WebkitTextStroke: style.outlineWidth > 0 ? `${style.outlineWidth * 0.4}px ${style.outlineColor}` : undefined,
            }}
          >
            Preview
          </span>
        </div>
      </Section>

      {/* ── Position ── */}
      <Section id="position" title="Position" open={isOpen("position")} onToggle={() => toggle("position")}>
        <div>
          <Label text="Horizontal" value={`${style.positionX}%`} />
          <input type="range" min={5} max={95} value={style.positionX} onChange={(e) => set("positionX", Number(e.target.value))} className="w-full accent-violet-500 mt-1.5" />
          <div className="flex justify-between text-[10px] text-slate-700 mt-0.5">
            <span>Left</span><span>Center</span><span>Right</span>
          </div>
        </div>
        <div>
          <Label text="Vertical" value={`${style.positionY}%`} />
          <input type="range" min={5} max={95} value={style.positionY} onChange={(e) => set("positionY", Number(e.target.value))} className="w-full accent-violet-500 mt-1.5" />
          <div className="flex justify-between text-[10px] text-slate-700 mt-0.5">
            <span>Top</span><span>Middle</span><span>Bottom</span>
          </div>
        </div>
      </Section>

      {/* ── Animation ── */}
      <Section id="animation" title="Animation" open={isOpen("animation")} onToggle={() => toggle("animation")}>
        <div className="grid grid-cols-2 gap-1.5">
          {ANIMATIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => set("animation", a.id)}
              className={`rounded-lg border py-2 text-xs transition-colors ${
                style.animation === a.id
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                  : "border-white/10 bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]"
              }`}
            >
              <span className="mr-1">{a.emoji}</span>{a.label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}
