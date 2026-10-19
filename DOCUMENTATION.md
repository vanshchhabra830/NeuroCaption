# NeuroCaption: Architecture & End-to-End Documentation

NeuroCaption is a robust, local-first application designed for high-accuracy multilingual audio transcription, specifically optimized for Hindi-to-Hinglish workflows. The application relies on a modern Next.js frontend paired with a high-performance FastAPI backend. It ships with two distinct interfaces: the classic **Home Page** (audio-only, SRT export) and the new **Caption Studio** (video-native, styled captions burned directly into video).

---

## 🗺️ Application Structure Overview

```
NeuroCaption
├── Home Page         (/):            Audio upload → Transcribe → Edit → Download .srt
└── Caption Studio    (/caption-studio): Video upload → Transcribe → Style → Export .mp4/.webm
```

Both pages share the same FastAPI backend and the same core transcription/Hinglish pipeline.

---

## 🔄 Home Page: End-to-End Flow

The Home Page is designed for users who need raw subtitle files for use in video editors (Premiere, DaVinci, etc.).

### 1. File Selection & Configuration (Frontend)
1. The user opens the Next.js web interface (typically at `localhost:3000`).
2. They drag and drop (or browse for) an audio/video file into the **Audio Uploader** zone.
3. They select a target language from the **Language Dropdown** (or leave it as "Auto Detect").
4. They click the glowing **Generate Captions** button.

### 2. Transcription Request & AI Processing (Backend)
1. The frontend wraps the audio file and selected language into a `FormData` payload and sends an asynchronous HTTP `POST` request to the backend's `/api/transcribe` endpoint.
2. The FastAPI backend receives the request. It temporarily saves the audio payload to the local disk.
3. The backend invokes `faster-whisper` (pre-loaded into GPU memory during startup) to transcribe the audio file.
4. Whisper processes the audio in 30-second chunks, applying Voice Activity Detection (VAD) to skip silence, and returns an array of timestamped segments along with the detected language code.
5. The backend returns this structured JSON array of segments back to the frontend.

### 3. Non-Destructive Editing & Chunking (Frontend)
1. The frontend receives the response and permanently stores it in memory as `rawSegments`.
2. The UI switches into **Editing Mode**, displaying the text.
3. The user can adjust the **"Words per segment"** slider. Whenever this slider moves, the frontend dynamically re-calculates the timestamps and chunks the text using the `splitByWordCount` utility function. Because it always calculates directly from `rawSegments`, **this process is non-destructive**—data never degrades no matter how many times the user changes the slider.
4. The user can manually correct specific words using the `SegmentEditor`.

### 4. Experimental Hinglish AI Translation
1. If the detected audio language is Hindi (`hi`), the frontend unlocks an **"AI Experimental" Convert to Hinglish** button.
2. Clicking this button sends the original raw Hindi segments to the backend's `/api/convert-hinglish` endpoint.
3. The backend securely contacts the **Google Gemini 2.5 Flash** AI model via `google-generativeai`, instructing it to transliterate the Hindi text into the English alphabet. The prompt strictly demands that Gemini preserves the exact original JSON timeframe IDs and structures.
4. The frontend receives the Hinglish segments and opens a modal. The user's active "Words per segment" slider logic is automatically applied to these new Hinglish segments!

### 5. Final Export
1. The user clicks **Download SRT**.
2. The frontend sends the currently modified chunks back to the backend `/api/export` endpoint.
3. The backend formats the segments into the standard SubRip Subtitle (`.srt`) format and sends the text file back as a downloadable Blob.

---

## 🎬 Caption Studio: End-to-End Flow

Caption Studio (`/caption-studio`) is a full-featured video captioning workspace. Instead of exporting a `.srt` file, it **burns styled captions directly into a new video file**, completely client-side using the Canvas API and MediaRecorder — no server upload required during export.

### 1. The Four-Panel Layout

The Studio UI is a fixed, non-scrolling four-pane layout:

