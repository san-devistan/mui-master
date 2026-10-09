export const lastBpm = 399

type CrawlCursor = {
  bpm: number
  bpmStep: number
  offset: number
  scanned: number
}

// A short page ends the bucket; the worker then jumps to its next BPM.
export function nextCrawlCursor(
  { bpm, bpmStep, offset, scanned }: CrawlCursor,
  pageSize: number,
  toBpm: number
) {
  if (scanned === pageSize) {
    return { bpm, offset: offset + pageSize, finished: false }
  }

  const nextBpm = bpm + bpmStep
  return { bpm: nextBpm, offset: 0, finished: nextBpm > toBpm }
}
