// Run: node packages/backend/convex/songs/_lib/crawl.check.mjs
import assert from "node:assert/strict"

import { nextCrawlCursor } from "./crawl.ts"

const cursor = { bpm: 120, bpmStep: 6, offset: 100, scanned: 50 }
assert.deepEqual(nextCrawlCursor(cursor, 50, 399), {
  bpm: 120,
  offset: 150,
  finished: false,
})
assert.deepEqual(nextCrawlCursor({ ...cursor, scanned: 12 }, 50, 399), {
  bpm: 126,
  offset: 0,
  finished: false,
})
assert.deepEqual(
  nextCrawlCursor({ ...cursor, bpm: 395, scanned: 0 }, 50, 399),
  {
    bpm: 401,
    offset: 0,
    finished: true,
  }
)