| Panel | Width | Purpose |
|---|---|---|
| **Left sidebar** (Controls) | 17 rem | File input, language, transcription trigger, words/segment slider, stats, export button |
| **Centre-left** (Caption Editor) | 22 rem | Live-synced, scrolling list of all caption segments. Click any segment to edit its text inline. Active segment is highlighted in violet as the video plays. |
| **Centre-right** (Video Preview) | flex-1 | The main video player with captions rendered on a `<canvas>` overlay in real-time, at the exact same resolution as the final export. |
| **Right sidebar** (Caption Style) | 16 rem | Full style panel for adjusting every visual property of the captions. Changes update the preview instantly. |

### 2. Video Upload

`VideoUploader` (`components/studio/VideoUploader.tsx`) accepts any browser-playable video format (MP4, WebM, MOV, etc.) via drag-and-drop or file picker. On selection, the component creates a local `blob:` URL and hands both the `File` object and the URL to the parent page.

### 3. Transcription

Transcription in Caption Studio uses the **same backend pipeline** as the Home Page:
- `POST /api/transcribe` with the video file as the audio payload.
- A simulated progress bar (easing from 0% → 88%) runs while the real request is in-flight, then snaps to 100% on completion.
- The `rawSegments` array is stored in state and re-chunked via `splitByWordCount` whenever the **Words / Segment** slider changes.

### 4. Hinglish Conversion (In-Place, No Modal)

In the Studio, Hinglish conversion works differently from the Home Page:
- The converted Hinglish segments **directly replace** the current caption list (no confirmation modal).
- A `originalSegmentsRef` keeps a backup of the pre-conversion `rawSegments`.
- The **"Revert to Hindi"** button restores the original segments instantly.
- The header button shows three states: `Convert to Hinglish` (idle) → `Converting…` (loading spinner) → `✓` (done, 2.5s) → back to idle.
- The Hinglish badge appears in the caption editor panel header when active.

### 5. Real-Time Caption Preview (`VideoPreview.tsx`)

`VideoPreview` renders captions on top of the video using a transparent `<canvas>` that overlays the `<video>` element:

- Both the `<video>` and `<canvas>` are `absolute inset-0 w-full h-full`, making them pixel-perfect overlapping siblings.
- A `requestAnimationFrame` loop runs continuously. On each frame, it:
  1. Reads `video.currentTime`.
  2. Finds the matching segment from the `segments` array.
  3. Computes `progress` (0→1) within that segment's duration.
  4. Calls `drawCaption(ctx, seg.text, captionStyle, canvas.width, canvas.height, progress, currentTime)`.
- The canvas resolution matches the video's native `videoWidth × videoHeight` (e.g., 1920×1080 or 1080×1920 for vertical), so the preview is pixel-accurate to the final export.
- The component emits `onActiveSegmentChange` to sync the highlighted segment in the Caption Editor panel.

### 6. Segment Editor (Inline, Time-Synced)

`StudioSegmentEditor` (defined inline in `caption-studio/page.tsx`) renders each segment as a styled card:

- The **active segment** (currently playing) is highlighted with a violet border, violet timestamp, and an animated pulse dot.
- A `useEffect` with `scrollIntoView` keeps the active card visible as the video plays.
- Clicking a card's text area activates a `<textarea>` for inline editing. On blur, the change is committed back to the `segments` array.
- The active segment ID is synced from the `VideoPreview` component via the `onActiveSegmentChange` callback.

---

## 🎨 Caption Style System

The Caption Style system is the core of what makes Caption Studio powerful. All style properties are held in a single `CaptionStyle` object, defined in `frontend/types/index.ts`.

### The `CaptionStyle` Object

