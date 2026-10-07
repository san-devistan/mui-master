import type { PreviewStatus } from "@/collection/_hooks/use-song-preview"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { PauseIcon, PlayIcon } from "lucide-react"

type PreviewControlProps = {
  status: PreviewStatus
  onToggle: () => void
}

function PreviewIcon({ status }: { status: PreviewStatus }) {
  if (status === "loading") {
    return <Spinner data-icon="inline-start" />
  }
  if (status === "playing") {
    return <PauseIcon data-icon="inline-start" aria-hidden="true" />
  }
  return <PlayIcon data-icon="inline-start" aria-hidden="true" />
}

export function PreviewControl({ status, onToggle }: PreviewControlProps) {
  if (status === "unavailable") {
    return (
      <p className="text-sm text-center text-muted-foreground">
        No preview available for this song.
      </p>
    )
  }

  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-center text-destructive">
        Could not load the preview.
      </p>
    )
  }

  return (
    <Button
      variant="secondary"
      className="self-center"
      disabled={status === "loading" || status === "idle"}
      onClick={onToggle}
    >
      <PreviewIcon status={status} />
      {status === "playing" ? "Pause preview" : "Play preview"}
    </Button>
  )
}
