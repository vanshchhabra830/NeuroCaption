/**
 * captionRenderer.ts
 * Shared canvas-based caption drawing — used by both VideoPreview (live)
 * and StudioExportButton (offline recording).
 */

import { CaptionStyle } from "@/types";
import { hexToRgba } from "./captionStyles";

// ─── Easing ──────────────────────────────────────────────────────────────────
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutElastic = (t: number) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};

// ─── Text helpers ─────────────────────────────────────────────────────────────
export function applyTransform(text: string, transform: CaptionStyle["textTransform"]): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/\b\w/g, (c) => c.toUpperCase());
  return text;
}

export function measureWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number
): number {
  if (spacing === 0) return ctx.measureText(text).width;
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) - spacing;
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: CaptionStyle["textAlign"],
  isStroke: boolean
) {
  if (spacing === 0) {
    if (isStroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const totalW = measureWithSpacing(ctx, text, spacing);
  let curX = align === "center" ? x - totalW / 2 : align === "right" ? x - totalW : x;
  const savedAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    if (isStroke) ctx.strokeText(ch, curX, y);
    else ctx.fillText(ch, curX, y);
    curX += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = savedAlign;
}

// ─── Main draw function ───────────────────────────────────────────────────────
/**
 * @param ctx      Canvas 2D context to draw into
 * @param rawText  Raw segment text (transform applied inside)
 * @param style    Full CaptionStyle
 * @param canvasW  Canvas width in pixels
 * @param canvasH  Canvas height in pixels
 * @param progress 0→1 within the current segment (drives entry animations)
 * @param currentTime Absolute video playback time in seconds (drives continuous anims)
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  style: CaptionStyle,
  canvasW: number,
  canvasH: number,
  progress: number,
  currentTime: number
) {
  const scale = canvasW / 1920;
  const fontSize = style.fontSize * scale;
  const spacing = style.letterSpacing * scale;
  const lineH = fontSize * style.lineHeight;
  const paddingX = style.paddingX * scale;
  const paddingY = style.paddingY * scale;
  const maxWidth = canvasW * 0.88;

  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign =
    style.textAlign === "left" ? "left" :
    style.textAlign === "right" ? "right" : "center";

  const text = applyTransform(rawText, style.textTransform);

  // Word-wrap
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (measureWithSpacing(ctx, test, spacing) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const blockH = lines.length * lineH + paddingY * 2;
  const anchorX = (style.positionX / 100) * canvasW;
  const anchorY = (style.positionY / 100) * canvasH - blockH / 2;

  // ── Per-animation transforms ─────────────────────────────────────────────
  let alpha = style.opacity;
  let translateX = 0;
  let translateY = 0;
  let scaleXY = 1;
  let blurPx = 0;
  let glitchOffset = 0;
  let clipRevealFraction = 1;

  const entryT = Math.min(1, progress * 5);

  switch (style.animation) {
    case "fadeIn":
      alpha = style.opacity * Math.min(1, progress * 6);
      break;
    case "pop": {
      const t = Math.min(1, progress * 6);
      scaleXY = 0.55 + 0.45 * t;
      alpha = style.opacity * t;
      break;
    }
    case "slideUp": {
      const t = easeOutCubic(entryT);
      translateY = (1 - t) * 36 * scale;
      alpha = style.opacity * Math.min(1, entryT * 3);
      break;
    }
    case "bounceIn": {
      const t = Math.min(1, progress * 4);
      const bounce = easeOutElastic(t);
      scaleXY = 0.1 + 0.9 * bounce;
      translateY = (1 - bounce) * 48 * scale;
      alpha = style.opacity * Math.min(1, t * 4);
      break;
    }
    case "slideLeft": {
      const t = easeOutCubic(entryT);
      translateX = -(1 - t) * 80 * scale;
      alpha = style.opacity * Math.min(1, entryT * 3);
      break;
    }
    case "slideRight": {
      const t = easeOutCubic(entryT);
      translateX = (1 - t) * 80 * scale;
      alpha = style.opacity * Math.min(1, entryT * 3);
      break;
    }
    case "glitch": {
      const glitchWindow = progress < 0.2 || (progress > 0.45 && progress < 0.5);
      if (glitchWindow) {
        const intensity = progress < 0.2 ? Math.max(0, (0.2 - progress) / 0.2) : 0.3;
        glitchOffset = intensity * 6 * scale;
        translateX = Math.sin(currentTime * 137) * glitchOffset;
        translateY += Math.sin(currentTime * 89) * glitchOffset * 0.5;
        alpha = style.opacity * (0.7 + 0.3 * Math.abs(Math.sin(currentTime * 200)));
      }
      break;
    }
    case "zoomPulse": {
      const pulse = 1 + 0.025 * Math.sin(currentTime * Math.PI * 1.6);
      scaleXY = pulse;
      alpha = style.opacity * (0.92 + 0.08 * Math.sin(currentTime * Math.PI * 1.6));
      break;
    }
    case "wipeReveal":
      clipRevealFraction = easeOutCubic(Math.min(1, progress * 6));
      break;
    case "blurFocus": {
      const t = Math.min(1, progress * 5);
      blurPx = (1 - easeOutCubic(t)) * 12;
      alpha = style.opacity * (0.3 + 0.7 * easeOutCubic(t));
      break;
    }
    case "typewriter": {
      const totalChars = text.length;
      const visible = Math.floor(progress * totalChars * 2.5);
      const visibleText = text.slice(0, Math.min(totalChars, visible));
      const twWords = visibleText.split(" ");
      lines.length = 0;
      let twLine = "";
      for (const w of twWords) {
        const test2 = twLine ? `${twLine} ${w}` : w;
        if (measureWithSpacing(ctx, test2, spacing) > maxWidth && twLine) {
          lines.push(twLine);
          twLine = w;
        } else {
          twLine = test2;
        }
      }
      if (twLine) lines.push(twLine);
      break;
    }
    default:
      break;
  }

  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;

  ctx.save();

  // Clip for wipeReveal
  if (style.animation === "wipeReveal" && clipRevealFraction < 1) {
    ctx.beginPath();
    ctx.rect(anchorX - canvasW * 0.5, 0, canvasW * clipRevealFraction, canvasH);
    ctx.clip();
  }

  ctx.globalAlpha = alpha;
  ctx.translate(anchorX + translateX, anchorY + translateY);
  ctx.scale(scaleXY, scaleXY);
  ctx.translate(-(anchorX + translateX), -(anchorY + translateY));

  // Glitch ghost layers
  if (style.animation === "glitch" && glitchOffset > 0) {
    const savedAlpha = ctx.globalAlpha;
    ctx.globalAlpha = savedAlpha * 0.5;
    ctx.fillStyle = "#ff0040";
    lines.forEach((ln, i) => {
      const textX = style.textAlign === "center" ? anchorX : style.textAlign === "right" ? anchorX + canvasW * 0.44 : anchorX - canvasW * 0.44;
      const textY = anchorY + translateY + paddingY + fontSize + i * lineH;
      ctx.fillText(ln, textX + glitchOffset * 1.5, textY - glitchOffset * 0.5);
    });
    ctx.fillStyle = "#00ffff";
    lines.forEach((ln, i) => {
      const textX = style.textAlign === "center" ? anchorX : style.textAlign === "right" ? anchorX + canvasW * 0.44 : anchorX - canvasW * 0.44;
      const textY = anchorY + translateY + paddingY + fontSize + i * lineH;
      ctx.fillText(ln, textX - glitchOffset, textY + glitchOffset * 0.3);
    });
    ctx.globalAlpha = savedAlpha;
  }

  // Draw each line
  lines.forEach((ln, i) => {
    const lineW = measureWithSpacing(ctx, ln, spacing);
    const textX =
      style.textAlign === "left" ? anchorX + translateX - canvasW * 0.44 :
      style.textAlign === "right" ? anchorX + translateX + canvasW * 0.44 :
      anchorX + translateX;
    const textY = anchorY + translateY + paddingY + fontSize + i * lineH;

    // Background box
    if (style.backgroundOpacity > 0) {
      ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity);
      const rx = Math.min(style.borderRadius * scale, fontSize / 2);
      const bx = textX - (style.textAlign === "center" ? lineW / 2 : style.textAlign === "right" ? lineW : 0) - paddingX;
      const by = textY - fontSize - paddingY * 0.5;
      const bw = lineW + paddingX * 2;
      const bh = fontSize + paddingY * 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + rx, by); ctx.lineTo(bx + bw - rx, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + rx, rx); ctx.lineTo(bx + bw, by + bh - rx);
      ctx.arcTo(bx + bw, by + bh, bx + bw - rx, by + bh, rx); ctx.lineTo(bx + rx, by + bh);
      ctx.arcTo(bx, by + bh, bx, by + bh - rx, rx); ctx.lineTo(bx, by + rx);
      ctx.arcTo(bx, by, bx + rx, by, rx);
      ctx.closePath();
      ctx.fill();
    }

    // Shadow
    if (style.shadowBlur > 0 || style.shadowX !== 0 || style.shadowY !== 0) {
      ctx.shadowOffsetX = style.shadowX * scale;
      ctx.shadowOffsetY = style.shadowY * scale;
      ctx.shadowBlur = style.shadowBlur * scale;
      ctx.shadowColor = style.shadowColor;
    }

    // Outline (stroke before fill)
    if (style.outlineWidth > 0) {
      ctx.strokeStyle = style.outlineColor;
      ctx.lineWidth = style.outlineWidth * scale * 2;
      ctx.lineJoin = "round";
      drawLine(ctx, ln, textX, textY, spacing, style.textAlign, true);
    }

    // Fill
    ctx.fillStyle = style.color;
    drawLine(ctx, ln, textX, textY, spacing, style.textAlign, false);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });

  ctx.restore();
  ctx.filter = "none";
}