| Property | Type | Description |
|---|---|---|
| `id` / `name` | `string` | Preset identifier and display name |
| `fontFamily` | `string` | Full CSS font-family string (e.g., `"'Bebas Neue', sans-serif"`) |
| `fontSize` | `number` | Size in px at 1920px canvas width; auto-scaled at export/preview |
| `fontWeight` | `"normal" \| "bold"` | Font weight |
| `color` | `string` | Hex text color |
| `opacity` | `number` | Global text opacity (0–1) |
| `textTransform` | `"none" \| "uppercase" \| "lowercase" \| "capitalize"` | Text casing |
| `textAlign` | `"left" \| "center" \| "right"` | Horizontal text alignment |
| `letterSpacing` | `number` | Extra px between characters (−2 to 12) |
| `lineHeight` | `number` | Multiplier of fontSize (1.0–2.5×) |
| `outlineWidth` | `number` | Stroke width in px (0–12) |
| `outlineColor` | `string` | Hex color of text stroke |
| `shadowX` / `shadowY` | `number` | Drop shadow offset in px (±20) |
| `shadowBlur` | `number` | Drop shadow blur radius (0–40) |
| `shadowColor` | `string` | Drop shadow color (hex or rgba) |
| `backgroundColor` | `string` | Hex color of the background box |
| `backgroundOpacity` | `number` | Background box opacity (0 = hidden, 1 = opaque) |
| `borderRadius` | `number` | Background box corner radius in px |
| `paddingX` / `paddingY` | `number` | Background box padding in px |
| `positionX` | `number` | Horizontal anchor as % of canvas width (5–95) |
| `positionY` | `number` | Vertical anchor as % of canvas height (5–95) |
| `animation` | See below | Entry/continuous animation effect |

### `CaptionStylePanel.tsx` — The Style Editor

The right-side panel is a collapsible accordion (`Section` components) with the following sections:

#### Presets
13 built-in presets that set every `CaptionStyle` property at once. Each preset button shows a live mini-swatch preview using the preset's actual font, color, and background. Selecting a preset immediately updates the video preview.

| Preset | Vibe | Font | Animation |
|---|---|---|---|
| Bold White | Classic broadcast | Inter | Fade In |
| Cinematic Box | Film subtitles | Montserrat | Slide Up |
| Bebas Impact | Instagram Reels | Bebas Neue | Bounce In |
| Poppins Glow | Neon/glow effect | Poppins | Zoom Pulse |
| Oswald News | Breaking news ticker | Oswald | Slide Left |
| TikTok Bold | TikTok center captions | Anton | Pop |
| Playfair Luxury | Elegant/luxury brands | Playfair Display | Fade In |
| Space Grotesk | Sci-fi/tech | Space Grotesk | Wipe Reveal |
| Cormorant Italic | Cinematic elegance | Cormorant Garamond | Blur Focus |
| Bangers Comic | Meme/fun | Bangers | Bounce In |
| Glitch Cyber | Cyberpunk | Space Grotesk | Glitch |
| Retro Gaming | 8-bit / pixel | Press Start 2P | Typewriter |
| Handwritten | Casual/personal | Permanent Marker | Slide Right |
| Karaoke | Music/sing-along | Poppins | Pop |

#### Text
- **Font Family** — Grouped `<select>` with 19 fonts organized into 5 themed optgroups:
  - 🎬 Reels Favourites: Bebas Neue, Anton, Oswald, Poppins, Montserrat
  - ✨ Clean & Modern: Inter, DM Sans, Space Grotesk, Raleway
  - 💎 Elegant & Serif: Playfair Display, Cormorant Garamond, Georgia
  - 😂 Fun & Expressive: Bangers, Pacifico, Permanent Marker, Righteous
  - 🕹️ Retro & Niche: Press Start 2P, Impact, Courier New
- **Font Size** — Slider from 8px to 200px
- **Weight** — Toggle: Regular / Bold
- **Text Color** — Native `<input type="color">` picker
- **Opacity** — Slider 0–1
- **Transform** — Toggle: Abc / ABC / abc / Ab C
- **Alignment** — Toggle: Left / Center / Right
- **Letter Spacing** — Slider −2px to 12px
- **Line Height** — Slider 1.0× to 2.5×

#### Outline / Stroke
- Width slider (0–12px), color picker.
- Outline is rendered as a canvas `strokeText` pass *before* the fill, giving correct z-order.

#### Drop Shadow
- Offset X (±20px), Offset Y (±20px), Blur (0–40px), color picker.

#### Background Box
- Opacity (0–1), color picker, corner radius (0–32px), padding X (0–40px), padding Y (0–40px).
- Includes a live **preview swatch** at the bottom of the section.

