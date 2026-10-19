"use client";

import { useState, useRef, useCallback } from "react";
import { Segment, CaptionStyle } from "@/types";
import { Download, Loader2 } from "lucide-react";
import { drawCaption } from "@/lib/captionRenderer";

interface StudioExportButtonProps {
  videoFile: File;
  segments: Segment[];
  captionStyle: CaptionStyle;
}

/**
 * Exports the video with captions burned in using:
 *   1. A hidden <video> element (separate from preview)
 *   2. An offscreen <canvas> that gets each video frame + caption drawn on it
 *   3. canvas.captureStream() + video's audio via Web Audio API
 *   4. MediaRecorder records the combined stream to a WebM / MP4 blob
 *
 * This is far more reliable than FFmpeg's `subtitles` filter which requires
 * libass compiled into the wasm core — not included in @ffmpeg/core@0.12.x.
 */
export default function StudioExportButton({ videoFile, segments, captionStyle }: StudioExportButtonProps) {
  const [phase, setPhase] = useState<"idle" | "encoding" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const handleExport = useCallback(async () => {
    if (phase === "encoding") { abortRef.current = true; return; }
    abortRef.current = false;
    setPhase("encoding");
    setProgress(0);

    try {
      // ── 1. Check browser support ─────────────────────────────────────────
      if (!("captureStream" in HTMLCanvasElement.prototype)) {
        throw new Error("Your browser does not support canvas.captureStream(). Please use Chrome or Edge.");
      }

      // ── 2. Create a hidden video element purely for export ────────────────
      const video = document.createElement("video");
      const srcUrl = URL.createObjectURL(videoFile);
      video.src = srcUrl;
      video.preload = "auto";
      // Don't autoplay to speakers; audio will be routed through Web Audio
      video.volume = 0;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video file."));
        video.load();
      });

      const { videoWidth: W, videoHeight: H, duration } = video;

      // ── 3. Offscreen canvas at native video resolution ────────────────────
      const canvas = document.createElement("canvas");
      canvas.width = W || 1920;
      canvas.height = H || 1080;
      const ctx = canvas.getContext("2d")!;

      // ── 4. Canvas video stream at native frame rate (up to 30 fps) ───────
      const fps = 30;
      const canvasStream = (canvas as HTMLCanvasElement & {
        captureStream(fps?: number): MediaStream;
      }).captureStream(fps);

      // ── 5. Route video audio through Web Audio → MediaStream ─────────────
      //    We don't connect to audioCtx.destination so no speakers during export
      let audioTracks: MediaStreamTrack[] = [];
      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const audioDest = audioCtx.createMediaStreamDestination();
        source.connect(audioDest);
        audioTracks = audioDest.stream.getAudioTracks();
      } catch {
        // Silently continue without audio if Web Audio routing fails
        console.warn("Web Audio capture unavailable — output will be silent.");
      }

      // ── 6. Combine canvas video + audio into one stream ──────────────────
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);

      // ── 7. Pick the best supported MIME type ─────────────────────────────
      const MIME_CANDIDATES = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";

      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const recordingComplete = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      // ── 8. Frame draw loop ────────────────────────────────────────────────
      let rafId = 0;
      function drawFrame() {
        if (abortRef.current) {
          recorder.stop();
          return;
        }

        const t = video.currentTime;
        setProgress(duration > 0 ? Math.round((t / duration) * 100) : 0);

        // Draw the current video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw caption overlay using the exact same renderer as preview
        const seg = segments.find((s) => t >= s.start && t <= s.end);
        if (seg) {
          const segDuration = seg.end - seg.start;
          const segProgress = segDuration > 0 ? (t - seg.start) / segDuration : 1;
          drawCaption(ctx, seg.text, captionStyle, canvas.width, canvas.height, segProgress, t);
        }

        if (video.ended) {
          recorder.stop();
        } else {
          rafId = requestAnimationFrame(drawFrame);
        }
      }

      // ── 9. Start recording + playback ─────────────────────────────────────
      recorder.start(200); // flush every 200 ms
      await video.play();
      drawFrame();

      // ── 10. Wait for done ─────────────────────────────────────────────────
      const outputBlob = await recordingComplete;
      cancelAnimationFrame(rafId);

      // Cleanup
      URL.revokeObjectURL(srcUrl);
      audioCtx?.close();

      // ── 11. Trigger download ──────────────────────────────────────────────
      const downloadUrl = URL.createObjectURL(outputBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${videoFile.name.replace(/\.[^.]+$/, "")}_captioned.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      setProgress(100);
      setPhase("done");
      setTimeout(() => { setPhase("idle"); setProgress(0); }, 3000);

    } catch (err) {
      console.error("Export failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Export failed: ${msg}`);
      setPhase("idle");
      setProgress(0);
    }
  }, [videoFile, segments, captionStyle, phase]);

  const busy = phase === "encoding";

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleExport}
        disabled={segments.length === 0}
        className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition-all duration-300 hover:from-violet-500 hover:to-cyan-500 hover:shadow-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50 text-sm"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Recording… {progress}%
          </>
        ) : phase === "done" ? (
          "✓ Downloaded!"
        ) : (
          <>
            <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 duration-200" />
            Export Video
          </>
        )}
      </button>

      {busy && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Recording at real-time speed — {progress}% complete
          </p>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-600">
        {busy
          ? "Playing video and capturing frames locally — no upload"
          : "Captions burned in locally using Canvas · Chrome/Edge recommended"}
      </p>
    </div>
  );
}
