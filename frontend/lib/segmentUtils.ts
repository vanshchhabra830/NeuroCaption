import { Segment } from "@/types";

/**
 * Re-chunks segments to enforce a maximum word count per segment.
 * Long segments are split with timestamps distributed proportionally.
 * maxWords = 0 means no limit (returns segments as-is).
 */
export function splitByWordCount(rawSegments: Segment[], maxWords: number): Segment[] {
  if (!maxWords || maxWords <= 0) return rawSegments;

  const result: Segment[] = [];
  let counter = 1;

  for (const seg of rawSegments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
      result.push({ ...seg, id: counter++ });
      continue;
    }

    const duration = seg.end - seg.start;
    const totalWords = words.length;
    let wordIndex = 0;

    while (wordIndex < totalWords) {
      const chunk = words.slice(wordIndex, wordIndex + maxWords);
      const chunkStart = seg.start + (duration * wordIndex) / totalWords;
      const chunkEnd =
        seg.start + (duration * Math.min(wordIndex + maxWords, totalWords)) / totalWords;

      result.push({
        id: counter++,
        start: Math.round(chunkStart * 1000) / 1000,
        end: Math.round(chunkEnd * 1000) / 1000,
        text: chunk.join(" "),
      });

      wordIndex += maxWords;
    }
  }

  return result;
}