#### Position
- **Horizontal** — Slider from 5% (left) to 95% (right). Default: 50% (center).
- **Vertical** — Slider from 5% (top) to 95% (bottom). Default: 88% (near bottom).

#### Animation
12 animation effects rendered via `captionRenderer.ts`:

| Animation ID | Effect | Type |
|---|---|---|
| `none` | No animation — static text | — |
| `fadeIn` | Opacity 0→1 at 6× speed | Entry |
| `pop` | Scale 0.55→1 + fade | Entry |
| `bounceIn` | Elastic bounce scale + slide-up | Entry |
| `slideUp` | Eased upward translate + fade | Entry |
| `slideLeft` | Eased left translate + fade | Entry |
| `slideRight` | Eased right translate + fade | Entry |
| `wipeReveal` | Horizontal clip-rect reveal | Entry |
| `blurFocus` | Blur 12px→0 + fade from 0.3 | Entry |
| `zoomPulse` | Continuous slow scale pulse (±2.5%) | Continuous |
| `glitch` | RGB-split ghost layers + jitter on entry & mid-segment | Continuous |
| `typewriter` | Characters revealed progressively (2.5× speed) | Entry |

---

## 🖥️ Canvas Caption Renderer (`lib/captionRenderer.ts`)

The `drawCaption` function is the single source of truth for how captions look — used identically in both the live preview (`VideoPreview`) and the final export (`StudioExportButton`). This guarantees **WYSIWYG export**: what you see in the preview is exactly what is burned into the output video.

### Resolution Scaling
All measurements are authored at **1920px canvas width** and automatically scaled by `scale = canvasW / 1920`. This means a `fontSize: 38` preset renders as a true 38px caption on a 1920×1080 video and as a proportionally smaller caption on a 1280×720 video.

### Rendering Pipeline (per frame, per segment)
1. Apply `textTransform` to raw text.
2. Word-wrap into lines based on 88% of canvas width.
3. Compute the animation state (`alpha`, `translateX/Y`, `scaleXY`, `blurPx`, `clipRevealFraction`, `glitchOffset`) from `progress` and `currentTime`.
4. Apply `ctx.filter = blur(...)` for blur focus.
5. `ctx.save()` → apply `ctx.translate` + `ctx.scale` for the animation transform.
6. For `wipeReveal`, clip the canvas to a growing horizontal rectangle.
7. For `glitch`, draw two semi-transparent ghost layers (red + cyan) offset from center.
8. For each text line:
   - Draw the **background box** (rounded rectangle) if `backgroundOpacity > 0`.
   - Set `ctx.shadow*` for drop shadow.
   - Draw **outline** (`strokeText`) if `outlineWidth > 0`.
   - Draw **fill** (`fillText`).
   - Reset shadow.
9. `ctx.restore()`, reset `ctx.filter`.

### Letter Spacing
Custom letter spacing is implemented manually via `measureWithSpacing` and `drawLine`, which iterate character-by-character since the Canvas 2D API does not natively support `letter-spacing`.

---

## 📹 Video Export (`StudioExportButton.tsx`)

The export is done **100% client-side** — no video is uploaded to a server. The process:

1. **Create a hidden `<video>` element** from the original `File` object. Its volume is set to 0 so audio plays silently.
2. **Read native resolution** (`videoWidth × videoHeight`) and create an off-screen `<canvas>` at that exact size.
3. **Capture the canvas stream** using `canvas.captureStream(30)` (30 fps).
4. **Route video audio through Web Audio API** (`AudioContext` → `MediaStreamDestination`) to produce audio tracks for the output stream — without playing to speakers.
5. **Combine** canvas video tracks + Web Audio tracks into a single `MediaStream`.
6. **Select the best MIME type** from a priority list:
   - `video/mp4;codecs=avc1.42E01E,mp4a.40.2` (Chrome H.264)
   - `video/mp4`
   - `video/webm;codecs=vp9,opus`
   - `video/webm;codecs=vp8,opus`
   - `video/webm` (fallback)
