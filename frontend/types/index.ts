export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface WordOverride {
  id: string; // crypto.randomUUID() for React key
  original: string;
  replacement: string;
}

export interface TranscriptionResponse {
  segments: Segment[];
  language: string;
}

export interface CaptionStyle {
  id: string;
  name: string;

  // ─── Text ───────────────────────────────────────────────
  fontFamily: string;
  fontSize: number;           // px at 1920-wide reference canvas
  fontWeight: "normal" | "bold";
  color: string;              // hex
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  textAlign: "left" | "center" | "right";
  letterSpacing: number;      // extra px between characters (at reference scale)
  lineHeight: number;         // multiplier, e.g. 1.3
  opacity: number;            // 0–1 global (text + bg)

  // ─── Outline / Stroke ───────────────────────────────────
  outlineWidth: number;       // px at reference scale (0 = off)
  outlineColor: string;       // hex

  // ─── Shadow ─────────────────────────────────────────────
  shadowX: number;            // px offset
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;        // hex or rgba

  // ─── Background box ─────────────────────────────────────
  backgroundColor: string;    // hex color
  backgroundOpacity: number;  // 0 = transparent, 1 = fully opaque
  borderRadius: number;       // px at reference scale
  paddingX: number;
  paddingY: number;

  // ─── Position ───────────────────────────────────────────
  positionX: number;          // % of canvas width (0–100, 50 = center)
  positionY: number;          // % of canvas height (0–100, 88 = near bottom)

  // ─── Animation ──────────────────────────────────────────
  animation: "none" | "fadeIn" | "pop" | "slideUp" | "typewriter"
           | "bounceIn" | "slideLeft" | "slideRight" | "glitch" | "zoomPulse" | "wipeReveal" | "blurFocus";
}
