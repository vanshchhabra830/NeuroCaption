"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Segment, CaptionStyle } from "@/types";
import { drawCaption } from "@/lib/captionRenderer";

interface VideoPreviewProps {
  videoUrl: string;
  segments: Segment[];
  captionStyle: CaptionStyle;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onActiveSegmentChange?: (segId: number | null) => void;
}

export default function VideoPreview({
  videoUrl,
  segments,
  captionStyle,
  videoRef,
  onActiveSegmentChange,
}: VideoPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastActiveId = useRef<number | null>(null);
  const [videoDims, setVideoDims] = useState({ w: 1920, h: 1080 });

  const handleMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDims({ w: v.videoWidth || 1920, h: v.videoHeight || 1080 });
  }, [videoRef]);

  const render = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const t = video.currentTime;
    const seg = segments.find((s) => t >= s.start && t <= s.end);
    const activeId = seg ? seg.id : null;
    if (activeId !== lastActiveId.current) {
      lastActiveId.current = activeId;
      onActiveSegmentChange?.(activeId);
    }

    if (seg) {
      const duration = seg.end - seg.start;
      const progress = duration > 0 ? (t - seg.start) / duration : 1;
      drawCaption(ctx, seg.text, captionStyle, canvas.width, canvas.height, progress, t);
    }

    rafRef.current = requestAnimationFrame(render);
  }, [segments, captionStyle, videoRef, onActiveSegmentChange]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  const isVertical = videoDims.h > videoDims.w;

  return (
    <div className="flex flex-1 items-center justify-center w-full h-full overflow-hidden">
      <div
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50"
        style={{
          aspectRatio: `${videoDims.w} / ${videoDims.h}`,
          maxWidth: isVertical ? "unset" : "100%",
          maxHeight: isVertical ? "100%" : "unset",
          width: isVertical ? "auto" : "100%",
          height: isVertical ? "100%" : "auto",
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onLoadedMetadata={handleMetadata}
          className="absolute inset-0 w-full h-full"
        />
        <canvas
          ref={canvasRef}
          width={videoDims.w}
          height={videoDims.h}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}
