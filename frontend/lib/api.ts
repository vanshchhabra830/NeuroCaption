import { Segment, TranscriptionResponse } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Upload an audio file and receive transcribed segments. */
export async function transcribeAudio(file: File, language: string): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);

  const res = await fetch(`${BASE_URL}/api/transcribe`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Transcription request failed.");
  }

  return res.json() as Promise<TranscriptionResponse>;
}

/**
 * Export edited segments (with word overrides applied) as an SRT file.
 * Triggers a browser download.
 */
export async function exportSRT(
  segments: Segment[],
  wordOverrides: Record<string, string>
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, word_overrides: wordOverrides }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Export request failed.");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "captions.srt";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Convert a list of segments to Hinglish using the backend AI features endpoint.
 */
export async function convertHinglish(segments: Segment[]): Promise<Segment[]> {
  const res = await fetch(`${BASE_URL}/api/convert-hinglish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Hinglish conversion failed.");
  }

  const data = await res.json();
  return data.segments;
}
