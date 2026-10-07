import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "import audiometa songs",
  { hours: 24 },
  internal.catalog.startImport,
  {}
)

export default crons
