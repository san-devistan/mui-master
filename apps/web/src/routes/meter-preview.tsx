import { createFileRoute } from "@tanstack/react-router"
import { PackMeter } from "@workspace/ui/components/pack-meter"
import { ClockIcon } from "lucide-react"

const badge = (
  <>
    <ClockIcon aria-hidden="true" />
    18m 42s
  </>
)

export const Route = createFileRoute("/meter-preview")({
  component: () => (
    <div className="gap-12 p-10 flex flex-col items-start">
      <PackMeter held={1} max={6} progress={0.4} extra={8} badge={badge} />
      <PackMeter held={1} max={6} progress={0.4} badge={badge} />
    </div>
  ),
})
