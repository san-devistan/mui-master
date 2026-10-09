import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron(
  "import audiometa songs",
  "0 0 1 * *",
  internal.catalog.startImport,
  {}
)

export default crons