7. **`MediaRecorder`** records the combined stream, flushing chunks every 200ms.
8. **Frame draw loop** (`requestAnimationFrame`): On every frame, draw the current video frame onto the canvas, then call `drawCaption` with the same style and segment timing as the preview. This is the identical renderer used by `VideoPreview`.
9. On `video.ended`, `recorder.stop()` is called.
10. The resulting `Blob` is downloaded via a synthetic `<a>` click.

> **Browser compatibility**: `canvas.captureStream()` requires Chrome or Edge. The export will throw a clear error on Firefox or Safari.

### Export Progress
A real-time progress bar tracks `video.currentTime / video.duration`. Since the export plays the video at 1× real-time speed, a 2-minute video takes ~2 minutes to export.

### Output File Name
`{original-filename}_captioned.mp4` (or `.webm` depending on browser support).

---

## ⚡ The Migration: `openai-whisper` vs `faster-whisper`

When this project was initially created, it relied directly on the standard `openai/whisper` library using the `large-v2` model. While accurate, it presented severe performance and memory bottlenecks. The project was successfully migrated to `faster-whisper`. 

Here is exactly what that migration means and why it matters:

### 1. Underlying Engine (PyTorch vs CTranslate2)
* **Standard Whisper** runs on Python using PyTorch. It executes layers sequentially using standard tensor math, which carries overhead.
* **Faster-Whisper** runs on a highly optimized C++ inference engine called **CTranslate2**. It mathematically optimizes the model weights and executes operations much closer to the metal, bypassing Python's Global Interpreter Lock (GIL) overhead.

### 2. Speed (Inference Time)
Because of the CTranslate2 engine, `faster-whisper` transcribes audio up to **4 times faster** than standard Whisper on the exact same hardware, without sacrificing any transcription accuracy.

### 3. VRAM Efficiency & Quantization
Standard PyTorch Whisper typically loads weights in `float32` or `float16`. 
`faster-whisper` allows for dynamic quantization. NeuroCaption currently configures the model to load with `compute_type="int8_float16"`. This compresses the static model weights down to 8-bit integers (saving massive amounts of memory) while keeping active calculations (activations) in 16-bit floating point to preserve perfect precision.

---

## ⚙️ Current Model Configuration
As defined in `backend/services/whisper_service.py`, the active hardware configuration is:
* **Model:** `large-v2`
* **Device:** `cuda` (NVIDIA GPU)
* **Compute Type:** `int8_float16`
* **Beam Size:** 5 (Explores 5 transcription paths simultaneously)
* **VAD Filter:** `True` (Silences under 500ms are ignored to prevent hallucinations)

---

## 📉 Optimizing VRAM Usage (Preventing CUDA OOM)

The `large-v2` model is incredibly accurate but very heavy. Even with `faster-whisper`, transcribing long files can spike VRAM usage to 6GB-8GB, potentially throwing a `RuntimeError: CUDA failed with error out of memory`.

If you need to optimize this application to use less VRAM without compromising the underlying accuracy of the model, you should apply the following changes:

### 1. Switch to Greedy Decoding (Highest Impact)
The current configuration uses `beam_size=5`. This means the GPU holds 5 potential transcription timelines in memory at once and compares them. 
* **The Fix:** Open `backend/services/whisper_service.py` and change `beam_size=5` to `beam_size=1`.
* **Why:** This switches the model to "Greedy Decoding" (taking the most likely word immediately). It drastically slashes VRAM spikes and speeds up transcription by almost 2x. For clear audio, the accuracy loss is entirely imperceptible.

### 2. Strict 8-bit Quantization
The current configuration uses `int8_float16`. 
* **The Fix:** Change `_COMPUTE_TYPE = "int8_float16"` to `_COMPUTE_TYPE = "int8"`.
* **Why:** This forces the activation layers down to 8-bit math as well. It reduces base memory footprint by another ~1GB.

### 3. Aggressive VAD Filtering
* **The Fix:** Change `vad_parameters={"min_silence_duration_ms": 500}` to `1000` (1 second).
* **Why:** Stripping out all non-speech audio prevents the model from attempting to process complex background noise, keeping the tensor sequences short and lean.

If you apply these three changes, you can comfortably run the `large-v2` model on GPUs with as little as 4GB to 6GB of VRAM.
