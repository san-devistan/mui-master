import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { XIcon } from "lucide-react"

// Searches cards by title and, for songs, artists, under the filters chosen;
// the order gives way to best match first. Closing it clears the search.
// `label` names it, e.g. "Search your cards".
export function CollectionSearch({
  text,
  label,
  onText,
  onClose,
}: {
  text: string
  label: string
  onText: (text: string) => void
  onClose: () => void
}) {
  return (
    <search className="mt-5 gap-3 flex">
      <Input
        variant="game"
        type="search"
        // Opened by a tap on the search button, to type straight away.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        enterKeyHint="search"
        placeholder="Songs, artists…"
        aria-label={label}
        value={text}
        onChange={(event) => onText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose()
        }}
      />
      <Button
        variant="game"
        size="icon-game"
        className="shrink-0"
        aria-label="Close search"
        onClick={onClose}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </search>
  )
}
